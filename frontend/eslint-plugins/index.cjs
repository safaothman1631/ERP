/**
 * Local ESLint plugin: zoho-design-tokens
 *
 * Provides custom rules to enforce the design token system.
 * Requirements: 1.4
 */

'use strict';

module.exports = {
  rules: {
    'no-hardcoded-colors': require('./no-hardcoded-colors.cjs'),
  },
};
