# AI Tools Pro — Konteks untuk Agent Coding

Produk digital dijual via lynk.id. Static murni tanpa build tool + satu
Cloudflare Worker untuk validasi aktivasi. Baca `README.md` untuk arsitektur
lengkap.

## Prinsip Proyek

1. **Tanpa build tool** — file HTML/CSS/JS langsung jalan di GitHub Pages.
2. **Tanpa secret di client** — validasi Order ID hanya di Worker
   (`worker/src/index.js`). Jangan pernah menaruh SECRET/token di file client.
3. **`js/shared/config.js` adalah satu-satunya titik konfigurasi** client.
4. **Classic scripts, bukan ES module.** Urutan load:
   `js/shared/config.js → crypto.js → ui.js → api.js → js/index.js|admin.js`.
   Fungsi global didefinisikan dengan `function name()` di top-level.

## Tanggung Jawab File

| File | Tanggung jawab |
|---|---|
| `index.html` + `js/index.js` | App pembeli: aktivasi via Worker, token gratis, tutorial, API checker |
| `admin.html` + `js/admin.js` | Tool penjual: reset device-binding, riwayat, panduan. Jangan di-deploy |
| `js/shared/api.js` | Klien HTTP Worker: `activateOrder`, `resetOrderBinding` |
| `js/shared/crypto.js` | `sha256Hex`, `getDeviceFingerprint` (16 hex upper) |
| `js/shared/ui.js` | `escapeHtml`, `setMsg`, `flashButton` |
| `worker/src/index.js` | POST `/webhook`, `/activate`, `/reset` + KV `ORDERS` |
| `content.json` | Konten dinamis (token/tutorial) — format JANGAN diubah |

## Konvensi

- Bahasa UI: Indonesia. Identifier & kode: Inggris. Komentar: Indonesia.
- Semua data dari `content.json` wajib lewat `escapeHtml()` sebelum render.
- Binding device dienkapsulasi Worker — client hanya menyimpan sesi
  (`APP_CONFIG.SESSION_KEY` berisi `{orderId, deviceId}`).
- Named status/level map (misal `PILL_BY_STATUS`) untuk rendering berbasis data.

## Verifikasi

```bash
node --check js/index.js js/admin.js js/shared/*.js worker/src/index.js
```

Uji end-to-end butuh Worker ter-deploy — curl contoh di `worker/README.md`.
