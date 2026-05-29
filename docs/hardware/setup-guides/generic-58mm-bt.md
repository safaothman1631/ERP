# Generic 58mm Bluetooth thermal — setup guide

> For Goojprt PT-210, Rongta RPP02N, Sunmi V1s integrated, and any of the dozens of rebadged Chinese 58mm BT thermals sold on AliExpress and Iraqi retail apps. These all speak the same baseline ESC/POS — they are also all unreliable to varying degrees.

## Box contents

- 58mm BT thermal printer
- Micro-USB charging cable (no power brick)
- 1× 58mm thermal paper roll
- Manual (often in Chinese only)

## First-time install

1. Charge the printer 2 hours before first use. Most units ship at 5 % charge and won't hold a Bluetooth connection until ~30 %.
2. Hold the power button 3 s. The status LED should turn blue (BT pairing mode).
3. **On a desktop PC:** Chrome / Edge → POS → **Settings → Hardware → Pair printer** → Bluetooth → Scan.
4. **On an Android tablet (Capacitor app):** the OS BT pairing pane opens — pair from there first, then return to the wizard.
5. Step 4: pick the printer (advertised name varies; common: `BT-Printer`, `PT-210`, `RPP`).
6. Step 5: auto-detect should resolve to `escpos-generic-58`. If the BLE name is unfamiliar, manually pick **Generic 58mm Bluetooth** from the list.
7. Step 6: test print. **There is no cutter** — the printer will feed paper, not cut it. Confirm the receipt is readable, mark "Cut OK" (the wizard treats this as "no cutter — receipts torn by hand").
8. Step 7: no cash drawer connector on most 58mm units. Pick **No drawer**.

## Known quirks

- **No native cutter:** all 58mm BT thermals feed and the operator tears. The receipt template adds extra feed lines to avoid the print head clipping the last line.
- **MTU drops at chunks > 120 bytes:** the dialect chunks BLE writes to 120 B to avoid the firmware dropping frames silently. If receipts come out half-printed, drop further to 80 in advanced settings.
- **No GS I 1 response:** most generic BT modules don't echo. Detection falls back to the BLE-advertised name pattern. If the name is fully generic (`Printer`), manual override is required.
- **Battery dies during long receipts:** with 30+ line receipts at low battery, the printer cuts mid-print. Plug it in during the lunch rush.
- **Arabic/Kurdish:** firmware-dependent. Most units ship with CP437 only. For Arabic, you must rasterize text → bitmap → send via ESC * — not yet implemented in the dialect layer.

## When to escalate

- Printer drops Bluetooth every ~5 minutes → known issue with HC-08-based units in WiFi-dense environments. Move to a quieter 2.4 GHz channel on the shop router.
- Print head fades after ~1 km of paper → these are not designed for high-volume shops. Replace, do not RMA.
