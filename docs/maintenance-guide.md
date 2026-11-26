# Maintenance Guide

## Architecture

The system is a three-tier web application. Its backend is a modular monolith.

- **Presentation tier:** `frontend/`, a React single-page app. It only talks to the backend through the API modules in `src/features/*/…api.ts`.
- **Service tier:** `backend/`, one Go binary split into packages by domain:
  - `auth/`: Google OAuth login, sessions, users, permissions
  - `inventory/`: items, categories and the changelog
  - `bookings/`: equipment, reservations and booking rules
  - `settings/`: app settings (sign-up policy, approved domains)
  - `middleware/`: CORS, CSRF (Origin/Referer check), session and permission guards
  - `routes/routes.go`: every route and the middleware that protects it
  - `database/`: connection and `AutoMigrate`
- **Data tier:** PostgreSQL. GORM creates and migrates the tables at startup (`database/migrate.go`).


## Data model

| Table | Purpose |
|-------|---------|
| `users` | Google ID, name, email, picture, `disabled` flag |
| `user_permissions` | One row per (user, permission) |
| `user_sessions` | SHA-256 hash of the session token and its expiry. The raw token is only in the browser cookie. |
| `items` | Inventory items, including quantity and the per-item low stock threshold (default 10). Soft-deleted with `deleted_at`. |
| `item_categories` | Categories, each with an optional `parent_id` for nesting |
| `item_category_links` | Many-to-many join between items and categories |
| `changelogs` | Every item create, quantity change, modify and delete, with the user, time, optional note and before/after field changes |
| `settings` | Key/value app settings, with defaults set by `settings.SeedDefaults` |
| `equipment` | Bookable equipment, working hours and maintenance status |
| `bookings` | Reservations linked to equipment and the user who made them |

Deleting a category removes its item links and moves its direct children to its parent, or to the top level. It does not delete the items or the child categories. Deleting equipment removes its reservations.

## Authentication flow

1. `GET /login` sets an OAuth state cookie and redirects to Google.
2. `GET /callback` checks the state, exchanges the code, verifies the ID token and email, then finds or creates the user. New users are enabled or disabled according to the sign-up policy. An enabled user whose email matches `ADMIN_EMAIL` is made administrator when no administrator exists.
3. A random session token is set as an HttpOnly cookie. Only its hash is stored.
4. Routes use `AuthOptional`, `AuthRequired`, `SessionRequired` or `AdminRequired` (see `routes.go`). Item endpoints also check the specific permission inside the handler. Category and equipment changes use `PermissionRequired`. Reservation handlers check ownership or `BookingManage`; any enabled user can make their own reservation.

## Adding a feature

1. Create a branch from `main`.
2. **Backend:** add the handler in the right package, register it in `routes/routes.go` with the right middleware, and add Swagger comments. Run `swag init -g main.go -o docs` from `backend/`, because CI fails if `docs/` is out of date. Add new models to `database/migrate.go`.
3. **Backend tests:** add them to `backend/tests/`. `helpers_test.go` builds an in-memory SQLite database and can create users with given permissions and session cookies. Use `newAuthRouter` for tests through the real routes. Run `go test ./...` from `backend/`.
4. **Frontend:** put the API calls in `src/features/<feature>/<feature>api.ts`, use TanStack Query hooks for loading data, and put pages in `src/pages/`. Hide controls the user has no permission for, using `hasPermission` from `features/auth/auth.ts`. The backend still enforces permissions.
5. **Frontend tests:** put them next to the code (`*.test.ts` or `*.test.tsx`). Mock the API module in page tests; mock `fetch` when testing an API module itself. Keep tests on user-visible flows and business rules. Run `bun run test` from `frontend/`.
6. **Permissions:** add the constant in `backend/auth/types.go`, the list in `frontend/src/features/auth/permissions.ts`, and a line in `Permissions.md`.
7. Open a PR into `main` before the branch's CI run reaches the merge job. Both backend and frontend checks must pass before CI squash-merges it. If there is no open PR, the merge job skips it. Merging does not deploy the app.
