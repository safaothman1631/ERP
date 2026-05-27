/**
 * @fileoverview RuleTester coverage for `quick-create-select`.
 *
 * The rule is intentionally precise — it only flags `<Select>` when BOTH:
 *   - options come from a dynamic source (useQuery/useState/.map/etc.), AND
 *   - the surrounding context indicates a foreign-key column.
 *
 * Test the matrix:
 *   - dynamic + FK  → flagged
 *   - dynamic + non-FK → clean
 *   - static + FK  → clean (likely an enum-like dropdown)
 *   - exemption marker → clean
 *   - non-antd Select → clean
 */

'use strict';

const { RuleTester } = require('eslint');
const rule = require('./quick-create-select');

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

tester.run('quick-create-select', rule, {
  valid: [
    // No Antd Select import → rule doesn't fire.
    {
      filename: 'frontend/src/pages/Foo.tsx',
      code:
        "import { Button } from 'antd';\n" +
        "const X = () => <Button>hi</Button>;",
    },
    // Static options (literal array) + FK suffix → still clean.
    {
      filename: 'frontend/src/pages/Foo.tsx',
      code:
        "import { Select, Form } from 'antd';\n" +
        "const X = () => (\n" +
        "  <Form.Item name='status_id'>\n" +
        "    <Select options={[{ value: 'a', label: 'A' }]} />\n" +
        "  </Form.Item>\n" +
        ");",
    },
    // Dynamic options but non-FK field name → clean (could be a filter).
    {
      filename: 'frontend/src/pages/Foo.tsx',
      code:
        "import { Select } from 'antd';\n" +
        "const customers = useQuery({ queryKey: ['c'], queryFn: f }).data;\n" +
        "const X = () => <Select options={customers} value={searchText} />;",
    },
    // Exemption marker waives the violation.
    {
      filename: 'frontend/src/pages/Foo.tsx',
      code:
        "import { Select, Form } from 'antd';\n" +
        "const { data: customers } = useQuery({ queryKey: ['c'], queryFn: f });\n" +
        "// quick-create-exempt: legacy widget — migrating in EP-2 ticket #1234\n" +
        "const X = () => (\n" +
        "  <Form.Item name='contact_id'>\n" +
        "    <Select options={customers} />\n" +
        "  </Form.Item>\n" +
        ");",
    },
    // Test files exempt.
    {
      filename: 'frontend/src/pages/Foo.test.tsx',
      code:
        "import { Select, Form } from 'antd';\n" +
        "const customers = useQuery({}).data;\n" +
        "const X = () => (\n" +
        "  <Form.Item name='contact_id'>\n" +
        "    <Select options={customers} />\n" +
        "  </Form.Item>\n" +
        ");",
    },
    // Internal design-system path exempt.
    {
      filename: 'frontend/src/design-system/empty/SelectWithQuickCreate.tsx',
      code:
        "import { Select } from 'antd';\n" +
        "const { data: items } = useQuery({});\n" +
        "const X = ({ contact_id }) => <Select options={items} value={contact_id} />;",
    },
  ],

  invalid: [
    // Dynamic options from useQuery + FK Form.Item → flagged.
    {
      filename: 'frontend/src/pages/Foo.tsx',
      code:
        "import { Select, Form } from 'antd';\n" +
        "const { data: customers } = useQuery({ queryKey: ['c'], queryFn: f });\n" +
        "const X = () => (\n" +
        "  <Form.Item name='contact_id'>\n" +
        "    <Select options={customers} />\n" +
        "  </Form.Item>\n" +
        ");",
      errors: [{ messageId: 'missingWrapper' }],
    },
    // Dynamic options via .map + FK value prop path → flagged.
    {
      filename: 'frontend/src/pages/Foo.tsx',
      code:
        "import { Select } from 'antd';\n" +
        "const items = useState([]);\n" +
        "const X = ({ row }) => <Select options={items.map(x => ({ value: x.id, label: x.name }))} value={row.item_id} />;",
      errors: [{ messageId: 'missingWrapper' }],
    },
  ],
});
