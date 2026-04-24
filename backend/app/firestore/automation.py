"""Sprint 20: Automation Firestore repos."""
from app.firestore.base import BaseRepository


class AutomatedActionRepository(BaseRepository):
    """Trigger-driven automated actions."""
    collection_name = "automated_actions"


class ScheduledJobRepository(BaseRepository):
    """Cron-style scheduled jobs."""
    collection_name = "scheduled_jobs"


class ServerActionRepository(BaseRepository):
    """Manually invokable named server actions."""
    collection_name = "server_actions"


class AutomationLogRepository(BaseRepository):
    """Audit trail of automation runs."""
    collection_name = "automation_logs"
