// ═════════════════════════════════════════════════════════════════
// update-content.js — Update OTOMATIS database tokengratis.web.id.
// Tidak ada manual: baca content:latest dari Worker → riset provider
// AI gratis baru dari HN/RSS → Gemini menyarankan 1–2 provider baru
// lengkap (nama/kategori/badge/deskripsi/limit/url/cara) → verifikasi
// URL hidup & tidak duplikat → POST /content/update ke Worker.
//
// Pakai:  node promo/update-content.js
// Env:    AITP_ADMIN_TOKEN (wajib — untuk /content/read & /content/update)
//         GEMINI_API_KEY   (opsional — tanpa ini hanya cleanup, aman)
// ═════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const GEMINI_MODEL = 'gemini-2.5-flash';
const WORKER = 'https://ai-tools-pro.rodliarif.workers.dev';
const MAX_NEW_PER_RUN = 2;   // hati-hati: jangan banjiri database

const RSS_FEEDS = [
  'https://hnrss.org/newest?q=AI&points=50',
  'https://hnrss.org/show?q=AI&points=30',
  'https://hnrss.org/newest?q=%22Show+HN%22+AI+free',
  'https://techcrunch.com/category/artificial-intelligence/feed/',
  'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  'https://www.marktechpost.com/feed/',
];

function getToken() {
  if (process.env.AITP_ADMIN_TOKEN) return process.env.AITP_ADMIN_TOKEN;
  const p = path.join(__dirname, '..', 'scret.txt');
  if (fs.existsSync(p)) {
    const m = fs.readFileSync(p, 'utf8').match(/ADMIN_TOKEN\s*=\s*([A-Fa-f0-9]{32,})/);
    if (m) return m[1];
  }
  return '';
}

async function fetchRSS(url, limit = 12) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; update-content/1.0; +https://tokengratis.web.id)' },
      redirect: 'follow',
    });
    if (!res.ok) return [];
    const text = await res.text();
    const items = [];
    const reItem = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
    let m;
    while ((m = reItem.exec(text)) !== null && items.length < limit) {
      const block = m[1];
      const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
      const link = (block.match(/<link[^>]*href="([^"]+)"/i) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '';
      if (!title) continue;
      items.push({ title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(), url: link.trim() });
    }
    return items;
  } catch { return []; }
}

async function readContent() {
  const res = await fetch(WORKER + '/content/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getToken() },
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  if (res.status !== 200) throw new Error('read content gagal: HTTP ' + res.status + ' ' + text.slice(0, 150));
  return JSON.parse(text);
}

async function writeContent(content) {
  const res = await fetch(WORKER + '/content/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getToken() },
    body: JSON.stringify(content),
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  if (res.status !== 200) throw new Error('update content gagal: HTTP ' + res.status + ' ' + text.slice(0, 150));
  return { ok: true };
}

// Kandidat provider gratis dari judul RSS
function extractCandidates(items) {
  const kw = /(free|gratis|open.?source|api|trial|no.?card|unlimited|beta|launch|releas|availab|now |new |preview|debut)/i;
  const bad = /(banned|scam|jailbreak|controvers|lawsuit|regulation|fired|layoff|funding|IPO|acquisition|stock|price|cost|bankrupt|debt|protest|election|war|politics|opinion|essay|productivity gap|right reasons)/i;
  return items.filter((i) => kw.test(i.title) && !bad.test(i.title)).slice(0, 8);
}

async function checkUrlAlive(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(timer);
    return res.ok || res.status === 405 || res.status === 403; // beberapa site tolak HEAD
  } catch { return false; }
}

// Gemini: dari daftar kandidat + database existing → usulkan provider baru
async function draftProvider(candidates, existingNames) {
  const list = candidates.map((c, i) => `${i + 1}. ${c.title} — ${c.url}`).join('\n');
  const prompt = `Kamu kurator database "tokengratis.web.id" (daftar AI gratis untuk orang Indonesia).
Sudah ada provider: ${existingNames.join(', ') || '(kosong)'}

Dari berita/konten AI berikut, pilih 1–2 yang BENAR-BENAR layak jadi entri provider AI GRATIS (bukan berita pendanaan/hukum/politik):

${list}

Buat JSON EXACT (tidak ada teks lain):
{
  "providers": [
    {
      "nama": "Nama Provider",
      "kategori": "api | tools | chatbot | model | tutorial (pilih yang paling pas)",
      "emoji": "satu emoji sederhana",
      "badge": "NO KARTU | KREDIT GRATIS | FREEMIUM | OPEN SOURCE (pilih satu yang paling pas, boleh kosong)",
      "deskripsi": "deskripsi singkat 1 kalimat (maks 120 char), Bahasa Indonesia",
      "limit": "batas gratis bila ada, kalau tidak tahu tulis 'lihat situs'",
      "url": "URL resmi provider (dari kandidat atau domain resmi yang kamu yakin)",
      "cara": "cara daftar singkat 1 kalimat (maks 120 char)",
      "status": "aktif"
    }
  ]
}

ATURAN:
- Hanya provider yang benar-benar ada & memberi akses gratis (free tier / trial tanpa kartu / open source).
- Jangan gabung dua provider jadi satu. Nama harus spesifik.
- URL harus domain resmi (bukan affiliate). Kalau tidak yakin URL, KOSONGKAN field url.
- Jangan invent angka/klaim. Deskripsi umum aman.`;
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + (process.env.GEMINI_API_KEY || ''),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 900 } }),
      signal: AbortSignal.timeout(90000),
    }
  );
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({}));
  const text = (((body.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || '').join('');
  if (!text) return [];
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed.providers)) return [];
    return parsed.providers.filter((p) => p && p.nama && p.kategori && p.deskripsi);
  } catch { return []; }
}

async function main() {
  if (!getToken()) {
    console.log('update-content: AITP_ADMIN_TOKEN tidak ada — SKIP.');
    return;
  }
  const content = await readContent();
  if (!content || !Array.isArray(content.providers)) throw new Error('konten tidak valid dari Worker');

  const existingNames = content.providers.map((p) => p.nama.toLowerCase());
  const candidates = extractCandidates((await Promise.all(RSS_FEEDS.map((u) => fetchRSS(u)))).flat());
  if (candidates.length === 0) {
    console.log('update-content: tidak ada kandidat baru dari RSS — SKIP.');
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log('update-content: GEMINI_API_KEY kosong — SKIP (tanpa AI tidak bisa saran provider).');
    return;
  }

  const suggested = await draftProvider(candidates, content.providers.map((p) => p.nama));
  if (suggested.length === 0) {
    console.log('update-content: Gemini tidak menghasilkan provider valid — SKIP.');
    return;
  }

  // Verifikasi: tidak duplikat + URL hidup (bila ada URL)
  const toAdd = [];
  for (const p of suggested.slice(0, MAX_NEW_PER_RUN)) {
    const nameLower = p.nama.toLowerCase();
    if (existingNames.includes(nameLower)) { console.log('duplikat, skip:', p.nama); continue; }
    if (p.url) {
      const alive = await checkUrlAlive(p.url);
      if (!alive) { console.log('URL mati, skip:', p.nama, p.url); continue; }
    }
    toAdd.push(p);
  }

  if (toAdd.length === 0) {
    console.log('update-content: semua kandidat ditolak (duplikat/URL mati) — SKIP.');
    return;
  }

  content.providers.push(...toAdd);
  content.tanggal = new Date().toISOString().slice(0, 10);
  const result = await writeContent(content);
  console.log('✅ update-content: ' + toAdd.length + ' provider ditambahkan → content:latest diperbarui.');
  for (const p of toAdd) console.log('  +', p.nama, '(' + p.kategori + ')', p.url || 'no-url');
  return result;
}

module.exports = { main, fetchRSS, extractCandidates, checkUrlAlive };
if (require.main === module) main().catch((e) => { console.error('ERROR update-content:', e.message); process.exit(1); });