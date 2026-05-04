# SKILL: OWASP Top 10 Quick Reference

## Web Top 10 (2021)
| ID | Risk | Quick Check |
|----|------|-------------|
| A01 | Broken Access Control | IDOR، missing auth checks |
| A02 | Cryptographic Failures | HTTP، MD5، plain passwords |
| A03 | Injection | SQL، XSS، command، NoSQL |
| A04 | Insecure Design | Missing rate limit، threat model gap |
| A05 | Security Misconfig | Default creds، error stacks، open S3 |
| A06 | Vulnerable Components | Old npm، unmaintained libs |
| A07 | Auth Failures | Weak passwords، predictable tokens |
| A08 | Data Integrity Failures | No SRI، unsigned updates |
| A09 | Logging Failures | No logs، no alerts |
| A10 | SSRF | User-supplied URLs بێ allowlist |

## API Top 10 (2023)
| ID | Risk |
|----|------|
| API1 | BOLA (object-level auth) |
| API2 | Broken Authentication |
| API3 | Property-level auth |
| API4 | Resource consumption |
| API5 | Function-level auth |
| API6 | Sensitive business flows |
| API7 | SSRF |
| API8 | Misconfig |
| API9 | Inventory mgmt |
| API10 | Unsafe API consumption |

## Quick Mitigations
- **Access control** — default deny، centralized
- **Crypto** — argon2/bcrypt for passwords، AES-GCM، TLS 1.3
- **Injection** — parameterized queries، escape output، CSP
- **Components** — Renovate/Dependabot، SBOM
- **Auth** — passkeys، MFA، rate limit، lockout
- **SSRF** — URL allowlist، block private IPs، disable redirects
