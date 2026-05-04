# Skill: RTK Token Optimization (Terminal-level)

> **Scope:** terminal command output filtering — کەمکردنەوەی ٦٠–٩٠٪ token لە terminal output.
> بۆ **conversation-level** optimization (file reads, search, ...)، بڕوانە [token-optimization.md](./token-optimization.md).

## TL;DR
هەر کات Copilot agent فەرمانێکی terminal ڕاندەکات کە RTK پشتگیری دەکات و non-interactive ـە، `rtk` ـی پێشوەخت بنووسە.

## Detection
```powershell
$rtk = Get-Command rtk -ErrorAction SilentlyContinue
if ($rtk) { $cmd = "rtk $rawCmd" } else { $cmd = $rawCmd }
```

## Decision tree
```
  ┌─ Is RTK in PATH? ──No──> use raw command
  │   Yes
  │
  ├─ Is command interactive (REPL/vim/ssh)? ──Yes──> raw
  │   No
  │
  ├─ Is command long-running (server, dev mode)? ──Yes──> raw
  │   No
  │
  ├─ Output expected for machine parsing (JSON)? ──Yes──> raw
  │   No
  │
  └─> Wrap with rtk
```

## Command mapping (Zoho ERP project)

### ✅ Always wrap
| Raw | RTK | Why |
|-----|-----|-----|
| `git status` | `rtk git status` | -80% on dirty repos |
| `git log --oneline -50` | `rtk git log --oneline -50` | -80% |
| `git diff` | `rtk git diff` | -75% |
| `git push` | `rtk git push` | -92% |
| `gh pr list` | `rtk gh pr list` | compact |
| `npm install` | `rtk npm install` | strips noise |
| `npm run build` | `rtk npm run build` | -70% on success |
| `npx tsc --noEmit` | `rtk npx tsc --noEmit` | groups errors by file |
| `npx eslint src/` | `rtk npx eslint src/` | groups by rule |
| `python test_all.py` | `rtk python test_all.py` | -80% on success |
| `pytest tests/` | `rtk pytest tests/` | -90% (failures only) |
| `pip install -r requirements.txt` | `rtk pip install -r requirements.txt` | strips progress |
| `docker ps` | `rtk docker ps` | compact |

### ❌ NEVER wrap
| Command | Why |
|---------|-----|
| `uvicorn app.main:app` | Long-running server |
| `npm run dev` / `vite` | Long-running, interactive |
| `python` (no script) | REPL |
| `node` (no script) | REPL |
| `ssh`, `vim`, `nano` | Interactive TTY |
| `psql`, `mongosh` | Interactive |

## Zoho-specific shortcuts
```powershell
# Backend smoke test
rtk c:\Users\SAFA\zoho\backend\venv\Scripts\python.exe c:\Users\SAFA\zoho\backend\test_all.py

# Frontend full build (catches errors tsc --noEmit misses)
cd c:\Users\SAFA\zoho\frontend; rtk npm run build

# Git workflow
rtk git status; rtk git diff; rtk git log --oneline -10
```

## PowerShell wrappers (preferred for users)
```powershell
. c:\Users\SAFA\zoho\.github\scripts\rtk-wrappers.ps1
# Functions: rtkgit, rtknpm, rtktsc, rtkbuild, rtkpytest, rtktestall, rtkbackend, rtkgain, rtkdiscover
```

## Reporting
- `rtk gain` — کۆی savings
- `rtk gain --history` — مێژوو
- `rtk gain --json` — programmatic
- `rtk discover` — find missed opportunities

## Anti-patterns
- ❌ Double-wrap (`rtk rtk git status`)
- ❌ RTK لەگەڵ piped JSON parsing (output ـی filtered ڕەنگە valid JSON نەبێت)
- ❌ `rtk` لە CI ـی لۆکاڵ بێ verify بکە، چونکە RTK لە PATH نییە لە fresh runner
- ❌ User error نیشان بدە ئەگەر RTK نەبوو — silent fallback بکە

## Fallback rule
```powershell
if (-not (Get-Command rtk -ErrorAction SilentlyContinue)) {
    # use raw command, NO error to user
}
```

## Verification
```powershell
rtk --version              # rtk 0.37.2
rtk gain                   # shows savings
.\.github\scripts\rtk-verify.ps1
```

## Related
- [token-optimization.md](./token-optimization.md) — conversation-level (this is terminal-level)
- [.github/copilot-instructions.md](../../copilot-instructions.md) — RTK section
- [.github/scripts/rtk-wrappers.ps1](../../scripts/rtk-wrappers.ps1)
