# Operations Guide

This guide covers deploying, configuring, rolling back and checking the health of the production system.

## Environment

The system runs as a Docker Compose stack on a single Linux host. Cloudflare sits in front of the host and serves `inventory.evaan.dev`. Cloudflare forwards traffic to the host on port 8381, where Traefik routes it to the containers.

| Service | Image | Role |
|---------|-------|------|
| `traefik` | `traefik:v3` | Reverse proxy. `/api/*` goes to the backend with the prefix stripped, and everything else goes to the frontend. |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy:lts` | Gives Traefik read-only access to the Docker API on an internal network (POST disabled). |
| `frontend` | `ghcr.io/evaan/unnamed-inventory-manager/frontend:<sha>` | nginx (unprivileged) serving the React build |
| `backend` | `ghcr.io/evaan/unnamed-inventory-manager/backend:<sha>` | Go server in a distroless, non-root image |
| `postgres` | `postgres:19-alpine` | Database. Data is kept in `./postgres-data` on the host. |

Only Traefik publishes a port (`8381`). The database and backend are not reachable from outside the Docker network. Every service uses `restart: always`.

The frontend and backend images are built once by the **Deliver** pipeline and tagged with the commit SHA. The host never builds them in normal operation. If `IMAGE_TAG` is unset, Compose builds them locally from `frontend/Dockerfile` and `backend/Dockerfile` instead, which is what a developer's `docker compose up --build` does.

## How a change reaches production

```
feature branch push ──► CI (build, test, lint, gofmt/vet, Swagger) ──► auto-merge to main
                                                                            │
main ──► Deliver: checks again ──► build + push images (tag = SHA) ──► deploy job on the host
                                                                            │
                     backup DB ─► checkout SHA ─► pull ─► up -d ─► health check ─► (fail) roll back
```

- **CI** (`.github/workflows/auto-merge.yml`) runs on every branch push. When it passes, it merges the open PR into `main`.
- **Deliver** (`.github/workflows/deliver.yml`) runs on every push to `main`, or by hand from the Actions tab. It runs the same checks on the merged commit and publishes both images to GitHub Container Registry (GHCR). It then deploys that commit on the production host.
- The deploy job runs on a **self-hosted runner** on the production host. The runner only makes outbound HTTPS connections to GitHub, so the host opens no SSH port and GitHub stores no SSH key.
- The deploy job belongs to the GitHub **environment** `production`, so every deployment is listed under *Deployments* in the repository. You can also add a required reviewer there, so that a person must approve each release.

## One-time host setup

1. Install Docker with the Compose plugin. Create a user for the runner and add it to the `docker` group.
2. Clone the repository to the deploy folder (for example `/srv/inventory`). Then create `.env` there (see [Configuration](#configuration)).
3. In GitHub, open **Settings → Actions → Runners → New self-hosted runner** and install the runner as that user. Give it the label `inventory-prod` and install it as a service (`./svc.sh install && ./svc.sh start`).
4. In **Settings → Secrets and variables → Actions → Variables**, add `DEPLOY_DIR` with the deploy folder path.
5. In **Settings → Environments**, create `production` and limit it to the `main` branch. You can also add required reviewers.
6. In **Settings → Actions → General**, require approval for workflows from outside collaborators. The repository is public, and this stops pull requests from forks running code on the self-hosted runner.

## Configuration

Secrets go in a `.env` file next to `compose.yml`. This file is git-ignored and must never be committed. Start from `.env.example`.

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GOOGLE_CLIENT_ID` | yes | none | The stack refuses to start without it |
| `GOOGLE_CLIENT_SECRET` | yes | none | The stack refuses to start without it |
| `POSTGRES_PASSWORD` | yes | none | Database password. The stack refuses to start without it. Use letters and digits only, because it is placed in a URL (`openssl rand -hex 24`). |
| `GOOGLE_REDIRECT_URL` | no | `https://inventory.evaan.dev/api/callback` | Must match an authorised redirect URI in Google Cloud |
| `FRONTEND_URL` | no | `https://inventory.evaan.dev/app` | Used for redirects, CORS and the CSRF origin check |
| `ADMIN_EMAIL` | no | empty | Email that becomes the first administrator |
| `IMAGE_TAG` | no | `local` (build on the host) | Written by the Deliver pipeline. It is the commit SHA of the release that is running. |

The sign-up policy and approved email domains are runtime settings, changed in the app under **Settings → App settings**. They are not environment variables.

To change a value, edit `.env` and run `docker compose up -d`. Compose recreates only the containers whose configuration changed.

### Moving an existing database off the old default password

Before this change, `compose.yml` set the database password to `admin`. Postgres only reads `POSTGRES_PASSWORD` when it first creates the database, so an existing database keeps its old password. On a host that already has data:

```bash
echo 'POSTGRES_PASSWORD=admin' >> .env           # the stack starts again with the old password
new="$(openssl rand -hex 24)"
docker compose exec -T postgres psql -U admin -d inventory -c "ALTER USER admin WITH PASSWORD '$new';"
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$new/" .env
docker compose up -d                             # recreates the backend with the new URL
```

## Deploy

**Normal path:** merge to `main`. The Deliver pipeline deploys the merged commit and checks that it is healthy. Follow it in **Actions → Deliver**. The run summary shows the health-check output, and the `deployment-<sha>` artifact contains the same text.

**By hand** (for example if GitHub Actions is down), on the host:

```bash
cd "$DEPLOY_DIR"
docker compose exec -T postgres pg_dump -U admin inventory | gzip > backups/manual-$(date +%F-%H%M).sql.gz
git fetch origin
git checkout --detach <commit sha>
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<commit sha>/" .env   # a SHA the pipeline has published
docker compose pull backend frontend
docker compose up -d --no-build
scripts/healthcheck.sh http://localhost:8381 12
```

If the images for that commit were never published, remove the `IMAGE_TAG` line and run `docker compose up -d --build` instead.

The backend migrates the database schema automatically on startup.

## Roll back

The pipeline rolls back by itself when a new release fails its health check. It checks out the previous commit and starts the previous images again, then marks the run as failed.

To go back to an earlier release on purpose:

1. **Through the pipeline (preferred):** open **Actions → Deliver → Run workflow**. Set `rollback_to` to the commit SHA of a release that worked. Find it under *Deployments → production* or in the history of earlier Deliver runs. The pipeline skips the build and redeploys that release's images, with a database backup and a health check.
2. **By hand:** follow the manual deploy steps above with the older SHA.
3. **Restore the data** (only if a release damaged it). Each deploy saves a backup in `backups/pre-deploy-<date>-<sha>.sql.gz`, and the 14 newest are kept.
   ```bash
   docker compose stop backend
   docker compose exec -T postgres psql -U admin -d postgres -c 'DROP DATABASE inventory;' -c 'CREATE DATABASE inventory OWNER admin;'
   gunzip -c backups/pre-deploy-YYYY-MM-DD-HHMM-<sha>.sql.gz | docker compose exec -T postgres psql -U admin -d inventory
   docker compose start backend
   ```

GORM `AutoMigrate` only adds tables and columns, so older code still runs against a newer schema. Check the release notes before rolling back across a change that renames or removes columns.

## Health checks

`scripts/healthcheck.sh [base-url] [attempts]` checks the frontend and the backend in one step. It exits non-zero if either is unhealthy. The pipeline runs it after every deploy.

```bash
scripts/healthcheck.sh                                  # production, from anywhere
scripts/healthcheck.sh http://localhost:8381 12         # on the host, retrying for up to a minute
```

| Check | Command or URL | Healthy result |
|-------|----------------|----------------|
| Whole stack | `scripts/healthcheck.sh` | `RESULT healthy` |
| Containers | `docker compose ps` | All `running`, postgres `healthy` |
| Database | built-in healthcheck (`pg_isready` every 5 s) | `healthy`. The backend does not start until it is. |
| Backend | `curl -s https://inventory.evaan.dev/api/whoami` | HTTP 200 with `{"loggedIn":false}` |
| Frontend | open https://inventory.evaan.dev | The login page loads |
| Running release | `grep IMAGE_TAG .env` and `docker compose ps` | The SHA you expect |
| Logs | `docker compose logs -f backend` | No repeated 5xx errors |

## Common problems

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Stack won't start: "Set GOOGLE_CLIENT_ID in .env" (or `POSTGRES_PASSWORD`) | `.env` is missing or incomplete | Create `.env` from `.env.example` |
| Backend restarts with "password authentication failed" | `POSTGRES_PASSWORD` does not match the existing database | See [Moving an existing database off the old default password](#moving-an-existing-database-off-the-old-default-password) |
| Deliver's deploy job waits forever in "Queued" | The self-hosted runner is offline, or a reviewer has not yet approved the deployment | `sudo ./svc.sh status` in the runner folder, or approve the deployment in the run |
| Deploy job fails: "Set the DEPLOY_DIR repository variable" | `DEPLOY_DIR` is not set or `.env` is missing there | See [One-time host setup](#one-time-host-setup) |
| Deploy fails at `docker compose pull`: "manifest unknown" | No images were published for that SHA | Pick a SHA from a successful Deliver run |
| Deploy fails at `git checkout`: "local changes would be overwritten" | Someone edited tracked files on the host | Commit the change through a PR, then `git checkout -- .` on the host |
| Google shows `redirect_uri_mismatch` | `GOOGLE_REDIRECT_URL` isn't registered with Google | Add it in Google Cloud Console |
| Sign-in works but changes fail with 403 | Request Origin doesn't match `FRONTEND_URL` | Set `FRONTEND_URL` to the public URL |
| New users land on "Account disabled" | Their domain isn't on the approved list | Add the domain, or enable the user, in Settings |
| 404 on `/api/...` | Traefik labels or host rule don't match | Check that the host is `inventory.evaan.dev` or `localhost` |

## Secrets

- `.env`, `postgres-data/` and `backups/` are in `.gitignore`.
- The repository contains no passwords or keys. `compose.yml` reads them from `.env`, and the stack refuses to start without them.
- The pipeline uses only the built-in, short-lived `GITHUB_TOKEN` to push and pull images. It needs no stored secrets, because the deploy runs on the host itself and reads `.env` there.
- Session tokens are stored only as hashes.
- Never paste `.env` contents or OAuth secrets into issues, logs or screenshots.
