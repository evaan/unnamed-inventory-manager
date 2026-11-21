# Maintenance Guide

This guide is for developers who will maintain or extend the system.

## Architecture

The system is a three-tier web application. Its backend is a modular monolith.

```
Browser ──HTTP──> Traefik ──/api/*──> backend (Go, Gin)  ──> PostgreSQL
                          └─/*──────> frontend (nginx serving the React build)
```

- **Presentation tier:** `frontend/`, a React single-page app. It only talks to the backend through the API modules in `src/features/*/…api.ts`.
- **Service tier:** `backend/`, one Go binary split into packages by domain:
  - `auth/`: Google OAuth login, sessions, users, permissions
  - `inventory/`: items, categories and the changelog
  - `settings/`: app settings (sign-up policy, approved domains)
  - `middleware/`: CORS, CSRF (Origin/Referer check), session and permission guards
  - `routes/routes.go`: every route and the middleware that protects it
  - `database/`: connection and `AutoMigrate`
- **Data tier:** PostgreSQL. GORM creates and migrates the tables at startup (`database/migrate.go`).

Traefik strips the `/api` prefix before requests reach the backend, so backend routes have no `/api` prefix.

## Data model

| Table | Purpose |
|-------|---------|
| `users` | Google ID, name, email, picture, `disabled` flag |
| `user_permissions` | One row per (user, permission) |
| `user_sessions` | SHA-256 hash of the session token and its expiry. The raw token is only in the browser cookie. |
| `items` | Inventory items. Soft-deleted with `deleted_at`. |
| `item_categories` | Categories, each with an optional `parent_id` for nesting |
| `ItemCategoryLinks` | Many-to-many join between items and categories |
| `changelogs` | Every create, quantity change, modify and delete, with the user and time |
| `settings` | Key/value app settings, with defaults set by `settings.SeedDefaults` |

## Authentication flow

1. `GET /login` sets an OAuth state cookie and redirects to Google.
2. `GET /callback` checks the state, exchanges the code, verifies the ID token and email, then finds or creates the user. New users are enabled or disabled according to the sign-up policy. The first user whose email matches `ADMIN_EMAIL` is made administrator when no administrator exists.
3. A random session token is set as an HttpOnly cookie. Only its hash is stored.
4. Every request goes through `AuthOptional`, `AuthRequired`, `SessionRequired` or `AdminRequired` (see `routes.go`). Item endpoints also check the specific permission inside the handler. Category endpoints use `PermissionRequired`.

## Adding a feature

1. Create a branch from `main`.
2. **Backend:** add the handler in the right package, register it in `routes/routes.go` with the right middleware, and add Swagger comments. Run `swag init -g main.go -o docs` from `backend/`, because CI fails if `docs/` is out of date. Add new models to `database/migrate.go`.
3. **Backend tests:** add them to `backend/tests/`. `helpers_test.go` builds an in-memory SQLite database and a router, and can create users with given permissions and session cookies.
4. **Frontend:** put the API calls in `src/features/<feature>/<feature>api.ts`, use TanStack Query hooks for loading data, and put pages in `src/pages/`. Hide controls the user has no permission for, using `features/auth/permissions.ts`. The backend still enforces permissions.
5. **Frontend tests:** put them next to the code (`*.test.tsx`). Mock the API module, not `fetch`. Keep tests on user-visible flows and business rules (see `frontend/README.md`).
6. **Permissions:** add the constant in `backend/auth/types.go`, the list in `frontend/src/features/auth/permissions.ts`, and a line in `Permissions.md`.
7. Push the branch and open a PR. CI must pass, after which the PR is squash-merged automatically.

## Checks run by CI

| Job | Command | Fails when |
|-----|---------|------------|
| backend/build | `go build ./...` | Code doesn't compile |
| backend/test | `go test ./... -v` | Any test fails |
| backend/stylecheck | `gofmt -l .` and `go vet ./...` | Unformatted code or vet warnings |
| backend/swagger | `swag init` then `git diff --exit-code docs/` | API docs are out of date |
| frontend/build | `bun run build` (`tsc -b && vite build`) | Type errors or build errors |
| frontend/lint | `bun run lint` (ESLint with typescript-eslint and react-hooks) | Lint errors |
| frontend/test | `bun run test` (Vitest with Testing Library and jsdom) | Any test fails |

Locally, the frontend tests need Node 22+ or Bun, because jsdom's `undici` dependency doesn't load on Node 20.

## Known limitations and next steps

- **Bookings** are frontend-only. `features/bookings/bookingsapi.ts` uses an in-memory demo store. A backend `bookings` package with equipment and reservation tables, using the existing `Booking*` permissions, is the next step.
- `GET /items` returns every item. Add pagination and filtering on the server when the inventory grows.
- The PostgreSQL password in `compose.yml` is a placeholder. The database is only reachable on the internal Docker network, but it should be moved to `.env` before wider use.
- Item images and Digi-Key integration were planned but not built.
