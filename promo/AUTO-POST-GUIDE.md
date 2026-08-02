# 📚 Auto-Post Gratis — Panduan DIY Lengkap

Resep membangun sistem auto-posting konten harian **gratis total**, berjalan di
cloud (PC boleh mati), konten ditulis AI dari data asli. Panduan ini ditulis
berdasarkan implementasi nyata di repo ini (Threads), tetapi polanya bisa
dipakai untuk platform apa pun.

---

## 1. Arsitektur: 5 Lapis

```
┌─────────────────────────────────────────────────────────────┐
│ 1. JADWAL    GitHub Actions cron (cloud, gratis)            │
│ 2. SUMBER    Data asli (Worker DB / RSS / API apa pun)      │
│ 3. PENULIS   Gemini free tier → tulis konten + validasi     │
│              gagal/limit? → template fallback               │
│ 4. PENERBIT  API resmi platform (token di GitHub Secrets)   │
│ 5. STATE     commit balik marker *.posted (anti-dobel)      │
└─────────────────────────────────────────────────────────────┘
```

Data flow: **Scheduler → Generate (sumber+penulis) → Publish → Commit state.**

---

## 2. Peta File di Repo Ini

| File | Peran | Analogi di project lain |
|---|---|---|
| `.github/workflows/promo-threads.yml` | Scheduler + orkestrator | Copy ini, ganti langkahnya |
| `promo/generate.js` | SUMBER (baca Worker `/content/read`) + PENULIS (Gemini) | Ganti `readContent()` dengan sumbermu |
| `promo/post-api.js` | PENERBIT (Threads API resmi Meta) | Ganti dengan API platform target |
| `promo/viral-topics.js` | Bahan angle/topik viral (library manual) | Buat versimu sendiri atau kosongkan |
| `promo/threads-api.config.json` | Config lokal dev (GITIGNORED) | File config apa pun — jangan commit |
| `promo/threads/*.posted` | STATE anti-dobel (di-commit balik) | Pola state-nya reusable |

---

## 3. Rahasia: Kenapa Gratis?

| Komponen | Biaya | Paket gratis |
|---|---|---|
| GitHub Actions (public repo) | **Rp0** | Unlimited jadwal untuk repo publik |
| Gemini API | **Rp0** | ~1.500 request/hari free tier |
| Komputer | **Rp0** | Tidak butuh PC nyala, bukan server kamu |
| Penyimpanan state | **Rp0** | Commit balik ke repo itu sendiri |

Total biaya bulanan: **Rp0.**

---

## 4. Langkah Membangun Ulang (60–90 menit)

### Langkah 1 — Siapkan API platform

Setiap platform butuh:
- **App + token** (contoh Threads: Meta App → long-lived token 60 hari)
- **Endpoint posting** yang terdokumentasi resmi (JANGAN pakai scraping —
  rawan ban & butuh sesi login browser)

Buat file config lokal JSON (gitignored). Inilah bentuk idealnya:
```json
{ "app_id":"…", "app_secret":"…", "access_token":"…", "user_id":"…" }
```

### Langkah 2 — Tulis generator konten (`generate.js`-mu)

3 syarat wajib:
1. **Sumber data asli** — jangan biarkan AI mengarang; kirim data nyata
   (hasil DB/API/feed) di prompt
2. **Batasan ketat** — panjang (misal ≤500 char), larangan markdown &
   klaim palsu, wajib sebut nama dari data
3. **Validasi output** — panjang cek, format cek, klaim yang valid cek.
   Gagal? → **fallback template**, bukan crash

```js
// konsep intinya se-simple ini:
const aiText = await generateWithAI(data);  // null kalau gagal
const post = aiText || buildTemplate(data); // jaminan posting tetap ada
```

### Langkah 3 — Tulis penerbit (`post-api.js`-mu)

- Baca config dari **ENV** (mode CI) atau file lokal (mode dev)
- Terima token polos bila format tidak JSON (robustness)
- Posting → rename draft ke `*.posted` (anti-dobel)

### Langkah 4 — Tulis workflow YAML

Salin struktur ini:

```yaml
name: Auto Post Harian
on:
  schedule:
    - cron: '0 2 * * *'   # 09:00 WIB (selalu UTC! WIB−7)
  workflow_dispatch:
permissions:
  contents: write          # untuk commit state balik

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: '20' }

      - name: Generate
        env:
          MY_ADMIN_TOKEN: ${{ secrets.MY_ADMIN_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: node my-scripts/generate.js

      - name: Publish
        env:
          MY_PLATFORM_CONFIG: ${{ secrets.MY_PLATFORM_CONFIG }}
        run: node my-scripts/post.js

      - name: Commit state anti-dobel
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add 'my-scripts/threads/*.posted'
          git commit -m "chore: diposting [skip ci]" || echo "kosong"
          git push
```

⚠️ `[skip ci]` penting supaya commit balik tidak memicu loop workflow lain.

### Langkah 5 — Set .gitignore

```
my-scripts/config/*.json       # SEMUA file config
my-scripts/threads/*           # SEMUA draft & artifact
!my-scripts/threads/*.posted   # KECUALI marker state
```

### Langkah 6 — Set secrets di GitHub

Settings → Secrets and variables → Actions. Satu nama per token JSON.
Daftar nama persis harus cocok dengan YAML-mu. **Jangan pernah tampilkan
nilai secret di log, chat, atau code.**

### Langkah 7 — Tes

1. `--dry-run` lokal dulu (tampil draft tanpa posting)
2. `workflow_dispatch` manual di tab Actions
3. Cek: log hijau → marker `.posted` muncul di repo → konten tayang

---

## 5. Rumus Jam (Cron → WIB)

Cron GitHub **selalu UTC**. WIB = UTC + 7. Jadi: `WIB − 7 = UTC`.

| WIB | Cron |
|---|---|
| 07:00 | `0 0 * * *` |
| 12:00 | `0 5 * * *` |
| 18:00 | `0 11 * * *` |
| 21:00 | `0 14 * * *` |
| 23:30 | `30 16 * * *` |

- Format 5 kolom: `menit jam hari bulan hari-minggu` (* = semua)
- Scheduled run telat 5–15+ menit itu **normal**, bukan bug
- GitHub menonaktifkan jadwal di repo yang **60 hari tidak aktif** —
  selama repo-mu ada commit/workflow jalan, aman

---

## 6. Prompt AI yang "Tidak Kelihatan AI"

Kunci utama bukan ganti model, tapi **prompt dengan konteks angle**:

```
1. Kasih peran manusia:      "Kamu penulis Threads gaya teman, bukan AI."
2. Kasih bahan spesifik:     topik + f akta + cara gratis (bukan generik)
3. Larangan frasa klise:     "Tau gak sih?" "Yuk coba!" "Udah coba yang mana?"
4. Hook wajib faktual:       opening dengan angka/statement mengejutkan
5. Anti-repeat:              kirim post kemarin → "jangan ulangi angle ini"
6. Validasi programatik:     panjang + link wajib + nama nyata harus ada
```

Model gratis (Gemini 2.5 Flash) dengan `thinkingBudget: 0` sudah cukup.
Tanpa thinking → jawaban langsung, cepat, dan tidak verbose.

---

## 7. Checklist Anti-Rusak

- [ ] Tidak ada secret/token di file yang ter-commit (cek: `git log -p | grep THAA`)
- [ ] `.gitignore` menutup semua file credentials
- [ ] Validasi output AI → fallback template (posting tidak pernah hilang)
- [ ] Marker `*.posted` di-commit balik (tidak ada dobel post)
- [ ] 1–2 posting/hari MAKSIMAL (anti spam)
- [ ] Timeout pada semua fetch (60–120 detik)
- [ ] Error tidak mencetak isi secret ke log Actions
- [ ] Genius refresh: token Meta long-lived perlu refresh manual ≤60 hari

---

## 8. Modifikasi Umum

**Tambah platform baru** → buat `post-PLATFORM.js` baru (adapter), tetap pakai
`generate.js` yang sama. Panggil keduanya di satu workflow.

**Beda jam beda konten** → bikin `cron` kedua dengan env flag:
```yaml
- cron: '0 2 * * *'   # tips singkat
- cron: '0 11 * * *'  # tutorial panjang
```
Di generator: baca hour / hari-of-minggu lalu pilih angle yang berbeda.

**Isi dari RSS/berita** → ganti `readContent()` dengan fetch RSS → parse →
kirim berita terpanas hari ini sebagai "angle" ke Gemini.

---

> Dibuat berdasarkan implementasi nyata: sistem Tokengratis — Threads auto-post
> harian. Semua file contoh langsung ada di repo ini untuk dipelajari.
