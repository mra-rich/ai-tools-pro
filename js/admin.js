// ═════════════════════════════════════════════════════════════════
// admin.js — logika tool penjual (admin.html)
// Dipakai offline di laptop penjual. BUTUH: Cloudflare Worker deployed
// dan ADMIN_TOKEN yang sama dengan `wrangler secret put ADMIN_TOKEN`.
// Dependensi global: APP_CONFIG, setMsg, flashButton (ui.js),
// resetOrderBinding (api.js).
// ═════════════════════════════════════════════════════════════════

// ── INIT ──────────────────────────────────────────────────────────
function initAdmin() {
  // Status konfigurasi
  const workerHost = APP_CONFIG.WORKER_URL.replace(/^https?:\/\//, '');
  const configured = !workerHost.includes('GANTI');
  const token = getToken();
  document.getElementById('status-info').innerHTML =
    `🌐 Worker: <code>${configured ? workerHost : 'belum dikonfigurasi'}</code>` +
    `<br>🔑 Admin token: <span class="${token ? 'status-ok' : 'status-warn'}">` +
    (token ? 'tersimpan ✓' : 'belum diisi — isi di tab Reset Binding') +
    `</span>`;

  if (token) document.getElementById('admin-token').value = token;
  renderHistory();
}

// ── ADMIN TOKEN ───────────────────────────────────────────────────
function getToken() {
  // Prioritas: token tersimpan manual → default dari js/admin-token.js
  return (
    localStorage.getItem(APP_CONFIG.ADMIN_TOKEN_KEY) ||
    (typeof ADMIN_TOKEN_DEFAULT !== 'undefined' ? ADMIN_TOKEN_DEFAULT : '')
  );
}

function saveToken() {
  const t = document.getElementById('admin-token').value.trim();
  if (!t) {
    alert('Isi admin token terlebih dahulu.');
    return;
  }
  localStorage.setItem(APP_CONFIG.ADMIN_TOKEN_KEY, t);
  initAdmin();
  alert('✅ Token tersimpan di browser ini.');
}

// ── RESET BINDING ─────────────────────────────────────────────────
let lastResetOrder = '';

async function doReset() {
  const orderId = document.getElementById('reset-orderid').value.trim().toUpperCase();
  const token = getToken();
  const okBox = document.getElementById('res-reset');
  const errBox = document.getElementById('res-reset-err');

  okBox.classList.remove('show');
  errBox.classList.remove('show');

  if (!orderId) return showErr('Masukkan Order ID pembeli terlebih dahulu.');
  if (!token) return showErr('Admin Token belum diisi. Simpan token dulu di kartu atas.');

  const btn = document.getElementById('btn-reset');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin16" style="display:inline-block;vertical-align:-2px"></div> Memproses...';

  try {
    const { status, data } = await resetOrderBinding(orderId, token);
    if (status === 200 && data.ok) {
      lastResetOrder = data.orderId;
      document.getElementById('res-reset-key').textContent = data.orderId;
      document.getElementById('res-reset-meta').textContent =
        `Binding device dilepas · ${new Date().toLocaleString('id-ID')} · suruh pembeli aktivasi ulang`;
      okBox.classList.add('show');
      saveHistory(data.orderId);
      renderHistory();
    } else if (status === 404) {
      showErr('Order ID tidak ditemukan di server. Cek ejaannya.');
    } else if (status === 401) {
      showErr('Admin Token salah. Cek nilai ADMIN_TOKEN di Cloudflare Worker.');
    } else {
      showErr('Gagal (HTTP ' + status + '): ' + (data.error || 'unknown'));
    }
  } catch {
    showErr('Tidak bisa terhubung ke Worker. Cek koneksi & WORKER_URL di js/shared/config.js.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔄 Reset Binding';
  }
}

function showErr(text) {
  document.getElementById('res-reset').classList.remove('show');
  document.getElementById('res-reset-err').classList.add('show');
  document.getElementById('res-reset-err-msg').textContent = text;
}

// Tombol salin Order ID hasil reset
document.getElementById('btn-cp-reset').addEventListener('click', (e) => {
  navigator.clipboard.writeText(lastResetOrder);
  flashButton(e.currentTarget, 'Tersalin!', 'Salin');
});

// ── HISTORY ───────────────────────────────────────────────────────
function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(APP_CONFIG.HIST_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeHistory(items) {
  localStorage.setItem(APP_CONFIG.HIST_KEY, JSON.stringify(items));
}

function saveHistory(orderId) {
  const hist = readHistory();
  hist.unshift({ orderId, time: new Date().toLocaleString('id-ID') });
  writeHistory(hist.slice(0, 50));
}

function renderHistory() {
  const hist = readHistory();
  const el = document.getElementById('hist-list');
  if (!hist.length) {
    el.innerHTML = '<div class="empty-hist">Belum ada riwayat</div>';
    return;
  }
  el.innerHTML = hist
    .map(
      (h, i) => `
    <div class="hist-item">
      <div class="hist-info">
        <div class="hist-type">🔄 Reset binding</div>
        <div class="hist-oid">${escapeHtml(h.orderId)}</div>
        <div class="hist-time">${escapeHtml(h.time)}</div>
      </div>
      <div class="hist-actions">
        <button class="btn-sm" data-copy-order="${escapeHtml(h.orderId)}" title="Salin Order ID">📋</button>
        <button class="btn-sm btn-danger" data-del="${i}" title="Hapus">🗑️</button>
      </div>
    </div>`,
    )
    .join('');
}

// Event delegation untuk tombol salin & hapus di riwayat
document.getElementById('hist-list').addEventListener('click', (e) => {
  const cp = e.target.closest('[data-copy-order]');
  if (cp) {
    navigator.clipboard.writeText(cp.dataset.copyOrder);
    flashButton(cp, '✓', '📋');
    return;
  }
  const del = e.target.closest('[data-del]');
  if (del) {
    const hist = readHistory();
    hist.splice(Number(del.dataset.del), 1);
    writeHistory(hist);
    renderHistory();
  }
});

function clearHistory() {
  if (!confirm('Hapus semua riwayat?')) return;
  localStorage.removeItem(APP_CONFIG.HIST_KEY);
  renderHistory();
}

// ── AFFILIATE ─────────────────────────────────────────────────────
let kontenCache = null; // konten terakhir yang dibaca dari server

function showAffErr(text) {
  document.getElementById('res-aff').classList.remove('show');
  document.getElementById('res-aff-err').classList.add('show');
  document.getElementById('res-aff-err-msg').textContent = text;
}

async function loadKonten() {
  try {
    const { status, data } = await readContent(getToken());
    if (status === 200 && data) {
      kontenCache = data;
      document.getElementById('konten-json').value = JSON.stringify(data, null, 2);
      document.getElementById('res-konten-err').classList.remove('show');
      // isi dropdown provider untuk affiliate
      const sel = document.getElementById('aff-provider');
      const cur = sel.value;
      sel.innerHTML =
        '<option value="">— pilih provider —</option>' +
        (data.providers || [])
          .map((p, i) => `<option value="${i}">${escapeHtml(p.nama)}${p.affUrl ? ' 🔗' : ''}</option>`)
          .join('');
      if (cur && sel.options.length > Number(cur)) sel.value = cur;
      fillCkpkOptions();
      return;
    }
    if (status === 404) return showKontenErr('Belum ada konten di server. Isi JSON baru lalu Simpan.');
    if (status === 401) return showKontenErr('Admin Token salah.');
    showKontenErr('Gagal membaca konten (HTTP ' + status + ').');
  } catch {
    showKontenErr('Tidak bisa terhubung ke Worker.');
  }
}

async function setAffiliate() {
  const idx = Number(document.getElementById('aff-provider').value);
  const affUrl = document.getElementById('aff-url').value.trim();
  if (document.getElementById('aff-provider').value === '') return showAffErr('Muat konten lalu pilih providernya.');
  if (!kontenCache || !kontenCache.providers?.[idx]) {
    showAffErr('Data belum lengkap — klik "Muat Konten Saat Ini" dulu.');
    return;
  }
  if (affUrl && !/^https?:\/\//.test(affUrl)) {
    return showAffErr('URL harus diawali http:// atau https://');
  }
  const p = kontenCache.providers[idx];
  if (affUrl) p.affUrl = affUrl;
  else delete p.affUrl;

  const btn = document.getElementById('btn-aff');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin16" style="display:inline-block;vertical-align:-2px"></div> Menerbitkan...';
  try {
    const { status, data } = await updateContent(kontenCache, getToken());
    if (status === 200 && data.ok) {
      document.getElementById('res-aff-err').classList.remove('show');
      document.getElementById('res-aff-meta').textContent = affUrl
        ? `${p.nama} → link affiliate dipasang · ${new Date().toLocaleTimeString('id-ID')}`
        : `Affiliate ${p.nama} dilepas, kembali ke URL normal`;
      document.getElementById('res-aff').classList.add('show');
      document.getElementById('konten-json').value = JSON.stringify(kontenCache, null, 2);
      document.getElementById('aff-url').value = '';
      loadKonten(); // segarkan dropdown
      fillCkpkOptions();
    } else if (status === 401) {
      showAffErr('Admin Token salah.');
    } else {
      showAffErr('Gagal terbit (HTTP ' + status + ').');
    }
  } catch {
    showAffErr('Tidak bisa terhubung ke Worker.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔗 Set Affiliate & Terbitkan';
  }
}

function listAffiliates() {
  if (!kontenCache) {
    showAffErr('Klik "Muat Konten Saat Ini" dulu.');
    return;
  }
  const aktif = (kontenCache.providers || []).filter((p) => p.affUrl);
  document.getElementById('res-aff-err').classList.remove('show');
  document.getElementById('res-aff-meta').textContent = aktif.length
    ? aktif.map((p) => `${p.nama}: ${p.affUrl}`).join(' · ')
    : 'Belum ada affiliate aktif.';
  document.getElementById('res-aff').classList.add('show');
}

// ── KONTEN ────────────────────────────────────────────────────────
function showKontenErr(text) {
  document.getElementById('res-konten').classList.remove('show');
  document.getElementById('res-konten-err').classList.add('show');
  document.getElementById('res-konten-err-msg').textContent = text;
}

async function saveKonten() {
  const rawText = document.getElementById('konten-json').value.trim();
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return showKontenErr('JSON tidak valid: ' + e.message);
  }
  if (!parsed.providers && !parsed.tutorial && !parsed.tokenGratis) {
    return showKontenErr('Konten minim harus punya "providers" atau "tutorial".');
  }
  const btn = document.getElementById('btn-konten');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin16" style="display:inline-block;vertical-align:-2px"></div> Mengirim...';
  try {
    const { status, data } = await updateContent(parsed, getToken());
    if (status === 200 && data.ok) {
      document.getElementById('res-konten-err').classList.remove('show');
      document.getElementById('res-konten-meta').textContent =
        `Terbit ${new Date().toLocaleString('id-ID')} · semua pembeli langsung dapat versi ini`;
      document.getElementById('res-konten').classList.add('show');
    } else if (status === 401) {
      showKontenErr('Admin Token salah.');
    } else {
      showKontenErr('Gagal simpan (HTTP ' + status + '): ' + (data.error || 'unknown'));
    }
  } catch {
    showKontenErr('Tidak bisa terhubung ke Worker.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Simpan & Terbitkan';
  }
}

// ── PRESET CHECKER (Cek API Key) ──────────────────────────────────
function fillCkpkOptions() {
  const sel = document.getElementById('ckpk-select');
  if (!sel || !kontenCache) return;
  const cur = sel.value;
  sel.innerHTML =
    '<option value="-1">➕ Tambah preset baru</option>' +
    (kontenCache.checkerPresets || [])
      .map((p, i) => `<option value="${i}">${escapeHtml(p.emoji || '')} ${escapeHtml(p.nama)} — ${escapeHtml(p.model || '')}</option>`)
      .join('');
  if (Number(cur) >= 0 && sel.options.length > Number(cur)) sel.value = cur;
}

function fillCkpk() {
  const idx = Number(document.getElementById('ckpk-select').value);
  const fields = ['ckpk-nama', 'ckpk-emoji', 'ckpk-base', 'ckpk-model', 'ckpk-modelhint', 'ckpk-keyhint', 'ckpk-models'];
  if (idx < 0) {
    fields.forEach((f) => (document.getElementById(f).value = ''));
    document.getElementById('ckpk-type').value = 'openai';
    return;
  }
  const p = (kontenCache?.checkerPresets || [])[idx];
  if (!p) return;
  document.getElementById('ckpk-nama').value = p.nama || '';
  document.getElementById('ckpk-emoji').value = p.emoji || '';
  document.getElementById('ckpk-base').value = p.baseUrl || '';
  document.getElementById('ckpk-model').value = p.model || '';
  document.getElementById('ckpk-modelhint').value = p.modelHint || '';
  document.getElementById('ckpk-keyhint').value = p.keyHint || '';
  document.getElementById('ckpk-type').value = p.apiType || 'openai';
  document.getElementById('ckpk-models').value = (p.models || []).join('\n');
}

function showCkpkErr(text) {
  document.getElementById('res-ckpk').classList.remove('show');
  document.getElementById('res-ckpk-err').classList.add('show');
  document.getElementById('res-ckpk-err-msg').textContent = text;
}

async function publishPresets(list, doneMsg) {
  const btn = document.getElementById('btn-ckpk');
  btn.disabled = true;
  const asli = btn.innerHTML;
  btn.innerHTML = '<div class="spin16" style="display:inline-block;vertical-align:-2px"></div> Menerbitkan...';
  try {
    kontenCache.checkerPresets = list;
    const { status, data } = await updateContent(kontenCache, getToken());
    if (status === 200 && data.ok) {
      document.getElementById('res-ckpk-err').classList.remove('show');
      document.getElementById('res-ckpk-meta').textContent = `${doneMsg} · ${new Date().toLocaleTimeString('id-ID')}`;
      document.getElementById('res-ckpk').classList.add('show');
      document.getElementById('konten-json').value = JSON.stringify(kontenCache, null, 2);
      fillCkpkOptions();
    } else if (status === 401) {
      showCkpkErr('Admin Token salah.');
    } else {
      showCkpkErr('Gagal terbit (HTTP ' + status + ').');
    }
  } catch {
    showCkpkErr('Tidak bisa terhubung ke Worker.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = asli;
  }
}

function saveCkpk() {
  if (!kontenCache) return showCkpkErr('Klik "Muat Konten Saat Ini" dulu.');
  const idx = Number(document.getElementById('ckpk-select').value);
  const nama = document.getElementById('ckpk-nama').value.trim();
  const baseUrl = document.getElementById('ckpk-base').value.trim();
  const model = document.getElementById('ckpk-model').value.trim();
  if (!nama) return showCkpkErr('Isi Nama presetnya.');
  if (!baseUrl) return showCkpkErr('Isi Base URL-nya.');
  if (!model) return showCkpkErr('Isi Model defaultnya.');

  const preset = {
    id: idx >= 0 ? kontenCache.checkerPresets[idx].id : nama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    nama,
    emoji: document.getElementById('ckpk-emoji').value.trim() || '🔹',
    apiType: document.getElementById('ckpk-type').value,
    baseUrl,
    model,
    keyHint: document.getElementById('ckpk-keyhint').value.trim(),
    modelHint: document.getElementById('ckpk-modelhint').value.trim(),
    models: document.getElementById('ckpk-models').value.split('\n').map((s) => s.trim()).filter(Boolean),
  };
  const list = [...(kontenCache.checkerPresets || [])];
  if (idx >= 0) list[idx] = preset;
  else list.push(preset);
  publishPresets(list, idx >= 0 ? `"${preset.nama}" diperbarui` : `"${preset.nama}" ditambahkan`);
}

function deleteCkpk() {
  const idx = Number(document.getElementById('ckpk-select').value);
  if (idx < 0 || !kontenCache?.checkerPresets?.[idx]) return showCkpkErr('Pilih preset yang mau dihapus dulu.');
  const nama = kontenCache.checkerPresets[idx].nama;
  if (!confirm(`Hapus preset "${nama}" dari tab Cek API Key pembeli?`)) return;
  const list = kontenCache.checkerPresets.filter((_, i) => i !== idx);
  publishPresets(list, `"${nama}" dihapus`);
}

// ── TABS ──────────────────────────────────────────────────────────
function swTab(name, btn) {
  document.querySelectorAll('.apanel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.atab').forEach((b) => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'history') renderHistory();
}

// Enter = reset binding
document.getElementById('reset-orderid').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doReset();
});

initAdmin();
