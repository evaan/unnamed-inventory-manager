# Quality check evidence (Part B)

These files hold the static analysis and contract check output from GitHub Actions CI run
[44962664320](https://github.com/evaan/unnamed-inventory-manager/actions/runs/44962664320).
The run tested commit `0c12086` on 21 Nov 2026, which is the same code as `main`.
The output was exported from the job logs with timestamps and colour codes removed.

| File | Check | Result |
|------|-------|--------|
| `backend-build.txt` | `go build ./...` | pass |
| `backend-gofmt-vet.txt` | `gofmt -l .` and `go vet ./...` | pass: no unformatted files and no vet findings. The C compiler warning comes from the third-party `mattn/go-sqlite3` driver, not project code. |
| `backend-swagger-contract.txt` | `swag init` then `git diff --exit-code -- docs/` | pass: the committed API spec matches the code |
| `frontend-eslint.txt` | `eslint .` | pass: no problems |
| `frontend-typecheck-build.txt` | `tsc -b && vite build` | pass: no type errors |

## Problems these checks found earlier

| Run | Date | Branch | Check | What it found | Fix |
|-----|------|--------|-------|---------------|-----|
| [43989660920](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43989660920) | 17 Nov 2026 | `item-tagging` | Swagger contract | The `/categories` endpoints were missing from the committed spec | Spec regenerated in `0447d70` before #39 merged |
| [43513584356](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43513584356) | 13 Nov 2026 | `feature/new-frontend-stuff` | ESLint | `prefer-const` on `equipment`, and an unused `toTimeInput` | Fixed before #31 merged |
| [43215682543](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43215682543) | 12 Nov 2026 | `broken-test` | Go build | Code broken on purpose to check that the merge gate blocks it | Not merged, as intended |
| [43113203042](https://github.com/evaan/unnamed-inventory-manager/actions/runs/43113203042) | 11 Nov 2026 | `inventory` | Go vet and test | Tests imported the old `gitlab.com/...` module path | Imports fixed in `c1f8d0e` before #23 merged |
