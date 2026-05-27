// pos-checkout.js — POS checkout end-to-end load.
//
// Spec: design.md §8.3 (example), requirements.md §5 (POS checkout SLO).
//
// Stages: 2m ramp → 10m sustained at 50 VUs → 2m ramp-down.
// Per VU, an iteration:
//   1. Pull a tiny product catalogue (warm cache).
//   2. Open a cart.
//   3. Add 3 random items.
//   4. Apply a discount.
//   5. Tender (cash).
//   6. Settle the order.
//
// Thresholds:
//   p95 < 400ms across http_req_duration
//   http_req_failed rate < 0.001
//
// Run locally:  K6_BASE_URL=http://localhost:8000 k6 run pos-checkout.js

import { sleep } from 'k6';
import { Trend } from 'k6/metrics';
import {
  applyDurationOverride,
  authedGet,
  authedPost,
  login,
  vuId,
} from './_shared.js';

const checkoutLatency = new Trend('pos_checkout_total_ms');

export const options = {
  scenarios: {
    pos_checkout: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: applyDurationOverride([
        { duration: '2m',  target: 50 },
        { duration: '10m', target: 50 },
        { duration: '2m',  target: 0 },
      ]),
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<400'],
    http_req_failed:   ['rate<0.001'],
    pos_checkout_total_ms: ['p(95)<1000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  return login();
}

export default function (auth) {
  const start = Date.now();

  // 1. Catalogue ping (uses cache after first hit per VU).
  authedGet(auth, '/api/items?limit=20&pos=true', 'pos_items_list');

  // 2. Open a cart (idempotent — backend reuses the session if exists).
  const cartId = vuId('cart');
  authedPost(auth, '/api/pos/carts', {
    cart_id: cartId,
    floor: 'main',
    waiter_id: `vu-${__VU}`,
  }, 'pos_cart_open');

  // 3. Add 3 lines.
  for (let i = 0; i < 3; i++) {
    authedPost(auth, `/api/pos/carts/${cartId}/lines`, {
      sku: `PROD-${(i % 10) + 1}`,
      qty: 1 + (i % 3),
    }, 'pos_cart_add_line');
  }

  // 4. Apply a discount (5%).
  authedPost(auth, `/api/pos/carts/${cartId}/discount`, {
    type: 'percent',
    value: 5,
  }, 'pos_cart_discount');

  // 5. Tender (cash).
  authedPost(auth, `/api/pos/carts/${cartId}/tender`, {
    method: 'cash',
    amount: 100000,   // 100k IQD
  }, 'pos_cart_tender');

  // 6. Settle.
  authedPost(auth, `/api/pos/carts/${cartId}/settle`, {
    print_receipt: false,
  }, 'pos_cart_settle');

  checkoutLatency.add(Date.now() - start);
  sleep(1);
}
