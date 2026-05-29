// invoice-list.js — Paginated list endpoint load.
//
// Spec: requirements.md §5 (read-paginated p95 < 300ms).
//
// Stages: 1m ramp → 5m sustained at 40 VUs → 1m down.

import { sleep } from 'k6';
import {
  applyDurationOverride,
  authedGet,
  login,
} from './_shared.js';

export const options = {
  scenarios: {
    invoice_list: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: applyDurationOverride([
        { duration: '1m', target: 40 },
        { duration: '5m', target: 40 },
        { duration: '1m', target: 0 },
      ]),
    },
  },
  thresholds: {
    'http_req_duration{name:invoice_list_page1}':  ['p(95)<300'],
    'http_req_duration{name:invoice_list_pageN}':  ['p(95)<400'],
    'http_req_duration{name:invoice_get_one}':     ['p(95)<150'],
    http_req_failed: ['rate<0.001'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() { return login(); }

export default function (auth) {
  // Page 1 — must be the fastest, cache-friendly.
  const r1 = authedGet(auth, '/api/invoices?limit=50&offset=0&sort=-issued_at',
                      'invoice_list_page1');

  // A deeper page — exercises offset-based pagination cost.
  authedGet(auth, '/api/invoices?limit=50&offset=200&sort=-issued_at',
            'invoice_list_pageN');

  // Drill into one invoice from the first page (cache miss likely on cold VU).
  try {
    const items = r1.json('items') || r1.json('results') || [];
    if (items.length > 0) {
      const id = items[0].id || items[0]._id;
      if (id) authedGet(auth, `/api/invoices/${id}`, 'invoice_get_one');
    }
  } catch (_e) {
    // Tolerate schema drift; threshold check still binds on the requests we did make.
  }

  sleep(1);
}
