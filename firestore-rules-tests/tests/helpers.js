/**
 * Shared helpers for Firestore security-rules tests (SF4 / T-SF.4.1).
 *
 * Boots a single RulesTestEnvironment against the emulator, loading the real
 * `firestore.rules` from the repo root. Provides factory helpers for building
 * authenticated contexts whose JWT custom claims (`org_id`, `role`) mirror the
 * claims the backend mints on login (see app/services/auth.py).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.resolve(__dirname, "..", "..", "firestore.rules");
const PROJECT_ID = "zoho-83cda-rules-test";

export const ORG_A = "org-aaaa";
export const ORG_B = "org-bbbb";

let testEnv = null;

/** Lazily create (and cache) the shared RulesTestEnvironment. */
export async function getTestEnv() {
  if (testEnv) return testEnv;
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
  return testEnv;
}

export async function cleanup() {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}

export async function clearData() {
  const env = await getTestEnv();
  await env.clearFirestore();
}

/**
 * Build an authenticated Firestore handle with the given org + role claims.
 * Mirrors the backend's custom-claim shape: { org_id, role }.
 */
export async function authedDb({ uid = "user-1", orgId = ORG_A, role = "admin", extraClaims = {} } = {}) {
  const env = await getTestEnv();
  return env
    .authenticatedContext(uid, { org_id: orgId, role, ...extraClaims })
    .firestore();
}

/** Build an UNauthenticated Firestore handle (no Firebase Auth token). */
export async function anonDb() {
  const env = await getTestEnv();
  return env.unauthenticatedContext().firestore();
}

/** Seed a document with admin privileges (rules bypassed) for read/write setup. */
export async function seedDoc(collectionPath, docId, data) {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`${collectionPath}/${docId}`).set(data);
  });
}

export { assertFails, assertSucceeds };
