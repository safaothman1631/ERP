from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class ContactWriteModel(WriteModelBase):
    display_name: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_type: Optional[str] = Field(default=None, pattern=r"^(customer|vendor|both)?$")
    tax_id: Optional[str] = None
    national_id: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
    is_active: Optional[bool] = True
    display_name_lower: Optional[str] = None
    schema_version: int = 2
