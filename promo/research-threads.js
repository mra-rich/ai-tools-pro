#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════
// research-threads.js — RISET AMATI-TIRU-MODIFIKASI di Threads:
// Cari konten niche AI yang VIRAL di Threads, temukan yang SAMA tapi
// TIDAK viral, dan bandingkan kenapa beda.
//
// Memakai izin `threads_profile_discovery` via /threads_discovery/search.
// Dijalankan di GH Actions (punya THREADS_API_CONFIG). Menulis:
//   promo/analytics/threads-research.json  ← hasil analisis untuk dipakai
// ═════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

// ── Config: sama seperti post-api.js ──
function loadConfig() {
  const env = process.env.THREADS_API_CONFIG;
  if (!env) throw new Error('No THREADS_API_CONFIG');
  let raw = env;
  if (raw.startsWith('{')) {
    return JSON.parse(raw);
  }
  if (/^THAA[\w-]+$/.test(raw.trim())) return { access_token: raw.trim(), user_id: '' };
  throw new Error('Bad config');
}

const BASE = 'https://graph.threads.net/v1.0';

async function api(pathname, params, token) {
  const p = new URLSearchParams({ access_token: token, ...params });
  const url = `${BASE}${pathname}?${p}`;
  const res = await fetch(url);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

// Kata kunci niche AI — disesuaikan dengan audiens (fokus gratis/model)
const QUERIES = [
  'AI gratis', 'AI free', 'model AI', 'ChatGPT', 'Claude',
  'Qwen', 'AI tools', 'kimi ai', 'AI AUTOMATION AI indonesia'
];

function scorePost(p) {
  // engagement rate pokok; kalau ada insights kita pakai,
  // kalau tidak, estimasi dari count komentar suka share
  let score = 0;
  const likes = +(p.like_count || 0);
  const replies = +(p.reply_count || 0);
  const reposts = +(p.repost_count || 0);
  const quotes = +(p.quote_count || 0);
  score = likes + 2 * replies + 1.5 * reposts + 0.5 * quotes;
  return { score, likes, replies, reposts, quotes };
}

async function main() {
  const cfg = loadConfig();
  const token = cfg.access_token;
  const out = { generated_at: new Date().toISOString(), queries: [], viral: [], non_viral: [], pairs: [] };

  // ── AMATI: cari konten AI di Threads ──
  for (const q of QUERIES) {
    let tr;
    try {
      tr = await api('/threads_discovery/search', { q, fields: 'id,text,like_count,reply_count,repost_count,quote_count,permalink,timestamp,media_product_type' }, token);
    } catch (e) {
      out.queries.push({ q, error: String(e.message || e) });
      continue;
    }
    if (!tr || !tr.data) {
      out.queries.push({ q, error: tr ? JSON.stringify(tr).slice(0,120) : 'empty' });
      continue;
    }
    const scored = tr.data.map((p) => {
      const s = scorePost(p);
      return { ...p, score: s.score, likes: s.likes, replies: s.replies, reposts: s.reposts, quotes: s.quotes };
    }).filter((p) => p.text && p.id);
    // normal: semua postingan sudah diurut API by relevansi; kita scoring.
    out.queries.push({ q, total: scored.length, sample: scored.slice(0, 3).map(x => ({ id: x.id, text: (x.text||'').slice(0,70), likes: x.likes, replies: x.replies })) });

    // kumpulkan semua hasil (dedup by id)
    for (const p of scored) {
      const key = p.id;
      const existing = out.pairs.length || 0;
      // simpan ke pool global (dedup manual)
      if (![...out.viral, ...out.non_viral].find(x => x.id === key)) {
        const entry = { id: key, query: q, text: (p.text||'').slice(0, 300), likes: p.likes, replies: p.replies, reposts: p.reposts, quotes: p.quotes, score: p.score, permalink: p.permalink, timestamp: p.timestamp };
        // klasifikasi awal: viral jika ada engagement jelas (score > 50)
        if (p.likes > 50 || p.score > 100) out.viral.push(entry);
        else out.non_viral.push(entry);
      }
    }
  }

  // ── parsing hook: materi eat/imitation di extract di bawah ──
  out.viral.sort((a,b) => b.score - a.score);
  out.non_viral.sort((a,b) => b.score - a.score);

  // ── bandingkan: buat"pair" viral vs non-viral yang mirip topik ──
  // sederhana: bandingkan menggunakan per kata kunci, cari beda pola hook
  const viralTop = out.viral.slice(0, 12);
  const nonViralTop = out.non_viral.slice(0, 12);

  out.summary = {
    total_found: out.viral.length + out.non_viral.length,
    viral_count: out.viral.length,
    non_viral_count: out.non_viral.length,
    viral_top_3: viralTop.slice(0,3).map(p => ({ text: p.text.slice(0,80), likes: p.likes, replies: p.replies })),
    non_viral_top_3: nonViralTop.slice(0,3).map(p => ({ text: p.text.slice(0,80), likes: p.likes, replies: p.replies })),
    hypothesis: (() => {
      // analisis sederhana perbedaan hook antara yang viral vs tidak
      const viralTexts = viralTop.map(p => (p.text||'').toLowerCase());
      const nonViralTexts = nonViralTop.map(p => (p.text||'').toLowerCase());
      const has = (arr, pat) => arr.some(t => (pat instanceof RegExp ? pat.test(t) : t.includes(pat)));
      const pct = (arr, pat) => Math.round((arr.filter(t => pat instanceof RegExp ? pat.test(t) : t.includes(pat)).length / arr.length) * 100);
      return {
        viral_mean_likes: Math.round(viralTop.reduce((a,p)=>a+p.likes,0)/Math.max(1,viralTop.length)),
        nonviral_mean_likes: Math.round(nonViralTop.reduce((a,p)=>a+p.likes,0)/Math.max(1,nonViralTop.length)),
        viral_pct_hook_question: pct(viralTexts, /\?$/),
        nonviral_pct_hook_question: pct(nonViralTexts, /\?$/),
        viral_pct_number: pct(viralTexts, /\d/),
        nonviral_pct_number: pct(nonViralTexts, /\d/),
        viral_pct_exclaim: pct(viralTexts, /!/),
        nonviral_pct_exclaim: pct(nonViralTexts, /!/),
        viral_pct_free: pct(viralTexts, /gratis|free|irit|murah/),
        nonviral_pct_free: pct(nonViralTexts, /gratis|free|irit|murah/),
      };
    })(),
  };

  const dir = path.join(__dirname, 'analytics');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'threads-research.json'), JSON.stringify(out, null, 2));
  console.log('✔ Riset Threads selesai → analytics/threads-research.json');
  console.log('   viral:', out.viral.length, '| non-viral:', out.non_viral.length);
  if (out.summary) console.log('   viral mean likes:', out.summary.hypothesis.viral_mean_likes, 'vs non-viral:', out.summary.hypothesis.nonviral_mean_likes);
}

main().catch((e) => { console.error('ERROR', e); process.exit(1); });