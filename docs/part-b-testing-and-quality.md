<!-- Part B starts on a new page in the PDF. Replace every [TODO …] before submitting. -->

# Part B: Testing and Quality Assurance

All 191 automated tests pass on the integrated system: 85 backend (Go) and 106 frontend (Vitest). Every static check also passes: go vet, gofmt, ESLint, the TypeScript build and the Swagger contract check. The evidence comes from CI run [44962664320](https://github.com/evaan/unnamed-inventory-manager/actions/runs/44962664320) on commit `0c12086` (21 Nov 2026), which is the code now on `main`. The raw output is saved in [`evidence/tests/`](../evidence/tests/) and [`evidence/quality/`](../evidence/quality/).

## Overview

- **Assignment 1 baseline:** commit `48088a7` (25 Oct 2026, PR #18), the last commit before work on Assignment 2 began. The inventory CRUD tests from `a40ae07` were written in the same period on the `inventory` branch, so they count as Assignment 1 tests here.
- **New feature:** item categories (tagging). Staff create categories, nest them, move them, delete them, attach them to items and filter by them. The backend part was built in PR #39 (`backend/inventory/*category*.go`) and the frontend part in PR #44 (`ItemTags.tsx`, `categoryHierarchy.ts`, `tagsapi.ts`). It adds the `CreateTag` and `DeleteTag` permissions.
- **Other integrated changes since Assignment 1:** admin settings and user management (#19, #21, #32), booking permissions and UI (#34, #36), and login required for every inventory read (#45).

## Regression: Assignment 1 tests on the integrated system

All 39 Assignment 1 tests that still apply run on the integrated system, and all of them pass. The team's approach was to keep the Assignment 1 tests and add new ones for each new page and feature: 152 of today's 191 tests are new. A few older tests were edited where the feature they check was redesigned. Those edits are listed below so this regression evidence can be checked against the git history:

- **Updated (6):** each still checks its original behaviour, now against the new permissions or UI.
- **Retired (17):** all were frontend page tests, retired in the PR #38 clean-up. Most were retired because their behaviour moved into a component that has its own test.

All 21 backend Assignment 1 tests are still in the suite.

| Assignment 1 suite | Tests at A1 | Kept unchanged | Updated | Retired | Result now |
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
| MainPage: `treats exactly 10 as low stock and 11 as in stock` | Cut as part of the same trim | Partly: `derives stock status from quantity` checks all three states but not the 10/11 boundary |
| MainPage: `shows an error banner when loading fails…` | Cut | Partly: `can retry a failed inventory load without reloading the page` |
| MainPage: `shows an error when the adjust request fails`, `keeps the item and shows an error when delete fails` | Cut | **Nothing. This is a gap (see B.5).** |

The boundary test and the two failure-path tests were retired without a replacement. They are listed as gaps in B.5, and restoring them is recommended.

## New feature and integration tests

The categories feature has 9 backend API tests and 7 frontend tests, and all 16 pass. Each test level was chosen to match a module boundary in the design. The backend tests check the API, the frontend tests check the UI against the API modules, and the Swagger check holds the two sides to the same contract.

### Test levels chosen

| Level | Tool | What is real, and what is replaced | Why this level |
| --- | --- | --- | --- |
| API integration (backend) | Go `testing` and `httptest` | Real: Gin router, `routes.Register`, auth middleware, handlers, GORM and the real migrations. Replaced: PostgreSQL by in-memory SQLite, and Google OAuth by sessions inserted directly into the database. | Most of the backend's risk sits where routing, permission checks and the database meet. Each test sends a real HTTP request and reads the result back from the database, so it crosses all of those boundaries at once. |
| Component integration (frontend) | Vitest, React Testing Library, jsdom, user-event | Real: pages, components, hooks, TanStack Query. Replaced: `itemsapi`, `tagsapi` and `useAuth` by `vi.mock`. | Checks what a user can see and do for each permission set, without needing a running backend. |
| Unit (frontend) | Vitest | Pure functions such as `bookingTime.ts` | Logic with many edge cases and no I/O. |
| Contract check | `swag init` plus `git diff --exit-code` in CI | Swagger spec generated from the handler annotations | Fails the build if the API changes without the published contract changing too. This guards the frontend/backend boundary that the mocked frontend tests can't see. |

The Go packages have no separate unit tests (CI reports `[no test files]` for `auth`, `inventory` and the rest). The handlers are thin wrappers around the database, so isolated unit tests would mostly test mocks. No browser end-to-end tests were written. The reasons are in B.4, and the risk this leaves is in B.5.

### Backend tests for the categories feature (`backend/tests/inventory_test.go`)

| Test | What it proves |
| --- | --- |
| `TestCreateAndDeleteCategory` | Create requires login (401) and `CreateTag` (403 with only `DeleteTag`). Delete requires `DeleteTag` (403 with only `CreateTag`). Deleting twice returns 404. Deleting a parent makes its child a top-level category, and the child stays linked to its items. |
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
| `saves trimmed values, an integer quantity, and selected categories with the new item` | New-item form to `itemsapi.createItem` |

### Where modules connect

1. **Browser to API through Traefik.** Traefik removes the `/api` prefix before forwarding to the backend. This was checked by hand on the deployed stack (`evidence/deployment/healthcheck.txt`). It has no automated test.
2. **Router to auth middleware to handler.** Every backend test goes through the real `routes.Register`, so permission wiring mistakes show up as wrong status codes.
3. **Handler to GORM to schema.** Tests run the real `database.Migrate` and check rows directly in the database.
4. **Frontend API modules to backend JSON.** The Swagger contract check covers this. The page tests mock this boundary, and `itemsapi.test.ts`, which tested it, was removed in #28. This is the weakest link (see B.5).

## Quality assurance beyond testing

The team used two complementary techniques: code review through pull requests, and automated checks that run on every push and block the merge. Review catches design, readability and security problems that tools can't judge. The automated checks give a small team working on short feature branches fast, consistent feedback without waiting for a reviewer. Before reaching `main`, the checks caught a contract drift, two lint errors and a broken build.

### Techniques used

| Technique | How it runs | Why we chose it | What it found | What we did |
| --- | --- | --- | --- | --- |
| Code review through pull requests | Every change is made on a feature branch and merged through a GitHub PR (40 merged PRs so far). Teammates read the PR's diff before it merges. | A second person checks the design, naming, permission handling and test quality, none of which an automated tool can judge. Reviewing in PRs keeps the discussion next to the code it is about. | Reviewing the deployment setup before go-live found two security problems. First, Traefik had the host's Docker socket mounted directly, and access to that socket is effectively root on the server. Second, the inventory read endpoints (`GET /items`, `/categories`, `/logs`) needed no login. | Both were fixed in PR #45 (`a430462`, 17 Nov). Traefik now reaches Docker only through `docker-socket-proxy`. The proxy mounts the socket read-only, disables `POST` and runs on an `internal` network. The read endpoints moved behind `AuthRequired`, and `TestInventoryReadsRequireActiveSession` was added to keep them there. |
| CI merge gate | `.github/workflows/auto-merge.yml` (workflow name "CI") runs every check below on each push to a non-`main` branch. `gh pr merge --auto` merges only if all of them pass. | Makes sure nothing reaches `main` without passing every check, whoever reviewed it. | A deliberately broken branch (`broken-test`, run [43215682543](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43215682543), 12 Nov) failed the build job and was not merged, which shows the gate works. | Kept the gate. Added build caching in #42 to make feedback faster. |
| Contract check (Swagger) | `swag init` regenerates `backend/docs/` from the handler annotations, then `git diff --exit-code` fails if the result differs from what's committed | The frontend tests mock the API, so something else has to stop the API and its published contract drifting apart | Three runs on `item-tagging` (e.g. [43989660920](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43989660920), 17 Nov) failed: the new `/categories` endpoints were missing from the committed spec. | Regenerated the spec (`0447d70`) before #39 merged. The current spec matches the code. |
| Static analysis, frontend | `tsc -b` (strict type check, as part of `bun run build`) and ESLint with the `typescript-eslint` and `react-hooks` rules | Finds type errors, unused code and hook-rule violations that tests miss | Run [43513584356](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43513584356) (13 Nov) found 2 errors: `prefer-const` on `equipment` and an unused `toTimeInput`. | Fixed on the branch before #31 merged. The current run reports 0 problems. |
| Static analysis, backend | `go vet ./...` and `gofmt -l .` (fails on any unformatted file) | `vet` finds suspicious code (bad format strings, copied locks, unreachable code). `gofmt` removes formatting disputes, which also keeps reviews focused on content. | Run [43113203042](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43113203042) (11 Nov): after main renamed the module from `gitlab.com` to `github.com` (#22), the `inventory` branch's tests still imported the old path, so `vet` and `test` both failed. | Fixed the imports (`c1f8d0e`) before #23 merged. Currently 0 vet findings and 0 unformatted files. |
| Test-suite audit (for this report) | Each Assignment 1 test traced through `git log -S` to the commit that edited or retired it | Required by the regression section, and a way to find coverage that was lost without anyone noticing | 3 tests retired in #38 have no full replacement (see B.2). The frontend HTTP layer test `itemsapi.test.ts` was removed in #28. | Recorded as gaps in B.5, with fixes proposed. |

### Techniques not used, and why

- **Required approvals.** Reviews were done on the PR, but GitHub's "Approve" button wasn't used, and CI auto-merge merged each PR once its checks passed. So the PR pages show no recorded approvals. *Next step:* turn on branch protection that requires one approval before merge, so every review leaves a record.
- **Formal verification.** Nothing in this system is safety-critical or algorithmically complex enough to justify the cost. The one invariant-heavy piece of logic, the category cycle check in `movecategory.go`, is small enough that targeted tests (`TestAddSubCategory`) cover it directly.
- **Code coverage tools.** Not configured. CI runs `go test -v` and `vitest run` without coverage flags. Thoroughness is argued by traceability instead (B.5).
- **Dependency vulnerability scanning** (`govulncheck`, `bun audit`, Dependabot). Not set up. These are cheap to add, and they are the next thing we would add.
- **Browser end-to-end tests** (Playwright). Sign-in goes through Google OAuth, which would need a test Google account or an auth bypass in CI. We judged that too costly for this iteration, and the deployed stack was checked by hand instead (`evidence/deployment/healthcheck.txt`).

### API routes (`backend/routes/routes.go`)

| Group | Routes | Functionally tested | Notes |
| --- | --- | --- | --- |
| Inventory: items | 5 (`GET /items`, `GET /items/:id`, `POST`, `PUT`, `DELETE`) | 5 | Success, 400, 401, 403, 404 and disabled-user cases |
| Inventory: categories | 5 (`GET` list and by ID, `POST`, `PATCH` move, `DELETE`) | 5 | Includes the cycle rule and promoting a child when its parent is deleted |
| Settings | 3 | 3 | 22 tests, including rollback on a database error |
| Users and permissions | 6 | 6 | Includes the rule that an admin can't remove their own Administrator permission |
| Session: `whoami`, `logout` | 2 | 2 | |
| Changelog: `GET /logs` | 1 | 0 | Only the login requirement is tested. Response content is not checked. |
| OAuth: `GET /login`, `GET /callback` | 2 | 0 | Needs Google. The signup rules behind `/callback` are tested directly in `signup_test.go` (13 tests). |
| **Total** | **24** | **21** | |

### Permissions (`Permissions.md`)

All 10 permissions have a backend test that grants them and, except for the booking permissions, a test that denies them. Administrator: `TestAdministratorCanModifyItem`. `CreateItem`, `ModifyItem`, `DeleteItem`: `TestAddItem`, `TestEditItem` and `TestRemoveItem`, plus `TestInventoryRequiresPermissions` for the 403 cases. `CreateTag`, `DeleteTag`: `TestCreateAndDeleteCategory` and `TestAddSubCategory`. The four `Booking*` permissions only have a storage round-trip test (`TestBookingPermissionsRoundTrip`) on the backend. Bookings have no backend yet (see `docs/maintenance-guide.md`), so these permissions are enforced only in the UI. 3 frontend test files check that enforcement.

### Categories feature requirements

| Requirement | API test | UI test |
| --- | --- | --- |
| Create a category (needs `CreateTag`) | `TestCreateAndDeleteCategory` | `creates a category with CreateTag permission` |
| Nest a category under a parent | `TestAddSubCategory` | `nests a category by dragging…` |
| Move a category, but never into its own subtree | `TestAddSubCategory` (cycle returns 400) | `nests a category by dragging…` (success only) |
| Delete a category (needs `DeleteTag`), keeping its children | `TestCreateAndDeleteCategory` | `deletes a global category with DeleteTag permission` |
| Attach or detach categories on an item (needs `ModifyItem`) | `TestAddItemWithCategory`, `TestAttachCategoryByUpdatingItem`, `TestAttachInvalidCategory` | `assigns an existing category…`, `keeps category changes in the edit form until saved` |
| Filter items by category, including subcategories | `TestGetCategories` (hierarchy data) | `nests a category… includes it in its parent filter`, `keeps categories read-only… still allows filtering` |
| Only signed-in, enabled users can read categories | `TestInventoryReadsRequireActiveSession` | `keeps categories read-only without permissions…` |

## Test output and quality check results

Every check passed on CI run [44962664320](https://github.com/evaan/unnamed-inventory-manager/actions/runs/44962664320) (commit `0c12086`, 21 Nov 2026, GitHub-hosted `ubuntu-latest`, Go stable, Bun 1). The output below is copied from the job logs, with timestamps and colour codes removed. The full logs are on the run page and saved in [`evidence/tests/`](../evidence/tests/) and [`evidence/quality/`](../evidence/quality/).

| Job | Command | Result | Evidence file |
| --- | --- | --- | --- |
| backend / build | `go build ./...` | pass | `evidence/quality/backend-build.txt` |
| backend / test | `go test ./... -v` | pass: 85 of 85 | `evidence/tests/backend-go-test.txt` |
| backend / stylecheck | `gofmt -l .` and `go vet ./...` | pass: 0 unformatted files, 0 vet findings | `evidence/quality/backend-gofmt-vet.txt` |
| backend / swagger | `swag init -g main.go -o docs` and `git diff --exit-code -- docs/` | pass: the spec matches the code | `evidence/quality/backend-swagger-contract.txt` |
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

### Static analysis and contract check

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
