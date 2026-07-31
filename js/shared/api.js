// ═════════════════════════════════════════════════════════════════
// api.js — klien HTTP untuk Cloudflare Worker (lihat worker/src/index.js)
// ═════════════════════════════════════════════════════════════════

/**
 * POST JSON ke Worker. Return { status, data } — tidak pernah throw untuk
 * respons HTTP error; throw hanya untuk kegagalan jaringan.
 */
async function apiPost(path, body, extraHeaders = {}) {
  const res = await fetch(APP_CONFIG.WORKER_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** Aktivasi pembeli: validasi Order ID + kunci ke device ini. */
function activateOrder(orderId, deviceId) {
  return apiPost('/activate', { orderId, deviceId });
}

/** Reset binding device (penjual, butuh admin token). */
function resetOrderBinding(orderId, adminToken) {
  return apiPost('/reset', { orderId }, { 'X-Admin-Token': adminToken });
}
