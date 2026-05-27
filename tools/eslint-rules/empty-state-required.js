/**
 * @fileoverview Forbid direct use of Ant Design's `<Empty />` component in
 * user-facing `.tsx` files. The sanctioned empty UI is the project's own
 * `<EmptyState>` primitive from `@/design-system/empty/EmptyState`.
 *
 * Satisfies Requirement 1.5 of `empty-state-quick-create`:
 *   > The default Antd empty state ("No data") SHALL NOT appear anywhere
 *   > user-facing after this spec lands. A custom shared component
 *   > (<EmptyState>) is the only sanctioned empty UI.
 *
 * The rule fires when:
 *   - A specifier named `Empty` (or `Empty as X`) is imported from `'antd'`.
 *   - The `<Empty />` JSX element is rendered.
 *
 * Exemptions
 * ----------
 *   1. Files under `design-system/empty/**` may import `Empty` (internal use).
 *   2. Files / sites containing an `// empty-state-exempt: <reason>` comment
 *      on the same line or the immediately preceding line are exempt. The
 *      reason is required and is captured in audit reports.
 *   3. Test fixtures (`*.test.{ts,tsx}`, `*.vitest.test.tsx`,
 *      `*.integration.test.ts`) are exempt — they may reference Antd's Empty
 *      to assert legacy behaviour.
 *
 * Auto-fix
 * --------
 *   None — replacing `<Empty />` is context-dependent and a wrong fix is
 *   worse than a manual one. The rule emits a suggestion instead.
 */

'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid Ant Design <Empty /> in user-facing TSX; use <EmptyState> instead.',
      category: 'Best Practices',
      recommended: true,
      url: 'docs/ui/empty-state-quick-create.md',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      importBanned:
        '`Empty` from `antd` is banned in user-facing code. Import `EmptyState` from `@/design-system/empty/EmptyState` instead. To bypass for a legitimate reason add `// empty-state-exempt: <reason>` above the import.',
      jsxBanned:
        '`<Empty />` is banned in user-facing code. Replace with `<EmptyState variant="..." illustration="..." titleKey="..." descriptionKey="..." />`. To bypass add `// empty-state-exempt: <reason>` on the same or previous line.',
      suggestReplace: 'Replace with a stub <EmptyState /> placeholder (manual fixup required).',
    },
  },

  create(context) {
    const filename = (context.filename || context.getFilename() || '').replace(/\\/g, '/');

    /** Files under `design-system/empty/**` are allowed to use Antd's Empty internally. */
    const INTERNAL_RE = /\/design-system\/empty\//;
    /** Test fixtures are exempt — they reference legacy behaviour. */
    const TEST_RE = /\.(test|vitest\.test|integration\.test)\.(ts|tsx)$/;

    if (INTERNAL_RE.test(filename) || TEST_RE.test(filename)) {
      return {};
    }

    const sourceCode = context.sourceCode || context.getSourceCode();

    /**
     * Returns true when the node has an inline or preceding-line comment of
     * the form `// empty-state-exempt: <reason>`.
     */
    function hasExemption(node) {
      const before = sourceCode.getCommentsBefore(node) || [];
      const inline = sourceCode.getCommentsInside(node) || [];
      const after = sourceCode.getCommentsAfter(node) || [];
      // Same-line comments are typically attached as the next token's
      // leading comment OR as a trailing comment of the previous token.
      // Concat all three and look for the marker.
      const all = [...before, ...inline, ...after];
      return all.some((c) => /empty-state-exempt\s*:\s*\S+/i.test(c.value || ''));
    }

    return {
      ImportDeclaration(node) {
        if (!node.source || node.source.value !== 'antd') return;
        const empty = node.specifiers.find(
          (s) =>
            s.type === 'ImportSpecifier' &&
            s.imported &&
            s.imported.type === 'Identifier' &&
            s.imported.name === 'Empty',
        );
        if (!empty) return;
        if (hasExemption(node)) return;
        context.report({
          node: empty,
          messageId: 'importBanned',
        });
      },

      JSXOpeningElement(node) {
        if (!node.name || node.name.type !== 'JSXIdentifier') return;
        if (node.name.name !== 'Empty') return;
        if (hasExemption(node) || hasExemption(node.parent || node)) return;
        context.report({
          node,
          messageId: 'jsxBanned',
          suggest: [
            {
              messageId: 'suggestReplace',
              fix(fixer) {
                return fixer.replaceText(
                  node,
                  '<EmptyState\n  variant="list"\n  illustration="inbox"\n  titleKey="empty.todo.title"\n  descriptionKey="empty.todo.description"\n/>',
                );
              },
            },
          ],
        });
      },
    };
  },
};
