// _shared.js — common helpers for the k6 load suite.
//
// Spec: design.md §8.3, requirements.md §5 (SLOs).
//
// All scripts pull base URL + credentials from environment variables so
// the same files run locally and in CI:
//
//   K6_BASE_URL          (required)  Cloud Run / staging base URL.
//   K6_USER_EMAIL        (required)  test user that exists in the target env.
//   K6_USER_PASSWORD     (required)  no default is shipped; login() fails fast if unset.
//   K6_TENANT_ID         (optional)  X-Tenant-Id header value.
//   K6_DURATION_OVERRIDE (optional)  e.g. "2m" to shorten a sustained stage.

import http from 'k6/http';
import { check, fail } from 'k6';

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:8000';
// No credential defaults are shipped: a hardcoded fallback in a committed file
// is a known-credential risk. Both are required and validated in login().
const EMAIL = __ENV.K6_USER_EMAIL || '';
const PASSWORD = __ENV.K6_USER_PASSWORD || '';
const TENANT_ID = __ENV.K6_TENANT_ID || '';

export { BASE_URL, EMAIL, PASSWORD, TENANT_ID };

/** Apply a duration override from K6_DURATION_OVERRIDE to every stage. */
export function applyDurationOverride(stages) {
  const ov = __ENV.K6_DURATION_OVERRIDE;
  if (!ov) return stages;
  return stages.map((s) => ({ ...s, duration: ov }));
}

/**
 * Standard thresholds per requirements.md §5.
 *
 *   class     p95    err-rate
 *   read-1    150ms  < 0.1%
 *   read-N    300ms  < 0.1%
 *   write-1   350ms  < 0.2%
 *   pos-co    400ms  < 0.05%
 *   report    1500ms < 0.5%
 */
export const THRESHOLDS = {
  'read-1':  { 'http_req_duration': ['p(95)<150'], 'http_req_failed': ['rate<0.001'] },
  'read-N':  { 'http_req_duration': ['p(95)<300'], 'http_req_failed': ['rate<0.001'] },
  'write-1': { 'http_req_duration': ['p(95)<350'], 'http_req_failed': ['rate<0.002'] },
  'pos-co':  { 'http_req_duration': ['p(95)<400'], 'http_req_failed': ['rate<0.0005'] },
  'report':  { 'http_req_duration': ['p(95)<1500'], 'http_req_failed': ['rate<0.005'] },
};

/** Login once during `setup()`; return a token reused by VUs. */
export function login() {
  if (!EMAIL || !PASSWORD) {
    fail('K6_USER_EMAIL and K6_USER_PASSWORD are required (no default credential is shipped). Set them in the environment.');
  }
  const url = `${BASE_URL}/api/auth/login`;
  const res = http.post(url, JSON.stringify({ email: EMAIL, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'auth_login' },
  });
  const ok = check(res, {
    'login 200': (r) => r.status === 200,
    'login has token': (r) => !!r.json('access_token') || !!r.json('token'),
  });
  if (!ok) {
    fail(`login failed: status=${res.status} body=${res.body && res.body.slice(0, 200)}`);
  }
  const token = res.json('access_token') || res.json('token');
  return { token, tenantId: TENANT_ID };
}

/** Standard headers for an authed request. */
export function authHeaders(auth) {
  const h = {
    'Authorization': `Bearer ${auth.token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (auth.tenantId) h['X-Tenant-Id'] = auth.tenantId;
  return h;
}

/**
 * Helper: GET with checks and a tagged name (so the summary buckets by route).
 */
export function authedGet(auth, path, name) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: authHeaders(auth),
    tags: { name },
  });
  check(res, {
    [`${name} 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  return res;
}

/** Helper: POST with JSON body. */
export function authedPost(auth, path, body, name) {
  const res = http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: authHeaders(auth),
    tags: { name },
  });
  check(res, {
    [`${name} 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  return res;
}

/** Build a deterministic-per-VU id for write tests. */
export function vuId(prefix) {
  const vu = __VU || 0;
  const iter = __ITER || 0;
  return `${prefix}-${vu}-${iter}-${Date.now()}`;
}
