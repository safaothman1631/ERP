import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi.errors import RateLimitExceeded
from app.config import settings, validate_env
from app.firebase_client import init_firebase
from app.api import (
    auth, contacts, items, invoices, expenses, accounts,
    banking, projects, dashboard, reports,
    quotes, sales_orders, purchase_orders, credit_notes,
    vendor_credits, recurring_invoices, inventory, taxes,
    fiscal, system, mileage, locations,
    # Phase 7: Advanced Features
    shipments, returns, custom_fields, approvals,
    portals, branches, expense_claims, attachments,
    payment_links, audit, recurring_bills, numbering,
    # Phase 8: Additional Features
    comments, transaction_locking, reporting_tags,
    # Sprint 15: Universal Chatter
    chatter,
    # Phase 4: Universal Activities
    activities,
    # Sprint 18: Privacy / GDPR
    privacy,
    # Sprint 20: Automation
    automation,
    # Sprint 22: Mail templates + queue
    mail,
    # Sprint 23: Marketing
    marketing,
    # Sprint 24: E-commerce
    ecommerce,
    # Wave E: Storefront + Customer Portal
    storefront,
    # Sprint 28: Iraq Payment Gateways
    iraq_payments,
    # Sprint 29: Migration Wizard
    migration,
    # ERP Sprint 1
    l10n_iq, rbac, einvoice,
    # Admin User Management (Sprint A-E)
    users as users_admin,
    # Sprint 6: POS
    pos,
    # Phase 4: Excel/CSV Export
    exports,
    # Wave O: Multi-Currency Revaluation
    currency_rates, revaluations,
    # Sprint 1.1: CRM
    crm,
    # Sprint 7.1: WhatsApp
    whatsapp,
    # Sprint 7.2: OCR
    ocr,
    # Sprint 2.1: HR
    hr,
    # Sprint 9.1: Payroll
    payroll,
    # Sprint 6.1/6.2: Manufacturing
    manufacturing,
    # Sprint 9.1: Multi-Company
    companies,
    # Excellence Initiative: Trash / Recycle Bin
    trash,
    # Wave A (Sprints 36-44): Helpdesk, Field Service, Subscriptions, Documents, Knowledge,
    # Quality, Maintenance, PLM, Repairs, HR Extended, Studio
    helpdesk, field_service, subscriptions, documents, knowledge,
    quality, maintenance, plm, repairs, hr_extended, studio,
    # Wave B (Sprints 45-50): engagement modules
    livechat, social, comms, engagement, elearning,
    # Wave C (Sprints 51-54): rental, AI, mobile, IoT
    rental, ai_features, mobile, iot,
    # Wave D (Sprints 55-67): vertical industries
    healthcare, hospital, pharmacy, hotel, restaurant,
    construction, real_estate, education, logistics,
    agriculture, ngo, government,
    # Onboarding wizard
    onboarding,
    platform,
    # Wave B (Accounting Power Features)
    analytic, budgets, cashflow_forecast, customer_statements, email_templates,
    # Wave I: Power-user Features
    saved_filters, scheduled_reports, custom_reports,
    # Wave U: Custom Dashboards
    dashboards,
    # Wave N: Fixed Assets
    fixed_assets,
)
from app.api import imports as imports_api
from app.api import jobs as jobs_api
from app.api import feature_flags
from app.api import health as health_api, backup as backup_api
from app.middleware.audit import audit_middleware
# Task 8.2: /api/v1/ versioned router with cursor-based pagination + RFC 7807 errors
from app.api.v1.router import v1_router
from app.api import webhooks_settings
from app.api import search as search_api
from app.api import quick_create as quick_create_api
from app.api import onboarding_wizard as onboarding_wizard_api
from app.api import payments as payments_api
from app.api import invoices_payments as invoices_payments_api
from app.api import saas_billing as saas_billing_api
from app.api import saas_admin as saas_admin_api
# growth-to-100 § R4 (Iraq compliance): WHT engine + CBI exchange rates.
from app.api import wht as wht_api
from app.api import cbi_rates as cbi_rates_api
# growth-to-100 § G5 (mobile distribution): device registration, public
# version-check, and super-admin version-config endpoints.
from app.api import devices as devices_api
from app.api import mobile_version as mobile_version_api
from app.api.admin import mobile_version_admin as mobile_version_admin_api
# growth-to-100 § G2 (support stack): admin impersonation (RFC 8693), per-tenant
# feature-flag overrides, NPS surveys, and status-page health emit.
from app.api.admin import impersonate as impersonate_api
from app.api.admin import tenant_flags as tenant_flags_api
from app.api import nps as nps_api
from app.api.internal import health_emit as health_emit_api
# growth-to-100 § G3 (hardware): per-tenant printer/scanner/drawer/display config.
from app.api import tenant_hardware as tenant_hardware_api
from app.api.v1.errors import register_error_handlers
import os

# Initialize Firebase
init_firebase()

# Validate environment configuration at startup
validate_env()

# ── Rate Limiter ──
# Requirement 10.1: use slowapi for rate limiting
# Requirement 10.2: key function is get_remote_address (IP-based)
# Requirement 10.3: optional via settings.RATE_LIMITING_ENABLED
from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler

# Sprint 19 (FIX-269): app start timestamp for uptime metrics
from datetime import datetime as _datetime
_APP_STARTED_AT = _datetime.utcnow().isoformat()

# Sprint 33: in-memory per-route latency stats (process-local; for ops dashboards)
_ROUTE_STATS: dict = {}


# ═══════════════════════════════════════════════════════════════════════════
# Lifespan context manager (Wave L)
# ═══════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown."""
    # Startup
    if getattr(settings, "SENTRY_DSN", ""):
        try:
            import sentry_sdk
            sentry_sdk.init(dsn=settings.SENTRY_DSN, environment=settings.ENVIRONMENT, traces_sample_rate=0.1)
        except Exception as e:
            logging.getLogger(__name__).warning("Sentry not initialized: %s", e)
    try:
        from app.services.scheduler import start_scheduler
        start_scheduler(app)
    except Exception as e:
        logging.getLogger(__name__).warning(f"Scheduler not started: {e}")

    if getattr(settings, "RUN_MIGRATIONS_ON_BOOT", False):
        try:
            from app.firestore.migrations import run_pending

            summary = run_pending(dry_run=not getattr(settings, "APPLY_MIGRATIONS_ON_BOOT", False))
            logging.getLogger(__name__).info("migration_boot_check: %s", summary)
        except Exception as e:
            logging.getLogger(__name__).warning("migration_boot failed: %s", e)
    
    yield
    
    # Shutdown
    try:
        from app.services.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception as e:
        logging.getLogger(__name__).warning(f"Scheduler shutdown error: {e}")


app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    description=(
        "سیستەمی ژمێریاری و داراییی کوردی - ئاستی جیهانی\n\n"
        "## API Versioning\n"
        "هەموو endpoints ی نوێ لە `/api/v1/` بەردەستن لەگەڵ:\n"
        "- **Cursor-based pagination** بۆ هەموو لیستەکان\n"
        "- **RFC 7807 Problem Details** بۆ هەموو error responses\n"
        "- **Pydantic v2 validation** بۆ هەموو request/response schemas\n\n"
        "## Authentication\n"
        "هەموو endpoints پێویستی بە `Authorization: Bearer <JWT>` header هەیە.\n\n"
        "## Optimistic concurrency\n"
        "For core document PUTs (invoices, bills, quotes, sales/purchase orders, "
        "contacts, items, POS orders/configs, payroll), send `If-Match: W/\"<version>\"` "
        "where version matches document `_version`. Conflicts return HTTP 409.\n\n"
        "## Idempotency\n"
        "Mutating requests may include `Idempotency-Key` header for safe retries.\n\n"
        "## Pagination\n"
        "بەکارهێنانی cursor-based pagination:\n"
        "```\nGET /api/v1/invoices?limit=20&cursor=<next_cursor>\n```\n"
        "Response:\n"
        "```json\n{\"items\": [...], \"next_cursor\": \"abc123\", \"has_more\": true, \"total\": 450}\n```"
    ),
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
# Requirement 10.4: return 429 with RateLimitExceeded error when limit exceeded
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Task 8.2: Register RFC 7807 Problem Details error handlers for /api/v1/
register_error_handlers(app)

# ── World-class performance spec (.kiro/specs/world-class-performance) ──
# Phase P0 — mandatory Sentry init + OTel tracing + structured JSON logs.
# Each wiring step is best-effort so missing dependencies in dev do not
# prevent the app from booting.
try:
    from app.observability import init_observability
    init_observability(app)
except Exception as _obs_err:  # noqa: BLE001
    logging.getLogger(__name__).warning(
        "Observability not initialized (will retry in production): %s", _obs_err
    )

# Phase P0 — request-id middleware. Must be added BEFORE auth/tenant/audit
# middleware so X-Request-Id is available on every downstream log line.
try:
    from app.middleware.request_id import RequestIDMiddleware
    app.add_middleware(RequestIDMiddleware)
except Exception as _rid_err:  # noqa: BLE001
    logging.getLogger(__name__).warning("RequestIDMiddleware not registered: %s", _rid_err)

# ── CORS (read origins from settings) ──
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Zoho-Retry",
        "If-Match",
        "Idempotency-Key",
    ],
)


# ── HTTPS Enforcement Middleware ──
# Requirement 6.12: enforce HTTPS for all connections
# In production (ENVIRONMENT=production), redirect plain HTTP requests to HTTPS.
# Cloud Run always terminates TLS and forwards X-Forwarded-Proto, so we check
# that header rather than the raw connection scheme.
@app.middleware("http")
async def enforce_https(request: Request, call_next):
    if settings.ENVIRONMENT == "production":
        forwarded_proto = request.headers.get("x-forwarded-proto", "https")
        if forwarded_proto == "http":
            https_url = str(request.url).replace("http://", "https://", 1)
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=https_url, status_code=301)
    return await call_next(request)


# ── Security Headers Middleware ──
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    # Sprint 33 (FIX-501): per-route latency tracking + cache hit counters
    import time as _time
    _t0 = _time.perf_counter()
    response: Response = await call_next(request)
    try:
        _dur_ms = (_time.perf_counter() - _t0) * 1000.0
        _stats = _ROUTE_STATS.setdefault(request.url.path, {"count": 0, "total_ms": 0.0, "max_ms": 0.0})
        _stats["count"] += 1
        _stats["total_ms"] += _dur_ms
        if _dur_ms > _stats["max_ms"]:
            _stats["max_ms"] = _dur_ms
        response.headers["X-Response-Time-Ms"] = f"{_dur_ms:.1f}"
    except Exception:
        pass
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Allow Firebase Auth signInWithPopup to detect popup window state
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    # FIX-45: HSTS - force HTTPS for 1 year + subdomains + preload list eligibility
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    # FIX-45: Permissions-Policy - disable powerful browser features by default
    # Requirements 5.4: camera=(), microphone=(), geolocation=(), payment=()
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://apis.google.com https://accounts.google.com; "
        "script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://apis.google.com https://accounts.google.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: https:; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.firebaseinstallations.googleapis.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://fcmregistrations.googleapis.com https://fonts.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://www.google.com https://*.google.com; "
        "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com; "
        "frame-ancestors 'none'"
    )
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(trash.router)
app.include_router(contacts.router)
app.include_router(items.router)
app.include_router(search_api.router)
app.include_router(invoices.router)
app.include_router(invoices.payments_router)
app.include_router(expenses.router)
app.include_router(expenses.bills_router)
app.include_router(expenses.payments_made_router)
app.include_router(accounts.router)
app.include_router(accounts.journal_router)
app.include_router(banking.router)
app.include_router(projects.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
# Wave I: Power-user Features
app.include_router(saved_filters.router)
app.include_router(scheduled_reports.router)
app.include_router(custom_reports.router)
# Wave U: Custom Dashboards
app.include_router(dashboards.router)
# Wave L: Background jobs monitoring
app.include_router(jobs_api.router)
# Feature Flags (Requirement 7)
app.include_router(feature_flags.router)
# Phase 1: Sales & Purchase Pipeline
app.include_router(quotes.router)
app.include_router(sales_orders.router)
app.include_router(purchase_orders.router)
app.include_router(credit_notes.router)
app.include_router(vendor_credits.router)
app.include_router(recurring_invoices.router)
# Phase 2: Inventory Management
app.include_router(inventory.router)
app.include_router(locations.router)
# Phase 3: Fixed Assets (Wave N)
app.include_router(fixed_assets.router)
# Phase 4: Mileage Tracking
app.include_router(mileage.router)
# Phase 5: Tax, Budget, Fiscal Year
app.include_router(taxes.router)
app.include_router(fiscal.router)
# Phase 6: System (Settings, Audit, Backup, Search)
app.include_router(system.router)
app.include_router(system.settings_router)
app.include_router(health_api.router)
app.include_router(backup_api.router)
# Phase 7: Advanced Features (Shipments, Returns, Workflows, Portals)
app.include_router(shipments.router)
app.include_router(shipments.challans_router)
app.include_router(returns.router)
app.include_router(numbering.router)
app.include_router(custom_fields.router)
app.include_router(approvals.router)
app.include_router(portals.router)
app.include_router(branches.router)
app.include_router(expense_claims.router)
app.include_router(attachments.router)
app.include_router(payment_links.router)
app.include_router(audit.router)
app.include_router(recurring_bills.router)
app.include_router(imports_api.router)
# Phase 8: Additional Features
app.include_router(comments.router)
app.include_router(transaction_locking.router)
app.include_router(reporting_tags.router)
# Sprint 15: Universal Chatter
app.include_router(chatter.router)
# Phase 4: Universal Activities
app.include_router(activities.router)
# Sprint 18: Privacy / GDPR
app.include_router(privacy.router)
# Sprint 20: Automation
app.include_router(automation.router)
app.include_router(mail.router)
app.include_router(marketing.router)
# Wave B: Accounting Power Features
app.include_router(analytic.router)
app.include_router(budgets.router)
app.include_router(cashflow_forecast.router)
app.include_router(customer_statements.router)
app.include_router(email_templates.router)
app.include_router(ecommerce.router)
app.include_router(storefront.router)
app.include_router(iraq_payments.router)
app.include_router(migration.router)
# ERP Sprint 1
app.include_router(l10n_iq.router)
app.include_router(rbac.router)
app.include_router(users_admin.router)
app.include_router(einvoice.router)
# Sprint 6: POS
app.include_router(pos.router)
# Phase 4: Excel/CSV Export
app.include_router(exports.router)
# Wave O: Multi-Currency Revaluation
app.include_router(currency_rates.router)
app.include_router(revaluations.router)
# Sprint 1.1: CRM
app.include_router(crm.router)
# Sprint 7.1: WhatsApp
app.include_router(whatsapp.router)
# Sprint 7.2: OCR
app.include_router(ocr.router)
# Sprint 2.1: HR
app.include_router(hr.router)
# Sprint 9.1: Payroll
app.include_router(payroll.router)
# Sprint 6.1/6.2: Manufacturing
app.include_router(manufacturing.router)
# Sprint 9.1: Multi-Company
app.include_router(companies.router)

# ── Wave A: Sprints 36-44 (P0 generic enterprise modules) ──
app.include_router(helpdesk.router)
app.include_router(field_service.router)
app.include_router(subscriptions.router)
app.include_router(documents.router)
app.include_router(knowledge.router)
app.include_router(quality.router)
app.include_router(maintenance.router)
app.include_router(plm.router)
app.include_router(repairs.router)
app.include_router(hr_extended.router)
app.include_router(studio.router)

# Wave B: Sprints 45-50 (engagement)
app.include_router(livechat.router)
app.include_router(social.router)
app.include_router(comms.router)
app.include_router(engagement.router)
app.include_router(elearning.router)

# Wave C: Sprints 51-54 (rental, AI, mobile, IoT)
app.include_router(rental.router)
app.include_router(ai_features.router)
app.include_router(mobile.router)
app.include_router(iot.router)

# Wave D: Sprints 55-67 (vertical industries)
app.include_router(healthcare.router)
app.include_router(hospital.router)
app.include_router(pharmacy.router)
app.include_router(hotel.router)
app.include_router(restaurant.router)
app.include_router(construction.router)
app.include_router(real_estate.router)
app.include_router(education.router)
app.include_router(logistics.router)
app.include_router(agriculture.router)
app.include_router(ngo.router)
app.include_router(government.router)
app.include_router(onboarding.router)
app.include_router(platform.router)

# ── Task 8.2: /api/v1/ versioned router (cursor-based pagination + RFC 7807) ──
app.include_router(v1_router)
app.include_router(webhooks_settings.router)

# ── Launch-readiness § R2: quick-create endpoints ──
for _qc_router in quick_create_api.ALL_ROUTERS:
    app.include_router(_qc_router)

# ── Launch-readiness § R3/R4/R5: onboarding wizard, payments, SaaS billing ──
for _ob_router in onboarding_wizard_api.ALL_ROUTERS:
    app.include_router(_ob_router)
for _pay_router in payments_api.ALL_ROUTERS:
    app.include_router(_pay_router)
app.include_router(invoices_payments_api.router)
app.include_router(saas_billing_api.router)
for _saas_admin_router in saas_admin_api.ALL_ROUTERS:
    app.include_router(_saas_admin_router)

# ── growth-to-100 § R4: WHT + CBI rates ──
for _wht_router in wht_api.ALL_ROUTERS:
    app.include_router(_wht_router)
for _cbi_router in cbi_rates_api.ALL_ROUTERS:
    app.include_router(_cbi_router)

# ── growth-to-100 § G5 (mobile distribution) ──────────────────────────────
app.include_router(devices_api.router)
app.include_router(mobile_version_api.router)
app.include_router(mobile_version_admin_api.router)

# ── growth-to-100 § G2 (customer support stack) ────────────────────────────
for _imp_router in impersonate_api.ALL_ROUTERS:
    app.include_router(_imp_router)
for _tf_router in tenant_flags_api.ALL_ROUTERS:
    app.include_router(_tf_router)
app.include_router(nps_api.router)
for _he_router in health_emit_api.ALL_ROUTERS:
    app.include_router(_he_router)

# ── growth-to-100 § G3 (hardware compatibility) ────────────────────────────
for _hw_router in tenant_hardware_api.ALL_ROUTERS:
    app.include_router(_hw_router)

# ── growth-to-100 § G4a (Iraq e-Fakhata) — guarded: needs lxml + signxml ──
try:
    from app.api import efakhata as efakhata_api
    from app.api import efakhata_export as efakhata_export_api
    for _efk_router in efakhata_api.ALL_ROUTERS:
        app.include_router(_efk_router)
    for _efk_exp_router in efakhata_export_api.ALL_ROUTERS:
        app.include_router(_efk_exp_router)
    logging.getLogger(__name__).info("Mounted e-Fakhata routers (G4a)")
except Exception as _efk_err:  # noqa: BLE001
    logging.getLogger(__name__).warning("e-Fakhata routers not mounted: %s", _efk_err)

# Register the seven tenant-side payment gateway adapters at startup (R4).
try:
    from app.payments.bootstrap import register_default_providers
    register_default_providers()
except Exception as _pay_boot_err:  # pragma: no cover - defensive
    logging.getLogger(__name__).warning(
        "payment provider bootstrap failed: %s", _pay_boot_err
    )

from app.middleware.org_context import org_context_middleware

app.middleware("http")(org_context_middleware)

# Rate limit middleware (opt-in via settings bag)
from app.middleware.rate_limit import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)

# Module gate middleware — enforce enabled_modules on mutating API calls
from app.services.module_gate import module_gate_middleware
app.middleware("http")(module_gate_middleware)

from app.middleware.fs_observability import fs_observability_middleware
from app.middleware.idempotency_http import idempotency_middleware

app.middleware("http")(fs_observability_middleware)
app.middleware("http")(idempotency_middleware)

# growth-to-100 § G5: mobile minimum-version gate. Mounted after rate-limit
# + module-gate so a forced-upgrade still respects RL counters but never
# blocks the upgrade itself (exemption list inside the middleware).
try:
    from app.middleware.min_app_version import MinAppVersionMiddleware
    app.add_middleware(MinAppVersionMiddleware)
except Exception as _mav_err:  # noqa: BLE001
    logging.getLogger(__name__).warning(
        "MinAppVersionMiddleware not registered: %s", _mav_err
    )

# Audit middleware - auto-logs mutating requests
app.middleware("http")(audit_middleware)

# growth-to-100 § G2: impersonation read-only enforcement + per-request audit.
# Added after audit_middleware so on the request path read-only runs first and
# rejects mutations on an impersonation token before they reach the audit/route
# layer; the impersonation audit row is still written for the blocked attempt.
from app.middleware.read_only_mode import read_only_mode_middleware
from app.middleware.impersonation_audit import impersonation_audit_middleware
app.middleware("http")(read_only_mode_middleware)
app.middleware("http")(impersonation_audit_middleware)


# ── World-class performance spec routers (P0 + P4 + P6) ──
# Each include is best-effort so a missing module never blocks startup.
try:
    from app.api import rum as _rum_router
    app.include_router(_rum_router.router)
    logging.getLogger(__name__).info("Mounted /api/rum/vitals (P0)")
except Exception as _e:  # noqa: BLE001
    logging.getLogger(__name__).warning("RUM router not mounted: %s", _e)

try:
    from app.api import csp_report as _csp_router
    app.include_router(_csp_router.router)
    logging.getLogger(__name__).info("Mounted /api/csp-report (P6)")
except Exception as _e:  # noqa: BLE001
    logging.getLogger(__name__).warning("CSP report router not mounted: %s", _e)

try:
    from app.api import health_check as _health_router
    app.include_router(_health_router.router)
    logging.getLogger(__name__).info("Mounted /api/health (P4 — enriched)")
except Exception as _e:  # noqa: BLE001
    logging.getLogger(__name__).warning("Health-check router not mounted: %s", _e)

try:
    from app.api.admin import exports as _admin_exports
    from app.api.admin import pii_delete as _admin_pii
    app.include_router(_admin_exports.router)
    app.include_router(_admin_pii.router)
    logging.getLogger(__name__).info("Mounted /api/admin/tenants/{id}/export + /delete (P4)")
except Exception as _e:  # noqa: BLE001
    logging.getLogger(__name__).warning("Admin routers not mounted: %s", _e)

try:
    from app.observability.metrics import router as _metrics_router
    app.include_router(_metrics_router)
    logging.getLogger(__name__).info("Mounted /metrics (P4)")
except Exception as _e:  # noqa: BLE001
    logging.getLogger(__name__).warning("Prometheus metrics router not mounted: %s", _e)

# ── Validation framework routers (V-PR.4 + V-PR.7) ──
try:
    from app.api import offline_sync_health as _offline_router
    app.include_router(_offline_router.router)
    logging.getLogger(__name__).info("Mounted /api/health/offline-sync (V-PR.4)")
except Exception as _e:  # noqa: BLE001
    logging.getLogger(__name__).warning("Offline-sync health router not mounted: %s", _e)

try:
    from app.api import health_offline as _health_offline_router
    app.include_router(_health_offline_router.router)
    logging.getLogger(__name__).info("Mounted /api/health/synthetic-summary (V-PR.1)")
except Exception as _e:  # noqa: BLE001
    logging.getLogger(__name__).warning("Synthetic-summary router not mounted: %s", _e)


@app.get("/")
def root():
    # ئەگەر frontend build هەبوو، index.html ی وەردەگرێت
    dist_index = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist", "index.html")
    if os.path.exists(dist_index):
        return FileResponse(dist_index)
    return {"app": settings.APP_NAME, "status": "running", "version": "2.0.0"}



@app.get("/api/live")
def liveness():
    """Sprint 19 (FIX-266): Liveness probe — process is alive (always returns ok unless dead)."""
    return {"status": "alive"}


@app.get("/api/version")
def version_info():
    """Sprint 19 (FIX-267): Build/version info for ops dashboards."""
    import platform
    import sys
    return {
        "app": "zoho-erp-backend",
        "version": os.environ.get("APP_VERSION", "dev"),
        "git_sha": os.environ.get("GIT_SHA", "unknown")[:12],
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "env": os.environ.get("APP_ENV", "development"),
        "started_at": _APP_STARTED_AT,
    }


@app.get("/api/metrics")
def metrics():
    """Sprint 19 (FIX-268): Lightweight metrics for monitoring dashboards (route count + uptime)."""
    from datetime import datetime
    started = datetime.fromisoformat(_APP_STARTED_AT)
    uptime_seconds = (datetime.utcnow() - started).total_seconds()
    return {
        "route_count": len(app.routes),
        "uptime_seconds": round(uptime_seconds, 1),
        "started_at": _APP_STARTED_AT,
    }


@app.get("/api/metrics/routes")
def metrics_routes(top: int = 20, sort: str = "avg"):
    """Sprint 33 (FIX-502): per-route latency aggregates. sort=avg|max|count."""
    rows = []
    for path, st in _ROUTE_STATS.items():
        c = max(int(st["count"]), 1)
        rows.append({
            "path": path,
            "count": st["count"],
            "avg_ms": round(st["total_ms"] / c, 2),
            "max_ms": round(st["max_ms"], 2),
        })
    key = {"avg": "avg_ms", "max": "max_ms", "count": "count"}.get(sort, "avg_ms")
    rows.sort(key=lambda r: r[key], reverse=True)
    return {"items": rows[: max(1, min(top, 200))], "total": len(rows)}


@app.post("/api/metrics/routes/reset")
def metrics_routes_reset():
    """Sprint 33 (FIX-503): reset per-route counters (ops convenience)."""
    n = len(_ROUTE_STATS)
    _ROUTE_STATS.clear()
    return {"reset": True, "previous_count": n}


@app.get("/api/ready")
def ready():
    """Readiness probe — verifies Firestore is reachable before accepting traffic.

    Returns 200 with status=ready when DB roundtrip succeeds; 503 otherwise.
    Designed for Kubernetes/Docker readinessProbe.
    """
    from fastapi.responses import JSONResponse
    try:
        from app.firebase_client import get_db
        # Lightweight read — does NOT scan a collection, just confirms client is initialized.
        db = get_db()
        # Touch a tiny doc; existence is irrelevant — only the round-trip matters.
        db.collection("_healthcheck").document("ping").get()
        return {"status": "ready", "db": "ok"}
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "error": str(exc)[:200]},
        )


# ── Serve React SPA (بۆ production) ──
import os as _os_spa
_frontend_dist = _os_spa.path.join(_os_spa.path.dirname(__file__), "..", "..", "frontend", "dist")
if _os_spa.path.exists(_frontend_dist):
    # Only mount /assets when the built asset dir actually exists. A partial or
    # failed `npm run build` can leave `dist/` without `dist/assets/`, and
    # StaticFiles raises at construction time — which would crash app import
    # (and every test that imports it). Guard so a bad build can't take the API down.
    _assets_dir = _os_spa.path.join(_frontend_dist, "assets")
    if _os_spa.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="static-assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """Catch-all: React Router SPA بۆ هەموو URL"""
        file_path = _os_spa.path.join(_frontend_dist, full_path)
        if _os_spa.path.exists(file_path) and _os_spa.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(_os_spa.path.join(_frontend_dist, "index.html"))
