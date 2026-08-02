// ═════════════════════════════════════════════════════════════════
// push.js — langganan Web Push dari sisi pembeli (classic script)
// Dependensi global: APP_CONFIG (config.js), apiPost (api.js)
// Dipanggil dari index.js setelah aktivasi sukses (member only).
// ═════════════════════════════════════════════════════════════════

// Decode base64url VAPID public key → Uint8Array (untuk applicationServerKey)
function _urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Browser support & konteks aman (HTTPS wajib)
function pushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext &&
    !!APP_CONFIG.VAPID_PUBLIC
  );
}

// Minta izin notifikasi + subscribe, lalu kirim endpoint ke Worker.
// Dipanggil sekali setelah aktivasi sukses. Aman dipanggil berulang —
// flag localStorage mencegah spam dialog & request ganda.
async function initPush(orderId, deviceId) {
  if (!pushSupported()) return;
  if (localStorage.getItem('aitp_push') === 'subscribed') return;
  if (Notification.permission === 'denied') {
    localStorage.setItem('aitp_push', 'denied');
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;

    // Izin — kalau default, tampilkan dialog native (sudah di-warm-up oleh banner)
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        localStorage.setItem('aitp_push', 'dismissed');
        return;
      }
    }

    // Re-subscribe walau sudah granted (handle kasus subscription hangus)
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8Array(APP_CONFIG.VAPID_PUBLIC),
      });
    }

    // Kirim ke Worker — binding orderId+deviceId sebagai auth
    await apiPost('/push/subscribe', {
      orderId: orderId,
      deviceId: deviceId,
      subscription: sub.toJSON(),
    });

    localStorage.setItem('aitp_push', 'subscribed');
  } catch (err) {
    // Push gagal tak boleh memutus pengalaman utama — diam saja
    console.warn('push subscribe gagal:', err);
  }
}

// Opt-out (tombol kecil di dashboard, opsional)
async function unsubscribePush() {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiPost('/push/unsubscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    localStorage.setItem('aitp_push', 'unsubscribed');
  } catch (err) {
    console.warn('push unsubscribe gagal:', err);
  }
}
