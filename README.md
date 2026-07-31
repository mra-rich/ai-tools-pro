# AI Tools Pro

Produk digital yang dijual via [lynk.id](https://lynk.id): app statis berisi
**token AI gratis harian, tutorial, dan API Key Checker**. Pembeli mengaktifkan
akses dengan Order ID dari email konfirmasi — **sepenuhnya otomatis**, tanpa
kerja manual penjual.

## Arsitektur

```
Pembeli bayar ──► lynk.id ──webhook──► Cloudflare Worker (KV: order valid)
Pembeli buka app ──► index.html ──► POST /activate ──► Worker validasi + device-lock
Pembeli ganti HP ──► penjual buka admin.html ──► POST /reset ──► binding dilepas
```

- **Client**: static murni (HTML + CSS + vanilla JS), tanpa build tool. Host: GitHub Pages.
- **Server**: satu Cloudflare Worker (gratis) dengan KV storage — satu-satunya yang
  "tahu" Order ID mana yang benar-benar sudah dibayar.

## Struktur Folder

```
├── index.html              # App pembeli (lock + dashboard)
├── admin.html              # Tool penjual — JANGAN di-upload
├── content.json            # Konten dinamis (token, tutorial) — edit di GitHub
├── css/                    # common.css, index.css, admin.css
├── js/
│   ├── shared/             # config.js (SATU tempat setup), crypto.js, ui.js, api.js
│   ├── index.js
│   └── admin.js
├── worker/                 # Cloudflare Worker + panduan deploy (worker/README.md)
├── archive/                # File yang tidak dipakai produk
└── docs/superpowers/       # Spec desain & rencana implementasi
```

## Setup Awal (sekali saja)

1. **Deploy Worker** — ikuti 5 langkah di [`worker/README.md`](worker/README.md)
   (akun Cloudflare gratis, `npx wrangler deploy`, set KV + secret, pasang webhook di lynk.id).
2. **Isi konfigurasi** di `js/shared/config.js`:
   - `WORKER_URL` → URL worker dari langkah 1
   - `CONTENT_URL` → URL raw `content.json` di GitHub kamu
   - `LYNK_URL` → link produk di lynk.id
3. **Deploy GitHub Pages** — upload: `index.html`, `content.json`, `css/`, `js/`.
   **Jangan upload:** `admin.html`, `worker/`, `archive/`, `docs/`.
4. **Simpan admin.html** beserta folder `js/` dan `css/` di laptop pribadi.
5. **Isi Admin Token** di admin.html (tab Reset Binding) dengan nilai
   `ADMIN_TOKEN` yang sama seperti di Worker.

## Workflow Harian

| Aktivitas | Yang kamu lakukan |
|---|---|
| Pembeli membeli | **Tidak ada** — webhook + aktivasi otomatis |
| Update token/tutorial | `admin.html` → tab 📝 Konten → paste JSON → Simpan & Terbitkan |
| Pembeli ganti HP | `admin.html` → 🔄 Reset Binding → pembeli aktivasi ulang |

Konten asli (token API) disimpan di **KV Cloudflare**, bukan di repo — jadi key tidak
pernah terekspos di GitHub public. `content.json` di repo hanyalah template referensi.

## Catatan Keamanan (jujur)

- Validasi Order ID terjadi **di server** (Worker), bukan di file client yang bisa dibaca publik.
- Device-binding: 1 Order ID = 1 device aktif; ditegakkan oleh Worker.
- Ini proteksi level *paywall*, bukan DRM: pembeli sah tetap bisa screenshot/menyalin
  isi konten. Cukup untuk produk token-list; software bernilai tinggi butuh backend penuh.

## Pengembangan

Tidak ada build step. Verifikasi kode:

```bash
node --check js/index.js js/admin.js js/shared/*.js worker/src/index.js
```

Konvensi: UI berbahasa Indonesia, identifier berbahasa Inggris, classic script
(bukan ES module), urutan load `js/shared/…` sebelum `js/index.js|admin.js`.
