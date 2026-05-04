"""Sprint 23: Marketing repositories."""
from app.firestore.base import BaseRepository


class MarketingCampaignRepository(BaseRepository):
    collection_name = "marketing_campaigns"


class MarketingAudienceRepository(BaseRepository):
    collection_name = "marketing_audiences"


class MarketingCampaignSendRepository(BaseRepository):
    collection_name = "marketing_campaign_sends"


class SmsCampaignRepository(BaseRepository):
    collection_name = "sms_campaigns"


class AutomationFlowRepository(BaseRepository):
    collection_name = "automation_flows"
