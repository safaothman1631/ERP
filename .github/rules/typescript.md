# Rule: TypeScript

**ALWAYS-FOLLOW**

## Strict Mode
- `tsconfig.app.json` strict اصلی بێت
- ❌ هیچ `any` (بەکارهێنە `unknown` + type narrowing)
- ❌ هیچ `as` cast بەبێ comment ـی شیکەرەوە
- ✅ Type inference پێشنیار (let TS infer)

## Type Guards
```ts
function isOrder(x: unknown): x is Order {
  return typeof x === "object" && x !== null && "id" in x;
}
```

## React Components
```tsx
// ✅
type Props = { foo: string; bar?: number };
export const MyComponent: React.FC<Props> = ({ foo, bar = 0 }) => { ... };
```

## API Calls
```ts
// ✅ — response typed
const res = await api.get<Order[]>("/orders");
```

## Common Pitfalls
- `noUnusedLocals: false` لە tsconfig.app.json (POS ئاسانکاری)
- `NodeJS.Timeout` نا — بەکارهێنە `ReturnType<typeof setTimeout>`
- Optional param دواتر required param: TS1016 → ڕیزبەندی گۆڕە

## Build
هەمیشە: `npm run build` (نا تەنها `tsc --noEmit`)
