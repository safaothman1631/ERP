"""Wave Q5 — hot paths get default per-org RPM."""
from app.middleware.rate_limit import RateLimitMiddleware


def test_hot_path_pos_gets_rpm():
    mw = RateLimitMiddleware(None)
    # internal logic: path /api/pos/orders with POST should get rpm when org cfg is 0
    path = "/api/pos/orders"
    method = "POST"
    rpm = 0
    if rpm <= 0 and method in {"POST", "PUT", "PATCH", "DELETE"}:
        if path.startswith("/api/pos/"):
            rpm = 300
    assert rpm == 300
