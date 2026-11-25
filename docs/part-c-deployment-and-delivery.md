<!-- Part C starts on a new page in the PDF. Replace every [TODO …] before submitting. -->

# Part C: Deployment and Delivery

## C.1 Changes to continuous integration since Assignment 1

The CI described in Assignment 1 is still the first stage of the pipeline, with these changes:

| Change | When | Why |
|--------|------|-----|
| Deleted the separate *Enable auto-merge* workflow, which ran on `pull_request_target`. The `merge-to-main` job in the CI workflow, disabled with `if: false` in Assignment 1, now does this work. | PR #20, 9 Nov; fixed in #24 and #26, 12 Nov | The old workflow depended on GitHub's required-check settings to hold the merge back. Now the same run that tests a commit also merges it, so a merge only follows a run in which both the backend and frontend jobs passed. |
| `merge-to-main` now depends on both backend and frontend (it used to depend on the frontend only), and it merges only an existing open PR instead of opening one itself. | PR #24 and #28, 12 Nov | As first written, the job waited only for the frontend, so switching it on as it was would have let a backend failure through. Members now open PRs themselves, so each one has a description that can be reviewed. |
| The frontend jobs use Bun instead of npm (`bun install --frozen-lockfile`), with a dependency cache keyed on the lockfile. | PR #38, 16 Nov | The team develops with Bun, and the frontend image is built with Bun, so CI now matches development and production. |
| The Go jobs cache modules and build output. | PR #42, 17 Nov | Shorter pipeline runs. |
| New **Deliver** workflow, and `merge-to-main` now starts it after a merge. | This assignment | Delivery to production (Section C.3). |

## C.2 Deployment environment

**Choice.** The system runs as a Docker Compose stack on one Linux server owned by a team member. Cloudflare sits in front of it and serves the public address https://inventory.evaan.dev. The stack has five containers:

| Container | Purpose |
|-----------|---------|
| Traefik | Reverse proxy. It is the only container that publishes a port (8381). Requests to `/api/*` go to the backend and everything else goes to the frontend. |
| Docker socket proxy | Gives Traefik read-only access to Docker, so Traefik never holds the Docker socket itself |
| Frontend | nginx (unprivileged) serving the built React app |
| Backend | Go API in a minimal "distroless" image running as a non-root user |
| PostgreSQL 19 | Database. It is reachable only inside the Docker network, and its data is stored on the host. |

**Why it suits this project.**

- **Scale.** The client is one makerspace, the Student Design Hub, with tens of staff and students. One server handles that load easily, and the project needs no load balancing or automatic scaling.
- **Cost.** The server already existed, so hosting costs nothing. A managed cloud database alone would cost money every month, which the client has not budgeted for.
- **Same stack everywhere.** The `compose.yml` that runs production also runs on any developer's laptop with `docker compose up --build`. This is how we test the integrated system before release, so "works on my machine" problems are rare.
- **Easy to hand over.** The whole deployment is described by files in the repository (`compose.yml`, two Dockerfiles and the workflows). A future maintainer can rebuild it on a new server, or on a university VM, by following the operations guide.
- **Security without exposure.** Cloudflare provides HTTPS and hides the server's address. Only the proxy port is open, and the database and backend cannot be reached from the internet.

**Alternatives considered.**

| Option | Why we did not choose it |
|--------|--------------------------|
| Kubernetes (or k3s) | Built for many servers and many services. For five containers on one host it adds a lot to learn and operate, and nobody on the client side could maintain it. |
| Google Cloud (Cloud Run plus Cloud SQL), the option named in Assignment 1 | Considered first. Cloud Run would run our existing images with little change. However, Cloud SQL charges for an always-on database even when nobody uses the tool, and billing would need a credit card held by the client or a student. That account would be hard to hand over when the team leaves. The same Compose stack can still be moved to a Google Cloud VM later if the SDH wants that. |
| Other platform-as-a-service (for example Render or Fly.io) | Less server work, but there is a monthly cost for an always-on service plus a managed database. It also ties the project to one vendor's configuration format. |
| A VM with the services installed directly | No container overhead, but every dependency and its version would have to be installed by hand. Production would drift from what developers test, and rollback would be harder. |

**Trade-off we accept.** A single server is a single point of failure. For an internal inventory tool, a short outage is acceptable. We reduce the risk of losing data with a database backup before every deploy (Section C.3) and with `restart: always` on every container.

## C.3 How the pipeline delivers the system

The pipeline now has two workflows. Figure C.1 shows the full path from a pushed branch to production.

Design decisions:

- **Build once, deploy the same thing.** Each image is built once in the pipeline and tagged with the commit SHA (for example `ghcr.io/evaan/unnamed-inventory-manager/backend:<sha>`). Before this change, the server rebuilt from source on every deploy, so the binary in production was never the one CI had tested. The SHA tag also makes rollback quick: redeploying an old release only pulls an existing image.
- **Self-hosted runner instead of SSH.** The deploy job runs on a GitHub Actions runner installed on the production server. The runner only makes outbound connections to GitHub, so the server opens no SSH port to the internet and no SSH private key is stored in GitHub. The alternative, a cloud runner that connects in over SSH, would need both. Because the repository is public, the deploy job runs only in the protected `production` environment, which is limited to `main`, and workflows from outside contributors need approval before they run. This stops a pull request from a fork from running code on the server.
- **Health-gated release with automatic rollback.** After starting the new containers, the pipeline runs `scripts/healthcheck.sh`. The script requests the frontend and the backend's `/whoami` endpoint and retries for up to a minute. If either check fails, the pipeline restores the previous commit and images and marks the run as failed. Users are then left on the last working version rather than a broken one.
- **Backup before every change.** The deploy job runs `pg_dump` before it touches anything, and the server keeps the 14 most recent backups.
- **Traceable deployments.** The deploy job belongs to the GitHub environment `production`, so GitHub records which commit was deployed, when, and by which run. Each run also saves its health-check output as a downloadable artifact.
- **Rollback is part of the pipeline.** Running Deliver by hand with `rollback_to = <older SHA>` skips the build and redeploys that release, with the same backup and health check.

One problem we found while extending the pipeline: GitHub does not start a new workflow for a push made with the built-in `GITHUB_TOKEN`. Our auto-merge job merges with that token, so a `push` trigger on `main` alone would never fire after an automatic merge. The merge job therefore starts Deliver explicitly (`gh workflow run deliver.yml`) once the pull request has merged. Merges made by a person in the GitHub interface trigger Deliver through the normal `push` event.

## C.4 Deployment steps (summary)

The full procedure is in the Operations Guide (Appendix [TODO letter], `docs/operations-guide.md`). In summary:

1. **Set up the server (once).** Install Docker, clone the repository and create `.env` from `.env.example`. Register a self-hosted runner with the label `inventory-prod`, set the `DEPLOY_DIR` variable, and create the `production` environment.
2. **Deploy.** Merge a pull request into `main`. The pipeline does the rest. A manual fallback, for when GitHub Actions is unavailable, is a short list of commands in the guide.
3. **Configure.** All settings and secrets (Google OAuth client, database password, public URL, first admin) live in `.env` on the server. To change one, edit `.env` and run `docker compose up -d`.
4. **Roll back.** Rollback is automatic when the health check fails. Otherwise, run Deliver with `rollback_to`. If a release damaged data, restore the most recent `backups/pre-deploy-*.sql.gz`.
5. **Check health.** Run `scripts/healthcheck.sh` (it should print `RESULT healthy`) and `docker compose ps` (every container `running`, postgres `healthy`).

**Keeping secrets out of the repository.** `.env`, the database folder and the backups folder are git-ignored. While extending the pipeline we found that `compose.yml` still contained the database password (`admin`) in plain text. We moved it to `.env` as `POSTGRES_PASSWORD`, and Compose now refuses to start if it is missing. The operations guide explains how to change the password on the existing database. The pipeline needs no stored secrets. It uses GitHub's short-lived `GITHUB_TOKEN` to push and pull images, and the deploy job reads `.env` directly on the server.

## C.6 Limitations and next steps

- The deployment runs on one server, which is a single point of failure (Section C.2).
- Backups are stored on the same server as the database. For the final report, we plan to copy them to a second location, such as university storage or object storage.
- The health check confirms that the frontend is served and that the backend answers. It does not run a full sign-in, because that needs a real Google account. Signing in is covered by the demonstration.
- Database schema changes only ever add tables and columns (GORM `AutoMigrate`), so older releases run safely against a newer database. A future change that removes or renames a column will need a written migration and rollback plan.
