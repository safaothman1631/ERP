# Iraqi Retail Edge-Case Tracker (T-SF.6.18)

> Spec: scale-foundation SF6. **Maintain ≥ 30 entries by end of phase.** Owner: Support Lead. Ongoing.
>
> This is a **living tracker**. Every edge case a pilot hits gets a row here, a severity, and a status. Seed entries below are real, plausible Iraqi-retail situations drawn from how shops in Erbil / Sulaymaniyah / Baghdad / Mosul actually operate. Each is written as: the situation, why it bites in Iraq specifically, what the product should do, and where it's handled in the codebase (so engineering can find it fast).

## Legend

- **Severity** uses the pilot SLA (design §6.4): **P0** can't transact / data/money wrong; **P1** major; **P2** has a workaround; **P3** polish.
- **Status:** `open` (no handling yet) · `workaround` (documented manual workaround, fix pending) · `partial` (handled in some flows) · `handled` (believed covered — verify with pilots) · `wontfix` (deliberately out of scope, with reason).
- **Sector tags:** 🛒 supermarket · 🍽️ restaurant · 💊 pharmacy · 🔧 hardware · 📱 electronics · ⚙️ all.

---

## A. Money, currency & rounding

### EC-01 — IQD has no sub-dinar; everything must round to whole dinars (often to 250/500) ⚙️ — P1
**Situation:** Iraq has no coins in practical circulation below 250 IQD; most shops price and tender in multiples of 250 or 500. A 15% VAT or a unit-price calc easily yields 1,873.5 IQD, which cannot be paid.
**Why it bites here:** A system that shows fractional dinars or expects 1-dinar change looks broken to a shopkeeper and creates till mismatches.
**Expected behaviour:** Display and total in whole IQD (thousands separator `٬` U+066C); configurable cash-rounding to the nearest 250/500 on the *cash total* with the rounding delta posted to a "rounding" account; card/electronic totals stay exact. Never show decimals for IQD.
**Where handled:** `frontend/src/utils/iqd-denominations.ts` (DENOMINATIONS, breakDown, format), `backend/app/pdf/iraqi_formatter.py` (IQD U+066C). Rounding-to-account posting: **verify** in transaction write model `backend/app/firestore/write_models/transactions.py`.
**Status:** partial — formatting handled; cash-rounding-to-account needs pilot verification.

### EC-02 — Dual pricing USD + IQD on the same ticket 📱🔧🛒 — P1
**Situation:** Electronics/hardware shops quote big-ticket items in USD ("this laptop is \$450") but the customer pays IQD at that day's rate, sometimes splitting (\$400 cash USD + remainder IQD).
**Why it bites here:** The USD↔IQD street rate moves; the receipt must show the rate used and the IQD equivalent, and the books must record both.
**Expected behaviour:** Per-line or per-invoice currency with a captured conversion rate; receipt prints both currencies + the rate; split tender across USD and IQD; the GL records the functional-currency amount.
**Where handled:** `backend/app/services/currency_converter.py`, `backend/app/services/cbi_rates.py` (CBI daily rate + fallback), `frontend/src/components/.../CurrencyConverter.tsx`, `frontend/src/hooks/useCBIRate.ts`.
**Status:** partial — converter + CBI rate exist; split USD/IQD tender at POS needs verification.

### EC-03 — Customer pays partly in USD cash, change given in IQD 📱🔧 — P1
**Situation:** Customer hands \$100 for a 96,000 IQD bill; shop returns IQD change at the shop's rate.
**Why it bites here:** Change crosses currencies. Naive change math is wrong; the drawer now holds mixed currency.
**Expected behaviour:** Tender screen accepts a USD amount, converts at the entered/【CBI】rate, computes IQD change, and records two cash movements (USD in, IQD out).
**Where handled:** POS tender flow `frontend/src/hooks/usePOSTerminal.ts` + `frontend/src/stores/posCart.ts`; cash-drawer breakdown `frontend/src/components/.../CashDrawerBreakdown.tsx`.
**Status:** open — cross-currency change needs explicit support; today likely a manual workaround.

### EC-04 — Stale or disputed USD/IQD rate when CBI feed is unreachable ⚙️ — P2
**Situation:** The shop opens, the CBI rate service is down or the shop is offline; the cashier still needs a rate.
**Why it bites here:** Iraqi connectivity is intermittent; a hard dependency on a live rate halts USD sales.
**Expected behaviour:** Use last-known CBI rate with a visible "as of <date>" badge and a 7-day fallback; allow a manual per-day override the owner sets each morning.
**Where handled:** `backend/app/services/cbi_rates.py` (7-day fallback + hardcoded 1320 floor), `frontend/src/hooks/useCBIRate.ts`.
**Status:** handled (fallback exists) — verify the manual morning-override UX with pilots.

### EC-05 — Price haggling / on-the-spot discount in the bazaar 🔧🛒📱 — P2
**Situation:** Final price is negotiated ("give it to me for 90 instead of 100"). The cashier needs to drop the line/total fast without editing the catalogue.
**Why it bites here:** Haggling is the norm in much of Iraqi retail; a rigid price list slows the sale.
**Expected behaviour:** Quick line-level and ticket-level discount (amount or %), permission-gated, that still records the original price and the discount for margin reporting.
**Where handled:** POS cart discount logic `frontend/src/stores/posCart.ts`; permission check via `usePermission` / `backend/app/services/permissions.py`.
**Status:** partial — verify discount is captured (not just overwritten) for reporting.

### EC-06 — Tip / "service" and "round up for me" in restaurants 🍽️ — P3
**Situation:** Diner says "keep the change" or adds a tip; some cafés add an optional service line.
**Why it bites here:** Tipping is informal and inconsistent; staff need a one-tap way without distorting item revenue.
**Expected behaviour:** Optional tip/round-up line separate from item revenue and from VAT base; reportable separately.
**Where handled:** POS cart `frontend/src/stores/posCart.ts`; receipt template `frontend/src/components/pos/ReceiptTemplate80mm.tsx`.
**Status:** open.

---

## B. Power, connectivity & offline

### EC-07 — Mid-sale power cut; tablet/printer die before the receipt prints ⚙️ — P0
**Situation:** Grid power drops (common, multiple times/day in summer) while a sale is being rung up; the tablet runs on battery but the printer (mains) is dead.
**Why it bites here:** Daily reality across Iraq. If the sale is lost or double-charged on resume, that's a P0.
**Expected behaviour:** Sale is committed to IndexedDB before print; on power return the receipt can be re-printed from the saved transaction; no double-charge, no lost sale.
**Where handled:** POS offline store `frontend/src/stores/posOffline.ts` (IndexedDB), reprint from `pages/pos/`. Printer driver retry `frontend/src/hardware/printers/printer-service.ts`.
**Status:** partial — offline persist exists; verify reprint-after-power-return flow with pilots.

### EC-08 — Whole-day offline operation, then bulk sync 🛒🍽️ — P0
**Situation:** Neighbourhood internet is out all morning; the shop keeps selling offline, then everything syncs when the line returns.
**Why it bites here:** "Offline-first" is not a nice-to-have in Iraq; it's the baseline. Sync conflicts (stock went negative, same invoice number) must resolve sanely.
**Expected behaviour:** Queue all POS writes offline, sync idempotently on reconnect, resolve numbering server-side, surface any conflicts for review — never silently drop a sale.
**Where handled:** `frontend/src/stores/posOffline.ts`, `frontend/src/hooks/usePOSTerminal.ts`; idempotency middleware `backend/app/middleware/idempotency_http.py`.
**Status:** partial — needs an explicit multi-hour-offline pilot test (P-a supermarket is the canary).

### EC-09 — Generator switchover spikes / brownouts reboot the router 🛒🍽️🔧 — P1
**Situation:** Shop runs on a shared neighbourhood generator ("ampere" subscription); switchover causes brief outages and router reboots several times a day.
**Why it bites here:** Even "online" shops are really intermittently-online; sync must survive flapping connectivity, not just clean offline/online transitions.
**Expected behaviour:** Resilient retry/backoff on sync; no duplicate posts when the connection flaps mid-request (idempotency keys).
**Where handled:** idempotency middleware; POS sync retry in `usePOSTerminal.ts`.
**Status:** open — test connection-flap explicitly.

### EC-10 — Two cashiers offline on two tablets sell the last unit of the same SKU 🛒📱 — P1
**Situation:** Both terminals are offline; both sell the last item in stock; on sync, stock goes negative.
**Why it bites here:** Multi-terminal shops with bad wifi will hit this. Hard-blocking offline sales is worse than reconciling after.
**Expected behaviour:** Allow the offline sales (don't block revenue), flag the negative-stock condition on sync for the owner to reconcile, and make the inventory math converge.
**Where handled:** inventory write model `backend/app/firestore/write_models/items.py`; POS offline queue.
**Status:** open — define the reconcile UX.

### EC-11 — Clock drift on a cheap Android tablet skews timestamps ⚙️ — P2
**Situation:** A budget tablet's clock is off by minutes/hours after a battery pull; offline transactions get bad local timestamps.
**Why it bites here:** Affects day-close, audit order, and "sales by hour" reports.
**Expected behaviour:** Stamp server time on sync; keep the device timestamp as a secondary field; warn if drift is large.
**Where handled:** transaction write model `backend/app/firestore/write_models/transactions.py`; sync in `usePOSTerminal.ts`.
**Status:** open.

---

## C. Receipt printing & language

### EC-12 — Arabic/Kurdish receipt must print right-to-left with correct glyph shaping ⚙️ — P1
**Situation:** Thermal printers mangle Arabic-script text (unshaped, reversed, or boxes) if the driver just sends UTF-8.
**Why it bites here:** Receipts in Iraq are Arabic or Kurdish; broken script makes the shop look unprofessional and confuses customers.
**Expected behaviour:** Pre-shape and reverse Arabic-script runs before sending to ESC/POS; embed/raster fonts where the printer lacks them; support 58mm and 80mm.
**Where handled:** `backend/app/pdf/arabic_typesetter.py` (Noto Naskh → Amiri → Helvetica fallback), `frontend/src/hardware/printers/commands.ts` (toArabicIndic), receipt templates `frontend/src/hardware/receipts/` + `ReceiptIQD`.
**Status:** partial — typesetter exists; **needs real hardware verification per dialect** (external blocker: hardware).

### EC-13 — Arabic-Indic vs Western digits on the receipt ⚙️ — P2
**Situation:** Some owners want ٠١٢٣ (Arabic-Indic) numerals, others want 0123; mixed is jarring.
**Why it bites here:** Preference varies by city and customer base; the wrong choice annoys.
**Expected behaviour:** Per-tenant digit preference applied consistently across receipts, screen, and PDFs.
**Where handled:** `frontend/src/utils/arabic-digits.ts`, `DigitPreferenceContext`, `DigitPreferenceToggle`; backend `iraqi_formatter.py`.
**Status:** handled — verify it propagates to the thermal receipt, not just the screen.

### EC-14 — Mixed Kurdish + Arabic + Latin (product names, brand SKUs) on one line 📱🔧 — P2
**Situation:** A receipt line reads "Samsung شاحن type-C" — three scripts/directions in one string.
**Why it bites here:** Bidi runs print in the wrong order if handled naively.
**Expected behaviour:** Correct bidi segmentation per run so Latin brand names stay LTR inside an RTL line.
**Where handled:** `backend/app/pdf/arabic_typesetter.py`; thermal command builder.
**Status:** open — explicit bidi test case needed.

### EC-15 — Printer dialect varies by imported brand (Epson vs Xprinter vs Bixolon) ⚙️ — P1
**Situation:** Distributors switch import sources; the same shop may end up with any of several ESC/POS dialects.
**Why it bites here:** A hard-coded driver breaks on the next printer the bazaar sells.
**Expected behaviour:** Auto-detect dialect (GS I probe + name regex), with per-dialect byte fixtures; pairing wizard lets the owner pick if detection is ambiguous.
**Where handled:** `frontend/src/hardware/printers/detection.ts`, `dialects/*`, `components/pos/HardwarePairingWizard.tsx`; backend `backend/app/api/tenant_hardware.py`.
**Status:** handled in code — **physical verification is an external blocker** (procure top-5 devices).

### EC-16 — 58mm vs 80mm paper; owner buys whatever roll is in stock ⚙️ — P2
**Situation:** Paper width changes with whatever the shop bought this month.
**Why it bites here:** A layout fixed to 80mm overflows or wastes paper on 58mm.
**Expected behaviour:** Width is a tenant/printer setting; templates exist for both widths.
**Where handled:** `frontend/src/hardware/receipts/Receipt58mm.tsx` + `Receipt80mm.tsx`; pairing wizard captures width.
**Status:** handled — verify width auto-applies to kitchen + customer receipts.

---

## D. Customers, credit & informal practice

### EC-17 — Informal store credit ("daftar" / the notebook) 🔧🛒💊 — P1
**Situation:** Regular customers buy on credit recorded in a paper notebook ("حسابي في الدفتر") and settle weekly/monthly.
**Why it bites here:** This is the dominant credit mechanism in Iraqi neighbourhood retail; ignoring it means the shop keeps a parallel paper ledger and the system is "incomplete."
**Expected behaviour:** A customer "ledger/daftar" balance: ring a sale as on-account, accept partial payments later, show outstanding balance per customer, print a statement.
**Where handled:** customer/contact ledger — verify in `backend/app/api/accounts.py` + invoices/payments; POS "charge to account" tender in `usePOSTerminal.ts`.
**Status:** open — define the daftar/on-account tender + customer statement; this is a top pilot ask (P-d hardware).

### EC-18 — Supplier credit the other direction (we owe the wholesaler) 🔧📱🛒 — P1
**Situation:** The shop itself buys stock on credit from a wholesaler and pays down over time.
**Why it bites here:** Cash-flow reality; the owner needs to see "what do I owe each supplier."
**Expected behaviour:** AP per supplier with partial payments, aging, and a payable statement.
**Where handled:** bills / purchase flows `backend/app/api/invoices.py` (and bills pages `frontend/src/pages/Bills.tsx`, `VendorCredits.tsx`).
**Status:** partial — verify supplier-aging view exists and is usable for a shopkeeper.

### EC-19 — Ration-card (البطاقة التموينية) customers 🛒💊 — P2
**Situation:** Some staple goods are tied to the public distribution / ration-card system; a grocer may track ration-eligible sales or subsidised items differently.
**Why it bites here:** Iraqi-specific public-distribution scheme; a grocer/pharmacy serving ration customers needs to tag those sales and not mix them with retail margin.
**Expected behaviour:** Optional customer attribute "ration card no." (PII — handled as customer-controlled data), a way to tag/segregate ration/subsidised line items in reporting.
**Where handled:** contact custom fields; reporting tags. **No dedicated module yet** — likely a workaround via customer tags + item category.
**Status:** open — confirm scope with pharmacy/supermarket pilots; may be `wontfix` for v1 beyond tagging.

### EC-20 — Phone number as the customer key; many share a name 🛒🍽️📱 — P2
**Situation:** Walk-in customers identified by phone (+964…), and many people share common names (e.g. several "Mohammed").
**Why it bites here:** Name-based lookup collides constantly; phone is the real identifier, and it must normalise to E.164 (+964, drop leading 0).
**Expected behaviour:** Phone normalised to +964 E.164 on entry; dedupe/lookup by phone; tolerate `07XX`, `+9647XX`, `009647XX` inputs.
**Where handled:** phone normaliser exists in onboarding (`frontend/src/onboarding/state.ts` normalizeIraqPhone); reuse for contacts. Backend contact validation `backend/app/api/accounts.py`/schemas.
**Status:** partial — ensure the same E.164 normalisation is applied to contact create everywhere.

### EC-21 — Walk-in / anonymous "cash customer" is the default 🛒🍽️ — P3
**Situation:** Most POS sales have no named customer.
**Why it bites here:** Forcing customer selection slows every sale.
**Expected behaviour:** A default "cash sale / walk-in" customer so the cashier never has to pick one to complete a sale.
**Where handled:** POS terminal default customer `frontend/src/hooks/usePOSTerminal.ts`.
**Status:** handled — verify it's the zero-friction default.

---

## E. Tax, compliance & documents

### EC-22 — VAT applicability is uneven and shops are unsure 🛒🍽️💊🔧 — P1
**Situation:** Many small shops are not VAT-registered or are unsure; some items/sectors are treated differently.
**Why it bites here:** A system that forces 15% VAT on everything produces wrong totals and scares unregistered shops.
**Expected behaviour:** VAT is configurable per tenant and per item (taxable / exempt / zero); a "not VAT-registered" mode hides VAT entirely on receipts.
**Where handled:** taxes API `backend/app/api/taxes.py`; item tax fields `backend/app/api/items.py`; Iraq presets `backend/app/data/iraqi_tax_presets.py`.
**Status:** partial — confirm "no-VAT shop" mode is clean end-to-end.

### EC-23 — Withholding tax (WHT) on B2B / government sales 🔧📱 — P2
**Situation:** Selling to a company or ministry, a withholding amount is deducted at source.
**Why it bites here:** Iraqi WHT rules vary by sector/governorate; the invoice and the receivable must reflect the withheld amount.
**Expected behaviour:** WHT calculation on qualifying invoices; the AR reflects net; a WHT report for filing.
**Where handled:** `backend/app/tax/withholding.py` (WHTCalculator), `backend/app/api/wht.py`, `frontend WHTBreakdown`.
**Status:** partial (engine exists with placeholder rates) — rates need verification (growth-to-100 R7.1).

### EC-24 — e-Fakhata (MoF e-invoicing) submission for qualifying invoices ⚙️ — P1
**Situation:** Larger / B2B invoices must be reported to the Ministry of Finance e-invoicing system.
**Why it bites here:** A real compliance obligation for some pilots (electronics/hardware doing B2B); failure has legal consequence.
**Expected behaviour:** Generate the e-Fakhata XML, sign (XAdES-BES), queue and submit to MoF, show submission status; auditor export.
**Where handled:** `backend/app/efakhata/*` (schema, signing, submission_queue, mof_client), `frontend/src/pages/efakhata/*`.
**Status:** partial — built but gated on MoF schema/endpoint verification (growth-to-100 R7.X) and is an external blocker (MoF onboarding).

### EC-25 — Commercial registration number on documents 🔧📱🛒 — P3
**Situation:** Business documents/invoices commonly show the shop's commercial registration number.
**Why it bites here:** Expected on a "real" Iraqi invoice; its absence looks unofficial.
**Expected behaviour:** Capture `commercial_registration_no` (validated) and print it on invoices/receipts.
**Where handled:** `backend/app/schemas/company.py` (+ validator), `frontend/src/pages/settings/sections/general/CompanyInfo.tsx`.
**Status:** handled — verify it renders on the thermal receipt + PDF invoice.

### EC-26 — Hijri date alongside Gregorian 💊🛒 — P3
**Situation:** Some customers/owners expect a Hijri date on receipts/reports.
**Why it bites here:** Cultural expectation; pharmacies in particular reference Hijri.
**Expected behaviour:** Optional Hijri date display via a calendar preference, alongside Gregorian.
**Where handled:** `frontend/src/utils/hijri-date.ts`, `CalendarPreferenceContext`, `CalendarToggle`; backend `iraqi_formatter.py` (Hijri).
**Status:** handled — verify toggle reaches receipts.

---

## F. Inventory, sector-specific

### EC-27 — Pharmacy: batch + expiry tracking and near-expiry alerts 💊 — P1
**Situation:** Medicines have batch numbers and expiry dates; expired stock must not be sold and near-expiry needs flagging.
**Why it bites here:** Legal + safety obligation for pharmacies (P-c pilot's headline need).
**Expected behaviour:** Batch/lot with expiry on receipt-of-goods; block/warn on selling expired; near-expiry report; FEFO suggestion.
**Where handled:** inventory item write model `backend/app/firestore/write_models/items.py`; pharmacy module under `/ext` / inventory pages. **Verify** batch+expiry depth.
**Status:** open — confirm batch/expiry exists to the depth a pharmacy needs.

### EC-28 — Controlled-substance / restricted-medicine log 💊 — P1
**Situation:** Certain medicines require a dispensing log (who, what, when, prescriber).
**Why it bites here:** Regulatory; the pharmacy can't run on the system if this forces a parallel paper log.
**Expected behaviour:** A controlled-substance flag on items that triggers capture of the required fields at sale and a printable/exportable log.
**Where handled:** pharmacy vertical (`/ext/pharmacy`) + item flags. **No confirmed dedicated log** — likely a gap.
**Status:** open — scope with the pharmacy pilot (P-c); candidate for a fast pilot-channel feature.

### EC-29 — Serial-number tracking + warranty for electronics 📱 — P1
**Situation:** Phones/laptops are sold by IMEI/serial with a warranty period; returns/warranty claims look up the serial.
**Why it bites here:** P-e electronics pilot's headline need; without it the shop keeps a separate serial book.
**Expected behaviour:** Capture serial/IMEI at sale, tie warranty start to the sale date, look up a sale by serial for warranty/return.
**Where handled:** item serial tracking in inventory write model; warranty in repairs/`ext` modules. **Verify** serial capture at POS.
**Status:** open — confirm serial capture + warranty lookup path.

### EC-30 — Units sold loose / by weight / by partial pack 🛒🔧 — P2
**Situation:** Grocers sell by weight (rice, nuts) or split a carton; hardware sells "3 metres of cable" or single screws from a box.
**Why it bites here:** Iraqi shops buy in bulk and sell in arbitrary fractions; integer-only quantities don't fit.
**Expected behaviour:** Decimal quantities, a sell-unit vs buy-unit (pack→each) conversion, and weight entry from a scale (manual entry acceptable for v1).
**Where handled:** item unit-of-measure + POS quantity entry `frontend/src/pages/pos/POSProducts.tsx`, `posCart.ts`.
**Status:** partial — verify decimal qty + pack/each conversion.

---

## G. Hardware & environment (operational)

### EC-31 — Cash drawer kick pin varies (pin 2 vs pin 5) ⚙️ — P2
**Situation:** Drawers from different makers open on a different ESC/POS kick pin.
**Why it bites here:** The drawer simply won't open if the wrong pin is sent.
**Expected behaviour:** Pin selectable per-dialect/per-tenant in the pairing wizard; sensible per-dialect default.
**Where handled:** `frontend/src/hardware/cash-drawer/cash-drawer.ts` (kickPin5/kickPin2), pairing wizard.
**Status:** handled — verify with real drawer in a kit.

### EC-32 — Barcode scanner is a keyboard-wedge that "types" into whatever has focus 🛒📱🔧 — P2
**Situation:** Cheap HID scanners just emit keystrokes; if focus is on the wrong field the barcode lands in the search box or nowhere.
**Why it bites here:** This is the dominant scanner type in Iraqi shops.
**Expected behaviour:** A global barcode capture that works regardless of focus, distinguishes a scan from typing (speed + suffix), and adds the item to the cart.
**Where handled:** `frontend/src/hardware/scanner/scanner-service.ts` (HID keyboard-wedge, useBarcodeInput), mobile `mobile/src/bridge/scanner.ts`.
**Status:** handled — verify focus-independent capture in the live POS.

---

## How to add an entry

Append a new `EC-NN` under the right section using the same shape: **Situation / Why it bites here / Expected behaviour / Where handled / Status**, tag the sector and severity, and link any ticket. When a pilot reports something, file it here the same day (T-SF.6.9 → T-SF.6.18). Update **Status** as fixes ship on the Friday pilot channel.

## Summary (update as the tracker grows)

| Status | Count (seed) |
|--------|:------------:|
| handled | 8 |
| partial | 11 |
| open | 13 |
| workaround | 0 |
| wontfix | 0 |
| **Total** | **32** |

> Seeded with **32** entries (target was ≥ 30). Counts above are the seed baseline; re-tally as pilots add rows and engineering closes them.
