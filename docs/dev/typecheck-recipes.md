# Developer Guide — TypeScript Error Recipes

> **Spec ref:** `.kiro/specs/launch-readiness` T-LR.6.6, design §1.4
> **Audience:** Frontend devs working on this codebase
> **Why this exists:** The recent migration (EP-0 through EP-6 + R0) introduced ~ 130 file changes, React 19, Vite 8, and a new quick-create registry. The 20 errors below are the ones you'll hit most often when you run `npx tsc --noEmit`.

Each entry has: **the error message** (sometimes paraphrased), **the
root cause**, **the fix**, and **prevention** so it doesn't come back.

---

## 1. `Property 'X' does not exist on type 'Y'`

**Example:**

```
src/pages/InvoiceForm.tsx:42:21 - error TS2339:
Property 'iqd_tax_rate' does not exist on type 'Invoice'.
```

**Root cause:** The `Invoice` type in `src/types/index.ts` doesn't have
that field — either the spec was updated after the type was committed,
or the field was added to the backend without a corresponding TS update.

**Fix:** Extend the type at the source.

```ts
// src/types/index.ts
export interface Invoice {
  id: string;
  // ... existing fields
  iqd_tax_rate?: number | null;  // <-- add, optional + nullable to match backend
}
```

Do **not** use a local `interface ExtendedInvoice extends Invoice` —
the type is shared and the next dev will hit the same error.

**Prevention:** When you add a backend field, update `src/types/index.ts`
in the same PR. The type file is the contract.

---

## 2. `Type 'undefined' is not assignable to type 'string'`

**Example:**

```
src/pages/PosCart.tsx:88:17 - error TS2322:
Type 'string | undefined' is not assignable to type 'string'.
```

**Root cause:** A value from an optional chain (`obj?.x`) or a
loosely-typed source (Firestore doc, URL param) is `string | undefined`
where you're using it as `string`.

**Fix:** Either narrow the type or accept `undefined` at the consumer.

```ts
// Option A — nullish coalesce (preferred for display strings)
const name = contact?.name ?? '';

// Option B — narrow with a guard
if (!contact?.name) return null;
const name = contact.name;

// Option C — accept undefined in the prop type
type Props = { name: string | undefined };
```

**Prevention:** When you change a field to optional, run `tsc` to find
every consumer.

---

## 3. `Cannot find module '@/something'`

**Example:**

```
src/pages/Settings.tsx:5:21 - error TS2307:
Cannot find module '@/components/SettingsCard' or its corresponding type declarations.
```

**Root cause:** Either the file doesn't exist (typo), or the `@/` alias
is configured in `tsconfig.json` but not in `vite.config.ts` (or vice
versa). The mismatch is the most common form of this error after a
codemod run.

**Fix:**

1. Verify the file exists: look at `src/components/SettingsCard.tsx`.
2. Run the alias verifier: `npx tsx scripts/verify-aliases.ts`. If it
   exits non-zero, sync the two configs so they have the same `paths` /
   `alias` entries.
3. If the file moved, update imports. The codemod `scripts/codemod-relative-to-alias.ts`
   can help.

**Prevention:** The CI workflow runs `verify-aliases.ts` on every PR.
Don't disable it.

---

## 4. JSX element type 'Component' does not have any construct or call signatures

**Example:**

```
src/pages/PosKitchen.tsx:21:8 - error TS2604:
JSX element type 'KitchenTicket' does not have any construct or call signatures.
```

**Root cause:** Default-export / named-export shape mismatch. The file
exports the component as `export const KitchenTicket = ...` but you
imported it as `import KitchenTicket from '...'` (which expects a
default export).

**Fix:**

```ts
// Wrong
import KitchenTicket from '@/components/pos/KitchenTicket';

// Right (file uses named export)
import { KitchenTicket } from '@/components/pos/KitchenTicket';
```

Or, if you control the file and want default-export ergonomics:

```ts
// In KitchenTicket.tsx
export default function KitchenTicket(props: Props) { ... }
```

**Prevention:** Pick one convention per directory and stick with it.
The repo convention: named exports for components, default export only
for route-level pages registered in the router config.

---

## 5. `Type 'X' does not satisfy the constraint extends 'Y'`

**Example (Antd Select):**

```
src/pages/ItemForm.tsx:78:14 - error TS2344:
Type 'Account' does not satisfy the constraint
'BaseOptionType | DefaultOptionType'.
```

**Root cause:** Antd 6's `Select<ValueType, OptionType>` constrains
`OptionType` to extend its `BaseOptionType`. Passing a domain object
directly breaks the constraint.

**Fix:** Use a labeled option shape, not the raw domain type:

```tsx
<Select<string, { value: string; label: string }>
  options={accounts.map(a => ({ value: a.id, label: a.name }))}
  // ...
/>
```

For `SelectWithQuickCreate`, the constraint is already satisfied
internally — pass `entity` and `value`/`onChange` only.

**Prevention:** Don't infer generics by feeding domain objects to Antd
components; map first.

---

## 6. React 19 ref typing — `RefObject<T | null>` vs `MutableRefObject<T>`

**Example:**

```
src/components/PrintFrame.tsx:14:9 - error TS2322:
Type 'RefObject<HTMLIFrameElement | null>' is not assignable to type
'MutableRefObject<HTMLIFrameElement>'.
```

**Root cause:** React 19 made `useRef<T>(initialValue)` return
`RefObject<T | null>` rather than `MutableRefObject<T | null>`. Old
code that typed a function parameter as `MutableRefObject` no longer
matches.

**Fix:**

```ts
// Old
function focusFrame(ref: MutableRefObject<HTMLIFrameElement>) { ... }

// New
function focusFrame(ref: RefObject<HTMLIFrameElement | null>) { ... }
```

For DOM refs you're going to assign to (rare), use
`useRef<T>(null)` with the right cast at the assignment site.

**Prevention:** Use `RefObject` for refs you read; `useRef<T>(null)`
in the component that owns the ref.

---

## 7. Framer Motion variants typing

**Example:**

```
src/components/AnimatedCard.tsx:18:23 - error TS2322:
Type '{ hidden: { ... }; visible: { ... }; }' is not assignable to type 'Variants'.
Property '...' is incompatible.
```

**Root cause:** Framer 11's `Variants` got stricter. Object literal
fields like `transition: { duration: 0.3 }` need the right discriminant.

**Fix:** Annotate the variants object explicitly:

```ts
import type { Variants } from 'framer-motion';

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};
```

If the error mentions `ease`, use the string form (`'easeOut'`) not the
function form unless you import the type.

**Prevention:** Always annotate `Variants` at the const site.

---

## 8. Zustand store typing — partial updates

**Example:**

```
src/stores/posCart.ts:45:5 - error TS2345:
Argument of type '{ items: CartItem[] }' is not assignable to
parameter of type 'Partial<CartState> | ((state: CartState) => ...)'.
```

**Root cause:** You're calling `set({...})` with an object that's
missing required fields, and the inference broke because the state
type has an index signature or a union member.

**Fix:** Use the function form, which makes the partial intent explicit:

```ts
set((state) => ({ items: [...state.items, newItem] }));
```

Or annotate the type at the store creation:

```ts
const useCartStore = create<CartState>()((set) => ({ ... }));
```

The `create<T>()(...)` pattern fixes a lot of subtle errors.

**Prevention:** Always use `create<T>()` (the curried form), not `create((set) => ...)`.

---

## 9. React Query — infinite vs finite return type

**Example:**

```
src/api/useContacts.ts:14:10 - error TS2769:
No overload matches this call. Overload 1 of 3, ...
```

**Root cause:** You imported `useQuery` but the call shape matches
`useInfiniteQuery` (because you returned `{ data, nextCursor }` and
expected `pages`).

**Fix:** Pick the right hook for the shape:

```ts
// Finite query
const q = useQuery({
  queryKey: ['contacts', tenantId],
  queryFn: () => api.contacts.list(tenantId),
});

// Infinite query
const q = useInfiniteQuery({
  queryKey: ['contacts', tenantId],
  queryFn: ({ pageParam }) => api.contacts.list(tenantId, pageParam),
  initialPageParam: null,
  getNextPageParam: (last) => last.nextCursor,
});
```

For the `queryClass` requirement from `world-class-performance` R2,
add it to the options object:

```ts
useQuery({ queryKey, queryFn, queryClass: 'A' });
```

**Prevention:** Wrap React Query usage in our `useCRUD` hook where
possible — it picks the right primitive based on shape.

---

## 10. `'X' is declared but its value is never read`

**Example:**

```
src/pages/Reports.tsx:5:8 - error TS6133:
'_' is declared but its value is never read.
```

**Root cause:** TS6133 fires on unused imports/locals when
`noUnusedLocals` is on. Often this happens after a refactor.

**Fix:**

- Remove the import or local if truly unused.
- If intentionally unused (e.g. destructuring), prefix with `_`:
  ```ts
  const [_first, ...rest] = items;
  ```
- If it's a type-only import: `import type { X } from '...'`.

**Prevention:** Configure your editor to flag and auto-organize on save.

---

## 11. `Object is possibly 'undefined'`

**Example:**

```
src/pages/POSCart.tsx:101:5 - error TS2532:
Object is possibly 'undefined'.
```

**Root cause:** Strict null checks caught an unsafe access on an
optional object.

**Fix:**

```ts
// Option A — early return
if (!session) return null;
// session is now narrowed

// Option B — optional chain + default
const total = session?.total ?? 0;

// Option C — assertion (only with a comment justifying it)
const session = useSession()!; // guaranteed by route guard
```

**Prevention:** Don't reach for `!` first. Prefer narrowing.

---

## 12. `Generic type 'X' requires N type arguments`

**Example:**

```
src/hooks/useTimer.ts:7:14 - error TS2314:
Generic type 'Record<K, T>' requires 2 type arguments.
```

**Root cause:** You wrote `Record` (or `Map`, `Set`, etc.) without the
generic arguments.

**Fix:** Always provide the generics:

```ts
const timers: Record<string, NodeJS.Timeout> = {};
```

For `useState` / `useRef`, supply the type explicitly when the initial
value is `null` or an empty array:

```ts
const [items, setItems] = useState<Item[]>([]);
const ref = useRef<HTMLDivElement | null>(null);
```

**Prevention:** Lint rule `@typescript-eslint/no-empty-interface` and
strict-mode catches these.

---

## 13. `Type 'X' is missing the following properties from type 'Y'`

**Example:**

```
src/api/contacts.ts:55:3 - error TS2740:
Type '{ name: string }' is missing the following properties from type 'Contact': id, created_at, updated_at.
```

**Root cause:** You're constructing an object literal where TS expects
a full `Contact`.

**Fix:** Use `Partial<T>` for the slot if partial-is-intentional, or
type the call site as `Pick<>`/`Omit<>` to be explicit about which
fields are required.

```ts
async function createContact(input: Pick<Contact, 'name' | 'email' | 'phone'>): Promise<Contact> {
  // ...
}
```

**Prevention:** Define request/response types explicitly in
`src/api/<resource>.ts`, separate from the domain type.

---

## 14. Antd `No overload matches this call`

**Example:**

```
src/pages/Reports.tsx:50:8 - error TS2769:
No overload matches this call.
Overload 1 of 3, '(props: Readonly<TableProps<Sale>>): Table<Sale>', gave the following error.
```

**Root cause:** Antd 6 broke a few component prop signatures vs Antd 5.
Common offenders: `Table.columns[].render` now expects a more specific
typed result; `Select.optionFilterProp` was renamed in one variant.

**Fix:** Look at the *first* overload error message — it tells you the
specific prop that doesn't match. Usually:

```ts
// Old (Antd 5)
<Table dataSource={sales} columns={[...]} rowKey="id" />

// Antd 6 needs the generic for full typing
<Table<Sale> dataSource={sales} columns={[...]} rowKey="id" />
```

**Prevention:** Always supply the `Table<T>` generic.

---

## 15. `'Cell' is not exported from 'recharts'`

**Example:**

```
src/pages/dashboard/MRRChart.tsx:3:10 - error TS2305:
Module '"recharts"' has no exported member 'Cell'.
```

**Root cause:** Recharts 3 restructured exports. Some components moved
to subpaths.

**Fix:**

```ts
// Old
import { PieChart, Cell, Tooltip } from 'recharts';

// New (if Cell moved)
import { PieChart, Tooltip } from 'recharts';
import { Cell } from 'recharts/lib/component/Cell';
```

Check the installed version's index.d.ts for the canonical export path.

**Prevention:** Pin Recharts; don't auto-bump.

---

## 16. `import type` violation — TS5.x

**Example:**

```
src/types/index.ts:7:1 - error TS1484:
'Tenant' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
```

**Root cause:** Our `tsconfig.json` has `verbatimModuleSyntax: true`.
Type-only imports must be marked.

**Fix:**

```ts
// Wrong
import { Tenant } from './tenant';

// Right
import type { Tenant } from './tenant';
```

Or for mixed imports:

```ts
import { type Tenant, createTenant } from './tenant';
```

**Prevention:** `@typescript-eslint/consistent-type-imports` rule auto-fixes.

---

## 17. `Cannot redeclare block-scoped variable`

**Example:**

```
src/pages/PosCart.tsx:88:7 - error TS2451:
Cannot redeclare block-scoped variable 'cart'.
```

**Root cause:** Two `const cart` in the same scope — often after a
codemod merged two files.

**Fix:** Rename one. Use the more specific name (e.g. `cartItems` vs `cart`).

**Prevention:** Run `tsc --noEmit` after every codemod, not just the build.

---

## 18. Service Worker module not found

**Example:**

```
vite build error: ENOENT: no such file or directory, sw.js
```

**Root cause:** `vite-plugin-pwa` v1 changed the entry path. Our
config in `vite.config.ts` references `srcDir: 'src'` and
`filename: 'sw.ts'`. If you renamed or moved the SW file, the plugin
can't find it.

**Fix:** In `vite.config.ts`:

```ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  // ...
})
```

Confirm `src/sw.ts` exists.

**Prevention:** Don't rename the SW file without updating the plugin
config. CI build catches this.

---

## 19. `Cannot find module 'idb'`

**Example:**

```
src/stores/posOffline.ts:1:25 - error TS2307:
Cannot find module 'idb' or its corresponding type declarations.
```

**Root cause:** The POS offline store depends on the `idb` package.
Either it's not in `dependencies` or the install was incomplete.

**Fix:**

```bash
cd frontend
npm install idb --legacy-peer-deps
```

**Prevention:** `idb` should be in `dependencies` (not `devDependencies`)
because the SW uses it at runtime. Lock the version.

---

## 20. `Property 'queryClass' is missing in type 'UseQueryOptions'`

**Example:**

```
src/api/useInvoices.ts:14:5 - error TS2741:
Property 'queryClass' is missing in type '{ queryKey: ...; queryFn: ...; }'
but required in type 'UseQueryOptions<...>'.
```

**Root cause:** Per `world-class-performance` R2, we augmented
`@tanstack/react-query` to require `queryClass` on every query. The
augmentation is in `src/types/react-query.d.ts`.

**Fix:** Add the class:

```ts
useQuery({
  queryKey: ['invoices', tenantId],
  queryFn: () => api.invoices.list(tenantId),
  queryClass: 'A', // 'A' = real-time critical, 'B' = list, 'C' = report
});
```

Choose the class based on the data:
- `A`: order book, POS, dashboard counters (≤ 5s freshness)
- `B`: lists, search, settings (≤ 60s)
- `C`: reports, exports (any freshness fine)

**Prevention:** Use `useCRUD` where possible; it picks the right class.

---

## Appendix — Run tsc fast

To get fast feedback during a session:

```bash
# Watch mode in a separate terminal
npx tsc --noEmit --watch

# Or only check one file
npx tsc --noEmit --project tsconfig.json --diagnostic-only-file src/pages/InvoiceForm.tsx
```

For CI: the `frontend typecheck` step runs `npx tsc --noEmit` and is
blocking once the baseline hits zero (T-LR.0.10).

---

*Last reviewed: 2026-05-29 by Safa Othman. Add entries here as the team hits new patterns.*
