// reply.js — Balas komentar Threads (dipicu manual, AMAN dari banned).
// Pola: hanya balas saat media_id + teks di env. Tidak ada auto-scan/all-reply.
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

async function main() {
  const replyId = process.env.REPLY_TO_ID;   // id komentar yg mau dibalas
  const text = process.env.REPLY_TEXT;        // teks balasan (manusiawi)
  if (!replyId) throw new Error('REPLY_TO_ID kosong');
  if (!text) throw new Error('REPLY_TEXT kosong');

  const c = cfg();
  const userId = await ensureUserId(c);

  // Balas lewat flow kontainer (standard publish) dgn reply_to_id
  const create = await api('/' + userId + '/threads', {
    media_type: 'TEXT', text, reply_to_id: replyId,
  }, 'POST');
  if (!create.id) throw new Error('create reply gagal: ' + JSON.stringify(create).slice(0, 200));
  await new Promise((r) => setTimeout(r, 5000)); // jeda aman, hindari rate-limit
  const pub = await api('/' + userId + '/threads_publish', { creation_id: create.id }, 'POST');
  if (!pub.id) throw new Error('publish reply gagal: ' + JSON.stringify(pub).slice(0, 200));
  console.log('REPLY_POSTED id=' + pub.id + ' -> ke ' + replyId);
}
main().catch((e) => { console.error('ERR: ' + e.message); process.exit(1); });
