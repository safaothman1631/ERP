"""Payroll repositories."""
from app.firestore.base import BaseRepository


class PayrollRunRepository(BaseRepository):
    collection_name = "payroll_runs"


class PayslipRepository(BaseRepository):
    collection_name = "payslips"


class SalaryRuleRepository(BaseRepository):
    collection_name = "salary_rules"
