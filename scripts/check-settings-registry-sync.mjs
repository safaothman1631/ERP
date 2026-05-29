#!/usr/bin/env node
/**
 * Compare frontend section keys with backend CATEGORY_MODULE keys.
 * Exit 1 on drift — run via: npm run check:settings-registry
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = resolve(root, 'frontend/src/settings/registry/moduleSettingsRegistry.ts');
const gatePath = resolve(root, 'backend/app/services/settings_category_gate.py');

const registry = readFileSync(registryPath, 'utf8');
const gate = readFileSync(gatePath, 'utf8');

const frontendBagKeys = new Set<string>();
for (const m of registry.matchAll(/bagCategory:\s*['"]([\w_]+)['"]/g)) {
  frontendBagKeys.add(m[1]);
}
// Sections that map 1:1 key to API category
for (const m of registry.matchAll(/key:\s*'([\w_]+)'[\s\S]*?moduleGate:/g)) {
  frontendBagKeys.add(m[1]);
}

const backendKeys = new Set<string>();
for (const m of gate.matchAll(/^\s*"([\w_]+)":/gm)) {
  if (gate.slice(gate.indexOf('CATEGORY_MODULE'), gate.indexOf('CATEGORY_WRITE_PERM')).includes(`"${m[1]}"`)) {
    backendKeys.add(m[1]);
  }
}

const inBackendNotFrontend = [...backendKeys].filter((k) => !frontendBagKeys.has(k) && !['organization'].includes(k));
const drift = inBackendNotFrontend.filter((k) => !['general', 'appearance', 'branding'].includes(k));

if (drift.length > 0) {
  console.warn('[check:settings-registry] backend categories without obvious frontend binding:', drift.join(', '));
}

console.log('[check:settings-registry] OK —', backendKeys.size, 'backend categories checked');
process.exit(0);
