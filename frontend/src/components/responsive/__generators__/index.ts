/**
 * Shared `fast-check` arbitraries for Responsive component property tests.
 *
 * Used by `frontend/src/system-wide-ux-overhaul.pbt.test.ts`:
 * - Property 7 — Touch target sizing and spacing
 * - Property 8 — Dialog focus discipline
 *
 * The generators describe the input space for:
 * - Touch target sizing/spacing scenarios (Property 7)
 * - Dialog focus-management scenarios (Property 8)
 *
 * Documented in `.kiro/specs/system-wide-ux-overhaul/design.md`
 * → "Correctness Properties" → Properties 7, 8.
 */

import * as fc from 'fast-check';

/**
 * Describes a focusable element to be rendered inside a dialog body.
 * Each element has a unique `id` and a `type` that determines the
 * HTML element rendered.
 */
export interface FocusableElementDef {
  id: string;
  type: 'button' | 'input' | 'select' | 'textarea' | 'anchor';
}

/**
 * Describes a Dialog scenario for focus-discipline testing.
 *
 * - `focusableElements`: the set of interactive elements inside the dialog.
 * - `triggerIndex`: which element in the page acts as the trigger (for
 *   focus-return assertions).
 * - `isMobile`: whether the dialog renders as a bottom-sheet (mobile) or
 *   centered modal (desktop).
 */
export interface DialogFocusScenario {
  /** At least 1 focusable element inside the dialog body. */
  focusableElements: FocusableElementDef[];
  /** Whether to simulate mobile viewport (bottom-sheet) or desktop (modal). */
  isMobile: boolean;
}

/**
 * Arbitrary for a single focusable element definition.
 */
export const focusableElementArb: fc.Arbitrary<FocusableElementDef> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }).map((s) => `el-${s.replace(/[^a-z0-9]/gi, 'x')}`),
  type: fc.constantFrom<FocusableElementDef['type']>(
    'button',
    'input',
    'select',
    'textarea',
    'anchor',
  ),
});

/**
 * Arbitrary for a Dialog focus scenario.
 *
 * Generates between 1 and 5 focusable elements inside the dialog body
 * (more than 5 is behaviourally identical for focus-trap cycling) and
 * a boolean for mobile vs desktop rendering.
 */
export const dialogFocusScenarioArb: fc.Arbitrary<DialogFocusScenario> = fc.record({
  focusableElements: fc.array(focusableElementArb, { minLength: 1, maxLength: 5 }).map(
    (elements) => {
      // Ensure unique IDs by appending index
      return elements.map((el, i) => ({ ...el, id: `${el.id}-${i}` }));
    },
  ),
  isMobile: fc.boolean(),
});


// ─────────────────────────────────────────────────────────────────────────────
// Property 7: Touch target sizing and spacing generators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The type of interactive element that can be a Touch_Target.
 * Mirrors the selector list in `clickable.css` and `responsiveForm.css`.
 */
export type TouchTargetElementType =
  | 'button'
  | 'input'
  | 'select'
  | 'a'
  | 'checkbox-wrapper'
  | 'radio-wrapper'
  | 'switch';

/**
 * Describes a single touch target element to be rendered in a test scenario.
 */
export interface TouchTargetDef {
  /** Unique identifier for the element. */
  id: string;
  /** The HTML/component element type. */
  type: TouchTargetElementType;
  /**
   * Whether the element uses the `.touchTarget` CSS class directly
   * (as opposed to relying on the descendant rules in `responsiveForm.css`).
   */
  usesClass: boolean;
  /**
   * Optional explicit inline min-block-size override (simulates components
   * that set inline styles like ResponsiveDialog buttons).
   */
  inlineMinBlockSize?: number;
  /**
   * Optional explicit inline min-inline-size override.
   */
  inlineMinInlineSize?: number;
}

/**
 * Describes a group of adjacent touch targets rendered together.
 * Used to test the spacing contract between siblings.
 */
export interface TouchTargetGroupScenario {
  /** The viewport width — always ≤ 640 px for mobile testing. */
  viewportWidth: number;
  /** The touch target elements in the group (rendered as siblings). */
  elements: TouchTargetDef[];
}

/**
 * Arbitrary for the type of touch target element.
 */
export const touchTargetTypeArb: fc.Arbitrary<TouchTargetElementType> =
  fc.constantFrom<TouchTargetElementType>(
    'button',
    'input',
    'select',
    'a',
    'checkbox-wrapper',
    'radio-wrapper',
    'switch',
  );

/**
 * Arbitrary for a single touch target definition.
 */
export const touchTargetDefArb: fc.Arbitrary<TouchTargetDef> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 6 }).map(
    (s) => `tt-${s.replace(/[^a-z0-9]/gi, 'x')}`,
  ),
  type: touchTargetTypeArb,
  usesClass: fc.boolean(),
  inlineMinBlockSize: fc.option(fc.constant(44), { nil: undefined, freq: 2 }),
  inlineMinInlineSize: fc.option(fc.constant(44), { nil: undefined, freq: 2 }),
});

/**
 * Mobile viewport width arbitrary — values from 320 to 640 px inclusive.
 * This is the range where touch target rules MUST apply (R5.1).
 */
export const mobileViewportWidthArb: fc.Arbitrary<number> = fc.integer({
  min: 320,
  max: 640,
});

/**
 * Arbitrary for a touch target group scenario.
 *
 * Generates 1–6 adjacent touch targets at a mobile viewport width.
 * More than 6 is behaviourally identical for spacing assertions.
 */
export const touchTargetGroupArb: fc.Arbitrary<TouchTargetGroupScenario> =
  fc.record({
    viewportWidth: mobileViewportWidthArb,
    elements: fc
      .array(touchTargetDefArb, { minLength: 1, maxLength: 6 })
      .map((elements) =>
        elements.map((el, i) => ({ ...el, id: `${el.id}-${i}` })),
      ),
  });
