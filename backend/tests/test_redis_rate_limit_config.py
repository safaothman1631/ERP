"""H2: Redis storage URI wiring for slowapi limiter."""


def test_settings_has_redis_and_search_fields():
    from app.config import Settings

    s = Settings()
    assert hasattr(s, "RATE_LIMIT_STORAGE_URI")
    assert hasattr(s, "SEARCH_PREFIX_ENABLED")
    assert s.RATE_LIMIT_STORAGE_URI == "" or isinstance(s.RATE_LIMIT_STORAGE_URI, str)


def test_build_limiter_passes_storage_uri_kwarg():
    from unittest.mock import MagicMock, patch

    with patch("app.middleware.rate_limit.settings") as mock_settings:
        mock_settings.RATE_LIMITING_ENABLED = True
        mock_settings.DEFAULT_RATE_LIMIT = "100/minute"
        mock_settings.RATE_LIMIT_STORAGE_URI = "redis://127.0.0.1:6379/0"
        with patch("app.middleware.rate_limit.Limiter") as MockLimiter:
            MockLimiter.return_value = MagicMock()
            from app.middleware.rate_limit import _build_limiter

            _build_limiter()
            _, kwargs = MockLimiter.call_args
            assert kwargs.get("storage_uri") == "redis://127.0.0.1:6379/0"
