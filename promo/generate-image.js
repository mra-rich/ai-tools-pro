// ═════════════════════════════════════════════════════════════════
// generate-image.js — Ilustrasi realistis untuk draft thread harian
// Alur: baca promo/threads/YYYY-MM-DD.json (output generate.js) →
//       bangun prompt visual → generate via Pollinations.ai (gratis,
//       tanpa key) → upload ke tmpfiles.org (URL publik stabil) →
//       tulis promo/threads/YYYY-MM-DD.image.json {url, prompt}.
//
// Kalau ada langkah yang gagal → tulis {url: null} → post-api.js
// tetap posting teks saja (gambar bonus, bukan penghalang).
//
// Pakai:  node promo/generate-image.js
// ═════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const THREADS_DIR = path.join(__dirname, 'threads');
const IMG_DIR = path.join(THREADS_DIR, 'images');

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

// ── Upload ke tmpfiles.org (URL publik, tanpa key) ───────────────
async function uploadTmpfiles(buf, filename) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'image/jpeg' }), filename);
  const res = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST', body: fd, signal: AbortSignal.timeout(60000),
  });
  const txt = await res.text();
  let j;
  try { j = JSON.parse(txt); } catch (_) { throw new Error('tmpfiles respon bukan JSON: ' + txt.slice(0, 120)); }
  if (!j.data || !j.data.url) throw new Error('tmpfiles gagal: ' + txt.slice(0, 120));
  // URL langsung tanpa /dl (redirect menuju file asli)
  return j.data.url;
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

    url = await uploadTmpfiles(buf, date + '.jpg');
    console.log('🔗 URL publik:', url);
  } catch (e) {
    console.log('⚠️  Gambar gagal — posting teks saja. Detail:', e.message);
  }

  const out = path.join(THREADS_DIR, date + '.image.json');
  fs.writeFileSync(out, JSON.stringify({ date, prompt, url }, null, 2));
  console.log('✅ ' + out + (url ? '' : ' (url null → teks saja)'));
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
