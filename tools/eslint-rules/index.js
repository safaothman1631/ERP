/**
 * @fileoverview Local ESLint plugin entry point. Exposes the two custom
 * rules that enforce the data-layer discipline laid down in
 * `world-class-performance` requirements §2.
 *
 * Usage in `frontend/eslint.config.js`:
 *
 *   import localPlugin from '../tools/eslint-rules/index.js';
 *
 *   export default [
 *     {
 *       plugins: { local: localPlugin },
 *       rules: {
 *         'local/require-query-class': 'error',
 *         'local/precise-invalidation': 'warn',
 *       },
 *     },
 *   ];
 */

'use strict';

const requireQueryClass = require('./require-query-class');
const preciseInvalidation = require('./precise-invalidation');
const emptyStateRequired = require('./empty-state-required');
const quickCreateSelect = require('./quick-create-select');
const stateSwitchRequired = require('./state-switch-required');

module.exports = {
  meta: {
    name: 'eslint-plugin-local',
    version: '0.3.0',
  },
  rules: {
    'require-query-class': requireQueryClass,
    'precise-invalidation': preciseInvalidation,
    // Empty-state + quick-create discipline — see
    // `.kiro/specs/empty-state-quick-create/requirements.md` §1.5, §15.
    'empty-state-required': emptyStateRequired,
    'quick-create-select': quickCreateSelect,
    'state-switch-required': stateSwitchRequired,
  },
  // Convenience preset — `extends: ['plugin:local/recommended']`-style users
  // can opt into the recommended set.
  configs: {
    recommended: {
      plugins: ['local'],
      rules: {
        'local/require-query-class': 'error',
        'local/precise-invalidation': 'warn',
        'local/empty-state-required': 'warn',
        'local/quick-create-select': 'warn',
        'local/state-switch-required': 'warn',
      },
    },
  },
};
