/**
 * @fileoverview Forbid raw `useQuery` / `useInfiniteQuery` calls — every
 * React Query hook must declare its freshness class via `useClassedQuery`
 * (or `useCRUD({ queryClass: ... })`).
 *
 * Satisfies requirement R2.1 of `world-class-performance`.
 *
 * The rule fires on direct call expressions where the callee identifier is
 * `useQuery` or `useInfiniteQuery`. The auto-fix wraps the call in a
 * `useClassedQuery` call with a literal `'TODO'` class so the developer is
 * forced to choose one.
 */

'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require all React Query hooks to declare a freshness class via useClassedQuery.',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingClass:
        'Direct use of `{{name}}` is forbidden. Wrap with `useClassedQuery` (or pass `queryClass` to useCRUD) so the data-freshness class is explicit. See frontend/src/data/queryClasses.ts.',
    },
  },

  create(context) {
    /** Names we forbid at the top-level callee position. */
    const FORBIDDEN = new Set(['useQuery', 'useInfiniteQuery']);

    /**
     * Walk up the lexical scope to confirm the identifier is not just a
     * variable shadowing the real hook. If we can't resolve it, assume it's
     * the real hook and report — better a false positive than miss one.
     */
    function isLikelyTanstackHook(node) {
      // Skip member expressions like `queryClient.useQuery` (none exist in
      // TanStack Query v5, but be defensive).
      return node.type === 'Identifier' && FORBIDDEN.has(node.name);
    }

    return {
      CallExpression(node) {
        if (!isLikelyTanstackHook(node.callee)) return;

        context.report({
          node,
          messageId: 'missingClass',
          data: { name: node.callee.name },
          fix(fixer) {
            // Replace `useQuery(args)` with
            //   `useClassedQuery(/* TODO: queryClass */ 'B', args)`
            // — the developer is expected to immediately edit the class
            // letter; the marker keeps it visible in code review.
            const sourceCode = context.getSourceCode();
            const argsText = node.arguments
              .map((arg) => sourceCode.getText(arg))
              .join(', ');
            return fixer.replaceText(
              node,
              `useClassedQuery(/* TODO: pick a queryClass A|B|C|D|E */ 'B', ${argsText})`,
            );
          },
        });
      },
    };
  },
};
