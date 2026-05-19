/**
 * Local ESLint plugin: zoho-i18n
 *
 * Bundles custom rules that enforce the system-wide i18n / help / a11y
 * contracts from `system-wide-ux-overhaul`.
 *
 * Requirements: 11.4, 13.4, 13.5
 */

'use strict';

module.exports = {
  rules: {
    'no-hardcoded-literal': require('./no-hardcoded-literal.cjs'),
  },
};
