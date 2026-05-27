/**
 * @fileoverview RuleTester coverage for `require-query-class`.
 */

'use strict';

const { RuleTester } = require('eslint');
const rule = require('./require-query-class');

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

tester.run('require-query-class', rule, {
  valid: [
    // Going through the helper is fine.
    {
      code: "useClassedQuery(['k'], fn, 'B');",
    },
    // useCRUD with an explicit queryClass is fine.
    {
      code: "useCRUD({ queryClass: 'C' });",
    },
    // Calling something else that happens to share a substring is fine.
    {
      code: "useQueryParam('id');",
    },
  ],
  invalid: [
    {
      code: "useQuery({ queryKey: ['x'], queryFn: f });",
      errors: [{ messageId: 'missingClass' }],
      output:
        "useClassedQuery(/* TODO: pick a queryClass A|B|C|D|E */ 'B', { queryKey: ['x'], queryFn: f });",
    },
    {
      code: "useInfiniteQuery({ queryKey: ['x'], queryFn: f, getNextPageParam: g, initialPageParam: 0 });",
      errors: [{ messageId: 'missingClass' }],
      output:
        "useClassedQuery(/* TODO: pick a queryClass A|B|C|D|E */ 'B', { queryKey: ['x'], queryFn: f, getNextPageParam: g, initialPageParam: 0 });",
    },
  ],
});
