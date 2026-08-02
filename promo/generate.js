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

// ── Bangun thread dari data nyata ──────────────────────────────
// Strategi anti-bosan: rotasi 7 topik berbeda, item dipilih acak per hari,
// sehingga 2 hari berturut-turut isinya tidak sama.
// Catatan Threads: 500 char max per post → output 1 post padat (bukan multi-reply;
// posting berantai via UI rapuh & rawan trigger spam).
function buildThread(d, dayOfYear) {
  const providers = d.providers || [];
  const byCat = (id) => providers.filter((p) => p.kategori === id);
  const api = byCat('api'), chat = byCat('chat'), coding = byCat('coding'), builder = byCat('builder');
  const models = d.topModels || [];
  const t = d.tutorial || [];

  const topic = [
    'api-free', 'chat-free', 'coding-free', 'app-builder', 'ranking', 'tutorial', 'fakta'
  ][((dayOfYear % 7) + 7) % 7];

  // potong baris panjang 1 item, supaya 3-4 item muat dalam 500 char
  let body = '';
  if (topic === 'api-free') {
    body = shuf(api).slice(0, 4).map((p) => `• ${p.nama}${p.badge ? ' (' + badgeLabel(p.badge) + ')' : ''}: ${cap(p.deskripsi || '', 60)}`).join('\n');
  } else if (topic === 'chat-free') {
    body = (chat.length ? chat : providers).slice(0, 4).map((p) => `• 💬 ${p.nama}: ${cap(p.deskripsi || '', 70)}`).join('\n');
  } else if (topic === 'coding-free') {
    body = (coding.length ? coding : providers).slice(0, 4).map((p) => `• 💻 ${p.nama}: ${cap(p.deskripsi || '', 70)}`).join('\n');
  } else if (topic === 'app-builder') {
    body = (builder.length ? builder : providers).slice(0, 4).map((p) => `• 🏗️ ${p.nama}: ${cap(p.deskripsi || '', 70)}`).join('\n');
  } else if (topic === 'ranking') {
    body = shuf(models).slice(0, 5).map((m) => `• [${m.tier}] ${m.nama}${m.benchmark ? ' — ' + m.benchmark : ''}`).join('\n');
  } else if (topic === 'tutorial') {
    body = shuf(t).slice(0, 3).map((tt) => `• ${tt.judul}: ${cap(tt.desc || '', 60)}`).join('\n');
  } else {
    body = [
      `Ada ${api.length} provider API gratis di database.`,
      `${models.length} model top diranking S/A/B.`,
      `${chat.length} situs chat tanpa kartu kredit.`,
    ].join('\n');
  }

  const line1 = '🔑 AI Gratis — legal & langsung pakai.\n' + body;
  const cta = `\n\n📦 Database 110+ provider + tutorial: ${SITE}`;
  return cap(line1 + cta, 490);
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