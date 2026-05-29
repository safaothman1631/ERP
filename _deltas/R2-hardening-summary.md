# R2 Hardening — Summary

Phase R2.1–R2.4 of the launch-readiness spec. Makes the four already-existing
quick-create endpoints (`contacts`, `items`, `taxes`, `accounts`) resilient
enough to back the empty-state quick-create modals without surprising the
user with 422s on field shapes the frontend legitimately emits.

Owner: Backend Hardening Specialist (R2 sub-agent).
Sister agents: R1 (built 9 new quick-create endpoints, already merged);
R3+ (staging, payments, wizard) — out of scope here.

---

## R2.1 — `POST /api/contacts` hardening

**Files changed**

- `backend/app/schemas/schemas.py` — new `_normalize_iraqi_phone()` helper +
  redefined `ContactCreate.display_name` (min_length=1) + `@field_validator`
  on `phone`/`mobile`.

**What changed**

- `display_name` remains the only required field. `email` and `phone` are
  fully optional and a missing value cannot produce 400/422.
- Iraqi mobile numbers get normalized to E.164 (`+9647XXXXXXXXX`)
  regardless of how the user typed them:
  - `0770-123-4567` → `+9647701234567`
  - `750 111 2222` → `+9647501112222` (no leading zero)
  - `009647811112222` → `+9647811112222` (international access prefix)
  - `+9647811112222` → passthrough
  - `964781…` (13 digits) → `+964781…`
- Whitespace, parentheses and dashes are stripped from the cleaned form.
- Numbers that don't match any Iraqi-mobile rule (e.g. `+1 (415) 555-0100`)
  keep their digits and `+` but lose spaces / parens / dashes — they are
  not rejected.
- Empty / `None` phone collapses to `None`.

**Backward compatibility**

- The `ContactBase` field declarations are unchanged. Old clients sending
  `display_name="Acme"` with no phone or email continue to work exactly
  as before (just now they're explicitly tested).
- The repository call site is untouched — no change to tenant isolation.

**Tests** — `backend/tests/quick_create/test_contacts_hardening.py` (10 tests)

1. Minimum-field create → 201
2. Missing email → 201 (no 422)
3. Missing display_name → 422
4. Iraqi `07XX-XXX-XXXX` normalized to E.164
5. Iraqi `7XX XXX XXXX` (no leading zero) normalized
6. Already-E.164 number preserved
7. `00964…` prefix normalized
8. Non-Iraqi number cleaned (whitespace/punct stripped) and kept
9. Permission denied for viewer → 403
10. Malformed email still 422 (optional ≠ unvalidated)

---

## R2.2 — `POST /api/items` hardening

**Files changed**

- `backend/app/schemas/schemas.py` — `ItemCreate` adds
  `income_account_id` / `expense_account_id` aliases and a
  `@field_validator(mode="before")` that coerces empty-string FK values to
  `None`.
- `backend/app/api/items.py` — new `_next_item_sku()` helper +
  auto-SKU generation inside `create_item` + alias-mapping
  (`income_account_id` → `sales_account_id`,
   `expense_account_id` → `purchase_account_id`).

**What changed**

- SKU auto-generation: when `sku` is missing or empty, the endpoint
  returns the next free `ITM-NNNNNN` (zero-padded to 6 digits, per
  tenant). Walks existing items (cap 2000) and looks for the highest
  numeric tail matching `^ITM-(\d{1,9})$`; increments. Falls back to
  `ITM-000001` if none exist or the list call errors (cold tenant).
- Empty-string / null `tax_id`, `income_account_id`,
  `expense_account_id`, `sales_account_id`, `purchase_account_id`,
  `group_id`, `pos_category_id` are coerced to `None` instead of 422.
  This is the legitimate shape an unselected `<select>` widget produces.
- Frontend alias mapping: `income_account_id` → `sales_account_id` (Zoho
  storage), `expense_account_id` → `purchase_account_id`. Both legacy
  fields are still accepted directly.

**Edge cases handled**

- Existing items with non-`ITM-` SKUs (e.g. `RND-ABC`) are skipped during
  numbering — they don't break the sequence.
- Items with `ITM-XYZ` (non-numeric tail) are skipped.
- Explicit SKU provided by client is preserved verbatim (trimmed).

**Backward compatibility**

- `sales_account_id` / `purchase_account_id` continue to work directly —
  the alias mapping only fires when the new alias is set AND the old
  field is empty.
- `ItemBase` field declarations are unchanged; `ItemUpdate` is untouched
  (it already has `income_account_id` / `expense_account_id`).

**Tests** — `backend/tests/quick_create/test_items_hardening.py` (8 tests)

1. Auto-SKU `ITM-000001` when none exist
2. Auto-SKU increments past `ITM-000007` → `ITM-000008` (mixed sequence)
3. Explicit SKU respected
4. `null` FKs accepted
5. Empty-string FKs coerced to `None`
6. `income_account_id`/`expense_account_id` alias maps onto storage fields
7. Missing `name` → 422
8. Permission denied → 403

---

## R2.3 — `POST /api/taxes` unification

**Files changed**

- `backend/app/api/taxes.py` — added canonical `GET/POST /api/taxes`;
  kept `GET/POST /api/taxes/rates` as a deprecated alias; extracted
  `_build_tax_rate_record()` helper used by both paths.

**What changed**

- Canonical: `POST /api/taxes` returns 201 with a `Location:
  /api/taxes/{id}` header. No deprecation header.
- Alias: `POST /api/taxes/rates` still returns 201 with the same body,
  but adds:
  - `Deprecation: true`
  - `Link: </api/taxes>; rel="successor-version"`
- `GET /api/taxes` lists the same rates as `GET /api/taxes/rates`; the
  alias GET also carries the deprecation header.

**Backward compatibility**

- All existing `/api/taxes/rates` callers (frontend `quickCreateRegistry`,
  PUT/DELETE handlers, withholding-tax handlers, tax-returns) continue
  to work without changes. PUT and DELETE on `/rates/{id}` are
  intentionally untouched; only the create + list pair gained an alias.

**Tests** — `backend/tests/quick_create/test_taxes_unification.py` (8 tests)

1. Canonical POST → 201 with `Location` header
2. Canonical POST has no `Deprecation` header
3. Deprecated alias POST still 201s
4. Deprecated alias POST emits `Deprecation: true` + `Link: rel="successor-version"`
5. Canonical GET returns list
6. Deprecated alias GET emits `Deprecation: true`
7. Missing `name` on canonical → 422
8. Missing `rate` on alias → 422 (validation runs on both paths)

---

## R2.4 — `POST /api/accounts` hardening

**Files changed**

- `backend/app/api/accounts.py` — new constants
  `ACCOUNT_CODE_RANGES`, helpers `_normalize_account_type`,
  `_auto_account_code`, `_ancestor_chain`; rewrote
  `create_account` to validate parent + auto-code.

**What changed**

- Auto-generate `code` (Iraqi 5-digit convention) when not provided:
  - `asset` → 10000-19999
  - `liability` → 20000-29999
  - `equity` → 30000-39999
  - `revenue` / `income` → 40000-49999
  - `expense` → 50000-59999
  The algorithm picks the lowest free integer in the range (not just
  max+1), so re-using deleted codes is handled cleanly.
- Parent validation:
  - `parent_id` set but parent absent → 422 with
    `code=account.parent_not_found`.
  - Parent exists but `account_type` differs from child's → 422 with
    `code=account.parent_type_mismatch` (includes `parent_type`,
    `child_type` in the detail body).
  - Pre-existing cycle in the parent's ancestor chain → 422 with
    `code=account.cycle_detected`. Walks up the chain via
    `_ancestor_chain()` (depth cap 50) and reports a cycle the moment a
    node is re-visited.

**Edge cases handled**

- `income` is treated as a synonym for `revenue` (legacy schema label).
- Unknown account_type falls back to range 90000-99999 (rare path; lets
  the response still return rather than crash on a stray value).
- `parent_id == None` skips all parent validation.

**Backward compatibility**

- The `AccountCreate` schema is unchanged.
- Existing clients passing their own `code` keep their value (whitespace
  trimmed). Auto-code only fires when the field is empty.
- The post-create payload still spreads `**data.model_dump()` into the
  repo write, plus `is_system=False` and the resolved `code` — no field
  removed.

**Tests** — `backend/tests/quick_create/test_accounts_hardening.py` (11 tests)

1. Auto-code for asset starts at 10000
2. Auto-code for liability lands in 20000-29999
3. Auto-code for expense lands in 50000-59999
4. Auto-code skips used values (10000, 10001, 10003 used → returns 10002)
5. Explicit code respected
6. Parent type mismatch → 422 `account.parent_type_mismatch`
7. Parent not found → 422 `account.parent_not_found`
8. Parent same type → 201 with `parent_id` preserved
9. Pre-existing parent cycle → 422 `account.cycle_detected`
10. Permission denied → 403
11. Missing required `account_type` → 422

---

## Confidence rating

| Concern | Status |
|---------|--------|
| Schema redefinition (`ContactCreate.display_name`) compiles | Confident — Pydantic v2 supports child-class field overrides |
| `@field_validator` on subclass for inherited fields | Confident — supported in Pydantic v2 |
| Mock-repo test pattern matches existing R1 tests | Yes — conftest fixture reused |
| Backward compat for existing callers | Confident — no field removed, no required field added |
| Auto-SKU / auto-code race conditions under high concurrency | Not addressed — accepted risk for v1 (quick-create is interactive); a Firestore counter doc + transaction can be added without API change |
| Cycle detection vs ground-truth cycles in production data | Best-effort — depth-capped at 50 to defend against pre-existing corrupt rows |

## Blockers / unresolved

- **Tests not executed in this session.** The bash mount failed on
  resume (`failed to chown mnt folder: input/output error`), so I could
  not run `pytest backend/tests/quick_create/test_contacts_hardening.py`
  etc. Tests were authored against the existing R1 mocking pattern
  (`echo_create`, `make_client`, `viewer_user`) which is known to work.
  User should run:
  ```
  cd backend
  python -m pytest tests/quick_create/test_contacts_hardening.py \
                   tests/quick_create/test_items_hardening.py \
                   tests/quick_create/test_taxes_unification.py \
                   tests/quick_create/test_accounts_hardening.py -v
  ```

- **No changes to other endpoint files** — guidance was explicit.

- **Pydantic v2 vs v1**: code uses `field_validator` (v2). If the project
  has not migrated yet, swap to `@validator(..., pre=True, allow_reuse=True)`.

## File inventory

Modified:
- `backend/app/schemas/schemas.py`
- `backend/app/api/contacts.py` — *no change in this round* (hardening
  lives in the schema; the route already trusts the schema).
- `backend/app/api/items.py`
- `backend/app/api/taxes.py`
- `backend/app/api/accounts.py`

Created:
- `backend/tests/quick_create/test_contacts_hardening.py`
- `backend/tests/quick_create/test_items_hardening.py`
- `backend/tests/quick_create/test_taxes_unification.py`
- `backend/tests/quick_create/test_accounts_hardening.py`
- `_deltas/R2-hardening-summary.md` (this file)
