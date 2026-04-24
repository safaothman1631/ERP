# Skill: Firestore Patterns

## BaseRepository
هەموو فایل لە `backend/app/firestore/base.py`:

```python
class BaseRepository:
    collection_name: str

    def __init__(self, db, org_id: str):
        self.db = db
        self.org_id = org_id

    @property
    def col(self):
        return self.db.collection(self.collection_name)

    def list(self) -> list[dict]:
        docs = self.col.where("org_id", "==", self.org_id).stream()
        return [d.to_dict() | {"id": d.id} for d in docs]
```

## ⚠️ هیچ Composite Index نا
کێشە: Firestore composite indexes پێویستی بە setup ـی manual هەیە.
چارەسەر: **هەموو filtering لە Python** بکە:

```python
# ✅
items = repo.list()  # تەنها org_id فیلتەری
filtered = [i for i in items if i["status"] == "active" and i["price"] > 100]

# ❌
self.col.where("org_id", "==", x).where("status", "==", "active").where("price", ">", 100)
# ↑ Composite index داوا دەکات
```

## org_id Scoping
هەر document پێویستە `org_id` فیلدی هەبێت. هەموو read/write فیلتەر دەکرێت.

## Batch Operations
```python
batch = self.db.batch()
for doc_id in ids:
    batch.update(self.col.document(doc_id), {"status": "paid"})
batch.commit()
```

## Sequence Numbers
```python
# ✅ Correct method
seq_repo.get_next("invoice")  # → "INV-00042"

# ❌ Wrong
seq_repo.next("invoice")  # AttributeError
```

## Transactions
```python
@firestore.transactional
def update_balance(txn, account_ref, amount):
    snap = account_ref.get(transaction=txn)
    new_balance = snap.get("balance") + amount
    txn.update(account_ref, {"balance": new_balance})
```
