# Refunds

A refund returns money to a customer for goods they brought back or for a service they didn't receive. Refunds are recorded against the original sale and reverse stock.

## Issue a refund

1. From POS, tap **Find sale**. Scan the receipt barcode or search by phone.
2. The sale opens. Tap **Refund**.
3. Check the items to refund — you can refund partially.
4. Choose the refund tender — cash, card, store credit.
5. Confirm.

A refund receipt prints. Stock returns to the source location. A reversing journal entry is posted.

## Refund without a receipt

If the customer lost their receipt, a manager override lets you refund based on item and a flat price. The audit log records the override.

## Card refunds

For card sales via Stripe or a local provider, the refund flows back to the original card automatically. For COD or invoice sales, refund is recorded only — you settle separately.

## Common issues

* **Refund rejected** — the original sale was older than your refund window (default 30 days). Adjust under **Settings → POS → Refund window**.
* **Wrong amount refunded** — see the audit log to identify the cashier; void the wrong refund and issue a corrected one.

## Related

* Void a sale
* Mark an invoice as paid
