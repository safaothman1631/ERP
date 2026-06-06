---
title: "Restaurant POS in Iraq: KDS, Table Management, and Delivery Integration"
description: "Iraqi restaurants run on tight margins and high volume. The POS needs to handle table service, a kitchen display system (KDS), delivery integration, and end-of-night Z-tape reconciliation without slowing the front-of-house."
date: 2026-03-16
author: "Karzan Othman"
author_title: "Restaurant operator, Sulaymaniyah"
tags: ["pos", "restaurant", "kds", "delivery", "f&b"]
locale: en
reading_minutes: 9
target_query: "restaurant pos iraq kds"
og_image: /brand/og/blog-template-1200x630.png
---

Iraqi restaurants are some of the most demanding POS environments in the country. You have a dining room serving lunch and dinner, a busy kitchen that needs orders the moment they are punched, a delivery channel that has scaled fast since 2022, and a closing-time reconciliation drill that mixes cash, card, online wallets, and credit. This article walks through how a small-to-mid Iraqi restaurant runs its POS in 2026 — what hardware to pick, what the kitchen display system (KDS) needs to do, how to integrate delivery, and how end-of-night reconciliation actually works in practice.

## The lay of the land

A modern Iraqi restaurant POS has five user-facing surfaces:

1. **Order-entry terminal** — tablet or laptop at the host stand or behind the bar.
2. **Mobile order-entry** — server taking orders at the table on a phone.
3. **Kitchen display system (KDS)** — a screen in the kitchen showing active orders.
4. **Receipt printer** — at the till, for guest checks and final receipts.
5. **Delivery integration** — receiving orders from third-party platforms (Talabat, ToYou) or via WhatsApp.

The KDS replaces the old paper-ticket model and is the single biggest operational improvement a restaurant can make. We will spend the most time on it.

## Hardware setup

For a 40-seat restaurant doing 60-150 covers a day, the practical setup is:

| Surface | Hardware |
|---------|----------|
| Order terminal at counter | Lenovo IdeaPad 1 or Android tablet (Galaxy Tab A9) |
| Server mobile entry | Server's personal Android phone running PWA |
| KDS | 21-inch monitor on a wall in the kitchen, driven by a low-end mini-PC or Android stick |
| Receipt printer | Xprinter XP-T80A (USB+BT) |
| Cash drawer | Generic 6-pin RJ-11 |

The KDS does not need a dedicated PC if you have a recent Android stick or an Apple TV — a PWA at `kds.zoho-kurdish.iq/{restaurant_id}` shows the order queue in real time over the local network or, with internet, over WebSockets.

## Order flow — from server to plate

The order lifecycle that works for an Iraqi restaurant is:

1. **Server takes order at the table** on their phone PWA. Items added, modifiers attached ("no onion", "extra spicy"), course assigned ("starter", "main", "dessert").
2. **Server taps "Send to kitchen".** The KDS receives the order within 500ms over the local network.
3. **Kitchen sees the order** in a card layout sorted by ticket time, with course assignment respected.
4. **Kitchen marks items "started", then "ready"** — color states on the KDS.
5. **Server sees "ready" on their phone**, takes the plate from the pass to the table.
6. **At settlement**, server prints the guest check, customer pays, receipt prints, drawer kicks.

The crucial design decision is **the courses on the KDS**. The kitchen should fire starters first, then mains. The Kurdish ERP's POSKitchen view supports both "fire by course" (kitchen sequences within a ticket) and "fire all together" (kitchen fires the whole ticket at once for fast-casual). The choice is per-restaurant in settings.

## KDS — what it must do

A working KDS for an Iraqi restaurant must:

- **Show every active order** as a card with table number, server name, ticket time, and items.
- **Update within 500ms** when a server modifies an order.
- **Color-code by age** — green under 5 min, yellow 5-10 min, red over 10 min. Kitchen pressure is visual.
- **Handle modifiers prominently** — "no onion" must be visible at a glance, not buried in small type.
- **Run offline.** Kitchen WiFi drops; the KDS keeps showing the orders it already has. New orders queue at the server side.
- **Be touch-or-mouse-readable from 2 meters away** with floury hands.

The Kurdish ERP's KDS satisfies all six. See the demo at `/features` for a working example.

## Table management

If you run table service, you need a table map. The Kurdish ERP's POS Floor view lets you:

- Define tables with a free-form room layout.
- Assign servers to sections.
- See table status: open, ordered, food running, paid, dirty.
- Move a guest from table 3 to table 7 (system tracks the move).
- Split a check between guests (X paid for items 1-3, Y paid for items 4-5).

For a quick-service restaurant or a delivery-only operation, you can skip the floor entirely — orders go to a queue.

## Delivery integration

Iraqi delivery in 2026 splits between three channels:

1. **Platform delivery** — Talabat is dominant; ToYou, Snoonu, and regional players take a slice. Each platform has its own API or partner-portal flow for receiving orders. The Kurdish ERP's Growth and Pro plans include direct integrations for the top two; smaller platforms get a webhook receiver.
2. **WhatsApp orders** — many Iraqi restaurants take orders directly via WhatsApp Business. The `/ext/whatsapp` integration in the Kurdish ERP ingests WhatsApp orders into the POS queue, with customer details auto-populated from the chat.
3. **Phone orders** — still common. Cashier or host takes the order verbally and types it in.

Whichever channel an order arrives by, it should land in the **same order queue** and hit the **same KDS**. The kitchen does not care whether a meal is for dine-in, pickup, or delivery — it just needs to cook it correctly and at the right time. The delivery-vs-dine-in distinction matters only for the front-of-house (driver pickup vs server plating) and for the accounting (delivery fee, platform commission).

## End-of-night Z-tape reconciliation

The closing drill is unchanged in concept but should be automated in execution:

1. **Z-tape print.** A summary receipt showing the day's sales by category, by payment method, by server.
2. **Cash count.** Manager counts the drawer by denomination — the Kurdish ERP's denomination grid runs this. Variance is computed against the system-expected cash balance.
3. **Card reconciliation.** Card terminal reports vs system records — must match.
4. **Online wallet reconciliation.** FastPay, Qi, Zain Cash — each platform's daily summary vs system records.
5. **Tip-out.** If you run a tip pool, distribute per the agreed split.
6. **Float reset.** Cash drawer reset to opening float for tomorrow.

Steps 1-4 take 5-10 minutes with the system; without it they take 45 minutes and produce shouting.

## Cost of ownership

For a restaurant operator considering the move:

- **Hardware** (POS, KDS, printer, drawer): IQD 1,500,000 – 2,500,000 one-time.
- **Software** (Kurdish ERP Growth, billed monthly): IQD 80,000 / month.
- **Platform fees** (delivery commissions, payment processor): typically 5-25% of order value per channel.

The 5-minute closing drill alone usually pays for the software inside a month.

## The crucial mindset

The most common mistake Iraqi restaurants make with POS is **treating it as a cash register**. A modern POS is your **operations brain**: it tells the kitchen what to cook, tells the manager what to order tomorrow, tells the accountant what to file at month-end, and tells the owner where the profit actually is.

If you are running a restaurant and your POS is still doing nothing more than printing receipts, you are leaving margin on the table. See our [restaurant module walk-through](/features) for the operational picture. And if you would like help migrating from a paper-ticket kitchen to a KDS — that work is well-trodden; we have done it for a dozen Iraqi restaurants and the transition takes one shift.
