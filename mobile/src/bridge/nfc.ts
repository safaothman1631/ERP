/**
 * NFC reader bridge — interface only (implementation in Sprint+1).
 *
 * Spec: design.md §7 (bridges).
 *
 * Use-cases we plan to support:
 *   1. Iraqi national-ID NFC (eID) read on the cashier side — speeds up
 *      KYC for VIP loyalty enrolment.
 *   2. NDEF business-card scan into a contact draft.
 *   3. Vending / locker integration (write a single-use token).
 *
 * No Capacitor plugin in the official mono-repo is production-grade for
 * both Android (HCE + reader) and iOS (Core NFC, restricted to NDEF
 * read on iOS 13+, full read/write only on iOS 14.5+).
 *
 * Until we ship Sprint+1, this file exports the interface so the rest
 * of the codebase can compile against a stable shape. Callers should
 * `await isAvailable()` and gracefully fall back when it returns false.
 */

import { Capacitor } from '@capacitor/core';

export type NfcMessageRecord =
  | { type: 'text'; lang?: string; value: string }
  | { type: 'uri'; uri: string }
  | { type: 'mime'; mimeType: string; payload: Uint8Array };

export interface NfcMessage {
  records: NfcMessageRecord[];
  /** Tag identifier (UID) — opaque, used for de-duplication. */
  tagId?: string;
}

export interface NfcBridge {
  /** True on devices where the platform plugin is installed and NFC is enabled. */
  isAvailable(): Promise<boolean>;

  /** Returns once a tag is read; rejects on cancel or timeout. */
  readOnce(timeoutMs?: number): Promise<NfcMessage>;

  /**
   * Subscribe to a stream of tag reads. Returns an unsubscriber.
   * Useful for desk-mounted readers.
   */
  watch(callback: (msg: NfcMessage) => void): Promise<() => void>;

  /** Write an NDEF message to the next tag tapped. */
  write(message: NfcMessage, timeoutMs?: number): Promise<void>;
}

class NotImplementedYet extends Error {
  constructor(method: string) {
    super(`nfc.${method}() — Sprint+1; track in tasks.md / TODO-NFC.`);
    this.name = 'NotImplementedYet';
  }
}

/**
 * Stub. Every method throws `NotImplementedYet`, **except** `isAvailable`
 * which honestly returns `false` so callers can degrade gracefully
 * without ever invoking the throwing methods.
 */
export const nativeNfc: NfcBridge = {
  async isAvailable() {
    if (!Capacitor.isNativePlatform()) return false;
    // Even on native, the plugin is not installed yet.
    return false;
  },

  async readOnce(_timeoutMs: number = 30000): Promise<NfcMessage> {
    throw new NotImplementedYet('readOnce');
  },

  async watch(_callback: (msg: NfcMessage) => void): Promise<() => void> {
    throw new NotImplementedYet('watch');
  },

  async write(_message: NfcMessage, _timeoutMs: number = 30000): Promise<void> {
    throw new NotImplementedYet('write');
  },
};

export default nativeNfc;
