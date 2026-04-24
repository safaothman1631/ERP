"""Phase 13 - i18n audit script.

Compares frontend/src/locales/en.json and ku.json for:
- Missing keys (in en but not ku, or vice-versa)
- Empty values
- Untranslated values (Kurdish == English exactly)
- Placeholder consistency ({foo} present in both)

Pure-Python; no FE deps. Run from backend or repo root.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EN_PATH = os.path.join(ROOT, "frontend", "src", "locales", "en.json")
KU_PATH = os.path.join(ROOT, "frontend", "src", "locales", "ku.json")

PLACEHOLDER_RE = re.compile(r"\{[a-zA-Z0-9_]+\}")
# Words that are legitimately the same in both languages (proper nouns, abbrev)
SAME_OK = {
    "OK", "API", "URL", "PDF", "CSV", "Excel", "PIN", "JSON", "XML",
    "ID", "UUID", "CEO", "CFO", "HR", "IT", "UAT", "QA", "VAT",
    "POS", "ERP", "CRM", "MRP", "BOM", "RFQ", "PO", "SO", "JE",
    "Zoho", "Odoo", "Firebase", "Firestore", "FastAPI", "React",
}


def flatten(obj, prefix=""):
    """Flatten nested dict into dotted-key map."""
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                out.update(flatten(v, key))
            else:
                out[key] = v
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out.update(flatten(v, f"{prefix}[{i}]"))
    return out


def main():
    if not os.path.exists(EN_PATH) or not os.path.exists(KU_PATH):
        print(f"Locale files not found: {EN_PATH} / {KU_PATH}")
        return 2

    with open(EN_PATH, encoding="utf-8") as f:
        en = json.load(f)
    with open(KU_PATH, encoding="utf-8") as f:
        ku = json.load(f)

    en_flat = flatten(en)
    ku_flat = flatten(ku)

    en_keys = set(en_flat)
    ku_keys = set(ku_flat)

    missing_in_ku = sorted(en_keys - ku_keys)
    missing_in_en = sorted(ku_keys - en_keys)
    common = en_keys & ku_keys

    empty_ku = [k for k in common if isinstance(ku_flat[k], str) and ku_flat[k].strip() == ""]
    empty_en = [k for k in common if isinstance(en_flat[k], str) and en_flat[k].strip() == ""]

    untranslated = []
    for k in common:
        ev, kv = en_flat[k], ku_flat[k]
        if not isinstance(ev, str) or not isinstance(kv, str):
            continue
        if ev.strip() == kv.strip() and ev.strip() and ev.strip() not in SAME_OK:
            # Skip pure-numeric, very short, or single-letter
            if len(ev.strip()) <= 2:
                continue
            untranslated.append((k, ev))

    placeholder_mismatch = []
    for k in common:
        ev, kv = en_flat[k], ku_flat[k]
        if not isinstance(ev, str) or not isinstance(kv, str):
            continue
        en_ph = set(PLACEHOLDER_RE.findall(ev))
        ku_ph = set(PLACEHOLDER_RE.findall(kv))
        if en_ph != ku_ph:
            placeholder_mismatch.append((k, sorted(en_ph), sorted(ku_ph)))

    print("=" * 70)
    print("PHASE 13 - i18n AUDIT REPORT")
    print("=" * 70)
    print(f"Total EN keys: {len(en_flat)}")
    print(f"Total KU keys: {len(ku_flat)}")
    print(f"Common keys:   {len(common)}")
    print(f"Missing in KU: {len(missing_in_ku)}")
    print(f"Missing in EN: {len(missing_in_en)}")
    print(f"Empty KU:      {len(empty_ku)}")
    print(f"Empty EN:      {len(empty_en)}")
    print(f"Untranslated:  {len(untranslated)}")
    print(f"Placeholder mismatch: {len(placeholder_mismatch)}")

    if missing_in_ku:
        print("\n--- Missing in KU (first 20) ---")
        for k in missing_in_ku[:20]:
            print(f"  {k}")
    if missing_in_en:
        print("\n--- Missing in EN (first 20) ---")
        for k in missing_in_en[:20]:
            print(f"  {k}")
    if empty_ku:
        print("\n--- Empty KU (first 20) ---")
        for k in empty_ku[:20]:
            print(f"  {k}")
    if untranslated:
        print("\n--- Untranslated (first 30) ---")
        for k, v in untranslated[:30]:
            print(f"  {k}: \"{v}\"")
    if placeholder_mismatch:
        print("\n--- Placeholder mismatch (first 20) ---")
        for k, e, kp in placeholder_mismatch[:20]:
            print(f"  {k}: en={e} ku={kp}")

    print("\n" + "=" * 70)
    blockers = len(missing_in_ku) + len(missing_in_en) + len(empty_ku) + \
        len(empty_en) + len(placeholder_mismatch)
    if blockers == 0:
        print(f"AUDIT CLEAN: 0 blockers (untranslated count {len(untranslated)} "
              f"is informational)")
        return 0
    print(f"AUDIT FOUND {blockers} blocker(s) + {len(untranslated)} untranslated")
    return 1


if __name__ == "__main__":
    sys.exit(main())
