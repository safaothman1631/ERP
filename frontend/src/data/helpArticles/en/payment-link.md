# Share a payment link

Every Zoho Kurdish invoice can be paid through a hosted payment page. The link is short and works on any device.

## Generate the link

From an invoice, click **More → Get payment link**. The system returns a URL like:

```
https://pay.zoho-kurdish.iq/i/<short-token>
```

The link is short-token signed and expires when the invoice is paid or 30 days after the invoice date — whichever comes first.

## What the customer sees

The hosted page shows the invoice in their preferred language, with the total prominent and a "Pay now" button. They can pay via:

* Card (Stripe)
* FastPay / Qi / Zain Cash / Asia Pay (Iraqi providers)
* Cash on delivery (if your settings allow)

## Auto-mark as paid

When a gateway confirms the payment via webhook, the invoice is marked paid automatically and a receipt is sent.

## Common issues

* **Link expired** — generate a new one.
* **Customer paid but invoice still shows unpaid** — webhook latency. Refresh after a minute; if still unpaid, reconcile from **Banking → Reconciliation**.

## Related

* Send invoice via WhatsApp
* Mark an invoice as paid
