// ═════════════════════════════════════════════════════════════════
// generate.js — Generator konten thread promosi (Node, tanpa build)
// Ambil data ASLI dari Worker (content:latest di KV) → buat 1 thread
// harian dengan topik berputar + CTA ke tokengratis.web.id.
//
// Pakai:  node promo/generate.js
// Output: promo/threads/YYYY-MM-DD.json + .md (draft untuk review)
// Dependensi: Node 18+ (fetch bawaan). Tanpa npm install.
// ═════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { VIRAL_TOPICS, getViralTopic } = require('./viral-topics.js');

const WORKER = 'https://ai-tools-pro.rodliarif.workers.dev';
const SITE = 'https://tokengratis.web.id';
const OUT_DIR = path.join(__dirname, 'threads');

// ── Ambil konten live dari KV (bukan admin-content.json — supaya fresh) ─
// Endpoint /content/read butuh ADMIN_TOKEN; dibaca dari env AITP_ADMIN_TOKEN
// atau dari scret.txt lokal (gitignored — JANGAN commit token ke repo).
function getAdminToken() {
  if (process.env.AITP_ADMIN_TOKEN) return process.env.AITP_ADMIN_TOKEN;
  const p = path.join(__dirname, '..', 'scret.txt');
  if (fs.existsSync(p)) {
    const m = fs.readFileSync(p, 'utf8').match(/ADMIN_TOKEN\s*=\s*([A-Fa-f0-9]{32,})/);
    if (m) return m[1];
  }
  return '';
}

async function readContent() {
  const res = await fetch(WORKER + '/content/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getAdminToken() },
    signal: AbortSignal.timeout(60000), // batas 60 detik — jangan ngaco menggantung di CI
  });
  const text = await res.text();
  if (res.status !== 200) throw new Error('read content gagal: HTTP ' + res.status + ' ' + text.slice(0, 120));
  return JSON.parse(text);
}

// ── Util kecil ─────────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuf(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function cap(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function badgeLabel(b) {
  const m = { 'NO KARTU': 'tanpa kartu', 'KREDIT GRATIS': 'dapat kredit', 'FREEMIUM': 'freemium' };
  return m[b] || b;
}

// ── Generate pakai Gemini API (konten baru tiap hari, bukan template) ──
// Key dibaca dari env GEMINI_API_KEY (GitHub Secret di CI). Kalau key kosong
// / API gagal / output tidak lolos validasi → null → caller pakai template.
const GEMINI_MODEL = 'gemini-2.5-flash';

// Gaya tulisan diputar per hari supaya feed tidak monoton
const STYLES = [
  'listicle singkat (bullet poin provider terbaik hari ini)',
  'cerita mini/anekdot pembuka yang relate lalu kasih daftar provider',
  'myth-busting: bantah anggapan "AI gratis = jelek" pakai contoh nyata',
  'perbandingan 2-3 provider langsung (kelebihan/limit gratis masing-masing)',
  'satu fakta mengejutkan tentang satu provider, lalu sebut alternatif lain',
  'mini tutorial: cara ambil API key gratis di satu provider tertentu',
  'pertanyaan polling pembuka lalu tunjukkan jawaban + provider terkait',
];

function buildGeminiPrompt(d, dayOfYear) {
  const providers = d.providers || [];
  const snapshot = shuf(providers).slice(0, 30)
    .map((p) => `- ${p.nama} [${p.kategori}${p.badge ? ' | ' + p.badge : ''}]: ${cap(p.deskripsi || '', 80)}`)
    .join('\n');
  const style = STYLES[dayOfYear % STYLES.length];

  // Anti-repeat: kirim isi post terakhir supaya LLM tidak menulis ulang
  let prev = '';
  try {
    if (fs.existsSync(OUT_DIR)) {
      const posted = fs.readdirSync(OUT_DIR)
        .filter((f) => f.endsWith('.posted') && f.endsWith('.md.posted')).sort();
      if (posted.length) prev = fs.readFileSync(path.join(OUT_DIR, posted[posted.length - 1]), 'utf8');
    }
  } catch (_) { /* abaikan */ }

  return `Kamu penulis konten Threads untuk akun promosi situs direktori provider AI GRATIS bernama tokengratis.web.id.

DATA ASLI dari database hari ini (HANYA boleh sebut nama/angka dari sini, dilarang mengarang provider baru):
Jumlah provider total: ${providers.length}
Daftar (sampel):
${snapshot}

TUGAS — tulis 1 posting Threads dalam Bahasa Indonesia santai (gaul tapi sopan, pakai "kamu", emoji maksimal 3):
- Gaya: ${style}
- Panjang MAKSIMAL 480 karakter total (Threads limit 500, wajib)
- Wajib menyebut minimal 2 provider dari data di atas dengan nama persis
- Wajib diakhiri link ini persis di baris sendiri: ${SITE}
- Wajib mengandung 1 kalimat ajakan komen (pertanyaan) sebagai penutup
- DILARANG: klaim palsu/angka karangan, hashtag, markdown (**, ##, kode blok), bahasa campuran
${prev ? '\nPosting kemarin (JANGAN mirip/ulang angle ini):\n' + prev + '\n' : ''}
Balas HANYA dengan teks posting siap terbit, tanpa pembuka/penjelasan.`;
}

async function generateWithGemini(d, dayOfYear) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.log('ℹ️  GEMINI_API_KEY kosong — pakai template.'); return null; }

  let res;
  try {
    res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildGeminiPrompt(d, dayOfYear) }] }],
          generationConfig: { temperature: 0.9 },
        }),
        signal: AbortSignal.timeout(120000), // batas 2 menit — lewat itu fallback template
      }
    );
  } catch (e) {
    console.log('⚠️  Gemini error/timeout (' + e.message + ') — fallback template.');
    return null;
  }
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200) {
    console.log('⚠️  Gemini gagal (HTTP ' + res.status + '): ' + JSON.stringify(body).slice(0, 200));
    return null;
  }
  let text = (((body.candidates || [])[0] || {}).content || {}).parts
    ?.map((p) => p.text || '').join('').trim() || '';

  // Sanitize: buang markdown yang lolos (**, ##, `, kode blok)
  text = text.replace(/```[\s\S]*?```/g, '').replace(/[*#`]/g, '').trim();

  // Validasi: batas char, link wajib, dan minimal menyebut 1 nama provider asli
  const names = (d.providers || []).map((p) => p.nama);
  if (!text) { console.log('⚠️  Gemini output kosong — fallback template.'); return null; }
  if (text.length > 500) { console.log('⚠️  Gemini kepanjangan (' + text.length + ' char) — fallback.'); return null; }
  if (!text.includes(SITE)) { console.log('⚠️  Output tidak memuat link situs — fallback.'); return null; }
  if (!names.some((n) => text.includes(n))) { console.log('⚠️  Output tanpa nama provider asli — fallback.'); return null; }

  return text;
}

// ── Bangun thread (versi VIRAL) ────────────────────────────────
// Strategi: 80% topik viral dari viral-topics.js, 20% klasik dari database
// (menghindari akun kelihatan "template"). Hook tinggi, selalu CTA pertanyaan.
function buildThread(d, dayOfYear) {
  const providers = d.providers || [];

  // 4 dari 5 hari pakai topik viral (bukan 100% supaya feed tidak monoton)
  const useViral = (dayOfYear % 5) < 4;

  if (useViral) {
    const t = VIRAL_TOPICS[dayOfYear % VIRAL_TOPICS.length];
    const hook = t.hook();
    const facts = (t.facts || []).slice(0, 4).join('\n');
    const freePaths = (t.freePath || []).slice(0, 4).join('\n');

    return `${hook}

${facts}

Cara dapat GRATIS-nya:
${freePaths}

Database 110+ provider gratis & tutorialnya:
${SITE}

${t.ctaQ}`;
  }

  // fallback klasik (hari ke-4)
  const byCat = (id) => providers.filter((p) => p.kategori === id);
  const api = byCat('api');
  const list = (api.length ? api : providers).slice(0, 4)
    .map((p) => `• ${p.nama}${p.badge ? ' (' + badgeLabel(p.badge) + ')' : ''}: ${cap(p.deskripsi || '', 70)}`)
    .join('\n');

  return `🔑 "Nggak usah langganan banyak-banyak..." — kata temanku yang ternyata benar.

4 provider AI gratis yang saya cek hari ini:

${list}

Database 110+ provider & tutorial ambil key sendiri:
${SITE}

Yang mana yang baru pertama kamu dengar? Komen!`;
}

// ── Format penyimpanan ─────────────────────────────────────────
async function main() {
  const d = await readContent();
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);

  // Prioritas: konten ditulis Gemini (AI) → fallback template bila gagal
  const aiText = await generateWithGemini(d, dayOfYear);
  const thread = aiText || buildThread(d, dayOfYear);
  console.log(aiText ? '🤖 Ditulis Gemini (' + GEMINI_MODEL + ')' : '📋 Dari template cadangan');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, iso + '.json'), JSON.stringify({ date: iso, thread }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, iso + '.md'), thread);
  console.log('✅ Thread ' + iso + ' siap:');
  console.log(thread);
  console.log('\n---');
  console.log('Simpan di promo/threads/' + iso + '.md');
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });