// insights.js — Ambil insight Threads via API resmi, simpan ke repo utk dibaca agent.
// Token hanya dari env THREADS_API_CONFIG (GitHub secret) — tidak pernah keluar.
// Hasil: promo/insights/latest.json (commit ke repo → agent baca via GITHUB_TOKEN)
const fs = require('fs');
const path = require('path');

const CFG_PATH = path.join(__dirname, 'threads-api.config.json');
const GRAPH = 'https://graph.threads.net/v1.0';
const OUT_DIR = path.join(__dirname, 'insights');

function cfg() {
  const env = process.env.THREADS_API_CONFIG;
  if (env) {
    const raw = env.trim();
    if (raw.startsWith('{')) {
      try { return JSON.parse(raw); } catch (_) {
        throw new Error('Secret THREADS_API_CONFIG bukan JSON valid.');
      }
    }
    if (/^THAA[\w-]+$/.test(raw)) return { access_token: raw, user_id: '' };
    throw new Error('Secret THREADS_API_CONFIG tidak dikenali.');
  }
  if (!fs.existsSync(CFG_PATH)) {
    throw new Error('Buat dulu promo/threads-api.config.json');
  }
  return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
}

async function api(pathStr, params = {}) {
  const c = cfg();
  params.access_token = c.access_token;
  const url = GRAPH + pathStr + '?' + new URLSearchParams(params);
  const r = await fetch(url);
  return r.json();
}

async function main() {
  const c = cfg();
  // user_id otomatis
  let userId = c.user_id;
  if (!userId) {
    const me = await api('/me', { fields: 'id,username' });
    if (!me.id) throw new Error('Gagal baca /me: ' + JSON.stringify(me));
    userId = me.id;
    console.log('user_id: ' + userId + ' (@' + (me.username || '?') + ')');
  }

  // 10 postingan terakhir
  const list = await api('/' + userId + '/threads', {
    fields: 'id,text,timestamp,permalink',
    limit: 10,
  });
  const threads = (list.data || []);
  console.log('Threads ditemukan: ' + threads.length);

  // statistik per thread
  const stats = [];
  for (const t of threads) {
    let s = {};
    try {
      const ins = await api('/' + t.id + '/insights', { metric: 'likes,replies,quotes,reposts,views' });
      if (Array.isArray(ins.data)) {
        const val = (name) => {
          const f = ins.data.find((x) => x.name === name);
          return f && f.values && f.values[0] ? f.values[0].value : 0;
        };
        s = { like_count: val('likes'), reply_count: val('replies'), quote_count: val('quotes'), views_count: val('views') };
      }
    } catch (_) { /* gapapa */ }
    stats.push({
      id: t.id,
      permalink: t.permalink || '',
      timestamp: t.timestamp || '',
      preview: (t.text || '').slice(0, 60),
      likes: s.like_count || 0,
      replies: s.reply_count || 0,
      quotes: s.quote_count || 0,
      views: s.views_count || 0,
    });
  }

  // ringkasan agregat
  const agg = {
    fetched_at: new Date().toISOString(),
    user_id: userId,
    total_threads: stats.length,
    sum_likes: stats.reduce((a, b) => a + b.likes, 0),
    sum_replies: stats.reduce((a, b) => a + b.replies, 0),
    sum_views: stats.reduce((a, b) => a + b.views, 0),
    threads: stats,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'latest.json'), JSON.stringify(agg, null, 2));
  console.log('OK -> promo/insights/latest.json');
  console.log('Likes: ' + agg.sum_likes + ' | Replies: ' + agg.sum_replies + ' | Views: ' + agg.sum_views);
}

main().catch((e) => { console.error('ERR: ' + e.message); process.exit(1); });
