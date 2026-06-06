/**
 * ResponsiveChart.test.tsx — unit tests for the legend-reflow chart wrapper.
 *
 * Spec: system-wide-ux-overhaul, Task 4.9
 * Validates: Requirements 4.6, 4.7
 *
 * Tests cover:
 *   - Legend reflow when measured intrinsic legend inline-size > container
 *   - Min block size 240 px on mobile
 *   - 100% inline width
 *   - Legend wrapping behavior
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

import { ResponsiveChart, type ResponsiveChartLegendItem } from './ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';

// ---------------------------------------------------------------------------
// Mock react-i18next — returns the key as the value
// ---------------------------------------------------------------------------
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// ---------------------------------------------------------------------------
// Mock useViewport — controlled by test helpers
// ---------------------------------------------------------------------------
let mockIsMobile = false;
let mockIsTablet = false;
let mockIsDesktop = true;

vi.mock('../../hooks/useViewport', () => ({
  useViewport: () => ({
    viewport: mockIsMobile ? 'mobile' : mockIsDesktop ? 'desktop' : 'tablet',
    isMobile: mockIsMobile,
    isTablet: mockIsTablet,
    isDesktop: mockIsDesktop,
  }),
}));

// ---------------------------------------------------------------------------
// Mock recharts ResponsiveContainer — renders children directly
// ---------------------------------------------------------------------------
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-responsive-container">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// matchMedia mock
// ---------------------------------------------------------------------------
function installMatchMediaMock(): void {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// ResizeObserver mock with controllable callbacks
// ---------------------------------------------------------------------------
type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

let resizeObserverCallback: ResizeObserverCallback | null = null;
let observedElements: Element[] = [];

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
    observedElements = [];
  }
  observe(el: Element) {
    observedElements.push(el);
  }
  unobserve() {}
  disconnect() {
    observedElements = [];
  }
}

beforeEach(() => {
  installMatchMediaMock();
  mockIsMobile = false;
  mockIsTablet = false;
  mockIsDesktop = true;
  resizeObserverCallback = null;
  observedElements = [];
  // Install the mock ResizeObserver
  (window as any).ResizeObserver = MockResizeObserver;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setMobile(): void {
  mockIsMobile = true;
  mockIsTablet = false;
  mockIsDesktop = false;
}

function setDesktop(): void {
  mockIsMobile = false;
  mockIsTablet = false;
  mockIsDesktop = true;
}

const sampleLegendItems: ResponsiveChartLegendItem[] = [
  { id: 'revenue', labelKey: asTranslationKey('legend.revenue'), color: '#4285F4' },
  { id: 'expenses', labelKey: asTranslationKey('legend.expenses'), color: '#EA4335' },
  { id: 'profit', labelKey: asTranslationKey('legend.profit'), color: '#34A853' },
];

/**
 * Simulate a resize by mocking getBoundingClientRect on the container and
 * ghost elements, then triggering the ResizeObserver callback.
 */
function simulateResize(containerWidth: number, ghostWidth: number): void {
  if (!resizeObserverCallback) return;

  // Mock getBoundingClientRect on observed elements
  // First observed element is the container, second is the ghost
  if (observedElements.length >= 2) {
    vi.spyOn(observedElements[0], 'getBoundingClientRect').mockReturnValue({
      width: containerWidth,
      height: 300,
      top: 0,
      left: 0, /* rtl-ignore */
      bottom: 300,
      right: containerWidth, /* rtl-ignore */
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(observedElements[1], 'getBoundingClientRect').mockReturnValue({
      width: ghostWidth,
      height: 20,
      top: 0,
      left: 0, /* rtl-ignore */
      bottom: 20,
      right: ghostWidth, /* rtl-ignore */
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  }

  act(() => {
    resizeObserverCallback!([] as any);
  });
}

// ---------------------------------------------------------------------------
// Tests — Mobile viewport
// ---------------------------------------------------------------------------

describe('ResponsiveChart — Mobile viewport', () => {
  beforeEach(() => {
    setMobile();
  });

  /** Validates: R4.6 — minimum visible block size 240 px on Mobile_Viewport. */
  it('applies min-block-size of 240px on mobile by default', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    const surface = wrapper.querySelector('.responsive-chart__surface') as HTMLElement;
    expect(surface).not.toBeNull();
    // On mobile, blockSize and minBlockSize should be set to 240
    expect(surface.style.blockSize).toBe('240px');
    expect(surface.style.minBlockSize).toBe('240px');
  });

  /** Validates: R4.6 — configurable min block size. */
  it('respects custom minMobileBlockSize prop', () => {
    render(
      <ResponsiveChart
        legendItems={sampleLegendItems}
        minMobileBlockSize={300}
        testId="chart"
      >
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    const surface = wrapper.querySelector('.responsive-chart__surface') as HTMLElement;
    expect(surface.style.blockSize).toBe('300px');
    expect(surface.style.minBlockSize).toBe('300px');
  });

  /** Validates: R4.6 — 100% inline width. */
  it('wrapper has 100% inline width via CSS class', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    expect(wrapper.className).toContain('responsive-chart');
  });
});

// ---------------------------------------------------------------------------
// Tests — Desktop viewport
// ---------------------------------------------------------------------------

describe('ResponsiveChart — Desktop viewport', () => {
  beforeEach(() => {
    setDesktop();
  });

  /** Validates: R4.6 — uses aspect ratio on desktop. */
  it('applies aspect-ratio on desktop instead of fixed block-size', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    const surface = wrapper.querySelector('.responsive-chart__surface') as HTMLElement;
    // On desktop, aspect-ratio should be set (default 16/9)
    expect(surface.style.aspectRatio).not.toBe('');
    // minBlockSize should still be set as a floor
    expect(surface.style.minBlockSize).toBe('240px');
  });

  it('respects custom aspect ratio prop', () => {
    render(
      <ResponsiveChart
        legendItems={sampleLegendItems}
        aspect={4 / 3}
        testId="chart"
      >
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    const surface = wrapper.querySelector('.responsive-chart__surface') as HTMLElement;
    expect(surface.style.aspectRatio).toContain(String(4 / 3));
  });
});

// ---------------------------------------------------------------------------
// Tests — Legend rendering
// ---------------------------------------------------------------------------

describe('ResponsiveChart — Legend', () => {
  /** Validates: R4.7 — legend renders below the chart. */
  it('renders legend items below the chart surface', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    const surface = wrapper.querySelector('.responsive-chart__surface');
    const legend = wrapper.querySelector('.responsive-chart__legend');

    expect(surface).not.toBeNull();
    expect(legend).not.toBeNull();

    // Legend should come after the surface in DOM order
    const children = Array.from(wrapper.children);
    const surfaceIndex = children.indexOf(surface!);
    const legendIndex = children.indexOf(legend!);
    expect(legendIndex).toBeGreaterThan(surfaceIndex);
  });

  it('renders all legend items with translated labels', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    const legendItems = wrapper.querySelectorAll('.responsive-chart__legend-item-wrapper');
    expect(legendItems.length).toBe(3);
  });

  it('renders legend swatches with the correct colors', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    // The visible legend is a <ul> with role="list"; the ghost is a div with aria-hidden
    const visibleLegend = wrapper.querySelector('ul.responsive-chart__legend');
    expect(visibleLegend).not.toBeNull();

    const swatches = visibleLegend!.querySelectorAll('.responsive-chart__legend-swatch');
    expect(swatches.length).toBe(3);
    expect((swatches[0] as HTMLElement).style.background).toBe('rgb(66, 133, 244)');
  });

  it('does not render legend when legendItems is empty', () => {
    render(
      <ResponsiveChart legendItems={[]} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    const legend = wrapper.querySelector('.responsive-chart__legend');
    expect(legend).toBeNull();
  });

  /** Validates: R4.7 — ghost legend exists for intrinsic measurement. */
  it('renders a hidden ghost legend for intrinsic-width measurement', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    const ghost = wrapper.querySelector('.responsive-chart__legend-ghost');
    expect(ghost).not.toBeNull();
    expect(ghost!.getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Tests — Legend reflow (R4.7)
// ---------------------------------------------------------------------------

describe('ResponsiveChart — Legend reflow', () => {
  /** Validates: R4.7 — legend wraps when intrinsic width > container width. */
  it('applies wrap class when legend intrinsic width exceeds container', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');

    // Simulate: container is 300px wide, ghost legend is 500px wide
    simulateResize(300, 500);

    const legend = wrapper.querySelector('.responsive-chart__legend');
    expect(legend).not.toBeNull();
    expect(legend!.className).toContain('responsive-chart__legend--wrap');
  });

  /** Validates: R4.7 — legend stays nowrap when it fits. */
  it('applies nowrap class when legend fits within container', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');

    // Simulate: container is 600px wide, ghost legend is 300px wide
    simulateResize(600, 300);

    const legend = wrapper.querySelector('.responsive-chart__legend');
    expect(legend).not.toBeNull();
    expect(legend!.className).toContain('responsive-chart__legend--nowrap');
  });

  /** Validates: R4.7 — equal sizes stay on single row (strict >). */
  it('stays nowrap when legend width equals container width', () => {
    render(
      <ResponsiveChart legendItems={sampleLegendItems} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');

    // Simulate: container and ghost are the same width
    simulateResize(400, 400);

    const legend = wrapper.querySelector('.responsive-chart__legend');
    expect(legend!.className).toContain('responsive-chart__legend--nowrap');
  });
});

// ---------------------------------------------------------------------------
// Tests — General
// ---------------------------------------------------------------------------

describe('ResponsiveChart — General', () => {
  it('wraps children in a recharts ResponsiveContainer', () => {
    render(
      <ResponsiveChart legendItems={[]} testId="chart">
        <div data-testid="chart-child" />
      </ResponsiveChart>,
    );

    expect(screen.getByTestId('recharts-responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('chart-child')).toBeInTheDocument();
  });

  it('composes a consumer-supplied className', () => {
    render(
      <ResponsiveChart
        legendItems={[]}
        className="my-chart"
        testId="chart"
      >
        <div />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    expect(wrapper.className).toContain('responsive-chart');
    expect(wrapper.className).toContain('my-chart');
  });

  it('forwards inline style to the wrapper', () => {
    render(
      <ResponsiveChart
        legendItems={[]}
        style={{ marginBlockStart: '16px' }}
        testId="chart"
      >
        <div />
      </ResponsiveChart>,
    );

    const wrapper = screen.getByTestId('chart');
    expect(wrapper.style.marginBlockStart).toBe('16px');
  });
});
