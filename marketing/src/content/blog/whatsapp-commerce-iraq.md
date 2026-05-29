---
title: "WhatsApp Commerce in Iraq: Receive Orders via WhatsApp into Your POS"
description: "Many Iraqi customers order via WhatsApp. Here is how to ingest WhatsApp orders into your POS queue, handle delivery and payment, and keep the cashier in one workflow."
date: 2026-04-21
author: "Kurdish ERP Team"
tags: ["whatsapp", "commerce", "messaging", "pos"]
locale: en
reading_minutes: 7
target_query: "whatsapp business iraq orders"
og_image: /brand/og/blog-template-1200x630.png
---

WhatsApp is the most-used messaging app in Iraq. By 2026, a large share of Iraqi consumer commerce — especially in pharmacies, restaurants, grocery, and clothing — flows at least partially through WhatsApp Business. The customer messages, "هل هذا متوفر؟" ("is this in stock?"), the shop replies with a price, the customer sends a delivery address, the shop sends an order, money changes hands through Zain Cash or cash-on-delivery. This is a real channel, even when it is informal. This article walks through how to operationalize it: receive WhatsApp orders into your POS, fulfill them through the same workflow as in-store sales, and reconcile at end of day.

## Why this matters

Treating WhatsApp orders as a separate channel — keeping them in the chat, writing them on paper, manually creating an invoice later — works at low volume. Past about 10 orders a day, it breaks down: orders get lost, inventory is mis-counted, payment is forgotten, the cashier loses the thread.

What works at scale: **every WhatsApp order becomes an order in the POS the moment it is confirmed**, and the cashier's queue is one merged queue across in-store, delivery platform, and WhatsApp channels.

## The technical setup

Two paths to ingest WhatsApp orders:

### Path 1: WhatsApp Business API (recommended)

If you process more than ~20 WhatsApp orders a day, you should be on the WhatsApp Business API rather than the consumer app:

1. Sign up with a Meta-approved Business Solution Provider (BSP) — **360Dialog**, **Twilio**, or one of the regional Iraqi resellers.
2. Get a business number assigned (often you can port your existing number, with some lead time).
3. Connect the BSP webhook to your accounting / POS system.

For the Kurdish ERP, the `/ext/whatsapp` integration accepts BSP webhooks and turns each incoming message thread into a Conversation record, with metadata: customer phone, customer name (from WhatsApp profile), timestamp, message history, attached images.

### Path 2: Multi-device WhatsApp Web (lighter touch)

For low-volume shops, you can run WhatsApp Web in a browser tab on your POS workstation. The Kurdish ERP includes a WhatsApp Web companion view that lets the cashier:

- See active conversations.
- Convert a conversation to an order by selecting items and quantities.
- Push the order into the POS queue.

This path requires the cashier to manually transcribe order items, but it works at low volume and is free (no BSP fees).

## The customer-side flow

A typical WhatsApp commerce flow for an Iraqi shop:

1. **Customer messages:** "هل عندكم paracetamol 500mg؟" ("Do you have paracetamol 500mg?")
2. **Cashier or shop owner replies with availability + price:** "نعم، 5000 د.ع. هل تريد توصيل؟" ("Yes, IQD 5,000. Do you want delivery?")
3. **Customer:** "نعم، عنواني …" ("Yes, my address is …") and shares location.
4. **Cashier converts the conversation to an order** in the Kurdish ERP — selects the item from the catalog, adds delivery fee, captures address.
5. **POS issues an invoice** with the customer's name from the WhatsApp profile, the items, the delivery line, payment method "Cash on delivery" or "Zain Cash on confirmation".
6. **Order goes to the kitchen / fulfillment queue** (if restaurant) or to the dispense queue (if pharmacy) just like an in-store order.
7. **Delivery rider picks up**, delivers, collects payment.
8. **Rider marks order delivered + paid** in their phone app; the POS records the cash collection against the day's drawer.

## Reconciliation at end of day

Cash on delivery for WhatsApp orders is its own reconciliation lane:

- **Driver cash bag.** Driver returns at end of shift with cash from all delivered COD orders.
- **System-expected COD cash.** The Kurdish ERP sums all "COD delivered" orders for the day.
- **Variance.** Driver cash vs system-expected — manager investigates if material.

For Zain Cash / FastPay / Qi orders, the platform's daily summary should match the system's record of orders settled via that platform.

For platform-delivery orders (Talabat etc.) the platform's daily payout report is your truth, lagged by 1-7 days; reconcile in the bank-feed period rather than at end-of-day.

## Common pitfalls

The three things to avoid:

1. **Letting WhatsApp orders skip inventory deduction.** If you sell a paracetamol box on WhatsApp and forget to deduct it from inventory, the next in-store customer is told it is in stock and is disappointed. Always run the transaction through the POS, even if the actual delivery happens hours later.
2. **Forgetting the invoice.** Iraqi tax law treats every sale as taxable; cash-on-delivery is no exception. The invoice must be generated at the time of order, not the time of payment.
3. **Cashier juggling too many conversations.** Past about 20 active conversations, a single cashier cannot keep up. Hire a dedicated WhatsApp-orders person, or train the front-of-house to triage.

## Building loyalty via WhatsApp

A WhatsApp Business profile is also your **CRM channel**. The Kurdish ERP's CRM module can:

- Send the customer a thank-you message + receipt after delivery.
- Send a re-order reminder 30-60 days after a prescription refill.
- Send promotional broadcasts (with consent, per WhatsApp's rules) to your customer list.

Used judiciously, this is among the highest-ROI marketing channels in Iraq in 2026. Used badly — by spamming — it gets your number blacklisted.

## What this costs

- **WhatsApp Business API via BSP:** USD 30-60 / month + per-message fees. Free for the first 1,000 service conversations per month.
- **Kurdish ERP `/ext/whatsapp` integration:** included on Growth and Pro plans.
- **Setup time:** about 1 week from "sign up with BSP" to "fully integrated and ingesting orders".

For most Iraqi shops processing >20 WhatsApp orders a day, the integration pays for itself within the first week through reduced order-loss and faster reconciliation.

## What to do next

If you are already receiving WhatsApp orders informally, set up the Kurdish ERP `/ext/whatsapp` integration and put the orders through the POS. If you are not yet using WhatsApp for orders but your customers are messaging you anyway, formalize it: get a business number, set business hours, set an auto-reply for after-hours. The channel is here whether you build for it or not. See our [WhatsApp commerce demo](/features) for a worked example.
