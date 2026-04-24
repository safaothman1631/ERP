# Rule: Python

**ALWAYS-FOLLOW**

## Style
- Python 3.11+
- Type hints هەمیشە (`def foo(x: int) -> str`)
- f-strings نا `.format()` نا `%`
- `pathlib.Path` نا `os.path`

## FastAPI
```python
# ✅
@router.post("/items", response_model=Item)
async def create_item(
    payload: ItemCreate,
    user: User = Depends(get_current_user),
) -> Item:
    ...
```

## Error Handling
- Boundary تەنها (API/DB/file/network)
- نا `except Exception:` — type-specific
- HTTPException بۆ API errors (status_code، detail)

## Imports
```python
# ✅ ڕیزبەندی
from __future__ import annotations  # ئەگەر forward refs

# stdlib
import json
from pathlib import Path

# third-party
from fastapi import APIRouter

# local
from app.firestore.base import BaseRepository
```

## ❌ NEVER
- `print()` لە production code (logging بەکار بهێنە)
- `eval()`، `exec()`
- Mutable default arg (`def f(x=[])` ❌)
- Bare `except:`
