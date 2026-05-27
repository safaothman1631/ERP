"""Payroll repositories."""
from app.firestore.base import BaseRepository
from app.firestore.encrypted_mixin import EncryptedFieldsMixin  # noqa: F401 — used by PayrollRunRepository
from app.firestore.write_models import PayrollRunWriteModel


class PayrollRunRepository(EncryptedFieldsMixin, BaseRepository):
    collection_name = "payroll_runs"
    WRITE_MODEL = PayrollRunWriteModel
    _ENCRYPTED_FIELDS = ("bank_account",)


class PayslipRepository(EncryptedFieldsMixin, BaseRepository):
    collection_name = "payslips"
    _ENCRYPTED_FIELDS = ("gross", "net", "net_salary", "basic_salary")


class SalaryRuleRepository(BaseRepository):
    collection_name = "salary_rules"
