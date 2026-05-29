/**
 * Crisp chat helper (G2 / R2.7).
 *
 * Loads the Crisp widget lazily — call `bootCrisp(websiteId)` once at
 * startup (typically after the user signs in). Use `identifyUser()` to
 * tag the session with tenant + plan so support agents see context.
 *
 * The Crisp script is a no-op if the website ID is missing — useful in
 * dev so we don't open a chat window every reload.
 *
 * A "crisp:open" CustomEvent listener is registered so other components
 * (the HelpPanel) can open the chat without depending on the global
 * `$crisp` object directly.
 */

declare global {
  interface Window {
    $crisp?: Array<unknown[]>;
    CRISP_WEBSITE_ID?: string;
  }
}

let booted = false;

export function bootCrisp(websiteId?: string): void {
  if (booted) return;
  const id = websiteId || (window as any).__CRISP_ID__ || '';
  if (!id) {
    // eslint-disable-next-line no-console
    console.info('crisp.skipped', 'no website id configured');
    return;
  }
  booted = true;
  window.$crisp = window.$crisp || [];
  window.CRISP_WEBSITE_ID = id;
  const script = document.createElement('script');
  script.src = 'https://client.crisp.chat/l.js';
  script.async = true;
  document.head.appendChild(script);

  // Allow other components to open the chat without touching $crisp directly.
  window.addEventListener('crisp:open', () => {
    try {
      window.$crisp?.push(['do', 'chat:open']);
    } catch {
      /* noop */
    }
  });
}

export interface CrispIdentifyPayload {
  user_id: string;
  email?: string;
  nickname?: string;
  tenant_id?: string;
  plan?: string;
  locale?: string;
}

export function identifyUser(p: CrispIdentifyPayload): void {
  if (!window.$crisp) return;
  try {
    if (p.email) window.$crisp.push(['set', 'user:email', [p.email]]);
    if (p.nickname) window.$crisp.push(['set', 'user:nickname', [p.nickname]]);
    window.$crisp.push([
      'set',
      'session:data',
      [
        [
          ['user_id', p.user_id],
          ['tenant_id', p.tenant_id || ''],
          ['plan', p.plan || ''],
          ['locale', p.locale || ''],
        ],
      ],
    ]);
  } catch {
    /* noop */
  }
}

export function openCrispChat(): void {
  window.dispatchEvent(new CustomEvent('crisp:open'));
}

export function shutdownCrisp(): void {
  try {
    window.$crisp?.push(['do', 'session:reset']);
  } catch {
    /* noop */
  }
}
