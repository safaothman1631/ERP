import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
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
from app.middleware.audit import audit_middleware
import os

# Initialize Firebase
init_firebase()

# Validate environment configuration at startup
validate_env()

# ── Rate Limiter ──
limiter = Limiter(key_func=get_remote_address)

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
    try:
        from app.services.scheduler import start_scheduler
        start_scheduler(app)
    except Exception as e:
        logging.getLogger(__name__).warning(f"Scheduler not started: {e}")
    
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
    description="سیستەمی ژمێریاری و داراییی کوردی - ئاستی جیهانی",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS (read origins from settings) ──
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Zoho-Retry"],
)


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
    # FIX-45: HSTS - force HTTPS for 1 year + subdomains + preload list eligibility
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    # FIX-45: Permissions-Policy - disable powerful browser features by default
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://apis.google.com https://accounts.google.com; "
        "script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://apis.google.com https://accounts.google.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: https:; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://fonts.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net; "
        "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com; "
        "frame-ancestors 'none'"
    )
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response

# Include routers
app.include_router(auth.router)
app.include_router(trash.router)
app.include_router(contacts.router)
app.include_router(items.router)
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

# Rate limit middleware (opt-in via settings bag)
from app.middleware.rate_limit import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)

# Audit middleware - auto-logs mutating requests
app.middleware("http")(audit_middleware)


@app.get("/")
def root():
    # ئەگەر frontend build هەبوو، index.html ی وەردەگرێت
    dist_index = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist", "index.html")
    if os.path.exists(dist_index):
        return FileResponse(dist_index)
    return {"app": settings.APP_NAME, "status": "running", "version": "2.0.0"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


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
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.exists(_frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_frontend_dist, "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """Catch-all: React Router SPA بۆ هەموو URL"""
        file_path = os.path.join(_frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_frontend_dist, "index.html"))
