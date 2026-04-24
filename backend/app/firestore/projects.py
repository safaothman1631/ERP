# Project repositories
from .base import BaseRepository

class ProjectRepository(BaseRepository):
    """Repository for projects"""
    collection_name = "projects"
    
    def get_with_details(self, doc_id):
        """Get project with tasks and time entries"""
        p = self.get(doc_id)
        if p:
            p["tasks"] = self.get_lines(doc_id, "tasks")
            p["time_entries"] = self.get_lines(doc_id, "time_entries")
        return p


class ProjectTaskRepository(BaseRepository):
    """Repository for project tasks"""
    collection_name = "project_tasks"


class TimeEntryRepository(BaseRepository):
    """Repository for time entries"""
    collection_name = "time_entries"
