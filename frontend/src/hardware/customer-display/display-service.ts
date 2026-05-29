/**
 * Customer display service — high-level façade over the three drivers.
 *
 * Spec: growth-to-100/requirements.md R3.9 / R3.11.
 *
 * The POS calls `DisplayService.updateLine1()` etc. without knowing which
 * driver is active. The service holds the currently-paired driver and
 * forwards calls; if no display is paired, calls are no-ops (POS UI is
 * unaffected).
 */
import { BluetoothCustomerDisplay } from './bluetooth-driver';
import { SerialCustomerDisplay, pairSerialDisplay } from './serial-driver';
import { WifiCustomerDisplay } from './wifi-driver';
import type { DisplayDescriptor, DisplayDriver, DisplayState } from './types';

let active: DisplayDriver | null = null;

/** Default Firestore-backed writer — overridable for testing. */
let stateWriter: (terminalId: string, state: DisplayState) => Promise<void> = async (
  terminalId,
  state,
) => {
  // Lazy-load Firestore so this module is import-safe in tests without firebase.
  try {
    const mod = await import('../../firebase' as any).catch(() => null);
    const fs = mod?.firestore ?? mod?.db ?? null;
    if (!fs) return;
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    await setDoc(
      doc(fs, 'pos_display_state', terminalId),
      { ...state, updated_at: serverTimestamp() },
      { merge: true },
    );
  } catch {
    // No Firebase in this build path — silently skip.
  }
};

export function setDisplayStateWriter(writer: typeof stateWriter): void {
  stateWriter = writer;
}

export async function pairSerial(): Promise<DisplayDriver | null> {
  const d = await pairSerialDisplay();
  if (!d) return null;
  await d.connect();
  active = d;
  return d;
}

export async function pairBluetoothTablet(opts: {
  deviceId: string;
  deviceLabel: string;
  terminalId: string;
}): Promise<DisplayDriver> {
  const d = new BluetoothCustomerDisplay({
    ...opts,
    writer: (tid, state) => stateWriter(tid, state),
  });
  await d.connect();
  active = d;
  return d;
}

export async function pairWifi(opts: {
  endpoint: string;
  label: string;
  terminalId: string;
  wakeUrl?: string;
}): Promise<DisplayDriver> {
  const d = new WifiCustomerDisplay({
    ...opts,
    writer: (tid, state) => stateWriter(tid, state),
  });
  await d.connect();
  active = d;
  return d;
}

export function getActiveDisplay(): DisplayDriver | null {
  return active;
}

export async function unpair(): Promise<void> {
  if (active) {
    try {
      await active.disconnect();
    } finally {
      active = null;
    }
  }
}

export async function updateLine1(text: string): Promise<void> {
  if (!active) return;
  await active.updateLine1(text);
}

export async function updateLine2(text: string): Promise<void> {
  if (!active) return;
  await active.updateLine2(text);
}

export async function showTotal(amount: number, currency = 'IQD'): Promise<void> {
  if (!active) return;
  await active.showTotal(amount, currency);
}

export async function pushState(state: DisplayState): Promise<void> {
  if (!active) return;
  await active.pushState(state);
}

export async function clearDisplay(): Promise<void> {
  if (!active) return;
  await active.clear();
}

export const DisplayService = {
  pairSerial,
  pairBluetoothTablet,
  pairWifi,
  unpair,
  getActiveDisplay,
  updateLine1,
  updateLine2,
  showTotal,
  pushState,
  clearDisplay,
  setDisplayStateWriter,
};

export type { DisplayDescriptor, DisplayDriver, DisplayState } from './types';

export default DisplayService;
