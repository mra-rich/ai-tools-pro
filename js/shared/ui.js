// ═════════════════════════════════════════════════════════════════
// ui.js — helper UI kecil yang dipakai index.html dan admin.html
// ═════════════════════════════════════════════════════════════════

/** Escape karakter HTML agar data eksternal (content.json) aman di-render. */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tampilkan pesan status pada elemen bergaya .lock-msg.
 * type: 'ok' | 'err' | 'warn'
 */
function setMsg(el, text, type) {
  el.textContent = text;
  el.className = 'lock-msg ' + type;
}

/**
 * Tampilkan label sukses sementara pada tombol (misal "Tersalin!"),
 * lalu kembalikan label asal setelah 2 detik.
 */
function flashButton(btn, labelOk = 'Tersalin!', base = null) {
  const original = base ?? btn.textContent;
  btn.textContent = labelOk;
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('copied');
  }, 2000);
}
