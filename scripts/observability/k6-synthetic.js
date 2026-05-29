// =============================================================================
// k6-synthetic.js — Nightly synthetic user journey against PRODUCTION
// =============================================================================
// T-SF.5.10. A read-mostly "golden path" that exercises the endpoints a real
// user hits on login → home → browse → POS, asserts the production SLOs from
// scripts/slo-thresholds.json, and (when configured) ships per-request metrics
// to Cloud Monitoring so the synthetic latency lands next to the RUM/field
// data on dashboard D1/D3.
//
// SAFETY: this runs against production, so it is strictly READ-ONLY by default.
// The single optional write path (create+delete a probe contact) only runs when
// SYNTHETIC_ALLOW_WRITES=1 AND a dedicated synthetic tenant is configured, so a
// nightly probe never pollutes a real merchant's books.
//
// Env (see .github/workflows/k6-nightly.yml):
//   K6_BASE_URL              (required) production API base, e.g. https://api.zoho-kurdish.iq
//   SYNTHETIC_EMAIL          (required) dedicated synthetic-monitoring user
//   SYNTHETIC_PASSWORD       (required)
//   SYNTHETIC_TENANT_ID      (optional) X-Company-Id / X-Tenant-Id to scope reads
//   SYNTHETIC_ALLOW_WRITES   (optional) "1" to enable the create+delete probe
//   K6_VUS                   (optional) virtual users (default 1 — it's a probe)
//   K6_DURATION              (optional) total duration (default 1m)
// =============================================================================

import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = (__ENV.K6_BASE_URL || '').replace(/\/+$/, '');
const EMAIL = __ENV.SYNTHETIC_EMAIL || '';
const PASSWORD = __ENV.SYNTHETIC_PASSWORD || '';
const TENANT_ID = __ENV.SYNTHETIC_TENANT_ID || '';
const ALLOW_WRITES = __ENV.SYNTHETIC_ALLOW_WRITES === '1';

// Custom metrics so each journey step is separable in the k6 summary + any
// downstream output (Cloud Monitoring / Prometheus remote-write).
const journeyDuration = new Trend('synthetic_journey_duration_ms', true);
const stepFailRate = new Rate('synthetic_step_failed');

// SLO thresholds mirror scripts/slo-thresholds.json. k6 fails the run (non-zero
// exit) on breach, which the nightly workflow turns into an alert.
export const options = {
  vus: Number(__ENV.K6_VUS || 1),
  duration: __ENV.K6_DURATION || '1m',
  thresholds: {
    // read-single class
    'http_req_duration{step:health}': ['p(95)<150'],
    'http_req_duration{step:version}': ['p(95)<150'],
    'http_req_duration{step:auth_me}': ['p(95)<400'],
    // read-list class
    'http_req_duration{step:items_list}': ['p(95)<300'],
    'http_req_duration{step:invoices_list}': ['p(95)<300'],
    'http_req_duration{step:contacts_list}': ['p(95)<300'],
    'http_req_duration{step:pos_products}': ['p(95)<400'],
    // report class
    'http_req_duration{step:dashboard}': ['p(95)<1500'],
    // global
    http_req_failed: ['rate<0.01'],
    synthetic_step_failed: ['rate<0.01'],
    synthetic_journey_duration_ms: ['p(95)<6000'],
  },
};

function authHeaders(token) {
  const h = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    // Mark synthetic traffic so it can be filtered out of business metrics.
    'X-Synthetic-Probe': '1',
  };
  if (TENANT_ID) {
    h['X-Company-Id'] = TENANT_ID;
    h['X-Tenant-Id'] = TENANT_ID;
  }
  return h;
}

/** GET with a step tag + checks; records the step fail-rate. */
function step(token, path, name, expect = 200) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: authHeaders(token),
    tags: { step: name },
  });
  const ok = check(res, {
    [`${name} status ${expect}`]: (r) => r.status === expect,
  });
  stepFailRate.add(!ok);
  return res;
}

export function setup() {
  if (!BASE_URL) fail('K6_BASE_URL is required.');
  if (!EMAIL || !PASSWORD) fail('SYNTHETIC_EMAIL / SYNTHETIC_PASSWORD are required.');

  // Pre-auth liveness probes (no token).
  const health = http.get(`${BASE_URL}/api/health`, { tags: { step: 'health' } });
  check(health, { 'health 200': (r) => r.status === 200 });

  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { step: 'login' } },
  );
  const loggedIn = check(login, {
    'login 200': (r) => r.status === 200,
    'login returns token': (r) => !!(r.json('access_token') || r.json('token')),
  });
  if (!loggedIn) {
    fail(`login failed: status=${login.status} body=${(login.body || '').slice(0, 200)}`);
  }
  const token = login.json('access_token') || login.json('token');
  return { token };
}

export default function (data) {
  const token = data.token;
  const journeyStart = Date.now();

  group('liveness', () => {
    step(token, '/api/health', 'health');
    step(token, '/api/version', 'version');
  });

  group('session', () => {
    step(token, '/api/auth/me', 'auth_me');
  });

  group('browse', () => {
    step(token, '/api/items?limit=20', 'items_list');
    step(token, '/api/invoices?limit=20', 'invoices_list');
    step(token, '/api/contacts?limit=20', 'contacts_list');
    sleep(0.3);
    step(token, '/api/dashboard/summary', 'dashboard');
  });

  group('pos', () => {
    step(token, '/api/pos/products?limit=50', 'pos_products');
  });

  // Optional, tightly-gated write probe. Creates then immediately deletes a
  // throwaway contact in the synthetic tenant only.
  if (ALLOW_WRITES && TENANT_ID) {
    group('write_probe', () => {
      const create = http.post(
        `${BASE_URL}/api/contacts`,
        JSON.stringify({
          name: `synthetic-probe-${Date.now()}`,
          type: 'customer',
          email: 'synthetic-probe@monitoring.invalid',
        }),
        { headers: authHeaders(token), tags: { step: 'contact_create' } },
      );
      const created = check(create, {
        'contact create 2xx': (r) => r.status >= 200 && r.status < 300,
      });
      stepFailRate.add(!created);
      const id = create.json('id') || create.json('_id');
      if (id) {
        const del = http.del(`${BASE_URL}/api/contacts/${id}`, null, {
          headers: authHeaders(token),
          tags: { step: 'contact_delete' },
        });
        check(del, { 'contact delete 2xx': (r) => r.status >= 200 && r.status < 300 });
      }
    });
  }

  journeyDuration.add(Date.now() - journeyStart);
  sleep(1);
}

// Emit a compact JSON summary the workflow uploads as an artifact.
export function handleSummary(data) {
  return {
    'k6-synthetic-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics || {};
  const dur = m['synthetic_journey_duration_ms'] || {};
  const fail = m['http_req_failed'] || {};
  const p95 = dur.values ? dur.values['p(95)'] : undefined;
  const failRate = fail.values ? fail.values.rate : undefined;
  return [
    '── k6 synthetic journey ──',
    `journey p95: ${p95 !== undefined ? p95.toFixed(0) + 'ms' : 'n/a'}`,
    `req fail rate: ${failRate !== undefined ? (failRate * 100).toFixed(3) + '%' : 'n/a'}`,
    '',
  ].join('\n');
}
