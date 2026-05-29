# Security at Kurdish ERP

**DRAFT — pending licensed-counsel review (T-SF.2.x).** This is a customer-facing
security overview draft. Claims below describe controls that are implemented or
in progress; they are **not** a warranty, certification, or legal commitment.
Final copy and any compliance claims must be reviewed by counsel and a security
lead before publication (target home: marketing `/legal/security`).

---

Your business data is the heart of your company. We build Kurdish ERP so you can
trust it with your invoices, your customers, your payroll, and your cash. This
page explains, in plain language, how we protect it.

## Tenant isolation — your data is yours alone

Kurdish ERP is multi-tenant: many businesses use the same platform, but **no
business can ever see another's data.** Every record is stamped with your
organization's ID, and every request is checked against the organization in your
signed login token — at **two independent layers**:

- **Application layer.** Our API resolves your data strictly from your own
  organization context, never from anything the browser sends in a URL. A
  request for a record that isn't yours returns "not found."
- **Database layer.** Even direct database access is governed by security rules
  that deny any read or write crossing an organization boundary, with a
  deny-by-default rule for anything not explicitly allowed.

Both layers are covered by an automated cross-tenant test suite that runs in our
pipeline, plus a written line-by-line audit of the database rules.

## Encryption

- **In transit:** all traffic is encrypted with TLS (HTTPS). We enforce HTTPS
  with HSTS and redirect any plain-HTTP request.
- **At rest:** data stored in Google Cloud is encrypted at rest by default.
  Sensitive personal fields (e.g. certain HR/payroll data) receive an additional
  application-level encryption layer.

## Authentication & access control

- **Strong passwords** are enforced (length + complexity, common-password
  rejection).
- **Two-factor authentication (2FA)** is available to all accounts.
- **Role-based access control (RBAC):** permissions are scoped by role
  (e.g. cashier, accountant, HR, manager, admin), so people see only what their
  job requires. Sensitive areas like payroll require an HR-or-above role.
- **Session security:** login tokens are short-lived and individually
  revocable; logout, password change, and admin action immediately invalidate
  sessions. Repeated failed logins from an address are blocked automatically.
- **Support access is read-only and audited.** When our support team needs to
  view your account to help you, that session is strictly read-only and every
  action is recorded.

## Application security

- **CSRF protection:** state-changing requests are protected with strict-mode
  cookies and a token check.
- **Input hardening:** inputs are sanitized against common injection and
  cross-site-scripting attacks.
- **Secure file uploads:** uploads are validated by size, type allowlist, and a
  file-signature check, with optional malware scanning.
- **Rate limiting** protects the platform against abuse and brute-force attempts.
- **Security headers** (Content-Security-Policy, X-Frame-Options, and more) are
  applied to every response.
- **Secret scanning:** our pipeline scans every change for accidentally
  committed credentials before it can merge.

## Auditability & integrity

Every important action is written to a **tamper-evident audit log** built as a
cryptographic hash chain — any attempt to alter history is detectable. Audit
logs cannot be edited or deleted from the application, and are visible to your
administrators.

## Reliability & backups

- Customer data is hosted on **Google Cloud**.
- We maintain automated backups and point-in-time recovery, with documented
  recovery objectives and a disaster-recovery runbook that we rehearse on a
  regular cadence.

## Privacy & your rights

- You can **export** and **delete** your data. We support data-subject requests
  (access, correction, export, deletion).
- We use **privacy-respecting analytics** by default and load marketing
  analytics only with your consent.
- We do **not** sell your data.
- See our [Privacy Policy](/legal/privacy) and
  [Data Processing Agreement](/legal/dpa) for details. (Both are being finalized
  with counsel.)

## Incident response

We maintain a written **Security Incident Response Plan** with defined
severities, roles, and breach-notification procedures. In the event of a
confirmed personal-data breach affecting your data, we will notify you in line
with our Data Processing Agreement and applicable law.

## Responsible disclosure

Found a security issue? We want to hear from you. Email
**security@zoho-kurdish.iq** with the details and steps to reproduce. We
acknowledge reports within two business days and will work with you on a fix.
Please give us reasonable time to remediate before any public disclosure, and do
not access or modify data that isn't yours while testing.

## On our roadmap

We are continuously improving. Items in progress include an independent
third-party penetration test, a formal compliance program (e.g. SOC 2), and a
public bug-bounty program. We will update this page as those milestones land.

---

*Questions about security? Contact **security@zoho-kurdish.iq**.*

*This page is a draft pending review by a security lead and qualified counsel.
Nothing on this page constitutes a contractual warranty or a certification.*
