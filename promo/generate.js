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
const { VIRAL_TOPICS, getViralTopic, pickHook } = require('./viral-topics.js');
const AUTO_TOPICS = require('./auto-topics.js');

// Gabungan topik: statis (manual) + otomatis (hasil riset mingguan).
const ALL_TOPICS = [...VIRAL_TOPICS, ...AUTO_TOPICS];

const WORKER = 'https://ai-tools-pro.rodliarif.workers.dev';
const SITE = 'https://tokengratis.web.id';
const OUT_DIR = path.join(__dirname, 'threads');

// ── Ambil konten live dari KV (bukan admin-content.json — supaya fresh) ─
// Endpoint /content/read butuh ADMIN_TOKEN; dibaca dari env AITP_ADMIN_TOKEN
// atau dari scret.txt lokal (gitignored — JANGAN commit token ke repo).
function getAdminToken() {
  if (process.env.AITP_ADMIN_TOKEN) return process.env.AITP_ADMIN_TOKEN;
  const p = path.join(__dirname, '..', 'scret.txt');
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      const m = fs.readFileSync(p, 'utf8').match(/ADMIN_TOKEN\s*=\s*([A-Fa-f0-9]{32,})/);
      if (m) return m[1];
    }
  } catch (_) { /* token tidak tersedia */ }
  return '';
}

async function readContent() {
  const res = await fetch(WORKER + '/content/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getAdminToken() },
    signal: AbortSignal.timeout(60000), // batas 60 detik — jangan ngaco menggantung di CI
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

// ── Loop BELAJAR: baca analytics/learnings.json (hasil learn-virality.py) ──
// Hari ini harus lebih baik dari kemarin: insight yang terbukti berkorelasi
// dengan views dipakai untuk menyusun konten hari ini. Kalau file belum ada
// (analytics belum jalan), fungsi ini aman → return null (konten normal).
function loadLearnings() {
  try {
    const p = path.join(__dirname, 'analytics', 'learnings.json');
    if (!fs.existsSync(p)) return null;
    const l = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!l || !l.correlations || !l.correlations.length) return null;
    // Parameter dengan korelasi kuat (|rho| ≥ 0.25) = yang TERBUKTI kerja
    l.strong = l.correlations.filter((c) => Math.abs(c.rho) >= 0.25);
    return l;
  } catch (_) { return null; }
}

// Terjemahkan insight → 1 baris instruksi yang bisa dipatuhi generator.
// Dipakai di prompt Gemini DAN untuk memilih template terbaik di buildThread.
function insightBrief(l) {
  if (!l || !l.strong || !l.strong.length) return null;
  const pos = l.strong.filter((c) => c.rho > 0);
  if (!pos.length) return null;
  const bits = {
    has_free: 'Sebut kata "gratis"/"free"/"irit"/"murah" secara natural',
    has_model: 'Sebut nama model AI spesifik yang lagi hangat',
    has_number: 'Pakai ANGKA konkret (harga, token, persen, perbandingan)',
    has_emo: 'Buka dengan hook emosi (gila/akhirnya/wow/ternyata)',
    has_cara: 'Kasih 1 langkah/cara praktis yang bisa langsung dicoba',
    has_kalah: 'Pakai sudut perbandingan (kalah/lebih murah/vs)',
    caps_words: 'Ada 1-2 kata ALL-CAPS untuk penekanan',
  };
  const tips = pos
    .map((c) => bits[c.param]).filter(Boolean)
    .slice(0, 5);
  if (!tips.length) return null;
  return 'INSIGHT TERBUKTI DARI DATA AKUN INI (ikuti untuk performa bagus): ' + tips.join('; ') + '.';
}

// ── Generate pakai Gemini API (konten baru tiap hari, bukan template) ──
// Key dibaca dari env GEMINI_API_KEY (GitHub Secret di CI). Kalau key kosong
// / API gagal / output tidak lolos validasi → null → caller pakai template.
const GEMINI_MODEL = 'gemini-2.5-flash';

// ── Pemilih topik FRESH (kedaluwarsa di-skip) ─────────────────────────────
// Topik di viral-topics.js boleh punya `added` (ISO date) + `staleAfterDays`.
// Topik dengan `sources` (hasil riset otomatis) dianggap segar sampai
// `staleAfterDays` (atau ~14 hari kalau tidak diset). Topik tanpa `added`
// (lama/tanpa tanggal) DIANGGAP BASI dan ditempatkan paling belakang.
function isTopicFresh(t) {
  const max = 14;
  if (t.staleAfterDays == null && !t.sources) return false; // topik lama tanpa expiry
  let days = t.staleAfterDays != null ? t.staleAfterDays : max;
  if (!t.added) days = Math.min(days, max);
  if (t.added) {
    const age = (Date.now() - new Date(t.added).getTime()) / 86400000;
    return age <= days;
  }
  return true; // tidak ada tanggal → anggap segar walau pendekatan konservatif
}

// Pilih topik secara deterministik (dayOfYear) dari DAFTAR YANG MASIH FRESH.
// Return null kalau TIDAK ADA topik fresh → caller harus pakai template
// evergreen (daftar provider), BUKAN memaksakan topik basi.
function pickFreshTopic(dayOfYear) {
  const fresh = ALL_TOPICS.filter(isTopicFresh);
  if (!fresh.length) return null; // semua basi → jangan posting viral
  return fresh[dayOfYear % fresh.length];
}

function buildGeminiPrompt(d, dayOfYear, learnings) {
  const providers = d.providers || [];
  const snapshot = shuf(providers).slice(0, 30)
    .map((p) => `- ${p.nama} [${p.kategori}${p.badge ? ' | ' + p.badge : ''}]: ${cap(p.deskripsi || '', 80)}`)
    .join('\n');

  // Angle hari ini: topik viral terpilih (model AI yang lagi panas)
  const t = pickFreshTopic(dayOfYear + slot.idx);
  if (!t) return null; // tidak ada topik fresh → Gemini skip, pakai template evergreen

  // Loop belajar: insight terbukti dari data akun (kalau ada)
  const brief = insightBrief(learnings);

  // Anti-repeat: kirim isi post terakhir supaya LLM tidak menulis ulang
  let prev = '';
  try {
    if (fs.existsSync(OUT_DIR)) {
      const posted = fs.readdirSync(OUT_DIR)
        .filter((f) => f.endsWith('.posted') && f.endsWith('.md.posted')).sort();
      if (posted.length) prev = fs.readFileSync(path.join(OUT_DIR, posted[posted.length - 1]), 'utf8');
    }
  } catch (_) { /* abaikan */ }

  return `Kamu penulis Threads gaya manusia, BUKAN copywriter AI. Akun ini berbicara seperti teman yang update banget soal AI — santai, pietra, konkret, dan tidak preachy. Target pembaca: orang Indo yang pengen pakai AI tapi nggak mau langganan mahal.

ANGLE KONTEN (ANGKA & TOPIK DISIPI di prompt ini, jangan dikarang sendiri):
Topik hari ini: "${t.topic}"
Fakta nyata (pakai maksimal 2–3, jangan semua): ${(t.facts || []).join(' | ')}
Cara GRATIS-nya (angan tutorial style, maksimal 2 item, konkret): ${(t.freePath || []).join(' | ')}
Pertanyaan CTA penutup (variasikan redaksi): "${t.ctaQ || ''}"

LARANGAN (kalau langgar = posting ditolak):
1. DILARANG frasa cliché AI: "Tau gak sih?", "Yuk coba!", "Udah coba yang mana?", "Gimana pendapatmu?", "Guys!", "Keren banget", emoji 🤯🚀🔥 (pakai emoji yang tidak mainstream, maksimal 3, atau none)
2. DILARANG opening pertanyaan besar yang retoris — mulai dengan FAKTA atau STATEMENT mengejutkan
3. DILARANG markdown (**, ##, kode blok), hashtag, bahasa campuran berlebihan (bahasa Inggris teknis boleh kalau memang istilah)
4. JANGAN sebut semua provider di daftar — pilih 1–2 saja yang paling relate dengan angle

Pola HOOK yang pasti laris di Threads (contoh, JANGAN dicopy mentah):
- "Kimi K3 sampai 'sold out' karena demand. Tapi weight-nya open source. Artinya…"
- "Harga langganan AI: $20/bulan. Biaya task yang sama via API: $0.31."
- "Belum rilis aja teaser 3 kata dari Alibaba udah jadi meme. Komunitas beneran nunggu Qwen3.8."
${brief ? '\n' + brief + '\n' : ''}
DATA REFERENSI (provider yang BENAR-BENAR ada, tidak boleh dikarang):
${snapshot}

ATURAN FAKTA WAJIB (dipatuhi):
- JANGAN gabungkan dua perusahaan/model berbeda jadi satu produk. Sebut model
  MILIK perusahaan dengan jelas; benda terpisah TIDAK di-satukan.
- Jangan tulis angka/klaim yang tidak ada di DATA REFERENSI. Tidak yakin = tulis
  pernyataan umum (mis. "sekarang bisa coba langsung") tanpa klaim spesifik.
- Jangan campur proyek satu perusahaan ke model perusahaan lain.
- Semua nama model/perusahaan harus dari snapshot, tidak boleh dikarang.

TUGAS:
- Tulis 1 posting Threads MAKSIMAL 480 karakter total
- Bahasa Indonesia santai (pakai "kamu", campur istilah teknis Inggris kalau natural)
- Hook di baris pertama yang bikin berhenti scroll
- Isi: fakta spesifik dari angle (pakai angka) + cara gratisnya (langkah/tutorial singkat)
- Akhiri dengan link ini tepat di baris sendiri: ${SITE}
- Akhiri dengan 1 kalimat CTA komen yang spesifik (bukan "komen ya") — misalnya "Kamu tim yang mana?"
${prev ? '\nPosting kemarin (jangan repeat angle/gaya ini):\n' + prev + '\n' : ''}
Balas HANYA teks posting siap terbit, tanpa pembuka/penjelasan/format apa pun sebelum/after teks.`;
}

async function generateWithGemini(d, dayOfYear, learnings) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.log('ℹ️  GEMINI_API_KEY kosong — pakai template.'); return null; }

  let res;
  try {
    res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildGeminiPrompt(d, dayOfYear, learnings) }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(120000), // batas 2 menit — lewat itu fallback template
      }
    );
  } catch (e) {
    console.log('⚠️  Gemini error/timeout (' + e.message + ') — fallback template.');
    return null;
  }
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200) {
    console.log('⚠️  Gemini gagal (HTTP ' + res.status + '): ' + JSON.stringify(body).slice(0, 200));
    return null;
  }
  let text = (((body.candidates || [])[0] || {}).content || {}).parts
    ?.map((p) => p.text || '').join('').trim() || '';

  // Sanitize: buang markdown yang lolos (**, ##, `, kode blok)
  text = text.replace(/```[\s\S]*?```/g, '').replace(/[*#`]/g, '').trim();

  // Pemotongan pintar: kalau kepanjangan, potong di batas baris terakhir ≤495 char
  // (bukan langsung fallback — posting masih layak tayang)
  if (text.length > 500) {
    const cut = text.lastIndexOf('\n', 495);
    if (cut > 150) text = text.slice(0, cut).trim();
  }
  // Link situs kepotong? Selipkan ulang kalau muat
  if (!text.includes(SITE) && text.length + SITE.length + 2 <= 500) {
    text = text + '\n\n' + SITE;
  }

  // Validasi: batas char, link wajib, dan minimal menyebut 1 nama provider asli
  const names = (d.providers || []).map((p) => p.nama);
  if (!text) { console.log('⚠️  Gemini output kosong — fallback template.'); return null; }
  if (text.length > 500) { console.log('⚠️  Gemini kepanjangan (' + text.length + ' char) — fallback.'); return null; }
  if (!text.includes(SITE)) { console.log('⚠️  Output tidak memuat link situs — fallback.'); return null; }
  if (!names.some((n) => text.includes(n))) { console.log('⚠️  Output tanpa nama provider asli — fallback.'); return null; }

  return text;
}

// ── Bangun thread (versi VIRAL / evergreen) ───────────────────────
// 2026-08-04: TIDAK ada lagi satu kerangka template. Ada BEBERAPA "gaya"
// natural yang dirotasi acak — cerita, perbandingan, tip-list, kontroversi,
// pertanyaan — jadi feed tidak terlihat kloning template yang sama.
// Selalu wajib: link tokengratis.web.id + CTA (aturan bisnis).
function buildThread(d, dayOfYear, learnings) {
  const providers = d.providers || [];

  // 4 dari 5 hari pakai topik viral (bukan 100% supaya feed tidak monoton)
  const useViral = (dayOfYear % 5) < 4;

  // Loop belajar: kalau data membuktikan "angka konkret" & "hook emosi" & "kata
  // gratis" berkorelasi kuat, prefer gaya template yang mengandung elemen itu.
  const brief = insightBrief(learnings);
  const wantNum = learnings && learnings.strong.some((c) => c.param === 'has_number' && c.rho > 0.25);
  const wantFree = learnings && learnings.strong.some((c) => c.param === 'has_free' && c.rho > 0.25);
  const wantEmo = learnings && learnings.strong.some((c) => c.param === 'has_emo' && c.rho > 0.25);
  const wantModel = learnings && learnings.strong.some((c) => c.param === 'has_model' && c.rho > 0.25);

  if (useViral) {
    const t = pickFreshTopic(dayOfYear + slot.idx);
    // kalau tidak ada topik fresh → lewati viral, pakai evergreen natural
    if (t) {
      const hook = typeof t.hook === 'function' ? t.hook() : pickHook(t.hook || []);
      const facts = (t.facts || []).slice(0, 4).join('\n');
      const freePaths = (t.freePath || []).slice(0, 4).join('\n');
      const styles = [
        `${hook}\n\n${facts}\n\nCara dapat GRATIS-nya:\n${freePaths}\n\n${SITE}\n\n${t.ctaQ}`,
        `${hook}\n\n${facts}\n\nNggak mau langganan mahal? Beberapa di daftar ini beneran bisa diakses tanpa kartu kredit — cek linknya:\n${SITE}\n\n${t.ctaQ}`,
        `${hook}\n\nIntinya gini:\n${facts}\n\nBuat yang cuma mau coba-coba dulu, masih ada jalan gratisnya:\n${freePaths}\n\nLengkapnya di ${SITE} — tinggal scroll.\n\n${t.ctaQ}`,
      ];
      return pick(styles);
    }
  }

  // ── Evergreen (daftar provider) — beberapa "gaya" natural, rotasi acak ──
  const byCat = (id) => providers.filter((p) => p.kategori === id);
  const api = byCat('api');
  const list = (api.length ? api : providers).slice(0, 4)
    .map((p) => `• ${p.nama}${p.badge ? ' (' + badgeLabel(p.badge) + ')' : ''}: ${cap(p.deskripsi || '', 70)}`)
    .join('\n');

  const styles = [
    `"Nggak usah langganan banyak-banyak..." — kata temanku, ternyata bener.\n\n4 AI gratis yang aku cek hari ini:\n\n${list}\n\nDaftar lengkap + tutorial ambil key sendiri:\n${SITE}\n\nYang mana baru pertama kamu denger? Komen 👇`,
    `Aku sempet mikir, kenapa ada yang rela bayar $20/bulan kalau banyak yang gratis?\n\nBandingin sendiri yang ini:\n\n${list}\n\nSemua bisa diakses tanpa bayar — panduannya di ${SITE}.\n\nMau aku bahas yang mana lebih dalem?`,
    `Sering ditanya, "AI gratis tuh beneran ada nggak sih?"\n\nBeneran. Contoh yang lagi jalan:\n\n${list}\n\nKumpulan lengkapnya, bebas kartu kredit:\n${SITE}\n\nShare ke teman yang masih mikir AI itu cuma buat yang bayar 🙌`,
    `Kadang cukup butuh 1 tool yang pas, bukan 10 langganan.\n\nYang ini aku cek dan masih bisa dipakai gratis:\n\n${list}\n\nTutorial dan propotnya yang lain:\n${SITE}\n\nKamu biasanya pakai AI buat apa?`,
  ];
  // Loop belajar (fallback template): semua gaya evergreen sudah mengandung
  // angka + "gratis" + hook — insight tinggal memilih yang paling cocok.
  if (wantNum || wantFree || wantEmo || wantModel) {
    // prefer gaya yang kuat (no.1 & no.2 memuat angka & perbandingan)
    return pick([styles[0], styles[1], styles[0], styles[2]]);
  }
  return pick(styles);
}

  // ── Format penyimpanan ─────────────────────────────────────────
// Slot posting: 3×/hari (WIB 07:00, 12:30, 20:00 = UTC 00:00, 05:30, 13:00)
// Tiap slot dapat file draft & topik BERBEDA (dayOfYear + slotIndex) biar
// tidak ada konten sama/ulang dalam sehari.
function slotInfo(now) {
  const h = now.getUTCHours(), m = now.getUTCMinutes();
  if (h === 0) return { label: '0700', idx: 0 };
  if (h === 5 && m >= 30) return { label: '1230', idx: 1 };
  if (h === 13) return { label: '2000', idx: 2 };
  // di luar slot resmi (mis. manual dispatch siang): tetap boleh, label acak
  return { label: ('0' + h).slice(-2) + ('0' + Math.floor(m/10)).slice(-2), idx: 0 };
}
// Hitung slot SEKALI di module scope supaya buildGeminiPrompt/buildThread/main
// memakai nilai yang sama (tidak ada 'slot is not defined').
const slot = slotInfo(new Date());

async function main() {
  const d = await readContent();
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const slotKey = iso + '-' + slot.label;

  // Prioritas: konten ditulis Gemini (AI) → fallback template bila gagal
  // Loop belajar: insight dari data akun (kalau ada) ikut membentuk konten.
  const learnings = loadLearnings();
  if (learnings) console.log('🧠 Loop belajar aktif: ' + learnings.n_posts + ' post dipelajari, ' + learnings.strong.length + ' parameter terbukti.');
  const aiText = await generateWithGemini(d, dayOfYear, learnings);
  const thread = aiText || buildThread(d, dayOfYear, learnings);
  console.log(aiText ? '🤖 Ditulis Gemini (' + GEMINI_MODEL + ')' : '📋 Dari template cadangan');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, slotKey + '.json'), JSON.stringify({ date: slotKey, slot: slot.label, thread }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, slotKey + '.md'), thread);
  console.log('✅ Thread ' + slotKey + ' (slot ' + slot.label + ') siap:');
  console.log(thread);
  console.log('\n---');
  console.log('Simpan di promo/threads/' + slotKey + '.md');
}

main().catch((e) => { console.error('❌ ' + (e && e.stack || e.message)); process.exit(1); });