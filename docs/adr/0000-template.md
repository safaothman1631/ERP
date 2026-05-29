# ADR 0000 — Template

> **Status:** Template — do not change directly. Copy to `NNNN-short-name.md` and edit.

| | |
|---|---|
| **Date** | `YYYY-MM-DD` (the date the decision was made) |
| **Authors** | `<name>` (the person who owns the decision) |
| **Reviewers** | `<name>, <name>` |
| **Status** | `Proposed` / `Accepted` / `Superseded by ADR-NNNN` / `Deprecated` |
| **Supersedes** | (ADR ids this replaces, if any) |
| **Related** | (related ADRs, RFCs, spec sections, tickets) |

## 1. Context

What is the situation that demands a decision? What forces are at play?

* Business drivers — what does the user / company need?
* Technical constraints — what limits the design space (existing tech, team skills, budget, legal)?
* Risks — what happens if we make a poor choice or do nothing?

Be concise. The bullet list should leave any future reader able to evaluate whether the context still holds.

## 2. Decision

A one- or two-sentence statement of what we are doing.

> **We will use \<X\> to achieve \<Y\>.**

Then the implementation outline:

* Concrete steps to take.
* Migration plan, if any.
* Owners.

## 3. Consequences

What becomes easier? What becomes harder? What costs do we accept?

### Positive

* ...

### Negative

* ...

### Neutral / known unknowns

* ...

## 4. Alternatives considered

For each rejected option, write enough that a future reader knows we evaluated it (not skipped it).

### Alternative A — `<name>`

* Pros: ...
* Cons: ...
* Why rejected: ...

### Alternative B — `<name>`

* Pros: ...
* Cons: ...
* Why rejected: ...

## 5. Validation

How will we know the decision was right? What metric, deadline, or smoke test confirms it?

* ...
* ...

## 6. Notes

Anything not captured above — links to chat threads, vendor benchmarks, prior art.

---

*Last reviewed: \<YYYY-MM-DD\> by \<name\>. Set a review reminder if the decision is reversible within 12 months.*
