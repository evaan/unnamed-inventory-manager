# SDH Inventory Manager

A web application for the Student Design Hub (SDH) at Memorial University. Staff use it to track tools and electronic parts, sort them into categories, and manage who can do what. Users sign in with their Google (MUN) account.

Live deployment: https://inventory.evaan.dev

## What is in this repository

| Path | Contents |
|------|----------|
| `backend/` | Go API (Gin and GORM) with the auth, inventory, category and settings endpoints, plus Go tests in `backend/tests/` |
| `frontend/` | React and TypeScript single-page app (Vite, Tailwind, TanStack Query) with Vitest tests next to the code |
| `compose.yml` | Production stack: Traefik, a Docker socket proxy, the frontend, the backend and PostgreSQL |
| `justfile` | `just dev` starts the backend and frontend in development mode |
| `.github/workflows/` | CI: build, test, lint, format and Swagger checks, then auto-merge |
| `docs/` | User guide, maintenance guide and operations guide |
| `Permissions.md` | List of the user permissions and what each one allows |

## Requirements

- Docker with the Compose plugin (to run the full system)
- A Google OAuth client ID and secret (Google Cloud Console → APIs & Services → Credentials)
- For development only: Go (the version in `backend/go.mod`), Bun 1.x, PostgreSQL, and optionally `just`, `tmux` and `air`

## Run the full system from a clean checkout

```bash
git clone git@github.com:evaan/unnamed-inventory-manager.git
cd unnamed-inventory-manager
cp .env.example .env
# Edit .env: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and ADMIN_EMAIL.
# For a local run, also add:
#   GOOGLE_REDIRECT_URL=http://localhost:8381/api/callback
#   FRONTEND_URL=http://localhost:8381/app
docker compose up -d --build
```

Open http://localhost:8381. The redirect URL above must also be added to the OAuth client's authorised redirect URIs in Google Cloud Console.

The first person to sign in with the email in `ADMIN_EMAIL` becomes the administrator. By default only `@mun.ca` addresses can sign up. The administrator can change this in **Settings → App settings**.

## Development

```bash
cp backend/.env.example backend/.env      # fill in values and a local POSTGRES_URL
cp frontend/.env.example frontend/.env
cd frontend && bun install && cd ..
just dev                                  # backend on :8080 (air), frontend on :5173 (Vite)
```

Open http://localhost:5173. Vite proxies `/api` to the backend.

## Tests and checks

```bash
cd backend && go test ./... && go vet ./... && gofmt -l .
cd frontend && bun run test && bun run lint && bun run build
```

CI runs the same checks on every push to a branch other than `main`.

## Documentation

- [User guide](docs/user-guide.md)
- [Maintenance guide](docs/maintenance-guide.md)
- [Operations guide](docs/operations-guide.md)
- API reference: run the backend in debug mode and open `/swagger/index.html`

## License

See [LICENSE](LICENSE).
