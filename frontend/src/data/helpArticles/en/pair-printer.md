# Pair a receipt printer

Most thermal printers used in Iraq are ESC/POS-compatible: Epson TM series, Bixolon, Star Micronics, and Chinese OEMs that copy them. Zoho Kurdish supports all of them.

## What you need

* A 58mm or 80mm thermal receipt printer.
* Either a Bluetooth or USB connection — Web Bluetooth needs Chrome or Edge.
* The printer powered on.

## Pair over Bluetooth

1. Open **Settings → Hardware → Printers**.
2. Click **Pair new printer**.
3. The browser pops the Bluetooth picker — choose your device.
4. Pick the paper width (58 or 80mm).
5. Choose the cash-drawer pin (most printers wire it to pin 2; some use pin 5).
6. Click **Test print**. A receipt with a barcode should come out.

## Pair over USB

USB printers require a one-time install of the platform print agent. Download it from the same screen; we have builds for Windows, macOS, and Linux. After install, refresh the page and follow the Bluetooth steps.

## Multiple printers

You can pair multiple printers — for example, one at the counter, one in the kitchen. Each printer can be assigned to a specific outlet or to a kitchen-display category.

## Common issues

* **No paper** — the printer's status LED blinks. Replace the roll.
* **Garbled characters** — wrong codepage. Pick "Arabic 864" or "Windows-1256" in printer settings.
* **Cash drawer doesn't open** — try the other pin (2 ↔ 5).

## Related

* Cash drawer management
* Kitchen display system
