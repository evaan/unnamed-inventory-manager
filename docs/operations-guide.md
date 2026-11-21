# Operations Guide

This guide covers deploying, configuring, rolling back and checking the health of the production system.

## Environment

The system runs as a Docker Compose stack on a single Linux host. Cloudflare sits in front of the host and serves `inventory.evaan.dev`. Cloudflare forwards traffic to the host on port 8381, where Traefik routes it to the containers.

| Service | Image | Role |
|---------|-------|------|
| `traefik` | `traefik:v3` | Reverse proxy. `/api/*` goes to the backend with the prefix stripped, and everything else goes to the frontend. |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy:lts` | Gives Traefik read-only access to the Docker API on an internal network (POST disabled). |
| `frontend` | built from `frontend/Dockerfile` | nginx (unprivileged) serving the React build |
| `backend` | built from `backend/Dockerfile` | Go server in a distroless, non-root image |
| `postgres` | `postgres:19-alpine` | Database. Data is kept in `./postgres-data` on the host. |

Only Traefik publishes a port (`8381`). The database and backend are not reachable from outside the Docker network. Every service uses `restart: always`.

## Configuration

Secrets go in a `.env` file next to `compose.yml`. This file is git-ignored and must never be committed. Start from `.env.example`.

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GOOGLE_CLIENT_ID` | yes | none | The stack refuses to start without it |
| `GOOGLE_CLIENT_SECRET` | yes | none | The stack refuses to start without it |
| `GOOGLE_REDIRECT_URL` | no | `https://inventory.evaan.dev/api/callback` | Must match an authorised redirect URI in Google Cloud |
| `FRONTEND_URL` | no | `https://inventory.evaan.dev/app` | Used for redirects, CORS and the CSRF origin check |
| `ADMIN_EMAIL` | no | empty | Email that becomes the first administrator |

The sign-up policy and approved email domains are runtime settings, changed in the app under **Settings → App settings**. They are not environment variables.

## Deploy

On the host:

```bash
cd /path/to/unnamed-inventory-manager
git fetch --tags
git checkout <tag or commit>          # for example a2-submission, or main
docker compose up -d --build
docker compose ps                     # every service should be "running", postgres "healthy"
```

The backend migrates the database schema automatically on startup.

## Roll back

1. **Back up the database before every deploy:**
   ```bash
   docker compose exec -T postgres pg_dump -U admin inventory > backup-$(date +%F-%H%M).sql
   ```
2. **Roll back the code:**
   ```bash
   git checkout <previous tag or commit>
   docker compose up -d --build
   ```
3. **Restore the data** (only if a release damaged it):
   ```bash
   docker compose exec -T postgres psql -U admin -d inventory < backup-YYYY-MM-DD-HHMM.sql
   ```

GORM `AutoMigrate` only adds tables and columns, so older code still runs against a newer schema. Check the release notes before rolling back across a change that renames or removes columns.

## Health checks

| Check | Command or URL | Healthy result |
|-------|----------------|----------------|
| Containers | `docker compose ps` | All `running`, postgres `healthy` |
| Database | built-in healthcheck (`pg_isready` every 5 s) | `healthy`. The backend does not start until it is. |
| Backend | `curl -s https://inventory.evaan.dev/api/whoami` | HTTP 200 with `{"loggedIn":false,...}` |
| Frontend | open https://inventory.evaan.dev | The login page loads |
| Logs | `docker compose logs -f backend` | No repeated 5xx errors |

## Common problems

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Stack won't start: "Set GOOGLE_CLIENT_ID in .env" | `.env` is missing or incomplete | Create `.env` from `.env.example` |
| Google shows `redirect_uri_mismatch` | `GOOGLE_REDIRECT_URL` isn't registered with Google | Add it in Google Cloud Console |
| Sign-in works but changes fail with 403 | Request Origin doesn't match `FRONTEND_URL` | Set `FRONTEND_URL` to the public URL |
| New users land on "Account disabled" | Their domain isn't on the approved list | Add the domain, or enable the user, in Settings |
| 404 on `/api/...` | Traefik labels or host rule don't match | Check that the host is `inventory.evaan.dev` or `localhost` |

## Secrets

- `.env` and `postgres-data/` are in `.gitignore`.
- Session tokens are stored only as hashes.
- Never paste `.env` contents or OAuth secrets into issues, logs or screenshots.
