# Xprinter XP-T80A — setup guide

> The value-tier 80mm USB thermal printer. Same chassis as the BT variant T80B; the only difference is the comms module.

## Box contents

- Xprinter XP-T80A
- 24V power brick
- USB-A → USB-B cable
- 80mm thermal paper roll (often a short demo roll — buy a 6-pack separately)

## First-time install

1. Plug power. Self-test: hold Feed + power-on for 4 s.
2. Plug USB. Windows installs as a generic POS printer. macOS: no driver; we drive it directly via WebUSB.
3. POS → **Settings → Hardware → Pair printer**.
4. Step 2: **USB**.
5. Step 4: pick `XP-T80A` (vendor 0416 or 1659 depending on batch).
6. Step 5: auto-detect resolves to `escpos-xprinter`.
7. Step 6: test print. **Important** — XP-T80A does not support partial cut on most firmware; the dialect always emits full cut. Confirm cut is clean.
8. Step 7: drawer pin 5 by default. If yours is wired pin 2, switch in the wizard.

## Known quirks

- **Doubled drawer pulse:** the T80A's microcontroller interprets the ESC p timing bytes as 1 ms (not 2 ms) on some firmware. Our dialect compensates by sending 100/100 (= 200/200 ms wall clock). If your drawer still doesn't fire, manually set 150/150 in advanced settings.
- **No native UTF-8 on older firmware:** drop to CP864 codepage for Arabic. Kurdish characters that map outside CP864 (some accented Sorani vowels) will appear as boxes — there's no fix short of upgrading firmware or switching to an Epson TM-T20III.
- **BLE pairing on T80B:** advertised name varies (`XP-T80B`, `XPRINTER`, `Printer`). The dialect detector handles all three.

## When to escalate

- Print head fades after ~50 receipts → known thermal-coating issue with some Iraqi paper imports. Switch to genuine 80mm thermal (e.g. Epson-branded).
- Wifi variant in a humid shop: enclose in a vented dust cover. Salt-laden coastal air kills the Wifi module within 6–12 months.
