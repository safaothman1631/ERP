---
title: "POS Setup for an Iraqi Shopkeeper: A Practical Hardware and Software Guide"
description: "Choose the right printer, scanner, cash drawer, and cash float for an Iraqi retail shop in 2026. A non-technical walk-through with vendor names, IQD costs, and pairing steps."
date: 2026-02-04
author: "Hawzin Hassan"
author_title: "Retail operator, Basari Bazar"
tags: ["pos", "hardware", "retail", "shopkeeper"]
locale: en
reading_minutes: 8
target_query: "pos setup iraq shop hardware"
og_image: /brand/og/blog-template-1200x630.png
---

Setting up a point-of-sale terminal in an Iraqi shop is more than picking software. It is choosing hardware that will survive ten power blinks a day, talk to a printer that arrived from a Baghdad importer with no documentation, and run a cash float in dinars that come in seven denominations. This guide walks through the practical setup that works in 2026 — both what to buy and how to configure it.

## What you will end up buying

A minimum viable POS in an Iraqi shop is four items:

| Item | What to buy | IQD budget (2026) |
|------|-------------|------------------:|
| **Tablet or low-end laptop** | Samsung Galaxy Tab A9 / Lenovo IdeaPad 1 | 350,000 – 800,000 |
| **Thermal receipt printer** | Epson TM-T20III (USB) or Xprinter XP-T80A (USB+BT) | 220,000 – 380,000 |
| **Barcode scanner** | Symbol / Honeywell HID USB scanner | 120,000 – 250,000 |
| **Cash drawer** | Generic 6-pin RJ-11 drawer | 180,000 – 280,000 |

Total: roughly **IQD 870,000 – 1,710,000** (about USD 600 – 1,200 at the May 2026 CBI rate). You can go cheaper with a no-name Bluetooth 58mm mobile printer if you only need short receipts, but the trade-off in reliability is rarely worth it for a shop running more than ~30 transactions a day.

## The printer is the most-asked question

Iraqi retail has settled on **80mm thermal printers** as the de-facto standard. 58mm mobile printers are common for delivery riders but rarely used at the counter. The three names you will hear in Erbil and Baghdad markets are:

- **Epson TM-T20III** — the premium choice. Robust ESC/POS implementation, predictable behaviour with Arabic code pages, the printer the rest of your stack is tested against. USD 75 – 95 in Baghdad, more in regional cities.
- **Xprinter XP-T80A** — the mid-market favourite. Cheaper, supports USB + Bluetooth + Ethernet, dialect mostly compatible with Epson but with a few quirks. USD 50 – 65.
- **Bixolon SRP-330II** — the European import. High quality, less common, harder to source for replacement.

A reasonable default for a single-shop owner is **Xprinter XP-T80A over USB**. The Kurdish ERP's pairing wizard knows its dialect; the cost is right; if it dies, your importer can replace it within a week.

For the cash drawer, do not buy the "premium" model. Iraqi drawer hardware is functionally identical across brands. What matters is the **pin configuration** — most drawers from Iraqi importers use the 6-pin RJ-11 Epson pinout, but a few use a 4-pin alternate. The Kurdish ERP's pairing wizard asks you which pin profile applies and lets you test the kick before you commit.

For the scanner, any **HID-keyboard scanner** works. The cheapest USB models from Honeywell or Symbol — the ones that show up at Erbil's Bazaar Soren for IQD 120,000 — present as a keyboard device and just work. Save your money. If you need wireless, an USD 35 – 50 Bluetooth HID scanner is fine; verify the pairing flow before you walk out of the shop.

## Pairing — step by step

The Kurdish ERP's hardware pairing wizard walks through this, but the high-level flow is:

1. **Plug everything in.** USB printer to the tablet/laptop. Cash drawer cable (RJ-11) into the printer's drawer kick port. Scanner via USB.
2. **Open the POS app.** Go to Settings → POS hardware.
3. **Detect printer.** The wizard scans USB devices; pick your Xprinter or Epson from the list.
4. **Detect dialect.** The wizard sends `GS I 65` (the printer-info command) and reads the response. If recognised, you are good. If not, fall back to "Epson-compatible" baseline.
5. **Test print.** A one-page receipt prints showing your company name, the date, a sample Arabic/Kurdish code-page line, a barcode, and a QR. Verify the print is clean and the cut is clean.
6. **Kick the drawer.** Test the cash drawer pulse — drawer opens.
7. **Pair scanner.** Most HID scanners need no setup; click the test field and scan any barcode to verify input.
8. **Save profile.** The wizard persists everything so the next cashier does not need to think about it.

If the cash drawer does not open on the kick test, try the other pin profile (the wizard has a one-click toggle).

## Cash float — the IQD-specific part

In Iraqi retail you reconcile the cash drawer at the end of each shift by counting each denomination separately. The denominations currently in circulation in 2026 are:

| Note | Notes per typical cash drawer |
|------|------------------------------:|
| IQD 50,000 | 5 – 20 |
| IQD 25,000 | 10 – 30 |
| IQD 10,000 | 30 – 80 |
| IQD 5,000  | 20 – 60 |
| IQD 1,000  | 20 – 60 |
| IQD 500    | 10 – 40 |
| IQD 250    | 10 – 40 |

The Kurdish ERP's end-of-shift screen presents a row for each denomination. The cashier counts physical notes, types the count, and the system computes the total and the over/short variance against the system-expected balance. If you are still doing this on a notepad, the Excel-style spread is the single biggest source of weekly disputes between cashiers and owners; automate it.

## Training a cashier — 30 minutes

A non-technical cashier should be operating the POS within 30 minutes:

- Scan an item: the line adds.
- Enter quantity: tap the line, change number, save.
- Discount: tap the line, percent or absolute.
- Customer: search by phone or name, or skip.
- Pay: tap "Charge", pick cash or card, confirm.
- Receipt prints; drawer kicks.

If a cashier needs more than 30 minutes to get to confidence, the UI is wrong — and we have spent months making sure that is not the case in the Kurdish ERP. See our [Kurdish-language POS walk-through](/features) for screenshots.

## What goes wrong, and how to fix it

The three problems an Iraqi shop will hit:

1. **Power blink mid-transaction.** The Kurdish ERP runs on IndexedDB; the transaction is saved offline. When power returns and the network comes back, it syncs. No manual recovery.
2. **Printer cut fails.** The cut blade on cheap printers gets dull after about 50,000 receipts. Replacing the printer is faster and cheaper than servicing it.
3. **Barcode scanner stops typing into the right field.** This is almost always a keyboard-focus issue. Click the POS search field once before scanning.

## What this should cost in 2026

For a single-shop owner buying everything in Erbil or Baghdad, you should plan on:

- **Hardware**: IQD 870,000 – 1,710,000 one-time.
- **Software** (Kurdish ERP Starter plan, billed monthly): IQD 35,000 / month.
- **Software** (Growth plan if you have a second shop): IQD 135,000 / month.

That works out to under USD 30 / month after the hardware investment is paid down — for a system in your own language, with offline support, with WHT and VAT built in, and with e-Fakhata ready for the 2026 mandate.

If you would like to see this running on a shop floor, the [Kurdish ERP demo](/features) is a 90-second walk through a single transaction from scan to receipt. And our team will pair the hardware for you over WhatsApp if your printer arrives without documentation — that part of the work is done.
