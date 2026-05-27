/**
 * @fileoverview Flag direct `<EmptyState>` usage outside a `<StateSwitch>`.
 *
 * Per design.md §1.4, `<StateSwitch>` is the only sanctioned entry point for
 * rendering an empty state — it enforces the loading → error → empty → populated
 * state machine.
 *
 * The rule fires when:
 *   1. A JSX element named `EmptyState` is rendered, AND
 *   2. No enclosing JSX element named `StateSwitch` exists.
 *
 * Exceptions:
 *   - Inside a `notFoundContent={...}` prop value (Antd Select).
 *   - When the file has a top-level `// state-switch-exempt: <reason>` marker.
 */

'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require <EmptyState> to be rendered inside <StateSwitch>. See design-system/empty/StateSwitch.tsx.',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [],
    messages: {
      missingStateSwitch:
        '<EmptyState> must be rendered inside <StateSwitch> so loading/error/empty/populated are deterministic. Wrap with <StateSwitch ... emptyState={<EmptyState ... />}/>. To override, add a top-level `// state-switch-exempt: <reason>` comment.',
    },
  },

  create(context) {
    const sourceCode = context.getSourceCode();
    const comments = sourceCode.getAllComments();
    const hasExemption = comments.some(
      (c) => typeof c.value === 'string' && c.value.includes('state-switch-exempt'),
    );
    if (hasExemption) {
      return {};
    }

    /** Walk JSX ancestors looking for StateSwitch or the notFoundContent prop. */
    function isInsideAllowedAncestor(node) {
      let cur = node.parent;
      while (cur) {
        if (
          cur.type === 'JSXElement' &&
          cur.openingElement &&
          cur.openingElement.name &&
          cur.openingElement.name.type === 'JSXIdentifier' &&
          cur.openingElement.name.name === 'StateSwitch'
        ) {
          return true;
        }
        if (
          cur.type === 'JSXAttribute' &&
          cur.name &&
          cur.name.type === 'JSXIdentifier' &&
          cur.name.name === 'notFoundContent'
        ) {
          return true;
        }
        cur = cur.parent;
      }
      return false;
    }

    return {
      JSXOpeningElement(node) {
        if (
          !node.name ||
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'EmptyState'
        ) {
          return;
        }
        if (isInsideAllowedAncestor(node)) return;
        context.report({ node, messageId: 'missingStateSwitch' });
      },
    };
  },
};
