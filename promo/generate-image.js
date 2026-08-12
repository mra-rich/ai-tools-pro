// ═════════════════════════════════════════════════════════════════
// generate-image.js — Ilustrasi realistis untuk draft thread harian
// Alur: baca promo/threads/YYYY-MM-DD.json (output generate.js) →
//       bangun prompt visual → generate via Pollinations.ai (gratis,
//       tanpa key) → simpan lokal → COMMIT KE REPO (raw GitHub =
//       URL file langsung, bisa di-fetch Meta) → tulis
//       promo/threads/YYYY-MM-DD.image.json {url, prompt}.
//
// Kenapa bukan tmpfiles.org lagi: URL tmpfiles.org/<id>/<file> itu
// halaman VIEWER HTML, dan URL /dl/ cuma 302-redirect ke halaman itu.
// Meta Graph API selalu tolak (code 36001 "Unknown Image Format").
// raw.githubusercontent.com serve file asli (image/jpeg) → Meta terima.
//
// Kalau ada langkah yang gagal → tulis {url: null} → post-api.js
// tetap posting teks saja (gambar bonus, bukan penghalang).
//
// Pakai:  node promo/generate-image.js
// ═════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const THREADS_DIR = path.join(__dirname, 'threads');
const IMG_DIR = path.join(THREADS_DIR, 'images');
const RAW_BASE = 'https://raw.githubusercontent.com/mra-rich/ai-tools-pro/main/promo/threads/images';

// ── Baca draft JSON hari ini (output generate.js) ────────────────
function latestDraftJson() {
  if (!fs.existsSync(THREADS_DIR)) return null;
  const files = fs.readdirSync(THREADS_DIR)
    .filter((f) => f.endsWith('.json') && !f.includes('.image.'))
    .sort();
  if (!files.length) return null;
  const f = files[files.length - 1];
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(THREADS_DIR, f), 'utf8')); }
  catch (_) { return null; }
  return { file: f, data };
}

// ── Bangun prompt visual dari teks draft (realistis, bukan ilustrasi kartun) ─
// Ambil 1-2 kalimat awal teks → saring kata kunci → jadikan prompt foto.
function buildPrompt(text) {
  const base = String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*#`>\-•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  const known = [
    { kw: /kimi|moonshot/i, p: 'minimalist desk setup with a glowing AI chatbot screen, warm evening light, photorealistic' },
    { kw: /claude|anthropic|opus/i, p: 'developer writing code on a laptop with warm orange interface glow, coffee nearby, photorealistic' },
    { kw: /qwen|alibaba/i, p: 'futuristic data center corridor with rows of servers, blue LED lights, photorealistic' },
    { kw: /flux|gambar|video|musik/i, p: 'creative studio desk with drawing tablet and music equipment, colorful screen, photorealistic' },
    { kw: /coding|programmer|assistant/i, p: 'programmer coding on dual monitors in a cozy dark room, screen glow, photorealistic' },
    { kw: /token|biaya|harga|api/i, p: 'hand holding smartphone showing an analytics dashboard with charts, bright daylight, photorealistic' },
    { kw: /benchmark|skor|drama/i, p: 'close-up of a laptop screen showing charts and ranking tables, office setting, photorealistic' },
    { kw: /gratis|free|hemat/i, p: 'happy indonesian student with laptop and smartphone, bright modern cafe, photorealistic' },
    { kw: /jarvis|asisten|chatbot/i, p: 'friendly AI assistant hologram floating above a smartphone, soft blue glow, photorealistic' },
  ];

  for (const k of known) {
    if (k.kw.test(base)) return k.p + ', 4k, natural colors, no text overlay';
  }
  return 'modern technology workspace, laptop with AI dashboard on screen, natural lighting, photorealistic, 4k, no text overlay';
}

// ── Generate via Pollinations.ai (gratis, tanpa key) ─────────────
async function generateImage(prompt) {
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
    '?width=1024&height=1024&nologo=true&model=flux';
  const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error('Pollinations HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error('Gambar terlalu kecil (' + buf.length + 'B) — mungkin error');
  return buf;
}

// ── Commit gambar ke repo → URL raw GitHub (file asli, Meta terima) ─
// Di GitHub Actions, checkout@v5 sudah login pakai GITHUB_TOKEN
// (permissions: contents write) → git push origin main langsung jalan,
// tanpa perlu URL token eksplisit (mencegah token bocor di log).
function commitToRepo(relativePath) {
  execSync('git config user.name "github-actions[bot]"', { stdio: 'pipe' });
  execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"', { stdio: 'pipe' });
  execSync('git add ' + relativePath, { stdio: 'pipe' });
  execSync('git commit -m "chore(images): add thread illustration" --no-verify', { stdio: 'pipe' });
  // Rebase dulu kalau branch bergerak (workflow lain commit state sendiri)
  try { execSync('git pull --rebase origin main', { stdio: 'pipe', timeout: 30000 }); }
  catch (_) { /* pull gagal bukan fatal — push di bawah yang menentukan */ }
  execSync('git push origin main', { stdio: 'pipe', timeout: 60000 });
}

// Tunggu raw URL siap (CDN GitHub bisa delay beberapa detik setelah push).
// Meta akan fetch URL-nya; kalau 404 saat itu, postingan gagal. Jadi pastikan
// 200 dulu sebelum mengembalikan URL (maks ~2 menit, lalu fallback teks).
async function waitRawReady(rawUrl, maxSec = 120) {
  const deadline = Date.now() + maxSec * 1000;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(rawUrl, { method: 'HEAD', signal: AbortSignal.timeout(15000), redirect: 'follow' });
      lastStatus = res.status;
      if (res.ok) return true;
    } catch (e) {
      lastStatus = 'err:' + e.message.slice(0, 40);
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.log('⚠️  raw URL belum 200 dalam ' + maxSec + 's (status terakhir: ' + lastStatus + ')');
  return false;
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  const draft = latestDraftJson();
  if (!draft) {
    console.log('SKIP image: tidak ada draft JSON hari ini.');
    process.exit(0);
  }

  const date = draft.file.replace('.json', '');
  const text = draft.data.thread || '';
  const prompt = buildPrompt(text);
  console.log('🎨 Prompt visual:', prompt);

  let url = null;
  try {
    const buf = await generateImage(prompt);
    fs.mkdirSync(IMG_DIR, { recursive: true });
    const local = path.join(IMG_DIR, date + '.jpg');
    fs.writeFileSync(local, buf);
    console.log('🖼️  Gambar lokal:', local, '(' + buf.length + ' bytes)');

    // commit ke repo → raw URL (file asli, Meta pasti bisa fetch)
    const rel = path.relative(process.cwd(), local).replace(/\\/g, '/');
    const rawUrl = RAW_BASE + '/' + date + '.jpg';
    // Kalau file sudah pernah di-commit (run retry slot sama) → pakai URL lama,
    // jangan commit ulang (git commit "nothing to commit" = error).
    try {
      const head = await fetch(rawUrl, { method: 'HEAD', signal: AbortSignal.timeout(15000), redirect: 'follow' });
      if (head.ok) {
        console.log('🔗 URL raw (sudah ada):', rawUrl);
      } else {
        commitToRepo(rel);
        console.log('🔗 URL raw:', rawUrl);
      }
    } catch (_) {
      commitToRepo(rel);
      console.log('🔗 URL raw:', rawUrl);
    }

    if (await waitRawReady(rawUrl)) {
      url = rawUrl;
    } else {
      console.log('⚠️  raw URL belum siap — gambar di-skip, posting teks saja.');
    }
  } catch (e) {
    console.log('⚠️  Gambar gagal — posting teks saja. Detail:', e.message);
  }

  const out = path.join(THREADS_DIR, date + '.image.json');
  fs.writeFileSync(out, JSON.stringify({ date, prompt, url }, null, 2));
  console.log('✅ ' + out + (url ? '' : ' (url null → teks saja)'));
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
