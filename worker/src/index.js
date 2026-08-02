// ═════════════════════════════════════════════════════════════════
// AI Tools Pro — Cloudflare Worker
// Endpoint:
//   POST /webhook?key=WEBHOOK_SECRET   <- dipanggil lynk.id saat transaksi sukses
//   POST /activate                     <- dipanggil index.html (pembeli)
//   POST /reset                        <- dipanggil admin.html (penjual, butuh X-Admin-Token)
//   POST /push/subscribe               <- pembeli: simpan langganan push (binding order+device)
//   POST /push/unsubscribe             <- pembeli: opt-out
//   POST /push/notify                  <- admin: blast notifikasi (butuh X-Admin-Token)
//
// Secret diatur via `wrangler secret put` (lihat worker/README.md):
//   WEBHOOK_SECRET — pengaman URL webhook (wajib)
//   ADMIN_TOKEN    — pengaman reset binding (wajib)
//   MERCHANT_KEY   — opsional: verifikasi X-Lynk-Signature dari lynk.id
//   VAPID_PRIVATE  — kunci privat VAPID untuk menandatangani Web Push (wajib utk notifikasi)
// KV namespace: ORDERS (binding di wrangler.toml)
// ═════════════════════════════════════════════════════════════════

// Origin yang boleh memanggil API dari browser:
// - Domain produksi tokengratis.web.id (app pembeli)
// - GitHub Pages (fallback saat transisi domain)
// - "null" (admin.html dibuka langsung dari file:// di laptop penjual)
const CORS_ORIGINS = ['https://tokengratis.web.id', 'https://mra-rich.github.io', 'null'];

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

// ═══════════════ WEB PUSH CRYPTO (RFC 8291 + VAPID ES256) ════════
// Semua via WebCrypto bawaan Workers — tanpa dependency npm.

function b64urlToBuf(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

function bufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatBuf(...bufs) {
  const total = bufs.reduce((n, b) => n + b.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of bufs) { out.set(new Uint8Array(b), off); off += b.byteLength; }
  return out.buffer;
}

async function hmac(keyBuf, dataBuf) {
  const key = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, dataBuf);
}

/** Bangun JWK EC P-256 dari VAPID privat (32 byte) + publik (65 byte uncompressed). */
function vapidJwk(privateB64url, publicB64url) {
  const pub = new Uint8Array(b64urlToBuf(publicB64url)); // 0x04 || x(32) || y(32)
  const d = new Uint8Array(b64urlToBuf(privateB64url));
  return {
    kty: 'EC', crv: 'P-256', ext: true,
    d: bufToB64url(d),
    x: bufToB64url(pub.slice(1, 33)),
    y: bufToB64url(pub.slice(33, 65)),
  };
}

/** Buat VAPID Authorization header: JWT ES256. */
async function vapidAuth(endpoint, env) {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const head = bufToB64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payl = bufToB64url(new TextEncoder().encode(JSON.stringify({
    aud, exp: now + 12 * 3600,
    sub: 'mailto:admin@tokengratis.web.id',
  })));
  const signingInput = head + '.' + payl;
  const jwk = vapidJwk(env.VAPID_PRIVATE, env.VAPID_PUBLIC);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
  return 'vapid t=' + signingInput + '.' + bufToB64url(sig) + ', k=' + env.VAPID_PUBLIC;
}

/** Enkripsi payload sesuai RFC 8291 (aes128gcm). */
async function encryptPayload(subscription, payloadText) {
  const keys = subscription.keys;
  const uaPub = b64urlToBuf(keys.p256dh);   // 65 byte uncompressed
  const authSecret = b64urlToBuf(keys.auth); // 16 byte
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const data = new TextEncoder().encode(payloadText);

  // 1. ECDH: ephemeral keypair server × public key client
  const asPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = await crypto.subtle.exportKey('raw', asPair.publicKey);
  const uaPubKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPubKey }, asPair.privateKey, 256);

  // 2. IKM per RFC 8291 §3.4
  const enc = new TextEncoder();
  const keyInfo = concatBuf(enc.encode('WebPush: info\0'), uaPub, asPub);
  const prkKey = await hmac(authSecret, ecdhSecret);
  const ikm = await hmac(prkKey, concatBuf(keyInfo, new Uint8Array([1]).buffer));

  // 3. CEK & NONCE per RFC 8188 §2.3
  const prk = await hmac(salt, ikm);
  const cekInfo = concatBuf(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1]).buffer);
  const nonceInfo = concatBuf(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1]).buffer);
  const cek = (await hmac(prk, cekInfo)).slice(0, 16);
  const nonce = (await hmac(prk, nonceInfo)).slice(0, 12);

  // 4. Plaintext = data || 0x02 (delimiter record terakhir, tanpa padding)
  const plaintext = concatBuf(data, new Uint8Array([2]).buffer);

  // 5. Enkripsi AES-GCM
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext);

  // 6. Body: salt(16) || rs(4) || idlen(1) || asPub(65) || ciphertext
  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, 4096);
  return concatBuf(salt, rs.buffer, new Uint8Array([asPub.byteLength]).buffer, asPub, ciphertext);
}

/** Kirim 1 notifikasi push ke 1 subscription. Return { ok, status }. */
async function sendPush(subscription, payload, env) {
  try {
    const body = await encryptPayload(subscription, JSON.stringify(payload));
    const auth = await vapidAuth(subscription.endpoint, env);
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal',
      },
      body,
    });
    return { ok: res.status === 201 || res.status === 200, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: String(err && err.message || err) };
  }
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

    // ── CONTENT: konten dinamis, hanya untuk device ter-aktivasi ──
    if (url.pathname === '/content') {
      const body = await request.json().catch(() => ({}));
      const orderId = normalize(body.orderId);
      const deviceId = normalize(body.deviceId);
      if (!orderId || !/^[A-F0-9]{16}$/.test(deviceId)) {
        return json({ ok: false, error: 'invalid_request' }, 400, headers);
      }
      const raw = await env.ORDERS.get('order:' + orderId);
      if (!raw) return json({ ok: false, error: 'session_invalid' }, 401, headers);
      const order = JSON.parse(raw);
      if (!order.binding || order.binding.deviceId !== deviceId) {
        return json({ ok: false, error: 'session_invalid' }, 401, headers);
      }
      const content = await env.ORDERS.get('content:latest');
      if (!content) return json({ ok: false, error: 'content_not_set' }, 404, headers);
      return new Response(content, { status: 200, headers });
    }

    // ── CONTENT/READ & CONTENT/UPDATE: manajemen konten (admin) ──
    if (url.pathname === '/content/read' || url.pathname === '/content/update') {
      if (!env.ADMIN_TOKEN || request.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN) {
        return json({ error: 'unauthorized' }, 401, headers);
      }
      if (url.pathname === '/content/read') {
        const content = await env.ORDERS.get('content:latest');
        if (!content) return json({ ok: false, error: 'content_not_set' }, 404, headers);
        return new Response(content, { status: 200, headers });
      }
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        return json({ ok: false, error: 'invalid_json' }, 400, headers);
      }
      await env.ORDERS.put('content:latest', JSON.stringify(body));
      return json({ ok: true }, 200, headers);
    }

    // ── PUSH/SUBSCRIBE: simpan langganan push (member ter-aktivasi) ─
    if (url.pathname === '/push/subscribe') {
      const body = await request.json().catch(() => ({}));
      const orderId = normalize(body.orderId);
      const deviceId = normalize(body.deviceId);
      const sub = body.subscription;
      if (!orderId || !/^[A-F0-9]{16}$/.test(deviceId) ||
          !sub || typeof sub.endpoint !== 'string' || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return json({ ok: false, error: 'invalid_request' }, 400, headers);
      }
      // validasi binding — hanya device yang sudah aktivasi boleh langganan
      const raw = await env.ORDERS.get('order:' + orderId);
      if (!raw) return json({ ok: false, error: 'session_invalid' }, 401, headers);
      const order = JSON.parse(raw);
      if (!order.binding || order.binding.deviceId !== deviceId) {
        return json({ ok: false, error: 'session_invalid' }, 401, headers);
      }
      // simpan: KV key = hash endpoint (stabil, 1 entry per subscription)
      const key = 'push:' + (await sha256Hex(sub.endpoint));
      await env.ORDERS.put(key, JSON.stringify({
        endpoint: sub.endpoint,
        keys: sub.keys,
        orderId,
        ts: Date.now(),
      }));
      return json({ ok: true }, 200, headers);
    }

    // ── PUSH/UNSUBSCRIBE: opt-out ─────────────────────────────
    if (url.pathname === '/push/unsubscribe') {
      const body = await request.json().catch(() => ({}));
      if (typeof body.endpoint !== 'string' || !body.endpoint) {
        return json({ ok: false, error: 'invalid_request' }, 400, headers);
      }
      await env.ORDERS.delete('push:' + (await sha256Hex(body.endpoint)));
      return json({ ok: true }, 200, headers);
    }

    // ── PUSH/NOTIFY: blast notifikasi (admin) ───────────────
    if (url.pathname === '/push/notify') {
      if (!env.ADMIN_TOKEN || request.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN) {
        return json({ error: 'unauthorized' }, 401, headers);
      }
      if (!env.VAPID_PRIVATE || !env.VAPID_PUBLIC) {
        return json({ ok: false, error: 'vapid_not_configured' }, 500, headers);
      }
      const body = await request.json().catch(() => null);
      if (!body || typeof body.title !== 'string' || !body.title || typeof body.body !== 'string') {
        return json({ ok: false, error: 'invalid_request' }, 400, headers);
      }
      const payload = { title: body.title, body: body.body, url: body.url || '/' };

      // list semua KV key ber-prefix "push:" (dengan pagination)
      let sent = 0, failed = 0, pruned = 0, total = 0, cursor;
      do {
        const list = await env.ORDERS.list({ prefix: 'push:', cursor });
        cursor = list.list_complete ? undefined : list.cursor;
        for (const { name } of list.keys) {
          const raw = await env.ORDERS.get(name);
          if (!raw) continue;
          total++;
          const sub = JSON.parse(raw);
          const r = await sendPush(sub, payload, env);
          if (r.ok) sent++;
          else {
            failed++;
            // 404/410 = subscription sudah hangus → hapus dari KV
            if (r.status === 404 || r.status === 410) {
              await env.ORDERS.delete(name);
              pruned++;
            }
          }
        }
      } while (cursor);
      return json({ ok: true, total, sent, failed, pruned }, 200, headers);
    }

    // ── PUSH/STATS: jumlah subscriber (admin) ───────────────
    if (url.pathname === '/push/stats') {
      if (!env.ADMIN_TOKEN || request.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN) {
        return json({ error: 'unauthorized' }, 401, headers);
      }
      const list = await env.ORDERS.list({ prefix: 'push:' });
      return json({ ok: true, subscribers: list.keys.length }, 200, headers);
    }

    return json({ error: 'not_found' }, 404, headers);
  },
};
