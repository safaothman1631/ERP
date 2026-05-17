/**
 * settingsInventoryScanner.ts
 *
 * Frontend settings inventory scanner.
 * Scans and catalogs all frontend configuration files, extracts key parameters,
 * and flags hardcoded secrets or credentials.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ConfigCategory =
  | 'environment'
  | 'framework'
  | 'auth'
  | 'api'
  | 'database'
  | 'i18n'
  | 'theme'
  | 'build';

export interface ConfigFileEntry {
  /** Relative path from project root */
  filePath: string;
  /** Human-readable purpose of this config file */
  purpose: string;
  /** Category of configuration */
  category: ConfigCategory;
  /** Key parameters documented in this file */
  keyParameters: string[];
  /** Whether this file contains sensitive data */
  containsSensitiveData: boolean;
  /** Specific secrets or credentials detected (key names only, not values) */
  detectedSecrets: string[];
}

export interface InventoryScanResult {
  /** All cataloged configuration files */
  files: ConfigFileEntry[];
  /** Total number of files scanned */
  totalFiles: number;
  /** Number of files flagged as containing sensitive data */
  sensitiveFileCount: number;
  /** All detected secret key names across all files */
  allDetectedSecrets: string[];
}

export interface ScanOptions {
  /** Additional file entries to include (for extensibility) */
  additionalFiles?: ConfigFileEntry[];
  /** Whether to include files with no key parameters */
  includeEmpty?: boolean;
}

// ── Secret detection patterns ────────────────────────────────────────────────

/**
 * Patterns that indicate a hardcoded secret or credential.
 * Matches against parameter/key names (case-insensitive).
 */
const SECRET_PATTERNS: RegExp[] = [
  /apiKey/i,
  /api_key/i,
  /secret/i,
  /password/i,
  /credential/i,
  /token/i,
  /private.*key/i,
  /auth.*key/i,
  /access.*key/i,
  /client.*secret/i,
  /app.*id/i,
  /measurement.*id/i,
  /messaging.*sender/i,
];

/**
 * Determines whether a parameter name looks like a hardcoded secret.
 */
export function isSecretParameter(paramName: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(paramName));
}

/**
 * Detects which parameters in a list are likely secrets.
 */
export function detectSecrets(parameters: string[]): string[] {
  return parameters.filter(isSecretParameter);
}

// ── Static catalog of known frontend config files ────────────────────────────

/**
 * The canonical catalog of all frontend configuration files.
 * This is the source of truth for the inventory scanner.
 */
const FRONTEND_CONFIG_CATALOG: ConfigFileEntry[] = [
  {
    filePath: 'frontend/.env',
    purpose: 'Environment variables for local development (not committed to VCS)',
    category: 'environment',
    keyParameters: ['VITE_API_URL', 'VITE_FIREBASE_API_KEY', 'VITE_APP_ENV'],
    containsSensitiveData: true,
    detectedSecrets: ['VITE_FIREBASE_API_KEY'],
  },
  {
    filePath: 'frontend/.env.example',
    purpose: 'Template for environment variables — safe to commit, no real values',
    category: 'environment',
    keyParameters: ['VITE_API_URL', 'VITE_FIREBASE_API_KEY', 'VITE_APP_ENV'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
  {
    filePath: 'frontend/package.json',
    purpose: 'Node.js project manifest — dependencies, scripts, and metadata',
    category: 'framework',
    keyParameters: ['name', 'version', 'scripts', 'dependencies', 'devDependencies'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
  {
    filePath: 'frontend/tsconfig.json',
    purpose: 'TypeScript compiler configuration — strict mode, module resolution',
    category: 'framework',
    keyParameters: ['compilerOptions', 'strict', 'target', 'module', 'paths'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
  {
    filePath: 'frontend/tsconfig.app.json',
    purpose: 'TypeScript config for application source files',
    category: 'framework',
    keyParameters: ['compilerOptions', 'include', 'exclude'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
  {
    filePath: 'frontend/vite.config.ts',
    purpose: 'Vite build tool configuration — dev server, proxy, build optimizations',
    category: 'build',
    keyParameters: ['plugins', 'server.port', 'server.proxy', 'build.rollupOptions', 'manualChunks'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
  {
    filePath: 'frontend/src/firebase.ts',
    purpose: 'Firebase SDK initialization — auth, Firestore, analytics configuration',
    category: 'auth',
    keyParameters: ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'],
    containsSensitiveData: true,
    detectedSecrets: ['apiKey', 'messagingSenderId', 'appId', 'measurementId'],
  },
  {
    filePath: 'frontend/src/i18n.ts',
    purpose: 'Internationalization configuration — language resources, RTL support, missing key handler',
    category: 'i18n',
    keyParameters: ['resources', 'lng', 'fallbackLng', 'parseMissingKeyHandler', 'RTL_LANGS'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
  {
    filePath: 'frontend/src/theme/tokens.ts',
    purpose: 'Design token definitions — colors, spacing, typography, motion, shadows, z-index',
    category: 'theme',
    keyParameters: ['colorPrimary', 'colorBgContainer', 'spacing', 'typography', 'motion', 'shadows', 'zIndex'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
  {
    filePath: 'frontend/src/store/settingsStore.ts',
    purpose: 'Zustand settings store — persisted application configuration with localStorage sync',
    category: 'api',
    keyParameters: ['formats', 'branding', 'payment_methods', 'localization', 'languages', 'sso', 'portals'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
  {
    filePath: 'frontend/playwright.config.ts',
    purpose: 'Playwright end-to-end test configuration — locale, browser, base URL',
    category: 'framework',
    keyParameters: ['testDir', 'use.locale', 'use.baseURL', 'projects'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
  {
    filePath: 'frontend/eslint.config.js',
    purpose: 'ESLint configuration — code quality rules for TypeScript and React',
    category: 'framework',
    keyParameters: ['rules', 'plugins', 'extends'],
    containsSensitiveData: false,
    detectedSecrets: [],
  },
];

// ── Scanner functions ─────────────────────────────────────────────────────────

/**
 * Returns the full catalog of known frontend configuration files.
 * Throws if the catalog is empty (should never happen in a valid build).
 */
export function getCatalog(): ConfigFileEntry[] {
  if (FRONTEND_CONFIG_CATALOG.length === 0) {
    throw new Error('Settings inventory catalog is empty — this indicates a build error.');
  }
  return [...FRONTEND_CONFIG_CATALOG];
}

/**
 * Scans and catalogs all frontend configuration files.
 *
 * @param options - Optional scan configuration
 * @returns InventoryScanResult with all cataloged files and summary statistics
 */
export function scanFrontendInventory(options: ScanOptions = {}): InventoryScanResult {
  const baseCatalog = getCatalog();
  const additional = options.additionalFiles ?? [];
  const allFiles = [...baseCatalog, ...additional];

  const filtered = options.includeEmpty === false
    ? allFiles.filter((f) => f.keyParameters.length > 0)
    : allFiles;

  const sensitiveFiles = filtered.filter((f) => f.containsSensitiveData);
  const allSecrets = filtered.flatMap((f) => f.detectedSecrets);
  const uniqueSecrets = [...new Set(allSecrets)];

  return {
    files: filtered,
    totalFiles: filtered.length,
    sensitiveFileCount: sensitiveFiles.length,
    allDetectedSecrets: uniqueSecrets,
  };
}

/**
 * Looks up a config file entry by its file path.
 *
 * @param filePath - The relative file path to look up
 * @returns The matching ConfigFileEntry, or undefined if not found
 */
export function getConfigEntry(filePath: string): ConfigFileEntry | undefined {
  return FRONTEND_CONFIG_CATALOG.find((entry) => entry.filePath === filePath);
}

/**
 * Returns all config files in a given category.
 *
 * @param category - The category to filter by
 * @returns Array of matching ConfigFileEntry objects
 */
export function getFilesByCategory(category: ConfigCategory): ConfigFileEntry[] {
  return FRONTEND_CONFIG_CATALOG.filter((entry) => entry.category === category);
}

/**
 * Returns all config files that contain sensitive data.
 */
export function getSensitiveFiles(): ConfigFileEntry[] {
  return FRONTEND_CONFIG_CATALOG.filter((entry) => entry.containsSensitiveData);
}

/**
 * Validates a ConfigFileEntry for completeness.
 * Returns an array of validation error messages (empty = valid).
 */
export function validateEntry(entry: ConfigFileEntry): string[] {
  const errors: string[] = [];
  if (!entry.filePath || entry.filePath.trim() === '') {
    errors.push('filePath is required');
  }
  if (!entry.purpose || entry.purpose.trim() === '') {
    errors.push('purpose is required');
  }
  if (!entry.category) {
    errors.push('category is required');
  }
  if (!Array.isArray(entry.keyParameters)) {
    errors.push('keyParameters must be an array');
  }
  if (entry.containsSensitiveData && entry.detectedSecrets.length === 0) {
    errors.push('containsSensitiveData is true but detectedSecrets is empty');
  }
  return errors;
}
