import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.firestore.email_templates import EmailTemplateRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/email-templates", tags=["Email Templates"])


# ===== SCHEMAS =====
class EmailTemplateCreate(BaseModel):
    name: str = Field(max_length=200)
    doc_type: str = Field(max_length=50)  # 'invoice', 'quote', 'bill', 'po', 'so', 'statement'
    subject: str = Field(max_length=500)
    body_html: str
    is_default: bool = False
    variables_used: list[str] = Field(default_factory=list)


# ===== EMAIL TEMPLATES =====
@router.get("")
def list_email_templates(
    doc_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    repo = EmailTemplateRepository(user["org_id"])
    
    if doc_type:
        items = repo.get_by_doc_type(doc_type)
        return {
            "items": items,
            "total": len(items),
            "page": 1,
            "page_size": len(items),
        }
    
    items, total = repo.list(
        order_by="created_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=201, dependencies=[Depends(require_perm("system.settings"))])
def create_email_template(
    data: EmailTemplateCreate,
    user: dict = Depends(get_current_user),
):
    repo = EmailTemplateRepository(user["org_id"])
    
    # If setting as default, unset other defaults for this doc_type
    if data.is_default:
        existing_default = repo.get_default_for_doc_type(data.doc_type)
        if existing_default:
            repo.update(existing_default["id"], {"is_default": False})
    
    template = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "created_at": datetime.utcnow(),
        **data.model_dump(),
    })
    return template


@router.get("/{template_id}")
def get_email_template(template_id: str, user: dict = Depends(get_current_user)):
    repo = EmailTemplateRepository(user["org_id"])
    template = repo.get(template_id)
    if not template or template.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="قاڵب نەدۆزرایەوە")
    return template


@router.put("/{template_id}", dependencies=[Depends(require_perm("system.settings"))])
def update_email_template(
    template_id: str,
    data: EmailTemplateCreate,
    user: dict = Depends(get_current_user),
):
    repo = EmailTemplateRepository(user["org_id"])
    template = repo.get(template_id)
    if not template or template.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="قاڵب نەدۆزرایەوە")
    
    # If setting as default, unset other defaults for this doc_type
    if data.is_default and template.get("doc_type") == data.doc_type:
        existing_default = repo.get_default_for_doc_type(data.doc_type)
        if existing_default and existing_default["id"] != template_id:
            repo.update(existing_default["id"], {"is_default": False})
    
    updated = repo.update(template_id, data.model_dump())
    return updated


@router.delete("/{template_id}", dependencies=[Depends(require_perm("system.settings"))])
def delete_email_template(template_id: str, user: dict = Depends(get_current_user)):
    repo = EmailTemplateRepository(user["org_id"])
    template = repo.get(template_id)
    if not template or template.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="قاڵب نەدۆزرایەوە")
    
    repo.delete(template_id)
    return {"success": True}


@router.post("/{template_id}/set-default", dependencies=[Depends(require_perm("system.settings"))])
def set_default_template(template_id: str, user: dict = Depends(get_current_user)):
    """Set a template as the default for its doc_type"""
    repo = EmailTemplateRepository(user["org_id"])
    template = repo.get(template_id)
    if not template or template.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="قاڵب نەدۆزرایەوە")
    
    doc_type = template.get("doc_type")
    
    # Unset other defaults
    existing_default = repo.get_default_for_doc_type(doc_type)
    if existing_default and existing_default["id"] != template_id:
        repo.update(existing_default["id"], {"is_default": False})
    
    # Set this as default
    repo.update(template_id, {"is_default": True})
    return {"success": True}


@router.post("/{template_id}/preview")
def preview_template(
    template_id: str,
    sample_data: dict,
    user: dict = Depends(get_current_user),
):
    """Render template with sample variables for preview"""
    repo = EmailTemplateRepository(user["org_id"])
    template = repo.get(template_id)
    if not template or template.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="قاڵب نەدۆزرایەوە")
    
    subject = template.get("subject", "")
    body_html = template.get("body_html", "")
    
    # Simple variable substitution ({{var}})
    # For production, use jinja2 or similar
    for key, value in sample_data.items():
        placeholder = f"{{{{{key}}}}}"
        subject = subject.replace(placeholder, str(value))
        body_html = body_html.replace(placeholder, str(value))
    
    return {
        "subject": subject,
        "body_html": body_html,
    }


@router.get("/by-doctype/{doc_type}")
def get_templates_by_doctype(doc_type: str, user: dict = Depends(get_current_user)):
    """Get all templates for a document type"""
    repo = EmailTemplateRepository(user["org_id"])
    templates = repo.get_by_doc_type(doc_type)
    return templates
