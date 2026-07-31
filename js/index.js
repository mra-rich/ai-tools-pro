// ═════════════════════════════════════════════════════════════════
// index.js — logika app pembeli (AI Tools Pro)
// Aktivasi divalidasi oleh Cloudflare Worker (lihat worker/src/index.js).
// Dependensi global: APP_CONFIG, sha256Hex, getDeviceFingerprint (crypto.js),
// escapeHtml, setMsg, flashButton (ui.js), activateOrder (api.js).
// ═════════════════════════════════════════════════════════════════

// ── INIT ──────────────────────────────────────────────────────────
async function init() {
  // Isi link & teks dari config terpusat
  document.getElementById('lynk-link').href = APP_CONFIG.LYNK_URL;
  document.getElementById('lynk-link-2').href = APP_CONFIG.LYNK_URL;
  document.getElementById('seller-contact').textContent = APP_CONFIG.SELLER_CONTACT;

  const sess = localStorage.getItem(APP_CONFIG.SESSION_KEY);
  if (sess) {
    try {
      const { orderId, deviceId } = JSON.parse(sess);
      const fp = await getDeviceFingerprint();
      if (fp === deviceId) {
        showDash(orderId);
        return;
      }
    } catch {
      // sesi korup — hapus dan kembali ke landing
    }
    localStorage.removeItem(APP_CONFIG.SESSION_KEY);
  }
}

// ── ACTIVATION ────────────────────────────────────────────────────
async function activate() {
  const orderId = document.getElementById('order-input').value.trim();
  const msg = document.getElementById('lock-msg');
  const btn = document.getElementById('btn-activate');
  if (!orderId) {
    setMsg(msg, 'Masukkan Order ID dari email konfirmasi lynk.id.', 'err');
    return;
  }

  setBtnLoading(btn, true, 'Memverifikasi...');
  try {
    const deviceId = await getDeviceFingerprint();
    const { status, data } = await activateOrder(orderId, deviceId);

    if (status === 200 && data.ok) {
      localStorage.setItem(
        APP_CONFIG.SESSION_KEY,
        JSON.stringify({ orderId: data.orderId, deviceId }),
      );
      setMsg(msg, '✅ Berhasil! Memuat dashboard...', 'ok');
      setTimeout(() => showDash(data.orderId), 700);
      requestAnimationFrame(() => setBtnLoading(btn, false));
      return;
    }

    if (status === 404) {
      setMsg(msg, '❌ Order ID tidak ditemukan. Pastikan pembayaran sudah sukses dan coba lagi — order baru perlu beberapa saat untuk terdaftar.', 'err');
    } else if (status === 409) {
      setMsg(msg, '❌ Order ID ini sudah aktif di device lain. Hubungi penjual untuk reset device.', 'err');
    } else {
      setMsg(msg, '❌ Verifikasi gagal (' + status + '). Coba beberapa saat lagi.', 'err');
    }
  } catch {
    setMsg(msg, '❌ Tidak bisa terhubung ke server verifikasi. Cek koneksi internet kamu.', 'err');
  }
  setBtnLoading(btn, false);
}

function setBtnLoading(btn, on, label) {
  btn.disabled = on;
  btn.innerHTML = on ? '<div class="spin16"></div> ' + label : '⚡ Aktifkan Sekarang';
}

function doLogout() {
  if (!confirm('Reset aktivasi? Kamu perlu input Order ID lagi.')) return;
  localStorage.removeItem(APP_CONFIG.SESSION_KEY);
  location.reload();
}

// ── UI HELPERS ────────────────────────────────────────────────────
function showDash(orderId) {
  document.getElementById('screen-landing').style.display = 'none';
  document.getElementById('screen-dash').style.display = 'flex';
  document.getElementById('dash-order').textContent =
    '✅ ' + orderId.substring(0, 14) + (orderId.length > 14 ? '…' : '');
  loadContent();
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-pane').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}

function swCk(name, btn) {
  document.querySelectorAll('.cpanel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.ctab').forEach((b) => b.classList.remove('active'));
  document.getElementById('cp-' + name).classList.add('active');
  btn.classList.add('active');
}

function tv(id, btn) {
  const i = document.getElementById(id);
  i.type = i.type === 'password' ? 'text' : 'password';
  btn.textContent = i.type === 'password' ? '👁' : '🙈';
}

// ── CONTENT ───────────────────────────────────────────────────────
// Konten dilindungi Worker: hanya device yang sudah aktivasi yang
// bisa membacanya. Tidak ada lagi data produk di file public.
async function loadContent() {
  const showErrState = () => {
    ['db-loading', 'tut-loading'].forEach((i) => (document.getElementById(i).style.display = 'none'));
    ['db-err', 'tut-err'].forEach((i) => (document.getElementById(i).style.display = 'block'));
  };
  try {
    const sess = JSON.parse(localStorage.getItem(APP_CONFIG.SESSION_KEY) || 'null');
    if (!sess) return showErrState();

    const { status, data } = await fetchContent(sess.orderId, sess.deviceId);
    if (status === 200 && data) {
      renderDatabase(data);
      renderTutorial(data);
      renderOnboarding(data);
      return;
    }
    if (status === 401) {
      // Sesi tidak valid lagi (binding di-reset / dihapus) → kembali ke landing
      localStorage.removeItem(APP_CONFIG.SESSION_KEY);
      location.reload();
      return;
    }
    showErrState();
  } catch {
    showErrState();
  }
}

// ── RENDER: Database Provider (per kategori) ─────────────────────
// ── RENDER: Database Provider (per kategori) + search/filter ─────
let dbData = null; // konten mentah terakhir
const dbFilter = { q: '', kategori: '', badge: '' };

function renderProviderCard(p) {
  const models = (p.model || [])
    .map((m) => `<span class="prov-model">${escapeHtml(m)}</span>`)
    .join('');
  const badge = p.badge
    ? `<span class="prov-badge">${escapeHtml(p.badge)}</span>`
    : '';
  // Link affiliate (affUrl) diprioritaskan bila diset di konten
  const link = p.affUrl || p.url;
  return `
    <div class="prov-card">
      <div class="prov-head">
        <div class="prov-name">${escapeHtml(p.emoji || '🔹')} ${escapeHtml(p.nama)}</div>
        ${badge}
      </div>
      <div class="prov-desc">${escapeHtml(p.deskripsi)}</div>
      ${models ? `<div class="prov-models">${models}</div>` : ''}
      ${p.cara ? `<div class="prov-cara">📌 ${escapeHtml(p.cara)}</div>` : ''}
      <div class="prov-meta">
        <span>⏳ ${escapeHtml(p.limit || '')}</span>
        <a class="prov-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Buka situs ↗</a>
      </div>
    </div>`;
}

function providerMatches(p) {
  if (dbFilter.kategori && p.kategori !== dbFilter.kategori) return false;
  if (dbFilter.badge && !(p.badge || '').toUpperCase().includes(dbFilter.badge.toUpperCase())) return false;
  if (dbFilter.q) {
    const hay = [p.nama, p.deskripsi, p.cara, p.limit, p.badge, ...(p.model || [])].join(' ').toLowerCase();
    if (!hay.includes(dbFilter.q.toLowerCase())) return false;
  }
  return true;
}

function applyDbFilter() {
  if (!dbData) return;
  const filtered = (dbData.providers || []).filter(providerMatches);
  const byKat = {};
  filtered.forEach((p) => {
    (byKat[p.kategori] = byKat[p.kategori] || []).push(p);
  });
  const count = document.getElementById('db-count');
  count.textContent = filtered.length + ' dari ' + (dbData.providers || []).length + ' provider';

  const sections = (dbData.kategori || [])
    .map((k) => ({ k, items: byKat[k.id] || [] }))
    .filter(({ items }) => items.length > 0);

  document.getElementById('db-body').innerHTML = sections.length
    ? sections
        .map(
          ({ k, items }) => `
          <div class="db-sec">
            <h3>${escapeHtml(k.nama)}</h3>
            <p class="db-sub">${escapeHtml(k.sub)}</p>
            <div class="prov-grid">${items.map(renderProviderCard).join('')}</div>
          </div>`,
        )
        .join('')
    : `<div class="db-empty">🔍 Tidak ada provider yang cocok dengan filter ini.<br>Coba kata kunci lain atau reset filter.</div>`;
}

function renderDbFilters(d) {
  const el = document.getElementById('db-filters');
  const badges = [...new Set((d.providers || []).map((p) => p.badge).filter(Boolean))];
  const chips = [
    { type: 'kategori', value: '', label: 'Semua' },
    ...(d.kategori || []).map((k) => ({ type: 'kategori', value: k.id, label: k.nama })),
    ...badges.map((b) => ({ type: 'badge', value: b, label: b })),
  ];
  el.innerHTML = chips
    .map(
      (c) =>
        `<button class="db-fchip${dbFilter[c.type] === c.value ? ' sel' : ''}" data-ftype="${c.type}" data-fval="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`,
    )
    .join('');
}

document.getElementById('db-search').addEventListener('input', (e) => {
  dbFilter.q = e.target.value.trim();
  applyDbFilter();
});
document.getElementById('db-filters').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-ftype]');
  if (!chip) return;
  const t = chip.dataset.ftype;
  // klik ulang = lepas filter (toggle)
  dbFilter[t] = dbFilter[t] === chip.dataset.fval && chip.dataset.fval !== '' ? '' : chip.dataset.fval;
  renderDbFilters(dbData);
  applyDbFilter();
});

function renderDatabase(d) {
  dbData = d;
  document.getElementById('db-loading').style.display = 'none';
  document.getElementById('db-content').style.display = 'block';
  document.getElementById('db-announce').textContent = '📢 ' + (d.pengumuman || '');
  document.getElementById('db-date').textContent = '📅 Update: ' + (d.tanggal || '');
  renderDbFilters(d);
  applyDbFilter();
}

const LVL_BY_LEVEL = {
  Pemula: { cls: 'lvl-p', icon: '🟢' },
  Menengah: { cls: 'lvl-m', icon: '🟡' },
};
const DEFAULT_LVL = { cls: 'lvl-l', icon: '🔴' };

function renderTutorial(d) {
  document.getElementById('tut-loading').style.display = 'none';
  const l = document.getElementById('tut-list');
  l.style.display = 'grid';
  l.innerHTML = (d.tutorial || [])
    .map((t) => {
      const lvl = LVL_BY_LEVEL[t.level] || DEFAULT_LVL;
      return `
    <a class="tut-card" href="${escapeHtml(t.url)}" target="_blank" rel="noopener">
      <div class="tut-emoji">${escapeHtml(t.emoji || '📖')}</div>
      <div class="tut-body">
        <div class="tut-title">${escapeHtml(t.judul)}</div>
        <div class="tut-desc">${escapeHtml(t.deskripsi)}</div>
        <div class="tut-meta">
          <span class="lvl ${lvl.cls}">${lvl.icon} ${escapeHtml(t.level)}</span>
          <span class="tut-dur">⏱️ ${escapeHtml(t.durasi)}</span>
        </div>
      </div>
      <div class="tut-arr">→</div>
    </a>`;
    })
    .join('');
}

// ── ONBOARDING wizard ─────────────────────────────────────────────
let obPaths = [];
let obActive = null;

const OB_LVL = {
  Pemula: 'lv-p',
  Menengah: 'lv-m',
};

function renderOnboarding(d) {
  obPaths = d.onboarding || [];
  const chips = document.getElementById('ob-chips');
  const root = document.getElementById('ob-root');
  if (!obPaths.length) {
    chips.innerHTML = '';
    root.innerHTML = '';
    return;
  }
  chips.innerHTML = obPaths
    .map(
      (p, i) =>
        `<button class="ob-chip${i === (obActive ?? 0) ? ' sel' : ''}" data-ob="${i}">${escapeHtml(p.ikon)} ${escapeHtml(p.judul)}</button>`,
    )
    .join('');
  selectObPath(obActive ?? 0);
}

function selectObPath(i) {
  obActive = i;
  const p = obPaths[i];
  if (!p) return;
  document.querySelectorAll('.ob-chip').forEach((c, ci) => c.classList.toggle('sel', ci === i));
  const lv = OB_LVL[p.tingkat] || OB_LVL.Pemula;
  document.getElementById('ob-root').innerHTML = `
    <div class="ob-path">
      <div class="ob-path-hd">
        <div class="ob-path-ico">${escapeHtml(p.ikon)}</div>
        <div>
          <div class="ob-path-title">${escapeHtml(p.judul)}</div>
          <div class="ob-path-sub">🎯 ${escapeHtml(p.untuk || '')}</div>
        </div>
        <span class="ob-level ${lv}">${p.tingkat === 'Menengah' ? '🟡' : '🟢'} ${escapeHtml(p.tingkat || 'Pemula')}</span>
      </div>
      <div class="ob-steps">
        ${(p.langkah || [])
          .map(
            (s, si) => `
          <div class="ob-step">
            <div class="ob-num">${si + 1}</div>
            <div class="ob-body">
              <div class="ob-step-t">${escapeHtml(s.judul)}</div>
              ${s.aksi ? `<div class="ob-step-a">${escapeHtml(s.aksi)}</div>` : ''}
              ${s.kode ? `<div class="ob-code"><code class="ob-code-t">${escapeHtml(s.kode)}</code><button class="ob-copy" data-obcopy="${si}">Salin</button></div>` : ''}
            </div>
          </div>`,
          )
          .join('')}
      </div>
    </div>`;
}

// Klik chip jalur & tombol salin kode — event delegation
document.getElementById('ob-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-ob]');
  if (chip) selectObPath(Number(chip.dataset.ob));
});
document.getElementById('ob-root').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-obcopy]');
  if (!btn) return;
  const stepEl = btn.closest('.ob-code').querySelector('.ob-code-t');
  navigator.clipboard.writeText(stepEl.textContent);
  btn.textContent = 'Tersalin!';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = 'Salin';
    btn.classList.remove('copied');
  }, 2000);
});

// ── API CHECKERS ──────────────────────────────────────────────────
function showRes(id, st, title, detail) {
  const el = document.getElementById(id);
  el.className = 'cres vis ' + st;
  const ic = st === 'ok' ? '✅' : st === 'err' ? '❌' : '⚠️';
  el.innerHTML = `<span>${ic}</span><div><div class="cres-ttl">${title}</div><div class="cres-det">${detail}</div></div>`;
}

function setLd(btn, on) {
  btn.disabled = on;
  btn.innerHTML = on ? '<div class="spin16"></div> Memeriksa...' : '🔍 Cek API Key';
}

async function ckAnthropic() {
  const key = document.getElementById('k-an').value.trim();
  const model = document.getElementById('m-an').value.trim() || 'claude-haiku-4-5';
  const btn = document.querySelector('#cp-anthropic .btn-ck');
  if (!key) return showRes('r-an', 'warn', 'API Key kosong', 'Masukkan API key terlebih dahulu.');
  setLd(btn, true);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' }, body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }) });
    const d = await r.json();
    if (r.ok) showRes('r-an', 'ok', 'API Key Valid ✓', `Model: ${d.model} | Stop: ${d.stop_reason} | Tokens: ${d.usage?.input_tokens}`);
    else showRes('r-an', 'err', `Error ${r.status}: ${d.error?.type || 'Unknown'}`, d.error?.message || JSON.stringify(d));
  } catch (e) { showRes('r-an', 'err', 'Gagal terhubung', e.message); }
  finally { setLd(btn, false); }
}

async function ckOpenAI() {
  const key = document.getElementById('k-oa').value.trim();
  const model = document.getElementById('m-oa').value.trim() || 'gpt-4o-mini';
  const btn = document.querySelector('#cp-openai .btn-ck');
  if (!key) return showRes('r-oa', 'warn', 'API Key kosong', 'Masukkan API key terlebih dahulu.');
  setLd(btn, true);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }) });
    const d = await r.json();
    if (r.ok) showRes('r-oa', 'ok', 'API Key Valid ✓', `Model: ${d.model} | Finish: ${d.choices?.[0]?.finish_reason} | Tokens: ${d.usage?.total_tokens}`);
    else showRes('r-oa', 'err', `Error ${r.status}: ${d.error?.code || d.error?.type || 'Unknown'}`, d.error?.message || JSON.stringify(d));
  } catch (e) { showRes('r-oa', 'err', 'Gagal terhubung', e.message); }
  finally { setLd(btn, false); }
}

async function ckGoogle() {
  const key = document.getElementById('k-gg').value.trim();
  const model = document.getElementById('m-gg').value.trim() || 'gemini-2.0-flash';
  const btn = document.querySelector('#cp-google .btn-ck');
  if (!key) return showRes('r-gg', 'warn', 'API Key kosong', 'Masukkan API key terlebih dahulu.');
  setLd(btn, true);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }) });
    const d = await r.json();
    if (r.ok) {
      const c = d.candidates?.[0];
      const sf = c?.safetyRatings?.length ? c.safetyRatings.map((s) => s.category.split('_').pop()).join(', ') : 'OK';
      showRes('r-gg', 'ok', 'API Key Valid ✓', `Model: ${model} | Finish: ${c?.finishReason || 'STOP'} | Safety: ${sf}`);
    } else showRes('r-gg', 'err', `Error ${r.status}: ${d.error?.status || 'Unknown'}`, d.error?.message || JSON.stringify(d));
  } catch (e) { showRes('r-gg', 'err', 'Gagal terhubung', e.message); }
  finally { setLd(btn, false); }
}

async function ckMistral() {
  const key = document.getElementById('k-ms').value.trim();
  const model = document.getElementById('m-ms').value.trim() || 'mistral-small-latest';
  const btn = document.querySelector('#cp-mistral .btn-ck');
  if (!key) return showRes('r-ms', 'warn', 'API Key kosong', 'Masukkan API key terlebih dahulu.');
  setLd(btn, true);
  try {
    const r = await fetch('https://api.mistral.ai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }) });
    const d = await r.json();
    if (r.ok) showRes('r-ms', 'ok', 'API Key Valid ✓', `Model: ${d.model || model} | Finish: ${d.choices?.[0]?.finish_reason} | Tokens: ${d.usage?.total_tokens ?? '—'}`);
    else showRes('r-ms', 'err', `Error ${r.status}: ${d.error?.type || d.message || 'Unknown'}`, d.error?.message || d.message || JSON.stringify(d));
  } catch (e) { showRes('r-ms', 'err', 'Gagal terhubung', e.message); }
  finally { setLd(btn, false); }
}

const PRESETS = {
  groq:      { url: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant', kh: 'Dapatkan di console.groq.com', mh: 'Contoh: llama-3.1-8b-instant, gemma2-9b-it' },
  together:  { url: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3-8b-chat-hf', kh: 'Dapatkan di api.together.ai', mh: 'Format: org/model-name' },
  openrouter:{ url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', kh: 'Dapatkan di openrouter.ai/keys', mh: 'Contoh: openai/gpt-4o-mini' },
  deepseek:  { url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', kh: 'Dapatkan di platform.deepseek.com', mh: 'Model: deepseek-chat, deepseek-reasoner' },
  fireworks: { url: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/llama-v3p1-8b-instruct', kh: 'Dapatkan di fireworks.ai', mh: 'Format: accounts/fireworks/models/...' },
  ollama:    { url: 'http://localhost:11434/v1', model: 'llama3.2', kh: 'Tidak perlu key — isi "ollama"', mh: 'Model yang sudah di-pull' },
  lmstudio:  { url: 'http://localhost:1234/v1', model: 'local-model', kh: 'Tidak perlu key — isi "lmstudio"', mh: 'Identifier model dari LM Studio' },
  '9router': { url: 'http://localhost:20128/v1', model: '', kh: 'API key 9Router kamu', mh: 'Nama model di 9Router' },
  manual:    { url: '', model: '', kh: 'API key dari provider', mh: 'Nama model yang tersedia' },
};

function applyP(name, btn) {
  const p = PRESETS[name];
  if (!p) return;
  document.getElementById('c-url').value = p.url;
  document.getElementById('c-mdl').value = p.model;
  document.getElementById('c-key-h').textContent = p.kh;
  document.getElementById('c-mdl-h').textContent = p.mh;
  document.querySelectorAll('.ppill').forEach((b) => b.classList.remove('sel'));
  btn.classList.add('sel');
  const r = document.getElementById('r-cu');
  r.className = 'cres';
  r.innerHTML = '';
}

async function ckCustom() {
  const key = document.getElementById('c-key').value.trim();
  const url = document.getElementById('c-url').value.trim().replace(/\/$/, '');
  const model = document.getElementById('c-mdl').value.trim();
  const btn = document.querySelector('#cp-custom .btn-ck');
  if (!url) return showRes('r-cu', 'warn', 'Base URL kosong', 'Pilih preset atau isi Base URL terlebih dahulu.');
  if (!model) return showRes('r-cu', 'warn', 'Model kosong', 'Isi nama model yang ingin diuji.');
  setLd(btn, true);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;
    const r = await fetch(`${url}/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }) });
    const d = await r.json();
    if (r.ok) showRes('r-cu', 'ok', 'API Key Valid ✓', `Model: ${d.model || model} | Finish: ${d.choices?.[0]?.finish_reason} | Tokens: ${d.usage?.total_tokens ?? '—'}`);
    else {
      const msg = d.error?.message || d.message || JSON.stringify(d);
      const isEmbed = msg.toLowerCase().includes('embedding');
      showRes('r-cu', 'err', `Error ${r.status}: ${d.error?.code || d.error?.type || r.status}`,
        isEmbed ? '⚠️ Ini adalah embedding model. Gunakan model chat/completions.' : msg);
    }
  } catch (e) {
    showRes('r-cu', 'err', 'Gagal terhubung', e.message.includes('Failed to fetch')
      ? 'Tidak bisa terhubung. Pastikan URL benar dan server aktif. Untuk localhost, pastikan CORS diaktifkan.'
      : e.message);
  }
  finally { setLd(btn, false); }
}

// Enter = aksi utama halaman yang tampak
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('screen-landing').style.display !== 'none') {
    activate();
    return;
  }
  document.querySelector('.cpanel.active')?.querySelector('.btn-ck')?.click();
});

init();
