# Firestore repository for scheduled reports
from app.firestore.base import BaseRepository
from datetime import datetime, timedelta


class ScheduledReportRepository(BaseRepository):
    """Repository for scheduled report configurations"""
    collection_name = "scheduled_reports"

    def get_active_reports(self):
        """Get all active scheduled reports for this org"""
        filters = {"org_id": self.org_id, "active": True}
        items, _ = self.list(filters=filters, order_by="created_at", limit=500)
        return items

    def get_due_reports(self):
        """Get reports that are due to run (next_run_at <= now)"""
        now = datetime.utcnow()
        active = self.get_active_reports()
        due = []
        for report in active:
            next_run = report.get("next_run_at")
            if next_run:
                if isinstance(next_run, str):
                    try:
                        next_run = datetime.fromisoformat(next_run.replace("Z", ""))
                    except Exception:
                        continue
                if next_run <= now:
                    due.append(report)
        return due

    def calculate_next_run(self, frequency: str, day_of_week: int = None, 
                          day_of_month: int = None, hour: int = 9):
        """Calculate next run time based on frequency"""
        now = datetime.utcnow()
        if frequency == "daily":
            next_run = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
            return next_run
        elif frequency == "weekly":
            # day_of_week: 0=Monday, 6=Sunday
            target_day = day_of_week if day_of_week is not None else 0
            days_ahead = (target_day - now.weekday()) % 7
            if days_ahead == 0 and now.hour >= hour:
                days_ahead = 7
            next_run = now + timedelta(days=days_ahead)
            return next_run.replace(hour=hour, minute=0, second=0, microsecond=0)
        elif frequency == "monthly":
            # day_of_month: 1-28 (avoid complexity of 29-31)
            target_day = day_of_month if day_of_month is not None else 1
            target_day = max(1, min(28, target_day))
            next_run = now.replace(day=target_day, hour=hour, minute=0, second=0, microsecond=0)
            if next_run <= now:
                # Move to next month
                if now.month == 12:
                    next_run = next_run.replace(year=now.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=now.month + 1)
            return next_run
        return None
