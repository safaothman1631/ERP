// dashboard.js — Dashboard aggregation endpoints load.
//
// Spec: requirements.md §5 (report queries p95 < 1500ms).
//
// The dashboard hits multiple aggregation routes (totals, recent activity,
// charts). We model a "user opens the dashboard" iteration that fires all
// of them, since the UI fans out in parallel.

import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  applyDurationOverride,
  authHeaders,
  BASE_URL,
  login,
} from './_shared.js';

export const options = {
  scenarios: {
    dashboard: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: applyDurationOverride([
        { duration: '1m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '1m', target: 0 },
      ]),
    },
  },
  thresholds: {
    'http_req_duration{name:dashboard_totals}':  ['p(95)<800'],
    'http_req_duration{name:dashboard_chart}':   ['p(95)<1500'],
    'http_req_duration{name:dashboard_recent}':  ['p(95)<400'],
    http_req_failed: ['rate<0.005'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() { return login(); }

export default function (auth) {
  const headers = authHeaders(auth);

  // Three parallel GETs in a batch — mirrors what the SPA does on page open.
  const responses = http.batch([
    { method: 'GET', url: `${BASE_URL}/api/dashboard/totals?range=30d`,
      params: { headers, tags: { name: 'dashboard_totals' } } },
    { method: 'GET', url: `${BASE_URL}/api/dashboard/sales-chart?range=30d&bucket=day`,
      params: { headers, tags: { name: 'dashboard_chart' } } },
    { method: 'GET', url: `${BASE_URL}/api/dashboard/recent-activity?limit=20`,
      params: { headers, tags: { name: 'dashboard_recent' } } },
  ]);

  for (const [i, r] of responses.entries()) {
    check(r, {
      [`dashboard batch[${i}] 2xx`]: (res) => res.status >= 200 && res.status < 300,
    });
  }

  sleep(2);
}
