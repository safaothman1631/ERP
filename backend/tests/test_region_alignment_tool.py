"""G5 region alignment script."""

import subprocess
import sys
from pathlib import Path


def test_verify_region_alignment_exits_zero():
    root = Path(__file__).resolve().parents[2]
    script = root / "tools" / "verify_region_alignment.py"
    proc = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(root),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
