"""HR repositories: departments, positions, employees, contracts, attendance, time off."""
from app.firestore.base import BaseRepository


class HRDepartmentRepository(BaseRepository):
    collection_name = "hr_departments"


class HRPositionRepository(BaseRepository):
    collection_name = "hr_positions"


class HREmployeeRepository(BaseRepository):
    collection_name = "hr_employees"


class HRContractRepository(BaseRepository):
    collection_name = "hr_contracts"


class HRAttendanceRepository(BaseRepository):
    collection_name = "hr_attendance"


class HRTimeOffRepository(BaseRepository):
    collection_name = "hr_time_off"


class HRLeaveTypeRepository(BaseRepository):
    collection_name = "hr_leave_types"


class HRLeaveAllocationRepository(BaseRepository):
    """Per-employee, per-leave-type extra allocation in days (FIX-67)."""
    collection_name = "hr_leave_allocations"
