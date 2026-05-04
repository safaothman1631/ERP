#!/usr/bin/env python3
"""Add marketing i18n keys to ku.json and en.json."""
import json
import sys
from pathlib import Path

# Marketing keys to add
marketing_keys_ku = {
    "marketing": {
        "marketing": "مارکێتینگ",
        "dashboard": "داشبۆردی مارکێتینگ",
        "dashboard_subtitle": "کەمپەینەکان، بینەران، و ئاماری مارکێتینگ",
        "email_campaigns": "کەمپەینەکانی ئیمەیڵ",
        "email_campaigns_subtitle": "دروستکردن و ناردنی کەمپەینی ئیمەیڵ",
        "sms_campaigns": "کەمپەینەکانی SMS",
        "sms_campaigns_subtitle": "دروستکردن و ناردنی کەمپەینی SMS",
        "segments": "سێگمێنتەکان",
        "segments_subtitle": "بینەران و دابەشکردنی کڕیاران",
        "automations": "ئۆتۆمەیشنەکان",
        "automations_subtitle": "فلۆی کاری خۆکار بۆ مارکێتینگ",
        "name": "ناو",
        "subject": "بابەت",
        "body": "ناوەڕۆک",
        "status": "دۆخ",
        "sent_at": "نێردراوە لە",
        "recipients": "وەرگرەکان",
        "audience": "بینەران",
        "source": "سەرچاوە",
        "manual": "دەستی",
        "create_campaign": "دروستکردنی کەمپەین",
        "create_sms_campaign": "دروستکردنی کەمپەینی SMS",
        "create_segment": "دروستکردنی سێگمێنت",
        "create_automation": "دروستکردنی ئۆتۆمەیشن",
        "send_now": "ئێستا بنێرە",
        "schedule": "دەستنیشانکردنی کات",
        "campaign_sent": "کەمپەین نێردرا",
        "sms_sent": "SMS نێردرا",
        "campaign_cloned": "کەمپەین ڕوونووسکرا",
        "stats": "ئامار",
        "campaign_stats": "ئاماری کەمپەین",
        "sent": "نێردراو",
        "delivered": "گەیشتووە",
        "opened": "کراوەتەوە",
        "clicked": "کلیککراوە",
        "bounced": "گەڕاوەتەوە",
        "unsubscribed": "بەشداربوون هەڵوەشێنرایەوە",
        "preview": "پێشبینین",
        "segment_preview": "پێشبینینی سێگمێنت",
        "total_members": "کۆی ئەندامان",
        "email": "ئیمەیڵ",
        "sms_too_long": "دەقی SMS زیادە لە ١٦٠ کاراکتەر",
        "trigger": "چالاککەر",
        "trigger_event": "ڕووداوی چالاککەر",
        "trigger_contact_created": "پەیوەندی نوێ دروستکرا",
        "trigger_invoice_paid": "پسووڵە پارەدرا",
        "trigger_lead_qualified": "لید واتادار بوو",
        "steps_count": "ژمارەی هەنگاوەکان",
        "active": "چالاک",
        "step_1_basic": "زانیاری بنەڕەتی",
        "step_2_steps": "هەنگاوەکان",
        "step_3_review": "پێداچوونەوە",
        "step_email": "ئیمەیڵ",
        "step_sms": "SMS",
        "step_wait": "چاوەڕوانبە",
        "step_tag": "تاگ",
        "review_automation": "پێداچوونەوەی ئۆتۆمەیشن",
        "activate": "چالاککردن",
        "campaigns_sent_this_month": "کەمپەینی نێردراو ئەم مانگە",
        "total_reach": "کۆی گەیشتن",
        "avg_open_rate": "تێکڕای ڕێژەی کردنەوە",
        "active_automations": "ئۆتۆمەیشنە چالاکەکان",
        "sends_per_day": "ناردنەکان بە ڕۆژ",
        "recent_campaigns": "کەمپەینە تازەکان"
    },
    "nav": {
        "marketing_blurb": "ئیمەیڵ، SMS، سێگمێنت، و فلۆی ئۆتۆمەیشن",
        "desc_marketing_dashboard": "KPIـەکانی مارکێتینگ و کارایی کەمپەین",
        "desc_email_campaigns": "کەمپەینەکانی مارکێتینگی ئیمەیڵ و ناردنەکان",
        "desc_sms_campaigns": "کەمپەینەکانی مارکێتینگی SMS",
        "desc_segments": "سێگمێنتەکانی کڕیار و بینەران",
        "desc_automations": "فلۆی کاری ئۆتۆماتیکی مارکێتینگ"
    }
}

marketing_keys_en = {
    "marketing": {
        "marketing": "Marketing",
        "dashboard": "Marketing Dashboard",
        "dashboard_subtitle": "Campaigns, audiences, and marketing analytics",
        "email_campaigns": "Email Campaigns",
        "email_campaigns_subtitle": "Create and send email marketing campaigns",
        "sms_campaigns": "SMS Campaigns",
        "sms_campaigns_subtitle": "Create and send SMS marketing campaigns",
        "segments": "Segments",
        "segments_subtitle": "Audiences and customer segmentation",
        "automations": "Automations",
        "automations_subtitle": "Automated marketing workflows",
        "name": "Name",
        "subject": "Subject",
        "body": "Body",
        "status": "Status",
        "sent_at": "Sent At",
        "recipients": "Recipients",
        "audience": "Audience",
        "source": "Source",
        "manual": "Manual",
        "create_campaign": "Create Campaign",
        "create_sms_campaign": "Create SMS Campaign",
        "create_segment": "Create Segment",
        "create_automation": "Create Automation",
        "send_now": "Send Now",
        "schedule": "Schedule",
        "campaign_sent": "Campaign sent",
        "sms_sent": "SMS sent",
        "campaign_cloned": "Campaign cloned",
        "stats": "Stats",
        "campaign_stats": "Campaign Stats",
        "sent": "Sent",
        "delivered": "Delivered",
        "opened": "Opened",
        "clicked": "Clicked",
        "bounced": "Bounced",
        "unsubscribed": "Unsubscribed",
        "preview": "Preview",
        "segment_preview": "Segment Preview",
        "total_members": "Total Members",
        "email": "Email",
        "sms_too_long": "SMS text exceeds 160 characters",
        "trigger": "Trigger",
        "trigger_event": "Trigger Event",
        "trigger_contact_created": "Contact Created",
        "trigger_invoice_paid": "Invoice Paid",
        "trigger_lead_qualified": "Lead Qualified",
        "steps_count": "Steps",
        "active": "Active",
        "step_1_basic": "Basic Info",
        "step_2_steps": "Steps",
        "step_3_review": "Review",
        "step_email": "Email",
        "step_sms": "SMS",
        "step_wait": "Wait",
        "step_tag": "Tag",
        "review_automation": "Review Automation",
        "activate": "Activate",
        "campaigns_sent_this_month": "Campaigns Sent This Month",
        "total_reach": "Total Reach",
        "avg_open_rate": "Avg. Open Rate",
        "active_automations": "Active Automations",
        "sends_per_day": "Sends Per Day",
        "recent_campaigns": "Recent Campaigns"
    },
    "nav": {
        "marketing_blurb": "Email, SMS campaigns, segments, and automation flows",
        "desc_marketing_dashboard": "Marketing KPIs and campaign performance",
        "desc_email_campaigns": "Email marketing campaigns and sends",
        "desc_sms_campaigns": "SMS marketing campaigns",
        "desc_segments": "Customer segments and audiences",
        "desc_automations": "Automated marketing workflows"
    }
}

def update_locale(file_path: Path, new_keys: dict):
    """Update locale file with new keys, avoiding duplicates."""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Check if marketing keys already exist
    if 'marketing' in data:
        print(f"⚠️  'marketing' key already exists in {file_path.name}, skipping marketing merge")
    else:
        data['marketing'] = new_keys['marketing']
        print(f"✅ Added {len(new_keys['marketing'])} marketing keys to {file_path.name}")
    
    # Merge nav keys
    if 'nav' not in data:
        data['nav'] = {}
    
    nav_keys_added = 0
    for key, value in new_keys.get('nav', {}).items():
        if key not in data['nav']:
            data['nav'][key] = value
            nav_keys_added += 1
    
    if nav_keys_added > 0:
        print(f"✅ Added {nav_keys_added} nav keys to {file_path.name}")
    
    # Write back with proper formatting
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return True

def main():
    frontend_dir = Path(__file__).parent.parent
    locales_dir = frontend_dir / 'src' / 'locales'
    
    ku_file = locales_dir / 'ku.json'
    en_file = locales_dir / 'en.json'
    
    if not ku_file.exists():
        print(f"❌ {ku_file} not found")
        sys.exit(1)
    
    if not en_file.exists():
        print(f"❌ {en_file} not found")
        sys.exit(1)
    
    print("Adding marketing i18n keys...")
    update_locale(ku_file, marketing_keys_ku)
    update_locale(en_file, marketing_keys_en)
    print("✅ i18n update complete")

if __name__ == '__main__':
    main()
