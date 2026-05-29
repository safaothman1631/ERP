# Void a sale

Voiding cancels a sale that was rung up by mistake before the cash drawer closed. The transaction is reversed and the receipt is printed with VOID across it.

## When to void vs refund

* **Void** — the sale just happened, the customer hasn't left, no money has changed hands.
* **Refund** — money was already taken; the customer is returning goods. See *Refunds*.

## How to void

1. Open the POS terminal.
2. Tap the active cart (top of the screen).
3. Tap **Void** in the action menu.
4. Pick a void reason — wrong item, customer changed mind, training, other.
5. Confirm.

The cart clears, no journal entry is posted, and the action is logged with your user ID for audit.

## Permission

By default only cashiers and managers can void. Custom roles can grant or revoke `pos.void`.

## Audit trail

Every void is visible under **Reports → POS → Voids**. The report shows who voided, when, the items, and the reason.

## Related

* Refunds
* End-of-day close
