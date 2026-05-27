/**
 * @fileoverview Flag raw `<Select>` usage from Ant Design when the Select is
 * almost certainly a foreign-key selector (i.e. should be migrated to
 * `<SelectWithQuickCreate entity="...">` per the empty-state spec).
 *
 * Heuristic — both of the following must hold:
 *   1. The Select has an `options` prop assigned from a `useQuery(...)` call,
 *      a `useState(...)` array, a `useMemo(() => ...)`, or a bare identifier
 *      that looks data-driven (e.g. `customers`, `vendors`, `items`).
 *   2. The Select binds to a foreign-key field — detected by:
 *        - a `value` / `defaultValue` prop whose source identifier or
 *          property path ends in `_id` or `_uuid`,
 *        - OR a JSX-spread `field` from React Hook Form / Formik where the
 *          path ends in `_id`,
 *        - OR a `name` prop on the surrounding `<Form.Item>` with that
 *          suffix.
 *
 * Either signal alone is too noisy; both together produce high-precision
 * recall of the migration backlog.
 *
 * Auto-fix (suggestion only)
 * --------------------------
 *   Wraps the Select in `<SelectWithQuickCreate entity="TODO-ENTITY">` and
 *   leaves an obvious placeholder for the developer to fill in.
 *
 * Exemptions
 * ----------
 *   - Files under `design-system/empty/**` are skipped (internal usage).
 *   - Sites with `// quick-create-exempt: <reason>` on the same or previous
 *     line are exempt.
 *   - Test fixtures (`*.test.tsx`, `*.vitest.test.tsx`, `*.integration.test.ts`)
 *     are exempt.
 */

'use strict';

/** Variable-name suffixes that indicate a foreign-key column. */
const FK_SUFFIX_RE = /(_id|_uuid|Id|Uuid)$/;
/** Property-name suffixes used for nested field paths. */
const FK_PATH_RE = /(?:^|[._])(?:[a-zA-Z0-9]+)(_id|_uuid|Id|Uuid)$/;
/** Identifier names that hint at fetched collections. */
const COLLECTION_HINTS = new Set([
  'customers', 'vendors', 'items', 'accounts', 'taxes', 'taxRates',
  'categories', 'teams', 'plans', 'locations', 'banks', 'employees',
  'contacts', 'products', 'suppliers', 'currencies', 'tags',
  'paymentMethods', 'paymentmethods',
]);

/** Hook names that indicate the options came from a network call / dynamic source. */
const DYNAMIC_HOOK_RE = /^(useQuery|useInfiniteQuery|useClassedQuery|useCRUD|useState|useMemo|useFetch|useAsync|useFirestoreLive)$/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Flag raw Antd <Select> that looks like a foreign-key selector — should use <SelectWithQuickCreate entity="...">.',
      category: 'Best Practices',
      recommended: true,
      url: 'docs/ui/empty-state-quick-create.md',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      missingWrapper:
        'This `<Select>` looks like a foreign-key picker (value/options driven by `{{hint}}`). Wrap it in `<SelectWithQuickCreate entity="...">` so empty users get a quick-create CTA. To bypass add `// quick-create-exempt: <reason>` above.',
      wrapInQuickCreate:
        'Wrap with <SelectWithQuickCreate entity="TODO-ENTITY"> (manual entity slug fixup required).',
    },
  },

  create(context) {
    const filename = (context.filename || context.getFilename() || '').replace(/\\/g, '/');
    const INTERNAL_RE = /\/design-system\/empty\//;
    const TEST_RE = /\.(test|vitest\.test|integration\.test)\.(ts|tsx)$/;
    if (INTERNAL_RE.test(filename) || TEST_RE.test(filename)) return {};

    const sourceCode = context.sourceCode || context.getSourceCode();

    /** True when `Select` is imported from 'antd' in this file. */
    let antdSelectImported = false;
    /**
     * Map of variable name → "dynamic" reason string. Populated by walking
     * VariableDeclarators whose initialiser is a CallExpression matching
     * DYNAMIC_HOOK_RE. We use this to confirm `options={something}` came from
     * a dynamic source.
     */
    const dynamicBindings = new Map();
    /** Set of variable names with FK-suffixed names. */
    const fkBindings = new Set();

    function hasExemption(node) {
      const before = sourceCode.getCommentsBefore(node) || [];
      const inline = sourceCode.getCommentsInside(node) || [];
      const all = [...before, ...inline];
      return all.some((c) => /quick-create-exempt\s*:\s*\S+/i.test(c.value || ''));
    }

    function unwrap(expr) {
      if (!expr) return null;
      if (expr.type === 'JSXExpressionContainer') return expr.expression;
      return expr;
    }

    function exprToString(node) {
      if (!node) return '';
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'MemberExpression') {
        const obj = exprToString(node.object);
        const prop = node.computed ? '[?]' : exprToString(node.property);
        return `${obj}.${prop}`;
      }
      if (node.type === 'Literal') return String(node.value);
      return '';
    }

    function findAttr(opening, name) {
      return opening.attributes.find(
        (a) => a.type === 'JSXAttribute' && a.name && a.name.name === name,
      );
    }

    function isDynamic(node) {
      // useQuery / useState etc.
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        return DYNAMIC_HOOK_RE.test(node.callee.name);
      }
      // Bare identifier whose name suggests a collection.
      if (node.type === 'Identifier') {
        if (COLLECTION_HINTS.has(node.name)) return true;
        if (dynamicBindings.has(node.name)) return true;
      }
      // `someResult.data` — likely a query result.
      if (node.type === 'MemberExpression' && !node.computed) {
        const path = exprToString(node);
        if (/\.(data|items|results|options|rows)$/.test(path)) return true;
        if (dynamicBindings.has(exprToString(node.object))) return true;
      }
      // .map(...) — derived list.
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.property.name === 'map'
      ) {
        return true;
      }
      return false;
    }

    function isForeignKey(opening) {
      // Inspect `value`, `defaultValue`, `id` attribute paths.
      for (const attrName of ['value', 'defaultValue', 'id']) {
        const a = findAttr(opening, attrName);
        if (!a) continue;
        const expr = unwrap(a.value);
        if (!expr) continue;
        const path = exprToString(expr);
        if (FK_PATH_RE.test(path) || FK_SUFFIX_RE.test(path)) return path;
      }
      // Spread `{...field}` from React Hook Form / Formik.
      for (const attr of opening.attributes) {
        if (attr.type !== 'JSXSpreadAttribute') continue;
        const argName = exprToString(attr.argument);
        if (argName === 'field' || /Field$/.test(argName)) {
          // Walk up to find a Form.Item with name= attribute.
          let p = opening.parent;
          while (p) {
            if (
              p.type === 'JSXElement' &&
              p.openingElement.name &&
              p.openingElement.name.type === 'JSXMemberExpression' &&
              p.openingElement.name.property.name === 'Item'
            ) {
              const nameAttr = findAttr(p.openingElement, 'name');
              if (nameAttr && nameAttr.value) {
                const v = unwrap(nameAttr.value);
                const s = exprToString(v);
                if (FK_SUFFIX_RE.test(s)) return s;
              }
              break;
            }
            p = p.parent;
          }
        }
      }
      // Walk up: enclosing `<Form.Item name="contact_id">`.
      let p = opening.parent;
      let depth = 0;
      while (p && depth < 4) {
        if (
          p.type === 'JSXElement' &&
          p.openingElement.name &&
          p.openingElement.name.type === 'JSXMemberExpression' &&
          p.openingElement.name.property &&
          p.openingElement.name.property.name === 'Item'
        ) {
          const nameAttr = findAttr(p.openingElement, 'name');
          if (nameAttr && nameAttr.value) {
            const v = unwrap(nameAttr.value);
            const s = exprToString(v);
            if (FK_SUFFIX_RE.test(s)) return s;
          }
        }
        p = p.parent;
        depth++;
      }
      return null;
    }

    return {
      ImportDeclaration(node) {
        if (!node.source || node.source.value !== 'antd') return;
        const hit = node.specifiers.find(
          (s) =>
            s.type === 'ImportSpecifier' &&
            s.imported &&
            s.imported.name === 'Select',
        );
        if (hit) antdSelectImported = true;
      },

      VariableDeclarator(node) {
        if (!node.id || node.id.type !== 'Identifier') return;
        const name = node.id.name;
        if (FK_SUFFIX_RE.test(name)) fkBindings.add(name);
        if (node.init && isDynamic(node.init)) {
          dynamicBindings.set(name, node.init.callee && node.init.callee.name);
        }
      },

      JSXOpeningElement(node) {
        if (!antdSelectImported) return;
        if (!node.name || node.name.type !== 'JSXIdentifier') return;
        if (node.name.name !== 'Select') return;
        if (hasExemption(node) || hasExemption(node.parent || node)) return;

        const optsAttr = findAttr(node, 'options');
        const dynamic = optsAttr && isDynamic(unwrap(optsAttr.value));
        const fk = isForeignKey(node);
        if (!dynamic && !fk) return;
        // Require BOTH signals to keep precision high — unless the FK signal
        // is very strong (FK-named bound variable AND dynamic options).
        if (!(dynamic && fk)) return;

        const hint = (fk || (optsAttr && exprToString(unwrap(optsAttr.value)))) || 'dynamic options';

        context.report({
          node,
          messageId: 'missingWrapper',
          data: { hint },
          suggest: [
            {
              messageId: 'wrapInQuickCreate',
              fix(fixer) {
                const text = sourceCode.getText(node.parent);
                return fixer.replaceText(
                  node.parent,
                  `<SelectWithQuickCreate entity="TODO-ENTITY">${text}</SelectWithQuickCreate>`,
                );
              },
            },
          ],
        });
      },
    };
  },
};
