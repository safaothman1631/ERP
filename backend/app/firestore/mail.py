"""Sprint 22: Mail repositories."""
from app.firestore.base import BaseRepository


class MailTemplateRepository(BaseRepository):
    collection_name = "mail_templates"


class OutboundEmailRepository(BaseRepository):
    collection_name = "outbound_emails"
