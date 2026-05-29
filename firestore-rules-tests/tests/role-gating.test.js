/**
 * Role-gating + append-only rules tests (SF4 / T-SF.4.1).
 *
 * Asserts the role-based guards layered on top of tenant isolation:
 *   - HR / payroll collections require an HR-or-above role even for same-org users.
 *   - Audit logs are append-only: no client create/update/delete, admin read only.
 *   - Currencies are world-readable to authenticated users but never writable.
 *   - Accounting collections require accountant-or-above to create.
 *   - Destructive deletes require manager-or-above.
 */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getTestEnv,
  cleanup,
  clearData,
  authedDb,
  seedDoc,
  assertFails,
  assertSucceeds,
  ORG_A,
} from "./helpers.js";

beforeAll(async () => {
  await getTestEnv();
});
afterAll(async () => {
  await cleanup();
});
beforeEach(async () => {
  await clearData();
});

describe("HR & payroll require HR-or-above role (same org)", () => {
  it("a viewer in the org CANNOT read hr_employees", async () => {
    await seedDoc(`organizations/${ORG_A}/hr_employees`, "e1", { org_id: ORG_A, salary: 1000 });
    const viewer = await authedDb({ uid: "v", orgId: ORG_A, role: "viewer" });
    await assertFails(viewer.doc(`organizations/${ORG_A}/hr_employees/e1`).get());
  });

  it("an HR user CAN read hr_employees", async () => {
    await seedDoc(`organizations/${ORG_A}/hr_employees`, "e2", { org_id: ORG_A, salary: 1000 });
    const hr = await authedDb({ uid: "h", orgId: ORG_A, role: "hr" });
    await assertSucceeds(hr.doc(`organizations/${ORG_A}/hr_employees/e2`).get());
  });

  it("a viewer CANNOT read payroll_runs", async () => {
    await seedDoc(`organizations/${ORG_A}/payroll_runs`, "r1", { org_id: ORG_A });
    const viewer = await authedDb({ uid: "v", orgId: ORG_A, role: "viewer" });
    await assertFails(viewer.doc(`organizations/${ORG_A}/payroll_runs/r1`).get());
  });

  it("a non-HR sales user CANNOT create an hr_employee", async () => {
    const sales = await authedDb({ uid: "s", orgId: ORG_A, role: "sales" });
    await assertFails(
      sales.doc(`organizations/${ORG_A}/hr_employees/e3`).set({ org_id: ORG_A })
    );
  });
});

describe("Audit logs are append-only", () => {
  it("admin can READ audit logs", async () => {
    await seedDoc(`organizations/${ORG_A}/audit_logs`, "l1", { org_id: ORG_A, action: "x" });
    const admin = await authedDb({ uid: "a", orgId: ORG_A, role: "admin" });
    await assertSucceeds(admin.doc(`organizations/${ORG_A}/audit_logs/l1`).get());
  });

  it("non-admin CANNOT read audit logs", async () => {
    await seedDoc(`organizations/${ORG_A}/audit_logs`, "l2", { org_id: ORG_A });
    const acct = await authedDb({ uid: "a", orgId: ORG_A, role: "accountant" });
    await assertFails(acct.doc(`organizations/${ORG_A}/audit_logs/l2`).get());
  });

  it("nobody can CREATE an audit log from the client", async () => {
    const admin = await authedDb({ uid: "a", orgId: ORG_A, role: "admin" });
    await assertFails(
      admin.doc(`organizations/${ORG_A}/audit_logs/l3`).set({ org_id: ORG_A })
    );
  });

  it("nobody can UPDATE or DELETE an audit log", async () => {
    await seedDoc(`organizations/${ORG_A}/audit_logs`, "l4", { org_id: ORG_A, action: "x" });
    const admin = await authedDb({ uid: "a", orgId: ORG_A, role: "admin" });
    await assertFails(admin.doc(`organizations/${ORG_A}/audit_logs/l4`).update({ action: "y" }));
    await assertFails(admin.doc(`organizations/${ORG_A}/audit_logs/l4`).delete());
  });

  it("root audit_logs are likewise append-only", async () => {
    await seedDoc("audit_logs", "rl1", { org_id: ORG_A });
    const admin = await authedDb({ uid: "a", orgId: ORG_A, role: "admin" });
    await assertFails(admin.doc("audit_logs/rl1").update({ x: 1 }));
    await assertFails(admin.doc("audit_logs/r2").set({ org_id: ORG_A }));
  });
});

describe("Global currencies: read-only", () => {
  it("authenticated user can read a currency", async () => {
    await seedDoc("currencies", "IQD", { code: "IQD", rate: 1 });
    const u = await authedDb({ uid: "u", orgId: ORG_A, role: "viewer" });
    await assertSucceeds(u.doc("currencies/IQD").get());
  });

  it("nobody can write a currency from the client", async () => {
    const admin = await authedDb({ uid: "a", orgId: ORG_A, role: "admin" });
    await assertFails(admin.doc("currencies/USD").set({ code: "USD" }));
  });
});

describe("Accounting create requires accountant-or-above", () => {
  it("a viewer CANNOT create a journal entry", async () => {
    const viewer = await authedDb({ uid: "v", orgId: ORG_A, role: "viewer" });
    await assertFails(
      viewer.doc(`organizations/${ORG_A}/journal_entries/j1`).set({ org_id: ORG_A })
    );
  });

  it("an accountant CAN create a journal entry", async () => {
    const acct = await authedDb({ uid: "a", orgId: ORG_A, role: "accountant" });
    await assertSucceeds(
      acct.doc(`organizations/${ORG_A}/journal_entries/j2`).set({ org_id: ORG_A })
    );
  });
});

describe("Destructive deletes require manager-or-above", () => {
  it("a plain user CANNOT delete an invoice (nested)", async () => {
    await seedDoc(`organizations/${ORG_A}/invoices`, "i1", { org_id: ORG_A });
    const user = await authedDb({ uid: "u", orgId: ORG_A, role: "accountant" });
    // accountant is below manager for invoice deletion → denied
    await assertFails(user.doc(`organizations/${ORG_A}/invoices/i1`).delete());
  });

  it("a manager CAN delete an invoice (nested)", async () => {
    await seedDoc(`organizations/${ORG_A}/invoices`, "i2", { org_id: ORG_A });
    const mgr = await authedDb({ uid: "m", orgId: ORG_A, role: "manager" });
    await assertSucceeds(mgr.doc(`organizations/${ORG_A}/invoices/i2`).delete());
  });
});
