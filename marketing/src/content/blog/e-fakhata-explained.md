---
title: "e-Fakhata Explained: What's Coming from the Iraqi MoF in 2026"
description: "Iraq's electronic invoicing mandate (e-Fakhata) is rolling out in phases through 2028. What it is, who is required to comply, how the signed XML invoice works, and what to do if you are not ready."
date: 2026-02-18
author: "Mariwan Jalal"
author_title: "Compliance lead, Tawir Enterprise"
tags: ["e-fakhata", "compliance", "einvoice", "mof"]
locale: en
reading_minutes: 10
target_query: "e-fakhata iraq einvoice"
og_image: /brand/og/blog-template-1200x630.png
featured: true
---

e-Fakhata — literally "the electronic invoice" — is the Iraqi Ministry of Finance's program to digitize commercial invoicing and link it directly to the tax administration's clearing system. After several false starts dating back to 2019, the program entered phased mandatory rollout in 2024 and is now (in mid-2026) at the threshold where mid-sized taxpayers are being onboarded. This article explains, in plain language, what e-Fakhata is, what changes for your business, and what to wire into your accounting software to be ready.

## What is e-Fakhata, technically

An e-Fakhata invoice is an **XML document** with a specific schema mandated by the MoF, **signed cryptographically** with a private key the MoF issues to your business, **transmitted to the MoF clearing endpoint** in near real time, and **assigned a unique reference** (UUID + sequence) plus a **QR code** that the buyer can scan to verify.

Concretely, the lifecycle for a single sale is:

1. Your accounting system composes the XML — header, lines, taxes, totals.
2. The XML is signed using your MoF-issued PKCS#12 keystore. The signature format is XAdES-BES (or as updated by the MoF spec).
3. The signed XML is POSTed to the MoF clearing endpoint over HTTPS.
4. The MoF responds with either an acceptance reference (which you embed in the QR code) or a rejection with an error code.
5. You print or PDF the invoice for the buyer; the QR code links to the MoF verification page.

If the MoF endpoint is unreachable (network outage), the system queues the invoice and retries; the buyer gets a "pending submission" annotation.

## What is NOT changing

e-Fakhata replaces the legally-binding *fiscal invoice* — the document that proves the transaction for tax purposes. What does **not** change:

- Your accounting software, chart of accounts, and reports.
- Your customer's experience — they still get a paper or PDF receipt.
- The VAT rate or WHT rules.
- The annual filing process.

The signed XML is the legal evidence; the PDF is a courtesy.

## Who must comply, and when

The MoF rollout is phased by taxpayer size:

| Phase | Period | Threshold (annual turnover) |
|------:|--------|-----------------------------|
| 1 | 2024–2025 | Large taxpayers (above IQD 5,000,000,000) — **mandatory** |
| 2 | 2026 | Mid-sized (IQD 500,000,000 – 5,000,000,000) — **mandatory by end of 2026** |
| 3 | 2027 | Small (IQD 100,000,000 – 500,000,000) — **voluntary, becomes mandatory 2028** |
| 4 | 2028 | All VAT-registered taxpayers — mandatory |

If your business is below the IQD 100M threshold and not VAT-registered, you are not required to comply — but you will hit the threshold faster than you expect if you are growing, and the time to wire e-Fakhata in is *before* you are required to.

## What you need to comply

1. **A taxpayer profile registered with the MoF for electronic invoicing.** The application is online; it asks for your TIN, CRN, governorate, business category, and a designated technical contact.
2. **A PKCS#12 keystore issued by the MoF.** The MoF generates this and gives you a `.p12` file and a passphrase. **Treat this like a bank password.** Anyone with the file can sign invoices as you.
3. **Accounting software that can generate the XML, sign it, transmit it, and reconcile the response.** This is the operational piece — and where most SMBs get stuck.
4. **A QR-printable receipt template** for the buyer.

For the Kurdish ERP on the Pro plan, items 3 and 4 are end-to-end automatic. The keystore is uploaded once, encrypted at rest in Google Secret Manager, and the system signs every invoice marked for submission.

## The XML, briefly

The MoF schema (current version, v2.4 as of May 2026) requires:

```xml
<Invoice>
  <Header>
    <SellerTIN>123456789</SellerTIN>
    <SellerCRN>...</SellerCRN>
    <BuyerTIN>987654321</BuyerTIN>  <!-- if B2B -->
    <InvoiceNumber>2026-00045</InvoiceNumber>
    <IssueDate>2026-05-29</IssueDate>
    <Currency>IQD</Currency>
  </Header>
  <Lines>
    <Line>
      <Description>Item description</Description>
      <Quantity>2</Quantity>
      <UnitPrice>15000</UnitPrice>
      <TaxCategory>STANDARD_VAT</TaxCategory>
      <LineTotal>30000</LineTotal>
    </Line>
  </Lines>
  <TaxBreakdown>
    <TaxLine category="STANDARD_VAT" taxableAmount="30000" taxAmount="4500"/>
  </TaxBreakdown>
  <Totals>
    <Subtotal>30000</Subtotal>
    <TotalTax>4500</TotalTax>
    <Total>34500</Total>
  </Totals>
  <Signature>...XAdES-BES envelope...</Signature>
</Invoice>
```

You do not write this by hand. The Kurdish ERP composes, signs, and submits it as a side effect of marking an invoice "issued".

## What happens when the MoF rejects an invoice

Common rejection reasons:

| Code | Meaning | What to do |
|------|---------|-----------|
| **MOF-001** | Invalid TIN format | Verify your TIN — 9 digits, no spaces |
| **MOF-014** | Schema validation failed | Software bug — report to your vendor |
| **MOF-027** | Duplicate invoice number | The invoice number is already submitted; re-number or void original |
| **MOF-031** | Buyer TIN not registered | Buyer is not VAT-registered — re-issue as B2C |
| **MOF-088** | Signature verification failed | Keystore expired or corrupted — re-fetch from MoF portal |

The Kurdish ERP surfaces the MoF error code, a localized explanation, and a "retry" affordance directly in the invoice detail screen.

## What this costs

Operationally, e-Fakhata adds **less than 200 milliseconds** to each invoice issue (the MoF endpoint is fast in practice). The annual cost is the keystore renewal (free, but requires a manual MoF portal visit) and the audit retention storage (negligible).

For your accounting team, the change is mostly invisible — once configured, the system handles it. The only new operational habit is the **rejection queue**: when an invoice fails to submit, someone needs to look at why and either fix it or void it.

## What to do today

1. **Find out which phase you are in.** Look up your trailing-twelve-month turnover. If you are in Phase 2, the clock is ticking toward end-2026.
2. **Apply for the MoF electronic-invoicing profile** if you have not.
3. **Pick accounting software that supports e-Fakhata end-to-end.** If you are using paper or Excel today, the upgrade path is real software — and you want a system that is Iraqi-tax-native, not a generic ERP with an e-invoice plugin.
4. **Set up a sandbox.** The Kurdish ERP Pro plan ships with an MoF sandbox mode — you can test the full flow before going to production.

The headline is: e-Fakhata is not optional much longer. The work to comply is real but bounded. The earlier you wire it in, the less you scramble when the inspector calls.
