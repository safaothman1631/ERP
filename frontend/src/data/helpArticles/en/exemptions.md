# Tax exemptions

Some items, customers, and transactions are exempt from sales tax under Iraqi or KRG law. Zoho Kurdish models exemption at three layers: item, customer, and transaction.

## Item exemption

For categorically exempt items — basic foodstuffs, certain medical supplies — set the tax group to **Exempt** on the item record. Every sale of that item, to any customer, will show 0 tax.

## Customer exemption

For entities that are exempt by their nature — government bodies, embassies, registered NGOs — tag the customer **Tax exempt** with the exemption certificate ID. All their invoices show 0 tax with the certificate ID printed.

## Transaction exemption

For one-off exemptions — e.g. an export sale — tick **Tax exempt for this invoice** on the invoice header. A reason is required and logged.

## Reports for the auditor

The **Tax → Exemption report** lists all exempt transactions with reasons and supporting documentation, ready for the auditor.

## Related

* VAT setup
