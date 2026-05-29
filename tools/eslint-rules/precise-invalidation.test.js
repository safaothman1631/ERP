/**
 * @fileoverview RuleTester coverage for `precise-invalidation`.
 */

'use strict';

const { RuleTester } = require('eslint');
const rule = require('./precise-invalidation');

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

tester.run('precise-invalidation', rule, {
  valid: [
    // Two-segment key — fine.
    { code: "queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });" },
    // Three-segment key — also fine.
    { code: "queryClient.invalidateQueries({ queryKey: ['invoices', tenantId, id] });" },
    // Direct array, two segments — fine.
    { code: "queryClient.invalidateQueries(['invoices', tenantId]);" },
    // No arguments — defensive parse, no crash.
    { code: 'queryClient.invalidateQueries();' },
    // Unrelated method — fine.
    { code: "queryClient.removeQueries({ queryKey: ['invoices'] });" },
  ],
  invalid: [
    {
      code: "queryClient.invalidateQueries({ queryKey: ['invoices'] });",
      errors: [{ messageId: 'tooBroad' }],
    },
    {
      code: "queryClient.invalidateQueries(['bills']);",
      errors: [{ messageId: 'tooBroad' }],
    },
    {
      // Member call on something other than `queryClient`.
      code: "client.invalidateQueries({ queryKey: ['items'] });",
      errors: [{ messageId: 'tooBroad' }],
    },
  ],
});
