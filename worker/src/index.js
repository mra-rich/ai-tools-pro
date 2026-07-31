// ═════════════════════════════════════════════════════════════════
// AI Tools Pro — Cloudflare Worker
// Endpoint:
//   POST /webhook?key=WEBHOOK_SECRET   <- dipanggil lynk.id saat transaksi sukses
//   POST /activate                     <- dipanggil index.html (pembeli)
//   POST /reset                        <- dipanggil admin.html (penjual, butuh X-Admin-Token)
//
// Secret diatur via `wrangler secret put` (lihat worker/README.md):
//   WEBHOOK_SECRET — pengaman URL webhook (wajib)
//   ADMIN_TOKEN    — pengaman reset binding (wajib)
//   MERCHANT_KEY   — opsional: verifikasi X-Lynk-Signature dari lynk.id
// KV namespace: ORDERS (binding di wrangler.toml)
// ═════════════════════════════════════════════════════════════════

// Origin yang boleh memanggil API dari browser:
// - GitHub Pages (app pembeli)
// - "null" (admin.html dibuka langsung dari file:// di laptop penjual)
const CORS_ORIGINS = ['https://mra-rich.github.io', 'null'];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  };
}

function json(body, status = 200, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

const normalize = (s) => String(s ?? '').trim().toUpperCase();

/** Cari Order ID dari payload webhook.
 *  Format asli lynk.id (dari dokumentasi resmi):
 *    data.message_data.refId
 *  Kandidat lain dipertahankan sebagai fallback. */
function extractOrderId(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const d = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const md = d.message_data && typeof d.message_data === 'object' ? d.message_data : {};
  const candidates = [
    md.refId, // format asli lynk.id
    md.ref_id, md.order_id, md.orderId, md.id,
    payload.order_id, payload.orderId, payload.order_number,
    payload.invoice_id, payload.invoice, payload.reference, payload.ref_id, payload.refId, payload.id,
    d.order_id, d.orderId, d.invoice_id, d.invoice, d.ref_id, d.refId, d.id,
  ];
  const found =
    candidates.find((x) => typeof x === 'string' && x.trim()) ??
    candidates.find((x) => typeof x === 'number');
  return found == null ? null : normalize(found);
}

/** Anggap transaksi "dibayar" jika:
 *  - format asli lynk.id: data.message_action === 'SUCCESS' (atau message_code === '0')
 *  - fallback: status umum / webhook tanpa status */
function isPaid(payload) {
  const d = payload.data && typeof payload.data === 'object' ? payload.data : {};
  if (d.message_action != null) return String(d.message_action).toUpperCase() === 'SUCCESS';
  if (d.message_code != null) return String(d.message_code) === '0';
  const s = normalize(payload.status ?? payload.payment_status ?? d.status ?? 'success').toLowerCase();
  return ['success', 'paid', 'settlement', 'completed', 'complete', ''].includes(s);
}

/** Ekstrak data untuk verifikasi signature X-Lynk-Signature (format asli lynk.id). */
function extractSignatureParts(payload) {
  const d = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const md = d.message_data && typeof d.message_data === 'object' ? d.message_data : {};
  const amount = md.totals?.grandTotal ?? payload.amount ?? '';
  const refId = md.refId ?? payload.refId ?? '';
  const messageId = d.message_id ?? payload.message_id ?? '';
  return { amount: String(amount), refId: String(refId), messageId: String(messageId) };
}

/** sha256 hex via Web Crypto (Worker runtime). */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, headers);
    }

    // ── WEBHOOK: pencatatan order valid dari lynk.id ───────────
    if (url.pathname === '/webhook') {
      if (env.WEBHOOK_SECRET && url.searchParams.get('key') !== env.WEBHOOK_SECRET) {
        return json({ error: 'unauthorized' }, 401, headers);
      }
      const payload = await request.json().catch(() => null);

      // Pelacakan diagnostik (terlihat via `npx wrangler tail`)
      console.log('[webhook] sig_header=', request.headers.get('X-Lynk-Signature'));
      console.log('[webhook] payload=', JSON.stringify(payload)?.slice(0, 800) ?? String(payload));

      // Payload percobaan dari tombol "Test" di dashboard lynk.id —
      // tidak membawa signature maupun order id
      if (payload?.event === 'test_event') {
        return json({ ok: true, received: 'test_event' }, 200, headers);
      }

      // Verifikasi signature lynk.id jika MERCHANT_KEY di-set:
      // X-Lynk-Signature = sha256(grandTotal + refId + message_id + MERCHANT_KEY)
      // Header salah → tolak. Header kosong → terima sementara + log WARNING
      // (ketatkan ke wajib-signature setelah transaksi asli pertama terbukti membawa header).
      if (env.MERCHANT_KEY && payload) {
        const received = String(request.headers.get('X-Lynk-Signature') || '').toLowerCase();
        if (received) {
          const { amount, refId, messageId } = extractSignatureParts(payload);
          const expected = await sha256Hex(amount + refId + messageId + env.MERCHANT_KEY);
          console.log('[webhook] sig parts amount=', amount, 'refId=', refId, 'messageId=', messageId);
          console.log('[webhook] expected_sig=', expected);
          if (received !== expected) {
            return json({ error: 'invalid_signature' }, 401, headers);
          }
        } else {
          console.log('[webhook] WARNING: event non-test tanpa X-Lynk-Signature');
        }
      }

      const orderId = extractOrderId(payload);
      if (!orderId) return json({ error: 'order_id_not_found' }, 400, headers);
      if (!isPaid(payload)) return json({ ok: true, skipped: 'not_paid' }, 200, headers);

      // Rekam hanya sekali — aktivasi ulang/refund tidak menimpa data
      if (!(await env.ORDERS.get('order:' + orderId))) {
        const d = payload.data && typeof payload.data === 'object' ? payload.data : {};
        const md = d.message_data && typeof d.message_data === 'object' ? d.message_data : {};
        await env.ORDERS.put(
          'order:' + orderId,
          JSON.stringify({
            orderId,
            product: md.items?.[0]?.title ?? payload.product?.name ?? payload.product_name ?? null,
            buyer: md.customer?.email ?? payload.email ?? payload.buyer?.email ?? null,
            paidAt: md.createdAt ?? new Date().toISOString(),
            binding: null,
          }),
        );
      }
      return json({ ok: true, orderId }, 200, headers);
    }

    // ── ACTIVATE: validasi order + kunci ke device pertama ────
    if (url.pathname === '/activate') {
      const body = await request.json().catch(() => ({}));
      const orderId = normalize(body.orderId);
      const deviceId = normalize(body.deviceId);
      if (!orderId || !/^[A-F0-9]{16}$/.test(deviceId)) {
        return json({ ok: false, error: 'invalid_request' }, 400, headers);
      }
      const raw = await env.ORDERS.get('order:' + orderId);
      if (!raw) return json({ ok: false, error: 'order_not_found' }, 404, headers);

      const order = JSON.parse(raw);
      if (order.binding && order.binding.deviceId !== deviceId) {
        return json({ ok: false, error: 'bound_to_other_device' }, 409, headers);
      }
      if (!order.binding) {
        order.binding = { deviceId, at: new Date().toISOString() };
        await env.ORDERS.put('order:' + orderId, JSON.stringify(order));
      }
      // Idempoten: aktivasi ulang di device yang sama selalu sukses
      return json({ ok: true, orderId, deviceId }, 200, headers);
    }

    // ── RESET: lepas binding (pembeli ganti device) ────────────
    if (url.pathname === '/reset') {
      if (!env.ADMIN_TOKEN || request.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN) {
        return json({ error: 'unauthorized' }, 401, headers);
      }
      const body = await request.json().catch(() => ({}));
      const orderId = normalize(body.orderId);
      if (!orderId) return json({ ok: false, error: 'invalid_request' }, 400, headers);

      const raw = await env.ORDERS.get('order:' + orderId);
      if (!raw) return json({ ok: false, error: 'order_not_found' }, 404, headers);

      const order = JSON.parse(raw);
      order.binding = null;
      await env.ORDERS.put('order:' + orderId, JSON.stringify(order));
      return json({ ok: true, orderId }, 200, headers);
    }

    return json({ error: 'not_found' }, 404, headers);
  },
};
