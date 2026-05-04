# SKILL: Phase Gate (Never Stop Until Done)

> این اصلی‌ترین قاعده کاری Brain است — هیچ phase بدون verification skip نمی‌شود.

## ساختار هر Phase

```yaml
phase_id: <number>
name: <name>
owner_agent: <agent>
inputs:
  - <previous-phase-output>
deliverables:
  - <file-or-feature>
acceptance_criteria:
  - criterion 1
  - criterion 2
test_plan:
  - test 1
  - test 2
checker_agent: <checker>
status: not-started | in-progress | completed | failed
```

## Phase Gate Process

```
START PHASE
  ↓
Owner agent executes
  ↓
Owner reports back to Brain
  ↓
Brain calls Checker agent
  ↓
Checker reviews & reports
  ↓
ALL CRITERIA MET? ──── NO ──→ Back to Planner (re-plan)
  ↓ YES
Brain marks phase complete
  ↓
NEXT PHASE
```

## Loop Termination

Brain stops only when:
1. ✅ All phases status = "completed"
2. ✅ Tester report = "all pass"
3. ✅ Auditor verdict = "PASS"

If ANY of these fail → Brain re-enters loop:
- new phase added by Planner
- old phase re-executed
- never gives up

## Anti-Patterns (don't do)

- ❌ marking phase done without checker sign-off
- ❌ skipping test plan
- ❌ ignoring "warning" findings
- ❌ partial commits
- ❌ silent failure
