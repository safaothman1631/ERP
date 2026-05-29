from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class AccountWriteModel(WriteModelBase):
    name: Optional[str] = None
    code: Optional[str] = None
    account_type: Optional[str] = None
    is_active: Optional[bool] = True
    parent_id: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
