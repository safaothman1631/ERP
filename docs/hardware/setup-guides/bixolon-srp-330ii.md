# Bixolon SRP-330II — setup guide

> The premium-tier alternative to Epson. Quieter cut, fast warm-up, generous paper sensor. Sold by NurNet (Baghdad) and SaraTech (Sulaymaniyah).

## Box contents

- Bixolon SRP-330II
- 24V power brick (proprietary connector)
- USB-A → USB-B
- Roll of 80mm thermal paper
- Drawer kick cable (some SKUs)

## First-time install

1. Plug power. Self-test: hold Feed during power-on.
2. Plug USB.
3. POS → **Settings → Hardware → Pair printer**.
4. Step 2: **USB**.
5. Step 4: pick `SRP-330II` (vendor 1504).
6. Step 5: auto-detect resolves to `escpos-bixolon`.
7. Step 6: test print. The default dialect uses **partial cut** (GS V 1) because full cut is noisy on SRP-330II. Toggle to full cut in advanced settings if you prefer.
8. Step 7: drawer pin 5 by default. Bixolon's pulse is 25/120 ms (shorter than Epson) — this is correct, do not override.

## Known quirks

- **Cut leaves an attached corner:** SRP-330II's partial cut intentionally leaves ~1.5 mm at one edge so the receipt doesn't fall to the floor. If your shop layout means receipts get caught, switch to full cut.
- **Codepage 864 not supported on firmware < 1.0F:** check the self-test page firmware. Pre-2022 units ship 0.x firmware and need a Bixolon service-centre flash. If you cannot upgrade, use CP437 with Latin-script item labels only — Arabic/Kurdish won't render.
- **WiFi variant requires an SD card initialization step.** The pairing wizard does not perform this; consult the Bixolon Web Configuration manual.

## When to escalate

- Print head replacement is required after ~75km of paper. Bixolon Iraq distributors do RMA in ≤ 2 weeks.
