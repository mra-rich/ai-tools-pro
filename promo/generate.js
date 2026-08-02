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
  const thread = buildThread(d, dayOfYear);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, iso + '.json'), JSON.stringify({ date: iso, thread }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, iso + '.md'), thread);
  console.log('✅ Thread ' + iso + ' siap:');
  console.log(thread);
  console.log('\n---');
  console.log('Simpan di promo/threads/' + iso + '.md');
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });