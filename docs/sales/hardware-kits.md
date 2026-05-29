# Hardware kits — partner pricing & bundle configs

> Spec: growth-to-100/requirements.md R3.12 (vendor partnerships),
> design.md §3.8 (Shopkeeper Kit).

The aim is to ship one signed co-marketing partnership with an Iraqi retail-hardware distributor by end of Phase G3 (W7), then layer a second partnership in Phase G6.

---

## Kit A — Shopkeeper Starter (entry tier)

**Target buyer:** new shop owner in Baghdad / Erbil / Sulaymaniyah, single-terminal, IQD 300k–500k/month gross.

| Component | Model | List USD | Notes |
|-----------|-------|----------|-------|
| Thermal printer | Xprinter XP-T80A (USB) | 75 | Budget but reliable |
| 80mm thermal paper | 6-pack | 12 | ~9 months for a small shop |
| USB barcode scanner | Symbol/Zebra LS2208 | 75 | 1D laser, very reliable |
| Cash drawer (6-pin) | Epson-style EB-3000 | 60 | Standard pinout |
| 10" Android tablet | Pre-installed POS PWA | 95 | Mid-tier (Lenovo Tab M10 or Samsung A7 Lite) |
| **Subtotal** | | **317** | |
| Bundle price | | **295** | ~7% discount |

**Partner economics**
- Partner fulfilment margin: 18–22 %
- Kurdish-ERP referral fee: 6 % (USD 18 per kit) + first-year subscription = USD 144 (12 × 12)
- Co-marketing: partner logo on the marketing site under "Where to buy hardware"; the company logo on the kit packaging.

---

## Kit B — Shopkeeper Pro (mid tier)

**Target buyer:** multi-terminal restaurant or mini-market, IQD 500k–2M/month gross.

| Component | Model | List USD | Notes |
|-----------|-------|----------|-------|
| Thermal printer | Epson TM-T20III (USB) | 220 | Reliable, UTF-8 firmware |
| 80mm thermal paper | 12-pack | 22 | |
| Bluetooth barcode scanner | Netum C750 | 35 | BT HID for tablet |
| Cash drawer (6-pin) | Epson-style EB-3000 | 60 | |
| Customer display | Generic VFD-220 (serial) | 55 | 20×2 character pole |
| 10" Android tablet | Lenovo Tab M10 Plus | 145 | Brighter screen for shop counter |
| Setup & training | 2-hour on-site visit | 50 | Partner labour |
| **Subtotal** | | **587** | |
| Bundle price | | **545** | ~7% discount |

---

## Kit C — Kitchen (restaurant tier)

**Target buyer:** café or restaurant needing a back-of-house kitchen printer + front-of-house POS.

| Component | Model | List USD |
|-----------|-------|----------|
| Front-of-house printer | Bixolon SRP-330II | 180 |
| Kitchen printer (heat-resistant) | Epson TM-T20III | 220 |
| Both: cash drawer + paper packs | | 80 |
| 10" tablet + 5" kitchen display tablet | | 240 |
| **Bundle price** | | **680** |

---

## Outreach plan (Phase G3 — Founder track)

| Week | Action |
|------|--------|
| W4 | Identify 3 distributors per city (Baghdad / Erbil / Sulaymaniyah). Initial intro emails + WhatsApp. |
| W5 | Schedule in-person meetings with top 2 in each city. Pitch deck = compatibility-matrix + kit margins. |
| W6 | Negotiate referral fee (6 % baseline). Pilot with 5 kits in their stock. |
| W7 | Sign co-marketing agreement with the first partner who commits to ≥ 20 kits/quarter. |

### Pitch hooks for distributors

1. **No driver-disk shipping.** The POS auto-detects dialect — no per-printer setup CD.
2. **Built-in warranty registration.** The pairing wizard captures serial + firmware → distributor sees an audit log per kit they sell.
3. **Joint marketing.** Kurdish-language video at install time with the distributor's logo.
4. **Lock-in via subscription.** Every kit drives a USD ~144/year SaaS subscription. Partner can sell SaaS on top with an extra 10% margin if they handle billing.

### Sign-off criteria

A signed partnership is one where:
- The partner stocks ≥ 20 units of the headline kit (Kit A or B).
- A WhatsApp business line is provided for shopkeeper escalations.
- The partner agrees to a 2-week SLA for printer RMA.

---

## Anti-patterns / avoid

- **Don't lock to a single vendor.** Iraqi distributors switch import sources every 6–12 months. The dialect layer must remain vendor-agnostic.
- **Don't undercut local repair shops.** Many bazaar shops use Iraqi-imported parts; an exclusive partnership risks alienating the long tail.
- **Don't take payment for kits ourselves.** Customs and import-tax complexity in Iraq is the partner's job, not ours.
