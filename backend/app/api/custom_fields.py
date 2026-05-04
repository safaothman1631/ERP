import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.system import CustomFieldDefinitionRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/custom-fields", tags=["Custom Fields"])

@router.get("")
def list_definitions(entity_type: str = None, user: dict = Depends(get_current_user)):
    repo = CustomFieldDefinitionRepository(user["org_id"])
    filters = []
    if entity_type: filters.append({"field": "entity_type", "op": "==", "value": entity_type})
    items, total = repo.list(filters=filters, order_by="sort_order", order_dir="ASCENDING", limit=100)
    return items

@router.post("", status_code=201)
def create_definition(data: dict, user: dict = Depends(get_current_user)):
    if not data.get("entity_type"):
        raise HTTPException(status_code=400, detail="entity_type داواکراوە")
    if not data.get("field_name"):
        raise HTTPException(status_code=400, detail="field_name داواکراوە")
    repo = CustomFieldDefinitionRepository(user["org_id"])
    return repo.create({
        "id": str(uuid.uuid4()),
        "entity_type": data["entity_type"],
        "field_name": data["field_name"],
        "field_label": data.get("field_label", data["field_name"]),
        "field_label_ku": data.get("field_label_ku", ""),
        "field_type": data.get("field_type", "text"),
        "options": data.get("options", []),
        "is_required": data.get("is_required", False),
        "is_active": True,
        "sort_order": data.get("sort_order", 0),
    })

@router.put("/{field_id}")
def update_definition(field_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = CustomFieldDefinitionRepository(user["org_id"])
    if not repo.get(field_id): raise HTTPException(404)
    return repo.update(field_id, data)

@router.delete("/{field_id}")
def delete_definition(field_id: str, user: dict = Depends(get_current_user)):
    repo = CustomFieldDefinitionRepository(user["org_id"])
    if not repo.get(field_id): raise HTTPException(404)
    repo.update(field_id, {"is_active": False})
    return {"success": True}


# ===== CUSTOM FIELD VALUES =====
@router.get("/values/{entity_type}/{entity_id}")
def get_custom_field_values(entity_type: str, entity_id: str, user: dict = Depends(get_current_user)):
    """Get custom field values for a specific entity"""
    from app.firestore.custom_field_values import CustomFieldValueRepository
    repo = CustomFieldValueRepository(user["org_id"])
    filters = [
        {"field": "entity_type", "op": "==", "value": entity_type},
        {"field": "entity_id", "op": "==", "value": entity_id},
    ]
    items, _ = repo.list(filters=filters, limit=100)
    
    # Return as dict keyed by field_id for easier frontend consumption
    values_dict = {}
    for item in items:
        values_dict[item.get("field_id")] = item.get("value")
    
    return {"entity_type": entity_type, "entity_id": entity_id, "values": values_dict}


@router.post("/values/{entity_type}/{entity_id}")
def set_custom_field_values(entity_type: str, entity_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Set custom field values for an entity"""
    from app.firestore.custom_field_values import CustomFieldValueRepository
    repo = CustomFieldValueRepository(user["org_id"])
    
    values = data.get("values", {})
    results = []
    
    for field_id, value in values.items():
        # Check if value already exists
        filters = [
            {"field": "entity_type", "op": "==", "value": entity_type},
            {"field": "entity_id", "op": "==", "value": entity_id},
            {"field": "field_id", "op": "==", "value": field_id},
        ]
        existing, _ = repo.list(filters=filters, limit=1)
        
        if existing:
            # Update existing
            updated = repo.update(existing[0]["id"], {"value": value})
            results.append(updated)
        else:
            # Create new
            created = repo.create({
                "id": str(uuid.uuid4()),
                "entity_type": entity_type,
                "entity_id": entity_id,
                "field_id": field_id,
                "value": value,
            })
            results.append(created)
    
    return {"success": True, "count": len(results)}
