# Operations Guide

## Environment

The system runs as a Docker Compose stack on a single Linux host. Cloudflare sits in front of the host and serves `inventory.evaan.dev`. Cloudflare forwards traffic to the host on port 8381, where Traefik routes it to the containers.

| Service | Image | Role |
|---------|-------|------|
| `traefik` | `traefik:v3` | Reverse proxy. `/api/*` goes to the backend with the prefix stripped, and everything else goes to the frontend. |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy:lts` | Gives Traefik read-only access to the Docker API on an internal network (POST disabled). |
| `frontend` | `ghcr.io/evaan/unnamed-inventory-manager/frontend:<sha>` | nginx (unprivileged) serving the React build |
| `backend` | `ghcr.io/evaan/unnamed-inventory-manager/backend:<sha>` | Go server in a distroless, non-root image |
| `postgres` | `postgres:19-alpine` | Database. Data is kept in `./postgres-data` on the host. |

The frontend and backend images are built once by the **Deliver** pipeline and tagged with the commit SHA. The host never builds them in normal operation. If `IMAGE_TAG` is unset, Compose builds them locally from `frontend/Dockerfile` and `backend/Dockerfile` instead, which is what a developer's `docker compose up --build` does.

## How a change reaches production

- CI (`.github/workflows/auto-merge.yml`) runs on every branch push. When it passes, it merges the open PR into `main`.
- Deliver (`.github/workflows/deliver.yml`) runs on every push to main, or by hand from the Actions tab. It runs the same checks on the merged commit and publishes both images to GitHub Container Registry (GHCR). It then deploys that commit on the production host.
- The deploy job runs on a self-hosted runner on the production host. The runner only makes outbound HTTPS connections to GitHub, so the host opens no SSH port and GitHub stores no SSH key.
- The deploy job belongs to the GitHub environment production, so every deployment is listed under *Deployments* in the repository. You can also add a required reviewer there, so that a person must approve each release.

## One-time host setup

1. Install Docker with the Compose plugin. Create a user for the runner and add it to the `docker` group.
2. Clone the repository to the deploy folder (for example `/srv/inventory`). Then create `.env` there (see [Configuration](#configuration)).
3. In GitHub, open **Settings → Actions → Runners → New self-hosted runner** and install the runner as that user. Give it the label `inventory-prod` and install it as a service (`./svc.sh install && ./svc.sh start`).
4. In **Settings → Secrets and variables → Actions → Variables**, add `DEPLOY_DIR` with the deploy folder path.
5. In **Settings → Environments**, create `production` and limit it to the `main` branch. You can also add required reviewers.
6. In **Settings → Actions → General**, require approval for workflows from outside collaborators. The repository is public, and this stops pull requests from forks running code on the self-hosted runner.

## Configuration

Secrets go in a `.env` file next to `compose.yml`. This file is git-ignored and must never be committed. Start from `.env.example`.

The sign-up policy and approved email domains are runtime settings, changed in the app under Settings -> App settings. They are not environment variables.

To change a value, edit `.env` and run `docker compose up -d`. Compose recreates only the containers whose configuration changed.

## Deploy

See Deployment Document

## Health checks

`scripts/healthcheck.sh [base-url] [attempts]` checks the frontend and the backend in one step. It exits non-zero if either is unhealthy. The pipeline runs it after every deploy.

```bash
scripts/healthcheck.sh                                  # production, from anywhere
scripts/healthcheck.sh http://localhost:8381 12         # on the host, retrying for up to a minute
```