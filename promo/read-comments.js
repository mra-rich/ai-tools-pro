// read-comments.js — Ambil komentar/replies dari postingan Threads dan simpan ke repo.
// Token dari THREADS_API_CONFIG (GitHub secret). Tidak pernah keluar.
// Output: promo/comments/latest.json — bisa dibaca agent via GITHUB_TOKEN.
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

async function main() {
  const c = cfg();
  const userId = await ensureUserId(c);

  // Semua postingan user — ambil 15 terakhir
  const list = await api('/' + userId + '/threads', {
    fields: 'id,text,timestamp,permalink',
    limit: 15,
  });
  const threads = list.data || [];
  console.log('Threads ditemukan: ' + threads.length);

  const out = { fetched_at: new Date().toISOString(), threads: [] };

  for (const t of threads) {
    let replies = [];
    try {
      const r = await api('/' + t.id + '/replies', {
        fields: 'id,text,timestamp,username',
      });
      replies = (r.data || []).map((x) => ({
        id: x.id,
        text: (x.text || '').slice(0, 200),
        username: x.username || '',
        timestamp: x.timestamp || '',
      }));
    } catch (_) { /* thread tanpa replies */ }
    out.threads.push({
      id: t.id,
      preview: (t.text || '').slice(0, 80),
      permalink: t.permalink || '',
      timestamp: t.timestamp || '',
      replies_count: replies.length,
      replies,
    });
  }

  fs.mkdirSync(path.join(__dirname, 'comments'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'comments', 'latest.json'), JSON.stringify(out, null, 2));
  const totalReplies = out.threads.reduce((a, b) => a + b.replies.length, 0);
  console.log('OK -> promo/comments/latest.json (total replies: ' + totalReplies + ')');
}
main().catch((e) => { console.error('ERR: ' + e.message); process.exit(1); });
