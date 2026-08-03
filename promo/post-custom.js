// post-custom.js — Poster teks Threads custom (untuk perkenalan/status khusus).
// Token dari env THREADS_API_CONFIG (GitHub secret). Teks dari env MSG_TEXT.
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
  if (method === 'POST') {
    const r = await fetch(GRAPH + p, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
    return r.json();
  }
  const r = await fetch(GRAPH + p + '?' + new URLSearchParams(params));
  return r.json();
}

async function ensureUserId(c) {
  if (c.user_id) return c.user_id;
  const me = await api('/me', { fields: 'id,username' });
  if (!me.id) throw new Error('gagal /me: ' + JSON.stringify(me));
  return me.id;
}

function splitThread(text, max = 490) {
  return text.split('\n').filter(l => l.trim()); // 1 baris = 1 post utk posting panjang
}

async function main() {
  const text = process.env.MSG_TEXT;
  if (!text) throw new Error('MSG_TEXT kosong');
  const c = cfg();
  const userId = await ensureUserId(c);
  const lines = splitThread(text);
  let parent = null;
  let firstId = null;
  for (const line of lines) {
    const create = await api('/' + userId + '/threads', { media_type: 'TEXT', text: line, ...(parent ? { reply_to_id: parent } : {}) }, 'POST');
    if (!create.id) throw new Error('create gagal: ' + JSON.stringify(create).slice(0, 200));
    await new Promise(r => setTimeout(r, 4000));
    const pub = await api('/' + userId + '/threads_publish', { creation_id: create.id }, 'POST');
    if (!pub.id) throw new Error('publish gagal: ' + JSON.stringify(pub).slice(0, 200));
    parent = pub.id;
    if (!firstId) firstId = pub.id;
    console.log('posted line -> ' + pub.id);
  }
  console.log('DONE first_id=' + firstId);
}
main().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });
