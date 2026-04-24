# Skill: Python Patterns

## Type Hints
- هەمیشە type hint بۆ function signature + return type
- `from __future__ import annotations` لە ڕاسەری فایل بۆ forward refs
- Generic: `list[int]` نا `List[int]` (Python 3.9+)

## Pydantic v2
```python
from pydantic import BaseModel, Field, field_validator

class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0)

    @field_validator("name")
    @classmethod
    def trim(cls, v: str) -> str:
        return v.strip()
```

## Async
- I/O bound: `async def` + `await`
- CPU bound: `asyncio.to_thread(...)` یان `ProcessPoolExecutor`
- Blocking لە async: ❌

## Dataclass
بۆ data containers بێ validation:
```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Money:
    amount: int  # cents
    currency: str
```

## Context Manager
```python
from contextlib import contextmanager

@contextmanager
def transaction():
    txn = db.begin()
    try:
        yield txn
        txn.commit()
    except Exception:
        txn.rollback()
        raise
```

## ❌ Anti-patterns
- Mutable default args: `def f(x=[])`
- `except Exception` بێ re-raise
- `from x import *`
- `time.sleep()` لە async
