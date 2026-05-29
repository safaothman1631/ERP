# Batches and expiry

Batches (also called lots) track sub-groups of an item with shared properties — same manufacturing date, same expiry, same supplier batch.

## Enable batches

On the item record, toggle **Track in batches**. New stock receipts must specify a batch ID and (optionally) an expiry date.

## Receive batches

On a purchase receipt, each line asks for batch ID and expiry. If you scan a barcode that encodes the batch, the form auto-fills.

## Sell from batches

By default, the POS sells the oldest batch first (FIFO). You can change this to LIFO or "FEFO" (first-expiry-first-out) per item from inventory settings.

## Expiry alerts

The dashboard shows batches expiring in the next 30 days. You can run promotions on near-expiry batches via discount rules tied to expiry date.

## Compliance

For pharmacy and food, batch + expiry tracking is mandatory. The receipt prints the batch ID and expiry next to the line, which satisfies most local regulations.

## Related

* Add an item
* Low-stock alerts
