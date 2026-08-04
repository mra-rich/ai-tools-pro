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

const KNOWN_NAMES = [
  'flux', 'black forest', 'alayaworld', 'alaya', 'gemini', 'gpt', 'openai', 'claude',
  'anthropic', 'sonnet', 'opus', 'qwen', 'alibaba', 'kimi', 'moonshot', 'deepseek',
  'llama', 'meta', 'mistral', 'grok', 'xai', 'gemma', 'stable diffusion', 'sora',
  'veo', 'kling', 'runway', 'midjourney', 'huggingface', 'ollama', 'cursor', 'opencode',
  'claude code', 'vllm', 'lm studio', 'chatgpt', 'copilot', 'gemma', 'nemotron',
  'nvidia', 'groq', 'perplexity', 'notebooklm', 'elevenlabs', 'suno', 'udio',
];

const SPAM_PATTERNS = [
  /pinjol/i, /slot/i, /$$$/i, /\bmenang\b.*\bgratis\b/i, /pasti kaya/i,
  /investasi.*[0-9]x/i, /rahasia.*uang/i, /judi/i, /\bokeb/i,
  /\bpasti untung\b/i, /\bwithdraw\b/i, /\bdaftar sekarang\b/i,
];

function findDraft() {
  const files = fs.readdirSync(THREADS_DIR)
    .filter((f) => f.endsWith('.md') && !f.endsWith('.posted'))
    .sort();
  return files.length ? path.join(THREADS_DIR, files[files.length - 1]) : null;
}

function main() {
  const draft = findDraft();
  if (!draft) { console.log('VERIFY_SKIP (tidak ada draft)'); process.exit(0); }
  const text = fs.readFileSync(draft, 'utf8').trim();
  const problems = [];

  if (!text) problems.push('draft kosong');
  if (text.length > 500) problems.push('panjang ' + text.length + ' char (>500)');
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

main();