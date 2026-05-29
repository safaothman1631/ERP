# Epson TM-T20III — setup guide

> The reference 80mm USB thermal printer. The dialect generator targets this device first; all other dialects are deltas from this baseline.

## Box contents

- Epson TM-T20III printer
- IEC power cable + 24V brick (PSAC25E)
- USB-A → USB-B cable
- Roll of 80mm thermal paper (80×80×12mm core)
- Drawer kick cable (RJ-12) — sold separately on some SKUs

## First-time install (Windows POS)

1. Plug power. Hold the Feed button while powering on to print a self-test page — confirm the firmware version is **≥ K.B6** (required for UTF-8 Arabic). If older, request firmware update from supplier.
2. Plug USB. Windows installs it as `USB Printing Support` automatically.
3. In Kurdish-ERP POS, open **Settings → Hardware → Pair printer**.
4. Step 1: pick **Printer**.
5. Step 2: pick **USB**.
6. Step 3: click **Scan** — Chrome will pop a permission prompt. Approve.
7. Step 4: select `TM-T20III` (vendor 04b8).
8. Step 5: click **Detect automatically** — should resolve to `escpos-epson` (high confidence).
9. Step 6: click **Print test page**. Verify Arabic/Kurdish renders. Tap **Cut OK**.
10. Step 7: connect the cash drawer to the RJ-12 jack on the rear. Click **Kick pin 2**. The drawer should fire. Save.

## Common adjustments

- **Cut too tight at top of next receipt:** firmware default feed is 0; the dialect emits `GS V B 3` (feed 3 then cut) — should be fine. If your TM-T20III ships with very thin paper, bump to 4 lines via the wizard's "Advanced" panel.
- **Drawer not firing on pin 2:** TM-T20III also supports pin 5 (legacy). Re-run step 7 with pin 5.
- **Garbled Arabic:** firmware < K.B6 doesn't speak UTF-8. Switch the codepage to `CP864` in the wizard's advanced panel and re-test.

## Linux notes

Linux users on the desktop app: the Web USB path works via Chrome ≥ 119 with the `chrome://flags/#enable-experimental-web-platform-features` toggle. Or, plug via Bluetooth-to-USB serial adapter and use the Serial transport.

## When to escalate

- Firmware version field is missing from the self-test page → contact Epson local distributor (see `compatibility-matrix.md` for vendors).
- Self-test page prints garbled lines → bad print head, RMA.
- USB cable disconnects after every ~10 prints → ground loop. Plug printer and POS PC into the same UPS / surge strip.
