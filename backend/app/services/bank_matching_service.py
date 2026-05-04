"""Bank transaction matching service — intelligent matching engine"""
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional


def find_match_candidates(org_id: str, txn: dict) -> list[dict]:
    """
    Find best match candidates for a bank transaction.
    Returns list sorted by score (desc), top 5.
    
    Each candidate: {
        'type': 'invoice'|'bill'|'rule',
        'target_id': str,
        'score': int,
        'suggested_action': str,
        'suggested_amount': float,
        'reason': str
    }
    """
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.bills import BillRepository
    from app.firestore.banking import BankRuleRepository
    
    candidates = []
    
    txn_date = txn.get('date', '')
    txn_amount = abs(Decimal(str(txn.get('amount', 0))))
    txn_desc = str(txn.get('description', '')).lower()
    txn_ref = str(txn.get('reference', '')).lower()
    txn_type = txn.get('transaction_type', txn.get('debit_or_credit', 'debit'))
    
    try:
        txn_date_obj = datetime.strptime(txn_date[:10], '%Y-%m-%d')
    except Exception:
        txn_date_obj = datetime.utcnow()
    
    # Match invoices (for credit transactions)
    if txn_type == 'credit':
        inv_repo = InvoiceRepository(org_id)
        invoices, _ = inv_repo.list(limit=1000)
        
        for inv in invoices:
            if inv.get('status') == 'paid' or inv.get('payment_status') == 'paid':
                continue
            
            inv_total = Decimal(str(inv.get('total', 0)))
            inv_balance = Decimal(str(inv.get('balance_due', inv_total)))
            
            if inv_balance <= 0:
                continue
            
            score = 0
            reason_parts = []
            
            # Amount match
            diff = abs(txn_amount - inv_balance)
            if diff == 0:
                score += 100
                reason_parts.append('exact amount')
            elif diff / inv_balance < Decimal('0.01'):
                score += 80
                reason_parts.append('amount ~99%')
            elif diff / inv_balance < Decimal('0.05'):
                score += 50
                reason_parts.append('amount ~95%')
            
            # Date proximity
            try:
                due_date = datetime.strptime(inv.get('due_date', '')[:10], '%Y-%m-%d')
                days_diff = abs((txn_date_obj - due_date).days)
                if days_diff <= 7:
                    score += 20
                    reason_parts.append('within 7 days')
                elif days_diff <= 30:
                    score += 10
                    reason_parts.append('within 30 days')
            except Exception:
                pass
            
            # Reference match
            inv_number = inv.get('invoice_number', '').lower()
            contact_name = inv.get('contact_name', '').lower()
            
            if inv_number and inv_number in txn_desc:
                score += 30
                reason_parts.append(f'invoice# in desc')
            if inv_number and inv_number in txn_ref:
                score += 30
                reason_parts.append(f'invoice# in ref')
            if contact_name and contact_name in txn_desc:
                score += 20
                reason_parts.append('contact in desc')
            
            if score >= 50:
                candidates.append({
                    'type': 'invoice',
                    'target_id': inv['id'],
                    'score': score,
                    'suggested_action': 'create_payment',
                    'suggested_amount': float(min(txn_amount, inv_balance)),
                    'reason': ', '.join(reason_parts),
                    'invoice_number': inv.get('invoice_number', ''),
                    'contact_name': inv.get('contact_name', ''),
                    'invoice_total': float(inv_total),
                    'balance_due': float(inv_balance)
                })
    
    # Match bills (for debit transactions)
    elif txn_type == 'debit':
        bill_repo = BillRepository(org_id)
        bills, _ = bill_repo.list(limit=1000)
        
        for bill in bills:
            if bill.get('status') == 'paid' or bill.get('payment_status') == 'paid':
                continue
            
            bill_total = Decimal(str(bill.get('total', 0)))
            bill_balance = Decimal(str(bill.get('balance_due', bill_total)))
            
            if bill_balance <= 0:
                continue
            
            score = 0
            reason_parts = []
            
            # Amount match
            diff = abs(txn_amount - bill_balance)
            if diff == 0:
                score += 100
                reason_parts.append('exact amount')
            elif diff / bill_balance < Decimal('0.01'):
                score += 80
                reason_parts.append('amount ~99%')
            elif diff / bill_balance < Decimal('0.05'):
                score += 50
                reason_parts.append('amount ~95%')
            
            # Date proximity
            try:
                due_date = datetime.strptime(bill.get('due_date', '')[:10], '%Y-%m-%d')
                days_diff = abs((txn_date_obj - due_date).days)
                if days_diff <= 7:
                    score += 20
                    reason_parts.append('within 7 days')
                elif days_diff <= 30:
                    score += 10
                    reason_parts.append('within 30 days')
            except Exception:
                pass
            
            # Reference match
            bill_number = bill.get('bill_number', '').lower()
            vendor_name = bill.get('vendor_name', '').lower()
            
            if bill_number and bill_number in txn_desc:
                score += 30
                reason_parts.append(f'bill# in desc')
            if bill_number and bill_number in txn_ref:
                score += 30
                reason_parts.append(f'bill# in ref')
            if vendor_name and vendor_name in txn_desc:
                score += 20
                reason_parts.append('vendor in desc')
            
            if score >= 50:
                candidates.append({
                    'type': 'bill',
                    'target_id': bill['id'],
                    'score': score,
                    'suggested_action': 'create_payment',
                    'suggested_amount': float(min(txn_amount, bill_balance)),
                    'reason': ', '.join(reason_parts),
                    'bill_number': bill.get('bill_number', ''),
                    'vendor_name': bill.get('vendor_name', ''),
                    'bill_total': float(bill_total),
                    'balance_due': float(bill_balance)
                })
    
    # Apply bank rules
    rule_repo = BankRuleRepository(org_id)
    rules, _ = rule_repo.list(limit=500)
    
    for rule in rules:
        if not rule.get('is_active', True):
            continue
        
        condition_field = rule.get('condition_field', 'description')
        condition_op = rule.get('condition_operator', 'contains')
        condition_value = str(rule.get('condition_value', '')).lower()
        
        # Get field value from transaction
        if condition_field == 'description':
            field_value = txn_desc
        elif condition_field == 'reference':
            field_value = txn_ref
        elif condition_field == 'amount':
            field_value = str(txn_amount)
        else:
            field_value = ''
        
        # Check condition
        matched = False
        if condition_op == 'contains' and condition_value in field_value:
            matched = True
        elif condition_op == 'equals' and field_value == condition_value:
            matched = True
        elif condition_op == 'starts_with' and field_value.startswith(condition_value):
            matched = True
        elif condition_op == 'greater_than':
            try:
                if Decimal(field_value) > Decimal(condition_value):
                    matched = True
            except Exception:
                pass
        elif condition_op == 'less_than':
            try:
                if Decimal(field_value) < Decimal(condition_value):
                    matched = True
            except Exception:
                pass
        
        if matched:
            action_type = rule.get('action_type', 'categorize')
            action_value = rule.get('action_value', '')
            
            score = 70  # Rules get moderate score
            reason = f"Rule: {rule.get('rule_name', 'unnamed')}"
            
            if action_type == 'categorize' or action_type == 'auto_match':
                candidates.append({
                    'type': 'rule',
                    'target_id': rule['id'],
                    'score': score,
                    'suggested_action': 'gl_only',
                    'suggested_amount': float(txn_amount),
                    'reason': reason,
                    'rule_name': rule.get('rule_name', ''),
                    'target_account': action_value
                })
    
    # Sort by score descending and return top 5
    candidates.sort(key=lambda x: x['score'], reverse=True)
    return candidates[:5]


def auto_match(org_id: str, bank_account_id: str, threshold: int = 90, dry_run: bool = False) -> dict:
    """
    Auto-match all unmatched transactions of an account.
    
    Returns: {
        'matched': int,
        'ambiguous': int,
        'no_match': int,
        'total': int,
        'details': list[dict]
    }
    """
    from app.firestore.banking import BankTransactionRepository
    
    repo = BankTransactionRepository(org_id)
    filters = [
        {'field': 'bank_account_id', 'op': '==', 'value': bank_account_id},
        {'field': 'matched', 'op': '==', 'value': False}
    ]
    unmatched, _ = repo.list(filters=filters, limit=1000)
    
    matched_count = 0
    ambiguous_count = 0
    no_match_count = 0
    details = []
    
    for txn in unmatched:
        candidates = find_match_candidates(org_id, txn)
        
        if not candidates:
            no_match_count += 1
            details.append({
                'transaction_id': txn['id'],
                'status': 'no_match',
                'reason': 'No candidates found'
            })
            continue
        
        top = candidates[0]
        
        # Check if top score >= threshold
        if top['score'] < threshold:
            no_match_count += 1
            details.append({
                'transaction_id': txn['id'],
                'status': 'no_match',
                'reason': f"Top score {top['score']} < threshold {threshold}"
            })
            continue
        
        # Check for ambiguity (multiple candidates with similar scores)
        if len(candidates) > 1 and candidates[1]['score'] >= threshold - 10:
            ambiguous_count += 1
            details.append({
                'transaction_id': txn['id'],
                'status': 'ambiguous',
                'reason': f"Multiple candidates with high scores",
                'candidates': candidates[:3]
            })
            continue
        
        # Auto-match
        if not dry_run:
            apply_match(org_id, txn['id'], top['type'], top['target_id'], top['suggested_action'])
        
        matched_count += 1
        details.append({
            'transaction_id': txn['id'],
            'status': 'matched',
            'match_type': top['type'],
            'target_id': top['target_id'],
            'score': top['score'],
            'reason': top['reason']
        })
    
    return {
        'matched': matched_count,
        'ambiguous': ambiguous_count,
        'no_match': no_match_count,
        'total': len(unmatched),
        'details': details
    }


def apply_match(org_id: str, txn_id: str, match_type: str, target_id: str, action: str, notes: Optional[str] = None) -> dict:
    """
    Apply a match between bank transaction and target document.
    
    action: 'link'|'create_payment'|'gl_only'
    """
    from app.firestore.banking import BankTransactionRepository
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.bills import BillRepository
    
    repo = BankTransactionRepository(org_id)
    txn = repo.get(txn_id)
    if not txn:
        raise ValueError(f"Transaction {txn_id} not found")
    
    update_data = {
        'matched': True,
        'matched_document_id': target_id,
        'matched_document_type': match_type,
        'updated_at': datetime.utcnow().isoformat()
    }
    
    if notes:
        update_data['match_notes'] = notes
    
    repo.update(txn_id, update_data)
    
    result = {
        'transaction_id': txn_id,
        'match_type': match_type,
        'target_id': target_id,
        'action': action
    }
    
    # Create payment if requested
    if action == 'create_payment':
        if match_type == 'invoice':
            inv_repo = InvoiceRepository(org_id)
            invoice = inv_repo.get(target_id)
            if invoice:
                payment_amount = min(
                    float(txn.get('amount', 0)),
                    float(invoice.get('balance_due', invoice.get('total', 0)))
                )
                # Update invoice payment status
                inv_repo.update(target_id, {
                    'payment_status': 'paid' if payment_amount >= float(invoice.get('balance_due', 0)) else 'partial',
                    'paid_amount': float(invoice.get('paid_amount', 0)) + payment_amount,
                    'balance_due': float(invoice.get('balance_due', invoice.get('total', 0))) - payment_amount,
                    'updated_at': datetime.utcnow().isoformat()
                })
                result['payment_created'] = True
        
        elif match_type == 'bill':
            bill_repo = BillRepository(org_id)
            bill = bill_repo.get(target_id)
            if bill:
                payment_amount = min(
                    float(txn.get('amount', 0)),
                    float(bill.get('balance_due', bill.get('total', 0)))
                )
                # Update bill payment status
                bill_repo.update(target_id, {
                    'payment_status': 'paid' if payment_amount >= float(bill.get('balance_due', 0)) else 'partial',
                    'paid_amount': float(bill.get('paid_amount', 0)) + payment_amount,
                    'balance_due': float(bill.get('balance_due', bill.get('total', 0))) - payment_amount,
                    'updated_at': datetime.utcnow().isoformat()
                })
                result['payment_created'] = True
    
    return result
