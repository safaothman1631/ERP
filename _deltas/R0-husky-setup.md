# R0 — Husky / lint-staged setup (T-LR.0.10)

> **Status:** documented, **NOT yet installed** in the repo.
> **Owner of next step:** the contributor running `npm install` on Windows.
>
> Why this is a doc instead of a committed `.husky/pre-commit`:
> the session that authored R0 had write-access restricted to
> non-dotfile-directories, so the hook file itself can't be checked in
> from inside that session. Once you run the steps below on Windows,
> `husky` writes the hook for you and you can `git add .husky` to land it.

---

## Why we want this

A pre-commit gate keeps the broken-build window small. lint-staged runs
the gate only on **staged files**, so the median commit completes in
well under the 8-second budget set by T-LR.0.2.

When the gate is live, a commit that touches a `.ts` file with a type
error is rejected; a commit that doesn't touch any code is unaffected.

---

## What we already shipped

- `frontend/package.json` now declares `lint-staged` config and a
  `prepare` script that installs the husky hooks into
  `frontend/.husky/`.
- The hooks themselves are documented inline below — you create them
  once locally and commit them.

---

## Setup steps (run once, on Windows or any dev machine)

```powershell
cd C:\Users\SAFA\zoho\frontend

# 1) Install husky + lint-staged + tsc-files.
npm install --legacy-peer-deps --save-dev husky lint-staged tsc-files

# 2) Initialize husky (creates frontend/.husky and points core.hooksPath).
npx husky init

# 3) Replace the generated frontend/.husky/pre-commit with the snippet
#    in the next section.
```

After running step 3, `git commit` will run lint-staged automatically.

---

## `frontend/.husky/pre-commit` contents

Paste this exact file at `frontend/.husky/pre-commit` (replacing what
`husky init` generated):

```sh
#!/usr/bin/env sh
# T-LR.0.10 — pre-commit gate for the Kurdish ERP.
#
# - Runs lint-staged so only staged files pay the type/lint cost.
# - WARNS-but-skips when lint-staged is missing (fresh clone).

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$ROOT_DIR" ]; then
  echo "pre-commit: not inside a git repo, skipping."
  exit 0
fi

FRONTEND="$ROOT_DIR/frontend"

if [ ! -d "$FRONTEND/node_modules/lint-staged" ]; then
  echo "pre-commit: lint-staged not installed; run 'cd frontend && npm install' to enable. Skipping."
  exit 0
fi

# Cap total hook time so a wedged process can't block commits forever.
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_CMD="timeout 30s"
else
  TIMEOUT_CMD=""
fi

cd "$FRONTEND" || exit 0
$TIMEOUT_CMD npx --no-install lint-staged
```

Make it executable on Unix:

```sh
chmod +x frontend/.husky/pre-commit
```

On Windows, the executable bit is inferred — but if you ever run
through WSL or git-bash on a Mac, the chmod matters.

---

## `lint-staged` configuration

Already shipped in `frontend/package.json`:

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "tsc-files --noEmit",
    "eslint --fix --max-warnings 0"
  ],
  "*.{js,jsx,mjs}": [
    "eslint --fix --max-warnings 0"
  ],
  "*.{json,md,yml,yaml}": []
}
```

Rationale:
- `tsc-files` runs the project's `tsc` on **only the staged files**,
  using the project's tsconfig. Crucially it does NOT shadow project
  references, so this is type-safe up to the standard tsc caveats.
- `eslint --fix` auto-corrects safe lints in-place; `--max-warnings 0`
  blocks the commit if anything remains.
- Markdown / JSON / YAML get listed (with an empty array) so the
  default lint-staged "no matching file" warning doesn't fire — we
  acknowledge them as intentionally skipped.

---

## Time budget check (manual)

Once installed, time three commits:

```powershell
git commit --allow-empty -m "perf: empty commit"
# expect ~ 200 ms (lint-staged finds nothing).

# Touch one TS file:
echo "// nudge" >> frontend/src/main.tsx
git add frontend/src/main.tsx
Measure-Command { git commit -m "perf: single file commit" }
# expect < 8 s on median hardware.
```

Add the numbers to `_deltas/R0-husky-timings.txt` after measurement.
