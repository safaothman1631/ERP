/**
 * Cross-tenant isolation rules tests (SF4 / T-SF.4.1).
 *
 * Proves that a user whose JWT carries `org_id == ORG_A` can neither read nor
 * write a document that belongs to `ORG_B`, across both rule shapes used by the
 * platform:
 *
 *   1. Nested:  organizations/{orgId}/<collection>/{docId}
 *   2. Root:    <collection>/{docId}  (flat doc with an `org_id` field — the
 *               shape the Python BaseRepository writes)
 *
 * Run with the Firestore emulator:  `npm test`  (see README).
 */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getTestEnv,
  cleanup,
  clearData,
  authedDb,
  anonDb,
  seedDoc,
  assertFails,
  assertSucceeds,
  ORG_A,
  ORG_B,
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

// Collections covered under the nested organizations/{orgId}/... path.
const NESTED_COLLECTIONS = [
  "contacts",
  "items",
  "invoices",
  "quotes",
  "sales_orders",
  "credit_notes",
  "bills",
  "purchase_orders",
  "vendor_credits",
  "expenses",
  "projects",
  "pos_orders",
  "crm_leads",
  "stock_moves",
];

// Collections covered under the flat root path (org_id on the doc).
const ROOT_COLLECTIONS = [
  "invoices",
  "bills",
  "items",
  "contacts",
  "payments_received",
  "payments_made",
  "pos_orders",
];

describe("Nested path: organizations/{orgId}/<collection> cross-tenant denial", () => {
  for (const coll of NESTED_COLLECTIONS) {
    it(`${coll}: Org B cannot READ Org A's document`, async () => {
      const docPath = `organizations/${ORG_A}/${coll}`;
      await seedDoc(docPath, "doc1", { org_id: ORG_A, name: "A secret" });
      const dbB = await authedDb({ uid: "u-b", orgId: ORG_B, role: "admin" });
      await assertFails(dbB.doc(`${docPath}/doc1`).get());
    });

    it(`${coll}: Org B cannot WRITE into Org A's partition`, async () => {
      const dbB = await authedDb({ uid: "u-b", orgId: ORG_B, role: "admin" });
      await assertFails(
        dbB.doc(`organizations/${ORG_A}/${coll}/doc2`).set({ org_id: ORG_A, name: "x" })
      );
    });

    it(`${coll}: Org A CAN read its own document`, async () => {
      const docPath = `organizations/${ORG_A}/${coll}`;
      await seedDoc(docPath, "doc3", { org_id: ORG_A, name: "mine" });
      const dbA = await authedDb({ uid: "u-a", orgId: ORG_A, role: "admin" });
      await assertSucceeds(dbA.doc(`${docPath}/doc3`).get());
    });
  }
});

describe("Root path: <collection> with org_id field cross-tenant denial", () => {
  for (const coll of ROOT_COLLECTIONS) {
    it(`${coll}: Org B cannot READ Org A's flat document`, async () => {
      await seedDoc(coll, `${coll}-A`, { org_id: ORG_A, amount: 100 });
      const dbB = await authedDb({ uid: "u-b", orgId: ORG_B, role: "admin" });
      await assertFails(dbB.doc(`${coll}/${coll}-A`).get());
    });

    it(`${coll}: Org B cannot CREATE a doc stamped with Org A's org_id`, async () => {
      const dbB = await authedDb({ uid: "u-b", orgId: ORG_B, role: "admin" });
      await assertFails(dbB.doc(`${coll}/forge-1`).set({ org_id: ORG_A, amount: 1 }));
    });

    it(`${coll}: Org B cannot UPDATE Org A's doc to steal it`, async () => {
      await seedDoc(coll, `${coll}-A2`, { org_id: ORG_A, amount: 100 });
      const dbB = await authedDb({ uid: "u-b", orgId: ORG_B, role: "admin" });
      await assertFails(
        dbB.doc(`${coll}/${coll}-A2`).set({ org_id: ORG_B, amount: 999 })
      );
    });

    it(`${coll}: Org A CAN read & create its own flat document`, async () => {
      await seedDoc(coll, `${coll}-own`, { org_id: ORG_A, amount: 5 });
      const dbA = await authedDb({ uid: "u-a", orgId: ORG_A, role: "accountant" });
      await assertSucceeds(dbA.doc(`${coll}/${coll}-own`).get());
    });
  }
});

describe("Unauthenticated access is always denied", () => {
  it("anonymous read of a nested contact is denied", async () => {
    await seedDoc(`organizations/${ORG_A}/contacts`, "c1", { org_id: ORG_A });
    const anon = await anonDb();
    await assertFails(anon.doc(`organizations/${ORG_A}/contacts/c1`).get());
  });

  it("anonymous read of a root invoice is denied", async () => {
    await seedDoc("invoices", "inv1", { org_id: ORG_A });
    const anon = await anonDb();
    await assertFails(anon.doc("invoices/inv1").get());
  });

  it("anonymous write is denied", async () => {
    const anon = await anonDb();
    await assertFails(anon.doc("contacts/x").set({ org_id: ORG_A }));
  });
});

describe("Catch-all default-deny", () => {
  it("denies an undeclared nested sub-collection", async () => {
    const dbA = await authedDb({ uid: "u-a", orgId: ORG_A, role: "admin" });
    await assertFails(
      dbA.doc(`organizations/${ORG_A}/totally_unknown_collection/x`).get()
    );
  });

  it("denies an undeclared root collection", async () => {
    const dbA = await authedDb({ uid: "u-a", orgId: ORG_A, role: "admin" });
    await assertFails(dbA.doc("undeclared_root_collection/x").get());
  });
});
