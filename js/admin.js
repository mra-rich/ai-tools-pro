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
