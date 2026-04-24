# Rule: Code Patterns

**ALWAYS-FOLLOW**

## Backend Pattern: BaseRepository
هەموو دەستکاری Firestore لە subclass ـی `backend/app/firestore/base.py`:

```python
class FooRepository(BaseRepository):
    collection_name = "foos"
    # هەموو filtering لە Python — نا composite indexes
```

## Backend Pattern: API Route Order
لە FastAPI، static path پێش parameterized:

```python
# ✅ Correct
@router.get("/orders/search")     # static
@router.get("/orders/quotations") # static
@router.get("/orders/{order_id}") # parameterized — کۆتا

# ❌ Wrong — search و quotations لە {order_id} ـدا دەخوێنرێنەوە
```

## Backend Pattern: Sequence
```python
# ✅ Correct
seq_repo.get_next("pos_order")

# ❌ Wrong (لابرا)
seq_repo.next("pos_order")
```

## Frontend Pattern: AntD 6 Divider
```tsx
// ✅ Correct
<Divider titlePlacement="start">عنوان</Divider>

// ❌ Wrong (لابرا لە v6.3+)
<Divider orientation="left">عنوان</Divider>
```

## Frontend Pattern: AntD 6 Tag
```tsx
// ✅
<Tag color="blue">label</Tag>

// ❌ — `size` لە v6 ـدا لابراوە
<Tag size="small" color="blue">label</Tag>
```

## Frontend Pattern: Layout
```tsx
// ✅ — AppLayout ـی Zoho هیچ `title` propـی نییە
<AppLayout>
  <PageHeader title="..." />
  <Content>...</Content>
</AppLayout>

// ❌
<AppLayout title="...">...</AppLayout>
```

## i18n
هەموو string ـی پیشاندراو پێویستە لە `frontend/src/locales/{en,ku}.json` بێت.
هیچ hardcoded string لە JSX نا.
