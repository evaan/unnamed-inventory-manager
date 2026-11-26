# Operations Guide

## Environment

The system runs as a Docker Compose stack on a single Linux host. Cloudflare sits in front of the host and serves `inventory.evaan.dev`. Cloudflare forwards traffic to the host on port 8381, where Traefik routes it to the containers.

| Service | Image | Role |
|---------|-------|------|
| `traefik` | `traefik:v3` | Reverse proxy. `/api/*` goes to the backend with the prefix stripped, and everything else goes to the frontend. |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy:lts` | Gives Traefik read-only access to the Docker API on an internal network (POST disabled). |
| `frontend` | `ghcr.io/evaan/unnamed-inventory-manager/frontend:${IMAGE_TAG:-local}` | nginx (unprivileged) serving the React build |
| `backend` | `ghcr.io/evaan/unnamed-inventory-manager/backend:${IMAGE_TAG:-local}` | Go server in a distroless, non-root image |
| `postgres` | `postgres:19-alpine` | Database. Data is kept in `./postgres-data` on the host. |

The frontend and backend have image names under GHCR, but the current workflows do not publish them. Build them on the host with `docker compose up -d --build`, using `frontend/Dockerfile` and `backend/Dockerfile`. If `IMAGE_TAG` is unset, the local builds use the tag `local`.

## How a change reaches production

- CI (`.github/workflows/auto-merge.yml`) runs on pushes to branches other than `main`, or by hand from the Actions tab.
- It runs the backend and frontend checks. If both pass and the branch has an open PR into `main`, it squash-merges the PR and deletes the branch.
- Merging does not deploy the change. Someone with access to the production host must update the checkout, rebuild the stack and run the health check.

## One-time host setup

1. Install Docker with the Compose plugin.
2. Clone the repository to the deploy folder (for example `/srv/inventory`). Then create `.env` there (see [Configuration](#configuration)).
3. Set up the Google OAuth client with `https://inventory.evaan.dev/api/callback` as an authorised redirect URI.
4. Configure Cloudflare to forward `inventory.evaan.dev` to the host on port 8381. Start the stack and check it using the commands below.

There is no self-hosted deployment runner to install.

## Configuration

Secrets go in a `.env` file next to `compose.yml`. This file is git-ignored and must never be committed. Start from `.env.example`, fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and add `POSTGRES_PASSWORD`, which is required by Compose but missing from the example. Set `ADMIN_EMAIL` to the account that should become the first administrator.

The production defaults for `GOOGLE_REDIRECT_URL` and `FRONTEND_URL` use `inventory.evaan.dev`. For local use, override both and register the matching Google redirect URI. Another hostname also needs the Traefik Host rules changed in `compose.yml`. `TZ` defaults to `America/St_Johns` and sets the backend's booking time zone.

The sign-up policy and approved email domains are runtime settings, changed in the app under Settings -> App settings. They are not environment variables.

To change a value, edit `.env` and run `docker compose up -d`. Compose recreates only the containers whose configuration changed.

Changing `POSTGRES_PASSWORD` in `.env` does not change the password in an existing database.

## Deploy

From the repository folder on the host, check out the `main` commit you want to deploy, then run:

```bash
docker compose up -d --build
docker compose ps
scripts/healthcheck.sh
```

The database stays in `./postgres-data` when the containers are rebuilt. This is not a backup, and the repository has no automated backup or rollback job. Going back to an older application commit does not undo database migrations.

See [Part C](part-c-deployment-and-delivery.md) for the deployment setup and limitations.

## Health checks

`scripts/healthcheck.sh [base-url] [attempts]` checks that the frontend returns the app's root element and `/api/whoami` returns a login status. It exits non-zero if either check fails. Run it manually after deployment; CI does not run it.

```bash
scripts/healthcheck.sh                                  # production URL
scripts/healthcheck.sh http://localhost:8381 12          # local stack, up to 12 attempts
```

Retries wait five seconds between attempts, and each request can take up to ten seconds. A passing check does not test Google sign-in or a signed-in inventory action.
