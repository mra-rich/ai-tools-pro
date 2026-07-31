# Design: Refaktor AI Tools Pro + Sistem Aktivasi Otomatis

**Tanggal:** 2026-07-31
**Status:** Disetujui user (2026-07-31)

## Latar Belakang

Proyek "AI Tools Pro" adalah produk digital yang dijual via lynk.id — app statis (GitHub Pages)
berisi daftar token AI gratis harian, tutorial, dan API Key Checker. Kode awal dibuat acak:
CSS/JS inline besar, duplikasi antar file, aktivasi tanpa validasi (Order ID apapun diterima),
dan beberapa file yatim (`free ai radar.jsx`, `keygen.html` yang tidak pernah dipakai).

## Tujuan

1. Restrukturisasi ke standar profesional: file terpisah (HTML shell / CSS / JS), static murni tanpa build tool.
2. Aktivasi otomatis penuh: pembeli aktif langsung setelah bayar di lynk.id, tanpa kerja manual penjual.
3. Validasi nyata: Order ID diverifikasi server-side, device-binding otomatis.
4. Dokumentasi produk nyata menggantikan file workflow agent yang tidak terpakai.

## Keputusan Desain (dari sesi brainstorming)

| Keputusan | Pilihan |
|---|---|
| Scope refaktor | Produk AI Tools Pro saja (index, admin, content.json) |
| Struktur teknis | Static murni, file terpisah, tanpa build tool |
| Sistem aktivasi | Webhook lynk.id + Cloudflare Worker (gratis) |
| File workflow agent | Diganti dokumentasi produk (README, CLAUDE.md, AGENTS.md) |

## Arsitektur

```
lynk.id ──bayar sukses──► WEBHOOK ──► Cloudflare Worker
                                          ├─ KV "ORDERS": order valid
                                          └─ binding orderId → deviceId
index.html (GitHub Pages) ──► POST /activate {orderId, deviceId}
admin.html  (offline)     ──► POST /reset {orderId} + header X-Admin-Token
```

### Alur pembelian (0 kerja manual)
1. Pembeli bayar → lynk.id kirim webhook ke Worker → Worker catat Order ID valid di KV.
2. Pembeli buka app → input Order ID → app kirim `{orderId, deviceId}` ke Worker.
3. Worker cek validitas & binding atomik → sukses → dashboard terbuka, sesi tersimpan.
4. Device terikat permanen; Order ID sama di device lain → ditolak (HTTP 409).

### Alur ganti device
Pembeli kirim Order ID ke penjual → penjual buka `admin.html` → Reset Binding
(dengan admin token) → pembeli aktifkan ulang di device baru.

## Struktur Folder

```
free ai model/
├── index.html  admin.html           # shell markup saja
├── css/        common.css index.css admin.css
├── js/
│   ├── shared/ config.js crypto.js ui.js api.js
│   ├── index.js
│   └── admin.js
├── worker/
│   ├── src/index.js                 # routes: POST /webhook /activate /reset
│   ├── wrangler.toml
│   └── README.md                    # panduan deploy 5 langkah
├── content.json                     # format tidak berubah
├── README.md CLAUDE.md AGENTS.md
├── docs/superpowers/specs/ plans/
└── archive/free-ai-radar.jsx        # file yatim, diarsipkan
```

Dihapus: `adminpanel.html`, `keygen.html` (digantikan `admin.html`), `handoff.md`,
`sync-instructions.sh`, `.claudeignore` (kosong). `CLAUDE.md`/`AGENTS.md` kosong diganti isi nyata.

## Antarmuka Worker

| Endpoint | Auth | Body | Respons |
|---|---|---|---|
| `POST /webhook?key=WEBHOOK_SECRET` | query key | payload lynk.id | `{ok, orderId}` — catat order valid |
| `POST /activate` | — | `{orderId, deviceId}` | `{ok:true}` / `409 bound_to_other_device` / `404 order_not_found` |
| `POST /reset` | `X-Admin-Token` | `{orderId}` | `{ok:true}` — hapus binding |

- `orderId` dinormalisasi UPPERCASE-trim.
- `deviceId` = fingerprint browser (16 hex uppercase, dari komposisi UA/lang/hardware/screen/timezone/WebGL vendor + SHA-256).
- KV value per order: `{orderId, product, buyer, paidAt, binding: {deviceId, at} | null}`.
- Webhook payload parsing defensif (field order id dicari dari beberapa kemungkinan nama field);
- SECRET/aset sensitif hanya di env Worker, tidak ada di file client.

## Antarmuka JS Client (global script klasik, urutan load)

```
config.js  → APP_CONFIG {WORKER_URL, CONTENT_URL, LYNK_URL, SELLER_CONTACT, SESSION_KEY, HIST_KEY}
crypto.js  → sha256Hex(text), getDeviceFingerprint()
ui.js      → escapeHtml(s), setMsg(el, text, type), flashButton(btn, labelOk)
api.js     → apiPost(path, body, extraHeaders), activateOrder(orderId, deviceId), resetOrderBinding(orderId, adminToken)
```

## Non-goal / YANG TIDAK BERUBAH

- Fitur Token Gratis, Tutorial, API Key Checker (5 provider + preset custom) — logika sama.
- Visual/tema — CSS dipindah apa adanya (hanya dipecah ke file).
- Format `content.json`.

## Catatan Keamanan (jujur, didokumentasikan di README)

Ini proteksi level "paywall": Order ID valid divalidasi server, device-binding ditegakkan Worker.
Tidak mencegah pembeli sah membagikan isi konten — cukup untuk produk token-list,
bukan untuk software bernilai tinggi (itu butuh DRM + backend penuh).

## Testing / Verifikasi

- `node --check` semua file JS.
- JSON parse check `content.json`.
- Serve lokal + uji browser: lock screen render, aktivasi menampilkan error jaringan yang sopan
  saat Worker belum dideploy, dashboard render via stub, admin panel render.
- Uji Worker end-to-end setelah user deploy (curl di worker/README.md).
