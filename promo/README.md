# Auto-Promosi Threads — Tokengratis

Sistem posting harian otomatis ke Threads.net untuk mempromosikan
https://tokengratis.web.id — konten **dibuat dari data ASLI** (Worker `/content/read`),
bukan teks template statis.

**Jalan di cloud** (GitHub Actions, gratis) — PC boleh mati. Jadwal lokal
Windows tetap ada sebagai fallback.

## Komponen

| File | Fungsi |
|---|---|
| `../.github/workflows/promo-threads.yml` | Jadwal cloud tiap 09:00 WIB: generate → post → commit state |
| `generate.js` | Ambil data live dari Worker → buat 1 posting padat (<500 char, batas Threads). 80% topik viral (`viral-topics.js`), 20% klasik dari database |
| `post-api.js` | Poster via API resmi Meta (graph.threads.net) + auto-refresh token + reply-chain |
| `post.js` | Fallback auto-post via browser Playwright (bila API bermasalah) |
| `post-daily.bat` | Pipeline lokal (dipanggil Task Scheduler bila diset) |
| `setup-scheduler.bat` | Daftarkan Windows Task Scheduler tiap 09:00 (mode lokal) |

## Setup GitHub Actions (DEFAULT — cloud, PC tidak harus nyala)

1. Copy isi `scret.txt` bagian ADMIN_TOKEN → GitHub repo → **Settings →
   Secrets and variables → Actions → New repository secret**:
   - `AITP_ADMIN_TOKEN` = token ADMIN mu
   - `THREADS_API_CONFIG` = **seluruh isi** `promo/threads-api.config.json`
     (JSON utuh: app_id + app_secret + access_token + user_id)
2. Push repo → workflow aktif tiap 09:00 WIB, atau klik **Actions →
   Promo Threads Harian → Run workflow** untuk tes manual.
3. Marker `promo/threads/*.posted` di-commit balik otomatis → anti dobel post.

### Refresh token (WAJIB tiap <60 hari — manual dari lokal)

GitHub Actions tidak bisa menulis balik secret, jadi tiap ~50 hari jalankan
**di PC**:
```bat
node promo/post-api.js --refresh
```
lalu copy `access_token` baru dari `promo/threads-api.config.json` → update
secret `THREADS_API_CONFIG` di GitHub. (Token Meta long-lived = 60 hari;
lewat 60 hari harus OAuth ulang.)

## Setup lokal (opsional, fallback bila Actions mati)

### Mode API
1. Buat Meta App "Threads" → ambil App ID + App Secret → arahkan OAuth → dapat
   **long-lived token** (60 hari).
2. Buat `promo/threads-api.config.json` (gitignored — jangan commit):
   ```json
   {
     "app_id": "…", "app_secret": "…",
     "access_token": "…", "user_id": ""
   }
   ```
   user_id bisa dikosongkan — post-api.js akan autocurate dari `GET /me`.
3. `node promo/post-api.js --dry-run` → cek draft + token valid
4. `node promo/post-api.js` → posting pertama manual
5. `setup-scheduler.bat` (admin) → jadwal harian 09:00 otomatis (butuh PC nyala)

### Mode Browser (fallback kalau API bermasalah)
`post.js --login` sekali lalu pakai `post.js` (headless-mode tersedia).

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