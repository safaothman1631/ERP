# End-of-day close

The end-of-day close (sometimes called the Z-report) is the cashier ritual that closes the till, prints a summary, and locks the shift so a new shift can start fresh.

## What it does

1. Counts cash by denomination.
2. Computes expected closing balance from opening float + cash sales − cash out + cash in.
3. Records the variance.
4. Prints a Z-report with sales totals by category, tender, and tax.
5. Locks the shift.

## Walk-through

1. Sign in to POS with the cashier or manager role.
2. Tap the cashier tile (top right) → **End of shift**.
3. Type the count for each denomination.
4. Confirm. If variance > threshold (default 5000 IQD), a manager PIN is required.
5. The Z-report prints. File it.

## After close

* No more sales can be rung up against the closed shift.
* A new shift starts when the next cashier signs in.
* The outbox flushes any offline transactions before closing.

## Reports for the manager

* **Today's sales** — top of the dashboard.
* **Sales by hour** — useful for staffing.
* **Variance log** — recurring large variances signal training or fraud.

## Related

* Cash drawer management
* POS offline mode
