#!/usr/bin/env node
// probe-threads.js — Prober kandidat endpoint Threads API untuk RISET konten.
// Menjalankan beberapa path + query yang mungkin, pakai token asli, dan
// melaporkan mana yang memberikan data (bukan error 'does not exist').
// Ini AMATI dulu: cari endpoint yang BENERAN jalan sebelum bangun tool.
const fs = require('fs');
const path = require('path');

function loadConfig() {
  const env = process.env.THREADS_API_CONFIG;
  if (!env) throw new Error('No THREADS_API_CONFIG');
  let raw = env;
  if (raw.startsWith('{')) return JSON.parse(raw);
  if (/^THAA[\w-]+$/.test(raw.trim())) return { access_token: raw.trim(), user_id: '' };
  throw new Error('Bad config');
}

const BASE = 'https://graph.threads.net/v1.0';

async function probe(pathname, params, token) {
  const p = new URLSearchParams({ access_token: token, ...params });
  const url = `${BASE}${pathname}?${p}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url);
    const txt = await res.text();
    let j;
    try { j = JSON.parse(txt); } catch { j = { raw: txt.slice(0,150) }; }
    return { url, status: res.status, ms: Date.now()-t0, body: j };
  } catch (e) {
    return { url, error: String(e.message || e) };
  }
}

function summarize(body) {
  if (!body) return 'undefined';
  if (body.error) return 'ERR: ' + (body.error.message || JSON.stringify(body.error)).slice(0, 90);
  const keys = Object.keys(body);
  const data = Array.isArray(body.data) ? body.data : null;
  if (data) return `✅ DATA (${data.length} items)`;
  return `GEHY? keys=${keys.join(',')} ${body.name || body.username || ''}`.slice(0, 100);
}

async function main() {
  const cfg = loadConfig();
  const token = cfg.access_token;
  const uid = cfg.user_id || '';
  const out = [];
  const q = 'AI gratis';

  const tests = [
    // kandidat search/discovery umum
    ['/threads_discovery/search', { q, fields: 'id,text,like_count' }],
    ['/threads_discovery', { q }],
    ['/discovery/search', { q }],
    ['/discovery', { q }],
    ['/threads/search', { q }],
    ['/search', { q }],
    ['/me/search', { q }],
    ['/media/{uid}/search', { q }],
    // berbasis user id
    ['/me/threads', { fields: 'id,text,like_count' }],
    ['/me', { fields: 'id,username,name' }],
    ['/{uid}/threads', { fields: 'id,text,like_count' }],
    ['/{uid}/profile_discovery', { q }],
    ['/profile_discovery', { q }],
  ];
  for (const [p, params] of tests) {
    const real = p.replace('{uid}', uid || 'me');
    const r = await probe(real, params, token);
    out.push({ path: real, status: r.status, ms: r.ms, verdict: summarize(r.body) });
  }
  fs.writeFileSync('/tmp/threads-probe.json', JSON.stringify(out, null, 2));
  console.log('=== PROBE THREADS API (token asli) ===');
  console.log('user_id:', uid ? uid : '(kosong)');
  console.log();
  for (const r of out) {
    console.log(`  [${r.status}] ${r.path} (${r.ms}ms) → ${r.verdict}`);
  }
}

main().catch((e) => { console.error('ERROR', e); process.exit(1); });