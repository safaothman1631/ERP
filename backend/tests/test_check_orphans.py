"""Wave R8 — orphan scanner CLI smoke."""
import subprocess
import sys
from pathlib import Path


def test_check_orphans_help():
    script = Path(__file__).resolve().parents[1] / "scripts" / "check_orphans.py"
    proc = subprocess.run(
        [sys.executable, str(script), "--help"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert proc.returncode == 0
    assert "--org-id" in proc.stdout
