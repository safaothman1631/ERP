#!/usr/bin/env node
// Phase 3 — Dialog ↔ Schema Comparison Report
// Pairs each frontend dialog (by page name) with the most likely backend schema
// (by name similarity), then lists missing fields per dialog.
//
// Usage: node frontend/scripts/dialog-report.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const dialogs = JSON.parse(readFileSync(new URL('./_dialogs.json', import.meta.url), 'utf8'));
const schemas = JSON.parse(readFileSync(new URL('../../backend/scripts/_schemas.json', import.meta.url), 'utf8'));

const schemaNames = Object.keys(schemas);

// Manual mapping for cases the heuristic gets wrong
const PAGE_TO_SCHEMA = {
  Contacts: 'ContactCreate',
  Items: 'ItemCreate',
  Invoices: 'InvoiceCreate',
  Bills: 'BillCreate',
  Quotes: 'QuoteCreate',
  Expenses: 'ExpenseCreate',
  Projects: 'ProjectCreate',
  Accounts: 'AccountCreate',
  Journals: 'JournalEntryCreate',
  TaxSettings: 'TaxRateCreate',
  TaxRates: 'TaxRateCreate',
  Budgets: 'BudgetCreate',
  FiscalYear: 'FiscalYearCreate',
  Banking: 'AccountCreate',
  BankRules: 'BankRuleCreate',
  BankReconciliation: 'BankReconciliationCreate',
  Assets: 'FixedAssetCreate',
  PriceLists: 'PriceListCreate',
  Warehouses: 'WarehouseCreate',
  CreditNotes: 'CreditNoteCreate',
  VendorCredits: 'VendorCreditCreate',
  PurchaseOrders: 'PurchaseOrderCreate',
  SalesOrders: 'SalesOrderCreate',
  RecurringInvoices: 'RecurringInvoiceCreate',
  StockTransfers: 'StockTransferCreate',
  TaxReturns: 'TaxReturnCreate',
};

function pickSchema(page) {
  if (PAGE_TO_SCHEMA[page]) return PAGE_TO_SCHEMA[page];
  // Fallback: case-insensitive includes
  const candidates = schemaNames.filter((n) =>
    n.toLowerCase().includes(page.toLowerCase()) && n.endsWith('Create'),
  );
  return candidates[0] || null;
}

const lines = [];
lines.push('# Dialog Audit — Phase 3');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push(`Total dialogs scanned: **${dialogs.length}**`);
lines.push(`Backend schemas available: **${schemaNames.length}**`);
lines.push('');
lines.push('Legend:');
lines.push('- ✅ field present in dialog');
lines.push('- ❌ field missing in dialog (backend expects it)');
lines.push('- ⚠️ no schema mapped — manual review');
lines.push('');

let totalGaps = 0;
let totalMatched = 0;
let totalUnmapped = 0;
const gapSummary = [];

// Group dialogs by page
const byPage = new Map();
for (const d of dialogs) {
  if (!byPage.has(d.page)) byPage.set(d.page, []);
  byPage.get(d.page).push(d);
}

for (const [page, pageDialogs] of [...byPage.entries()].sort()) {
  const schemaName = pickSchema(page);
  lines.push(`## ${page}`);
  lines.push(`File: \`${pageDialogs[0].file}\`  `);
  lines.push(`Schema: ${schemaName ? `\`${schemaName}\`` : '⚠️ none mapped'}`);
  lines.push('');
  for (const d of pageDialogs) {
    lines.push(`### ${d.kind} — ${d.title || '(no title)'}`);
    lines.push(`Dialog fields (${d.fields.length}): ${d.fields.length ? d.fields.map((f) => `\`${f}\``).join(', ') : '_none_'}`);
    if (!schemaName) {
      lines.push('');
      lines.push('⚠️ Skipped — no schema mapped.');
      lines.push('');
      totalUnmapped++;
      continue;
    }
    const schema = schemas[schemaName];
    const required = schema.fields.filter((f) => f.required).map((f) => f.name);
    const optional = schema.fields.filter((f) => !f.required).map((f) => f.name);
    const dialogSet = new Set(d.fields);
    const missingRequired = required.filter((r) => !dialogSet.has(r));
    const missingOptional = optional.filter((o) => !dialogSet.has(o));
    const extra = d.fields.filter((f) => !required.includes(f) && !optional.includes(f));

    lines.push('');
    lines.push(`Required (${required.length}):`);
    for (const r of required) {
      lines.push(`- ${dialogSet.has(r) ? '✅' : '❌'} \`${r}\``);
    }
    if (missingOptional.length) {
      lines.push('');
      lines.push(`Missing optional (${missingOptional.length}): ${missingOptional.map((o) => `\`${o}\``).join(', ')}`);
    }
    if (extra.length) {
      lines.push('');
      lines.push(`Frontend-only fields (${extra.length}): ${extra.map((e) => `\`${e}\``).join(', ')}`);
    }
    lines.push('');

    if (missingRequired.length) {
      totalGaps += missingRequired.length;
      gapSummary.push({ page, kind: d.kind, title: d.title, schema: schemaName, missing: missingRequired });
    }
    totalMatched++;
  }
  lines.push('---');
  lines.push('');
}

// Header summary
const summary = [
  '## Summary',
  '',
  `- Dialogs matched to a schema: **${totalMatched}**`,
  `- Dialogs without a schema (manual review): **${totalUnmapped}**`,
  `- Total **required** fields missing: **${totalGaps}**`,
  '',
];
if (gapSummary.length) {
  summary.push('### Top gaps (required fields missing)');
  summary.push('');
  for (const g of gapSummary.slice(0, 20)) {
    summary.push(`- **${g.page}** / ${g.kind} \`${g.schema}\` → missing: ${g.missing.map((m) => `\`${m}\``).join(', ')}`);
  }
  summary.push('');
}

const out = [
  ...lines.slice(0, 11), // header up to legend
  ...summary,
  ...lines.slice(11),
].join('\n');

const target = new URL('../../MASTER_AUDIT_REPORTS/dialogs.md', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
import('node:fs/promises').then(async ({ mkdir }) => {
  await mkdir(target.replace(/\/dialogs\.md$/, ''), { recursive: true });
  writeFileSync(target, out);
  console.log(`Wrote ${target}`);
  console.log(`Matched ${totalMatched}, unmapped ${totalUnmapped}, missing-required ${totalGaps}`);
});
