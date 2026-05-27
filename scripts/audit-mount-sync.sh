#!/usr/bin/env bash
# audit-mount-sync.sh
# Detect silently-truncated files in the workspace by inspecting the last bytes
# of each path in a manifest. Flags files whose tail looks like a cut-off
# statement (unterminated braces/parens, mid-word, missing terminators).
#
# Usage:  scripts/audit-mount-sync.sh <manifest-file>
# Exits non-zero if any suspicious files are found.

set -u

MANIFEST="${1:-}"
if [[ -z "$MANIFEST" || ! -f "$MANIFEST" ]]; then
  echo "Usage: $0 <manifest-file>" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SUSPICIOUS=()
MISSING=()
TOTAL=0

audit_one() {
  local f="$1"
  TOTAL=$((TOTAL + 1))

  if [[ ! -f "$f" ]]; then
    MISSING+=("$f")
    return
  fi

  local size
  size=$(stat -c '%s' "$f" 2>/dev/null || stat -f '%z' "$f")

  # Read last 200 bytes after stripping trailing whitespace
  local tail_bytes
  tail_bytes=$(python3 - "$f" << 'PY'
import sys, os
p = sys.argv[1]
with open(p, "rb") as fh:
    data = fh.read()
stripped = data.rstrip()
last = stripped[-200:].decode("utf-8", errors="replace")
print(last)
PY
  )

  local ext="${f##*.}"
  local is_suspicious=0
  local reason=""

  case "$ext" in
    py)
      # Python: try to parse with ast
      if ! python3 -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$f" 2>/dev/null; then
        is_suspicious=1
        reason="ast.parse failed"
      fi
      ;;
    mjs|js|cjs)
      # Node syntax check
      local nc
      nc=$(node --check "$f" 2>&1)
      if [[ -n "$nc" ]]; then
        is_suspicious=1
        reason="node --check: $nc"
      fi
      ;;
    ts|tsx|json)
      # Heuristic-only: balance braces/parens, last char
      local heuristic
      heuristic=$(python3 - "$f" << 'PY'
import sys, re
p = sys.argv[1]
with open(p, "rb") as fh:
    raw = fh.read()
text = raw.decode("utf-8", errors="replace")
# Strip comments crudely (not perfect but catches gross truncation)
no_block = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
no_line = re.sub(r"//[^\n]*", "", no_block)
# Strip strings (template literals not perfectly handled)
def strip_strs(s):
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c in ('"', "'", '`'):
            quote = c
            i += 1
            while i < n and s[i] != quote:
                if s[i] == '\\' and i + 1 < n:
                    i += 2
                    continue
                i += 1
            i += 1
        else:
            out.append(c)
            i += 1
    return "".join(out)
clean = strip_strs(no_line)
braces = clean.count("{") - clean.count("}")
parens = clean.count("(") - clean.count(")")
brackets = clean.count("[") - clean.count("]")
stripped = raw.rstrip()
last_char = chr(stripped[-1]) if stripped else ""
problems = []
if braces != 0:
    problems.append(f"braces_delta={braces}")
if parens != 0:
    problems.append(f"parens_delta={parens}")
if brackets != 0:
    problems.append(f"brackets_delta={brackets}")
if last_char not in "}];)`\"'>,/0123456789":
    # Acceptable last chars cover most legitimate file endings
    # (TS/TSX/JSON closing). Identifiers/letters in last spot are usually
    # a truncation symptom.
    if last_char.isalnum() or last_char == "_":
        problems.append(f"last_char_alnum={last_char!r}")
if problems:
    print("|".join(problems))
PY
      )
      if [[ -n "$heuristic" ]]; then
        is_suspicious=1
        reason="$heuristic"
      fi
      ;;
    sh)
      if ! bash -n "$f" 2>/dev/null; then
        is_suspicious=1
        reason="bash -n failed"
      fi
      ;;
  esac

  if (( is_suspicious )); then
    SUSPICIOUS+=("$f|size=$size|$reason")
    printf '[SUSPICIOUS] %s  (size=%s)  %s\n' "$f" "$size" "$reason"
  fi
}

while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  audit_one "$line"
done < "$MANIFEST"

echo
echo "=== audit-mount-sync summary ==="
echo "Total files audited:   $TOTAL"
echo "Missing files:         ${#MISSING[@]}"
echo "Suspicious files:      ${#SUSPICIOUS[@]}"

if (( ${#MISSING[@]} > 0 )); then
  echo
  echo "Missing:"
  printf '  - %s\n' "${MISSING[@]}"
fi

if (( ${#SUSPICIOUS[@]} > 0 )); then
  echo
  echo "Suspicious (review/fix):"
  printf '  %s\n' "${SUSPICIOUS[@]}"
  exit 1
fi

exit 0
