#!/usr/bin/env node
// refresh-and-probe.js — Refresh token lalu probe endpoint discovery ulang.
// Kalau izin threads_profile_discovery sudah AKTIF (skaft "Siap pengujian"),
// token baru hasil refresh bisa membawa scope-nya sehingga search jalan.
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
async function call(p, params) {
  const url = `${BASE}${p}?${new URLSearchParams(params)}`;
  const r = await fetch(url);
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0,150) }; }
}

function summarize(b) {
  if (!b) return 'undefined';
  if (b.error) return 'ERR: ' + (b.error.message || '').slice(0, 70);
  if (Array.isArray(b.data)) return `✅ DATA (${b.data.length})`;
  if (b.id) return `✅ OK id=${b.id} name=${b.name||''}`.trim();
  return 'OK keys=' + Object.keys(b).join(',');
}

async function main() {
  const cfg = loadConfig();
  let token = cfg.access_token;
  const log = [];

  // 1) REFRESH token (scope baru mengikuti kalau izin bertambah)
  try {
    const ref = await call('/refresh_access_token', { grant_type: 'th_refresh_token', access_token: token });
    if (ref.access_token) {
      token = ref.access_token;
      log.push('✅ REFRESH OK — token baru (expires ' + Math.round((ref.expires_in||0)/86400) + ' hari)');
    } else log.push('⚠ refresh: ' + (ref.error ? ref.error.message : JSON.stringify(ref)).slice(0,80));
  } catch (e) { log.push('⚠ refresh error: ' + e.message); }

  // 2) PROBE ulang endpoint discovery/search dengan token fresh
  const q = 'AI';
  const tests = [
    // Pola Instagram Graph API: *_search / *_discovery
    ['/threads_user_search', { q }],
    ['/ig_user_search', { q }],
    ['/threads_hashtag_search', { q, user_id: cfg.user_id || '' }],
    ['/ig_hashtag_search', { q, user_id: cfg.user_id || '' }],
    ['/threads_discovery', { q }],
    ['/threads_discovery/search', { q }],
    // discovery berbasis user id (akses profil publik)
    ...(cfg.user_id ? [
      ['/' + cfg.user_id + '/discovery', { q }],
      ['/' + cfg.user_id + '/profile_discovery', { q }],
      ['/' + cfg.user_id + '/search', { q }],
    ] : []),
    ['/me', { fields: 'id,username,name' }], // kontrol: token masih valid?
  ];
  log.push('\n=== PROBE ULANG (token fresh) ===');
  for (const [p, params] of tests) {
    const r = await call(p, { ...params, access_token: token });
    log.push(`  [${p}] → ${summarize(r)}`);
  }

  const txt = log.join('\n');
  console.log(txt);
  fs.mkdirSync('/tmp', { recursive: true });
  fs.writeFileSync('/tmp/refresh-probe-result.txt', txt);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });