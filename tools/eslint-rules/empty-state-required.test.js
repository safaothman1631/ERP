/**
 * @fileoverview RuleTester coverage for `empty-state-required`.
 *
 * Verifies that:
 *   - `Empty` imported from `antd` is flagged in normal TSX files.
 *   - The `<Empty />` JSX element is flagged.
 *   - Files under `design-system/empty/` are exempt (internal usage).
 *   - Test files are exempt.
 *   - The `// empty-state-exempt:` marker waives the violation.
 *   - Other Antd imports are untouched.
 */

'use strict';

const { RuleTester } = require('eslint');
const rule = require('./empty-state-required');

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

tester.run('empty-state-required', rule, {
  valid: [
    // Different Antd component → untouched.
    {
      filename: 'frontend/src/pages/Invoices.tsx',
      code: "import { Button } from 'antd';",
    },
    // Internal design-system path — Antd Empty allowed here.
    {
      filename: 'frontend/src/design-system/empty/EmptyState.tsx',
      code: "import { Empty } from 'antd'; const X = () => <Empty />;",
    },
    // Test files are exempt.
    {
      filename: 'frontend/src/pages/Invoices.test.tsx',
      code: "import { Empty } from 'antd'; const X = () => <Empty />;",
    },
    // Same-line exemption marker waives the violation.
    {
      filename: 'frontend/src/pages/Foo.tsx',
      code:
        "// empty-state-exempt: legacy placeholder until EP-3 lands\n" +
        "import { Empty } from 'antd';",
    },
    // Preceding-line exemption marker waives the JSX violation.
    {
      filename: 'frontend/src/pages/Foo.tsx',
      code:
        "import { Empty } from 'antd';\n" +
        "// empty-state-exempt: third-party widget container\n" +
        "const X = () => <Empty />;",
    },
  ],

  invalid: [
    // Raw import is flagged.
    {
      filename: 'frontend/src/pages/Invoices.tsx',
      code: "import { Empty } from 'antd';",
      errors: [{ messageId: 'importBanned' }],
    },
    // Mixed imports — only Empty is flagged.
    {
      filename: 'frontend/src/pages/Bills.tsx',
      code: "import { Button, Empty, Tag } from 'antd';",
      errors: [{ messageId: 'importBanned' }],
    },
    // JSX usage is flagged.
    {
      filename: 'frontend/src/pages/Items.tsx',
      code:
        "import { Empty } from 'antd';\n" +
        "const X = () => <Empty description='nope' />;",
      errors: [{ messageId: 'importBanned' }, { messageId: 'jsxBanned' }],
    },
  ],
});
