# R0 — Build-Quality Tooling Summary

> **Phase:** R0 — Compile + Type Health (launch-readiness spec).
> **Owner of this delta:** Build-Quality Tooling Specialist.
> **Time:** 2026-05-29.
>
> Everything in this delta is **`node`-runnable without `npm install`**.
> The scripts gracefully degrade when optional parsers are missing.

---

## Files created

### Scripts (root `scripts/`)

| File | Task | Notes |
|------|------|-------|
| `scripts/check-orphans.mjs` | T-LR.0.3 | Crawls import graph from `frontend/src/main.tsx` and `backend/app/main.py`. Lists unreached `.ts/.tsx/.py` files (test files excluded). Writes `audit/orphans.json`. `--check` flag fails if count > `audit/orphans-baseline.json` (auto-seeds on first run). |
| `scripts/verify-aliases.mjs` | T-LR.0.4 | Parses TS `compilerOptions.paths` (walks project references) and Vite `resolve.alias` (regex over `vite.config.ts`). Exits 1 on drift with a diff printed to stderr. |
| `scripts/detect-truncation.mjs` | T-LR.0.5 | Parses every high-risk file (50 most recent commits, falling back to the entire `frontend/src` + `backend/app` tree). Uses `@babel/parser` + `python -c "import ast"` + `JSON.parse` + `js-yaml` when available, with regex/heuristic fallbacks otherwise. Writes `audit/truncation-suspects.json`. Accepts a positional path to a manifest (e.g. `git diff --name-only` for pre-commit). |
| `scripts/codemod-relative-to-alias.mjs` | T-LR.0.6 | Rewrites `import '../../../x'` → `import '@/x'` only when the spec walks ≥ 3 parent levels AND stays inside `frontend/src/`. `--dry-run` prints diffs without writing. Idempotent — already-aliased specs are untouched. |

### Tests / audits

| File | Task | Notes |
|------|------|-------|
| `frontend/src/data/quickCreateRegistry.contract.test.ts` | T-LR.0.7 | Vitest contract test. `describe.each` over every entity in `QUICK_CREATE_REGISTRY` (currently 15). Asserts shape, class enum, required field presence, URL paths match the R1-canonical list (cross-checked with `_deltas/launch-readiness-REMAINING-WORK.md`). |
| `frontend/src/_double-mount-audit.md` | T-LR.0.9 | 24 candidate files grouped by 4 patterns (effect-no-cleanup, render-time ref init, module-side-effect, AbortController-in-render). Each row has file, approximate line, concern, and suggested fix. Exceeds the 12-candidate target. |

### CI

| File | Task | Notes |
|------|------|-------|
| `.github/workflows/ci.yml` | T-LR.0.8 | Added 4 advisory jobs (`continue-on-error: true`): `typecheck-advisory` (uploads `_deltas/tsc-baseline.txt`), `orphan-check`, `alias-verify`, `truncation-check`. All run in parallel. Existing jobs untouched. |

### Husky / lint-staged

| File | Task | Notes |
|------|------|-------|
| `frontend/package.json` | T-LR.0.10 | Added `lint-staged` config block (`tsc-files --noEmit` + `eslint --fix --max-warnings 0` for `.ts/.tsx`; `eslint --fix` for `.js/.jsx/.mjs`). Added `prepare` script that runs `husky frontend/.husky`. |
| `_deltas/R0-husky-setup.md` | T-LR.0.10 | Step-by-step Windows setup — `npm install --legacy-peer-deps --save-dev husky lint-staged tsc-files`, `npx husky init`, then paste-in script. The `.husky/pre-commit` snippet is the canonical implementation. |

---

## Why no `.husky/pre-commit` is checked in

The session's filesystem sandbox denies writes to any path under
`.husky/` (dotfile directory under both repo root and `frontend/`).
The complete script is provided verbatim in
`_deltas/R0-husky-setup.md`; the user pastes it locally and commits it
as a one-off.

---

## Test status

| Item | Status | How to verify |
|------|--------|---------------|
| `check-orphans.mjs` | **Authored**. Not executed in this session — workspace bash is non-functional. | `node scripts/check-orphans.mjs` |
| `verify-aliases.mjs` | **Authored**. Not executed. | `node scripts/verify-aliases.mjs` |
| `detect-truncation.mjs` | **Authored**. Not executed. Falls back to heuristics when `@babel/parser` / `js-yaml` / `python` are unavailable. | `node scripts/detect-truncation.mjs` |
| `codemod-relative-to-alias.mjs` | **Authored**. Not executed. Recommend a first run with `--dry-run`. | `node scripts/codemod-relative-to-alias.mjs --dry-run` |
| `quickCreateRegistry.contract.test.ts` | **Authored**. Awaits a working `vitest` install. The mock setup uses `vi.mock` against `../api`. | `cd frontend && npx vitest src/data/quickCreateRegistry.contract.test.ts` |
| `.github/workflows/ci.yml` change | **Authored**. Validates on next PR. | Push a PR; check the 4 new jobs render. |
| `_double-mount-audit.md` | **Authored**. 24 entries. | Read. |
| `_deltas/R0-husky-setup.md` | **Authored**. | Follow the steps. |

---

## Known limitations

1. **No bash in this session.** The workspace MCP couldn't mount the
   user's folder; every script is authored without an execution check.
   Caveats:
   - `verify-aliases.mjs` does a regex parse of `vite.config.ts`. It
     handles the project's current form (`alias: { '@': path.resolve(...) }`).
     If someone refactors to `alias: [{ find: ..., replacement: ... }]`
     array form, the script needs an update.
   - `check-orphans.mjs`'s frontend graph uses regex-AST. It handles
     `import`, `export ... from`, dynamic `import(...)`, and `require(...)`.
     Edge cases not handled: `await import(\`./${dynamic}\`)` template
     literals — these will show up as orphans. The `_deltas` list a
     manifest of seed files; future work can extend with explicit
     "alive" markers per file.
2. **`detect-truncation.mjs`'s heuristic fallback** is best-effort. If
   `@babel/parser` isn't installed, JS/TS truncation is only detected
   via brace-balance and tail patterns — which **misses** a truncation
   that happens to balance braces. Recommend installing
   `@babel/parser` in `frontend/devDependencies` to make this a hard
   gate.
3. **CI jobs are advisory** (`continue-on-error: true`). This matches
   the spec ("Initially warn-only on the type/orphan/alias steps
   until baselines stabilize"). Flip to blocking after the first
   green-run baseline is captured.
4. **Husky hook file ships as a doc, not a checked-in script.** See
   "Why no `.husky/pre-commit` is checked in" above.
5. **Contract test mocks `../api`** with `vi.mock`. This depends on
   Vitest's hoisting. If `import api from '../api'` is ever
   restructured to a named export, update the mock.

---

## Confidence

- **High** for `verify-aliases.mjs` and `quickCreateRegistry.contract.test.ts` —
  small, well-bounded, no shelling-out.
- **Medium-high** for `check-orphans.mjs` and `detect-truncation.mjs` —
  they rely on Node + (optionally) Python. The Python helper writes a
  temp script to `audit/_extract_py_imports.py` to dodge cross-shell
  quoting; the truncation script uses an `import()` URL via
  `pathToFileURL` so Windows paths work.
- **Medium** for `codemod-relative-to-alias.mjs` — regex over import
  specifiers is tractable but always carries some risk on exotic
  syntax (multi-line `import` with comments inside). Always run with
  `--dry-run` first; commit the diff incrementally.
- **High** for the `_double-mount-audit.md` content — it identifies
  real, file-confirmed patterns (regex-searched for `useEffect`,
  `useRef`, listeners) with concrete suggested fixes; it is
  intentionally a starting point for follow-up work, not a sealed
  inventory.
- **High** for the CI YAML — appends without touching existing jobs,
  uses `continue-on-error` so the new gates never block initial PRs.

---

## Next steps for the operator (Safa)

1. `cd frontend && npm install --legacy-peer-deps`.
2. `cd frontend && npm install --save-dev husky lint-staged tsc-files`.
3. `npx husky init` (creates `frontend/.husky/`), then paste in the
   pre-commit content from `_deltas/R0-husky-setup.md`.
4. `node scripts/check-orphans.mjs` — review orphan list; the first
   run seeds `audit/orphans-baseline.json`. Add `--check` to CI once
   baseline is in.
5. `node scripts/verify-aliases.mjs` — should exit 0 today.
6. `node scripts/detect-truncation.mjs` — review the suspect list; any
   surprises are likely real corruption.
7. `node scripts/codemod-relative-to-alias.mjs --dry-run` — sample 5
   files, eyeball the diff, then run without `--dry-run`.
8. `cd frontend && npx vitest src/data/quickCreateRegistry.contract.test.ts`
   — should pass green.
9. Once T-LR.0.10 (typecheck → 0) is complete, flip the CI jobs from
   `continue-on-error: true` to blocking.
