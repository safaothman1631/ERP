/**
 * LoadingSkeleton — unit tests
 *
 * Verifies that each variant renders the correct structure and that
 * the isDark prop injects the expected CSS variable overrides.
 *
 * Requirements: 11.1, 11.5, 11.6
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSkeleton } from './LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renders with role="status" and aria-busy="true"', () => {
    render(<LoadingSkeleton variant="row" />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('row variant renders multiple skeleton bars', () => {
    const { container } = render(<LoadingSkeleton variant="row" rows={3} />);
    const bars = container.querySelectorAll('.skeleton');
    // Each row has 4 bars (icon + 2 text + trailing value)
    expect(bars.length).toBeGreaterThanOrEqual(3 * 3);
  });

  it('card variant renders skeleton bars', () => {
    const { container } = render(<LoadingSkeleton variant="card" />);
    const bars = container.querySelectorAll('.skeleton');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('chart variant renders skeleton bars including chart body', () => {
    const { container } = render(<LoadingSkeleton variant="chart" />);
    const bars = container.querySelectorAll('.skeleton');
    // title + chart body + 6 x-axis labels = at least 8
    expect(bars.length).toBeGreaterThanOrEqual(8);
  });

  it('table variant renders header + body rows', () => {
    const { container } = render(<LoadingSkeleton variant="table" rows={5} />);
    const bars = container.querySelectorAll('.skeleton');
    // header (1 checkbox + 6 cols) + 5 body rows (1 checkbox + 6 cols each) = 7 + 35 = 42
    expect(bars.length).toBeGreaterThanOrEqual(42);
  });

  it('isDark prop injects dark CSS variable overrides', () => {
    const { container } = render(<LoadingSkeleton variant="card" isDark />);
    const wrapper = container.firstChild as HTMLElement;
    // The wrapper should have inline style with --skeleton-base
    const style = wrapper.getAttribute('style') ?? '';
    expect(style).toContain('--skeleton-base');
    expect(style).toContain('--skeleton-highlight');
  });

  it('without isDark prop, no inline CSS variable overrides are injected', () => {
    const { container } = render(<LoadingSkeleton variant="card" isDark={false} />);
    const wrapper = container.firstChild as HTMLElement;
    const style = wrapper.getAttribute('style') ?? '';
    expect(style).not.toContain('--skeleton-base');
  });

  it('defaults to 5 rows when rows prop is omitted', () => {
    const { container } = render(<LoadingSkeleton variant="table" />);
    // 5 body rows + 1 header = 6 row containers
    const rows = container.querySelectorAll('[style*="border-bottom"]');
    expect(rows.length).toBe(6); // 1 header + 5 body
  });
});
