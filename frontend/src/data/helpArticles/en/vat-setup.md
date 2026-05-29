# VAT setup

Value-added tax in Iraq is not yet universal — Kurdistan Region applies a regional sales tax, while federal Iraq is rolling out VAT in phases. Zoho Kurdish makes both work.

## Pick your tax model

**Settings → Taxes → Region**. Pick:

* **Kurdistan Region** — applies KRG sales tax.
* **Federal Iraq** — applies the federal tax schedule.
* **Mixed** — supports both. Pick per location.

## Tax groups

A tax group bundles one or more tax rates. We pre-load common groups:

* Standard rate (currently 0% federal, varies in KRG)
* Exempt
* Zero-rated exports

## Assign to items

Each item gets a default tax group. Customers can override (e.g. a tax-exempt government entity).

## Receipt display

Receipts and invoices show the tax line per group, the total, and the registration number. For invoices over the threshold, the e-Fakhata QR code is added automatically.

## Common issues

* **Wrong tax rate on receipt** — check the item's tax group first, then the customer override.
* **Threshold confusion** — the e-Fakhata threshold is set per region. Confirm in Settings.

## Related

* Withholding tax
* Tax rates per region
