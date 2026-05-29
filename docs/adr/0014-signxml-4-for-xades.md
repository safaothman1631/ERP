# ADR 0014 — Pin `signxml>=4.0` (pyOpenSSL-free) for e-Fakhata XAdES signing

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Backend lead, Security review |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.kiro/specs/growth-to-100` §R4 (G4a); `backend/app/efakhata/signing.py`; `backend/requirements.txt`; `_deltas/G4a-deps.md`; ADR-0001 (Firestore) |

## 1. Context

The Iraq Ministry of Finance (MoF) e-Fakhata e-invoicing programme requires
each submitted invoice XML to carry an **XAdES-BES** (ETSI Basic Electronic
Signature) — the most permissive XAdES profile, sufficient for the MoF's
"signed by an X.509 cert chained to a recognised CA" requirement. We
implemented the signer in `backend/app/efakhata/signing.py`.

The de-facto Python library for W3C XML-DSig + ETSI XAdES is **`signxml`**
(it builds on `lxml`). When we wired it in, the natural pin from the spec was
`signxml>=3.2,<4.0`. That pin caused a problem in our environment:

* `signxml` **3.x** imports **`pyOpenSSL`** at module load. `pyOpenSSL` pins a
  narrow band of `cryptography`, and that band collided with the
  `cryptography` version our **Fernet field-encryption** layer
  (`FIELD_ENCRYPTION_KEY`) and `google-cloud-*` SDKs already resolve to. The
  result was an unsatisfiable resolver graph on a clean `pip install`.
* `pyOpenSSL` is an OpenSSL-binding layer we otherwise don't use — we have no
  desire to take on a second TLS/crypto binding (and its CVE surface) purely as
  a transitive import of an XML library.
* The signing module is **import-guarded** (`_load_signxml()` raises a clear
  `RuntimeError` if the lib is absent) and the e-Fakhata routers are mounted
  inside a `try/except` in `main.py`, so a resolver failure here doesn't crash
  the whole app — but it does silently disable the compliance feature, which is
  worse than a loud build failure.

`signxml` **4.x** dropped the hard `pyOpenSSL` dependency: it talks to
`cryptography` directly. It also changed two API behaviours our code already
accommodates (it *appends* a fresh `<ds:Signature>` rather than filling a
placeholder, and it stamps the XAdES `SigningTime` itself).

## 2. Decision

**We pin `signxml>=4.0,<5.0` in `backend/requirements.txt`, deliberately
above the spec's suggested `<4.0` ceiling, to get the pyOpenSSL-free line.**

The requirements file carries an inline note recording *why* the pin deviates
from the spec, so a future dependency sweep doesn't "helpfully" downgrade it:

```python
# NOTE: signxml is pinned >=4.0 (not the spec's <4.0) because signxml 3.x imports
# pyOpenSSL (which pins an incompatible cryptography band vs our Fernet + GCP SDKs).
# 4.x talks to `cryptography` directly. See ADR-0014.
signxml>=4.0,<5.0
```

`signing.py` is written against the 4.x behaviour:

* It signs with `XAdESSigner` and tolerates the appended-signature shape.
* It **falls back to plain XML-DSig** (`XMLSigner`) when the XAdES extras
  aren't importable, so a partial install still produces a signed (if not
  XAdES-profiled) document rather than throwing.
* Verification (`XAdESVerifier` / `XMLVerifier`) mirrors the same fallback.

## 3. Consequences

### Positive

* One crypto binding (`cryptography`), not two. Smaller attack surface, simpler
  resolver graph, fewer CVE feeds to watch.
* `pip install -r requirements.txt` resolves cleanly alongside the Fernet
  encryption layer and the Google Cloud SDKs.
* We stay on a maintained `signxml` line (4.x) rather than a frozen 3.x.

### Negative

* We diverge from the spec's stated pin, which is a small documentation debt —
  paid here, in this ADR and the inline comment.
* 4.x's API differences (appended signature node, library-stamped
  `SigningTime`) mean the signer code is coupled to the 4.x shape; a future
  5.x bump needs a re-read of `signing.py` (the `<5.0` ceiling forces that
  review).

### Neutral / known unknowns

* The MoF has not published a machine-checkable XAdES schema we can validate
  against in CI. Until it does, several spots in the e-Fakhata code carry
  `# TODO: verify against published spec (R7.x)` markers. The *signing
  mechanism* is sound; the *envelope details* (canonicalisation profile,
  required XAdES qualifying properties) may need tuning when the spec lands.

## 4. Alternatives considered

### Alternative A — Stay on `signxml>=3.2,<4.0`

* **Pros:** matches the spec's original pin verbatim.
* **Cons:** drags in `pyOpenSSL`; unsatisfiable against our `cryptography` pin;
  second crypto binding to maintain.
* **Why rejected:** the dependency conflict is real and the second binding is
  pure liability.

### Alternative B — Hand-roll XAdES with `lxml` + `cryptography`

* **Pros:** zero third-party XML-signature dependency; total control.
* **Cons:** XML canonicalisation (C14N) and XAdES qualifying-properties
  construction are notoriously easy to get subtly wrong; a malformed signature
  is rejected by the MoF and we'd own every edge case forever.
* **Why rejected:** signing crypto is exactly the kind of thing you should not
  hand-roll. `signxml` is audited and widely used.

### Alternative C — `xmlsec` (the `python-xmlsec` binding to libxmlsec1)

* **Pros:** very fast (C library); mature.
* **Cons:** requires a system `libxmlsec1` + `libxml2` at a compatible version
  inside the Cloud Run image; XAdES support is thinner; native build adds
  cold-start image weight (a real budget — see the cold-start runbook).
* **Why rejected:** native system-lib dependency complicates the container and
  the dev setup for marginal benefit at our submission volume.

## 5. Validation

We will know we made the right call if:

* `pip install -r backend/requirements.txt` resolves with no conflict on a
  clean environment (CI's backend job is the canary).
* `backend/tests/test_efakhata_signing.py` passes: sign → verify round-trip,
  plus a tamper test that flips a byte and asserts verification fails.
* The e-Fakhata routers mount cleanly at startup (the `main.py` `try/except`
  logs "Mounted e-Fakhata routers (G4a)", not the warning branch).
* No `pyOpenSSL` appears in `pip freeze`.

Revisit if: the MoF publishes a profile requiring a feature only present in a
`signxml` 5.x, or `signxml` 4.x falls out of maintenance.

## 6. Notes

* The cert/key never touches the repo: PKCS#12 material lives in GCP Secret
  Manager (`tenant-{tid}-efakhata-cert`) with an in-process dev fallback
  (`EFAKHATA_LOCAL_CERT_STORE=1`). `signing.py` is explicit that the P12 bytes
  and password are **never** logged.
* Dependency provenance and the full G4a dep list are in
  `_deltas/G4a-deps.md`.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: when the MoF XAdES spec is published, or on a `signxml` 5.x bump.*
