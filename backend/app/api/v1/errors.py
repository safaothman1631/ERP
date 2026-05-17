"""
RFC 7807 Problem Details error handling for /api/v1/ endpoints.

داواکاری ٧.٩: RFC 7807 Problem Details بۆ هەموو error responses

Reference: https://www.rfc-editor.org/rfc/rfc7807

The Problem Details format:
{
    "type":     "https://erp.example.com/errors/not-found",
    "title":    "Resource Not Found",
    "status":   404,
    "detail":   "Invoice INV-001 was not found",
    "instance": "/api/v1/invoices/INV-001"
}
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError


# ─────────────────────────────────────────────────────────────────────────────
# Base URL for error type URIs
# ─────────────────────────────────────────────────────────────────────────────

_ERROR_BASE_URL = "https://erp.example.com/errors"


# ─────────────────────────────────────────────────────────────────────────────
# Problem Details response builder
# ─────────────────────────────────────────────────────────────────────────────

def problem_detail(
    status: int,
    title: str,
    detail: str,
    type_slug: str,
    instance: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build an RFC 7807 Problem Details dict.

    Args:
        status:     HTTP status code.
        title:      Short, human-readable summary of the problem type.
        detail:     Human-readable explanation specific to this occurrence.
        type_slug:  Slug appended to the base error URL (e.g. "not-found").
        instance:   URI reference identifying the specific occurrence (optional).
        extra:      Additional fields to include in the response (optional).

    Returns:
        dict conforming to RFC 7807.
    """
    body: Dict[str, Any] = {
        "type": f"{_ERROR_BASE_URL}/{type_slug}",
        "title": title,
        "status": status,
        "detail": detail,
    }
    if instance:
        body["instance"] = instance
    if extra:
        body.update(extra)
    return body


def problem_response(
    status: int,
    title: str,
    detail: str,
    type_slug: str,
    instance: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    """Return a JSONResponse with RFC 7807 Problem Details content type."""
    return JSONResponse(
        status_code=status,
        content=problem_detail(status, title, detail, type_slug, instance, extra),
        headers={"Content-Type": "application/problem+json"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Common problem responses
# ─────────────────────────────────────────────────────────────────────────────

def not_found(resource: str, resource_id: str, instance: Optional[str] = None) -> JSONResponse:
    """404 Not Found — RFC 7807 format."""
    return problem_response(
        status=404,
        title="Resource Not Found",
        detail=f"{resource} '{resource_id}' نەدۆزرایەوە",
        type_slug="not-found",
        instance=instance,
    )


def forbidden(detail: str = "دەستگەیشتن ڕەتکراوەتەوە", instance: Optional[str] = None) -> JSONResponse:
    """403 Forbidden — RFC 7807 format."""
    return problem_response(
        status=403,
        title="Forbidden",
        detail=detail,
        type_slug="forbidden",
        instance=instance,
    )


def unauthorized(detail: str = "پشتراستکردنی ناسنامە پێویستە", instance: Optional[str] = None) -> JSONResponse:
    """401 Unauthorized — RFC 7807 format."""
    return problem_response(
        status=401,
        title="Unauthorized",
        detail=detail,
        type_slug="unauthorized",
        instance=instance,
    )


def bad_request(detail: str, instance: Optional[str] = None) -> JSONResponse:
    """400 Bad Request — RFC 7807 format."""
    return problem_response(
        status=400,
        title="Bad Request",
        detail=detail,
        type_slug="bad-request",
        instance=instance,
    )


def conflict(detail: str, instance: Optional[str] = None) -> JSONResponse:
    """409 Conflict — RFC 7807 format."""
    return problem_response(
        status=409,
        title="Conflict",
        detail=detail,
        type_slug="conflict",
        instance=instance,
    )


def unprocessable(detail: str, errors: Optional[list] = None, instance: Optional[str] = None) -> JSONResponse:
    """422 Unprocessable Entity — RFC 7807 format."""
    extra = {"errors": errors} if errors else None
    return problem_response(
        status=422,
        title="Validation Error",
        detail=detail,
        type_slug="validation-error",
        instance=instance,
        extra=extra,
    )


def internal_error(detail: str = "هەڵەی ناوخۆیی سێرڤەر", instance: Optional[str] = None) -> JSONResponse:
    """500 Internal Server Error — RFC 7807 format."""
    return problem_response(
        status=500,
        title="Internal Server Error",
        detail=detail,
        type_slug="internal-server-error",
        instance=instance,
    )


def rate_limited(detail: str = "زۆر داواکاری نێردراوە، کەمێک چاوەڕێ بکە") -> JSONResponse:
    """429 Too Many Requests — RFC 7807 format."""
    return problem_response(
        status=429,
        title="Too Many Requests",
        detail=detail,
        type_slug="rate-limit-exceeded",
    )


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI exception handlers (register on the app)
# ─────────────────────────────────────────────────────────────────────────────

async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Convert FastAPI HTTPException to RFC 7807 Problem Details format."""
    status = exc.status_code
    instance = str(request.url.path)

    # Map common status codes to problem type slugs and titles
    _map = {
        400: ("bad-request", "Bad Request"),
        401: ("unauthorized", "Unauthorized"),
        403: ("forbidden", "Forbidden"),
        404: ("not-found", "Not Found"),
        405: ("method-not-allowed", "Method Not Allowed"),
        409: ("conflict", "Conflict"),
        422: ("validation-error", "Validation Error"),
        429: ("rate-limit-exceeded", "Too Many Requests"),
        500: ("internal-server-error", "Internal Server Error"),
        503: ("service-unavailable", "Service Unavailable"),
    }
    type_slug, title = _map.get(status, (f"http-{status}", f"HTTP {status}"))

    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)

    return JSONResponse(
        status_code=status,
        content=problem_detail(status, title, detail, type_slug, instance),
        headers={"Content-Type": "application/problem+json"},
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Convert Pydantic RequestValidationError to RFC 7807 Problem Details format."""
    instance = str(request.url.path)

    # Format field-level errors
    errors = []
    for error in exc.errors():
        loc = " → ".join(str(l) for l in error.get("loc", []))
        errors.append({
            "field": loc,
            "message": error.get("msg", ""),
            "type": error.get("type", ""),
        })

    body = problem_detail(
        status=422,
        title="Validation Error",
        detail="داواکاری ناسەرکەوتوو بوو بەهۆی هەڵەی validation",
        type_slug="validation-error",
        instance=instance,
        extra={"errors": errors},
    )

    return JSONResponse(
        status_code=422,
        content=body,
        headers={"Content-Type": "application/problem+json"},
    )


def register_error_handlers(app) -> None:
    """Register RFC 7807 error handlers on a FastAPI app instance.

    Call this in main.py after creating the FastAPI app:

        from app.api.v1.errors import register_error_handlers
        register_error_handlers(app)
    """
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
