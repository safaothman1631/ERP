import { describe, expect, it } from 'vitest';
import { buildSettingsCommandItems } from '../settingsCommandItems';

describe('buildSettingsCommandItems', () => {
  const t = (key: string, fb?: string) => fb ?? key;
  const navigate = () => undefined;

  it('includes sales settings for admin with sales module', () => {
    const items = buildSettingsCommandItems(t, navigate, ['sales', 'accounting', 'banking'], 'admin', ['settings.update']);
    expect(items.some((item) => item.id === 'settings:sales')).toBe(true);
  });

  it('excludes crm when module not enabled', () => {
    const items = buildSettingsCommandItems(t, navigate, ['sales', 'accounting', 'banking'], 'admin', ['settings.update']);
    expect(items.some((item) => item.id === 'settings:crm')).toBe(false);
  });

  it('excludes org settings for viewer', () => {
    const items = buildSettingsCommandItems(t, navigate, ['sales'], 'viewer', []);
    expect(items.some((item) => item.id === 'settings:sales')).toBe(false);
    expect(items.some((item) => item.id === 'settings:profile')).toBe(true);
  });

  it('never includes feature_flags', () => {
    const items = buildSettingsCommandItems(t, navigate, ['sales'], 'admin', ['settings.update']);
    expect(items.some((item) => item.id === 'settings:feature_flags')).toBe(false);
  });
});
