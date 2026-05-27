"""Wave A8 — GL materialisation respects feature flag."""
from app.config import settings


def test_gl_materialisation_disabled_by_default():
    assert getattr(settings, "GL_MATERIALISATION_ENABLED", False) is False
