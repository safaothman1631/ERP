# Hardware Compatibility Matrix

> **Status legend:** ✅ tested in lab • 🧪 pending-physical-test • 💬 community-reported.

Last reviewed: 2026-05-29. Spec: `.kiro/specs/growth-to-100/requirements.md` §R3.

The Kurdish-ERP POS hardware layer is built against the [ESC/POS](https://en.wikipedia.org/wiki/ESC/P) command standard with per-vendor dialect overrides. **Until the hardware lab is procured (T-G.3.1), all entries are `pending-physical-test`** — the dialect generators emit standards-compliant byte streams, but no physical device has yet been exercised.

---

## Thermal printers

| Model | Dialect ID | Width | Connections | Drawer pin | USD | Status | Notes |
|-------|-----------|-------|-------------|------------|-----|--------|-------|
| Epson TM-T20III | `escpos-epson` | 80mm | USB | 2 | ~220 | 🧪 | Workhorse; UTF-8 on firmware ≥ K.B6 |
| Epson TM-T88VI | `escpos-epson` | 80mm | USB / Serial | 2 | ~420 | 🧪 | Premium; native QR support |
| Epson TM-m30 | `escpos-epson` | 80mm | USB / BT / WiFi | 2 | ~290 | 🧪 | Compact; multi-interface |
| Xprinter XP-T80A | `escpos-xprinter` | 80mm | USB | 5 | ~75 | 🧪 | Budget Iraqi market favourite |
| Xprinter XP-T80B | `escpos-xprinter` | 80mm | USB / BT | 5 | ~95 | 🧪 | BT; drawer pulse doubled |
| Bixolon SRP-330II | `escpos-bixolon` | 80mm | USB / Serial | 5 | ~180 | 🧪 | Quiet partial cut |
| Bixolon SRP-350III | `escpos-bixolon` | 80mm | USB / Serial / WiFi | 5 | ~230 | 🧪 | |
| Goojprt PT-210 | `escpos-generic-58` | 58mm | BT (BLE) | 2 | ~22 | 💬 | No cutter; pocket BT |
| Rongta RPP02N | `escpos-generic-58` | 58mm | BT (BLE) | 2 | ~28 | 💬 | |
| Sunmi V1s (integrated) | `escpos-generic-58` | 58mm | Native BLE | 2 | ~320 | 💬 | Android POS terminal |
| **Any unknown 80mm** | `escpos-generic-80` | 80mm | any | 2 | — | fallback | Safe baseline |

### Dialect coverage

| Dialect | Cut | Drawer | UTF-8 | QR | Barcode (1D) | Codepages |
|---------|-----|--------|-------|-----|--------------|-----------|
| `escpos-epson` | GS V B 3 (full+feed) | Pin 2 — 50/150 ms | yes (fw ≥ K.B6) | yes | EAN13/8, UPC, CODE128/39/ITF | UTF8, CP864, CP437 |
| `escpos-xprinter` | GS V 0 (full only) | Pin 5 — 200/200 ms | partial | yes | same | CP437, CP864, UTF8 |
| `escpos-bixolon` | GS V 1 (partial default) | Pin 5 — 25/120 ms | yes (fw ≥ 1.0F) | yes | same | CP437, CP864, UTF8 |
| `escpos-generic-58` | GS V 1 (may no-op) | Pin 2 — 100/200 ms | rare | yes | same | CP437, CP864, CP720 |
| `escpos-generic-80` | GS V mode 0/1 | Pin 2 — 50/150 ms | baseline | yes | same | CP437, CP864 |

---

## Barcode scanners

| Model | Category | USD | Status | Notes |
|-------|----------|-----|--------|-------|
| Honeywell 1450g | hid-usb | ~95 | 🧪 | 2D scanner, plug-and-play HID |
| Symbol/Zebra LS2208 | hid-usb | ~75 | 🧪 | 1D laser, very reliable |
| Netum C750 | hid-bluetooth | ~35 | 🧪 | BT HID; battery 6+ months |
| Tera HW0002 | hid-bluetooth | ~28 | 💬 | Iraqi e-commerce favourite |
| In-app camera (ZXing) | camera | 0 | ✅ | Web Worker fallback, works on any tablet |

---

## Cash drawers

| Model | Pin profile | USD | Status | Notes |
|-------|-------------|-----|--------|-------|
| Epson-style EB-3000 (6-pin) | `epson-pin5` | ~60 | 🧪 | Standard RJ-12 |
| Generic 4-pin (alternate) | `epson-pin2` | ~40 | 🧪 | Wizard tests pin 5 first, falls back |

---

## Customer displays

| Model | Connection | Geometry | USD | Status |
|-------|-----------|----------|-----|--------|
| Bematech LD-220 | Serial RS-232 / USB-serial | 20×2 VFD | ~120 | 🧪 |
| Generic VFD-220 | Serial | 20×2 | ~55 | 💬 |
| PWA tablet (BT-paired) | Bluetooth + Firestore | rich | ~90 | ✅ |
| PWA WiFi smart-TV | WiFi + Firestore | rich | 0 | ✅ |

---

## Iraqi market sources (2026)

| City | Distributor | Specialty |
|------|-------------|-----------|
| Baghdad — Mansour | Al-Khayam IT | Epson, Bixolon |
| Baghdad — Karada | NurNet Systems | Xprinter, scanners |
| Erbil — 60-Meter Rd | KurdTech Retail | Goojprt, Rongta, tablets |
| Sulaymaniyah — Salim St | SaraTech Devices | mixed |
| Online | iraqishop.com, AliExpress (KRG warehouses) | generic 58mm BT |

---

## Regression test cadence

Per R3.14, the hardware lab runs the full receipt + drawer matrix **quarterly** on real devices. Software-only regressions (dialect byte streams) run on every CI build via `frontend/src/hardware/printers/tests/printer-driver.test.ts`.
