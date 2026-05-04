"""Subscription billing repositories — plans, subscriptions, dunning."""
from __future__ import annotations
from .base import BaseRepository


class SubscriptionPlanRepository(BaseRepository):
    """Repository for subscription plans."""
    collection_name = "subscription_plans"
    
    def list_active(self):
        """List all active plans."""
        return self.list(
            filters=[{"field": "active", "op": "==", "value": True}],
            order_by="price",
            limit=500
        )


class SubscriptionRepository(BaseRepository):
    """Repository for customer subscriptions."""
    collection_name = "subscriptions"
    
    def list_by_status(self, status: str):
        """List subscriptions by status."""
        return self.list(
            filters=[{"field": "status", "op": "==", "value": status}],
            order_by="next_invoice_date",
            limit=1000
        )
    
    def list_by_contact(self, contact_id: str):
        """List subscriptions for a contact."""
        return self.list(
            filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
            order_by="start_date",
            order_dir="DESCENDING",
            limit=100
        )
    
    def list_due_for_renewal(self, before_date: str):
        """List subscriptions due for renewal before a given date."""
        return self.list(
            filters=[
                {"field": "status", "op": "in", "value": ["active", "trial"]},
                {"field": "next_invoice_date", "op": "<=", "value": before_date}
            ],
            order_by="next_invoice_date",
            limit=500
        )
    
    def list_past_due(self):
        """List past-due subscriptions for dunning."""
        return self.list(
            filters=[{"field": "status", "op": "==", "value": "past_due"}],
            order_by="current_period_end",
            limit=1000
        )


class DunningAttemptRepository(BaseRepository):
    """Repository for dunning attempts."""
    collection_name = "dunning_attempts"
    
    def list_by_subscription(self, subscription_id: str):
        """List dunning attempts for a subscription."""
        return self.list(
            filters=[{"field": "subscription_id", "op": "==", "value": subscription_id}],
            order_by="sent_at",
            order_dir="DESCENDING",
            limit=100
        )
    
    def get_last_attempt(self, subscription_id: str):
        """Get the most recent dunning attempt for a subscription."""
        items, _ = self.list_by_subscription(subscription_id)
        return items[0] if items else None
