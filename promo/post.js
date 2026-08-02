// ═════════════════════════════════════════════════════════════════
// post.js — Auto-post ke Threads.net lewat browser (Playwright)
//
// Mode:
//   node promo/post.js --login   → sekali: buka browser, kamu login manual,
//                                  sesi disimpan ke promo/profile.json
//   node promo/post.js            → otomatis (browser terlihat): generate+post
//   node promo/post.js --headless → otomatis tanpa jendela (untuk jadwal
//                                    Windows Task Scheduler).
//   node promo/post.js --dry-run  → jangan POST, cuma cek draft/sesi.
//
// Catatan: Threads API publik tidak ada → posting via UI browser dengan sesi
// login sendiri. JAGA sesi ini: jangan disebar, dan jangan posting berlebihan
// (1x/hari aman). Kalau jam berubah -> 1 post/menit terjadi dgn batas.
// ═════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const PROFILE = path.join(__dirname, 'profile.json');
const THREADS_DIR = path.join(__dirname, 'threads');

// Cari draft .md terbaru di folder threads
function latestDraft() {
  if (!fs.existsSync(THREADS_DIR)) return null;
  const files = fs.readdirSync(THREADS_DIR).filter((f) => f.endsWith('.md')).sort();
  if (!files.length) return null;
  const latest = files[files.length - 1];
  return { file: latest, text: fs.readFileSync(path.join(THREADS_DIR, latest), 'utf8') };
}

// ── LOGIN PERTAMA KALI (manual sekali) ──────────────────────────
async function doLogin() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  console.log('🌐 Buka threads.net — LOGIN manual lalu tutup browser.\nSesi akan disimpan ke ' + PROFILE);
  await page.goto('https://www.threads.net/');
  await page.waitForTimeout(2000);
  // tunggu sampai user menutup browser (sinyal: page ditutup) — batas 3 menit
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 180000);
    page.on('close', resolve);
    page.on('close', () => clearTimeout(t));
  });
  await ctx.storageState({ path: PROFILE });
  await browser.close();
  console.log('✅ Sesi tersimpan. Sekarang bisa `node promo/post.js --dry-run` untuk tes.');
}

// ── POST: muat sesi → buka editor → ketik → POST ──────────────────────
async function doPost() {
  if (!fs.existsSync(PROFILE)) {
    console.error('❌ Belum login. Jalankan dulu: node promo/post.js --login');
    process.exit(1);
  }
  const draft = latestDraft();
  if (!draft) { console.error('❌ Tidak ada draft .md di promo/threads/'); process.exit(1); }
  console.log('📄 Draft: ' + draft.file + '\n---\n' + draft.text + '\n---\n');

  const headless = process.argv.includes('--headless');
  const browser = await chromium.launch({ headless });
  const ctx = await browser.newContext({ storageState: PROFILE, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });

  await page.goto('https://www.threads.net/');
  await page.waitForTimeout(4000);

  // 1. buka komposer (button "Buat" / compose)
  const composeBtn = page.locator('[aria-label="Buat"], [aria-label="Create"], [d="M19 10.5V15l-1 2v4h-5v-2H9v2H4v-4l-1-2v-4.5L12 3l7 7.5z"]');
  if (await composeBtn.count()) await composeBtn.first().click();
  await page.waitForTimeout(2500);

  // 2. editor teks — klik area content lalu ketik
  const editor = page.locator('[contenteditable="true"], [role="textbox"]').first();
  await editor.click();
  await page.keyboard.type(draft.text, { delay: 20 });

  await page.waitForTimeout(1500);
  // screenshot draft di editor (bukti kalau ada error selector)
  await page.screenshot({ path: path.join(__dirname, 'preview.png') });

  // 3. cari tombol post: aria-label "Post" / "Kirim"
  const postBtn = page.locator('[aria-label="Post"], [aria-label="Kirim"], [data-testid="post_button"]').first();
  const hasPost = await postBtn.count();
  if (!hasPost) {
    console.error('❌ Tombol Post tidak ditemukan — cek promo/preview.png lalu perbaiki selector.');
    await browser.close();
    process.exit(1);
  }
  await postBtn.click();
  await page.waitForTimeout(4000);
  // konfirmasi: cek apakah masih ada editor atau ada notifikasi sukses
  const success = await page.locator('text=/posted|terposting|berhasil/i').count();
  await browser.close();
  console.log(success ? '✅ Diposting!' : '⚠️ Selesai — verifikasi manual: cek akunmu.');
  // tandai draft sudah diposting (jangan post ulang)
  fs.renameSync(path.join(THREADS_DIR, draft.file), draft.file + '.posted');
}

const isDry = process.argv.includes('--dry-run');
(async () => {
  if (process.argv.includes('--login')) return doLogin();
  if (isDry) {
    const draft = latestDraft();
    console.log('🔎 DRY-RUN — tidak akan dipost. Draft hari ini:');
    console.log(draft ? draft.text : 'tidak ada draft. jalankan: node promo/generate.js');
    return;
  }
  await doPost();
})().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });