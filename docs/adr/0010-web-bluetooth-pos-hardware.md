# ADR-LR-007 — Web Bluetooth for POS hardware pairing

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Frontend lead, POS team |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.kiro/specs/launch-readiness` T-LR.3.9; ADR 0003 (Capacitor mobile) for the native fallback |

## 1. Context

POS tenants need to connect a thermal receipt printer (and sometimes a
barcode scanner or cash drawer relay) to our web app. The dominant
printers in the Iraqi market are 58mm/80mm thermal printers from
Xprinter, Bixolon, Sunmi, and similar — most expose a Bluetooth
Classic Serial Profile (SPP) or Bluetooth Low Energy GATT interface.

The connection path options:

1. **Web Bluetooth API** — pair from the browser, no native code.
2. **Native app** (Capacitor) using a native Bluetooth plugin.
3. **Network printer** — printer on LAN, accessed via HTTP/IPP from server.
4. **USB via WebUSB** — for USB-attached printers.

Constraints:

* Our frontend is React, served as a PWA. We have a Capacitor wrapper (ADR 0003) but we want the browser experience to be first-class so tenants don't need to install an app.
* Iraqi shops typically run POS on Android tablets (Samsung A-series, Sunmi POS terminals) or Windows mini-PCs. Less commonly iPads.
* Printers are usually battery-powered or USB-power, near the tablet, with Bluetooth.
* iOS has no Web Bluetooth at all (and Apple has stated they won't add it in Safari).
* Chrome on Android has Web Bluetooth. Chrome/Edge on Windows have Web Bluetooth. Firefox does not.

## 2. Decision

**We use Web Bluetooth as the primary printer pairing mechanism for
the PWA path.** For iOS Safari and other non-supported browsers, the
fallback is the Capacitor native app where we use a native BLE plugin.
Network printers are a tertiary option for tenants with shop LAN
infrastructure.

Implementation:

* `frontend/src/onboarding/StepPOSHardware.tsx` calls `navigator.bluetooth.requestDevice(...)` with thermal-printer service UUIDs.
* `frontend/src/services/printer/webBluetoothPrinter.ts` implements the print driver against the Generic Attribute Profile (GATT) characteristic exposed by Xprinter/Bixolon/Sunmi devices.
* Browser support detection lives in `frontend/src/services/printer/capabilities.ts`. If `navigator.bluetooth` is undefined, we show the iOS / Firefox fallback message recommending the native app.
* The Capacitor build wires its native BLE plugin behind the same `IPrinter` interface so calling code is identical.

## 3. Consequences

### Positive

* Most Iraqi POS deployments (Android + Chrome) work without an app install.
* Onboarding wizard step 4 ("Pair your printer") is a 30-second native browser flow — pick from a list, click pair, print a test receipt.
* No app-store gatekeeping. Updates ship at the speed of `vercel deploy`.
* Web Bluetooth's permission model is per-origin and per-device, with the user picking from a system dialog. PCI-level UX without bespoke trust UI.
* Falls back cleanly: if a tenant is on iOS, we say so and offer the app or a network printer.

### Negative

* iOS Safari users have no path through the PWA — they must install our Capacitor app. ~ 25% of Iraqi tablet users are iPad-based; this is a real cohort.
* Firefox users (small minority) have no path either.
* Web Bluetooth requires HTTPS (secure context) — we have this for prod, but local dev needs `localhost` or a self-signed cert.
* Pairing UX varies subtly across Chrome/Edge versions and OS combinations; we've documented common quirks in the troubleshooting runbook.
* Some printers default to SPP (Bluetooth Classic) which Web Bluetooth doesn't support; we need BLE-mode firmware or a sufficiently new model.

### Neutral / known unknowns

* Future browsers may add Web Bluetooth (Safari has dragged its feet for years; we don't budget on it changing).
* Web Bluetooth is still a W3C draft (not REC); breaking changes possible but unlikely at this point.

## 4. Alternatives considered

### Alternative A — Native app only (Capacitor)

* **Pros:** Uniform across iOS/Android; supports both BLE and SPP; better hardware diagnostics.
* **Cons:** Requires every tenant to install an app. Cuts the "try it on the browser first" funnel. App store review delays releases. We'd lose the "pure web" pitch.
* **Why rejected:** Friction at signup is too high; PWA flow is a competitive advantage.

### Alternative B — Network printers only

* **Pros:** Cross-platform (any OS, any browser). Server-side print job dispatch is reliable.
* **Cons:** Most Iraqi shops don't have LAN infrastructure; network printers are 2-3× the price of Bluetooth thermal printers; the small ones we recommend don't have Ethernet.
* **Why rejected:** Hardware market mismatch.

### Alternative C — WebUSB

* **Pros:** Works for USB printers without driver install.
* **Cons:** Most thermal printers in Iraq are sold with Bluetooth pairing as the primary mode; USB is secondary. Browser support is similar (no iOS Safari).
* **Why rejected:** Doesn't cover the dominant hardware shape.

### Alternative D — Print server pattern (local print agent app)

* **Pros:** Works across all OSes; bridges printers to web app.
* **Cons:** Yet another piece of software for tenants to install and update. Onboarding gets a "download our print agent" step.
* **Why rejected:** Same friction as native app, without the iOS coverage benefit.

## 5. Validation

We will know we made the right call if:

* > 70% of POS tenants successfully pair a printer via Web Bluetooth within the first onboarding session.
* < 10% of POS tenants fall back to the native app or network printer in v1.
* The pairing step has < 5% retry rate in telemetry.
* CS tickets about printer pairing are < 1 per 50 onboardings.

Revisit if:
* Onboarding completion at the printer step is < 60% — Web Bluetooth UX may be too brittle; consider native-first.
* Apple ships Web Bluetooth in Safari — we should celebrate, then drop the iOS-specific fallback messaging.
* The browser-pairing flow generates more than 2% of all CS volume.

## 6. Notes

* The list of tested printers and their service UUIDs lives in `frontend/src/data/printer_catalog.ts` (kept in sync with what we sell / certify).
* Common quirks (Xprinter requires holding FEED for 3s; Sunmi V2 internal printer doesn't use Bluetooth) are documented in `docs/runbooks/onboarding-troubleshooting.md` §3.
* The R7.8 open question asks for a definitive list of common thermal printers in Iraq so we can certify them; until then we go on what beta customers report.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: after first 20 POS tenants onboarded.*
