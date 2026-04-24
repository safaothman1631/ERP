"""CRM Firestore repositories: leads, opportunities, stages, activities."""
from .base import BaseRepository


class CRMLeadRepository(BaseRepository):
    """Sales leads (top of funnel)."""
    collection_name = "crm_leads"


class CRMOpportunityRepository(BaseRepository):
    """Qualified opportunities (mid funnel)."""
    collection_name = "crm_opportunities"


class CRMStageRepository(BaseRepository):
    """Pipeline stages, ordered by `sequence`."""
    collection_name = "crm_stages"


class CRMActivityRepository(BaseRepository):
    """Activities (calls, meetings, emails) attached to a lead/opportunity."""
    collection_name = "crm_activities"


class CRMLostReasonRepository(BaseRepository):
    """Configurable reasons used when marking an opportunity as lost (FIX-56)."""
    collection_name = "crm_lost_reasons"


class CRMSalesTeamRepository(BaseRepository):
    """Sales teams (FIX-131): groups of users with a manager + optional target."""
    collection_name = "crm_sales_teams"
