from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class JournalEntryWriteModel(WriteModelBase):
    date: Optional[str] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    status: Optional[str] = None
    total_debit: Optional[float] = Field(default=None, ge=0)
    total_credit: Optional[float] = Field(default=None, ge=0)
