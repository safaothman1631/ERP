// contacts-search.js — Contacts search endpoint load.
//
// Spec: requirements.md §5 (read-paginated SLO), with elevated bound
// because search hits a fuzzy index — p95 < 500ms is acceptable here.

import { sleep } from 'k6';
import {
  applyDurationOverride,
  authedGet,
  login,
} from './_shared.js';

const QUERIES = [
  'Ahmed', 'Karim', 'Mohammed', 'Sara', 'Layla', 'Hussein', 'Zaynab',
  'Rasheed', 'Khalid', 'Noor', 'Amal', 'Mustafa', 'Iraq', 'Erbil',
  'Sulaymaniyah', 'Baghdad', 'Basra', 'Mosul', 'Kirkuk', 'Duhok',
];

export const options = {
  scenarios: {
    contacts_search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: applyDurationOverride([
        { duration: '1m', target: 30 },
        { duration: '5m', target: 30 },
        { duration: '1m', target: 0 },
      ]),
    },
  },
  thresholds: {
    'http_req_duration{name:contacts_search_short}': ['p(95)<400'],
    'http_req_duration{name:contacts_search_long}':  ['p(95)<500'],
    'http_req_duration{name:contacts_get_one}':      ['p(95)<150'],
    http_req_failed: ['rate<0.002'],
  },
};

export function setup() { return login(); }

export default function (auth) {
  const q = QUERIES[(__VU + __ITER) % QUERIES.length];

  // Short-prefix search — typeahead pattern.
  authedGet(auth, `/api/contacts?q=${encodeURIComponent(q.slice(0, 2))}&limit=10`,
            'contacts_search_short');

  // Full query — full-text fuzzy.
  const r = authedGet(auth, `/api/contacts?q=${encodeURIComponent(q)}&limit=50`,
                     'contacts_search_long');

  // Open the first result.
  try {
    const items = r.json('items') || r.json('results') || [];
    if (items.length > 0) {
      const id = items[0].id || items[0]._id;
      if (id) authedGet(auth, `/api/contacts/${id}`, 'contacts_get_one');
    }
  } catch (_e) { /* tolerate schema drift */ }

  sleep(0.5);
}
