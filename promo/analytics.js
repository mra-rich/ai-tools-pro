// analytics.js — Analisis performa konten akun: temukan "rahasia viral" AI niche.
// Baca semua threads + statistik, kategorikan, tulis laporan ke promo/analytics/report.json.
// Token dari THREADS_API_CONFIG (GitHub secret). Tidak pernah keluar.
const fs = require('fs');
const path = require('path');
const GRAPH = 'https://graph.threads.net/v1.0';
const CFG_PATH = path.join(__dirname, 'threads-api.config.json');

function cfg() {
  const env = process.env.THREADS_API_CONFIG;
  if (env) {
    const raw = env.trim();
    if (raw.startsWith('{')) { try { return JSON.parse(raw); } catch (_) { throw new Error('config bukan JSON'); } }
    if (/^THAA[\w-]+$/.test(raw)) return { access_token: raw, user_id: '' };
    throw new Error('config tidak dikenali');
  }
  if (!fs.existsSync(CFG_PATH)) throw new Error('tidak ada config lokal');
  return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
}

async function api(p, params = {}, method = 'GET') {
  const c = cfg();
  params.access_token = c.access_token;
  const opts = { method };
  if (method === 'POST') {
    opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    opts.body = new URLSearchParams(params);
    return fetch(GRAPH + p, opts).then((r) => r.json());
  }
  return fetch(GRAPH + p + '?' + new URLSearchParams(params)).then((r) => r.json());
}

async function ensureUserId(c) {
  if (c.user_id) return c.user_id;
  const me = await api('/me', { fields: 'id,username' });
  if (!me.id) throw new Error('gagal /me: ' + JSON.stringify(me));
  return me.id;
}

// Kategorikan tema konten dari teks (AI niche)
function categorize(text) {
  const t = (text || '').toLowerCase();
  const map = [
    ['tutorial/cara', ['cara', 'tutorial', 'langkah', 'setting', 'setup', 'cara pakai']],
    ['tool/model baru', ['model', 'tool', 'kimi', 'deepseek', 'claude', 'gemini', 'opencode', 'kiro', 'gratis model']],
    ['pilihan model', ['trading', 'coba model', 'swap model', 'round robin']],
    ['gratis/limit', ['gratis', 'limit', 'free', 'kuota', 'hemat']],
    ['perkenalan/promo', ['jarvis', 'perkenal', 'asisten', 'dibangun']],
  ];
  for (const [name, kws] of map) if (kws.some((k) => t.includes(k))) return name;
  return 'lainnya';
}

async function main() {
  const c = cfg();
  const userId = await ensureUserId(c);
  const list = await api('/' + userId + '/threads', {
    fields: 'id,text,timestamp,permalink',
    limit: 50,
  });
  const threads = list.data || [];

  const rows = [];
  for (const t of threads) {
    let s = {};
    try {
      s = await api('/' + t.id, { fields: 'like_count,reply_count,quote_count,views_count' });
    } catch (_) { /* gapapa */ }
    rows.push({
      id: t.id,
      text: (t.text || '').slice(0, 120),
      ts: t.timestamp || '',
      stats: {
        like: s.like_count || 0, reply: s.reply_count || 0,
        quote: s.quote_count || 0, views: s.views_count || 0,
      },
      cat: categorize(t.text),
    });
  }

  // ranking: indeks engagement = (like*1 + reply*3 + quote*2) / views*1000 lalu *1000
  for (const r of rows) {
    const { like, reply, quote, views } = r.stats;
    r.score = views > 0 ? ((like + reply * 3 + quote * 2) * 100000) / views : 0;
  }
  rows.sort((a, b) => b.score - a.score);

  // agregasi per kategori
  const byCat = {};
  for (const r of rows) {
    if (!byCat[r.cat]) byCat[r.cat] = { n: 0, totalViews: 0, totalLike: 0, totalReply: 0, totalScore: 0 };
    const k = byCat[r.cat];
    k.n++; k.totalViews += r.stats.views; k.totalLike += r.stats.like;
    k.totalReply += r.stats.reply; k.totalScore += r.score;
  }
  const cats = Object.entries(byCat).map(([name, v]) => ({
    cat: name, ...v, avgScore: v.n ? Math.round((v.totalScore / v.n) * 100) / 100 : 0,
  })).sort((a, b) => b.avgScore - a.avgScore);

  const top = rows.slice(0, 5).map((r) => ({
    id: r.id, preview: r.text, score: Math.round(r.score * 100) / 100, stats: r.stats, cat: r.cat,
  }));
  const bottom = rows.slice(-3).map((r) => ({ id: r.id, preview: r.text, stats: r.stats, cat: r.cat }));

  const report = {
    generated_at: new Date().toISOString(),
    total_posts: rows.length,
    best_category: cats[0] || null,
    category_performance: cats,
    top_posts: top,
    weak_posts: bottom,
    note: 'skor = engagement tertimbang per 100k views. Kategori paling tinggi = rahasia viral kamu.',
  };

  fs.mkdirSync(path.join(__dirname, 'analytics'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'analytics', 'report.json'), JSON.stringify(report, null, 2));
  console.log('OK -> promo/analytics/report.json, analisis ' + rows.length + ' post');
}
main().catch((e) => { console.error('ERR: ' + e.message); process.exit(1); });
