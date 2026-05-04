import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.firestore.invoices import QuoteRepository, SalesOrderRepository, InvoiceRepository
from app.firestore.taxes import TaxRateRepository
from app.firestore.system import SequenceRepository
from app.firestore.organizations import OrganizationRepository
from app.services.auth import get_current_user
from app.services.pdf_generator import generate_quote_pdf
from app.services import settings_service

router = APIRouter(prefix="/api/quotes", tags=["Quotes"])

@router.get("")
def list_quotes(page: int = Query(1), page_size: int = Query(20, le=500), status: str = Query(""),
                user: dict = Depends(get_current_user)):
    repo = QuoteRepository(user["org_id"])
    filters = [{"field": "status", "op": "==", "value": status}] if status else []
    items, total = repo.list(filters=filters, order_by="date", order_dir="DESCENDING", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("", status_code=201)
def create_quote(data: dict, user: dict = Depends(get_current_user)):
    # Apply sales config defaults
    try:
        cfg = settings_service.get_sales_settings(user["org_id"])
    except Exception:
        cfg = {}
    
    # Set expiry/payment terms from config if not provided
    if not data.get("expiry_days") and not data.get("valid_until"):
        data.setdefault("expiry_days", cfg.get("quote_expiry_days", 30))
    if not data.get("payment_terms"):
        data["payment_terms"] = cfg.get("default_payment_terms", "Net 30")
    
    # Mark for approval if discount exceeds threshold
    discount_pct = data.get("discount_percent", 0)
    threshold = cfg.get("discount_approval_threshold", 100)
    if discount_pct > threshold:
        data["requires_approval"] = True
    
    seq_repo = SequenceRepository(user["org_id"])
    quote_number = seq_repo.get_next("quote")
    repo = QuoteRepository(user["org_id"])
    lines = data.pop("lines", [])
    quote = repo.create({"id": str(uuid.uuid4()), "quote_number": quote_number, **data})
    if lines: repo.set_lines(quote["id"], lines)
    
    # Webhook: quote.created
    try:
        from app.services.webhook_dispatcher import dispatch_event
        dispatch_event(user["org_id"], "quote.created", {"id": quote["id"]})
    except Exception:
        pass
    
    return quote


@router.get("/{quote_id}/pdf")
def download_quote_pdf(
    quote_id: str,
    lang: str = Query("en", pattern="^(en|ku)$"),
    user: dict = Depends(get_current_user)
):
    """Generate and download quote as PDF
    
    Query Parameters:
        - lang: Language code ('en' or 'ku'). Default: 'en'
    """
    repo = QuoteRepository(user["org_id"])
    quote = repo.get(quote_id)
    if not quote or quote.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پێشنیار نەدۆزرایەوە")
    
    # Get organization data
    org_repo = OrganizationRepository()
    org = org_repo.get(user["org_id"])
    if not org:
        raise HTTPException(status_code=500, detail="زانیاری ڕێکخراو نەدۆزرایەوە")
    
    # Generate PDF
    try:
        pdf_buffer = generate_quote_pdf(user["org_id"], quote_id, org, lang=lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"هەڵە لە دروستکردنی PDF: {str(e)}")
    
    # Return as downloadable file
    filename = f"quote_{quote.get('quote_number', quote_id)}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ============================================================
# FIX-83: Quote send / accept / decline workflow
# ============================================================
@router.post("/{quote_id}/send")
def send_quote(quote_id: str, user: dict = Depends(get_current_user)):
    """Mark quote as sent (state: draft -> sent). Email integration is optional."""
    repo = QuoteRepository(user["org_id"])
    q = repo.get(quote_id)
    if not q or q.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پێشنیار نەدۆزرایەوە")
    if q.get("status") not in (None, "", "draft", "sent"):
        raise HTTPException(status_code=400, detail=f"ناتوانرێت پێشنیاری دۆخی '{q.get('status')}' بنێردرێت")
    repo.update(quote_id, {"status": "sent", "sent_at": datetime.utcnow().isoformat()})
    return {"id": quote_id, "status": "sent"}


@router.post("/{quote_id}/accept")
def accept_quote(quote_id: str, user: dict = Depends(get_current_user)):
    repo = QuoteRepository(user["org_id"])
    q = repo.get(quote_id)
    if not q or q.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پێشنیار نەدۆزرایەوە")
    if q.get("status") in ("invoiced", "declined", "expired"):
        raise HTTPException(status_code=400, detail=f"ناتوانرێت پێشنیاری دۆخی '{q.get('status')}' قبوڵ بکرێت")
    repo.update(quote_id, {"status": "accepted", "accepted_at": datetime.utcnow().isoformat()})
    return {"id": quote_id, "status": "accepted"}


@router.post("/{quote_id}/decline")
def decline_quote(quote_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    repo = QuoteRepository(user["org_id"])
    q = repo.get(quote_id)
    if not q or q.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پێشنیار نەدۆزرایەوە")
    reason = (data or {}).get("reason", "")
    repo.update(quote_id, {"status": "declined", "declined_at": datetime.utcnow().isoformat(), "decline_reason": reason})
    return {"id": quote_id, "status": "declined"}


# ============================================================
# FIX-84: Convert quote -> sales order
# ============================================================
@router.post("/{quote_id}/convert-to-so", status_code=201)
def quote_to_sales_order(quote_id: str, user: dict = Depends(get_current_user)):
    qrepo = QuoteRepository(user["org_id"])
    q = qrepo.get_with_lines(quote_id)
    if not q or q.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پێشنیار نەدۆزرایەوە")
    if q.get("status") in ("declined", "expired", "invoiced"):
        raise HTTPException(status_code=400, detail="ناتوانرێت پێشنیاری ڕەتکراوە/بەسەرچوو بگۆڕدرێت")

    so_repo = SalesOrderRepository(user["org_id"])
    seq_repo = SequenceRepository(user["org_id"])
    so_number = seq_repo.get_next("sales_order")

    so_payload = {
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "order_number": so_number,
        "contact_id": q.get("contact_id"),
        "date": datetime.utcnow().isoformat()[:10],
        "currency": q.get("currency", "IQD"),
        "subtotal": q.get("subtotal", 0),
        "tax_amount": q.get("tax_amount", 0),
        "total": q.get("total", 0),
        "status": "draft",
        "quote_id": quote_id,
        "notes": q.get("notes", ""),
    }
    so = so_repo.create(so_payload)
    lines = q.get("lines") or []
    if lines:
        so_repo.set_lines(so["id"], [{k: v for k, v in ln.items() if k != "id"} for ln in lines])

    qrepo.update(quote_id, {"status": "accepted", "sales_order_id": so["id"]})
    return {"id": so["id"], "order_number": so_number, "quote_id": quote_id}


# ============================================================
# FIX-85: Convert quote -> invoice (skip SO)
# ============================================================
@router.post("/{quote_id}/convert-to-invoice", status_code=201)
def quote_to_invoice(quote_id: str, user: dict = Depends(get_current_user)):
    qrepo = QuoteRepository(user["org_id"])
    q = qrepo.get_with_lines(quote_id)
    if not q or q.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پێشنیار نەدۆزرایەوە")
    if q.get("status") in ("declined", "expired", "invoiced"):
        raise HTTPException(status_code=400, detail="ناتوانرێت پێشنیاری ڕەتکراوە/بەسەرچوو بگۆڕدرێت")

    inv_repo = InvoiceRepository(user["org_id"])
    seq_repo = SequenceRepository(user["org_id"])
    inv_number = seq_repo.get_next("invoice")

    total = float(q.get("total", 0) or 0)
    inv_payload = {
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "invoice_number": inv_number,
        "contact_id": q.get("contact_id"),
        "date": datetime.utcnow().isoformat()[:10],
        "due_date": datetime.utcnow().isoformat()[:10],
        "currency": q.get("currency", "IQD"),
        "subtotal": q.get("subtotal", 0),
        "tax_amount": q.get("tax_amount", 0),
        "total": total,
        "balance_due": total,
        "status": "draft",
        "quote_id": quote_id,
        "notes": q.get("notes", ""),
    }
    inv = inv_repo.create(inv_payload)
    lines = q.get("lines") or []
    if lines:
        inv_repo.set_lines(inv["id"], [{k: v for k, v in ln.items() if k != "id"} for ln in lines])

    qrepo.update(quote_id, {"status": "invoiced", "invoice_id": inv["id"]})
    return {"id": inv["id"], "invoice_number": inv_number, "quote_id": quote_id}


# ============================================================
# FIX-86: Auto-mark expired quotes (manual trigger / cron)
# ============================================================
@router.post("/expire-overdue")
def expire_overdue_quotes(user: dict = Depends(get_current_user)):
    """Scan quotes and mark expired any whose expiry_date < today and not in terminal state."""
    repo = QuoteRepository(user["org_id"])
    today = date.today().isoformat()
    items, _ = repo.list(limit=2000, offset=0)
    expired_count = 0
    for q in items:
        status = q.get("status") or "draft"
        if status in ("declined", "expired", "invoiced", "accepted"):
            continue
        expiry = q.get("expiry_date") or q.get("valid_until") or q.get("end_date")
        if not expiry:
            continue
        expiry_str = expiry if isinstance(expiry, str) else str(expiry)[:10]
        if expiry_str < today:
            repo.update(q["id"], {"status": "expired", "expired_at": datetime.utcnow().isoformat()})
            expired_count += 1
    return {"expired": expired_count, "scanned": len(items), "as_of": today}
