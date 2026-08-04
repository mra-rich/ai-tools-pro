// verify.js — Filter verifikasi otomatis sebelum posting Threads.
// Cek draft promo/threads/*.md yang belum .posted:
//   1) format (panjang, wajib link situs)
//   2) larangan pola penipuan/spam (pinjol, slot, "pasti kaya", dll)
//   3) flag model/perusahaan yang tidak dikenal (warning saja)
// Output: VERIFY_OK / VERIFY_FAIL <alasan>. Exit 0 selalu (di-workflow, FAIL =
// draft dihapus supaya TIDAK diposting, tetap dilaporkan).
const fs = require('fs');
const path = require('path');
const THREADS_DIR = path.join(__dirname, 'threads');
const SITE = 'https://tokengratis.web.id';
// auto-topics berisi hasil riset mingguan; kalau topik hari ini dari sana,
// verifikasi sumbernya masih hidup sebelum diizinkan posting.
let AUTO_TOPICS = [];
try { AUTO_TOPICS = require('./auto-topics.js'); } catch (_) { /* file bisa kosong */ }

const KNOWN_NAMES = [
  'flux', 'black forest', 'alayaworld', 'alaya', 'gemini', 'gpt', 'openai', 'claude',
  'anthropic', 'sonnet', 'opus', 'qwen', 'alibaba', 'kimi', 'moonshot', 'deepseek',
  'llama', 'meta', 'mistral', 'grok', 'xai', 'gemma', 'stable diffusion', 'sora',
  'veo', 'kling', 'runway', 'midjourney', 'huggingface', 'ollama', 'cursor', 'opencode',
  'claude code', 'vllm', 'lm studio', 'chatgpt', 'copilot', 'gemma', 'nemotron',
  'nvidia', 'groq', 'perplexity', 'notebooklm', 'elevenlabs', 'suno', 'udio',
];

const SPAM_PATTERNS = [
  /pinjol/i, /slot online/i, /slot gacor/i, /slot88/i, /slot123/i, /slot777/i,
  /judi slot/i, /\bmenang\b.*\bgratis\b/i, /pasti kaya/i,
  /investasi.*[0-9]x/i, /rahasia.*uang/i, /judi/i, /\bokeb/i,
  /\bpasti untung\b/i, /\bwithdraw\b/i, /\bdaftar sekarang\b/i, /idn slot/i,
  /\bslot\b.*\bdeposit\b/i, /\bjudol\b/i,
];

function findDraft() {
  const files = fs.readdirSync(THREADS_DIR)
    .filter((f) => f.endsWith('.md') && !f.endsWith('.posted'))
    .sort();
  return files.length ? path.join(THREADS_DIR, files[files.length - 1]) : null;
}

async function main() {
  const draft = findDraft();
  if (!draft) { console.log('VERIFY_SKIP (tidak ada draft)'); process.exit(0); }
  const text = fs.readFileSync(draft, 'utf8').trim();
  const problems = [];

  // Cek topik otomatis: kalau salah satu topik auto muncul di draft,
  // pastikan punya sumber URL yang masih hidup (bukan klaim tanpa bukti).
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  if (AUTO_TOPICS.length) {
    const todayTopic = AUTO_TOPICS[dayOfYear % AUTO_TOPICS.length];
    if (todayTopic && todayTopic.topic && text.includes(todayTopic.topic.split(/[.!?]/)[0].slice(0, 30))) {
      const sources = todayTopic.sources || [];
      if (!sources.length) {
        problems.push('topik otomatis tanpa sumber URL (anti-hoax)');
      } else {
        // HEAD cek — sumber mati = jangan post (klaim tidak tertelusuri)
        for (const u of sources.slice(0, 2)) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 8000);
            const res = await fetch(u, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
            clearTimeout(timer);
            if (!res.ok) { problems.push('sumber topik mati: ' + u); break; }
          } catch { problems.push('sumber topik tidak bisa dicek: ' + u); break; }
        }
      }
    }
  }

  if (!text) problems.push('draft kosong');

  // Threads = thread berantai (beberapa post). Cek PER-BARIS ≤ 500 char,
  // bukan keseluruhan draft (draft valid bisa 2-3 post dalam satu thread).
  const lines = text.split('\n').filter((l) => l.trim());
  const longLines = lines.filter((l) => l.length > 500);
  if (longLines.length) problems.push('ada baris >500 char: ' + longLines[0].slice(0, 60) + '…');
  if (lines.length > 12) problems.push('terlalu banyak post dalam 1 thread: ' + lines.length + ' (>12)');
  if (!text.includes(SITE)) problems.push('tidak memuat link situs');

  for (const p of SPAM_PATTERNS) {
    if (p.test(text)) { problems.push('terdeteksi pola spam: ' + p.source); break; }
  }

  // Flag: nama model yang tidak ada di daftar dikenal (warning, tidak tolak)
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  const unknown = words.filter((w) => !KNOWN_NAMES.some((k) => w.includes(k)));
  if (unknown.length > 6) {
    console.log('VERIFY_WARN: banyak istilah tidak dikenal: ' + unknown.slice(0, 8).join(', '));
  }

  if (problems.length) {
    console.log('VERIFY_FAIL: ' + problems.join('; '));
    // Hapus draft supaya tidak diposting (aman > post salah)
    fs.unlinkSync(draft);
    console.log('draft dihapus: ' + path.basename(draft));
    process.exit(0);
  }
  console.log('VERIFY_OK (' + text.length + ' char, draft: ' + path.basename(draft) + ')');
}

main().catch((e) => { console.error('VERIFY_ERROR: ' + e.message); process.exit(0); });