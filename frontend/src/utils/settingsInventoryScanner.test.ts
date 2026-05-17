/**
 * settingsInventoryScanner.test.ts
 *
 * Unit tests for the frontend settings inventory scanner.
 *
 * Runner: Vitest
 *
 * Feature: settings-documentation
 * Requirements: 1.1, 1.2
 *
 * Test coverage:
 *  - File scanning and cataloging (Requirement 1.1, 1.2)
 *  - Secret detection logic (Requirement 1.5)
 *  - Error handling for missing/invalid entries
 */

import { describe, it, expect } from 'vitest';
import {
  scanFrontendInventory,
  getCatalog,
  getConfigEntry,
  getFilesByCategory,
  getSensitiveFiles,
  detectSecrets,
  isSecretParameter,
  validateEntry,
  type ConfigFileEntry,
  type ConfigCategory,
} from './settingsInventoryScanner';

// ── Requirement 1.1 — Complete inventory of all configuration files ───────────

describe('scanFrontendInventory — file scanning and cataloging', () => {
  it('returns a non-empty list of cataloged files', () => {
    const result = scanFrontendInventory();
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('totalFiles matches the length of the files array', () => {
    const result = scanFrontendInventory();
    expect(result.totalFiles).toBe(result.files.length);
  });

  it('includes the Firebase config file in the catalog', () => {
    const result = scanFrontendInventory();
    const firebaseEntry = result.files.find((f) => f.filePath === 'frontend/src/firebase.ts');
    expect(firebaseEntry).toBeDefined();
  });

  it('includes the Vite config file in the catalog', () => {
    const result = scanFrontendInventory();
    const viteEntry = result.files.find((f) => f.filePath === 'frontend/vite.config.ts');
    expect(viteEntry).toBeDefined();
  });

  it('includes the i18n config file in the catalog', () => {
    const result = scanFrontendInventory();
    const i18nEntry = result.files.find((f) => f.filePath === 'frontend/src/i18n.ts');
    expect(i18nEntry).toBeDefined();
  });

  it('includes the settings store in the catalog', () => {
    const result = scanFrontendInventory();
    const storeEntry = result.files.find((f) => f.filePath === 'frontend/src/store/settingsStore.ts');
    expect(storeEntry).toBeDefined();
  });

  it('includes the package.json in the catalog', () => {
    const result = scanFrontendInventory();
    const pkgEntry = result.files.find((f) => f.filePath === 'frontend/package.json');
    expect(pkgEntry).toBeDefined();
  });

  it('includes the tsconfig.json in the catalog', () => {
    const result = scanFrontendInventory();
    const tsconfigEntry = result.files.find((f) => f.filePath === 'frontend/tsconfig.json');
    expect(tsconfigEntry).toBeDefined();
  });
});

// ── Requirement 1.2 — Each entry has filePath, purpose, keyParameters, sensitive flag ──

describe('scanFrontendInventory — entry completeness (Requirement 1.2)', () => {
  it('every file entry has a non-empty filePath', () => {
    const result = scanFrontendInventory();
    for (const entry of result.files) {
      expect(entry.filePath).toBeTruthy();
    }
  });

  it('every file entry has a non-empty purpose', () => {
    const result = scanFrontendInventory();
    for (const entry of result.files) {
      expect(entry.purpose).toBeTruthy();
    }
  });

  it('every file entry has a category', () => {
    const result = scanFrontendInventory();
    const validCategories: ConfigCategory[] = [
      'environment', 'framework', 'auth', 'api', 'database', 'i18n', 'theme', 'build',
    ];
    for (const entry of result.files) {
      expect(validCategories).toContain(entry.category);
    }
  });

  it('every file entry has a keyParameters array', () => {
    const result = scanFrontendInventory();
    for (const entry of result.files) {
      expect(Array.isArray(entry.keyParameters)).toBe(true);
    }
  });

  it('every file entry has a boolean containsSensitiveData field', () => {
    const result = scanFrontendInventory();
    for (const entry of result.files) {
      expect(typeof entry.containsSensitiveData).toBe('boolean');
    }
  });

  it('every file entry has a detectedSecrets array', () => {
    const result = scanFrontendInventory();
    for (const entry of result.files) {
      expect(Array.isArray(entry.detectedSecrets)).toBe(true);
    }
  });
});

// ── Requirement 1.3 — Config file categories are covered ─────────────────────

describe('getFilesByCategory — category coverage (Requirement 1.3)', () => {
  it('returns environment config files', () => {
    const files = getFilesByCategory('environment');
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.category === 'environment')).toBe(true);
  });

  it('returns framework config files', () => {
    const files = getFilesByCategory('framework');
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.category === 'framework')).toBe(true);
  });

  it('returns auth config files', () => {
    const files = getFilesByCategory('auth');
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.category === 'auth')).toBe(true);
  });

  it('returns i18n config files', () => {
    const files = getFilesByCategory('i18n');
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.category === 'i18n')).toBe(true);
  });

  it('returns theme config files', () => {
    const files = getFilesByCategory('theme');
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.category === 'theme')).toBe(true);
  });

  it('returns build config files', () => {
    const files = getFilesByCategory('build');
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.category === 'build')).toBe(true);
  });

  it('returns empty array for a category with no entries', () => {
    const files = getFilesByCategory('database');
    expect(Array.isArray(files)).toBe(true);
    // database may be empty — just verify it returns an array
  });
});

// ── Requirement 1.5 — Secret detection logic ─────────────────────────────────

describe('isSecretParameter — secret detection logic (Requirement 1.5)', () => {
  it('flags "apiKey" as a secret', () => {
    expect(isSecretParameter('apiKey')).toBe(true);
  });

  it('flags "api_key" as a secret', () => {
    expect(isSecretParameter('api_key')).toBe(true);
  });

  it('flags "SECRET_KEY" as a secret', () => {
    expect(isSecretParameter('SECRET_KEY')).toBe(true);
  });

  it('flags "password" as a secret', () => {
    expect(isSecretParameter('password')).toBe(true);
  });

  it('flags "credentials" as a secret', () => {
    expect(isSecretParameter('credentials')).toBe(true);
  });

  it('flags "token" as a secret', () => {
    expect(isSecretParameter('token')).toBe(true);
  });

  it('flags "privateKey" as a secret', () => {
    expect(isSecretParameter('privateKey')).toBe(true);
  });

  it('flags "authKey" as a secret', () => {
    expect(isSecretParameter('authKey')).toBe(true);
  });

  it('flags "accessKey" as a secret', () => {
    expect(isSecretParameter('accessKey')).toBe(true);
  });

  it('flags "clientSecret" as a secret', () => {
    expect(isSecretParameter('clientSecret')).toBe(true);
  });

  it('flags "appId" as a secret', () => {
    expect(isSecretParameter('appId')).toBe(true);
  });

  it('flags "measurementId" as a secret', () => {
    expect(isSecretParameter('measurementId')).toBe(true);
  });

  it('flags "messagingSenderId" as a secret', () => {
    expect(isSecretParameter('messagingSenderId')).toBe(true);
  });

  it('does NOT flag "filePath" as a secret', () => {
    expect(isSecretParameter('filePath')).toBe(false);
  });

  it('does NOT flag "purpose" as a secret', () => {
    expect(isSecretParameter('purpose')).toBe(false);
  });

  it('does NOT flag "category" as a secret', () => {
    expect(isSecretParameter('category')).toBe(false);
  });

  it('does NOT flag "version" as a secret', () => {
    expect(isSecretParameter('version')).toBe(false);
  });

  it('does NOT flag "scripts" as a secret', () => {
    expect(isSecretParameter('scripts')).toBe(false);
  });

  it('does NOT flag "plugins" as a secret', () => {
    expect(isSecretParameter('plugins')).toBe(false);
  });
});

describe('detectSecrets — batch secret detection', () => {
  it('returns only the secret parameters from a mixed list', () => {
    const params = ['filePath', 'apiKey', 'purpose', 'SECRET_KEY', 'category'];
    const secrets = detectSecrets(params);
    expect(secrets).toContain('apiKey');
    expect(secrets).toContain('SECRET_KEY');
    expect(secrets).not.toContain('filePath');
    expect(secrets).not.toContain('purpose');
    expect(secrets).not.toContain('category');
  });

  it('returns empty array when no secrets are present', () => {
    const params = ['filePath', 'purpose', 'category', 'version'];
    expect(detectSecrets(params)).toEqual([]);
  });

  it('returns all items when all are secrets', () => {
    const params = ['apiKey', 'password', 'token'];
    const secrets = detectSecrets(params);
    expect(secrets).toHaveLength(3);
  });

  it('handles an empty parameter list', () => {
    expect(detectSecrets([])).toEqual([]);
  });
});

// ── Sensitive file detection ──────────────────────────────────────────────────

describe('getSensitiveFiles — sensitive data flagging', () => {
  it('returns files marked as containing sensitive data', () => {
    const sensitive = getSensitiveFiles();
    expect(sensitive.length).toBeGreaterThan(0);
    expect(sensitive.every((f) => f.containsSensitiveData)).toBe(true);
  });

  it('includes firebase.ts as a sensitive file', () => {
    const sensitive = getSensitiveFiles();
    const firebaseEntry = sensitive.find((f) => f.filePath === 'frontend/src/firebase.ts');
    expect(firebaseEntry).toBeDefined();
  });

  it('does NOT include package.json as a sensitive file', () => {
    const sensitive = getSensitiveFiles();
    const pkgEntry = sensitive.find((f) => f.filePath === 'frontend/package.json');
    expect(pkgEntry).toBeUndefined();
  });

  it('sensitiveFileCount in scan result matches getSensitiveFiles length', () => {
    const result = scanFrontendInventory();
    const sensitive = getSensitiveFiles();
    expect(result.sensitiveFileCount).toBe(sensitive.length);
  });
});

// ── getConfigEntry — lookup by file path ─────────────────────────────────────

describe('getConfigEntry — lookup by file path', () => {
  it('returns the correct entry for a known file path', () => {
    const entry = getConfigEntry('frontend/src/firebase.ts');
    expect(entry).toBeDefined();
    expect(entry?.category).toBe('auth');
    expect(entry?.containsSensitiveData).toBe(true);
  });

  it('returns undefined for an unknown file path', () => {
    const entry = getConfigEntry('frontend/src/nonexistent.ts');
    expect(entry).toBeUndefined();
  });

  it('returns undefined for an empty string path', () => {
    const entry = getConfigEntry('');
    expect(entry).toBeUndefined();
  });

  it('returns the correct entry for vite.config.ts', () => {
    const entry = getConfigEntry('frontend/vite.config.ts');
    expect(entry).toBeDefined();
    expect(entry?.category).toBe('build');
    expect(entry?.keyParameters).toContain('server.proxy');
  });

  it('returns the correct entry for i18n.ts', () => {
    const entry = getConfigEntry('frontend/src/i18n.ts');
    expect(entry).toBeDefined();
    expect(entry?.category).toBe('i18n');
    expect(entry?.containsSensitiveData).toBe(false);
  });
});

// ── getCatalog — catalog integrity ───────────────────────────────────────────

describe('getCatalog — catalog integrity', () => {
  it('returns a non-empty array', () => {
    const catalog = getCatalog();
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('returns a copy — mutations do not affect the original', () => {
    const catalog1 = getCatalog();
    const catalog2 = getCatalog();
    catalog1.push({
      filePath: 'test/fake.ts',
      purpose: 'fake',
      category: 'framework',
      keyParameters: [],
      containsSensitiveData: false,
      detectedSecrets: [],
    });
    expect(catalog2.length).toBeLessThan(catalog1.length);
  });

  it('all entries have unique file paths', () => {
    const catalog = getCatalog();
    const paths = catalog.map((e) => e.filePath);
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });
});

// ── scanFrontendInventory — additional files option ──────────────────────────

describe('scanFrontendInventory — options', () => {
  it('merges additional files into the result', () => {
    const extra: ConfigFileEntry = {
      filePath: 'frontend/src/custom.config.ts',
      purpose: 'Custom configuration for testing',
      category: 'framework',
      keyParameters: ['customParam'],
      containsSensitiveData: false,
      detectedSecrets: [],
    };
    const result = scanFrontendInventory({ additionalFiles: [extra] });
    const found = result.files.find((f) => f.filePath === 'frontend/src/custom.config.ts');
    expect(found).toBeDefined();
    expect(result.totalFiles).toBe(getCatalog().length + 1);
  });

  it('allDetectedSecrets contains unique values across all files', () => {
    const result = scanFrontendInventory();
    const uniqueSecrets = new Set(result.allDetectedSecrets);
    expect(uniqueSecrets.size).toBe(result.allDetectedSecrets.length);
  });

  it('allDetectedSecrets includes apiKey from firebase.ts', () => {
    const result = scanFrontendInventory();
    expect(result.allDetectedSecrets).toContain('apiKey');
  });
});

// ── validateEntry — error handling for invalid entries ───────────────────────

describe('validateEntry — error handling for missing/invalid fields', () => {
  it('returns no errors for a valid entry', () => {
    const entry: ConfigFileEntry = {
      filePath: 'frontend/src/config.ts',
      purpose: 'Test configuration',
      category: 'framework',
      keyParameters: ['param1'],
      containsSensitiveData: false,
      detectedSecrets: [],
    };
    expect(validateEntry(entry)).toEqual([]);
  });

  it('returns error when filePath is empty', () => {
    const entry: ConfigFileEntry = {
      filePath: '',
      purpose: 'Test',
      category: 'framework',
      keyParameters: [],
      containsSensitiveData: false,
      detectedSecrets: [],
    };
    const errors = validateEntry(entry);
    expect(errors).toContain('filePath is required');
  });

  it('returns error when purpose is empty', () => {
    const entry: ConfigFileEntry = {
      filePath: 'frontend/src/config.ts',
      purpose: '',
      category: 'framework',
      keyParameters: [],
      containsSensitiveData: false,
      detectedSecrets: [],
    };
    const errors = validateEntry(entry);
    expect(errors).toContain('purpose is required');
  });

  it('returns error when containsSensitiveData is true but detectedSecrets is empty', () => {
    const entry: ConfigFileEntry = {
      filePath: 'frontend/src/config.ts',
      purpose: 'Sensitive config',
      category: 'auth',
      keyParameters: ['apiKey'],
      containsSensitiveData: true,
      detectedSecrets: [],
    };
    const errors = validateEntry(entry);
    expect(errors).toContain('containsSensitiveData is true but detectedSecrets is empty');
  });

  it('returns multiple errors for multiple invalid fields', () => {
    const entry: ConfigFileEntry = {
      filePath: '',
      purpose: '',
      category: 'framework',
      keyParameters: [],
      containsSensitiveData: false,
      detectedSecrets: [],
    };
    const errors = validateEntry(entry);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('returns no errors when containsSensitiveData is true and detectedSecrets is non-empty', () => {
    const entry: ConfigFileEntry = {
      filePath: 'frontend/src/firebase.ts',
      purpose: 'Firebase config',
      category: 'auth',
      keyParameters: ['apiKey'],
      containsSensitiveData: true,
      detectedSecrets: ['apiKey'],
    };
    expect(validateEntry(entry)).toEqual([]);
  });
});
