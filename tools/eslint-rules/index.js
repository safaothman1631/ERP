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

module.exports = {
  meta: {
    name: 'eslint-plugin-local',
    version: '0.1.0',
  },
  rules: {
    'require-query-class': requireQueryClass,
    'precise-invalidation': preciseInvalidation,
  },
  // Convenience preset — `extends: ['plugin:local/recommended']`-style users
  // can opt into the recommended pair.
  configs: {
    recommended: {
      plugins: ['local'],
      rules: {
        'local/require-query-class': 'error',
        'local/precise-invalidation': 'warn',
      },
    },
  },
};
