"""B5 firestore audit script."""

import subprocess
import sys
from pathlib import Path


def test_firestore_audit_exits_zero():
    root = Path(__file__).resolve().parents[2]
    script = root / "tools" / "firestore_audit.py"
    proc = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(root),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    assert (root / "audit" / "FIRESTORE_AUDIT.md").exists()
