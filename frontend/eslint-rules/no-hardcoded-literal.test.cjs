/**
 * Unit tests for the `no-hardcoded-literal` ESLint rule.
 *
 * Uses ESLint's `RuleTester` API directly so the rule can be exercised
 * without spinning up a full project lint.
 *
 * Requirements: 11.4, 13.4, 13.5
 */

'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-hardcoded-literal.cjs');

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run('no-hardcoded-literal', rule, {
  valid: [
    // ── Allowlisted JSX text ─────────────────────────────────────────────
    { code: '<div>{t("welcome")}</div>' },
    { code: '<div>{i18n.t("welcome")}</div>' },
    { code: '<div>:</div>' },
    { code: '<div>—</div>' },
    { code: '<div> · </div>' },
    { code: '<div>404</div>' },
    { code: '<div>3.14</div>' },
    { code: '<div>Vercel</div>' },
    { code: '<div>iOS · Android</div>' },
    { code: '<div>GitHub / Stripe</div>' },
    { code: '<div>{children}</div>' },
    { code: '<div></div>' },

    // ── Allowlisted attributes ──────────────────────────────────────────
    // `className`, `data-testid`, route-like paths, and any non-flagged
    // attribute are not scanned.
    { code: '<div className="text-lg font-bold flex items-center" />' },
    { code: '<div data-testid="my-test-id" />' },
    { code: '<a href="/settings/currencies" />' },
    { code: '<a href="/" />' },
    { code: '<input type="text" name="email" />' },

    // Flagged attributes but i18n-resolved / non-literal:
    { code: '<button aria-label={t("close")} />' },
    { code: '<input placeholder={t("search.placeholder")} />' },
    { code: '<img alt={t("logo.alt")} />' },
    { code: '<button title={t("tooltip.help")} />' },

    // Component-only props on native HTML elements — not flagged.
    // (`<input type="text">` uses `text` as a value, but `text` here is
    // a *value*, not the prop name; the prop name is `type` which we
    // don't scan.)
    { code: '<label>{t("email")}</label>' },
    { code: '<form><label htmlFor="x">{t("email")}</label></form>' },

    // Component-only props with i18n-resolved values:
    { code: '<Button label={t("save")} />' },
    { code: '<Tooltip title={t("close")}><span /></Tooltip>' },
    { code: '<Form.Item label={t("email")} />' },

    // Component-only props with proper-noun-only values:
    { code: '<Button label="Vercel" />' },
    { code: '<Tooltip title="GitHub" />' },

    // Empty / whitespace JSX text inside components:
    { code: '<Button>{t("save")}</Button>' },
  ],

  invalid: [
    // ── (1) JSXText violations ───────────────────────────────────────────
    {
      code: '<div>Save changes</div>',
      errors: [{ messageId: 'hardcodedJsxText' }],
    },
    {
      code: '<p>Welcome to ERPIQ</p>',
      // Mixed content: not all tokens are proper nouns, so this fires.
      errors: [{ messageId: 'hardcodedJsxText' }],
    },
    {
      code: '<span>Hello Vercel</span>',
      errors: [{ messageId: 'hardcodedJsxText' }],
    },

    // ── (2) Always-flagged JSX attributes ────────────────────────────────
    {
      code: '<button aria-label="Close dialog" />',
      errors: [{ messageId: 'hardcodedAttr' }],
    },
    {
      code: '<input placeholder="Enter email" />',
      errors: [{ messageId: 'hardcodedAttr' }],
    },
    {
      code: '<img src="/logo.svg" alt="Company logo" />',
      errors: [{ messageId: 'hardcodedAttr' }],
    },
    {
      code: '<button title="Save the form">Save</button>',
      // Two violations: the `title` attribute and the JSXText "Save".
      errors: [
        { messageId: 'hardcodedAttr' },
        { messageId: 'hardcodedJsxText' },
      ],
    },
    {
      code: '<input title={"Enter email"} />',
      errors: [{ messageId: 'hardcodedAttr' }],
    },
    {
      code: '<input title={`Enter email`} />',
      errors: [{ messageId: 'hardcodedAttr' }],
    },

    // ── (3) Component-only props on Component elements ──────────────────
    {
      code: '<Button label="Save" />',
      errors: [{ messageId: 'hardcodedComponentProp' }],
    },
    {
      code: '<Tooltip tooltip="More info"><span /></Tooltip>',
      errors: [{ messageId: 'hardcodedComponentProp' }],
    },
    {
      code: '<Alert description="Something went wrong" />',
      errors: [{ messageId: 'hardcodedComponentProp' }],
    },
    {
      code: '<Notify message="Saved successfully" />',
      errors: [{ messageId: 'hardcodedComponentProp' }],
    },
    {
      code: '<Card text="Hello world" />',
      errors: [{ messageId: 'hardcodedComponentProp' }],
    },
    {
      code: '<Form.Item label="Email" />',
      errors: [{ messageId: 'hardcodedComponentProp' }],
    },
  ],
});

// Smoke-test for the internal helpers — they ship alongside the rule and
// power the allowlist behaviour.
const {
  isAllowlistedLiteral,
  isOnlyProperNouns,
} = rule.__internals;

const assert = require('node:assert');

// isAllowlistedLiteral
assert.strictEqual(isAllowlistedLiteral(''), true);
assert.strictEqual(isAllowlistedLiteral('   '), true);
assert.strictEqual(isAllowlistedLiteral(':'), true);
assert.strictEqual(isAllowlistedLiteral('—'), true);
assert.strictEqual(isAllowlistedLiteral(' · '), true);
assert.strictEqual(isAllowlistedLiteral('404'), true);
assert.strictEqual(isAllowlistedLiteral('-3.14'), true);
assert.strictEqual(isAllowlistedLiteral('/'), true);
assert.strictEqual(isAllowlistedLiteral('/settings/currencies'), true);
assert.strictEqual(isAllowlistedLiteral('/sales/invoices/:id'), true);
assert.strictEqual(isAllowlistedLiteral('Vercel'), true);
assert.strictEqual(isAllowlistedLiteral('iOS · Android'), true);
assert.strictEqual(isAllowlistedLiteral('Save'), false);
assert.strictEqual(isAllowlistedLiteral('Hello world'), false);
assert.strictEqual(isAllowlistedLiteral('Welcome to ERPIQ'), false);

// isOnlyProperNouns
assert.strictEqual(isOnlyProperNouns('Vercel'), true);
assert.strictEqual(isOnlyProperNouns('GitHub / Stripe'), true);
assert.strictEqual(isOnlyProperNouns('iOS · Android'), true);
assert.strictEqual(isOnlyProperNouns(''), false);
assert.strictEqual(isOnlyProperNouns('Hello'), false);
assert.strictEqual(isOnlyProperNouns('Welcome to ERPIQ'), false);

console.log('no-hardcoded-literal: all RuleTester cases + helper assertions passed.');
