#!/usr/bin/env python3
"""apply_tenant_patch.py — apply (or diff) a per-tenant restore patch into a
live Firestore database, org-scoped and audited (SF3 / T-SF.3.3).

Final stage of the per-tenant restore pipeline. Reads the JSON patch written by
``extract_tenant_from_db.py`` and either:

  --mode diff   : compares each restored doc against the live doc and prints a
                  per-collection summary (added / changed / unchanged). NO writes.
  --mode upsert : writes each restored doc into the live DB with ``merge=True``
                  (additive — does not delete docs the patch omits).
  --mode replace: like upsert, but first deletes live docs for the org in each
                  patched collection that are absent from the patch (full
                  point-in-time replacement). Use with care.

Hard tenant guard: every write/delete is checked to ensure the doc's ``org_id``
matches ``--org-id``. A patch row with a mismatched/missing org_id is REFUSED
(the script aborts) so a corrupt patch can never cross tenant boundaries.

Every run appends an ``audit_logs`` entry (type ``dr_tenant_restore_apply``)
with per-collection counts.

Exit codes: 0 ok · 1 error · 2 args · 7 tenant-guard violation in patch.

Usage:
    python backend/scripts/apply_tenant_patch.py \
        --project erp-system-494716 --database "(default)" \
        --org-id 064a4a1a-... --in-dir ./_dr/tenant-restore/064a4a1a-... \
        --mode upsert
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys
import uuid
from datetime import datetime, timezone


def _build_client(project: str, database: str):
    from google.cloud import firestore  # type: ignore

    try:
        return firestore.Client(project=project or None, database=database)
    except TypeError:
        if database not in ("(default)", "default", ""):
            raise RuntimeError("installed google-cloud-firestore lacks named-database support")
        return firestore.Client(project=project or None)


def _load_patch(in_dir: str, org_field: str, org_id: str) -> dict[str, list[dict]]:
    """Load all <collection>.json files; enforce the tenant guard up-front."""
    patch: dict[str, list[dict]] = {}
    for path in sorted(glob.glob(os.path.join(in_dir, "*.json"))):
        name = os.path.splitext(os.path.basename(path))[0]
        if name == "_manifest":
            continue
        with open(path, "r", encoding="utf-8") as fh:
            rows = json.load(fh)
        if not isinstance(rows, list):
            continue
        for row in rows:
            row_org = row.get(org_field)
            if row_org != org_id:
                raise SystemExit(
                    f"TENANT GUARD: {name}.json contains doc id={row.get('id')!r} "
                    f"with {org_field}={row_org!r} != {org_id!r}. Refusing to apply."
                )
        patch[name] = rows
    return patch


def _audit(client, org_id: str, mode: str, summary: dict, database: str) -> None:
    try:
        client.collection("audit_logs").document(uuid.uuid4().hex).set(
            {
                "type": "dr_tenant_restore_apply",
                "org_id": org_id,
                "mode": mode,
                "database": database,
                "summary": summary,
                "actor": os.environ.get("USER") or os.environ.get("USERNAME") or "dr-script",
                "ts": datetime.now(timezone.utc),
            }
        )
    except Exception as exc:  # noqa: BLE001
        print(f"apply_tenant_patch: WARN audit write failed: {exc}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser(description="Apply/diff a per-tenant restore patch.")
    ap.add_argument("--project", default="")
    ap.add_argument("--database", default="(default)")
    ap.add_argument("--org-id", required=True)
    ap.add_argument("--in-dir", required=True)
    ap.add_argument("--mode", choices=["diff", "upsert", "replace"], default="diff")
    ap.add_argument("--org-field", default="org_id")
    args = ap.parse_args()

    if not os.path.isdir(args.in_dir):
        print(f"apply_tenant_patch: in-dir not found: {args.in_dir}", file=sys.stderr)
        return 2

    # Tenant guard happens here (raises SystemExit(7)-style message on violation).
    try:
        patch = _load_patch(args.in_dir, args.org_field, args.org_id)
    except SystemExit as exc:
        print(str(exc), file=sys.stderr)
        return 7

    if not patch:
        print("apply_tenant_patch: patch is empty — nothing to do")
        return 0

    try:
        client = _build_client(args.project, args.database)
    except Exception as exc:  # noqa: BLE001
        print(f"apply_tenant_patch: cannot build client: {exc}", file=sys.stderr)
        return 1

    summary: dict[str, dict] = {}
    print(f"apply_tenant_patch: mode={args.mode} org={args.org_id} db={args.database}")

    for name, rows in patch.items():
        added = changed = unchanged = deleted = 0
        coll = client.collection(name)
        patch_ids = {r["id"] for r in rows if "id" in r}

        for row in rows:
            doc_id = row.get("id")
            if not doc_id:
                continue
            payload = {k: v for k, v in row.items() if k != "id"}
            ref = coll.document(doc_id)
            try:
                snap = ref.get()
                exists = snap.exists
                live = snap.to_dict() if exists else None
            except Exception:  # noqa: BLE001
                exists, live = False, None

            if not exists:
                added += 1
            elif live != payload:
                changed += 1
            else:
                unchanged += 1

            if args.mode in ("upsert", "replace"):
                ref.set(payload, merge=True)

        if args.mode == "replace":
            # Delete live docs for this org in this collection that the patch omits.
            try:
                live_q = coll.where(args.org_field, "==", args.org_id).stream()
                for snap in live_q:
                    if snap.id not in patch_ids:
                        snap.reference.delete()
                        deleted += 1
            except Exception as exc:  # noqa: BLE001
                print(f"  - {name}: WARN replace-delete pass failed ({exc})", file=sys.stderr)

        summary[name] = {
            "added": added,
            "changed": changed,
            "unchanged": unchanged,
            "deleted": deleted,
        }
        verb = "would write" if args.mode == "diff" else "wrote"
        print(
            f"  - {name}: +{added} ~{changed} ={unchanged}"
            + (f" -{deleted}" if args.mode == "replace" else "")
            + f" ({verb})"
        )

    if args.mode != "diff":
        _audit(client, args.org_id, args.mode, summary, args.database)

    print(f"apply_tenant_patch: done (mode={args.mode})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
