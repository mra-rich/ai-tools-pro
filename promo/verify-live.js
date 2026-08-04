#!/usr/bin/env node
// verify-live.js — Cek postingan yang benar-benar LIVE di akun via /me/threads.
const BASE = 'https://graph.threads.net/v1.0';
async function call(p, params) {
  const r = await fetch(BASE + p + '?' + new URLSearchParams(params));
  return r.json();
}
async function main() {
  let cfg;
  const env = process.env.THREADS_API_CONFIG;
  if (env && env.startsWith('{')) cfg = JSON.parse(env);
  else if (env && /^THAA[\w-]+$/.test(env.trim())) cfg = { access_token: env.trim(), user_id: '' };
  else throw new Error('No config');
  const c = { ...cfg, access_token: cfg.access_token };
  const me = await call('/me', { fields: 'id,username,name', access_token: c.access_token });
  console.log('👤', me.name, '@' + me.username, '(id ' + me.id + ')');
  const uid = cfg.user_id || me.id;
  const posts = await call('/' + uid + '/threads', { fields: 'id,text,like_count,view_count,replies_count,reposted_count', access_token: c.access_token });
  const arr = posts.data || [];
  console.log('\n=== LATEST POSTS LIVE DI AKUN (@' + me.username + ') — ' + arr.length + ' item ===');
  for (const p of arr.slice(0, 12)) {
    const t = (p.text || '').replace(/\n+/g, ' ').slice(0, 70);
    console.log(`- id=${p.id}  ♥${p.like_count} ▶${p.view_count} 💬${p.replies_count}`);
    console.log(`    ${t}`);
  }
  if (posts.error) console.log('ERR:', posts.error.message);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });