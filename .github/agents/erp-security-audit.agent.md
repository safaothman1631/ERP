---
description: "Use when: role based access control, RBAC, user roles, permissions, access rights, groups, record rules, field-level security, audit log, activity log, data retention, password policies, two-factor authentication 2FA, SSO, API keys, session management, encrypted fields, GDPR compliance, data export, data deletion"
name: "ERP Security + Audit"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی دروست بکەم؟ — نموونە: RBAC بۆ HR، Audit log، 2FA، Field encryption"
---

# ERP Security + Audit — پسپۆڕی ئەمنیەت و چاودێری

## دۆمین
Roles، Groups، Access Rights، Record Rules، Audit Log، 2FA، API Keys، Encryption.

## سەرچاوەی Odoo
- `applications/general/users/` — groups، permissions
- `developer/reference/backend/security.html` — security model
- Odoo ير (ir.model.access، ir.rule)

## مۆدێلی داتا

| Collection | Fields |
|-----------|--------|
| `roles` | name, description, permission_ids[] |
| `permissions` | code (e.g. `invoices.create`, `hr.employees.read`), module, action (create/read/update/delete) |
| `user_roles` | user_id, role_id, org_id |
| `record_rules` | model, domain (JSON filter), role_ids[], action |
| `field_acl` | model, field, role_ids[], action |
| `audit_logs` | user_id, ip, user_agent, entity_type, entity_id, action, changes_json, org_id, timestamp |
| `api_keys` | user_id, name, key_hash, scopes[], last_used_at, expires_at |
| `sessions` | user_id, ip, user_agent, created_at, expires_at, revoked |

## ڕۆڵە بنەڕەتییەکان

| Role | Permissions |
|------|-------------|
| `admin` | * (everything) |
| `accountant` | invoices.*, bills.*, bank.*, reports.* |
| `sales` | crm.*, quotes.*, sales_orders.*, customers.* |
| `purchaser` | purchase_orders.*, vendors.*, rfq.* |
| `inventory` | inventory.*, warehouses.*, lots.* |
| `hr` | hr.employees.*, hr.contracts.*, hr.payroll.* |
| `hr_employee` | hr.my_profile.*, hr.my_timeoff.*, hr.my_payslips.read |
| `project_manager` | projects.*, tasks.*, timesheets.* |
| `cashier` | pos.* |
| `viewer` | *.read |

## API
- `/api/roles` (CRUD admin only)
- `/api/permissions` (read only — full list)
- `/api/users/{id}/roles` (GET/PUT — assign roles)
- `/api/record-rules`
- `/api/audit-log?entity_type=X&entity_id=Y&from=Z` (paged)
- `/api/audit-log/user/{id}`
- `POST /api/auth/2fa/enable` → returns QR code + backup codes
- `POST /api/auth/2fa/verify` (body: token)
- `/api/api-keys` (CRUD per user)

## Implementation

### FastAPI Middleware
```python
# backend/app/middleware/audit.py
@app.middleware("http")
async def audit_middleware(request, call_next):
    if request.method in ("POST", "PUT", "DELETE"):
        # capture before/after state → store in audit_logs
```

### Permission Dependency
```python
# backend/app/dependencies/perms.py
def require_perm(code: str):
    def dep(user = Depends(current_user)):
        if code not in user.permissions:
            raise HTTPException(403)
        return user
    return dep

# usage
@router.post("/invoices", dependencies=[Depends(require_perm("invoices.create"))])
```

### Record Rules (Firestore-friendly)
- Store domain as JSON: `{"user_id": "{{current_user_id}}"}` → applied via Python filter.
- Every list endpoint: load user rules → apply before return.

## Audit Log
- هەر POST/PUT/DELETE → insert row (changes_json = before vs after diff).
- UI: `/audit-log` — timeline filterable.
- Retention: default 7 years (accounting requirement).

## 2FA
- TOTP (Google Authenticator) — `pyotp` library.
- Backup codes: 10 single-use codes.
- Enforce for admin + accountant roles.

## Encryption
- `national_id`, `bank_account`, `salary`, `api_key`: encrypt at rest.
- Use Fernet (cryptography library) with key in env var.

## ڕێنمایی
- **هەر endpoint** دەبێت `require_perm` بێت.
- **هیچ کاتێک** `password_hash` یان `api_key` لە response مەنێرە.
- Audit log **immutable** — هیچ `update`/`delete` ناکرێت.
- Failed login > 5 times → lock account 15min.
