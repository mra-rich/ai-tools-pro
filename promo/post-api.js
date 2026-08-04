// ═════════════════════════════════════════════════════════════════
// post-api.js — Poster Threads via API RESMI Meta (graph.threads.net)
// Menggunakan long-lived token 60 hari (di-refresh otomatis tiap pekan).
//
// Config: promo/threads-api.config.json (GITIGNORED — jangan commit!)
//   {
//     "app_id":     "1234567890",
//     "app_secret": "xxxxxxxx",
//     "access_token": "THAA...",          ← long-lived token 60 hari
//     "user_id":    "123456789012345"    ← dari GET /me?fields=id
//   }
//
// Pakai:  node promo/post-api.js              → posting thread hari ini
//         node promo/post-api.js --dry-run    → hanya cek token + tampilkan draft
//         node promo/post-api.js --refresh    → refresh token (jadwalkan mingguan)
// ═════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const CFG_PATH = path.join(__dirname, 'threads-api.config.json');
const THREADS_DIR = path.join(__dirname, 'threads');
const GRAPH = 'https://graph.threads.net/v1.0';

// Config dari env THREADS_API_CONFIG (dipakai di GitHub Actions via secret)
// ATAU dari file promo/threads-api.config.json (mode lokal).
// Menerima: JSON utuh {"app_id":…,"access_token":"THAA…",…} ATAU token polos
// "THAA…" langsung (user_id diambil otomatis dari GET /me).
function cfg() {
  const env = process.env.THREADS_API_CONFIG;
  if (env) {
    const raw = env.trim();
    if (raw.startsWith('{')) {
      try { return JSON.parse(raw); } catch (_) {
        throw new Error('Secret THREADS_API_CONFIG bukan JSON valid (jangan paste token di dalam tanda kutip).');
      }
    }
    // Token polos — cukup untuk posting; user_id diringkas otomatis
    if (/^THAA[\w-]+$/.test(raw)) return { access_token: raw, user_id: '' };
    throw new Error('Secret THREADS_API_CONFIG tidak dikenali. Isi dengan JSON config utuh atau token THAA… polos.');
  }
  if (!fs.existsSync(CFG_PATH)) {
    throw new Error('Buat dulu promo/threads-api.config.json — lihat contoh di README');
  }
  return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
}

function saveCfg(c) {
  if (process.env.THREADS_API_CONFIG) {
    // Mode CI: tidak bisa menyimpan kembali ke secret — token hasil refresh
    // bawa dari lokal (lihat README bagian GitHub Actions).
    console.log('ℹ️  Mode env (CI) — perubahan config/token tidak disimpan.');
    return;
  }
  fs.writeFileSync(CFG_PATH, JSON.stringify(c, null, 2));
}

async function api(path, params = {}, method = 'GET') {
  const c = cfg();
  params.access_token = c.access_token;
  const url = GRAPH + path;
  const opts = { method };
  if (method === 'POST') {
    opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    opts.body = new URLSearchParams(params);
  } else {
    return fetch(url + '?' + new URLSearchParams(params)).then((r) => r.json());
  }
  return fetch(url, opts).then((r) => r.json());
}

// ── Refresh long-lived token (jadwalkan mingguan: TIAP token <60 hari) ──
async function refreshToken() {
  const c = cfg();
  const res = await api('/refresh_access_token', {
    grant_type: 'th_refresh_token',
    access_token: c.access_token,
  });
  if (res.access_token) {
    c.access_token = res.access_token;
    c.refreshed_at = new Date().toISOString();
    saveCfg(c);
    console.log('✅ Token di-refresh (kedaluwarsa baru dalam ~' +
      Math.round((res.expires_in || 0) / 86400) + ' hari)');
  } else {
    throw new Error('Refresh gagal: ' + JSON.stringify(res));
  }
}

// ── Ambil USER_ID kalau belum ada (GET /me?fields=id) ────────────────
async function ensureUserId() {
  const c = cfg();
  if (c.user_id) return c.user_id;
  const res = await api('/me', { fields: 'id,username' });
  if (res.id) {
    c.user_id = res.id;
    saveCfg(c);
    console.log('✅ user_id: ' + res.id + ' (@' + (res.username || '?') + ')');
    return res.id;
  }
  throw new Error('Gagal baca /me: ' + JSON.stringify(res));
}

// ── Posting 1 teks (≤500 char). Kalau parentId diberikan → jadi reply ──
async function postText(userId, text, parentId) {
  const params = { media_type: 'TEXT', text };
  if (parentId) params.reply_to_id = parentId;

  // langkah 1: create media container
  const create = await api('/' + userId + '/threads', params, 'POST');
  if (!create.id) throw new Error('create gagal: ' + JSON.stringify(create));

  // rekomendasi Meta: tunggu ~30 detik proses container (teks jauh lebih cepat — 4 detik cukup)
  await new Promise((r) => setTimeout(r, 4000));

  // langkah 2: publish
  const pub = await api('/' + userId + '/threads_publish', { creation_id: create.id }, 'POST');
  if (!pub.id) throw new Error('publish gagal: ' + JSON.stringify(pub));
  return pub.id;
}

// ── Ambil draft hari ini → potong ≤500 char per post → post berantai ──
function latestDraft() {
  if (!fs.existsSync(THREADS_DIR)) return null;
  const files = fs.readdirSync(THREADS_DIR)
    .filter((f) => f.endsWith('.md') && !f.endsWith('.posted'))
    .sort();
  if (!files.length) return null;
  const f = files[files.length - 1];
  return { file: f, text: fs.readFileSync(path.join(THREADS_DIR, f), 'utf8') };
}

// Pecah teks jadi array post ≤500 char (Threads limit) tanpa memecah baris
function splitThread(text, max = 490) {
  const lines = text.split('\n');
  const posts = [''];
  for (const line of lines) {
    const cur = posts[posts.length - 1];
    const next = cur ? cur + '\n' + line : line;
    if (next.length <= max) posts[posts.length - 1] = next;
    else posts.push(line);
  }
  return posts.filter((p) => p.trim());
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--refresh')) return refreshToken();

  const userId = await ensureUserId();
  const draft = latestDraft();
  if (!draft) {
    console.log('SKIP: tidak ada draft (mungkin dihapus verifikasi) — tidak ada yang diposting.');
    return;
  }

  const posts = splitThread(draft.text);
  console.log('📄 ' + draft.file + ' → ' + posts.length + ' post:');
  posts.forEach((p, i) => console.log('[Post ' + (i + 1) + '] ' + p.slice(0, 80) + '…'));

  if (args.includes('--dry-run')) { console.log('(dry-run — tidak diposting)'); return; }

  // Posting berantai: root → reply → reply ... (jadi thread sungguhan)
  let parentId = null;
  for (let i = 0; i < posts.length; i++) {
    const id = await postText(userId, posts[i], parentId);
    console.log('✅ Posted #' + (i + 1) + ' id=' + id);
    parentId = id;
  }
  fs.renameSync(
    path.join(THREADS_DIR, draft.file),
    path.join(THREADS_DIR, draft.file + '.posted')
  );
  console.log('🎉 Selesai diposting!');
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });