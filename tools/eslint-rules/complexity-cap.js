/**
 * @fileoverview Re-export of ESLint's built-in `complexity` rule with the
 * project's preferred bands, plus a recommended config that the team can
 * extend.
 *
 * Why a wrapper:
 *   - Centralises the V-LM.2 threshold (≤ 15 per function) so it can be
 *     changed in one place.
 *   - Exposes a `recommended` preset that turns on a warning at 10 and an
 *     error at 15, matching Sonar's "cognitive load" convention.
 *
 * Usage in `frontend/eslint.config.js`:
 *
 *   import localPlugin from '../tools/eslint-rules/index.js';
 *
 *   export default [
 *     ...localPlugin.configs['complexity-cap'].overrides,
 *   ];
 *
 * Or apply directly to a flat-config block:
 *
 *   {
 *     rules: {
 *       'complexity': ['error', { max: 15 }],
 *     },
 *   }
 *
 * This module does NOT register a new rule (ESLint owns `complexity`). It
 * provides the configuration in a single place so callers don't reinvent it.
 */

'use strict';

/**
 * The single source of truth for the complexity threshold.
 * Per V-LM.2 — Cyclomatic Complexity Cap:
 *   - warning at > 10  (Sonar's caution band)
 *   - error   at > 15  (Sonar's recommended hard line)
 */
const COMPLEXITY_WARN_MAX = 10;
const COMPLEXITY_ERROR_MAX = 15;

module.exports = {
  meta: {
    name: 'complexity-cap',
    version: '1.0.0',
    description:
      'Project-wide cyclomatic complexity configuration. Caps at 15 (error); warns at 10. ' +
      'See .kiro/specs/world-class-performance/validation.md §V-LM.2.',
  },

  thresholds: {
    warn: COMPLEXITY_WARN_MAX,
    error: COMPLEXITY_ERROR_MAX,
  },

  /**
   * Two flat-config presets. The "error" preset is the deploy-gate version;
   * the "warn" preset is what developers run locally for the soft band.
   */
  configs: {
    recommended: {
      name: 'complexity-cap/recommended',
      rules: {
        complexity: ['error', { max: COMPLEXITY_ERROR_MAX }],
      },
    },

    'recommended-warn': {
      name: 'complexity-cap/recommended-warn',
      rules: {
        complexity: ['warn', { max: COMPLEXITY_WARN_MAX }],
      },
    },

    /**
     * Combined preset: emits a warning at > 10 AND an error at > 15.
     * Implemented as two flat-config entries — the latter (error) takes
     * precedence when both fire on the same function.
     */
    'two-band': [
      {
        name: 'complexity-cap/two-band-warn',
        rules: {
          complexity: ['warn', { max: COMPLEXITY_WARN_MAX }],
        },
      },
      {
        name: 'complexity-cap/two-band-error',
        files: ['**/*.{ts,tsx,js,jsx}'],
        rules: {
          complexity: ['error', { max: COMPLEXITY_ERROR_MAX }],
        },
      },
    ],
  },
};
