# AI Tools Pro Refactor + Automatic Activation — Implementation Plan

**Goal:** Restrukturisasi produk static AI Tools Pro ke file terpisah yang profesional, dengan sistem aktivasi otomatis penuh (webhook lynk.id → Cloudflare Worker KV).

**Architecture:** Static murni tanpa build tool (HTML shell + css/ + js/classic globals) untuk klien; satu Cloudflare Worker (3 endpoint POST: /webhook /activate /reset) dengan satu KV namespace `ORDERS` sebagai source of truth validasi order & device-binding.

**Tech Stack:** HTML/CSS/vanilla JS (classic scripts, WebCrypto), Cloudflare Worker (ES module), Wrangler CLI.

**Spec:** `docs/superpowers/specs/2026-07-31-ai-tools-pro-refaktor-aktivasi-otomatis-design.md`

## Global Constraints

- Tidak ada build tool / npm di root; semua script client adalah classic script (bukan ES module), urutan load: `js/shared/config.js → crypto.js → ui.js → api.js → js/index.js|admin.js`.
- Fungsi global lintas-script didefinisikan dengan `function name()` / `const NAME` di top-level (shared global lexical scope).
- Bahasa UI: Indonesia. Kode & komentar: Indonesia untuk komentar, Inggris untuk identifier.
- CSS dipindah VERBATIM dari file lama; hanya pemecahan file, tanpa perubahan visual.
- Format `content.json` tidak berubah.
- Semua data dari `content.json` di-render lewat `escapeHtml()` (kecuali field `pengumuman` tetap teks saja).
- Verifikasi tiap task: `node --check <file.js>` untuk JS; folder bukan git repo → tidak ada commit (skip langkah git).

---

### Task 1: Struktur folder + shared library + common.css

**Files:**
- Create: `js/shared/config.js`, `js/shared/crypto.js`, `js/shared/ui.js`, `js/shared/api.js`, `css/common.css`
- Create (direktori): `css/`, `js/shared/`, `worker/`, `archive/`

**Interfaces (diproduksi untuk task lain):**
```js
// config.js
const APP_CONFIG = {
  WORKER_URL: 'https://ai-tools-pro.GANTI-SUBDOMAIN.workers.dev',
  CONTENT_URL: 'https://raw.githubusercontent.com/GANTI_USER/GANTI_REPO/main/content.json',
  LYNK_URL: 'https://lynk.id/rodlirich',
  SELLER_CONTACT: 'Kirim Order ID kamu ke penjual untuk reset device.',
  SESSION_KEY: 'aitp_session',
  HIST_KEY: 'aitp_admin_history',
};

// crypto.js
async function sha256Hex(text)            // -> hex string lowercase
async function getDeviceFingerprint()     // -> 16 hex chars UPPERCASE

// ui.js
function escapeHtml(s)                    // -> string aman untuk textContent-substitution
function setMsg(el, text, type)           // type: 'ok'|'err'|'warn'; set el.className='lock-msg '+type
function flashButton(btn, labelOk, base)  // tombol "Tersalin!" sementara lalu kembali

// api.js
async function apiPost(path, body, extraHeaders)       // -> {status, data}
async function activateOrder(orderId, deviceId)        // POST /activate
async function resetOrderBinding(orderId, adminToken)  // POST /reset (header X-Admin-Token)
```

**Steps:**
1. Buat direktori: `css/`, `js/shared/`, `worker/src/`, `archive/`, `docs/superpowers/specs|plans` (sudah ada).
2. Tulis `js/shared/config.js` sesuai interface di atas.
3. Tulis `js/shared/crypto.js`: `sha256Hex` (crypto.subtle SHA-256 → hex), `getDeviceFingerprint` (port VERBATIM logika `getDeviceId()` dari `index.html` lama: UA||lang||hardwareConcurrency||screen||timezone||platform||webglvendor → sha256Hex → 16 char uppercase).
4. Tulis `js/shared/ui.js`: 3 fungsi helper.
5. Tulis `js/shared/api.js`: 3 fungsi sesuai interface di atas (target `APP_CONFIG.WORKER_URL`, CORS JSON).
6. Tulis `css/common.css`: port VERBATIM blok `:root`, reset `*`, `body`, `@import font`, `@keyframes spin` dari `<style>` index.html lama.
7. Verifikasi: `node --check` empat file JS → tanpa output = PASS.

---

### Task 2: Cloudflare Worker + panduan deploy

**Files:**
- Create: `worker/src/index.js`, `worker/wrangler.toml`, `worker/README.md`

**Interfaces:**
- HTTP: `POST /webhook?key=WEBHOOK_SECRET`, `POST /activate`, `POST /reset` — sesuai tabel di spec.
- Worker export default `{ async fetch(request, env) }` dengan `env.ORDERS` (KV), `env.WEBHOOK_SECRET`, `env.ADMIN_TOKEN`.
- Konsumen: `js/shared/api.js` (Task 1 tidak bergantung; Task 3/4 memakai `activateOrder`/`resetOrderBinding` ke endpoint ini).

**Steps:**
1. Tulis `worker/src/index.js` lengkap (routing, CORS, normalisasi orderId, parsing payload defensif, binding atomik) — kode final ada di plan ini (appendix A).
2. Tulis `worker/wrangler.toml`:
```toml
name = "ai-tools-pro"
main = "src/index.js"
compatibility_date = "2026-07-31"

[[kv_namespaces]]
binding = "ORDERS"
id = "GANTI_DENGAN_ID_KV_KAMU"
```
3. Tulis `worker/README.md` — panduan deploy: buat akun CF → `npx wrangler login` → `npx wrangler kv namespace create ORDERS` → paste id → `npx wrangler secret put WEBHOOK_SECRET` & `ADMIN_TOKEN` → `npx wrangler deploy` → pasang URL webhook di lynk.id → uji dengan curl.
4. Verifikasi: `node --check worker/src/index.js` → PASS.

**Appendix A — worker/src/index.js:**
```js
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*', // ganti dengan https://GITHUB_PAGES_ORIGIN kamu setelah deploy
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
const normalize = (s) => String(s ?? '').trim().toUpperCase();

function extractOrderId(p) {
  if (!p || typeof p !== 'object') return null;
  const d = p.data && typeof p.data === 'object' ? p.data : {};
  const c = [p.order_id, p.orderId, p.order_number, p.invoice_id, p.invoice, p.reference, p.ref_id, p.id,
             d.order_id, d.orderId, d.invoice_id, d.invoice, d.id];
  const v = c.find((x) => typeof x === 'string' && x.trim()) ?? c.find((x) => typeof x === 'number');
  return v == null ? null : normalize(v);
}
function isPaid(p) {
  const s = normalize(p.status ?? p.payment_status ?? (p.data ? p.data.status : '') ?? 'success').toLowerCase();
  return ['success', 'paid', 'settlement', 'completed', 'complete', ''].includes(s);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    if (url.pathname === '/webhook') {
      if (env.WEBHOOK_SECRET && url.searchParams.get('key') !== env.WEBHOOK_SECRET)
        return json({ error: 'unauthorized' }, 401);
      const payload = await request.json().catch(() => null);
      const orderId = extractOrderId(payload);
      if (!orderId) return json({ error: 'order_id_not_found' }, 400);
      if (!isPaid(payload)) return json({ ok: true, skipped: 'not_paid' });
      if (!(await env.ORDERS.get('order:' + orderId))) {
        const d = payload.data && typeof payload.data === 'object' ? payload.data : {};
        await env.ORDERS.put('order:' + orderId, JSON.stringify({
          orderId,
          product: payload.product?.name ?? payload.product_name ?? d.product_name ?? null,
          buyer: payload.email ?? payload.buyer?.email ?? d.email ?? null,
          paidAt: new Date().toISOString(),
          binding: null,
        }));
      }
      return json({ ok: true, orderId });
    }

    if (url.pathname === '/activate') {
      const body = await request.json().catch(() => ({}));
      const orderId = normalize(body.orderId);
      const deviceId = normalize(body.deviceId);
      if (!orderId || !/^[A-F0-9]{16}$/.test(deviceId))
        return json({ ok: false, error: 'invalid_request' }, 400);
      const raw = await env.ORDERS.get('order:' + orderId);
      if (!raw) return json({ ok: false, error: 'order_not_found' }, 404);
      const order = JSON.parse(raw);
      if (order.binding && order.binding.deviceId !== deviceId)
        return json({ ok: false, error: 'bound_to_other_device' }, 409);
      if (!order.binding) {
        order.binding = { deviceId, at: new Date().toISOString() };
        await env.ORDERS.put('order:' + orderId, JSON.stringify(order));
      }
      return json({ ok: true, orderId, deviceId });
    }

    if (url.pathname === '/reset') {
      if (!env.ADMIN_TOKEN || request.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN)
        return json({ error: 'unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      const orderId = normalize(body.orderId);
      if (!orderId) return json({ ok: false, error: 'invalid_request' }, 400);
      const raw = await env.ORDERS.get('order:' + orderId);
      if (!raw) return json({ ok: false, error: 'order_not_found' }, 404);
      const order = JSON.parse(raw);
      order.binding = null;
      await env.ORDERS.put('order:' + orderId, JSON.stringify(order));
      return json({ ok: true, orderId });
    }

    return json({ error: 'not_found' }, 404);
  },
};
```

---

### Task 3: index.html shell + css/index.css + js/index.js

**Files:**
- Create/Modify: `index.html` (tulis ulang sebagai shell), `css/index.css`, `js/index.js`

**Interfaces:**
- Consumes: `APP_CONFIG`, `getDeviceFingerprint()`, `escapeHtml()`, `setMsg()`, `flashButton()`, `activateOrder()` (Task 1), endpoint Worker (Task 2).
- Produces: halaman app final; global handlers untuk markup statis (`activate`, `switchTab`, `swCk`, `tv`, `doLogout`, `ckAnthropic`, `ckOpenAI`, `ckGoogle`, `ckMistral`, `applyP`, `ckCustom`).

**Steps:**
1. `css/index.css`: port VERBATIM seluruh CSS lock screen, dashboard, tab, token card, tutorial, API checker dari `<style>` index.html lama (semua di luar yang sudah di common.css).
2. `index.html`: markup sama seperti lama, perubahan:
   - `<link>` ke `css/common.css` + `css/index.css`; `<script src>` bertingkat untuk 5 JS di akhir body.
   - HAPUS transfer-card & fungsi terkait; link "🔄 Ganti device?" diganti teks kontak penjual (`APP_CONFIG.SELLER_CONTACT` via JS).
   - Lock screen: tambah info "1 Order ID = 1 device, verifikasi otomatis".
3. `js/index.js`: port fungsi konten & API checker VERBATIM dari script lama dengan perubahan:
   - `activate()` baru: validasi input → `getDeviceFingerprint()` → `activateOrder(orderId, fp)` → handle `200` (simpan `{orderId, deviceId}` ke `localStorage[APP_CONFIG.SESSION_KEY]`, showDash) / `404` ("Order ID tidak ditemukan / belum dibayar") / `409` ("Order ID terdaftar di device lain — hubungi penjual") / network error sopan.
   - `init()`: baca sesi → fingerprint cocok → dashboard; else lock screen.
   - `renderTokens`/`renderTutorial`: semua nilai dari JSON lewat `escapeHtml()`; tombol salin via event delegation (`data-copy` pada container grid).
   - Hapus: `transfer card`, kode SECRET client, `doTransfer`, storage key lama `aitpro_*` → `APP_CONFIG.SESSION_KEY`.
4. Verifikasi: `node --check js/index.js` → PASS.

---

### Task 4: admin.html + css/admin.css + js/admin.js

**Files:**
- Create: `admin.html`, `css/admin.css`, `js/admin.js`
- (Menggantikan `adminpanel.html` + `keygen.html` — keduanya dihapus di Task 5)

**Interfaces:**
- Consumes: `APP_CONFIG`, `resetOrderBinding()`, `escapeHtml()`, `setMsg()`, `flashButton()`.
- Produksi: halaman tool penjual dengan 3 tab: Reset Binding, Riwayat, Panduan.

**Steps:**
1. `css/admin.css`: gabungan CSS yang dipakai dari `adminpanel.html` lama (wrap, card, form, result-box, tabs, history, warn/info-box) — port VERBATIM bagian yang dipakai.
2. `admin.html`: shell markup 3 tab + link CSS + 5 script.
3. `js/admin.js`:
   - Admin token: input password, disimpan di `localStorage['aitp_admin_token']`; tampil status token terisi.
   - `resetBinding()`: baca orderId + token → `resetOrderBinding()` → tampil hasil (ok/error) → simpan riwayat ke `APP_CONFIG.HIST_KEY` (maks 50, unshift).
   - Riwayat: render list, salin order ID, hapus item, hapus semua (event delegation).
   - Panduan: konten statis: setup webhook, URL worker, reset binding, keamanan.
4. Verifikasi: `node --check js/admin.js` → PASS.

---

### Task 5: Dokumentasi + cleanup file lama

**Files:**
- Create: `README.md`, `CLAUDE.md`, `AGENTS.md`
- Move: `free ai radar.jsx` → `archive/free-ai-radar.jsx` (rename tanpa spasi)
- Delete: `adminpanel.html`, `keygen.html`, `handoff.md`, `sync-instructions.sh`, `.claudeignore`

**Steps:**
1. `README.md`: overview produk, struktur folder, Setup (GitHub Pages, Worker via worker/README.md, edit `js/shared/config.js`, lynk.id webhook URL), workflow harian (update `content.json`), reset device, catatan keamanan jujur.
2. `CLAUDE.md` dan `AGENTS.md` (isi sama): konteks proyek, stack, konvensi (bahasa UI Indonesia, classic scripts, tanpa build tool, verifikasi `node --check`), daftar file & tanggung jawabnya.
3. Move & delete file sesuai daftar.
4. Verifikasi: `ls` struktur akhir sesuai spec; `node -e "JSON.parse(require('fs').readFileSync('content.json','utf8'))"` → PASS.

---

### Task 6: Verifikasi end-to-end lokal

**Steps:**
1. `node --check` seluruh `js/**/*.js` dan `worker/src/index.js` → semua PASS.
2. Serve lokal (`python -m http.server` / npx serve) + uji via browser (Playwright):
   - `index.html` render, lock screen muncul, konsol bersih.
   - Klik "Aktifkan" dengan Order ID dummy → pesan error jaringan sopan (Worker belum ada) — bukan crash.
   - `admin.html` render, konsol bersih.
3. Cek referensi: grep tidak ada lagi `aitpro_`, `SECRET`, `postfixadmin`, atau `handoff` di file produk.
4. Laporkan ke user hasil + daftar langkah manual yang harus mereka lakukan (deploy Worker, isi config, pasang webhook lynk.id).
