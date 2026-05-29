/**
 * Scanner service tests — HID keyboard-wedge detection, dedup, symbology.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifySymbology,
  emitScannerReading,
  setScannerOptions,
  subscribeScanner,
} from '../scanner-service';

describe('classifySymbology', () => {
  it('detects EAN-13 (13 digits)', () => {
    expect(classifySymbology('1234567890128')).toBe('EAN_13');
  });

  it('detects EAN-8 (8 digits)', () => {
    expect(classifySymbology('12345678')).toBe('EAN_8');
  });

  it('detects UPC-A (12 digits)', () => {
    expect(classifySymbology('123456789012')).toBe('UPC_A');
  });

  it('falls back to CODE_128 for ASCII mix', () => {
    expect(classifySymbology('ABC-XYZ-001!')).toBe('CODE_128');
  });

  it('falls back to UNKNOWN for non-ASCII', () => {
    expect(classifySymbology('سلام')).toBe('UNKNOWN');
  });
});

describe('subscribeScanner — HID keyboard wedge', () => {
  beforeEach(() => {
    setScannerOptions({
      minLength: 6,
      maxInterKeyMs: 60,
      duplicateSuppressionMs: 500,
      respectFocus: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function press(key: string) {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
  }

  it('captures a rapid burst ending in Enter', async () => {
    const received: any[] = [];
    const unsub = subscribeScanner((r) => received.push(r));
    for (const c of '1234567890123') press(c);
    press('Enter');
    expect(received.length).toBe(1);
    expect(received[0].value).toBe('1234567890123');
    expect(received[0].source).toBe('hid');
    expect(received[0].symbology).toBe('EAN_13');
    unsub();
  });

  it('ignores buffers shorter than minLength', () => {
    const received: any[] = [];
    const unsub = subscribeScanner((r) => received.push(r));
    press('1');
    press('2');
    press('3');
    press('Enter');
    expect(received.length).toBe(0);
    unsub();
  });

  it('suppresses duplicates inside the window', async () => {
    const received: any[] = [];
    const unsub = subscribeScanner((r) => received.push(r));
    for (const c of 'ABCDEF') press(c);
    press('Enter');
    for (const c of 'ABCDEF') press(c);
    press('Enter');
    expect(received.length).toBe(1);
    unsub();
  });

  it('emitScannerReading lets camera path push readings', () => {
    const received: any[] = [];
    const unsub = subscribeScanner((r) => received.push(r));
    emitScannerReading({
      value: 'CAMERA-001',
      source: 'camera',
      symbology: 'CODE_128',
      timestamp: Date.now(),
    });
    expect(received.length).toBe(1);
    expect(received[0].source).toBe('camera');
    unsub();
  });
});
