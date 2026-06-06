"""Pool 3.4 perpetual valuation — pure cost engine (FIFO + moving average)."""
from app.services import valuation as V


# ── FIFO ──────────────────────────────────────────────────────────

def test_fifo_single_layer():
    layers = V.fifo_receive([], 10, 5.0)
    cogs, rem, short = V.fifo_issue(layers, 4)
    assert cogs == 20.0  # 4 @ 5
    assert V.fifo_qty(rem) == 6.0
    assert short == 0.0


def test_fifo_consumes_oldest_first():
    # 10 @ 5 then 10 @ 7; issue 15 -> 10@5 + 5@7 = 50 + 35 = 85
    layers = V.fifo_receive(V.fifo_receive([], 10, 5.0), 10, 7.0)
    cogs, rem, short = V.fifo_issue(layers, 15)
    assert cogs == 85.0
    assert V.fifo_qty(rem) == 5.0          # 5 left, all from the 7.0 layer
    assert V.fifo_value(rem) == 35.0       # 5 @ 7
    assert short == 0.0


def test_fifo_oversell_reports_short():
    layers = V.fifo_receive([], 5, 5.0)
    cogs, rem, short = V.fifo_issue(layers, 8)
    assert cogs == 25.0          # only 5 available
    assert V.fifo_qty(rem) == 0.0
    assert short == 3.0          # 3 not covered


# ── Moving average ────────────────────────────────────────────────

def test_avg_weighted_cost_and_issue():
    s = V.avg_receive(V.avg_receive(V.avg_state(), 10, 5.0), 10, 7.0)
    assert V.avg_unit_cost(s) == 6.0       # (50 + 70) / 20
    cogs, s2, short = V.avg_issue(s, 15)
    assert cogs == 90.0                     # 15 @ 6
    assert s2["qty"] == 5.0
    assert s2["value"] == 30.0              # 120 - 90
    assert V.avg_unit_cost(s2) == 6.0       # avg unchanged by an issue
    assert short == 0.0


def test_avg_receive_changes_average():
    s = V.avg_receive(V.avg_state(), 10, 5.0)      # avg 5
    s = V.avg_receive(s, 30, 9.0)                  # (50 + 270)/40 = 8
    assert V.avg_unit_cost(s) == 8.0


def test_avg_oversell_reports_short():
    s = V.avg_receive(V.avg_state(), 5, 4.0)
    cogs, s2, short = V.avg_issue(s, 8)
    assert cogs == 20.0          # 5 @ 4
    assert s2["qty"] == 0.0
    assert short == 3.0


# ── Dispatch + edges ──────────────────────────────────────────────

def test_dispatch_matches_direct():
    fifo_layers = V.receive(V.FIFO, [], 10, 5.0)
    assert V.issue_cogs(V.FIFO, fifo_layers, 4)[0] == 20.0
    avg = V.receive(V.AVERAGE, V.avg_state(), 10, 5.0)
    assert V.issue_cogs(V.AVERAGE, avg, 4)[0] == 20.0


def test_zero_and_empty():
    assert V.fifo_issue([], 5) == (0.0, [], 5.0)
    assert V.avg_issue(V.avg_state(), 5)[0] == 0.0
    assert V.fifo_receive([], 0, 5.0) == []
