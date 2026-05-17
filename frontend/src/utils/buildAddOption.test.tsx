/**
 * buildAddOption.test.tsx
 *
 * Property-based tests for `buildEffectiveOptions` and `buildAddOption`.
 *
 * Runner: Node built-in test runner (`node --test`)
 *         (Node 24 strips TypeScript natively; tsx handles .tsx extension)
 *
 * Feature: nav-settings-cleanup
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import React from 'react';
import { buildAddOption, buildEffectiveOptions, ADD_OPTION_VALUE } from './buildAddOption.js';

// ---------------------------------------------------------------------------
// Helper: extract plain text from the label React element.
//
// `buildAddOption` returns:
//   label: <span className="add-option-label" style={{ opacity: 0.65 }}>
//             {labelText}
//           </span>
//
// We read `props.children` directly — no DOM rendering required.
// ---------------------------------------------------------------------------
function extractLabelText(label: React.ReactNode): string {
  if (typeof label === 'string') return label;
  if (React.isValidElement(label)) {
    const el = label as React.ReactElement<{ children?: React.ReactNode }>;
    return extractLabelText(el.props.children);
  }
  return String(label ?? '');
}

// ---------------------------------------------------------------------------
// Property 4: Empty Select always renders exactly one Add_Option
// Feature: nav-settings-cleanup, Property 4: Empty Select always renders exactly one Add_Option
// Validates: Requirements 5.1, 5.5
// ---------------------------------------------------------------------------
describe('Property 4: Empty Select always renders exactly one Add_Option', () => {
  test('buildEffectiveOptions([], entityName, route, navigate) returns exactly one item with value === "__add__"', () => {
    fc.assert(
      fc.property(
        fc.constant([]),              // always empty options array
        fc.string({ minLength: 1 }), // entity name
        fc.string({ minLength: 1 }), // route
        (_emptyOptions, entityName, route) => {
          const result = buildEffectiveOptions([], entityName, route, () => {});
          assert.strictEqual(result.length, 1, `expected 1 option, got ${result.length}`);
          assert.strictEqual(
            result[0].value,
            ADD_OPTION_VALUE,
            `expected value '__add__', got '${String(result[0].value)}'`,
          );
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Add_Option label matches required pattern
// Feature: nav-settings-cleanup, Property 5: Add_Option label matches required pattern
// Validates: Requirements 5.2
// ---------------------------------------------------------------------------
describe('Property 5: Add_Option label matches required pattern', () => {
  test('English label matches "＋ Add ${entityName}" for any entity name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (entityName) => {
          const option = buildAddOption(entityName, '/test', () => {}, 'en');
          const labelText = extractLabelText(option.label);
          return labelText === `＋ Add ${entityName}`;
        },
      ),
      { numRuns: 100 },
    );
  });

  test('Kurdish label matches "＋ زیادکردنی ${entityName}" for any entity name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (entityName) => {
          const option = buildAddOption(entityName, '/test', () => {}, 'ku');
          const labelText = extractLabelText(option.label);
          return labelText === `＋ زیادکردنی ${entityName}`;
        },
      ),
      { numRuns: 100 },
    );
  });

  test('Default (no lang) label matches English pattern', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (entityName) => {
          const option = buildAddOption(entityName, '/test', () => {});
          const labelText = extractLabelText(option.label);
          return labelText === `＋ Add ${entityName}`;
        },
      ),
      { numRuns: 100 },
    );
  });
});
