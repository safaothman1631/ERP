# Skill: TypeScript Strict

## Setup
`tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": false,    // POS module: relaxed
    "noUnusedParameters": false,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Type Narrowing
```ts
function parse(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const n = Number(x);
    if (!isNaN(n)) return n;
  }
  throw new Error("invalid number");
}
```

## Discriminated Unions
```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function handle(r: Result<number>) {
  if (r.ok) {
    console.log(r.value);  // narrowed to number
  } else {
    console.log(r.error);  // narrowed to string
  }
}
```

## Avoid `any`
```ts
// ❌
function foo(data: any) { ... }

// ✅
function foo(data: unknown) {
  if (typeof data === "object" && data !== null && "id" in data) {
    // safe access
  }
}
```

## Common Pitfalls
- `NodeJS.Timeout` namespace نییە لە browser → بەکارهێنە `ReturnType<typeof setTimeout>`
- Optional param دواتر required param: TS1016 → ڕیزبەندی گۆڕە یان default بدە
- `as const` بۆ literal types: `const colors = ["red", "blue"] as const`

## Build Check
**هەمیشە:** `npm run build`
- `npx tsc --noEmit` فایلی بەشێک پشکنین ناکات
- `tsc -b` (build mode) ئیرۆری زیاتر دەدۆزێتەوە
