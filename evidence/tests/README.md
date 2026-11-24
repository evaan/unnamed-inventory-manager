# Test evidence (Part B)

These files hold the test output from GitHub Actions CI run
[44962664320](https://github.com/evaan/unnamed-inventory-manager/actions/runs/44962664320).
The run tested commit `0c12086` on 21 Nov 2026, which is the same code as `main`.
The output was exported from the job logs with timestamps and colour codes removed.

| File | Command | Result |
|------|---------|--------|
| `backend-go-test.txt` | `go test ./... -v` | 85 of 85 tests pass |
| `frontend-vitest.txt` | `bun run test` (`vitest run`) | 106 of 106 tests pass, in 11 files |

The Assignment 1 regression tests are included in these runs: 21 backend tests and 18 frontend tests.
See the Part B report for which tests were changed or removed, and why.
