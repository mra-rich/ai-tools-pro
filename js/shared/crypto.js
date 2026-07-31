// ═════════════════════════════════════════════════════════════════
// crypto.js — fungsi WebCrypto bersama (browser only)
// Sumber kebenaran tunggal untuk hashing & device fingerprint.
// ═════════════════════════════════════════════════════════════════

/** SHA-256 teks → hex string lowercase. */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Fingerprint device dari kombinasi properti browser yang stabil.
 * Dipakai untuk device-binding: 16 hex UPPERCASE.
 * Catatan: fingerprint bisa berubah jika user ganti browser/device —
 * itulah gunanya fitur reset binding di admin.html.
 */
async function getDeviceFingerprint() {
  let gl = '';
  try {
    const c = document.createElement('canvas');
    gl = c.getContext('webgl')?.getParameter(0x1f01) || ''; // UNMASKED_RENDERER_WEBGL
  } catch {
    gl = '';
  }
  const parts = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency || 0,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform || '',
    gl,
  ].join('||');
  return (await sha256Hex(parts)).substring(0, 16).toUpperCase();
}
