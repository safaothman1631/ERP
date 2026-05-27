import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

/**
 * Local design-token enforcement plugin.
 * Flags hardcoded hex/rgb color values outside theme/tokens.ts.
 * Requirements: 1.4
 */
const zohoDesignTokens = require('./eslint-plugins/index.cjs')

/**
 * Local i18n / help / a11y enforcement plugin.
 * Flags hardcoded user-facing literals in JSX (system-wide-ux-overhaul).
 * Requirements: 11.4, 13.4, 13.5
 */
const zohoI18n = require('./eslint-rules/index.cjs')

/**
 * Custom React Query rules — enforce freshness classes on every query and
 * require precise invalidation targets (world-class-performance R2.1).
 *
 * The plugin lives at the repo root in `tools/eslint-rules/` so the same
 * rules can be reused by other packages later. Loaded via `createRequire`
 * because the plugin uses CommonJS `module.exports`.
 *
 * Both rules are wired as `warn` at first so the migration sweep can land
 * incrementally; bump to `error` once the codebase is clean.
 */
const localQueryRules = require('../tools/eslint-rules/index.js')

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'zoho-design-tokens': zohoDesignTokens,
      'zoho-i18n': zohoI18n,
      local: localQueryRules,
    },
    rules: {
      // Flag hardcoded hex/rgb color values outside theme/tokens.ts (Req 1.4)
      'zoho-design-tokens/no-hardcoded-colors': 'warn',
      // React Query data-layer discipline (world-class-performance R2.1)
      'local/require-query-class': 'warn',
      'local/precise-invalidation': 'warn',
    },
  },
  // Umbrella runtime layer (system-wide-ux-overhaul) — these directories are
  // built fresh against the umbrella's i18n contract, so we hard-fail on any
  // hardcoded user-facing literal here. The pattern can be widened to the
  // whole codebase once the migration sweep (tasks 10.1–10.11) lands.
  // Requirements: 11.4, 13.4, 13.5
  {
    files: [
      'src/components/responsive/**/*.{ts,tsx}',
      'src/help/**/*.{ts,tsx}',
      'src/components/AddGate/**/*.{ts,tsx}',
    ],
    rules: {
      'zoho-i18n/no-hardcoded-literal': 'error',
    },
  },
])
