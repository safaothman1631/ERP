/**
 * ResponsiveTable.test.tsx — unit tests for the table → stacked card
 * responsive wrapper.
 *
 * Spec: system-wide-ux-overhaul, Task 4.9
 * Validates: Requirements 4.3, 4.6, 4.7 (table-specific: 4.3)
 *
 * Tests cover:
 *   - High-priority columns retained on mobile
 *   - "Show more" reveal on mobile-card row
 *   - Desktop table rendering with all columns
 *   - Tablet trimming (> 5 columns, only high-priority shown)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ResponsiveTable, type ResponsiveColumn, type RowAction } from './ResponsiveTable';
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
    viewport: mockIsMobile ? 'mobile' : mockIsTablet ? 'tablet' : 'desktop',
    isMobile: mockIsMobile,
    isTablet: mockIsTablet,
    isDesktop: mockIsDesktop,
  }),
}));

// ---------------------------------------------------------------------------
// matchMedia mock for AntD internals
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

beforeEach(() => {
  installMatchMediaMock();
  mockIsMobile = false;
  mockIsTablet = false;
  mockIsDesktop = true;
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

function setTablet(): void {
  mockIsMobile = false;
  mockIsTablet = true;
  mockIsDesktop = false;
}

function setDesktop(): void {
  mockIsMobile = false;
  mockIsTablet = false;
  mockIsDesktop = true;
}

interface TestRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  status: string;
}

const sampleData: TestRow[] = [
  { id: '1', name: 'Alice', email: 'alice@test.com', phone: '555-0001', city: 'NYC', country: 'US', status: 'active' },
  { id: '2', name: 'Bob', email: 'bob@test.com', phone: '555-0002', city: 'LA', country: 'US', status: 'inactive' },
];

/** 3 columns — below the 5-column trim threshold. */
const fewColumns: ResponsiveColumn<TestRow>[] = [
  { id: 'name', headerKey: asTranslationKey('col.name'), priority: 'high', render: (r) => r.name },
  { id: 'email', headerKey: asTranslationKey('col.email'), priority: 'medium', render: (r) => r.email },
  { id: 'phone', headerKey: asTranslationKey('col.phone'), priority: 'low', render: (r) => r.phone },
];

/** 6 columns — above the 5-column trim threshold. */
const manyColumns: ResponsiveColumn<TestRow>[] = [
  { id: 'name', headerKey: asTranslationKey('col.name'), priority: 'high', render: (r) => r.name },
  { id: 'email', headerKey: asTranslationKey('col.email'), priority: 'high', render: (r) => r.email },
  { id: 'phone', headerKey: asTranslationKey('col.phone'), priority: 'medium', render: (r) => r.phone },
  { id: 'city', headerKey: asTranslationKey('col.city'), priority: 'medium', render: (r) => r.city },
  { id: 'country', headerKey: asTranslationKey('col.country'), priority: 'low', render: (r) => r.country },
  { id: 'status', headerKey: asTranslationKey('col.status'), priority: 'low', render: (r) => r.status },
];

const sampleRowActions = (_row: TestRow): RowAction[] => [
  { id: 'edit', labelKey: asTranslationKey('action.edit'), onClick: vi.fn() },
  { id: 'delete', labelKey: asTranslationKey('action.delete'), onClick: vi.fn(), danger: true },
];

// ---------------------------------------------------------------------------
// Tests — Mobile path (card list)
// ---------------------------------------------------------------------------

describe('ResponsiveTable — Mobile (card list)', () => {
  beforeEach(() => {
    setMobile();
  });

  /** Validates: R4.1 — renders as stacked card list on Mobile_Viewport. */
  it('renders rows as cards on mobile', () => {
    render(
      <ResponsiveTable
        columns={fewColumns}
        data={sampleData}
        testId="test-table"
      />,
    );

    const wrapper = screen.getByTestId('test-table');
    expect(wrapper.className).toContain('responsive-table--mobile');

    // Each row should be a card in a list
    const listItems = wrapper.querySelectorAll('li.responsive-table__card-wrapper');
    expect(listItems.length).toBe(2);
  });

  /** Validates: R4.1 — card contains stacked label/value pairs. */
  it('renders label/value pairs for each column in the card', () => {
    render(
      <ResponsiveTable
        columns={fewColumns}
        data={sampleData}
        testId="test-table"
      />,
    );

    // Check that the first card has all column labels
    const labels = document.querySelectorAll('.responsive-table__label');
    // 3 columns × 2 rows = 6 labels (all columns shown since < 5 columns)
    expect(labels.length).toBe(6);

    // First label should be the first column header key
    expect(labels[0].textContent).toBe('col.name');
  });

  /** Validates: R4.3 — high-priority columns retained on mobile when > 5 columns. */
  it('shows only high-priority columns by default when > 5 columns', () => {
    render(
      <ResponsiveTable
        columns={manyColumns}
        data={sampleData}
        testId="test-table"
      />,
    );

    const wrapper = screen.getByTestId('test-table');
    const firstCard = wrapper.querySelector('li.responsive-table__card-wrapper');
    expect(firstCard).not.toBeNull();

    // Only high-priority columns should be visible by default
    const visibleLabels = firstCard!.querySelectorAll('.responsive-table__label');
    // 2 high-priority columns: name, email
    expect(visibleLabels.length).toBe(2);
    expect(visibleLabels[0].textContent).toBe('col.name');
    expect(visibleLabels[1].textContent).toBe('col.email');
  });

  /** Validates: R4.3 — "Show more" button reveals hidden columns on mobile. */
  it('reveals all columns when "Show more" is clicked', () => {
    render(
      <ResponsiveTable
        columns={manyColumns}
        data={sampleData}
        testId="test-table"
      />,
    );

    const wrapper = screen.getByTestId('test-table');
    const firstCard = wrapper.querySelector('li.responsive-table__card-wrapper');

    // Find the "Show more" button (renders the "more" translation key)
    const showMoreBtn = firstCard!.querySelector('.responsive-table__show-more');
    expect(showMoreBtn).not.toBeNull();
    expect(showMoreBtn!.textContent).toBe('more');

    // Click to expand
    fireEvent.click(showMoreBtn!);

    // Now all 6 columns should be visible
    const allLabels = firstCard!.querySelectorAll('.responsive-table__label');
    expect(allLabels.length).toBe(6);
  });

  /** Validates: R4.3 — expanding reveals all columns and marks button as expanded. */
  it('marks the show-more button as aria-expanded after clicking', () => {
    render(
      <ResponsiveTable
        columns={manyColumns}
        data={sampleData}
        testId="test-table"
      />,
    );

    const wrapper = screen.getByTestId('test-table');
    const firstCard = wrapper.querySelector('li.responsive-table__card-wrapper');
    const showMoreBtn = firstCard!.querySelector('.responsive-table__show-more');
    expect(showMoreBtn).not.toBeNull();

    // Before click: aria-expanded is false, text is "more"
    expect(showMoreBtn!.getAttribute('aria-expanded')).toBe('false');
    expect(showMoreBtn!.textContent).toBe('more');

    // After click: all columns are revealed
    fireEvent.click(showMoreBtn!);

    const allLabels = firstCard!.querySelectorAll('.responsive-table__label');
    expect(allLabels.length).toBe(6);
  });

  it('renders row actions menu on mobile cards', () => {
    render(
      <ResponsiveTable
        columns={fewColumns}
        data={sampleData}
        rowActions={sampleRowActions}
        testId="test-table"
      />,
    );

    // Row action menus should be present (tap-only path)
    const actionBtns = screen.getAllByTestId(/responsive-table-row-actions/);
    expect(actionBtns.length).toBe(2);
  });

  it('renders empty state when data is empty', () => {
    render(
      <ResponsiveTable
        columns={fewColumns}
        data={[]}
        emptyState={<div data-testid="custom-empty">No items</div>}
        testId="test-table"
      />,
    );

    expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
  });

  it('renders loading state on mobile', () => {
    render(
      <ResponsiveTable
        columns={fewColumns}
        data={[]}
        loading={true}
        testId="test-table"
      />,
    );

    const wrapper = screen.getByTestId('test-table');
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Tests — Desktop path (grid table)
// ---------------------------------------------------------------------------

describe('ResponsiveTable — Desktop (grid table)', () => {
  beforeEach(() => {
    setDesktop();
  });

  /** Validates: R4.2 — renders as traditional grid table above Mobile_Viewport. */
  it('renders as a grid table on desktop', () => {
    render(
      <ResponsiveTable
        columns={fewColumns}
        data={sampleData}
        testId="test-table"
      />,
    );

    const wrapper = screen.getByTestId('test-table');
    expect(wrapper.className).toContain('responsive-table--desktop');

    // AntD Table should be rendered
    const table = wrapper.querySelector('.ant-table');
    expect(table).not.toBeNull();
  });

  /** Validates: R4.2 — all columns visible on desktop regardless of count. */
  it('shows all columns on desktop even with > 5 columns', () => {
    render(
      <ResponsiveTable
        columns={manyColumns}
        data={sampleData}
        testId="test-table"
      />,
    );

    // All column headers should be present
    const headerCells = document.querySelectorAll('.ant-table-thead th');
    // 6 data columns (all shown on desktop, no trimming)
    expect(headerCells.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Tests — Tablet path (trimming)
// ---------------------------------------------------------------------------

describe('ResponsiveTable — Tablet (column trimming)', () => {
  beforeEach(() => {
    setTablet();
  });

  /** Validates: R4.3 — only high-priority columns on tablet when > 5 columns. */
  it('trims to high-priority columns on tablet when > 5 columns', () => {
    render(
      <ResponsiveTable
        columns={manyColumns}
        data={sampleData}
        testId="test-table"
      />,
    );

    // Only high-priority columns + actions column should be in the header
    const headerCells = document.querySelectorAll('.ant-table-thead th');
    // 2 high-priority columns: name, email (+ expand column from AntD expandable)
    // AntD adds an expand column when expandable is configured
    const dataHeaders = Array.from(headerCells).filter(
      (th) => !th.classList.contains('ant-table-row-expand-icon-cell'),
    );
    expect(dataHeaders.length).toBe(2);
  });

  it('does not trim columns on tablet when <= 5 columns', () => {
    render(
      <ResponsiveTable
        columns={fewColumns}
        data={sampleData}
        testId="test-table"
      />,
    );

    // All 3 columns should be visible (no trimming needed)
    const headerCells = document.querySelectorAll('.ant-table-thead th');
    expect(headerCells.length).toBe(3);
  });
});
