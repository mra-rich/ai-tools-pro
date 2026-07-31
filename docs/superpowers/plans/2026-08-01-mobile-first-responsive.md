# Mobile-First Responsive CSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat tampilan AI Tools Pro responsif mobile-first (360px+) dengan menambahkan media query dan menyesuaikan base styles di tiga file CSS tanpa menyentuh HTML/JS.

**Architecture:** Refactor `common.css`, `index.css`, dan `admin.css` menggunakan pendekatan mobile-first — base styles untuk layar kecil (≤599px), lalu `@media (min-width:600px)` untuk tablet/HP besar, dan `@media (min-width:900px)` untuk desktop. Tidak ada perubahan pada HTML atau JS.

**Tech Stack:** Pure CSS, tanpa build tool, tanpa library baru.

## Global Constraints

- Tidak boleh mengubah file HTML (index.html, admin.html) atau file JS sama sekali.
- Tidak boleh menambahkan dependency/library baru.
- Urutan load CSS tidak berubah: common.css → index.css / admin.css.
- Semua nilai warna dan token CSS tetap di `common.css` `:root`, tidak dipindah.
- Breakpoint: `600px` (tablet) dan `900px` (desktop) — min-width (mobile-first).
- Verifikasi sintaks: `node --check` tidak relevan untuk CSS; verifikasi manual dengan membuka browser.

---

## Task 1: common.css — Font & Body Base Mobile

**Files:**
- Modify: `css/common.css`

**Interfaces:**
- Produces: `body` dengan `font-size` fluid via `clamp()` yang di-inherit semua komponen.

- [ ] **Step 1: Tambah fluid font-size ke body**

Buka `css/common.css`. Ubah rule `body` dari:
```css
body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
```
Menjadi:
```css
body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); min-height:100vh; font-size:clamp(13px,3.8vw,16px); }
```

- [ ] **Step 2: Verifikasi**

Buka `index.html` di browser, resize ke 360px. Pastikan teks sedikit lebih kecil di mobile dan normal di desktop.

- [ ] **Step 3: Commit**

```bash
git add css/common.css
git commit -m "feat(css): fluid body font-size mobile-first"
```

---

## Task 2: index.css — Topbar & Tab Nav Mobile Fix

**Files:**
- Modify: `css/index.css`

**Interfaces:**
- Produces: `.topbar` yang tidak overflow di 360px, `.tab-nav` yang bisa scroll horizontal.

- [ ] **Step 1: Fix .topbar untuk mobile**

Di `css/index.css`, ubah rule `.topbar` dari:
```css
.topbar { display:flex;align-items:center;justify-content:space-between;padding:12px 22px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;gap:10px; }
```
Menjadi:
```css
.topbar { display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;gap:8px;flex-wrap:wrap; }
```

Tambahkan media query di akhir file (sebelum baris terakhir `.ck-msel:focus`):
```css
/* ── RESPONSIVE: 600px+ ── */
@media (min-width:600px) {
  .topbar { padding:12px 22px;gap:10px;flex-wrap:nowrap; }
}
```

- [ ] **Step 2: Fix .tab-nav untuk mobile — scroll horizontal**

Ubah rule `.tab-nav` dari:
```css
.tab-nav { display:flex;gap:3px;padding:14px 22px 0;background:var(--surface);border-bottom:1px solid var(--border); }
```
Menjadi:
```css
.tab-nav { display:flex;gap:3px;padding:10px 14px 0;background:var(--surface);border-bottom:1px solid var(--border);overflow-x:auto;-webkit-overflow-scrolling:touch; }
.tab-nav::-webkit-scrollbar { display:none; }
```

Tambahkan ke blok `@media (min-width:600px)` yang sudah dibuat di step 1:
```css
@media (min-width:600px) {
  .topbar { padding:12px 22px;gap:10px;flex-wrap:nowrap; }
  .tab-nav { padding:14px 22px 0;overflow-x:visible; }
}
```

- [ ] **Step 3: Fix .tab-btn untuk mobile**

Ubah rule `.tab-btn` dari:
```css
.tab-btn { padding:9px 16px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;margin-bottom:-1px;border-radius:7px 7px 0 0; }
```
Menjadi:
```css
.tab-btn { padding:8px 12px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text2);font-size:12px;font-weight:500;cursor:pointer;transition:all .2s;margin-bottom:-1px;border-radius:7px 7px 0 0;white-space:nowrap; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .tab-btn { padding:9px 16px;font-size:13px; }
```

- [ ] **Step 4: Fix .tab-pane padding mobile**

Ubah rule `.tab-pane` dari:
```css
.tab-pane { display:none;padding:22px;max-width:800px;margin:0 auto;width:100%; }
```
Menjadi:
```css
.tab-pane { display:none;padding:14px;max-width:800px;margin:0 auto;width:100%; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .tab-pane { padding:22px; }
```

- [ ] **Step 5: Verifikasi**

Buka `index.html` di browser setelah login (atau langsung resize dashboard). Di lebar 360px: topbar tidak overflow, tab bisa digeser kiri-kanan. Di 600px+: layout kembali normal.

- [ ] **Step 6: Commit**

```bash
git add css/index.css
git commit -m "feat(css): fix topbar dan tab-nav overflow di mobile"
```

---

## Task 3: index.css — Landing Page Hero & Stats Mobile

**Files:**
- Modify: `css/index.css`

**Interfaces:**
- Produces: `.lp-hero` padding lebih compact di mobile, `.lp-stats` gap lebih kecil.

- [ ] **Step 1: Fix .lp-hero padding mobile**

Ubah rule `.lp-hero` dari:
```css
.lp-hero { text-align:center;padding:74px 22px 34px; }
```
Menjadi:
```css
.lp-hero { text-align:center;padding:40px 16px 24px; }
```

Tambahkan ke blok `@media (min-width:600px)` yang sudah ada:
```css
  .lp-hero { padding:56px 22px 28px; }
```

Tambahkan blok `@media (min-width:900px)`:
```css
/* ── RESPONSIVE: 900px+ ── */
@media (min-width:900px) {
  .lp-hero { padding:74px 22px 34px; }
}
```

- [ ] **Step 2: Fix .lp-sub font-size mobile**

Ubah rule `.lp-sub` dari:
```css
.lp-sub { color:var(--text2);font-size:15px;line-height:1.7;max-width:620px;margin:0 auto 26px; }
```
Menjadi:
```css
.lp-sub { color:var(--text2);font-size:14px;line-height:1.7;max-width:620px;margin:0 auto 20px; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .lp-sub { font-size:15px;margin-bottom:26px; }
```

- [ ] **Step 3: Fix .lp-stats gap mobile**

Ubah rule `.lp-stats` dari:
```css
.lp-stats { display:flex;justify-content:center;gap:26px;flex-wrap:wrap;margin-bottom:30px; }
```
Menjadi:
```css
.lp-stats { display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-bottom:22px; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .lp-stats { gap:20px;margin-bottom:26px; }
```

Tambahkan ke blok `@media (min-width:900px)`:
```css
  .lp-stats { gap:26px;margin-bottom:30px; }
```

- [ ] **Step 4: Fix .lp-stat b font-size mobile**

Ubah rule `.lp-stat b` dari:
```css
.lp-stat b { display:block;font-size:22px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
```
Menjadi:
```css
.lp-stat b { display:block;font-size:18px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .lp-stat b { font-size:20px; }
```

Tambahkan ke blok `@media (min-width:900px)`:
```css
  .lp-stat b { font-size:22px; }
```

- [ ] **Step 5: Verifikasi**

Buka landing page di 360px. Hero tidak terlalu banyak whitespace, stats terlihat compact tapi tetap terbaca.

- [ ] **Step 6: Commit**

```bash
git add css/index.css
git commit -m "feat(css): landing hero dan stats responsif mobile-first"
```

---

## Task 4: index.css — Lock Card & Offer Section Mobile

**Files:**
- Modify: `css/index.css`

**Interfaces:**
- Produces: `.lock-top`, `.lock-body`, `.lp-offer`, `.btn-buy` yang nyaman di layar 360px.

- [ ] **Step 1: Fix .lock-top dan .lock-body padding mobile**

Ubah rule `.lock-top` dari:
```css
.lock-top { padding:32px 28px 24px; text-align:center; border-bottom:1px solid var(--border); background:linear-gradient(180deg,rgba(79,142,247,.06) 0%,transparent 100%); }
```
Menjadi:
```css
.lock-top { padding:22px 18px 18px; text-align:center; border-bottom:1px solid var(--border); background:linear-gradient(180deg,rgba(79,142,247,.06) 0%,transparent 100%); }
```

Ubah rule `.lock-body` dari:
```css
.lock-body { padding:24px 28px 28px; }
```
Menjadi:
```css
.lock-body { padding:18px 18px 22px; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .lock-top { padding:32px 28px 24px; }
  .lock-body { padding:24px 28px 28px; }
```

- [ ] **Step 2: Fix .lp-offer padding mobile**

Ubah rule `.lp-offer` dari:
```css
.lp-offer { background:linear-gradient(135deg,rgba(79,142,247,.1),rgba(160,106,248,.1));border:1px solid rgba(79,142,247,.3);border-radius:18px;
  padding:32px 26px;text-align:center;margin-bottom:40px; }
```
Menjadi:
```css
.lp-offer { background:linear-gradient(135deg,rgba(79,142,247,.1),rgba(160,106,248,.1));border:1px solid rgba(79,142,247,.3);border-radius:18px;
  padding:22px 16px;text-align:center;margin-bottom:28px; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .lp-offer { padding:32px 26px;margin-bottom:40px; }
```

- [ ] **Step 3: Fix .btn-buy ukuran mobile**

Ubah rule `.btn-buy` dari:
```css
.btn-buy { display:inline-flex;align-items:center;gap:9px;padding:14px 34px;background:var(--grad);border:none;border-radius:11px;color:#fff;
  font-size:16px;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .2s,transform .1s;box-shadow:0 8px 28px rgba(79,142,247,.35); }
```
Menjadi:
```css
.btn-buy { display:inline-flex;align-items:center;gap:9px;padding:12px 24px;background:var(--grad);border:none;border-radius:11px;color:#fff;
  font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .2s,transform .1s;box-shadow:0 8px 28px rgba(79,142,247,.35); }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .btn-buy { padding:14px 34px;font-size:16px; }
```

- [ ] **Step 4: Verifikasi**

Buka landing page di 360px. Lock card, offer section, dan tombol beli terlihat proporsional.

- [ ] **Step 5: Commit**

```bash
git add css/index.css
git commit -m "feat(css): lock card dan offer section responsif mobile"
```

---

## Task 5: index.css — API Checker & Onboarding Mobile

**Files:**
- Modify: `css/index.css`

**Interfaces:**
- Produces: `.ccard-hd`, `.cpname`, `.ob-path-hd` yang tidak cramped di 360px.

- [ ] **Step 1: Fix .ccard-hd font dan .cpname**

Tambahkan ke blok `@media (min-width:600px)` yang sudah ada rule lainnya:
```css
  .cpname { font-size:14px; }
```

Ubah base `.cpname` (rule sudah ada di index.css baris 121):
```css
.cpname { font-size:13px;font-weight:600; }
```

- [ ] **Step 2: Fix .ob-path-hd gap mobile**

Ubah rule `.ob-path-hd` dari:
```css
.ob-path-hd { padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px; }
```
Menjadi:
```css
.ob-path-hd { padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:8px; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .ob-path-hd { padding:16px 18px;gap:12px; }
```

- [ ] **Step 3: Fix .ob-path-ico emoji size mobile**

Ubah rule `.ob-path-ico` dari:
```css
.ob-path-ico { font-size:26px;flex-shrink:0; }
```
Menjadi:
```css
.ob-path-ico { font-size:20px;flex-shrink:0; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .ob-path-ico { font-size:26px; }
```

- [ ] **Step 4: Fix .ccard-bd padding mobile**

Ubah rule `.ccard-bd` dari:
```css
.ccard-bd { padding:18px; }
```
Menjadi:
```css
.ccard-bd { padding:14px; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .ccard-bd { padding:18px; }
```

- [ ] **Step 5: Verifikasi**

Buka tab "Cek API Key" di 360px. Card header tidak cramped, onboarding steps terbaca nyaman.

- [ ] **Step 6: Commit**

```bash
git add css/index.css
git commit -m "feat(css): API checker dan onboarding responsif mobile"
```

---

## Task 6: admin.css — Mobile Fix

**Files:**
- Modify: `css/admin.css`

**Interfaces:**
- Produces: Admin panel yang nyaman dipakai di HP (walau target utama desktop/seller).

- [ ] **Step 1: Fix body padding mobile**

Ubah rule `body` dari:
```css
body { padding:32px 16px; }
```
Menjadi:
```css
body { padding:16px 12px; }
```

Tambahkan di akhir file `css/admin.css`:
```css
/* ── RESPONSIVE: 600px+ ── */
@media (min-width:600px) {
  body { padding:32px 16px; }
}
```

- [ ] **Step 2: Fix .admin-tabs wrap di mobile**

Ubah rule `.admin-tabs` dari:
```css
.admin-tabs { display:flex;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:4px; }
```
Menjadi:
```css
.admin-tabs { display:flex;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:4px;flex-wrap:wrap; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .admin-tabs { flex-wrap:nowrap; }
```

- [ ] **Step 3: Fix .atab font-size mobile**

Ubah rule `.atab` dari:
```css
.atab { flex:1;padding:8px;background:none;border:none;color:var(--text2);font-size:12px;font-weight:500;cursor:pointer;border-radius:7px;transition:all .2s; }
```
Menjadi:
```css
.atab { flex:1;padding:7px 6px;background:none;border:none;color:var(--text2);font-size:11px;font-weight:500;cursor:pointer;border-radius:7px;transition:all .2s;min-width:fit-content; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .atab { padding:8px;font-size:12px; }
```

- [ ] **Step 4: Fix .res-key-row stack di mobile**

Ubah rule `.res-key-row` dari:
```css
.res-key-row { display:flex;align-items:center;gap:10px; }
```
Menjadi:
```css
.res-key-row { display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap; }
```

Tambahkan ke blok `@media (min-width:600px)`:
```css
  .res-key-row { align-items:center;flex-wrap:nowrap;gap:10px; }
```

- [ ] **Step 5: Verifikasi**

Buka `admin.html` di 360px. Body tidak overflow, tabs wrap dengan rapi, key result terbaca.

- [ ] **Step 6: Commit**

```bash
git add css/admin.css
git commit -m "feat(css): admin panel responsif mobile"
```

---

## Task 7: Final Polish & Verifikasi Lintas Device

**Files:**
- Modify: `css/index.css` (jika ada fix tambahan)

- [ ] **Step 1: Rangkum blok media query di index.css**

Pastikan dua blok media query di akhir `css/index.css` terurut dan tidak duplikat:
```css
/* ── RESPONSIVE: 600px+ ── */
@media (min-width:600px) {
  .topbar { padding:12px 22px;gap:10px;flex-wrap:nowrap; }
  .tab-nav { padding:14px 22px 0;overflow-x:visible; }
  .tab-btn { padding:9px 16px;font-size:13px; }
  .tab-pane { padding:22px; }
  .lp-hero { padding:56px 22px 28px; }
  .lp-sub { font-size:15px;margin-bottom:26px; }
  .lp-stats { gap:20px;margin-bottom:26px; }
  .lp-stat b { font-size:20px; }
  .lock-top { padding:32px 28px 24px; }
  .lock-body { padding:24px 28px 28px; }
  .lp-offer { padding:32px 26px;margin-bottom:40px; }
  .btn-buy { padding:14px 34px;font-size:16px; }
  .cpname { font-size:14px; }
  .ob-path-hd { padding:16px 18px;gap:12px; }
  .ob-path-ico { font-size:26px; }
  .ccard-bd { padding:18px; }
}

/* ── RESPONSIVE: 900px+ ── */
@media (min-width:900px) {
  .lp-hero { padding:74px 22px 34px; }
  .lp-stats { gap:26px;margin-bottom:30px; }
  .lp-stat b { font-size:22px; }
}
```

- [ ] **Step 2: Test di 360px (HP kecil)**

Checklist visual:
- [ ] Landing page hero tidak clipped, teks terbaca
- [ ] Stats row compact tapi tidak overflow
- [ ] Lock card tidak terpotong
- [ ] Dashboard topbar tidak overflow (brand dan logout terlihat)
- [ ] Tab nav bisa diswipe horizontal, tidak ada tab yang terpotong
- [ ] Tab pane content tidak terlalu mepet
- [ ] API checker card nyaman
- [ ] Offer/CTA section proporsional

- [ ] **Step 3: Test di 600px (HP besar / tablet)**

Checklist visual:
- [ ] Semua layout kembali ke proporsi desktop-normal
- [ ] Grid provider dan features tetap auto-fit
- [ ] Topbar kembali single row

- [ ] **Step 4: Test di 900px+ (desktop)**

Checklist visual:
- [ ] Landing page hero full padding
- [ ] Stats angka besar (22px)
- [ ] Semua komponen proporsional

- [ ] **Step 5: Verifikasi sintaks CSS tidak ada error**

Buka DevTools (F12) → Console. Pastikan tidak ada error CSS parse.

- [ ] **Step 6: Final commit**

```bash
git add css/index.css css/admin.css css/common.css
git commit -m "feat(css): mobile-first responsive selesai — breakpoint 600px & 900px"
```
