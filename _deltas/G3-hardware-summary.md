# Phase G3 — Hardware Compatibility Layer (Summary)

Spec: `.kiro/specs/growth-to-100/requirements.md` §R3 (R3.1–R3.15),
`design.md` §3, `tasks.md` Phase G3 (T-G.3.1 → T-G.3.20).

Status: software layer **complete**. Physical hardware lab procurement
**still required** to flip dialect entries from `pending-physical-test` →
`tested`.

---

## All files written

### Frontend — printer drivers (`frontend/src/hardware/printers/`)

- `types.ts` — `Dialect`, `Transport`, `PrintCommand`, `ReceiptModel`,
  `CashDrawerKick`, `DialectId`, `BarcodeType`, `TestPrintResult`.
- `dialects/_baseline.ts` — shared ESC/POS primitives (init, codepage,
  text, feed, cut, barcode, QR, drawer-kick); `makeBaselineDialect()` factory.
- `dialects/epson.ts` — TM-T20III / TM-T88VI / TM-m30 (`escpos-epson`).
- `dialects/xprinter.ts` — XP-T80A / XP-T80B (`escpos-xprinter`).
- `dialects/bixolon.ts` — SRP-330II / SRP-350III (`escpos-bixolon`).
- `dialects/generic_58mm_bt.ts` — Goojprt PT-210 / Rongta RPP02N / Sunmi
  V1s (`escpos-generic-58`).
- `dialects/generic_80mm.ts` — safe baseline 80mm fallback (`escpos-generic-80`).
- `dialects/index.ts` — `ALL_DIALECTS`, `DIALECT_BY_ID`, `getDialectById()`.
- `detection.ts` — `detectDialect(name, identifierBytes?, serviceUuids?)`;
  `buildIdentifierProbe()` / `buildStatusProbe()`.
- `commands.ts` — `printReceipt`, `cutPaper`, `kickDrawer`, `printQR`,
  `printBarcode`, `formatIQD`, `breakdownIQD`, `toArabicIndic`,
  `flattenCommands`, `debugTrace`.
- `printer-service.ts` — `PrinterService` façade with capability detection
  (`hasNativeBle`/`hasWebBluetooth`/`hasWebUsb`/`hasWebSerial`), 5
  transport implementations (`WebBluetoothTransport`, `WebUsbTransport`,
  `WebSerialTransport`, `NativeBleTransport`, browser-print fallback),
  `connect()`/`testPrint()`/`printReceiptModel()`/`sendCommands()`/`disconnect()`.
- `tests/printer-driver.test.ts` — **30 vitest cases**: baseline init, codepage map, cut
  variants (Epson `GS V B 3`, Xprinter `GS V 0`, Bixolon `GS V 1`,
  generic 58 `GS V 1`, none → 0 bytes), drawer matrix (Epson pin-2 50/150,
  Xprinter pin-5 200/200, Bixolon pin-5 25/120, override-by-pin), barcode
  EAN-13/CODE-128 byte assertions, QR sequence (model 2 → size → EC →
  store → print), `printReceipt` queue shape (ESC @ first, cut last,
  58 vs 80 column width, QR included when payload), and `detectDialect`
  classification across 7 inputs (Epson name, Xprinter name, Bixolon
  name, generic Goojprt name, unknown fallback, GS I 1 bytes, NUS service
  UUID hint).

### Frontend — cash drawer (`frontend/src/hardware/cash-drawer/`)

- `cash-drawer.ts` — `kickDrawer(config)`, `kickPin5()`, `kickPin2()`,
  per-dialect defaults via `DRAWER_DEFAULTS_BY_DIALECT`, fires through
  the active printer (drawers have no independent feedback channel).

### Frontend — scanner (`frontend/src/hardware/scanner/`)

- `scanner-service.ts` — HID keyboard-wedge global listener with
  inter-key-timing heuristic + Enter terminator, duplicate suppression,
  focus-respecting toggle; `useBarcodeInput()` React hook; symbology
  classifier (EAN-13/8, UPC-A/E, CODE-39/128, unknown); `startCameraScan()`
  delegates to existing `frontend/src/workers/barcode.ts` worker if
  present; `emitScannerReading()` lets native bridge push readings.
- `tests/scanner-service.test.ts` — **8 vitest cases**: symbology classification
  (EAN-13, EAN-8, UPC-A, CODE-128, unknown), rapid burst → HID emit,
  shorter buffer ignored, duplicate suppression, camera-path emit.

### Frontend — customer display (`frontend/src/hardware/customer-display/`)

- `types.ts` — `DisplayDescriptor`, `DisplayDriver`, `DisplayState`.
- `serial-driver.ts` — `SerialCustomerDisplay` for 20×2 VFD via Web Serial
  (Epson DM-D110 command set: ESC @, ESC l n m, 0x0c clear).
- `bluetooth-driver.ts` — `BluetoothCustomerDisplay` writes to Firestore
  `pos_display_state/{terminal_id}`; tablet PWA reads from there.
- `wifi-driver.ts` — `WifiCustomerDisplay` identical data path; optional
  wake-URL POST for smart-TV apps.
- `display-service.ts` — `DisplayService.{pairSerial,pairBluetoothTablet,
  pairWifi,updateLine1,updateLine2,showTotal,pushState,clearDisplay}`;
  pluggable `setDisplayStateWriter()` for tests.

### Frontend — receipt templates (`frontend/src/hardware/receipts/`)

- `Receipt58mm.tsx` — 32-column React component (1D barcodes, QR
  placeholder, change denomination breakdown, Arabic-Indic toggle, Hijri
  date row).
- `Receipt80mm.tsx` — 48-column React component (logo slot, full
  4-column line table, currency formatting).
- `ReceiptIQD.tsx` — IQD-specific wrapper (forces currency, auto-computes
  denominations via `breakdownIQD`, derives Hijri via Intl).
- `templates/standard.tsx` — canonical template + `SAMPLE_STANDARD`
  fixture for the preview drawer / Storybook.
- `templates/with-logo.tsx` — logo variant.
- `templates/arabic.tsx` — RTL container, Arabic-Indic digits on, Hijri
  enabled.
- `templates/restaurant.tsx` — augments footer with `tableNumber`,
  `serverName`, "KITCHEN COPY" watermark.

### Frontend — pairing wizard (`frontend/src/components/pos/`)

- `HardwarePairingWizard.tsx` — 7-step wizard component (device type →
  connection → discover → confirm → dialect detect/override → test-print
  & cut verify → drawer kick & save). i18n-pluggable translator; persists
  to `localStorage[pos.hardware.paired]`. Auto-fast-forwards display
  pairing past dialect/test-print stages. Exports
  `readSavedHardwareConfig()` and `clearSavedHardwareConfig()`.
- `TestPrintPreview.tsx` — renders `ReceiptIQD` preview for the chosen
  dialect + collapsible ESC/POS command trace.
- `HardwareDeviceCard.tsx` — discovered-device card with transport icon
  + RSSI bars.

### Frontend — data (`frontend/src/data/`)

- `hardwareRegistry.ts` — `PRINTERS` (10 entries), `SCANNERS` (5),
  `DRAWERS` (2), `DISPLAYS` (4) with USD pricing, status, notes;
  lookup helpers `findPrinterById()` etc.

### Backend (`backend/app/api/`)

- `tenant_hardware.py` — `GET/PUT/DELETE` for printers/scanners/drawers/
  displays at `/api/tenants/{tid}/hardware/<kind>[/<id>]`; aggregate
  `GET /api/tenants/{tid}/hardware`; `POST /api/tenants/{tid}/hardware/
  reset-defaults` (R3.15). Stored at
  `tenants/{tid}/hardware/{kind}/items/{id}` in Firestore with an
  in-process fallback dict for environments without Firebase creds.
  Cross-tenant access check via `org_id`. Exports `ALL_ROUTERS` for
  `main.py` registration.

### Mobile bridges (`mobile/src/bridge/`)

- `printer.ts` — added `DialectHint` type, `recommendedChunkSize(dialect)`
  (Epson 200B, Bixolon 180B, Xprinter 160B, generic-58 120B),
  `setDialectHint`/`getDialectHint`; native print loop now uses the
  dialect-aware chunk size.
- `scanner.ts` — added `unifiedScanner.startUnified(onResult)` that ties
  the ML Kit native path with `emitScan()` so callers subscribe once and
  receive scans from any source.

### Docs (`docs/`)

- `hardware/compatibility-matrix.md` — printer/scanner/drawer/display
  tables with status + USD + dialect; dialect coverage table; Iraqi
  market sources; regression cadence (quarterly).
- `hardware/setup-guides/epson-tm-t20iii.md`
- `hardware/setup-guides/xprinter-xp-t80a.md`
- `hardware/setup-guides/bixolon-srp-330ii.md`
- `hardware/setup-guides/generic-58mm-bt.md`
- `hardware/troubleshooting.md` — 5 sections (pairing failures, encoding
  issues, paper feed, cash drawer, scanner, display) with symptom →
  cause → fix tables.
- `sales/hardware-kits.md` — Kit A/B/C bundle pricing in USD, partner
  economics (6 % referral + SaaS uplift), outreach plan W4–W7, sign-off
  criteria, anti-patterns.

---

## Dialect coverage

| Dialect | Cut behaviour | Drawer default | Identifier bytes captured |
|---------|--------------|----------------|---------------------------|
| `escpos-epson` | `GS V B 3` (full + feed 3) | pin 2 / 50/150 ms | "EPSON" prefix; TM-T88VI byte 0x29 + "EPSON" |
| `escpos-xprinter` | `GS V 0` (full only — partial is buggy) | pin 5 / 200/200 ms | "XP-T80A", "XP-T80B", "XPRINTER" |
| `escpos-bixolon` | `GS V 1` (partial default — full is loud) | pin 5 / 25/120 ms | "BIXOLON", "SRP-330", "SRP-350" |
| `escpos-generic-58` | `GS V 1` (may no-op on cutterless units) | pin 2 / 100/200 ms | "PT-210", "RPP", "Sunmi" |
| `escpos-generic-80` | `GS V mode` baseline | pin 2 / 50/150 ms | none (fallback) |

---

## Compatibility matrix snapshot (Q2 2026)

- **Printers:** 10 entries (3 Epson, 2 Xprinter, 2 Bixolon, 3 generic 58mm).
- **Scanners:** 5 entries (2 HID-USB, 2 HID-BT, 1 camera).
- **Drawers:** 2 entries (pin-5 standard, pin-2 alternate).
- **Displays:** 4 entries (1 known-good serial VFD, 1 generic VFD, 1 BT-PWA, 1 WiFi-PWA).
- **Status:** 1 ✅ tested (in-app camera), 3 ✅ tested (PWA displays), all
  physical printers / scanners / drawers / VFDs are 🧪 pending or 💬 community.

---

## Test counts

| File | Cases |
|------|-------|
| `frontend/src/hardware/printers/tests/printer-driver.test.ts` | 30 |
| `frontend/src/hardware/scanner/tests/scanner-service.test.ts` | 8 |
| **Total new tests** | **38** |

Tests have not been executed in this session (no shell access in this
environment); each is written to be self-contained against vitest +
jsdom and uses no Firebase / Capacitor imports. CI run is expected on
the next push.

---

## Hardware to physically procure (top-5 priority, ~USD 720 total)

| # | Device | Cost USD | Why first |
|---|--------|----------|-----------|
| 1 | Epson TM-T20III | 220 | Reference dialect; every other Epson maps to it; captures GS I 1 ID bytes for the detection table. |
| 2 | Xprinter XP-T80B (BT variant) | 95 | Validates the doubled drawer-pulse override + BLE pairing path; covers ~40 % of Iraqi market value SKUs. |
| 3 | Bixolon SRP-330II | 180 | Validates partial-cut behaviour + CP864 firmware path; covers the premium tier. |
| 4 | Goojprt PT-210 (58mm BT) | 22 | Validates the no-cutter + low-MTU paths; covers the long tail of generic 58mm imports. |
| 5 | Symbol/Zebra LS2208 (USB HID scanner) + 6-pin cash drawer + 8" Android tablet | ~200 | Closes the rest of the kit so the wizard can be end-to-end tested in the shop simulator. |

After procurement, the lab work is:
- Capture each device's `GS I 1` response → append to `knownIdentifiers`
  in each dialect file. Bumps the detection-confidence tier.
- Record actual byte streams during a real test-print → save as vitest
  fixtures alongside `printer-driver.test.ts` (the test scaffolding is
  ready; the fixtures are the missing pieces).
- Flip `status: 'pending-physical-test'` → `'tested'` in
  `hardwareRegistry.ts`.
- Republish `compatibility-matrix.md`.

Budget the lab work at **2 engineer-days per device** for capture +
fixture authoring. Total: 10 days for the top-5.

---

## Pending / out of scope

- **Logo rasterisation** — `Receipt80mm` reserves a `logoPngDataUrl`
  slot; the dialect layer's bitmap path (`ESC * m nL nH d…`) is not
  implemented. Needs a known-good logo fixture from the lab.
- **Network transport** — `printer-service.ts` lists `'network'` but
  throws; the Capacitor `socket` plugin needs to be wired in
  `mobile/src/bridge/` before this can land.
- **Sunmi SDK passthrough** — Sunmi terminals expose a proprietary
  printing API that's more efficient than ESC/POS-over-BLE; today we
  use the generic-58 dialect. A future ticket should add a `'sunmi'`
  dialect and wire the SDK in the mobile bridge.
- **Star Micronics dialect** — listed in `cash-drawer.ts` defaults but
  no `dialects/star.ts` file; Star printers are rare in Iraq (target
  market is Japan / North America) so deferred to v2.

---

## Open questions

1. **e-Fakhata QR payload format** — `ReceiptIQD` and `printReceipt`
   accept an arbitrary `qrPayload` string. The MoF spec (per `design.md`
   §4.1) uses an XML-derived JWT-like blob. Confirm with the e-Fakhata
   spec owner whether the QR carries the full XML or a signed reference
   URL.
2. **CP864 vs UTF-8 for Sorani Kurdish** — CP864 lacks some Sorani
   vowel characters. UTF-8 requires firmware ≥ K.B6 on Epson, ≥ 1.0F
   on Bixolon. Should the wizard refuse to pair on older firmware, or
   silently transliterate?
3. **Drawer alarm on slam** — should the wizard detect that pulse-off
   is too short (drawer slams), or leave it to operator self-tuning?
   Heuristic: pulse-off < 100 ms triggers a warning toast.
4. **Tenant-side hardware encryption at rest** — paired BLE MACs are
   stable identifiers and could enable cross-tenant device fingerprinting
   if leaked. Should `tenant_hardware.py` hash the `transport_id` before
   storage, or rely on Firestore-level encryption?
5. **`main.py` registration** — per the working agreement on this
   session, I do not edit `backend/app/main.py`. The user must add:
   ```python
   from app.api import tenant_hardware as tenant_hardware_api
   for r in tenant_hardware_api.ALL_ROUTERS:
       app.include_router(r)
   ```
   No new dependencies are introduced (Pydantic + FastAPI only); no
   `requirements.txt` change needed.

---

## TODOs for the user

1. Register `tenant_hardware.ALL_ROUTERS` in `backend/app/main.py` (see
   §"Open questions" #5).
2. Add a route entry in `frontend/src/App.routes.tsx` for the wizard at
   `/pos/settings/hardware/pair` (the wizard is self-contained so wiring
   is one line).
3. Procure the top-5 hardware list (~USD 720) for the physical lab.
4. Hire / contract a Baghdad-based engineer for the quarterly device
   regression (per R3.14).
5. Kick off the vendor-partnership outreach in `docs/sales/hardware-kits.md`
   (Founder track, W4–W7).
