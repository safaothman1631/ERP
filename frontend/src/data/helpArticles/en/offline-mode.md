# POS offline mode

Iraqi internet drops happen. Zoho Kurdish keeps selling when it does. The POS terminal stores cart, sale, and payment data in IndexedDB; when connectivity returns, the data syncs to the cloud automatically.

## How it works

The first time you open the POS, we cache:

* All items in your active location.
* All customers tagged as "POS-eligible".
* Current prices and tax rates.

While offline:

* Ring up sales normally.
* Print receipts (printer doesn't need the internet).
* Accept cash and recorded-card tenders.

You **cannot** while offline:

* Charge a card through the integrated gateway (no online auth).
* Look up new items not in the cache.

## Coming back online

When the device reconnects, a banner shows "Syncing N transactions…". The outbox drains in order — usually < 5 seconds for a normal shift.

## Conflict resolution

If the same item was sold both offline and online (rare), the system reconciles stock on sync. Negative-stock alerts surface in the dashboard.

## Best practices

* Run an end-of-day close before going home so the outbox is empty.
* Keep a cellular dongle as backup — even a slow connection drains the outbox.

## Related

* End-of-day close
