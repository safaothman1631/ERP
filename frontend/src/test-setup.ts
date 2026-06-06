import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Polyfill ResizeObserver for jsdom (used by Ant Design components)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Install jsdom polyfills before every test so a prior test that resets
// globals (vi.unstubAllGlobals / restoreAllMocks / window mutation) cannot
// leave a later test without them.
function installJsdomPolyfills(): void {
  // matchMedia — jsdom does not implement it; responsive hooks/components use it.
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  // CSS.supports — jsdom defines `CSS` as an object but not `.supports`.
  // Components that feature-detect (glassmorphism `backdrop-filter` in
  // theme/glassStyles.ts) call it at render time and would otherwise throw
  // "CSS.supports is not a function". Report no support so the solid-background
  // fallback path is exercised (jsdom cannot render backdrop-filter anyway).
  const cssGlobal = (globalThis as { CSS?: { supports?: unknown } }).CSS;
  if (typeof cssGlobal === 'undefined') {
    (globalThis as { CSS?: unknown }).CSS = { supports: () => false };
  } else if (typeof cssGlobal.supports !== 'function') {
    cssGlobal.supports = () => false;
  }
}

installJsdomPolyfills();
beforeEach(() => {
  installJsdomPolyfills();
});
