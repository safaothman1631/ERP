"""WhatsApp message log + template repositories."""
from .base import BaseRepository


class WhatsAppMessageRepository(BaseRepository):
    """Outbound/inbound WhatsApp messages with status."""
    collection_name = "whatsapp_messages"


class WhatsAppTemplateRepository(BaseRepository):
    """Reusable message templates with placeholder syntax {{name}}."""
    collection_name = "whatsapp_templates"
