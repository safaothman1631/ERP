/**
 * ESLint custom rule: no-hardcoded-colors
 *
 * Flags hardcoded hex (#rrggbb, #rgb) and rgb/rgba() color values in
 * TypeScript/TSX files outside of `theme/tokens.ts`.
 *
 * Requirements: 1.4
 */

'use strict';

/** Regex patterns that match hardcoded color literals */
const HEX_PATTERN  = /#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\b/;
const RGB_PATTERN  = /\brgba?\s*\(/;

/**
 * Returns true if the given filename is the allowed tokens file.
 * @param {string} filename
 */
function isTokensFile(filename) {
  // Normalise path separators
  const normalised = filename.replace(/\\/g, '/');
  return (
    normalised.endsWith('theme/tokens.ts') ||
    normalised.endsWith('theme/tokens.tsx')
  );
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded hex/rgb color values outside theme/tokens.ts',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/your-org/zoho-erp/blob/main/docs/design-tokens.md',
    },
    messages: {
      noHardcodedColor:
        'Hardcoded color "{{value}}" is not allowed. ' +
        'Use a design token from theme/tokens.ts instead.',
    },
    schema: [],
  },

  create(context) {
    // Allow the tokens file itself to define raw color values
    if (isTokensFile(context.getFilename())) {
      return {};
    }

    /**
     * Check a string value for hardcoded color patterns.
     * @param {import('eslint').Rule.Node} node
     * @param {string} value
     */
    function checkValue(node, value) {
      if (HEX_PATTERN.test(value) || RGB_PATTERN.test(value)) {
        context.report({
          node,
          messageId: 'noHardcodedColor',
          data: { value: value.slice(0, 40) },
        });
      }
    }

    return {
      // String literals: 'color: #fff'
      Literal(node) {
        if (typeof node.value === 'string') {
          checkValue(node, node.value);
        }
      },

      // Template literals: `color: ${someVar}` — check the static quasis
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkValue(quasi, quasi.value.raw);
        }
      },
    };
  },
};

module.exports = rule;
