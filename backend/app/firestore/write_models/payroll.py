from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class PayrollRunWriteModel(WriteModelBase):
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    status: Optional[str] = None
    total_gross: Optional[float] = Field(default=None, ge=0)
    total_net: Optional[float] = Field(default=None, ge=0)
