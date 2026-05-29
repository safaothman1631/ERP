"""HR repositories: departments, positions, employees, contracts, attendance, time off."""
from app.firestore.base import BaseRepository
from app.firestore.encrypted_mixin import EncryptedFieldsMixin


class HRDepartmentRepository(BaseRepository):
    collection_name = "hr_departments"


class HRPositionRepository(BaseRepository):
    collection_name = "hr_positions"


class HREmployeeRepository(EncryptedFieldsMixin, BaseRepository):
    collection_name = "hr_employees"
    _ENCRYPTED_FIELDS = (
        "national_id",
        "passport_no",
        "bank_account",
        "social_security_number",
        "phone",
        "emergency_phone",
        "address",
    )


class HRContractRepository(EncryptedFieldsMixin, BaseRepository):
    collection_name = "hr_contracts"
    _ENCRYPTED_FIELDS = ("wage",)


class HRAttendanceRepository(BaseRepository):
    collection_name = "hr_attendance"


class HRTimeOffRepository(BaseRepository):
    collection_name = "hr_time_off"


class HRLeaveTypeRepository(BaseRepository):
    collection_name = "hr_leave_types"


class HRLeaveAllocationRepository(BaseRepository):
    """Per-employee, per-leave-type extra allocation in days (FIX-67)."""
    collection_name = "hr_leave_allocations"
