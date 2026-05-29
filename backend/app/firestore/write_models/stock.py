from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class StockMovementWriteModel(WriteModelBase):
    item_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    quantity: Optional[float] = None
    movement_type: Optional[str] = None
    date: Optional[str] = None
    reference: Optional[str] = None


class StockTransferWriteModel(WriteModelBase):
    from_warehouse_id: Optional[str] = None
    to_warehouse_id: Optional[str] = None
    status: Optional[str] = None
    date: Optional[str] = None
