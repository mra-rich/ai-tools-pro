// ═════════════════════════════════════════════════════════════════
// index.js — logika app pembeli (AI Tools Pro)
// Aktivasi divalidasi oleh Cloudflare Worker (lihat worker/src/index.js).
// Dependensi global: APP_CONFIG, sha256Hex, getDeviceFingerprint (crypto.js),
// escapeHtml, setMsg, flashButton (ui.js), activateOrder (api.js),
// initPush/unsubscribePush (push.js).
// ═════════════════════════════════════════════════════════════════

// ── PWA: service worker + install prompt ─────────────────────────
let deferredInstallPrompt = null;

function registerSW() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('/sw.js').catch((err) =>
    console.warn('SW register gagal:', err)
  );
}

function showInstallPill() {
  // Sembunyikan kalau sudah standalone (terinstall) atau pernah di-skip
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (localStorage.getItem('aitp_install') === 'dismissed') return;
  document.getElementById('install-pill').style.display = 'flex';
}

// Chrome/Edge Android & desktop memicu event ini saat app layak di-install
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // tahan popup default — kita pakai pill sendiri
  deferredInstallPrompt = e;
  showInstallPill();
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-pill').style.display = 'none';
  localStorage.setItem('aitp_install', 'installed');
});

async function doInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  document.getElementById('install-pill').style.display = 'none';
  // Kalau user menolak prompt native kecil → tidak ditampilkan lagi sesi ini
}

function dismissInstall() {
  document.getElementById('install-pill').style.display = 'none';
  localStorage.setItem('aitp_install', 'dismissed');
}

// ── INIT ──────────────────────────────────────────────────────────
async function init() {
  registerSW();
  // Isi link & teks dari config terpusat
  document.getElementById('lynk-link').href = APP_CONFIG.LYNK_URL;
  document.getElementById('lynk-link-2').href = APP_CONFIG.LYNK_URL;
  // Banner grup WA hanya di dashboard (grup eksklusif member)
  document.getElementById('wa-link-2').href = APP_CONFIG.WA_GROUP_URL;
  document.getElementById('seller-contact').textContent = APP_CONFIG.SELLER_CONTACT;

  const sess = localStorage.getItem(APP_CONFIG.SESSION_KEY);
  if (sess) {
    try {
      const { orderId, deviceId } = JSON.parse(sess);
      const fp = await getDeviceFingerprint();
      if (fp === deviceId) {
        showDash(orderId);
        initPush(orderId, deviceId);
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
      initPush(data.orderId, deviceId);
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
      renderChecker(data);
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
  renderRanking(d);
}

// ── RENDER: Ranking Model (tier S/A/B + filter use-case) ─────────
const rkFilter = { q: '', guna: '' };
const RKguna_LABEL = {
  chat: '💬 Chat Umum',
  coding: '💻 Coding',
  reasoning: '🧠 Reasoning',
  vision: '👁️ Vision',
  dokumen: '📄 Dokumen Panjang',
  gambar: '🎨 Gambar',
};

function applyRkFilter() {
  if (!dbData) return;
  const all = dbData.topModels || [];
  const q = rkFilter.q.toLowerCase();
  const filtered = all.filter((m) => {
    if (rkFilter.guna && !(m.guna || []).includes(rkFilter.guna)) return false;
    if (q) {
      const hay = [m.nama, m.bench, m.note, ...(m.via || []), ...(m.guna || [])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  document.getElementById('rk-count').textContent =
    filtered.length + ' dari ' + all.length + ' model ter-rank';

  const byTier = { S: [], A: [], B: [] };
  filtered.forEach((m) => (byTier[m.tier] || byTier.B).push(m));

  const tierHead = {
    S: ['🥇 TIER S — Flagship benchmark tertinggi', 'Model terkuat yang bisa kamu akses GRATIS hari ini'],
    A: ['🥈 TIER A — Sangat kuat & mudah didapat', 'Satu klik daftar, performa kelas atas'],
    B: ['🥉 TIER B — Andalan harian & lokal', 'Cepat, ringan, banyak yang 100% gratis permanen'],
  };

  const body = document.getElementById('rk-body');
  body.innerHTML = ['S', 'A', 'B']
    .filter((t) => byTier[t].length)
    .map(
      (t) => `
      <div class="db-sec">
        <h3>${tierHead[t][0]}</h3>
        <p class="db-sub">${tierHead[t][1]}</p>
        <div class="rk-list">${byTier[t].map(renderRkItem).join('')}</div>
      </div>`,
    )
    .join('') || `<div class="db-empty">🔍 Tidak ada model yang cocok. Coba kata kunci lain.</div>`;
}

function renderRkItem(m) {
  const gunaChips = (m.guna || [])
    .map((g) => `<span class="rk-gchip" data-guna="${escapeHtml(g)}">${escapeHtml(RKguna_LABEL[g] || g)}</span>`)
    .join('');
  // chip "via" → lompat ke tab Database + filter provider tsb
  const viaChips = (m.via || [])
    .map((v) => `<button class="rk-via" data-via="${escapeHtml(v)}">🔗 ${escapeHtml(v)}</button>`)
    .join('');
  return `
    <div class="rk-item rk-tier-${escapeHtml(m.tier)}">
      <div class="rk-main">
        <div class="rk-name"><span class="rk-tb rk-tb-${escapeHtml(m.tier)}">${escapeHtml(m.tier)}</span> ${escapeHtml(m.nama)}</div>
        <div class="rk-bench">${escapeHtml(m.bench || '')}</div>
        ${m.note ? `<div class="rk-note">💡 ${escapeHtml(m.note)}</div>` : ''}
        <div class="rk-guna">${gunaChips}</div>
      </div>
      <div class="rk-side">
        <div class="rk-via-lbl">Akses gratis via:</div>
        <div class="rk-via-row">${viaChips}</div>
      </div>
    </div>`;
}

function renderRkFilters(d) {
  const gunas = [...new Set((d.topModels || []).flatMap((m) => m.guna || []))];
  const chips = [{ value: '', label: 'Semua' },
    ...gunas.map((g) => ({ value: g, label: RKguna_LABEL[g] || g }))];
  document.getElementById('rk-filters').innerHTML = chips
    .map((c) => `<button class="db-fchip${rkFilter.guna === c.value ? ' sel' : ''}" data-rguna="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`)
    .join('');
}

function renderRanking(d) {
  document.getElementById('rk-loading').style.display = 'none';
  document.getElementById('rk-body').style.display = 'block';
  renderRkFilters(d);
  applyRkFilter();
}

// Pencarian global di tab Ranking
document.getElementById('rk-search').addEventListener('input', (e) => {
  rkFilter.q = e.target.value.trim();
  applyRkFilter();
});
document.getElementById('rk-filters').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-rguna]');
  if (!chip) return;
  rkFilter.guna = rkFilter.guna === chip.dataset.rguna && chip.dataset.rguna !== '' ? '' : chip.dataset.rguna;
  renderRkFilters(dbData);
  applyRkFilter();
});
// Klik chip use-case pada item → set filter use-case
// Klik chip provider (via) → lompat ke Database + cari provider itu
document.getElementById('tab-ranking').addEventListener('click', (e) => {
  const g = e.target.closest('.rk-gchip');
  if (g) {
    rkFilter.guna = g.dataset.guna;
    renderRkFilters(dbData);
    applyRkFilter();
    document.getElementById('tab-ranking').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const v = e.target.closest('.rk-via');
  if (v) {
    dbFilter.q = v.dataset.via;
    dbFilter.kategori = '';
    dbFilter.badge = '';
    document.getElementById('db-search').value = v.dataset.via;
    renderDbFilters(dbData);
    applyDbFilter();
    // pindah ke tab Database
    const dbBtn = [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.includes('Database'));
    if (dbBtn) switchTab('db', dbBtn);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

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

// ── API CHECKERS (render dinamis dari checkerPresets konten) ─────
const DEFAULT_CK = [
  { id: 'groq', nama: 'Groq', emoji: '⚡', apiType: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', keyHint: 'Dapatkan di console.groq.com/keys', modelHint: 'openai/gpt-oss-120b, llama-3.1-8b-instant' },
  { id: 'openrouter', nama: 'OpenRouter', emoji: '🛣️', apiType: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'nvidia/nemotron-3-ultra-550b-a55b:free', keyHint: 'Dapatkan di openrouter.ai/keys', modelHint: 'Pilih model suffix :free' },
  { id: 'gemini', nama: 'Google Gemini', emoji: '🔵', apiType: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash', keyHint: 'Dapatkan di aistudio.google.com/app/apikey', modelHint: 'gemini-2.5-flash, gemini-2.5-pro' },
  { id: 'anthropic', nama: 'Anthropic / Claude', emoji: '🟠', apiType: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-4-5', keyHint: 'Dapatkan di console.anthropic.com (berbayar)', modelHint: 'claude-haiku-4-5, claude-sonnet-4-5' },
  { id: 'openai', nama: 'OpenAI', emoji: '🟢', apiType: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyHint: 'Dapatkan di platform.openai.com (berbayar)', modelHint: 'gpt-4o-mini, gpt-4o' },
  { id: 'mistral', nama: 'Mistral AI', emoji: '🟡', apiType: 'openai', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', keyHint: 'Dapatkan di console.mistral.ai', modelHint: 'mistral-small-latest' },
];

let ckPresets = [];
let ckActive = null;

function renderChecker(d) {
  ckPresets = d.checkerPresets && d.checkerPresets.length ? d.checkerPresets : DEFAULT_CK;
  const tabs = document.getElementById('ck-tabs');
  const panels = document.getElementById('ck-panels');
  tabs.innerHTML = ckPresets
    .map(
      (p, i) =>
        `<button class="ctab${i === (ckActive ?? 0) ? ' active' : ''}" data-ck="${i}"><span class="ctab-dot" style="background:var(--accent)"></span>${escapeHtml(p.emoji || '🔹')} ${escapeHtml(p.nama)}</button>`,
    )
    .join('');
  panels.innerHTML = ckPresets
    .map((p) => renderCkPanel(p))
    .join('');
  selectCk(ckActive ?? 0);
}

const CK_SUB_BY_TYPE = {
  openai: 'OpenAI-compatible',
  anthropic: 'Anthropic API',
  google: 'Google AI Studio API',
  custom: 'Endpoint bebas',
};

function renderCkPanel(p) {
  const models = p.models && p.models.length ? p.models : null;
  const modelField = models
    ? `<div class="fw"><select id="m-${escapeHtml(p.id)}" class="npr ck-msel">${models
        .map((m) => `<option value="${escapeHtml(m)}"${m === p.model ? ' selected' : ''}>${escapeHtml(m)}</option>`)
        .join('')}<option value="__manual__">✏️ Ketik model sendiri...</option></select></div>`
    : `<div class="fw"><input type="text" id="m-${escapeHtml(p.id)}" value="${escapeHtml(p.model || '')}" class="npr"/></div>`;
  return `
    <div class="cpanel" id="ck-${escapeHtml(p.id)}">
      <div class="ccard">
        <div class="ccard-hd"><div class="cpbadge" data-p="custom">${escapeHtml(p.emoji || '🔹')}</div>
          <div><div class="cpname">${escapeHtml(p.nama)}</div><div class="cpsub">${CK_SUB_BY_TYPE[p.apiType] || escapeHtml(p.apiType)}</div></div>
        </div>
        <div class="ccard-bd">
          <label class="fl">API Key</label>
          <div class="fw"><input type="password" id="k-${escapeHtml(p.id)}" placeholder="Paste API key kamu di sini..."/><button class="tvis" onclick="tv('k-${escapeHtml(p.id)}',this)">👁</button></div>
          <div class="fh">${escapeHtml(p.keyHint || '')}</div>
          <label class="fl">Base URL</label>
          <div class="fw"><input type="text" id="u-${escapeHtml(p.id)}" value="${escapeHtml(p.baseUrl || '')}" class="npr"/></div>
          <label class="fl">Model</label>
          ${modelField}
          <div class="fh">${escapeHtml(p.modelHint || '')}</div>
          <button class="btn-ck" onclick="ckProvider('${escapeHtml(p.id)}')">🔍 Cek API Key</button>
          <div class="cres" id="r-${escapeHtml(p.id)}"></div>
          <div class="sec-note">🔒 Request langsung dari browser ke endpoint ini. Key tidak melalui server perantara.</div>
        </div>
      </div>
    </div>`;
}

// Dropdown "ketik sendiri" → ganti jadi input teks (id tetap agar ckProvider stabil)
document.getElementById('ck-panels').addEventListener('change', (e) => {
  if (e.target.tagName !== 'SELECT' || !e.target.id.startsWith('m-') || e.target.value !== '__manual__') return;
  const sel = e.target;
  const input = document.createElement('input');
  input.type = 'text';
  input.id = sel.id;
  input.placeholder = 'Ketik nama model manual...';
  sel.replaceWith(input);
  input.focus();
});

function selectCk(i) {
  ckActive = i;
  document.querySelectorAll('#ck-tabs .ctab').forEach((c, ci) => c.classList.toggle('active', ci === i));
  document.querySelectorAll('#ck-panels .cpanel').forEach((p, pi) => p.classList.toggle('active', pi === i));
}

document.getElementById('ck-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-ck]');
  if (t) selectCk(Number(t.dataset.ck));
});

function showCkResult(id, st, title, detail) {
  const el = document.getElementById('r-' + id);
  el.className = 'cres vis ' + st;
  const ic = st === 'ok' ? '✅' : st === 'err' ? '❌' : '⚠️';
  el.innerHTML = `<span>${ic}</span><div><div class="cres-ttl">${escapeHtml(title)}</div><div class="cres-det">${escapeHtml(detail)}</div></div>`;
}

async function ckProvider(id) {
  const p = ckPresets.find((x) => x.id === id) || {};
  const key = document.getElementById('k-' + id).value.trim();
  const baseUrl = document.getElementById('u-' + id).value.trim().replace(/\/+$/, '');
  const model = document.getElementById('m-' + id).value.trim();
  // id langsung dipakai untuk locating elemen
  if (!key) return showCkResult(id, 'warn', 'API Key kosong', 'Masukkan API key terlebih dahulu.');
  if (!baseUrl) return showCkResult(id, 'warn', 'Base URL kosong', 'Isi Base URL endpoint-nya.');
  if (!model) return showCkResult(id, 'warn', 'Model kosong', 'Isi nama model yang ingin diuji.');

  const btn = document.querySelector(`#ck-${CSS.escape(id)} .btn-ck`);
  setLd(btn, true);
  try {
    if (p.apiType === 'google') {
      const r = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
      });
      const d = await r.json();
      if (r.ok) {
        const c = d.candidates?.[0];
        showCkResult(id, 'ok', 'API Key Valid ✓', `Model: ${model} | Finish: ${c?.finishReason || 'STOP'}`);
      } else showCkResult(id, 'err', `Error ${r.status}: ${d.error?.status || 'Unknown'}`, d.error?.message || JSON.stringify(d));
    } else if (p.apiType === 'anthropic') {
      const r = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }),
      });
      const d = await r.json();
      if (r.ok) showCkResult(id, 'ok', 'API Key Valid ✓', `Model: ${d.model} | Stop: ${d.stop_reason} | Tokens: ${d.usage?.input_tokens}`);
      else showCkResult(id, 'err', `Error ${r.status}: ${d.error?.type || 'Unknown'}`, d.error?.message || JSON.stringify(d));
    } else {
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }),
      });
      const d = await r.json();
      if (r.ok) showCkResult(id, 'ok', 'API Key Valid ✓', `Model: ${d.model || model} | Finish: ${d.choices?.[0]?.finish_reason} | Tokens: ${d.usage?.total_tokens ?? '—'}`);
      else showCkResult(id, 'err', `Error ${r.status}: ${d.error?.type || d.error?.code || 'Unknown'}`, d.error?.message || d.message || JSON.stringify(d));
    }
  } catch (e) {
    showCkResult(id, 'err', 'Gagal terhubung', e.message.includes('Failed to fetch')
      ? 'Tidak bisa terhubung. Pastikan URL benar dan server aktif (untuk localhost, aktifkan CORS).'
      : e.message);
  } finally {
    setLd(btn, false);
  }
}

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
