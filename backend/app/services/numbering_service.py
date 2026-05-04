"""Numbering service for automatic document number generation
Integrates per-branch numbering sequences with fallback to legacy timestamp-based numbers.
"""
import time
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


def get_next_number(
    org_id: str,
    branch_id: Optional[str],
    doc_type: str,
    fallback_prefix: str
) -> str:
    """
    Returns next document number for a (branch, doc_type) using NumberingSequenceRepository.
    
    Args:
        org_id: Organization ID
        branch_id: Branch ID (can be None for global sequences)
        doc_type: Document type ('invoice', 'sales_order', 'purchase_order', etc.)
        fallback_prefix: Prefix to use if no sequence configured (e.g., "INV", "SO")
    
    Returns:
        Formatted document number (e.g., "INV-BR1-2026-000123" or "INV-1714838400")
    
    Behavior:
        - If numbering sequence exists for (branch_id, doc_type): uses atomic increment
        - If no sequence configured: falls back to legacy timestamp-based number
        - On any error: falls back to legacy timestamp-based number (never blocks document creation)
    
    Format substitution:
        - {prefix}: sequence prefix
        - {branch_code}: branch code from branch document
        - {year}: current UTC year
        - {seq}: padded sequence number
    """
    try:
        from app.firestore.numbering import NumberingSequenceRepository
        from app.firestore.system import BranchRepository
        
        # Try to get configured sequence
        numbering_repo = NumberingSequenceRepository(org_id)
        
        # If no branch_id, use a sentinel value for global sequences
        lookup_branch_id = branch_id if branch_id else "_global"
        
        # Check if sequence exists
        existing_seq = numbering_repo.get_by_branch_and_type(lookup_branch_id, doc_type)
        
        if not existing_seq:
            # No sequence configured — fall back to legacy timestamp-based
            logger.info(
                f"No numbering sequence for org={org_id}, branch={branch_id}, doc_type={doc_type}. "
                f"Using legacy fallback."
            )
            return _legacy_number(fallback_prefix)
        
        # Sequence exists — use atomic increment
        # The get_next_number method handles format substitution internally
        try:
            number = numbering_repo.get_next_number(lookup_branch_id, doc_type)
            logger.info(
                f"Generated number '{number}' for org={org_id}, branch={branch_id}, doc_type={doc_type}"
            )
            return number
        except Exception as e:
            logger.warning(
                f"Failed to get next number from sequence: {e}. Using legacy fallback.",
                exc_info=True
            )
            return _legacy_number(fallback_prefix)
    
    except Exception as e:
        # Any unexpected error — fall back to legacy
        logger.error(
            f"Unexpected error in get_next_number: {e}. Using legacy fallback.",
            exc_info=True
        )
        return _legacy_number(fallback_prefix)


def _legacy_number(prefix: str) -> str:
    """Generate legacy timestamp-based document number"""
    timestamp = int(time.time())
    return f"{prefix}-{timestamp}"


def preview_next_number(
    org_id: str,
    branch_id: Optional[str],
    doc_type: str,
    fallback_prefix: str
) -> dict:
    """
    Preview what the next document number will be WITHOUT incrementing the sequence.
    
    Returns:
        {
            "next_number": str,
            "uses_sequence": bool,
            "sequence_id": str | None,
            "format": str | None
        }
    """
    try:
        from app.firestore.numbering import NumberingSequenceRepository
        from app.firestore.system import BranchRepository
        
        numbering_repo = NumberingSequenceRepository(org_id)
        lookup_branch_id = branch_id if branch_id else "_global"
        
        # Check if sequence exists
        seq = numbering_repo.get_by_branch_and_type(lookup_branch_id, doc_type)
        
        if not seq:
            # No sequence — return what the legacy fallback would be
            return {
                "next_number": _legacy_number(fallback_prefix),
                "uses_sequence": False,
                "sequence_id": None,
                "format": None
            }
        
        # Sequence exists — compute what the next number WOULD be
        current_value = int(seq.get("next_value", 1))
        prefix = seq.get("prefix", "DOC")
        padding = int(seq.get("padding", 6))
        format_template = seq.get("format", "{prefix}-{seq}")
        
        # Get branch code if needed
        branch_code = ""
        if "{branch_code}" in format_template and branch_id:
            branch_repo = BranchRepository(org_id)
            branch = branch_repo.get(branch_id)
            branch_code = branch.get("code", "BR") if branch else "BR"
        
        # Format the preview number
        year = datetime.utcnow().year
        seq_str = str(current_value).zfill(padding)
        
        next_number = format_template.format(
            prefix=prefix,
            branch_code=branch_code,
            year=year,
            seq=seq_str
        )
        
        return {
            "next_number": next_number,
            "uses_sequence": True,
            "sequence_id": seq.get("id"),
            "format": format_template
        }
    
    except Exception as e:
        logger.error(f"Error in preview_next_number: {e}", exc_info=True)
        return {
            "next_number": _legacy_number(fallback_prefix),
            "uses_sequence": False,
            "sequence_id": None,
            "format": None
        }
