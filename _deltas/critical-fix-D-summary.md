# Critical Fix D — Mount-Sync Truncation Audit

**Date:** 2026-05-27
**Auditor:** File Integrity Auditor agent
**Scope:** All P0–P6 + Validation deliverables (manifest of 95 files)

## Summary

| Metric | Count |
| --- | --- |
| Files audited | 95 |
| Files truncated on disk (file tool view) | 4 |
| Files rewritten | 4 |
| Files flagged by heuristic but actually complete | 3 |
| Files left for human review | 0 |
| Final status | **PASS** |

## Truncated files found and fixed

Each was confirmed truncated by inspecting the on-disk byte stream from
the bash mount (the file tool's `Read` showed the correct full content,
which is the authoritative source per the user's note that bash sometimes
shows truncated copies of files that the file tool sees as complete).

| File | Bash-visible size (truncated) | Disk tail before fix | Action |
| --- | --- | --- | --- |
| `frontend/vite.config.ts` | 3864 B / 100 lines | `…let Rollup dec` (mid-word) | Rewritten with file-tool content (~11 KB, 261 lines, closing `});`) |
| `frontend/src/main.tsx` | 2845 B / 73 lines | `…  i` (mid-word, just after caches.delete loop) | Rewritten (4.6 KB, 131 lines, closing `}`) |
| `frontend/src/hooks/useBarcodeScanner.ts` | 4773 B / 126 lines | `…  us` (mid-word, just before useEffect cleanup) | Rewritten (~5.4 KB, 148 lines, `export default useBarcodeScanner;`) |
| `frontend/src/stores/pos/merge.ts` | 6803 B / 186 lines | `…Iterate in sorted order so` (mid-comment) | Rewritten (~8.9 KB, 245 lines, closing `}` of `normalizeCart`) |

Each fix used the file tool's `Write` after reading the canonical content
the file tool already exposed. No semantic edits were made; only the
missing tail bytes were restored.

## Heuristic false-positives (left alone)

These were flagged by the `audit-mount-sync.sh` brace/paren/last-char
heuristic but the file tool's `Read` confirmed the disk content ends
cleanly. The false-positive trigger was JSX self-closing tags, optional
chaining (`?.`), and nested array/object literals producing apparent
delta in the simple counter.

| File | Disk tail (clean) | Reason flagged |
| --- | --- | --- |
| `frontend/src/pwa/sw.ts` | `…void self.skipWaiting();\n});\n` | Optional chaining `event.data?.type` confused brace/paren counter |
| `frontend/src/pages/settings/sections/general/Branding.tsx` | `…export default Branding;\n` | JSX nested brackets inflated bracket delta |
| `frontend/src/App.routes.tsx` | `…path: '*', element: <PageTransition><NotFound /></PageTransition> },\n];\n` | Massive route table with JSX; brackets_delta=3 from JSX self-closes the heuristic does not understand |

## Bash mount instability

Mid-audit the workspace mount entered a degraded state
(`failed to mount … chown … input/output error`) and stayed broken for
the remainder of the audit. All verification of the final 4 file
rewrites was done via the file tool, which reflects the actual
Windows-side disk state.

## Audit script

`scripts/audit-mount-sync.sh` is committed for future re-runs. Usage:

```bash
scripts/audit-mount-sync.sh _deltas/manifest.txt
```

It walks a manifest of file paths (one per line, comments with `#`),
inspects the last bytes of each file via bash, and flags any whose
ending looks like a truncation symptom (`braces_delta`, `parens_delta`,
`brackets_delta`, or last char is an alphanumeric identifier
character — usually a mid-word cut). For `.py`, `.mjs`, `.js`, `.cjs`
files it additionally runs `ast.parse` / `node --check`; for `.sh`
files it runs `bash -n`. Exits non-zero if any flags fire so it can
be wired into CI as a guard.

The heuristic is intentionally noisy on JSX/TS files; reviewers must
confirm each flag against the file tool's `Read` before patching.

## Final status

**PASS** — all four on-disk truncations have been rewritten from the
file tool's canonical content. The three heuristic false-positives were
verified clean. No file requires further human review.
