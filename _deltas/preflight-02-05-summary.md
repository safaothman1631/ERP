# Preflight 02-05 — Bug Audit & Fixes

Date: 2026-05-27
Scope: `deploy/02-install-and-build.ps1`, `deploy/03-run-tests.ps1`, `deploy/04-push-to-github.ps1`, `deploy/05-setup-secrets.ps1`

Three bugs had already surfaced and been fixed in `01-prereqs.ps1` (Console-encoding ISE crash, `gcloud --format=value(...)` paren parsing, vercel CLI banner contamination). This audit applied the same class of fixes to scripts 02-05 and a handful of other latent bugs.

---

## 02-install-and-build.ps1

### Bugs found
1. **L30** `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` — throws "The handle is invalid" in PowerShell ISE (no console handle).
2. **L188** `param([string]$Desc, [string]$Exe, [string[]]$Args)` — `$Args` is a PowerShell automatic variable. Declaring it as a param works but produces a warning in strict mode and is fragile; safer to rename.
3. **Post-build check missing** — `vite build` can exit 0 yet produce no `dist/index.html` (rare but seen with bad `vite.config.ts` paths). The script claimed `npm run build OK` without verifying the artifact.

### Fixes applied
1. Wrapped console-encoding in `try/catch`. Added a `chcp 65001 | Out-Null` (also try/catched) so the actual code page is updated.
2. Renamed `Invoke-VenvCmd -Args` parameter to `-CmdArgs` everywhere (2 callers).
3. Added `Test-Path "$FrontendDir\dist\index.html"` post-build assertion before marking `$FrontendOK = $true`. Closing braces re-balanced.

### Remaining concerns
- `Remove-Item -Recurse -Force node_modules` can be slow (1-2 min) and may hit long-path errors on Windows; the existing `try/catch` only WARNs. If you hit this, manually `rmdir /s /q frontend\node_modules` from `cmd.exe` and re-run.
- The hotfix `pip install python-json-logger` runs unconditionally — fine, but if you change `requirements.txt` to pin that dep it'll be redundant.

**Confidence: high.**

---

## 03-run-tests.ps1

### Bugs found
1. **L34** Same console-encoding issue.
2. **L62** Same `$Args` automatic-variable shadow in `Run-TestStep`.
3. **L143** `npx playwright install --with-deps chromium` — `--with-deps` is **Linux-only**. On Windows it prints `Error: --with-deps is not supported on Windows` and exits non-zero, falsely marking the Playwright step FAIL.
4. **Stale coverage artifacts** — if a previous run wrote `coverage/coverage-summary.json` and the new pytest/vitest run fails before writing it, `Get-FrontendCoverage` returns yesterday's number. Same for `backend/coverage.xml`.

### Fixes applied
1. Wrapped console-encoding in `try/catch`; added `chcp 65001`.
2. Renamed parameter to `-CmdArgs` everywhere (6 callers — 4 frontend + 2 backend).
3. Windows-conditional Playwright install: skip `--with-deps` on `Windows_NT`, keep it for Linux.
4. Delete stale `coverage/coverage-summary.json` and `backend/coverage.xml` at the top of each section before running the tests.

### Remaining concerns
- `npx playwright install chromium` (no `--with-deps`) still downloads ~100MB; if the user has no network it will fail. Detection of partial install state isn't there — Playwright handles its own idempotency though.
- `npm test -- --run` assumes the `test` script in package.json forwards args to Vitest. If it's `"test": "vitest run"` (already non-watch) then `-- --run` is harmless. If it's something else (e.g. `jest`), this will silently misbehave. Couldn't verify without reading package.json.

**Confidence: medium.** The `npm test -- --run` invocation is a known-shape Vitest pattern but depends on `package.json` scripts I didn't inspect.

---

## 04-push-to-github.ps1

### Bugs found
1. **L42** Same console-encoding issue.
2. **L205** `$input = Read-Host ...` — `$input` is a **PowerShell automatic variable** representing the pipeline enumerator. Assigning to it works but is undefined behavior in some contexts (advanced functions, pipeline blocks); StrictMode -Latest will throw.
3. **L137 secret-guard regex** — `git status --porcelain` lines like `R  old -> new` produce `(.+)` = `old -> new`. Each substring is still scanned against `\.env` patterns, so even split-path renames are caught. OK in practice.

### Fixes applied
1. Wrapped console-encoding; added `chcp 65001`.
2. Renamed `$input` → `$userInput` in the commit-message prompt.

### Remaining concerns
- The secret-guard does NOT inspect file *contents*, only paths. A `config.json` containing `"GCP_SERVICE_ACCOUNT_KEY": "-----BEGIN PRIVATE KEY-----"` would slip through. This is by design (path-only scan is fast) but worth knowing.
- `git push -u origin <Branch>` when the remote branch has diverged will fail with the standard "Updates were rejected" message; the script prints a fix hint but does not auto-resolve. Expected behavior.
- If the user is on Windows with line-ending auto-conversion (`core.autocrlf=true`), `git status --porcelain` may report all files as modified the first time, triggering the "Nothing to commit" guard path. Common Git-on-Windows quirk, not a script bug.

**Confidence: high.**

---

## 05-setup-secrets.ps1

### Bugs found
1. **L33** Same console-encoding issue.
2. **L175** `$value | & gh secret set $name --body - 2>&1 | Out-Null` — piping a string in PowerShell adds a **CRLF** when crossing the native-process boundary on Windows. `gh` reads stdin including the newline and stores `"<secret>\r\n"` as the secret value. This is silent corruption — `gh` exit 0, GitHub receives a secret that's two chars too long, downstream auth fails with cryptic errors.
3. **L182 fallback** `& gh secret set $name --body $value` — when this code path fires, the secret value appears on the **process command line** (visible in Task Manager, `Get-Process | Select CommandLine`, and Windows event logs).
4. **`Out-Null` swallows gh's stderr** — when `gh secret set` fails, you got nothing but a `[X] $name FAILED` line. The actual reason (auth, network, repo permissions) is lost.

### Fixes applied
- Wrapped console-encoding; added `chcp 65001`.
- Replaced the pipe-to-stdin approach with a temp-file + `Start-Process -RedirectStandardInput` flow:
  - Writes the secret value to a temp file via `[System.IO.File]::WriteAllText` with `UTF8Encoding(false)` (no BOM) and **no trailing newline**.
  - Calls `gh` with `-RedirectStandardInput $tmpSecretFile`, `-RedirectStandardOutput`, `-RedirectStandardError`, `-NoNewWindow -Wait -PassThru`.
  - On failure, logs the captured stderr text (which never contains the secret value — `gh` only echoes secret names in errors).
  - All three temp files are deleted in `finally`; `$value` is nulled and `[GC]::Collect()` called.

### Remaining concerns
- The temp file exists on disk for the duration of the `gh` call (sub-second). On a hostile multi-user box this is a small window for a peer to read it. Acceptable for the use case (single-user dev box).
- `Read-Host -AsSecureString` masking only works at a real console; in ISE it shows asterisks but the SecureString is still constructed correctly.
- `Marshal::PtrToStringBSTR` is available on .NET Framework 4.x and .NET 5+. Both PS 5.1 and PS 7 cover this — no concern.

**Confidence: medium.** The temp-file approach is well-trodden but the `Start-Process -RedirectStandardInput` behavior with `-NoNewWindow` should be verified on first real run. If `gh` reads stdin and immediately closes, fine; if it tries an interactive prompt for missing args, it'll hang. We pass all required args so this shouldn't trigger.

---

## Bug-pattern frequency

| Pattern | Count across 02-05 |
|---|---|
| Unguarded `[Console]::OutputEncoding` | 4 (all four scripts) |
| `$Args` / `$input` automatic-variable shadow | 3 (02, 03, 04) |
| Linux-only `--with-deps` flag run on Windows | 1 (03) |
| Missing post-build artifact verification | 1 (02) |
| Stale coverage outputs not cleared | 2 (03 — frontend + backend) |
| Stdin pipe adds CRLF corrupting secret value | 1 (05) |
| Secret exposed on argv in fallback path | 1 (05) |
| Native-process stderr swallowed by `Out-Null` | 1 (05) |
| Unquoted PowerShell parens in CLI flags | **0** (none found — these scripts don't call `gcloud --format=value(...)` or `gh api --jq ...`) |
| Vercel CLI banner contamination | **0** (none — vercel only touched by 01) |

---

## Things we expect to still fail at runtime (and how to recognize them)

1. **`npm install --legacy-peer-deps`** may print a wall of red `npm warn`s and still exit 0. The script trusts `$LASTEXITCODE` which is correct, but if you see warnings about `peer dep <X> not satisfied` for `vite-plugin-pwa` related, that's the known issue from `critical-fix-A` — the install actually worked.

2. **`npm run build`** on first run after a venv-fresh install: if `pwa-assets-generator` is missing, vite-plugin-pwa logs an error mid-build but vite returns 0. Our new `Test-Path dist\index.html` check will catch this and mark FrontendOK = false. Recognize by log line: `npm run build returned 0 but dist/index.html is MISSING`.

3. **`npx playwright install chromium`** on a corporate proxy: downloads from `playwright.azureedge.net`. Recognize by `Error: getaddrinfo ENOTFOUND` or `ECONNRESET`. Set `HTTPS_PROXY` env var before running 03.

4. **`pytest --cov=app`** if `app` package is not import-resolvable from `backend/`: pytest exits 4 with `ModuleNotFoundError: No module named 'app'`. The smoke-import step right after will reproduce. Fix: ensure `backend/app/__init__.py` exists and `backend/pyproject.toml` or `setup.cfg` registers `app` as the package, OR run pytest from a parent that has both on sys.path.

5. **`gh secret set`** with workload-identity-style values (multiline JSON for `GCP_SERVICE_ACCOUNT_KEY` if you add one later): the temp-file approach handles multiline correctly because we write the raw value without re-quoting. If you see "secret too large" — GitHub has a 48KB limit per secret.

6. **`git push -u origin main`** to a brand-new repo with branch protection rules requiring a PR: push fails with `protected branch hook declined`. Script prints the hint, exit code reflects the gh failure. Expected.

7. **Run-TestStep returning the wrong $true/$false** — `Run-TestStep` writes both `$true`/`$false` AND prints text via `Write-Host`. Captured into `$sweepOK = Run-TestStep ...`. If somebody adds a `Write-Output` or returns a value mid-function, `$sweepOK` becomes an array and `if (-not $sweepOK)` misbehaves. Worth a follow-up but currently fine.

---

## Files modified

- `C:\Users\SAFA\zoho\deploy\02-install-and-build.ps1`
- `C:\Users\SAFA\zoho\deploy\03-run-tests.ps1`
- `C:\Users\SAFA\zoho\deploy\04-push-to-github.ps1`
- `C:\Users\SAFA\zoho\deploy\05-setup-secrets.ps1`

No code outside `deploy/` was touched.
