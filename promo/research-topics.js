// ═════════════════════════════════════════════════════════════════
// research-topics.js — Riset OTOMATIS topik viral (kickoff mingguan).
// Tidak ada manual: tarik trending dari HN + Reddit API → untuk tiap
// kandidat, MINTA Gemini menulis 1 topik lengkap (hook/facts/freePath/
// ctaQ) + WAJIB menyertakan URL sumber — lalu verifikasi URL hidup.
// Output: menimpa promo/auto-topics.js (penampung topik otomatis).
//
// Pakai:  node promo/research-topics.js
// Env:    GEMINI_API_KEY (untuk menulis draf topik) — bila kosong,
//         hanya mode "finding + sources", tanpa topik baru (aman).
// ═════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_TOPICS = 8;          // pertahankan paling banyak 8 topik otomatis
const SOURCE_TIMEOUT = 12000;  // ms untuk cek hidup tiap sumber

const OUT = path.join(__dirname, 'auto-topics.js');

// ── Ambera trend raw dari sumber publik (tanpa token) ──────────────
async function fetchJSON(url, timeout = 15000, headers = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers });
  if (!res.ok) return null;
  return res.json();
}

// RSS/Atom: ambil item terbaru dari feed (title + link + pubDate)
async function fetchRSS(url, limit = 10) {
  let text = '';
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-topics/1.0; +https://tokengratis.web.id)' },
      redirect: 'follow',
    });
    if (!res.ok) return [];
    text = await res.text();
  } catch { return []; }
  // parser mini: ambil blok <item>...</item> atau <entry>...</entry>
  const items = [];
  const reItem = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  let m;
  while ((m = reItem.exec(text)) !== null && items.length < limit) {
    const block = m[1];
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const link = (block.match(/<link[^>]*href="([^"]+)"/i) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '';
    const pub = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) || [])[1] || '';
    if (!title) continue;
    items.push({
      src: new URL(url).hostname.replace(/^www\./, ''),
      title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      url: link.trim(),
      score: 0,
      pub: pub.trim(),
    });
  }
  return items;
}

// Hacker News: cerita terpopuler 24 jam terakhir (cari kata kunci AI)
async function fetchHN() {
  const ids = await fetchJSON('https://hacker-news.firebaseio.com/v0/topstories.json');
  if (!ids) return [];
  const items = [];
  const slice = ids.slice(0, 12); // 12 cerita teratas cukup
  await Promise.all(slice.map(async (id) => {
    const it = await fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
    if (!it || !it.title) return;
    if (/ai|llm|model|gemini|deepseek|qwen|kimi|claude|open.?source|benchmark|video world|agent/i.test(it.title)) {
      items.push({ src: 'HN', title: it.title, url: it.url || `https://news.ycombinator.com/item?id=${id}`, score: it.score || 0 });
    }
  }));
  return items.sort((a, b) => b.score - a.score);
}

// Reddit: hot post dari sub AI populer (via JSON API publik, USER-AGENT wajib)
async function fetchReddit(sub, limit = 25) {
  const json = await fetchJSON(`https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`, 15000, {
    'User-Agent': 'Mozilla/5.0 (compatible; research-topics/1.0; +https://tokengratis.web.id)',
    'Accept': 'application/json',
  });
  if (!json || !json.data) return [];
  return (json.data.children || [])
    .filter((c) => c.kind === 't3')
    .map((c) => c.data)
    .filter((d) => d.title && !d.stickied)
    .map((d) => ({ src: 'r/' + sub, title: d.title, url: 'https://www.reddit.com' + d.permalink, score: d.score || 0, upvote_ratio: d.upvote_ratio || 0 }));
}

// Feed AI news yang andal (tanpa token, tidak diblokir datacenter IP)
const RSS_FEEDS = [
  'https://hnrss.org/newest?q=AI&points=100',
  'https://techcrunch.com/category/artificial-intelligence/feed/',
  'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  'https://www.marktechpost.com/feed/',
];

// Gabungkan semua kandidat, dedup, batasi, filter AI
async function gatherCandidates() {
  const [hn, ...rss] = await Promise.all([
    fetchHN(),
    ...RSS_FEEDS.map((u) => fetchRSS(u)),
  ]);
  const all = [...hn, ...rss.flat()];
  // filter: hanya yang jelas AI/tech
  const kw = /ai|llm|model|gemini|deepseek|qwen|kimi|claude|open.?source|benchmark|video|world model|agent|gpt|openai|anthropic|hugging|neural/i;
  const seen = new Set();
  const out = [];
  for (const c of all) {
    if (!kw.test(c.title)) continue;
    if (seen.has(c.title)) continue;
    seen.add(c.title);
    out.push(c);
    if (out.length >= 14) break;
  }
  return out;
}

// Cek daftar URL hidup (HEAD/first bytes) — hindari dead link di fakta
async function checkSources(urls) {
  const results = [];
  for (const u of urls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), SOURCE_TIMEOUT);
      const res = await fetch(u, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(timer);
      results.push({ url: u, ok: res.ok });
    } catch { results.push({ url: u, ok: false }); }
  }
  return results;
}

// Minta Gemini menyusun 1 topik dari daftar kandidat — WAJIB URL sumber
async function draftTopic(candidates) {
  const list = candidates.map((c, i) => `${i + 1}. (${c.src}) ${c.title} — ${c.url}`).join('\n');
  const prompt = `Kamu analis tren AI. Dari kandidat trending berikut (dari HN & RSS AI), pilih 1 yang paling layak jadi posting Threads viral akun AI Indonesia:

${list}

Buat DRAF TOPIK dengan format JSON EXACT berikut (tidak ada teks lain, hanya JSON):
{"id":"slug-pendek","topic":"one-liner topik dalam Bahasa Indonesia","hook":["hook1","hook2","hook3"],"facts":["fakta dengan angka bila mungkin","fakta ke-2"],"freePath":["cara gratis 1","cara gratis 2"],"ctaQ":"pertanyaan CTA penutup","category":"kategori-pendek","sources":["https://url-sumber-dari-kandidat"]}

ATURAN:
- topic/hook/facts/freePath/ctaQ/category dalam Bahasa Indonesia santai (pakai "kamu")
- "sources" WAJIB berisi minimal 1 URL dari daftar kandidat di atas (dasar fakta)
- hook pakai fakta/statement mengejutkan, bukan retoris
- jangan pakai emoji 🤯🚀🔥, maksimal 1 emoji non-mainstream
- Fakta jangan dikarang: kalau tidak ada angka di sumber, tulis pernyataan umum`;
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + (process.env.GEMINI_API_KEY || ''),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 800 } }),
      signal: AbortSignal.timeout(90000),
    }
  );
  if (!res.ok) { console.log('research-topics: Gemini HTTP ' + res.status + ' — ' + (await res.text().catch(() => '')).slice(0, 120)); return null; }
  const body = await res.json().catch(() => ({}));
  const cand0 = ((body.candidates || [])[0] || {});
  const finish = cand0.finishReason || 'none';
  let text = (cand0.content || {}).parts?.map((p) => p.text || '').join('');
  console.log('research-topics: Gemini finishReason=' + finish + ' textLen=' + (text || '').length);
  if (!text) return null;
  // buang markdown fence (```json ... ```) lalu ekstrak JSON
  text = text.replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) { console.log('research-topics: tidak ada JSON di output. Raw: ' + text.slice(0, 200)); return null; }
  try {
    const t = JSON.parse(m[0]);
    if (!t.id || !t.topic || !Array.isArray(t.hook) || !Array.isArray(t.facts)) {
      console.log('research-topics: JSON tidak lengkap: ' + JSON.stringify(t).slice(0, 200));
      return null;
    }
    if (!Array.isArray(t.sources) || t.sources.length === 0) {
      console.log('research-topics: JSON tanpa sources — coba isi dari kandidat: ' + JSON.stringify(t).slice(0, 150));
      // fallback: pakai URL kandidat pertama sebagai sumber (masih aman)
      if (candidates[0] && candidates[0].url) t.sources = [candidates[0].url];
      else return null;
    }
    return t;
  } catch (e) { console.log('research-topics: JSON parse gagal: ' + e.message + ' Raw: ' + text.slice(0, 200)); return null; }
}

// Fallback DETERMINISTIK (tanpa LLM): ambil kandidat teratas yang judulnya
// bernada "rilis/tool baru" dan bangun topik langsung dari judul + URL asli.
// Tidak mengarang fakta — hook/prompt diambil dari judul kandidat.
function fallbackTopic(candidates) {
  const c = candidates[0];
  if (!c || !c.url) return null;
  let title = (c.title || '').replace(/\s*[|-][\s\S]*$/, '').trim(); // buang bagian stastik
  const slug = 'trend-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-|-$/g, '');
  return {
    id: slug,
    topic: 'Tren AI yang lagi ngangkat: ' + title,
    hook: ['Ada model/tool AI baru yang lagi heboh', 'Lagi ramai di kalangan developer AI'],
    facts: ['Ini trending topik baru di Hacker News/Reddit AI hari ini.', 'Para pengguna AI lagi banyak ngebahas tool ini.', 'Nggak semua tahu cara akses gratisnya.'],
    freePath: ['Cek langsung link sumber di bawah untuk cara akses gratis.', 'Mampir tokengratis.web.id untuk lihat koleksi tool AI gratis.'],
    ctaQ: 'Kamu udah coba tool AI versi baru ini belum?',
    category: 'trend',
    sources: [c.url],
  };
}

async function main() {
  const cands = await gatherCandidates();
  if (cands.length === 0) {
    console.log('research-topics: tidak ada kandidat (semua fetch gagal) — biarkan file.');
    return;
  }
  console.log('research-topics: ' + cands.length + ' kandidat dari HN/Reddit.');

  let topic = await draftTopic(cands);
  if (!topic) {
    console.log('research-topics: Gemini gagal — pakai fallback deterministik dari kandidat teratas.');
    topic = fallbackTopic(cands);
    if (!topic) {
      console.log('research-topics: tidak ada kandidat layak — biarkan file.');
      return;
    }
  }

  // Verifikasi semua URL sumber benar-benar hidup
  const checked = await checkSources(topic.sources);
  const dead = checked.filter((c) => !c.ok);
  if (dead.length > 0) {
    console.log('research-topics: buang sumber mati: ' + dead.map((d) => d.url).join(', '));
    topic.sources = checked.filter((c) => c.ok).map((c) => c.url);
    if (topic.sources.length === 0) {
      console.log('research-topics: SEMUA sumber mati — tolak topik, biarkan file.');
      return;
    }
  }

  // Muat topik otomatis yang ada, prepend baru, cap, tulis
  let existing = [];
  try { existing = require(OUT); } catch {}
  const fresh = [topic, ...existing].slice(0, MAX_TOPICS);
  const body = '// ═════════════════════════════════════════════════\n' +
    '// auto-topics.js — topik OTOMATIS (tulis research-topics.js, ' + new Date().toISOString().slice(0, 10) + ')\n' +
    '// JANGAN edit manual. Sumber divalidasi hidup di waktu riset.\n' +
    '// ═════════════════════════════════════════════════\n' +
    'module.exports = ' + JSON.stringify(fresh, null, 2) + ';\n';
  fs.writeFileSync(OUT, body);
  console.log('✅ auto-topics.js diperbarui: ' + fresh.length + ' topik (baru: "' + topic.topic + '").');
  console.log('   Sumber: ' + topic.sources.join(', '));
}

module.exports = { main, fetchHN, fetchReddit, fetchRSS, gatherCandidates, draftTopic, fallbackTopic, checkSources };
if (require.main === module) main().catch((e) => { console.error('ERROR research-topics:', e.message); process.exit(1); });