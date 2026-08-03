// auto-reply.js — Stay-by OTONOM: balas komentar di semua thread akun secara otomatis.
// Scan thread terbaru -> komentar dari orang lain yg layak -> balasan natural (Gemini) -> kirim.
// AMAN: maks 1 balasan per run, skip spam/link/komentar sendiri, state anti-dobel, jeda rate-limit.
// Token THREADS dlm GitHub secret. State disimpan & di-commit ke repo.
const fs = require('fs');
const path = require('path');
const GRAPH = 'https://graph.threads.net/v1.0';
const CFG_PATH = path.join(__dirname, 'threads-api.config.json');
const DONE_DIR = path.join(__dirname, 'autoreply');
const STATE_PATH = path.join(DONE_DIR, 'done.json');
const MAX_REPLIES = 3; // 3 per run tiap 2 jam = ~18/hari, kencang tapi masih aman anti-spam

// Thread perkenalan Jarvis (root) — prioritas tertinggi supaya "yang diperkenalan" selalu keburu dibalas.
const TARGET_INTRO = '18161638075462931';

// Skor prioritas: komentar yang berminat/cara/tutor/info > pujian-generik > sisa.
function prio(text) {
  const t = (text || '').toLowerCase();
  if (/cara|caranya|gimana|bagaimana|tutor|tutorial|info|infokan|jelasin|jelas|bisa|berapa|launch|gabung|daftar|link|bantu|guide/.test(t)) return 3;
  if (/mantap|keren|nice|gila|serius|halu|wkwk|nyimak|sundul|kek|sip|oke|gas/i.test(t)) return 2;
  if (/(bokep|$$|slot|pinjol|gratis menang|pasti kaya|rahasia)/.test(t)) return 0;
  return 1;
}

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

async function api(p, params, method) {
  const c = cfg();
  params.access_token = c.access_token;
  if (method === 'POST') {
    return fetch(GRAPH + p, {
      method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    }).then(r => r.json());
  }
  return fetch(GRAPH + p + '?' + new URLSearchParams(params)).then(r => r.json());
}

async function ensureUserId(c) {
  if (!c.user_id || !c.username) {
    const me = await api('/me', { fields: 'id,username' }, 'GET');
    if (!me.id) throw new Error('gagal /me: ' + JSON.stringify(me));
    c.user_id = c.user_id || me.id;
    c.username = me.username;
  }
  return c.user_id;
}

async function gemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return ''; // fallback: template sederhana (lihat bawah)
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 200 } };
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  const j = await r.json();
  const p2 = j && j.candidates && j.candidates[0] && j.candidates[0].content &&
             j.candidates[0].content.parts && j.candidates[0].content.parts[0];
  return (p2 && p2.text || '').trim();
}

function isSpam(text) {
  const t = (text || '').toLowerCase();
  if (!t || t.length < 3) return true;
  const bad = ['berita', 'ready stock', 'premium', 'beli', 'jual', 'private', 'grup vip', 'garansi', 'stok', 'jamin', 'sewa', 'joki', 'promo', 'diskon', 'iklan'];
  if (bad.some(s => t.includes(s))) return true;
  if (/(\bhttps?:\/\/\S+|@\w+)\s*$/.test(t) && t.length < 40) return true;
  return false;
}

function humanReply(username, comment) {
  const owner = process.env.JARVIS_OWNER || 'mrodliarif';
  return 'Kamu adalah Jarvis, asisten AI pribadi milik @' + owner + ' yang menjaga akun Threads ini. '
    + 'Balas komentar berikut dengan gaya manusia asli:\n'
    + '  - Bahasa Indonesia santai & natural, jangan kaku/robot\n'
    + '  - Jangan sebut bot, jangan sebut back-end, jangan sebut kata agent\n'
    + '  - Kalau ditanya hal yang kamu tidak tahu, jujur bilang tidak tahu, jangan mengarang\n'
    + '  - Pendek (maks 25 kata), hangat, sedikit ramah\n'
    + 'Komentar:\n"' + (comment || '') + '"\nBalasan singkat:';
}

function fallbackReply(comment) {
  const c = (comment || '').trim();
  if (/info|tutor|caranya|gimana|bagaimana|cara/i.test(c)) {
    return 'Boleh banget, nanti aku jelasin pelan-pelan. Yang penting mampir dulu ke tokengratis.web.id biar nggak ketinggalan update 😄';
  }
  if (/gratis|free|limit/i.test(c)) {
    return 'Iya, gratis dan masih jalan sampai sekarang. Semua detailnya ada di tokengratis.web.id kalau mau dicek sendiri 👍';
  }
  return 'Makasih komennya! Kalau ada yang mau ditanya lebih lanjut, tinggal tulis aja ya 😄';
}

async function main() {
  const c = cfg();
  const userId = await ensureUserId(c);

  fs.mkdirSync(DONE_DIR, { recursive: true });
  const done = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : { replies: [] };

  // Ambil thread terbaru akun (15), lalu kumpulkan semua komentar orang lain
  const list = await api('/' + userId + '/threads', { fields: 'id,text,timestamp,permalink', limit: 15 }, 'GET');
  const threads = list.data || [];
  console.log('Thread di-scan: ' + threads.length);

  let candidates = [];
  for (const t of threads) {
    let res;
    try {
      res = await api('/' + t.id + '/replies', { fields: 'id,text,timestamp,username' }, 'GET');
    } catch (_) { continue; }
    for (const r of (res.data || [])) {
      const fromSelf = c.username && ('' + r.username).toLowerCase() === ('' + c.username).toLowerCase();
      if (fromSelf || done.replies.includes(r.id) || isSpam(r.text)) continue;
      candidates.push({ ...r, thread_id: t.id });
    }
  }
  candidates.sort((a, b) => {
    const pa = prio(a.text), pb = prio(b.text);
    if (pa !== pb) return pb - pa;          // pertanyaan-cara duluan
    if (a.thread_id === TARGET_INTRO) return -1; // thread perkenalan didahulukan
    if (b.thread_id === TARGET_INTRO) return 1;
    return new Date(a.timestamp || 0) - new Date(b.timestamp || 0); // lalu yg paling lama
  });
  console.log('Kandidat komentar layak: ' + candidates.length);

  let replied = 0;
  for (const cand of candidates.slice(0, MAX_REPLIES)) {
    let replyText = await gemini(humanReply(cand.username, cand.text));
    if (!replyText) replyText = fallbackReply(cand.text);
    if (!replyText) continue;
    console.log('Balas @' + cand.username + ' (thread ' + cand.thread_id + '): ' + cand.text.slice(0, 50));
    console.log('  -> ' + replyText);

    const create = await api('/' + userId + '/threads',
      { media_type: 'TEXT', text: replyText, reply_to_id: cand.id }, 'POST');
    if (!create.id) throw new Error('create reply gagal: ' + JSON.stringify(create).slice(0, 200));
    await new Promise(r => setTimeout(r, 5000));
    const pub = await api('/' + userId + '/threads_publish', { creation_id: create.id }, 'POST');
    if (!pub.id) throw new Error('publish gagal: ' + JSON.stringify(pub).slice(0, 200));

    done.replies.push(cand.id);
    replied++;
    console.log('AUTO_REPLY_SENT id=' + pub.id + ' utk komentar ' + cand.id);
    if (replied >= MAX_REPLIES) break;
  }
  if (!replied) console.log('Tidak ada komentar baru yang layak dibalas.');
  fs.writeFileSync(STATE_PATH, JSON.stringify(done, null, 2));
}

main().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });