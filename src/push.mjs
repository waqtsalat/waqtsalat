/**
 * VAPID push subscription and Gist storage.
 */

import { state } from './state.mjs';

// Build-time defines (replaced by Vite)
const VAPID_PUBLIC_KEY = __VAPID_PUBLIC_KEY__;
const GIST_ID = __GIST_ID__;
const GIST_TOKEN = __GIST_TOKEN__;

export { VAPID_PUBLIC_KEY };

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const PUSH_MAX_RETRIES = 3;
const PUSH_RETRY_BASE_MS = 2000;

export async function subscribeToPush(retryCount = 0) {
  if (!('PushManager' in window)) return null;
  if (!VAPID_PUBLIC_KEY) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active?.state !== 'activated') {
      await new Promise(resolve => {
        const sw = reg.active || reg.installing || reg.waiting;
        if (!sw) { resolve(); return; }
        if (sw.state === 'activated') { resolve(); return; }
        sw.addEventListener('statechange', function handler() {
          if (sw.state === 'activated') {
            sw.removeEventListener('statechange', handler);
            resolve();
          }
        });
      });
    }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await storeSubscriptionInGist(sub);
    return sub;
  } catch (e) {
    if (retryCount < PUSH_MAX_RETRIES) {
      const delay = PUSH_RETRY_BASE_MS * Math.pow(2, retryCount);
      await new Promise(r => setTimeout(r, delay));
      return subscribeToPush(retryCount + 1);
    }
    console.warn('[Push] Subscribe failed after retries:', e.message);
    return null;
  }
}

async function storeSubscriptionInGist(subscription) {
  if (!subscription || !GIST_ID || !GIST_TOKEN) return;

  const deviceKey = btoa(subscription.endpoint).slice(-20).replace(/[^a-zA-Z0-9]/g, '');

  const entry = {
    subscription: subscription.toJSON(),
    city: state.position ? {
      lat: state.position.lat,
      lng: state.position.lng,
      id: state.position.cityId
    } : null,
    prayers: state.notifications.prayers,
    advance: state.notifications.advance,
    soundAt: state.notifications.soundAt,
    soundPre: state.notifications.soundPre,
    locale: state.locale,
    updatedAt: new Date().toISOString()
  };

  try {
    const headers = {
      'Authorization': `token ${GIST_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    let files = {};
    const getResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
    if (getResp.ok) {
      const gist = await getResp.json();
      const existing = gist.files?.['subscriptions.json'];
      if (existing?.content) {
        try { files = JSON.parse(existing.content); } catch (e) { /* ignore */ }
      }
    }

    files[deviceKey] = entry;

    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        files: { 'subscriptions.json': { content: JSON.stringify(files, null, 2) } }
      })
    });
  } catch (e) {
    console.warn('[Push] Gist storage failed:', e.message);
  }
}

export async function unsubscribeFromPush() {
  if (!GIST_ID || !GIST_TOKEN) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const deviceKey = btoa(sub.endpoint).slice(-20).replace(/[^a-zA-Z0-9]/g, '');

  try {
    const headers = { 'Authorization': `token ${GIST_TOKEN}` };
    const getResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
    if (getResp.ok) {
      const gist = await getResp.json();
      const existing = gist.files?.['subscriptions.json'];
      if (existing?.content) {
        const files = JSON.parse(existing.content);
        delete files[deviceKey];
        await fetch(`https://api.github.com/gists/${GIST_ID}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: { 'subscriptions.json': { content: JSON.stringify(files, null, 2) } }
          })
        });
      }
    }
  } catch (e) { /* ignore */ }

  await sub.unsubscribe();
}
