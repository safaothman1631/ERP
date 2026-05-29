/**
 * @fileoverview Forbid overly-broad `queryClient.invalidateQueries(...)`
 * calls — a 1-element queryKey invalidates an entire resource tree, which
 * is a perf trap.
 *
 * Satisfies requirement R2.3 of `world-class-performance`.
 *
 * Flagged shapes
 * --------------
 *   queryClient.invalidateQueries({ queryKey: ['invoices'] })
 *   queryClient.invalidateQueries(['invoices'])
 *
 * Acceptable shapes
 * -----------------
 *   queryClient.invalidateQueries({ queryKey: ['invoices', { tenantId }] })
 *   queryClient.invalidateQueries({ queryKey: ['invoices', id] })
 *
 * The fix is a suggestion (not auto-applied) because the right second key
 * segment is context-dependent.
 */

'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow broad invalidateQueries calls with a single-element queryKey.',
      category: 'Best Practices',
      recommended: true,
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      tooBroad:
        'invalidateQueries with a 1-element queryKey invalidates the entire resource tree. Add a tenant id, an entity id, or a filter hash as the second segment.',
      addSegment:
        'Add a placeholder second key segment (replace with the real id).',
    },
  },

  create(context) {
    /**
     * Decide if a node is the queryKey value we want to inspect.
     * Returns the ArrayExpression node if so, else null.
     */
    function getQueryKeyArray(arg) {
      if (!arg) return null;
      // Direct array passed: invalidateQueries(['x'])
      if (arg.type === 'ArrayExpression') return arg;
      // Object form: invalidateQueries({ queryKey: ['x'] })
      if (arg.type === 'ObjectExpression') {
        const prop = arg.properties.find(
          (p) =>
            p.type === 'Property' &&
            !p.computed &&
            ((p.key.type === 'Identifier' && p.key.name === 'queryKey') ||
              (p.key.type === 'Literal' && p.key.value === 'queryKey')),
        );
        if (prop && prop.value.type === 'ArrayExpression') return prop.value;
      }
      return null;
    }

    /** Match `<anything>.invalidateQueries(...)` */
    function isInvalidateCall(node) {
      return (
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'invalidateQueries'
      );
    }

    return {
      CallExpression(node) {
        if (!isInvalidateCall(node)) return;
        if (node.arguments.length === 0) return;
        const arr = getQueryKeyArray(node.arguments[0]);
        if (!arr) return;

        if (arr.elements.length === 1 && arr.elements[0] !== null) {
          context.report({
            node: arr,
            messageId: 'tooBroad',
            suggest: [
              {
                messageId: 'addSegment',
                fix(fixer) {
                  const sourceCode = context.getSourceCode();
                  const firstText = sourceCode.getText(arr.elements[0]);
                  return fixer.replaceText(
                    arr,
                    `[${firstText}, /* TODO: id or filter hash */ undefined]`,
                  );
                },
              },
            ],
          });
        }
      },
    };
  },
};
