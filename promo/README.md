# Auto-Promosi Threads — Tokengratis

Sistem posting harian otomatis ke Threads.net untuk mempromosikan
https://tokengratis.web.id — konten **dibuat dari data ASLI** (Worker `/content/read`),
bukan teks template statis.

## Komponen

| File | Fungsi |
|---|---|
| `generate.js` | Ambil data live dari Worker → buat 1 posting padat (<500 char, batas Threads). Topik berputar 7 hari: API gratis, chat, coding, app builder, ranking S/A/B, tutorial, fakta. |
| `post.js` | Auto-post via browser Playwright: muat sesi login → buka threads.net → tulis → Post |
| `post-daily.bat` | Pipeline harian: generate → post → log ke `promo/post.log` |
| `setup-scheduler.bat` | Daftarkan Windows Task Scheduler tiap 09:00 (sekali saja, run as admin) |

## Setup (sekali saja)

1. **Install Playwright browser** (unduh Chromium):
   ```
   cd promo
   npm install playwright-core
   npx playwright-core install chromium
   ```
2. **Login** (buka browser, login manual Threads, tutup setelah login):
   ```
   node promo/post.js --login
   ```
3. **Tes aman** (cek draft + sesi, TANPA posting):
   ```
   node promo/post.js --dry-run
   ```
4. **Daftarkan jadwal** — klik-kanan `setup-scheduler.bat` → Run as administrator
5. **Posting pertama manual** (pastikan lancar sebelum diserahkan ke jadwal):
   ```
   node promo/post.js
   ```

Setelah itu berjalan otomatis tiap **09:00** (Task Scheduler → AI Tools Pro\PromoThreads Harian).
Hasil tiap siklus terekam di `promo/post.log`.

## ⚠️ Keamanan

- `promo/profile.json` berisi **sesi login Threads-mu** — file ini di-gitignore, JANGAN
  pernah di-commit atau dibagikan.
- Draft yang sudah diposting direname jadi `*.md.posted` supaya tidak dobel post.

## Cara kerja `generate.js`

- Ambil konten **asli** via `POST /content/read` (butuh ADMIN_TOKEN — dibaca dari
  `scret.txt` lokal, tidak di-commit).
- Bangun 1 posting sesuai batas 500 karakter Threads.
- Topik berputar 7 hari + item acak → 2 hari berturut-turut isinya beda.
- Semua item adalah nama/angka nyata dari database, bukan klaim palsu.

## Batas & saran

- Threads membatasi **500 char/posting** → sistem ini membuat 1 post padat per hari.
  (Posting berantai multi-reply dimungkinkan tapi via UI rapuh & rawan trigger spam.)
- 1 post/hari = wajar & tidak mencurigakan. Jangan post lebih sering.
- Kalau ada update besar di database, jalankan saja `node promo/generate.js` lagi
  untuk draft ekstra, lalu post manual di hari yang sama.