"""POS Firestore repositories for Sprint 6.1"""
from app.firestore.base import BaseRepository
from app.firestore.write_models import POSOrderWriteModel, POSSessionWriteModel


class POSConfigRepository(BaseRepository):
    """POS configuration repository"""
    collection_name = "pos_configs"


class POSPaymentMethodRepository(BaseRepository):
    """POS payment methods repository"""
    collection_name = "pos_payment_methods"


class POSSessionRepository(BaseRepository):
    """POS sessions repository"""
    collection_name = "pos_sessions"
    WRITE_MODEL = POSSessionWriteModel


class POSOrderRepository(BaseRepository):
    """POS orders repository"""
    collection_name = "pos_orders"
    WRITE_MODEL = POSOrderWriteModel


class POSOrderLineRepository(BaseRepository):
    """POS order lines repository"""
    collection_name = "pos_order_lines"


class POSPaymentRepository(BaseRepository):
    """POS payments repository"""
    collection_name = "pos_payments"


class POSCashMoveRepository(BaseRepository):
    """POS cash moves repository (cash in/out)"""
    collection_name = "pos_cash_moves"


class POSCategoryRepository(BaseRepository):
    """POS categories repository - Sprint 6.2"""
    collection_name = "pos_categories"


class POSComboRepository(BaseRepository):
    """POS combos repository - Sprint 6.2"""
    collection_name = "pos_combos"


class POSPricelistRepository(BaseRepository):
    """POS pricelists repository - Sprint 6.2"""
    collection_name = "pos_pricelists"


class POSPresetRepository(BaseRepository):
    """POS presets repository - Sprint 6.2"""
    collection_name = "pos_presets"


class POSFloorRepository(BaseRepository):
    """POS floors repository - Sprint 6.4 Restaurant"""
    collection_name = "pos_floors"


class POSTableRepository(BaseRepository):
    """POS tables repository - Sprint 6.4 Restaurant"""
    collection_name = "pos_tables"


class POSPreparationDisplayRepository(BaseRepository):
    """POS preparation displays repository - Sprint 6.4 Restaurant (KDS)"""
    collection_name = "pos_preparation_displays"


class POSPreparationOrderRepository(BaseRepository):
    """POS preparation orders repository - Sprint 6.4 Restaurant (KDS)"""
    collection_name = "pos_preparation_orders"


class POSEmployeeRepository(BaseRepository):
    """POS employees repository - Sprint 6.5"""
    collection_name = "pos_employees"


class POSSelfOrderRepository(BaseRepository):
    """POS self-orders repository - Sprint 6.5"""
    collection_name = "pos_self_orders"


class POSLoyaltyProgramRepository(BaseRepository):
    """POS loyalty programs repository - Sprint 6.5"""
    collection_name = "pos_loyalty_programs"


class POSLoyaltyCardRepository(BaseRepository):
    """POS loyalty cards repository - Sprint 6.5"""
    collection_name = "pos_loyalty_cards"


class POSGiftCardRepository(BaseRepository):
    """POS gift cards repository - Sprint 6.5"""
    collection_name = "pos_gift_cards"


class POSCustomerDisplayRepository(BaseRepository):
    """POS customer displays repository - Sprint 6.6"""
    collection_name = "pos_customer_displays"


class POSElectronicLabelRepository(BaseRepository):
    """POS electronic labels repository - Sprint 6.6"""
    collection_name = "pos_electronic_labels"


class POSReceiptLogRepository(BaseRepository):
    """POS receipt logs repository - Sprint 6.6"""
    collection_name = "pos_receipts_log"
