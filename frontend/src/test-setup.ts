import '@testing-library/jest-dom';

// Polyfill ResizeObserver for jsdom (used by Ant Design components)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
