"""POS Pricing Service - Sprint 6.2
Handles pricelist rule resolution and price computation.
"""
from datetime import datetime
from typing import Optional, List


def apply_pricelist(pricelist: dict, item_id: str, qty: float, base_price: float, category_id: Optional[str] = None) -> float:
    """Apply pricelist rules to compute final price.
    
    Rules are evaluated in order of specificity:
    1. Product-specific rules (applies_on='product')
    2. Category-specific rules (applies_on='category')
    3. All-products rules (applies_on='all')
    
    Within each group, rules are evaluated by date validity and min_qty.
    Returns the first matching rule's computed price, or base_price if no rules match.
    
    Args:
        pricelist: Full pricelist document with 'rules' list
        item_id: Product/item ID to price
        qty: Quantity being ordered
        base_price: Base price before pricelist
        category_id: Optional category ID of the item
        
    Returns:
        Final unit price after applying pricelist rules
    """
    rules: List[dict] = pricelist.get("rules", [])
    if not rules:
        return base_price
    
    now = datetime.utcnow()
    
    # Sort rules by specificity: product > category > all
    product_rules = [r for r in rules if r.get("applies_on") == "product" and r.get("product_id") == item_id]
    category_rules = [r for r in rules if r.get("applies_on") == "category" and r.get("category_id") == category_id] if category_id else []
    all_rules = [r for r in rules if r.get("applies_on") == "all"]
    
    # Process in order of specificity
    for rule_set in [product_rules, category_rules, all_rules]:
        for rule in rule_set:
            # Check min_qty
            if rule.get("min_qty", 1) > qty:
                continue
            
            # Check date range
            date_from = rule.get("date_from")
            date_to = rule.get("date_to")
            
            if date_from:
                try:
                    date_from_dt = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
                    if now < date_from_dt:
                        continue
                except:
                    pass
            
            if date_to:
                try:
                    date_to_dt = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                    if now > date_to_dt:
                        continue
                except:
                    pass
            
            # Apply computation
            compute = rule.get("compute", "fixed")
            
            if compute == "fixed":
                fixed_price = rule.get("fixed_price")
                if fixed_price is not None:
                    return float(fixed_price)
            
            elif compute == "discount":
                percent = rule.get("percent", 0)
                return base_price * (1 - percent / 100)
            
            elif compute == "formula":
                # Formula: (base * base_multiplier) - discount_amount
                base_price_to_use = base_price
                
                # If base_pricelist_id is set, we'd need to recursively resolve it
                # For now, simplified: use base price
                base_multiplier = rule.get("base", 1.0)
                discount_amount = rule.get("price_discount", 0)
                return (base_price_to_use * base_multiplier) - discount_amount
    
    # No matching rule found
    return base_price
