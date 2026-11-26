# Part B: Testing and Quality Assurance

The saved CI run passed all 191 automated tests: 85 backend (Go) and 106 frontend (Vitest). It also passed go vet, gofmt, ESLint, the TypeScript build and the Swagger spec check. This evidence comes from run [44962664320](https://github.com/evaan/unnamed-inventory-manager/actions/runs/44962664320) on commit `0c12086` (21 Nov 2026), not the latest code on `main`. The raw output is saved in [`evidence/tests/`](../evidence/tests/) and [`evidence/quality/`](../evidence/quality/).

A local check of commit `0f19d90` on 25 Nov 2026 passed 95 backend tests and 110 frontend tests using `go test ./...` and `bun run test`. The regression audit and copied CI output below refer to the 21 Nov run. The feature and route tables have been updated for the current code.

## Overview

- **Assignment 1 baseline:** commit `48088a7` (25 Oct 2026, PR #18), the last commit before work on Assignment 2 began. The inventory CRUD tests from `a40ae07` were written in the same period on the `inventory` branch, so they count as Assignment 1 tests here.
- **New feature:** item categories (tagging). Staff create categories, nest them, move them, delete them, attach them to items and filter by them. The backend part was built in PR #39 (`backend/inventory/*category*.go`) and the frontend part in PR #44 (`ItemTags.tsx`, `categoryHierarchy.ts`, `tagsapi.ts`). It adds the `CreateTag` and `DeleteTag` permissions.
- **Other integrated changes since Assignment 1:** admin settings and user management (#19, #21, #32), equipment bookings (`backend/bookings/` and `frontend/src/features/bookings/`), login required for every inventory read (#45), per-item low stock thresholds (#65) and the changelog page (#66, #67).

## Regression: Assignment 1 tests on the integrated system

In the saved run, all 39 Assignment 1 tests that still applied passed. The team's approach was to keep the Assignment 1 tests and add new ones for each new page and feature: 152 of that run's 191 tests were new. A few older tests were edited where the feature they check was redesigned. Those edits are listed below so this regression evidence can be checked against the git history:

- **Updated (6):** each still checks its original behaviour, now against the new permissions or UI.
- **Retired (17):** all were frontend page tests: 16 retired in the PR #38 clean-up and one in #33. Some of their behaviour moved into components with their own tests; the gaps are listed below.

All 21 backend Assignment 1 tests are still in the suite.

| Assignment 1 suite | Tests at A1 | Kept unchanged | Updated | Retired | Result on `0c12086` |
| --- | --- | --- | --- | --- | --- |
| `backend/tests/auth_test.go` | 15 | 14 | 1 | 0 | 15 pass |
| `backend/tests/inventory_test.go` (from `a40ae07`) | 6 | 3 | 3 | 0 | 6 pass |
| `frontend/src/pages/MainPage.test.tsx` | 31 | 15 | 2 | 14 | 17 pass |
| `frontend/src/pages/LoginPage.test.tsx` | 4 | 1 | 0 | 3 | 1 pass |
| **Total** | **56** | **33** | **6** | **17** | **39 pass, 0 fail** |

### Updated tests

| Test | Commit | What changed and why |
| --- | --- | --- |
| `TestRemovingAdminBlocksAdminActions` | `9502112` (#34) | #34 added a rule that an administrator cannot remove their own Administrator permission (tested by the new `TestAdminCannotRemoveOwnAdministrator`). The test used to have an admin demote themselves. Now a second admin demotes them. What it asserts is the same: a demoted admin loses admin access. |
| `TestAddItem`, `TestEditItem`, `TestRemoveItem` | `e705298` (#32) | #32 replaced the placeholder `View`/`Edit` and blanket Administrator sessions with the specific `CreateItem`, `ModifyItem` and `DeleteItem` permissions. The tests now prove that each of these permissions is enough. `TestInventoryRequiresPermissions` was added to prove that each one is also required. |
| `shows a loading message, then the items` → `shows skeleton rows while loading, then the items` | `e705298` (#32) | The text loading message was replaced by skeleton rows. Same behaviour, new UI. |
| `saves trimmed values with a sanitised integer quantity…` → `saves trimmed values, an integer quantity, and selected categories…` | `e787a92` (#33), `690265a` (#44) | The test was extended to check that the categories chosen in the form are saved with the new item. It is a regression test and a new-feature test at once. |

The backend tests also picked up two mechanical changes that don't affect what they check. Commit `aceb0da` (#22) renamed the Go module path from `gitlab.com/...` to `github.com/...`. Commit `1250156` changed the assertions to read results back from the database instead of trusting the response.

### Retired tests

Commit `1521776` (PR #38, "Cleanup deployment and actions") retired 16 of the 17. That PR moved the frontend CI from npm to Bun and cut the frontend suite down. The 17th, the quantity-clamping test, was retired in #33 because the behaviour it tested was deliberately changed.

| Retired test | Why | Covered now by |
| --- | --- | --- |
| LoginPage: `renders the welcome heading and subtitle` | Checked static text only, with no behaviour | Nothing (low risk) |
| LoginPage: `renders a "Continue with Google" button` | Redundant: the redirect test has to find and click this button | `redirects to the API login endpoint when the button is clicked` |
| LoginPage: `does not redirect before the button is clicked` | Redundant: the redirect test asserts exactly one call | Same as above (`toHaveBeenCalledTimes(1)`) |
| MainPage: `calls logout.mutate when "Log out" is clicked`, `shows "Logging out…"…` | Logout moved from MainPage into the shared `PageHeader` component in #33 | `PageHeader.test.tsx`: `logs out through the existing mutation` |
| MainPage: `opens a draft form with a Draft row`, `discards the draft with Cancel`, `discards the draft with Escape`, `clears the validation error once…` | The draft flow was redesigned to ask for confirmation before throwing away unsaved changes | `discards a dirty draft only after confirmation`, `ConfirmProvider.test.tsx`, `useUnsavedChanges.test.tsx` |
| MainPage: `clamps negative or non-numeric quantities to 0` (#33) | The requirement changed: a negative quantity is now rejected rather than silently changed to 0 | `rejects negative quantities instead of silently changing them` |
| MainPage: `closes the panel with the close button`, `…when Escape is pressed`, `toggles the panel closed…` | Small UI interactions, cut to reduce the suite's run time | Nothing (low risk) |
| MainPage: `treats exactly 10 as low stock and 11 as in stock` | Cut as part of the same trim | Partly: the current `derives stock status using the default threshold of 10` checks all three states but not the 10/11 boundary |
| MainPage: `shows an error banner when loading fails…` | Cut | Partly: `can retry a failed inventory load without reloading the page` |
| MainPage: `shows an error when the adjust request fails`, `keeps the item and shows an error when delete fails` | Cut | Nothing. These failure paths are still a gap. |

The boundary test and the two failure-path tests were retired without a full replacement. Restoring them would cover stock thresholds and failed stock changes more directly, especially now that each item has its own threshold.

## New feature and integration tests

The categories feature has 10 backend API tests and 7 frontend tests in the current suite, and all 17 pass locally. Each test level was chosen to match a module boundary in the design. The backend tests check the API, and the frontend tests check the UI against mocked API modules. The Swagger check keeps the generated spec in sync with the handler annotations; it does not check that the frontend sends or reads the right JSON.

### Test levels chosen

| Level | Tool | What is real, and what is replaced | Why this level |
| --- | --- | --- | --- |
| API integration (backend) | Go `testing` and `httptest` | Real: Gin router, `routes.Register`, auth middleware, handlers, GORM and the real migrations. Replaced: PostgreSQL by in-memory SQLite, and Google OAuth by sessions inserted directly into the database. | Most of the backend's risk sits where routing, permission checks and the database meet. Requests cross those boundaries, and tests can check both the response and stored rows. |
| Component integration (frontend) | Vitest, React Testing Library, jsdom, user-event | Real: pages, components, hooks, TanStack Query. Replaced: feature API modules and `useAuth` by `vi.mock`. | Checks what a user can see and do for each permission set, without needing a running backend. |
| Unit (frontend) | Vitest | Pure functions such as `bookingTime.ts` | Logic with many edge cases and no I/O. |
| Swagger spec check | `swag init` plus `git diff --exit-code` in CI | Swagger spec generated from the handler annotations | Fails the build if the generated files differ from the committed spec. It cannot catch incorrect annotations or a frontend/backend mismatch on its own. |

The Go packages have no separate unit tests (CI reports `[no test files]` for `auth`, `inventory` and the rest). Backend tests are kept in `backend/tests/`; the signup tests call the session-creation code directly rather than using HTTP. No browser end-to-end tests were written. The deployed health check only checks the frontend and an unauthenticated API response, so it does not replace a signed-in end-to-end test.

### Backend tests for the categories feature (`backend/tests/inventory_test.go`)

| Test | What it proves |
| --- | --- |
| `TestCreateAndDeleteCategory` | Create requires login (401) and `CreateTag` (403 with only `DeleteTag`). Delete requires `DeleteTag` (403 with only `CreateTag`). Deleting twice returns 404. Deleting a parent makes its child a top-level category, and the child stays linked to its items. |
| `TestDeleteNestedCategory` | Deleting a nested category moves its direct children to its parent. Deeper descendants keep their parents, and items keep links to surviving categories. |
| `TestAddSubCategory` | Nesting by `parentID`. Moving with `PATCH /categories/:id`: 403 with only `ModifyItem`, 400 for a missing body, 404 for an unknown parent, **400 when moving a category under its own child (cycle rule)**, 204 for moving to the top level and back. |
| `TestAddItemWithCategory` | Creating an item with categories stores the item–category links. |
| `TestAttachCategoryByUpdatingItem` | `PUT /items/:id` attaches categories, and both `GET /items/:id` and `GET /items` return them. |
| `TestAttachInvalidCategory` | An unknown category ID is rejected with 400, and the item is left unchanged. |
| `TestNoNewFieldsItem` | An empty update body is rejected with 400, and the existing categories stay. |
| `TestGetCategories`, `TestGetCategoryByID` | Category reads return the stored hierarchy and fields. |
| `TestInventoryReadsRequireActiveSession` | Item, category and log reads reject no session, a disabled user and an expired session (added in #45). |

### Frontend tests for the categories feature (`frontend/src/pages/MainPage.test.tsx`)

| Test | Boundary it checks |
| --- | --- |
| `keeps categories read-only without permissions but still allows filtering` | UI to permission model |
| `creates a category with CreateTag permission` | UI to `tagsapi.createTag` |
| `nests a category by dragging, and includes it in its parent filter` | Drag-and-drop to `tagsapi.moveTag`, and to `categoryHierarchy.ts` filtering |
| `deletes a global category with DeleteTag permission` | UI to `tagsapi.deleteTag`, with confirmation |
| `assigns an existing category with ModifyItem permission` | Item panel to `itemsapi` update |
| `keeps category changes in the edit form until saved` | Form state isn't sent to the API until the user saves |
| `saves trimmed values, quantity, threshold, and selected categories with the new item` | New-item form to `itemsapi.createItem` |

### Where modules connect

1. **HTTP through Traefik.** Traefik removes the `/api` prefix before forwarding to the backend. The saved health check (`evidence/deployment/healthcheck.txt`, 21 Nov) reached the frontend and `/api/whoami` through the deployed stack. It did not check a browser session or Google sign-in.
2. **Router to auth middleware to handler.** The API integration tests go through the real `routes.Register`, so permission wiring mistakes show up as wrong status codes.
3. **Handler to GORM to schema.** Tests run the real `database.Migrate` and check rows directly in the database.
4. **Frontend API modules to backend JSON.** The page tests mock this boundary. `bookingsapi.test.ts` checks requests and response handling with mocked `fetch`, but it does not run against the backend. The inventory HTTP layer test, `itemsapi.test.ts`, was removed in #28. The Swagger check does not close this gap.

### Other current feature tests

- **Bookings:** the 8 tests in `backend/tests/bookings_test.go` check active sessions, equipment permissions, validation, saved reservations, overlap and time limits, ownership and `BookingManage`. Deleting equipment is checked to remove only its own reservations.
- **Changelog:** `TestChangelogShowsItemChangesAndUser` checks the response from `/logs`, including the acting user, item, timestamp, note, quantity change and before/after fields. `ChangelogPage.test.tsx` has 2 tests for the page.
- **Low stock thresholds:** the item form tests check saving a threshold on new and existing items. The changelog test also checks a threshold change. There is still no focused test of the configurable stock-status boundary.

## Quality assurance beyond testing

The team used pull requests and automated checks on branch pushes. PRs keep the diff and discussion with the change. CI gives feedback on short feature branches and only runs its merge job after both frontend and backend checks pass. The saved failures below show outdated Swagger files, two lint errors and a broken build being caught before those branches merged.

### Techniques used

| Technique | How it runs | Why we chose it | What it found | What we did |
| --- | --- | --- | --- | --- |
| Pull requests and review | Feature branches are merged through GitHub PRs. The PR history records the changes, but does not prove that every diff had a second-person review. | Keeps changes and discussion together, and gives teammates a place to check design, naming and permissions. | PR #45 addressed two security problems: Traefik had the host's Docker socket mounted directly, and inventory read endpoints (`GET /items`, `/categories`, `/logs`) needed no login. | Both were fixed in PR #45 (`a430462`, 17 Nov). Traefik now reaches Docker only through `docker-socket-proxy`. The proxy mounts the socket read-only, disables `POST` and runs on an `internal` network. The read endpoints moved behind `AuthRequired`, and `TestInventoryReadsRequireActiveSession` was added to keep them there. |
| CI merge gate | `.github/workflows/auto-merge.yml` (workflow name "CI") runs the checks on pushes to non-`main` branches. After both workflows pass, `gh pr merge --squash --delete-branch` merges an existing PR into `main`. If there is no PR, it skips the merge. | Stops this merge job from merging a branch whose checks failed. It does not itself prevent direct pushes to `main`. | A deliberately broken branch (`broken-test`, run [43215682543](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43215682543), 12 Nov) failed the build job and was not merged. | Kept the gate. Added Go build caching in #42 to make feedback faster. |
| Swagger spec check | `swag init` regenerates `backend/docs/` from the handler annotations, then `git diff --exit-code` fails if the result differs from what's committed | Stops the generated spec and the committed files drifting apart. It does not test frontend requests or actual response shapes. | Three runs on `item-tagging` (e.g. [43989660920](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43989660920), 17 Nov) failed: the new `/categories` endpoints were missing from the committed spec. | Regenerated the spec (`0447d70`) before #39 merged. The saved 21 Nov run has no spec diff. |
| Static analysis, frontend | `tsc -b` (strict type check, as part of `bun run build`) and ESLint with the `typescript-eslint` and `react-hooks` rules | Finds type errors, unused code and hook-rule violations that tests miss | Run [43513584356](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43513584356) (13 Nov) found 2 errors: `prefer-const` on `equipment` and an unused `toTimeInput`. | Fixed on the branch before #31 merged. The saved 21 Nov run reports 0 problems. |
| Static analysis, backend | `go vet ./...` and `gofmt -l .` (fails on any unformatted file) | `vet` finds suspicious code such as bad format strings and copied locks. `gofmt` removes formatting disputes, which also keeps reviews focused on content. | Run [43113203042](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43113203042) (11 Nov): after main renamed the module from `gitlab.com` to `github.com` (#22), the `inventory` branch's tests still imported the old path, so `vet` and `test` both failed. | Fixed the imports (`c1f8d0e`) before #23 merged. The saved 21 Nov run has 0 vet findings and 0 unformatted files. |
| Test-suite audit (for this report) | Each Assignment 1 test traced through `git log -S` to the commit that edited or retired it | Required by the regression section, and a way to find coverage that was lost without anyone noticing | 3 tests retired in #38 have no full replacement (see the retired-tests table). The frontend HTTP layer test `itemsapi.test.ts` was removed in #28. | Recorded the missing boundary and failure-path tests above, along with the remaining frontend/API gap. |

### Techniques not used, and why

- **Required approvals.** The workflow waits for checks, not for a recorded review. Branch protection is a separate GitHub setting and is not established by the repository files. Requiring one approval would make second-person review part of the merge process.
- **Formal verification.** Not used. Rules such as category cycles and booking limits are checked with targeted tests (`TestAddSubCategory` and `TestCreateBookingRules`) instead.
- **Code coverage tools.** Not configured. CI runs `go test -v` and `vitest run` without coverage flags. The tables below show which routes and requirements have tests; they are not line-coverage measurements.
- **Dependency vulnerability scanning** (`govulncheck`, `bun audit`, Dependabot). Not set up. These are cheap to add, and they are the next thing we would add.
- **Browser end-to-end tests** (Playwright). Not set up. Sign-in goes through Google OAuth, so testing the full login flow needs a suitable test account and setup. The saved deployment health check (`evidence/deployment/healthcheck.txt`) only proves that the frontend and unauthenticated `/api/whoami` responded.

### API routes (`backend/routes/routes.go`)

These are the application routes in release mode, excluding the debug-only Swagger routes.

| Group | Routes | Functionally tested | Notes |
| --- | --- | --- | --- |
| Inventory: items | 5 (`GET /items`, `GET /items/:id`, `POST`, `PUT`, `DELETE`) | 5 | Success, 400, 401, 403, 404 and disabled-user cases |
| Inventory: categories | 5 (`GET` list and by ID, `POST`, `PATCH` move, `DELETE`) | 5 | Includes the cycle rule and promoting a child when its parent is deleted |
| Equipment | 4 (`GET`, `POST`, `PUT`, `DELETE`) | 4 | Active sessions, separate equipment permissions, validation and deleting related bookings |
| Bookings | 4 (`GET`, `POST`, `PUT`, `DELETE`) | 4 | Saved reservations, ownership, manager access, overlaps and time limits |
| Settings | 3 | 3 | 22 tests, including rollback on a database error |
| Users and permissions | 6 | 6 | Includes the rule that an admin can't remove their own Administrator permission |
| Session: `whoami`, `logout` | 2 | 2 | |
| Changelog: `GET /logs` | 1 | 1 | Login requirement, item and user details, quantity changes, notes and before/after fields |
| OAuth: `GET /login`, `GET /callback` | 2 | 0 | Needs Google. The signup rules behind `/callback` are tested directly in `signup_test.go` (13 tests). |
| **Total** | **32** | **30** | |

### Permissions (`Permissions.md`)

All 10 permissions are exercised by backend tests. Administrator: `TestAdministratorCanModifyItem`. `CreateItem`, `ModifyItem`, `DeleteItem`: `TestAddItem`, `TestEditItem` and `TestRemoveItem`, plus `TestInventoryRequiresPermissions` for the 403 cases. `CreateTag`, `DeleteTag`: `TestCreateAndDeleteCategory` and `TestAddSubCategory`. `TestEquipmentPermissionsAreIndependent` checks `BookingAdd`, `BookingModify` and `BookingDelete`, including denied requests. `TestBookingOwnership` checks that equipment permissions do not allow changing another user's reservation, while `BookingManage` does. The frontend also checks these permissions, but the backend enforces them.

### Categories feature requirements

| Requirement | API test | UI test |
| --- | --- | --- |
| Create a category (needs `CreateTag`) | `TestCreateAndDeleteCategory` | `creates a category with CreateTag permission` |
| Nest a category under a parent | `TestAddSubCategory` | `nests a category by dragging…` |
| Move a category, but never into its own subtree | `TestAddSubCategory` (cycle returns 400) | `nests a category by dragging…` (success only) |
| Delete a category (needs `DeleteTag`), keeping and reparenting its children | `TestCreateAndDeleteCategory`, `TestDeleteNestedCategory` | `deletes a global category with DeleteTag permission` |
| Attach or detach categories on an item (needs `ModifyItem`) | `TestAddItemWithCategory`, `TestAttachCategoryByUpdatingItem`, `TestAttachInvalidCategory` | `assigns an existing category…`, `keeps category changes in the edit form until saved` |
| Filter items by category, including subcategories | `TestGetCategories` (hierarchy data) | `nests a category… includes it in its parent filter`, `keeps categories read-only… still allows filtering` |
| Only signed-in, enabled users can read categories | `TestInventoryReadsRequireActiveSession` | `keeps categories read-only without permissions…` |

## Test output and quality check results

Every check passed on CI run [44962664320](https://github.com/evaan/unnamed-inventory-manager/actions/runs/44962664320) (commit `0c12086`, 21 Nov 2026, GitHub-hosted `ubuntu-latest`, Go stable, Bun 1). The output below is copied from those job logs, with timestamps and colour codes removed. These are the saved results, not output from the current local check. The full logs are on the run page and saved in [`evidence/tests/`](../evidence/tests/) and [`evidence/quality/`](../evidence/quality/).

| Job | Command | Result | Evidence file |
| --- | --- | --- | --- |
| backend / build | `go build ./...` | pass | `evidence/quality/backend-build.txt` |
| backend / test | `go test ./... -v` | pass: 85 of 85 | `evidence/tests/backend-go-test.txt` |
| backend / stylecheck | `gofmt -l .` and `go vet ./...` | pass: 0 unformatted files, 0 vet findings | `evidence/quality/backend-gofmt-vet.txt` |
| backend / swagger | `swag init -g main.go -o docs` and `git diff --exit-code -- docs/` | pass: generated files match the committed spec | `evidence/quality/backend-swagger-contract.txt` |
| frontend / build | `tsc -b && vite build` | pass: 2386 modules, 0 type errors | `evidence/quality/frontend-typecheck-build.txt` |
| frontend / lint | `eslint .` | pass: 0 problems | `evidence/quality/frontend-eslint.txt` |
| frontend / test | `vitest run` | pass: 106 of 106 in 11 files | `evidence/tests/frontend-vitest.txt` |

### Backend: `go test ./... -v` (each test name below printed `--- PASS`)

```
?   github.com/evaandev/unnamed-inventory-manager             [no test files]
?   github.com/evaandev/unnamed-inventory-manager/auth        [no test files]
?   github.com/evaandev/unnamed-inventory-manager/database    [no test files]
?   github.com/evaandev/unnamed-inventory-manager/docs        [no test files]
?   github.com/evaandev/unnamed-inventory-manager/inventory   [no test files]
?   github.com/evaandev/unnamed-inventory-manager/middleware  [no test files]
?   github.com/evaandev/unnamed-inventory-manager/routes      [no test files]
?   github.com/evaandev/unnamed-inventory-manager/settings    [no test files]

auth_test.go (32)
  TestWhoAmIUnauthenticated  TestWhoAmIRegularUser  TestWhoAmIDisabledUser
  TestGetPermissions  TestGetPermissionsUnauthenticated  TestGetUserPermissions
  TestGetUnknownUserPermissions  TestGetUserPermissionsInvalidID  TestSetPermissions
  TestClearPermissions  TestBookingPermissionsRoundTrip  TestRegularUserCannotSetPermissions
  TestRemovingAdminBlocksAdminActions  TestAdminCannotRemoveOwnAdministrator
  TestAdminCanUpdateOwnOtherPermissions  TestGetUsers  TestGetUsersIncludesDisabledUsers
  TestGetUsersEmpty  TestGetUsersUnauthenticated  TestRegularUserCannotGetUsers
  TestDisabledAdminCannotGetUsers  TestGetUser  TestGetUserWithoutPermissions
  TestGetDisabledUser  TestGetUnknownUser  TestGetUserInvalidID  TestGetUserUnauthenticated
  TestRegularUserCannotGetUser  TestDisabledAdminCannotGetUser  TestDisableAndEnableUser
  TestRegularUserCannotDisableUser  TestLogout

inventory_test.go (18)
  TestInventoryReadsRequireActiveSession  TestAddItem  TestAddInvalidItem  TestGetItem
  TestGetNonExistentItem  TestEditItem  TestRemoveItem  TestCreateAndDeleteCategory
  TestAddSubCategory  TestAddItemWithCategory  TestAttachCategoryByUpdatingItem
  TestAttachInvalidCategory  TestNoNewFieldsItem  TestGetCategories  TestGetCategoryByID
  TestInventoryRequiresPermissions  TestAdministratorCanModifyItem
  TestDisabledUserCannotModifyItem

settings_test.go (22)
  TestGetDefaultSettings  TestGetSettingsIncludesNewSettings  TestGetSettingsEmpty
  TestPatchSettings  TestPatchSettingsPreservesOmittedSettings  TestPatchSettingsEmptyValue
  TestPatchSettingsUnchangedValue  TestPatchSettingsUnknownSetting  TestPatchSettingsInvalidBody
  TestGetSettingsUnauthenticated  TestPatchSettingsUnauthenticated
  TestRegularUserCannotGetSettings  TestRegularUserCannotPatchSettings
  TestDisabledAdminCannotGetSettings  TestDisabledAdminCannotPatchSettings
  TestPatchSettingsRequiresOrigin  TestPatchSettingsRollsBackOnError
  TestGetSettingsDatabaseError  TestSettingsMigrationPreservesUpdates  TestCreateSetting
  TestCreateSettingInvalidBody  TestRegularUserCannotCreateSetting

signup_test.go (13)
  TestSignupOpen  TestSignupWhitelistedEmail  TestSignupOutsideWhitelist
  TestSignupWhitelistExactDomain  TestSignupClosed  TestSignupInvalidPolicy
  TestSignupInvalidWhitelist  TestExistingEnabledUserCanLoginWithClosedSignup
  TestExistingDisabledUserStaysDisabledWithOpenSignup
  TestSignupBootstrapAdminBypassesWhitelist  TestSignupBootstrapAdminBypassesClosedSignup
  TestSignupEmptyAdminEmailDoesNotBypassPolicy  TestExistingDisabledBootstrapAdminStaysDisabled

PASS
ok  github.com/evaandev/unnamed-inventory-manager/tests  0.257s
```

### Frontend: `vitest run`

```
 RUN  v3.2.7 /home/runner/work/unnamed-inventory-manager/unnamed-inventory-manager/frontend

 ✓ src/pages/SettingsPage.test.tsx (10 tests) 1437ms
 ✓ src/features/bookings/BookingSchedule.test.tsx (9 tests) 732ms
 ✓ src/features/bookings/bookingsapi.test.ts (7 tests) 109ms
 ✓ src/pages/MainPage.test.tsx (34 tests) 4485ms
 ✓ src/features/bookings/bookingTime.test.ts (7 tests) 8ms
 ✓ src/components/ThemeToggle.test.tsx (2 tests) 156ms
 ✓ src/pages/BookingsPage.test.tsx (32 tests) 5989ms
 ✓ src/hooks/useUnsavedChanges.test.tsx (1 test) 278ms
 ✓ src/components/ConfirmProvider.test.tsx (1 test) 173ms
 ✓ src/components/PageHeader.test.tsx (2 tests) 169ms
 ✓ src/pages/LoginPage.test.tsx (1 test) 114ms

 Test Files  11 passed (11)
      Tests  106 passed (106)
   Duration  8.63s
```

### Static analysis and Swagger check

```
$ gofmt -l . | tee /tmp/fmt && test ! -s /tmp/fmt
(no output: 0 unformatted files)

$ go vet ./...
(no findings in project code)

$ eslint .
(no output: 0 problems)

$ tsc -b && vite build
✓ 2386 modules transformed.
dist/index.html                  0.46 kB │ gzip:   0.30 kB
dist/assets/index-SKj0byN1.css  32.07 kB │ gzip:   6.21 kB
dist/assets/index-Ddx_GoGb.js  495.05 kB │ gzip: 149.46 kB
✓ built in 3.61s

$ swag init -g main.go -o docs && git diff --exit-code -- docs/
create docs.go at docs/docs.go
create swagger.json at docs/swagger.json
create swagger.yaml at docs/swagger.yaml
(no diff: the committed spec matches the code)
```

The one compiler warning in the stylecheck log comes from the C compiler building the third-party `mattn/go-sqlite3` driver (`-Wdiscarded-qualifiers` in `sqlite3-binding.c`). It is not in project code, and `go vet` reported nothing.

### Earlier CI failures cited in this report

| Run | Date | Branch | Failing check | Cause |
| --- | --- | --- | --- | --- |
| [43989660920](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43989660920) | 17 Nov 2026 | `item-tagging` | backend / swagger | `/categories` endpoints missing from the committed spec |
| [43513584356](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43513584356) | 13 Nov 2026 | `feature/new-frontend-stuff` | frontend / lint | `prefer-const` on `equipment`, and unused variable `toTimeInput` |
| [43215682543](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43215682543) | 12 Nov 2026 | `broken-test` | backend / build | Code broken on purpose to prove the merge gate blocks it |
| [43113203042](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43113203042) | 11 Nov 2026 | `inventory` | backend / test, stylecheck | Tests imported the old `gitlab.com/...` module path |
