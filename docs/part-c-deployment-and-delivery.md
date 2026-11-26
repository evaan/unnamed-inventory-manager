# Part C: Deployment and Delivery

## C.1 Changes to continuous integration since Assignment 1

The CI described in Assignment 1 is still the first stage of the pipeline, with these changes:

| Change | When | Why |
|--------|------|-----|
| `merge-to-main` now depends on both backend and frontend (it used to depend on the frontend only), and it merges only an existing open PR instead of opening one itself. | PR #24 and #28, 12 Nov | As first written, the job waited only for the frontend, so switching it on as it was would have let a backend failure through. Members now open PRs themselves, so each one has a description that can be reviewed. |
| The frontend jobs use Bun instead of npm (`bun install --frozen-lockfile`), with a dependency cache keyed on the lockfile. | PR #38, 16 Nov | The team switched to Bun from Node as it improves build times for CI and Docker deployment. |
| The Go jobs cache modules and build output. | PR #42, 17 Nov | Shorter pipeline runs. |

## C.2 Deployment environment

**Choice.** The system runs as a Docker Compose stack on one Linux server owned by Evan. Cloudflare sits in front of it and serves the public address https://inventory.evaan.dev. The stack has five containers:

| Container | Purpose |
|-----------|---------|
| Traefik | Reverse proxy. It is the only container that publishes a port (8381). Requests to `/api/*` go to the backend and everything else goes to the frontend. |
| Docker socket proxy | Gives Traefik access to the Docker API on an internal network, with POST requests disabled, so Traefik never holds the Docker socket itself |
| Frontend | nginx (unprivileged) serving the built React app |
| Backend | Go API in a minimal "distroless" image running as a non-root user |
| PostgreSQL 19 | Database. It is reachable only inside the Docker network, and its data is stored on the host. |

**Why it suits this project.**

- **Scale.** The client is one makerspace, the Student Design Hub. A single Compose stack keeps the deployment simple without adding load balancing or automatic scaling.
- **Cost.** Using Evan's server avoids a separate cloud hosting subscription and managed database bill.
- **Same stack locally.** The production stack can also be built locally with `docker compose up --build`. Development has a separate `compose.dev.yml`, with hot reload for the frontend and backend and its own database.
- **Easy to hand over.** The application stack is described by `compose.yml` and the two Dockerfiles. A future maintainer can rebuild it on another host, but still needs the server configuration, `.env` and database data.
- **Limited exposure.** Cloudflare provides the public HTTPS address. Compose publishes only Traefik's port; the backend and database have no published host ports.

**Alternatives considered.**

| Option | Why we did not choose it |
|--------|--------------------------|
| Kubernetes (or k3s) | For five containers on one host it adds more configuration and maintenance than Compose. |
| Google Cloud (Cloud Run plus Cloud SQL), the option named in Assignment 1 | Would need cloud service configuration and billing for the application and database. The current setup uses Evan's server instead. |
| Other platform-as-a-service (for example Render or Fly.io) | Less server work, but would need platform-specific configuration and a plan for hosting PostgreSQL. |
| A VM with the services installed directly | No container overhead, but every dependency and its version would have to be installed by hand. Production would drift from what developers test, and rollback would be harder. |

**Trade-off we accept.** A single server is a single point of failure. Every container has `restart: always`, and the database data stays in `postgres-data` when containers are replaced. Neither of these protects against losing the host or its disk.

## C.3 How the pipeline delivers the system

The current pipeline covers integration, not automatic deployment. `.github/workflows/auto-merge.yml` calls the backend and frontend workflows on pushes to branches other than `main`, or when started by hand.

Design decisions:

- **Check both parts before merging.** The backend workflow builds, tests, checks formatting, runs `go vet` and checks the Swagger files. The frontend workflow builds, lints and tests. All jobs use GitHub-hosted `ubuntu-latest` runners.
- **Merge only an existing PR.** `merge-to-main` waits for both workflows, looks for an open PR from the branch into `main`, then squash-merges it and deletes the branch. If there is no PR, it skips the merge.
- **Build the containers on the host.** Deployment is a separate manual step: update the checkout on the server and run `docker compose up -d --build`. The frontend and backend are rebuilt from source. Although Compose has GHCR image names, there is no current workflow that builds or publishes those images.
- **Check the running stack.** `scripts/healthcheck.sh` requests the frontend and `/api/whoami`, checking for HTTP 200 and the expected response content. It can retry five seconds apart, but CI does not run it or roll back a failed deployment.

The saved deployment check in `evidence/deployment/healthcheck.txt` shows that the public frontend and `/api/whoami` both returned HTTP 200 on 21 Nov. It is evidence of that check, not of an automated release pipeline.

## C.4 Deployment steps (summary)

The current Compose deployment is:

1. **Set up the server (once).** Install Docker with Compose, clone the repository and create `.env` from `.env.example`. Set the Google OAuth credentials and `ADMIN_EMAIL`, and add `POSTGRES_PASSWORD`, which Compose requires but the example file does not yet include.
2. **Deploy.** After CI passes and the PR merges, update the server checkout to the intended `main` commit and run `docker compose up -d --build`. Merging alone does not update production.
3. **Configure.** OAuth credentials, the database password, URL overrides and the first admin email go in `.env` on the server. To change one, edit `.env` and run `docker compose up -d`. The sign-up policy and allowed email domains are changed in the app's settings.
4. **Roll back.** Return the server checkout to a known working commit and rebuild the containers. This is manual and does not undo database changes.
5. **Check health.** Run `scripts/healthcheck.sh` (it should print `RESULT healthy`) and `docker compose ps` (every container `running`, postgres `healthy`).

**Keeping secrets out of the repository.** `.env`, the database folder and the backups folder are git-ignored. Compose reads `POSTGRES_PASSWORD` from `.env` and refuses to start if it is missing. CI uses GitHub's short-lived `GITHUB_TOKEN` to merge PRs; it does not need the production OAuth credentials or database password.

## C.5 Limitations and next steps

- The deployment runs on one server, which is a single point of failure (Section C.2).
- There is no automated deployment, database backup or rollback in the current workflows. Database persistence is not a backup.
- The health check confirms that the frontend is served and that the backend answers. It does not run a full sign-in, which still needs a manual check with a real Google account.
- The backend runs GORM `AutoMigrate` at startup. Rebuilding an older release does not reverse those changes, so database compatibility must be checked before rolling back.
