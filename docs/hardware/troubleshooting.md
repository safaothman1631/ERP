# Hardware troubleshooting

> Symptom → most-likely cause → fix. When the wizard's auto-detection fails, this guide is the path to first-try success in the shop.

## Pairing fails

| Symptom | Cause | Fix |
|---------|-------|-----|
| Wizard step 3 finds no devices | Web Bluetooth not enabled in browser | Use Chrome / Edge ≥ 109. On Linux, run with `--enable-features=WebBluetoothEnabled`. On Capacitor mobile, ensure the `@capacitor-community/bluetooth-le` plugin is installed. |
| BT printer found but won't connect | Printer paired previously to another device | Power-cycle the printer; on Goojprt PT-210 hold Feed + power-on for 10 s to factory-reset BT. |
| USB printer not in step 3 list | WebUSB blocked by OS driver | Windows: Uninstall the `USB Printing Support` driver in Device Manager, replug. Chrome will then claim the device directly. |
| "GATT service not found" error | BLE printer advertises a non-standard service UUID | Manually pick `Generic 58mm Bluetooth` or `Generic 80mm`; the wizard will skip dialect probing and use baseline ESC/POS. |
| Wizard hangs on "Detecting dialect" | Printer doesn't respond to GS I 1 | Wait 5 s; the probe times out and the wizard falls back to name-based detection. If still wrong, override manually in step 5. |

## Encoding / printing issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Arabic / Kurdish prints as boxes | Firmware lacks UTF-8 + CP864 not selected | In the wizard's advanced panel, set codepage = `CP864`. If Sorani vowels still fail, upgrade printer firmware (Epson ≥ K.B6, Bixolon ≥ 1.0F). |
| Latin text fine, numbers garbled | Codepage mismatch between Arabic-Indic toggle and printer | Disable "Arabic-Indic digits" in the receipt template OR ensure codepage supports CP720. |
| Receipt prints mirror / upside-down | Cheap printers in some Iraqi imports ship reversed | Send `ESC { 1` (upside-down mode) via Advanced → Raw send. We'll add a toggle in v2. |
| Logo prints as random pattern | Bitmap not pre-rendered to monochrome | The dialect's logo path is stubbed; today, embed the logo into the receipt template as a plain image and let the OS-print fallback handle it. |
| Last line of receipt is cut off | Cut command fires before the feed completes | Increase the cut delay in advanced settings from 50 to 150 ms. |
| Cut leaves a strip of paper attached | Bixolon partial cut is intentional | This is by design — toggle "full cut" in step 6 if you prefer. |

## Paper feed / mechanical

| Symptom | Cause | Fix |
|---------|-------|-----|
| Paper jams every 5–10 receipts | Paper roll is too thick or has a 8mm core in a 12mm holder | Replace with a properly-sized roll. Generic Iraqi-import rolls vary by 1–2mm. |
| Print head fades after ~1 km of paper | Print head wear | Replace head (Epson, Bixolon: ~6-week lead time via Iraqi distributors). |
| Paper feeds but no print | Print head not engaged | Open the lid, manually push the head down until you hear a click. |
| Paper sensor reports "out" with paper loaded | Sensor blocked by dust | Compressed-air the sensor; common after a shop cleanup. |

## Cash drawer

| Symptom | Cause | Fix |
|---------|-------|-----|
| Drawer doesn't fire on pin 2 | Drawer is wired pin 5 | Re-run wizard step 7, try pin 5. |
| Drawer fires both pin 2 and pin 5 spuriously | Crossed wiring inside the RJ-12 cable | Replace cable — pin-1 ground may be miswired. |
| Drawer fires but slams shut | Pulse-off is too short | Increase pulse-off to 250 ms in advanced settings. |
| Drawer never closes electronically | Drawer is mechanical-only; software cannot close it | Expected — you push it closed by hand. |

## Barcode scanner

| Symptom | Cause | Fix |
|---------|-------|-----|
| Scanner beeps but POS doesn't react | Scanner not in HID mode | Most scanners ship in HID by default; if yours is in serial-emulation, scan the "USB HID keyboard" config barcode in the scanner manual. |
| Scans missing characters | Inter-key timing too tight | Bump `maxInterKeyMs` from 60 to 120 in advanced settings. |
| Scans appear in the focused text field instead of POS | Focus stealing | The default config respects focus; manually toggle `respectFocus: false` to capture globally. |
| BT scanner unpairs randomly | Scanner power-save kicked in | Disable power-save in the scanner's config menu (scan a printed config barcode from the vendor). |

## Customer display

| Symptom | Cause | Fix |
|---------|-------|-----|
| LCD pole shows random characters | Wrong codepage | The serial driver assumes 8-bit clean. Set `ESC R 11` (Latin-Arabic) via the advanced panel. |
| BT tablet display lags behind cart | Firestore subscription not connected | Check the tablet has internet; the display PWA falls back to last-known state when offline. |
| Smart TV displays "Cannot reach server" | Local network blocks Firestore | Allow `firestore.googleapis.com` on the shop router whitelist. |

## When to escalate

If the symptom doesn't match anything above, capture:

1. Printer model + firmware (printed on the self-test page).
2. Browser version (Chrome → `chrome://version`).
3. The ESC/POS command trace from step 6 of the wizard (toggle "Show trace").
4. A photo of the failure (jammed paper, garbled text).

Send to `support@zoho-kurdish.iq`. The hardware-lab team runs a regression against the captured trace within 48 hours.
