/**
 * HardwarePairingWizard — 7-step wizard for pairing a printer, scanner,
 * cash drawer, or customer display.
 *
 * Spec: growth-to-100/requirements.md R3.4, R3.5, R3.10, R3.11,
 *       design.md §3.7.
 *
 * Steps:
 *   1. Choose device type
 *   2. Choose connection method
 *   3. Discover devices
 *   4. Select target device
 *   5. Identify dialect (auto + manual override)
 *   6. Test print + verify cut
 *   7. Configure cash drawer + save
 *
 * Localised strings are loaded from the `pos.hardware` i18n namespace
 * (Kurdish primary, Arabic + English alternates). When the namespace
 * isn't wired (early dev / Storybook), we fall back to English literals.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ALL_DIALECTS, getDialectById } from '../../hardware/printers/dialects';
import { detectCapabilities, PrinterService } from '../../hardware/printers/printer-service';
import { CashDrawerService } from '../../hardware/cash-drawer/cash-drawer';
import { DisplayService } from '../../hardware/customer-display/display-service';
import type { DialectId, TransportDescriptor } from '../../hardware/printers/types';
import { HardwareDeviceCard } from './HardwareDeviceCard';
import { TestPrintPreview } from './TestPrintPreview';

// ─────────────────── i18n shim — pluggable, English fallback ───────────

type Translator = (key: string, fallback: string) => string;

const defaultT: Translator = (_k, fb) => fb;

// ─────────────────── Types ─────────────────────────────────────────────

export type DeviceType = 'printer' | 'scanner' | 'drawer' | 'display';
export type ConnectionMethod = 'bluetooth' | 'usb' | 'serial' | 'wifi' | 'native-ble';

interface WizardState {
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  deviceType?: DeviceType;
  connection?: ConnectionMethod;
  discovered: TransportDescriptor[];
  selectedDescriptor?: TransportDescriptor;
  dialectId?: DialectId;
  testPrintCutOk?: boolean;
  drawerPin?: 2 | 5;
  drawerKickOk?: boolean;
  savedAt?: string;
  error?: string;
}

const initialState: WizardState = { step: 1, discovered: [] };

// ─────────────────── Persistence (IndexedDB via PrinterService) ────────

const STORAGE_KEY = 'pos.hardware.paired';

interface SavedConfig {
  type: DeviceType;
  descriptor: TransportDescriptor;
  dialectId?: DialectId;
  drawerPin?: 2 | 5;
  savedAt: string;
}

function persistConfig(cfg: SavedConfig) {
  try {
    const all: Record<string, SavedConfig> = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[cfg.type] = cfg;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage may be unavailable in private mode — ignore.
  }
}

// ─────────────────── Wizard component ──────────────────────────────────

interface Props {
  /** Optional i18n translator (key, fallback) → text. */
  t?: Translator;
  /** Terminal id used by display drivers. Defaults to 'T-001'. */
  terminalId?: string;
  /** Called when wizard reaches step 7 + saves successfully. */
  onComplete?: (cfg: SavedConfig) => void;
  /** Called when user cancels / closes. */
  onCancel?: () => void;
}

export const HardwarePairingWizard: React.FC<Props> = ({ t = defaultT, terminalId = 'T-001', onComplete, onCancel }) => {
  const [state, setState] = useState<WizardState>(initialState);
  const caps = useMemo(() => detectCapabilities(), []);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  // ─── Step 3 — discover ───
  const discover = useCallback(async () => {
    update({ discovered: [], error: undefined });
    try {
      let found: TransportDescriptor[] = [];
      if (state.connection === 'bluetooth' || state.connection === 'native-ble') {
        found = await PrinterService.discoverBluetooth();
      } else if (state.connection === 'usb') {
        found = await PrinterService.discoverUsb();
      } else if (state.connection === 'serial') {
        found = [
          {
            kind: 'serial',
            id: 'serial-pending',
            label: 'Choose serial port…',
          },
        ];
      } else if (state.connection === 'wifi') {
        found = [];
      }
      update({ discovered: found });
    } catch (err: any) {
      update({ error: err?.message ?? String(err) });
    }
  }, [state.connection, update]);

  // ─── Step 5 — detect dialect (printers only) ───
  const detectDialect = useCallback(async () => {
    if (!state.selectedDescriptor) return;
    try {
      const active = await PrinterService.connect(state.selectedDescriptor);
      update({ dialectId: active.dialect.id });
    } catch (err: any) {
      update({ error: err?.message ?? String(err) });
    }
  }, [state.selectedDescriptor, update]);

  // ─── Step 6 — test print ───
  const runTestPrint = useCallback(async () => {
    try {
      await PrinterService.testPrint();
    } catch (err: any) {
      update({ error: err?.message ?? String(err) });
    }
  }, [update]);

  // ─── Step 7 — drawer kick + save ───
  const runDrawerKick = useCallback(
    async (pin: 2 | 5) => {
      const res = await CashDrawerService.kickDrawer({ pin });
      update({ drawerPin: pin, drawerKickOk: res.ok });
    },
    [update],
  );

  const save = useCallback(() => {
    if (!state.selectedDescriptor || !state.deviceType) return;
    const cfg: SavedConfig = {
      type: state.deviceType,
      descriptor: state.selectedDescriptor,
      dialectId: state.dialectId,
      drawerPin: state.drawerPin,
      savedAt: new Date().toISOString(),
    };
    persistConfig(cfg);
    update({ savedAt: cfg.savedAt });
    onComplete?.(cfg);
  }, [state, update, onComplete]);

  // ─── Reset ───
  const reset = useCallback(() => setState(initialState), []);

  // ─── Display pairing helper (skips dialect detection) ───
  useEffect(() => {
    if (state.step === 5 && state.deviceType === 'display' && state.selectedDescriptor) {
      // Displays don't have a dialect; skip to step 6 (no test print) → step 7.
      update({ step: 7 });
      if (state.connection === 'bluetooth') {
        void DisplayService.pairBluetoothTablet({
          deviceId: state.selectedDescriptor.id,
          deviceLabel: state.selectedDescriptor.label,
          terminalId,
        });
      } else if (state.connection === 'wifi') {
        void DisplayService.pairWifi({
          endpoint: state.selectedDescriptor.id,
          label: state.selectedDescriptor.label,
          terminalId,
        });
      } else if (state.connection === 'serial') {
        void DisplayService.pairSerial();
      }
    }
  }, [state.step, state.deviceType, state.selectedDescriptor, state.connection, terminalId, update]);

  // ─── Rendering ───
  return (
    <div role="dialog" aria-label="Hardware pairing wizard" style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t('pos.hardware.wizard.title', 'Pair hardware / یەکخستنی ئامێر')}</h2>
        <div style={{ fontSize: 13, color: '#666' }}>
          {t('pos.hardware.wizard.subtitle', 'Step')} {state.step} / 7
        </div>
      </header>

      {state.error && (
        <div role="alert" style={{ background: '#fff1f0', border: '1px solid #ffa39e', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          {state.error}
        </div>
      )}

      {state.step === 1 && (
        <section>
          <h3>{t('pos.hardware.step1', '1. Choose device type')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {(['printer', 'scanner', 'drawer', 'display'] as DeviceType[]).map((dt) => (
              <button
                key={dt}
                type="button"
                onClick={() => update({ deviceType: dt, step: 2 })}
                style={{ padding: 16, borderRadius: 8, border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer' }}
              >
                {t(`pos.hardware.deviceType.${dt}`, dt)}
              </button>
            ))}
          </div>
        </section>
      )}

      {state.step === 2 && (
        <section>
          <h3>{t('pos.hardware.step2', '2. Choose connection')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {([
              { id: 'bluetooth', avail: caps.hasWebBluetooth || caps.hasNativeBle, label: 'Bluetooth' },
              { id: 'usb', avail: caps.hasWebUsb, label: 'USB' },
              { id: 'serial', avail: caps.hasWebSerial, label: 'Serial / RS-232' },
              { id: 'wifi', avail: true, label: 'WiFi' },
            ] as Array<{ id: ConnectionMethod; avail: boolean; label: string }>).map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!c.avail}
                onClick={() => update({ connection: c.id, step: 3 })}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid #d9d9d9',
                  background: c.avail ? '#fff' : '#fafafa',
                  cursor: c.avail ? 'pointer' : 'not-allowed',
                  opacity: c.avail ? 1 : 0.5,
                }}
              >
                {t(`pos.hardware.connection.${c.id}`, c.label)}
                {!c.avail && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                    {t('pos.hardware.notSupported', 'not supported on this device')}
                  </div>
                )}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => update({ step: 1 })}>← Back</button>
          </div>
        </section>
      )}

      {state.step === 3 && (
        <section>
          <h3>{t('pos.hardware.step3', '3. Scan for devices')}</h3>
          <button type="button" onClick={discover}>
            {t('pos.hardware.scan', 'Scan now')}
          </button>
          <ul style={{ marginTop: 12, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.discovered.map((d) => (
              <li key={d.id}>
                <HardwareDeviceCard
                  label={d.label}
                  sublabel={d.id}
                  transport={d.kind}
                  rssi={d.rssi}
                  selected={state.selectedDescriptor?.id === d.id}
                  onClick={() => update({ selectedDescriptor: d, step: 4 })}
                />
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => update({ step: 2 })}>← Back</button>
          </div>
        </section>
      )}

      {state.step === 4 && state.selectedDescriptor && (
        <section>
          <h3>{t('pos.hardware.step4', '4. Confirm device')}</h3>
          <HardwareDeviceCard
            label={state.selectedDescriptor.label}
            sublabel={state.selectedDescriptor.id}
            transport={state.selectedDescriptor.kind}
            selected
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => update({ step: 3 })}>← Back</button>
            <button
              type="button"
              onClick={() => update({ step: 5 })}
              style={{ background: '#1677ff', color: '#fff', padding: '8px 16px', borderRadius: 6, border: 'none' }}
            >
              {t('pos.hardware.continue', 'Continue')} →
            </button>
          </div>
        </section>
      )}

      {state.step === 5 && state.deviceType === 'printer' && (
        <section>
          <h3>{t('pos.hardware.step5', '5. Identify printer dialect')}</h3>
          <button type="button" onClick={detectDialect}>
            {t('pos.hardware.detectAuto', 'Detect automatically')}
          </button>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, color: '#555' }}>
              {t('pos.hardware.manualOverride', 'Or pick manually:')}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {ALL_DIALECTS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => update({ dialectId: d.id, step: 6 })}
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    border: state.dialectId === d.id ? '2px solid #1677ff' : '1px solid #d9d9d9',
                    background: '#fff',
                    cursor: 'pointer',
                    textAlign: 'start',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{d.displayName}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{d.id} • {d.width}mm</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={() => update({ step: 4 })}>← Back</button>
            {state.dialectId && (
              <button type="button" onClick={() => update({ step: 6 })} style={{ marginInlineStart: 8 }}>
                {t('pos.hardware.continue', 'Continue')} →
              </button>
            )}
          </div>
        </section>
      )}

      {state.step === 6 && state.dialectId && (
        <section>
          <h3>{t('pos.hardware.step6', '6. Test print & verify cut')}</h3>
          <TestPrintPreview dialectId={state.dialectId} showTrace />
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button type="button" onClick={runTestPrint}>
              {t('pos.hardware.runTestPrint', 'Print test page')}
            </button>
            <button
              type="button"
              onClick={() => update({ testPrintCutOk: true, step: state.deviceType === 'printer' ? 7 : 7 })}
              style={{ background: '#52c41a', color: '#fff', padding: '8px 16px', borderRadius: 6, border: 'none' }}
            >
              {t('pos.hardware.cutOk', 'Cut OK')}
            </button>
            <button
              type="button"
              onClick={() => update({ testPrintCutOk: false, step: 7 })}
              style={{ background: '#ff4d4f', color: '#fff', padding: '8px 16px', borderRadius: 6, border: 'none' }}
            >
              {t('pos.hardware.cutFail', 'Cut failed')}
            </button>
            <button type="button" onClick={() => update({ step: 5 })} style={{ marginInlineStart: 'auto' }}>
              ← Back
            </button>
          </div>
        </section>
      )}

      {state.step === 7 && (
        <section>
          <h3>{t('pos.hardware.step7', '7. Cash drawer & save')}</h3>
          {state.deviceType === 'printer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>{t('pos.hardware.drawerExplain', 'Test which pin fires your drawer:')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => runDrawerKick(5)}>
                  {t('pos.hardware.kickPin5', 'Kick pin 5')}
                </button>
                <button type="button" onClick={() => runDrawerKick(2)}>
                  {t('pos.hardware.kickPin2', 'Kick pin 2')}
                </button>
                <button type="button" onClick={() => update({ drawerPin: undefined, drawerKickOk: false })}>
                  {t('pos.hardware.skipDrawer', 'No drawer')}
                </button>
              </div>
              {state.drawerPin && (
                <div style={{ fontSize: 13 }}>
                  {t('pos.hardware.drawerResult', 'Saved drawer pin')}: <strong>{state.drawerPin}</strong>
                  {state.drawerKickOk ? ' ✓' : ' ✗'}
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={save}
              style={{ background: '#1677ff', color: '#fff', padding: '8px 16px', borderRadius: 6, border: 'none' }}
            >
              {t('pos.hardware.save', 'Save & finish')}
            </button>
            <button type="button" onClick={reset}>
              {t('pos.hardware.startOver', 'Start over')}
            </button>
            <button type="button" onClick={onCancel}>
              {t('pos.hardware.cancel', 'Cancel')}
            </button>
          </div>
          {state.savedAt && (
            <div style={{ marginTop: 12, color: '#52c41a' }}>
              {t('pos.hardware.savedAt', 'Saved at')} {state.savedAt}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default HardwarePairingWizard;

// Helper for callers that want to read the persisted config.
export function readSavedHardwareConfig(): Record<string, SavedConfig> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSavedHardwareConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore.
  }
}
