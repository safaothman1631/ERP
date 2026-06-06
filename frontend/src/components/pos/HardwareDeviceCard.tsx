/**
 * HardwareDeviceCard — small card used in the pairing wizard to show a
 * discovered device with name + transport icon + RSSI strength.
 */
import React from 'react';

interface Props {
  label: string;
  sublabel?: string;
  transport: 'bluetooth' | 'usb' | 'serial' | 'wifi' | 'native-ble';
  rssi?: number;
  selected?: boolean;
  onClick?: () => void;
}

const TRANSPORT_ICON: Record<Props['transport'], string> = {
  bluetooth: 'BT',
  'native-ble': 'BLE',
  usb: 'USB',
  serial: 'COM',
  wifi: 'Wi',
};

function rssiBars(rssi?: number): string {
  if (rssi === undefined) return '';
  if (rssi > -55) return '████';
  if (rssi > -70) return '███▒';
  if (rssi > -85) return '██▒▒';
  return '█▒▒▒';
}

export const HardwareDeviceCard: React.FC<Props> = ({ label, sublabel, transport, rssi, selected, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!selected}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 8,
        border: selected ? '2px solid var(--accent-500)' : '1px solid var(--border)',
        background: selected ? 'var(--accent-soft)' : 'var(--surface)',
        width: '100%',
        cursor: 'pointer',
        textAlign: 'start',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          background: 'var(--surface-2)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'var(--ink-500)',
        }}
      >
        {TRANSPORT_ICON[transport]}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
        {sublabel && (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)' }}>{sublabel}</span>
        )}
      </span>
      {rssi !== undefined && (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--ink-500)' }}>
          {rssiBars(rssi)} {rssi} dBm
        </span>
      )}
    </button>
  );
};

export default HardwareDeviceCard;
