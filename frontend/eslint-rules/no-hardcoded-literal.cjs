/**
 * ESLint custom rule: no-hardcoded-literal
 *
 * Flags user-facing string literals in JSX that should be resolved through
 * `t()` (i18next) or the Help_Registry instead of being inlined.
 *
 * Scope of detection:
 *   1. JSXText             — visible text content between JSX tags.
 *   2. JSXAttribute        — string literals on the attributes:
 *        `title`, `aria-label`, `placeholder`, `alt`
 *      (these surface to assistive technologies / browser tooltips and are
 *      always user-facing).
 *   3. JSXAttribute        — string literals on the component props:
 *        `label`, `tooltip`, `description`, `message`, `text`
 *      ONLY when the parent JSX element is a Component (uppercase identifier
 *      or a member expression like `Form.Item`). These are the standard
 *      AntD / shadcn props that surface user-facing copy.
 *
 * Allowlist (NOT flagged):
 *   - Empty / whitespace-only strings.
 *   - Punctuation- or symbol-only strings (e.g. ":", "—", "•", "·").
 *   - Numeric-only strings (e.g. "404", "3.14").
 *   - Strings that are exclusively composed of {@link PROPER_NOUNS} tokens
 *     (with whitespace / punctuation between them). E.g. "Vercel", "iOS · Android".
 *   - Strings that look like a route path (`/^\/[A-Za-z0-9/_\-:]*$/`).
 *   - Test-only DOM marked with `data-testid` (we never scan that attribute,
 *     and we never scan `className`, so Tailwind utility strings are safe).
 *   - Strings inside expression containers that aren't plain string literals
 *     (e.g. `{t('key')}`, `{i18n.t('key')}`) — these are not literals at all.
 *
 * Wiring:
 *   This rule is intentionally scoped to umbrella directories
 *   (`src/components/responsive/**`, `src/help/**`, `src/components/AddGate/**`)
 *   in `eslint.config.js`. As the rest of the codebase is migrated to
 *   `t()`, the file pattern can be widened and the severity escalated from
 *   `warn` to `error`.
 *
 * Requirements: 11.4, 13.4, 13.5
 */

'use strict';

/**
 * Mirror of `frontend/src/i18n/properNouns.ts`. Kept in sync manually — the
 * canonical source-of-truth lives in TypeScript and additions there must be
 * mirrored here in the same PR (R11.7).
 */
const PROPER_NOUNS = new Set([
  'Vercel',
  'Firebase',
  'Google',
  'Apple',
  'AntD',
  'Tailwind',
  'GitHub',
  'Stripe',
  'iOS',
  'Android',
  'WCAG',
  'ERPIQ',
]);

/** Attributes that always surface user-facing copy, on any JSX element. */
const FLAGGED_ATTRS_ANY_ELEMENT = new Set([
  'title',
  'aria-label',
  'placeholder',
  'alt',
]);

/**
 * Component props that surface user-facing copy, but ONLY on Component
 * elements (uppercase / member-expression names). On native HTML elements
 * these names mean something else (e.g., `<label>` is an element, not a prop;
 * `<input type="text">` uses `text` as a value, not a literal prop name).
 */
const FLAGGED_ATTRS_COMPONENT_ONLY = new Set([
  'label',
  'tooltip',
  'description',
  'message',
  'text',
]);

/** A "route-like" path: starts with `/`, contains URL-safe characters only. */
const ROUTE_PATH_RE = /^\/[A-Za-z0-9/_\-:]*$/;

/** Contains at least one letter from Latin or Arabic/Kurdish ranges. */
const LETTER_RE = /[A-Za-z\u0600-\u06FF]/;

/** Matches strings that are only digits / decimal numbers. */
const NUMERIC_ONLY_RE = /^\s*-?\d+(?:\.\d+)?\s*$/;

/**
 * Returns true when the trimmed string is composed entirely of tokens that
 * appear in {@link PROPER_NOUNS}, separated by whitespace or punctuation.
 *
 * Examples that return true:
 *   "Vercel"
 *   "iOS"
 *   "iOS / Android"
 *   "GitHub · Stripe"
 *
 * Examples that return false:
 *   "Hello Vercel"           — "Hello" is not a proper noun.
 *   "Welcome to ERPIQ"       — "Welcome", "to" are not proper nouns.
 */
function isOnlyProperNouns(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Split on whitespace and common separators; keep anything letter-bearing.
  const tokens = trimmed
    .split(/[\s/·•\-—–|,.()\[\]]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && LETTER_RE.test(t));
  if (tokens.length === 0) return false;
  return tokens.every((token) => PROPER_NOUNS.has(token));
}

/**
 * True when the string is "obviously not user-facing copy" — empty,
 * whitespace, punctuation-only, numeric-only, or a route path.
 */
function isAllowlistedLiteral(value) {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (trimmed === '') return true;
  if (NUMERIC_ONLY_RE.test(trimmed)) return true;
  if (ROUTE_PATH_RE.test(trimmed)) return true;
  // No letters at all → punctuation, symbols, separators, math — not copy.
  if (!LETTER_RE.test(trimmed)) return true;
  if (isOnlyProperNouns(trimmed)) return true;
  return false;
}

/**
 * Returns the simple name of a JSX element, or `null` for namespaced names.
 *   <Button />            → "Button"
 *   <div />               → "div"
 *   <Form.Item />         → "Form.Item"
 *   <ns:Custom />         → null
 */
function getJsxElementName(openingElement) {
  const name = openingElement.name;
  if (!name) return null;
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    const parts = [];
    let current = name;
    while (current && current.type === 'JSXMemberExpression') {
      parts.unshift(current.property.name);
      current = current.object;
    }
    if (current && current.type === 'JSXIdentifier') {
      parts.unshift(current.name);
    }
    return parts.join('.');
  }
  return null;
}

/**
 * True when the JSX element is a Component (uppercase identifier) rather
 * than a native HTML element.
 *   <Button />     → true
 *   <Form.Item />  → true  (any member expression is a component)
 *   <div />        → false
 */
function isComponentElement(openingElement) {
  const name = openingElement.name;
  if (!name) return false;
  if (name.type === 'JSXMemberExpression') return true;
  if (name.type === 'JSXIdentifier') {
    const first = name.name.charAt(0);
    return first === first.toUpperCase() && first !== first.toLowerCase();
  }
  return false;
}

/**
 * Resolves a JSXAttribute name (which may be a JSXIdentifier like `title`
 * or a JSXNamespacedName like `xml:lang`) to its simple string form.
 */
function getAttributeName(attr) {
  const node = attr.name;
  if (!node) return null;
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXNamespacedName') {
    return `${node.namespace.name}:${node.name.name}`;
  }
  return null;
}

/**
 * Extracts a plain string value from a JSXAttribute's `value`, if and only
 * if the value is a string literal or a no-substitution template literal.
 * Returns `null` for `{t('key')}`, identifiers, member expressions, etc.
 */
function getAttrStringValue(value) {
  if (!value) return null;
  // <Foo title="hello" />
  if (value.type === 'Literal' && typeof value.value === 'string') {
    return { node: value, text: value.value };
  }
  // <Foo title={"hello"} />
  if (value.type === 'JSXExpressionContainer') {
    const expr = value.expression;
    if (!expr) return null;
    if (expr.type === 'Literal' && typeof expr.value === 'string') {
      return { node: expr, text: expr.value };
    }
    // <Foo title={`hello`} /> — only when there are zero substitutions.
    if (
      expr.type === 'TemplateLiteral' &&
      expr.expressions.length === 0 &&
      expr.quasis.length === 1
    ) {
      return { node: expr, text: expr.quasis[0].value.cooked ?? '' };
    }
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow user-facing hardcoded string literals in JSX. Resolve copy ' +
        'through t() (i18next) or the Help_Registry instead.',
      category: 'Best Practices',
      recommended: false,
    },
    messages: {
      hardcodedJsxText:
        'Hardcoded user-facing text "{{value}}" must be resolved through t() ' +
        'instead of being inlined as JSX text.',
      hardcodedAttr:
        'Hardcoded string on JSX attribute "{{attr}}" ("{{value}}") must be ' +
        'resolved through t() instead of being inlined.',
      hardcodedComponentProp:
        'Hardcoded string on Component prop "{{attr}}" ("{{value}}") must be ' +
        'resolved through t() instead of being inlined.',
    },
    schema: [],
  },

  create(context) {
    /**
     * Trim a string for display in the diagnostic — long literals are
     * truncated so the message stays readable.
     */
    function display(value) {
      const text = value.replace(/\s+/g, ' ').trim();
      return text.length > 60 ? `${text.slice(0, 57)}…` : text;
    }

    return {
      // (1) JSX text content — between tags: <p>Save changes</p>
      JSXText(node) {
        const raw = node.value;
        if (isAllowlistedLiteral(raw)) return;
        context.report({
          node,
          messageId: 'hardcodedJsxText',
          data: { value: display(raw) },
        });
      },

      // (2) and (3) JSX attributes
      JSXAttribute(node) {
        const attrName = getAttributeName(node);
        if (!attrName) return;

        const stringValue = getAttrStringValue(node.value);
        if (!stringValue) return;
        if (isAllowlistedLiteral(stringValue.text)) return;

        // (2) Always-flagged attributes — applicable on any JSX element.
        if (FLAGGED_ATTRS_ANY_ELEMENT.has(attrName)) {
          context.report({
            node: stringValue.node,
            messageId: 'hardcodedAttr',
            data: { attr: attrName, value: display(stringValue.text) },
          });
          return;
        }

        // (3) Component-only props — only on uppercase / member-expression
        // elements (AntD, shadcn, custom components).
        if (FLAGGED_ATTRS_COMPONENT_ONLY.has(attrName)) {
          // Walk up to the JSXOpeningElement parent.
          let parent = node.parent;
          while (parent && parent.type !== 'JSXOpeningElement') {
            parent = parent.parent;
          }
          if (!parent) return;
          if (!isComponentElement(parent)) return;

          context.report({
            node: stringValue.node,
            messageId: 'hardcodedComponentProp',
            data: { attr: attrName, value: display(stringValue.text) },
          });
        }
      },
    };
  },
};

module.exports = rule;

// Exposed for unit tests.
module.exports.__internals = {
  PROPER_NOUNS,
  FLAGGED_ATTRS_ANY_ELEMENT,
  FLAGGED_ATTRS_COMPONENT_ONLY,
  isAllowlistedLiteral,
  isOnlyProperNouns,
  isComponentElement,
  getJsxElementName,
};
