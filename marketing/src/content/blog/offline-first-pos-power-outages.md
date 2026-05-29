---
title: "Offline-First POS: Designed for Iraqi Power Outages"
description: "Iraqi electricity is unreliable by world standards. A POS that does not work offline is not really a POS for an Iraqi shop. Here is how the Kurdish ERP keeps selling through outages, and why IndexedDB and not localStorage."
date: 2026-05-05
author: "Kurdish ERP Team"
tags: ["pos", "offline", "indexeddb", "engineering"]
locale: en
reading_minutes: 7
target_query: "offline pos iraq electricity"
og_image: /brand/og/blog-template-1200x630.png
---

In an average Iraqi city in 2026 — Erbil, Sulaymaniyah, Baghdad, Basra — the public power supply blinks several times a day and sometimes drops out entirely for hours. Most shops run generators or solar systems, but the transition between grid and backup is not seamless: tablets reboot, routers reconnect, WiFi disappears for 30 seconds to 3 minutes. A POS system that requires an active internet connection to record a sale is not actually a POS for an Iraqi shop — it is a brittle shell that fails when the shop most needs to keep selling. This article explains how the Kurdish ERP solves this with an **offline-first** architecture, why we use **IndexedDB and not localStorage**, and what the cashier sees and does not see during an outage.

## The user-visible behavior

When the network drops, the cashier sees almost nothing change:

- The POS screen still renders.
- Items in the catalog still appear (the catalog is preloaded into the device).
- New transactions can be rung up. Receipts print. Drawers kick.
- The only difference: a small "offline" indicator in the corner of the screen, and the network-status badge in the header.

When the network comes back, the system **syncs in the background** — every offline transaction is replayed to the server, the server confirms persistence, and the offline badge disappears. The cashier never has to think about it.

If a network outage lasts hours, dozens or hundreds of transactions queue. When the network returns, sync happens within seconds (Iraqi mobile data is fast when it works).

## Why IndexedDB and not localStorage

`localStorage` is the obvious first instinct for offline storage in a web app. It is simple, synchronous, and supported everywhere. It is also the **wrong choice for a POS**:

- **5 MB quota.** Past about 200 transactions or a few hundred catalog items, you run out of space.
- **Synchronous I/O.** Every read and write blocks the main thread. POS UIs become janky.
- **Strings only.** Every datum must be serialized; complex objects need JSON.parse / JSON.stringify on every access.
- **No transactions.** No way to write multiple records atomically. If the cashier closes the tab mid-write, partial data is possible.
- **No queries.** To find an item by SKU you iterate the whole bag.

**IndexedDB** is the correct choice:

- **Quota in GBs.** Modern browsers grant 50% to 80% of free disk on first request. The Kurdish ERP requests persistent storage on first install.
- **Async + transactional.** Reads and writes happen off the main thread. Multi-step writes are atomic.
- **Indexed queries.** Find an item by SKU, scan by date range, paginate — all without loading the full set.
- **Structured-clone serialization.** Store Date objects, Maps, Blobs (e.g., signature images) natively.

The cost: IndexedDB has a steeper API. We wrap it in our `stores/posOffline.ts` Zustand store so the rest of the codebase does not see the IndexedDB primitives directly.

## The sync model

The Kurdish ERP POS uses an **outbox queue** sync model:

1. **Local write.** Every transaction is committed to IndexedDB first, with status `pending_sync`.
2. **Outbox.** The transaction is also added to a sync outbox keyed by a monotonically increasing client-side counter.
3. **Background worker.** A service worker (or, if SW is unavailable, a setInterval in the main app) drains the outbox to the server, marking each item `synced` on confirmation.
4. **Conflict resolution.** If the server rejects a transaction (e.g., duplicate ID, or invalid customer), the transaction stays in the outbox with status `sync_failed` and an error reason; the cashier sees a flag and can resolve.
5. **Idempotency.** Each transaction carries a stable client-generated UUID (`client_txn_id`); the server uses this for deduplication if a retry happens.

The model is eventually consistent — but for a POS, that is acceptable. The "truth" is the cashier's drawer and the printed receipt; the server's record is the canonical persistence of that truth. As long as the server eventually has every transaction, we are correct.

## What happens to inventory during an outage

This is the tricky part. The local POS knows what was in stock at the moment of the last sync. During an outage:

- **In-store sales decrement local inventory** in IndexedDB.
- **Stock-ins from suppliers** are usually back-office, not POS, so they happen post-sync.
- **WhatsApp / online orders** during the same outage are queued at the server (or other channels) and visible only post-sync.

The risk: two channels selling the last unit of an item without knowing about each other. The mitigation is the **soft-deduction model**:

- Local POS shows "in stock" as the last-known server quantity minus offline sales.
- When stock approaches zero, the cashier sees a "verify in stock" prompt and can physically check before completing the sale.
- Post-sync, if a conflict occurred (multi-channel oversold), the system flags it for resolution.

In practice, multi-channel collisions during outages are rare (most outages are minutes, not hours), and the cashier's physical-check habit covers the edge.

## What about the e-Fakhata submission

e-Fakhata XMLs cannot be signed and submitted offline (the signature requires the MoF endpoint to be reachable). During an outage:

- The invoice is generated locally as usual.
- The signing + submission are queued.
- When the network returns, the queue drains. The MoF processes the invoices in the order received.
- The cashier sees "e-Fakhata pending" on the receipt; if the customer asks for the QR code, it is generated post-sync and emailable / printable then.

This is how the MoF guidance handles outages — there is no requirement for real-time submission, only for eventual submission within the daily window.

## The user experience details

A few small choices that matter:

- **The offline indicator is small.** A red dot in the corner. The cashier should not feel anxious — the system handles it.
- **The receipt prints in full** with all line items, totals, taxes — exactly the same as when online.
- **The "Sync now" button** exists for the worried cashier who wants to verify their transactions made it to the server. Most cashiers never use it.
- **The end-of-shift report** shows synced vs pending counts. At end of day, ideally everything is synced; if not, the cashier knows to wait a bit before closing.

## Why this matters commercially

For an Iraqi shop, offline POS is not a feature, it is the **floor** below which the software is unusable. Several Iraqi shops have told us they tried other software, hit an outage during the first week, lost 4 hours of sales reconstruction, and never trusted it again. The Kurdish ERP's offline architecture is one of the two or three reasons we keep customers.

If you are evaluating POS software for an Iraqi shop, the first question to ask the vendor is: "What happens during a 2-hour power outage?" If the answer is anything other than "the POS keeps working and syncs when power returns", look elsewhere. See the [POS demo](/features) for a worked example.
