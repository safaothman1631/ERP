"""Tests for tools/lint/async_safety.py."""
from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from tools.lint.async_safety import (
    Finding,
    lint_paths,
    lint_source,
    main,
)


class TestLintSource:
    def test_flags_sync_get_inside_async_def(self) -> None:
        src = textwrap.dedent(
            """
            async def fetch():
                doc = db.collection("invoices").document("x").get()
                return doc
            """
        )
        findings = lint_source(src, path="t.py")
        assert len(findings) == 1
        assert ".get" in findings[0].message
        assert findings[0].line == 3

    def test_flags_sync_stream_inside_async_def(self) -> None:
        src = textwrap.dedent(
            """
            async def list_all():
                rows = db.collection("invoices").where("a", "==", 1).stream()
                return list(rows)
            """
        )
        findings = lint_source(src)
        assert any(".stream" in f.message for f in findings)

    def test_does_not_flag_awaited_get(self) -> None:
        src = textwrap.dedent(
            """
            async def fetch():
                doc = await db.collection("invoices").document("x").get()
                return doc
            """
        )
        assert lint_source(src) == []

    def test_does_not_flag_sync_function(self) -> None:
        src = textwrap.dedent(
            """
            def fetch_sync():
                doc = db.collection("invoices").document("x").get()
                return doc
            """
        )
        assert lint_source(src) == []

    def test_does_not_flag_unrelated_get(self) -> None:
        src = textwrap.dedent(
            """
            async def handler(request):
                value = request.headers.get("X-Foo")
                return value
            """
        )
        assert lint_source(src) == []

    def test_flags_chain_through_where_order_by_limit(self) -> None:
        src = textwrap.dedent(
            """
            async def list_them():
                rows = db.collection("invoices").where("a","==",1).order_by("b").limit(50).stream()
                return rows
            """
        )
        findings = lint_source(src)
        assert len(findings) == 1
        assert ".stream" in findings[0].message

    def test_does_not_flag_async_for_stream(self) -> None:
        src = textwrap.dedent(
            """
            async def iter_all():
                async for snap in db.collection("invoices").stream():
                    pass
            """
        )
        assert lint_source(src) == []

    def test_handles_syntax_error(self) -> None:
        src = "async def broken( :\n  pass\n"
        findings = lint_source(src, path="broken.py")
        assert len(findings) == 1
        assert "syntax error" in findings[0].message


class TestLintPaths:
    def test_lints_directory_recursively(self, tmp_path: Path) -> None:
        (tmp_path / "pkg").mkdir()
        (tmp_path / "pkg" / "bad.py").write_text(
            "async def f():\n  x = db.collection('c').document('d').get()\n",
            encoding="utf-8",
        )
        (tmp_path / "pkg" / "good.py").write_text(
            "async def f():\n  x = await db.collection('c').document('d').get()\n",
            encoding="utf-8",
        )
        findings = lint_paths([tmp_path])
        assert len(findings) == 1
        assert findings[0].path.endswith("bad.py")

    def test_skips_venv_and_pycache(self, tmp_path: Path) -> None:
        (tmp_path / "venv").mkdir()
        (tmp_path / "venv" / "in_venv.py").write_text(
            "async def f():\n  x = db.collection('c').document('d').get()\n",
            encoding="utf-8",
        )
        assert lint_paths([tmp_path]) == []


class TestCLI:
    def test_check_returns_nonzero_on_findings(self, tmp_path, capsys):
        f = tmp_path / "bad.py"
        f.write_text(
            "async def x():\n  db.collection('c').document('d').get()\n",
            encoding="utf-8",
        )
        rc = main([str(tmp_path), "--check"])
        out = capsys.readouterr().out
        assert rc == 1
        assert "bad.py" in out

    def test_returns_zero_with_no_findings(self, tmp_path, capsys):
        f = tmp_path / "ok.py"
        f.write_text("async def x():\n  pass\n", encoding="utf-8")
        rc = main([str(tmp_path), "--check"])
        assert rc == 0


def test_finding_format_gnu():
    f = Finding(path="a/b.py", line=3, col=4, message="msg")
    assert f.format_gnu() == "a/b.py:3:4: warning: msg"
