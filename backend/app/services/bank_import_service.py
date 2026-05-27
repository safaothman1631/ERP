"""Bank statement import service — CSV, OFX, MT940 parsers"""
import re
from datetime import datetime
from decimal import Decimal
from typing import Optional

from app.services.report_streams import collect_stream


def detect_format(filename: str, content: bytes) -> str:
    """Detect file format from filename and content"""
    lower = filename.lower()
    if lower.endswith('.csv'):
        return 'csv'
    if lower.endswith('.ofx') or lower.endswith('.qfx'):
        return 'ofx'
    if lower.endswith('.sta') or lower.endswith('.mt940'):
        return 'mt940'
    
    # Content-based detection
    content_str = content[:1000].decode('utf-8', errors='ignore').lower()
    if '<ofx>' in content_str or '<ofxheader>' in content_str:
        return 'ofx'
    if ':20:' in content_str or ':25:' in content_str:
        return 'mt940'
    
    return 'csv'


def parse_csv_statement(file_bytes: bytes, mapping: dict) -> list[dict]:
    """
    Parse CSV statement with flexible column mapping.
    
    mapping = {
        'date_col': 'Date',
        'amount_col': 'Amount', 
        'description_col': 'Description',
        'reference_col': 'Reference',  # optional
        'sign_col': 'Type',  # optional
        'credit_label': 'CR',  # optional
        'date_format': '%Y-%m-%d'  # optional
    }
    
    Returns list of {date, amount, description, reference, debit_or_credit}
    """
    import csv
    import io
    
    date_col = mapping.get('date_col', 'Date')
    amount_col = mapping.get('amount_col', 'Amount')
    desc_col = mapping.get('description_col', 'Description')
    ref_col = mapping.get('reference_col', 'Reference')
    sign_col = mapping.get('sign_col')
    credit_label = mapping.get('credit_label', 'CR')
    date_format = mapping.get('date_format', '%Y-%m-%d')
    
    text = file_bytes.decode('utf-8', errors='ignore')
    reader = csv.DictReader(io.StringIO(text))
    
    transactions = []
    for row in reader:
        date_str = row.get(date_col, '').strip()
        amount_str = row.get(amount_col, '').strip().replace(',', '').replace(' ', '')
        description = row.get(desc_col, '').strip()
        reference = row.get(ref_col, '').strip() if ref_col else ''
        
        if not date_str or not amount_str:
            continue
        
        # Parse date
        try:
            parsed_date = datetime.strptime(date_str, date_format)
            date_iso = parsed_date.date().isoformat()
        except ValueError:
            # Try multiple formats
            for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y']:
                try:
                    parsed_date = datetime.strptime(date_str, fmt)
                    date_iso = parsed_date.date().isoformat()
                    break
                except ValueError:
                    continue
            else:
                continue
        
        # Parse amount and sign
        try:
            amount = abs(Decimal(amount_str))
        except Exception:
            continue
        
        # Determine debit or credit
        if sign_col:
            sign_value = row.get(sign_col, '').strip()
            debit_or_credit = 'credit' if sign_value == credit_label else 'debit'
        else:
            # If no sign column, assume positive = credit, negative = debit
            debit_or_credit = 'credit' if float(amount_str) >= 0 else 'debit'
        
        transactions.append({
            'date': date_iso,
            'amount': float(amount),
            'description': description,
            'reference': reference,
            'debit_or_credit': debit_or_credit
        })
    
    return transactions


def parse_ofx_statement(file_bytes: bytes) -> list[dict]:
    """
    Minimal OFX parser using regex.
    Extracts <STMTTRN> blocks.
    """
    text = file_bytes.decode('utf-8', errors='ignore')
    
    # Find all <STMTTRN>...</STMTTRN> blocks
    pattern = r'<STMTTRN>(.*?)</STMTTRN>'
    blocks = re.findall(pattern, text, re.DOTALL)
    
    transactions = []
    for block in blocks:
        # Extract fields
        dtposted = re.search(r'<DTPOSTED>(\d{8})', block)
        trnamt = re.search(r'<TRNAMT>([-\d.]+)', block)
        name_match = re.search(r'<NAME>([^<]+)', block)
        memo_match = re.search(r'<MEMO>([^<]+)', block)
        fitid = re.search(r'<FITID>([^<]+)', block)
        
        if not (dtposted and trnamt):
            continue
        
        # Parse date (YYYYMMDD format)
        date_str = dtposted.group(1)
        try:
            parsed_date = datetime.strptime(date_str, '%Y%m%d')
            date_iso = parsed_date.date().isoformat()
        except ValueError:
            continue
        
        # Parse amount
        try:
            amount = Decimal(trnamt.group(1))
        except Exception:
            continue
        
        description = name_match.group(1).strip() if name_match else ''
        if memo_match:
            description += ' ' + memo_match.group(1).strip()
        description = description.strip()
        
        reference = fitid.group(1).strip() if fitid else ''
        
        debit_or_credit = 'credit' if amount >= 0 else 'debit'
        
        transactions.append({
            'date': date_iso,
            'amount': float(abs(amount)),
            'description': description,
            'reference': reference,
            'debit_or_credit': debit_or_credit
        })
    
    return transactions


def parse_mt940_statement(file_bytes: bytes) -> list[dict]:
    """
    Minimal MT940 parser.
    :61: = transaction line
    :86: = description line
    """
    text = file_bytes.decode('utf-8', errors='ignore')
    lines = text.split('\n')
    
    transactions = []
    current_txn: Optional[dict] = None
    
    for line in lines:
        line = line.strip()
        
        if line.startswith(':61:'):
            # Save previous transaction
            if current_txn:
                transactions.append(current_txn)
            
            # Parse :61: line
            # Format: :61:YYMMDD[MMDD]CD[S]Amount[N]Ref
            # Example: :61:2601011201D500,00NCHG001
            match = re.match(r':61:(\d{6}).*?([CD])([\d,\.]+)', line)
            if match:
                date_str = match.group(1)
                debit_credit = match.group(2)
                amount_str = match.group(3).replace(',', '.')
                
                # Parse date (YYMMDD)
                try:
                    year = int('20' + date_str[:2])
                    month = int(date_str[2:4])
                    day = int(date_str[4:6])
                    parsed_date = datetime(year, month, day)
                    date_iso = parsed_date.date().isoformat()
                except ValueError:
                    continue
                
                try:
                    amount = abs(Decimal(amount_str))
                except Exception:
                    continue
                
                current_txn = {
                    'date': date_iso,
                    'amount': float(amount),
                    'description': '',
                    'reference': '',
                    'debit_or_credit': 'credit' if debit_credit == 'C' else 'debit'
                }
        
        elif line.startswith(':86:') and current_txn:
            # Description line
            desc = line[4:].strip()
            if current_txn['description']:
                current_txn['description'] += ' ' + desc
            else:
                current_txn['description'] = desc
    
    # Save last transaction
    if current_txn:
        transactions.append(current_txn)
    
    return transactions


def dedupe_transactions(org_id: str, bank_account_id: str, txns: list[dict]) -> list[dict]:
    """
    Remove duplicate transactions by checking against existing records.
    Matches on (date, amount, reference) or external_id.
    """
    from app.firestore.banking import BankTransactionRepository
    
    repo = BankTransactionRepository(org_id)
    existing = [
        txn for txn in collect_stream(repo, max_docs=10000)
        if txn.get("bank_account_id") == bank_account_id
    ]
    
    # Build set of existing transaction signatures
    existing_sigs = set()
    for txn in existing:
        sig = (
            txn.get('date', ''),
            str(txn.get('amount', '')),
            txn.get('reference', '')
        )
        existing_sigs.add(sig)
        
        if txn.get('external_id'):
            existing_sigs.add(txn['external_id'])
    
    # Filter out duplicates
    unique = []
    for txn in txns:
        sig = (txn['date'], str(txn['amount']), txn.get('reference', ''))
        ref = txn.get('reference', '')
        
        if sig not in existing_sigs and ref not in existing_sigs:
            unique.append(txn)
    
    return unique
