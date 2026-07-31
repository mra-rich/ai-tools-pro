// ═════════════════════════════════════════════════════════════════
// KONFIGURASI — SATU-SATUNYA FILE YANG PERLU DIEDIT SAAT SETUP
// Dipakai oleh index.html (pembeli) dan admin.html (penjual).
// ═════════════════════════════════════════════════════════════════

const APP_CONFIG = {
  // URL Cloudflare Worker kamu (setelah deploy — lihat worker/README.md)
  WORKER_URL: 'https://ai-tools-pro.rodliarif.workers.dev',

  // URL raw content.json di GitHub kamu
  CONTENT_URL: 'https://raw.githubusercontent.com/mra-rich/ai-tools-pro/main/content.json',

  // Link produk kamu di lynk.id
  LYNK_URL: 'https://lynk.id/rodlirich',

  // Pesan kontak untuk pembeli yang ganti device / error aktivasi
  SELLER_CONTACT: 'Kirim Order ID kamu ke penjual untuk minta reset device.',

  // Kunci localStorage (jangan diubah setelah app live)
  SESSION_KEY: 'aitp_session', // sesi pembeli di index.html
  HIST_KEY: 'aitp_admin_history', // riwayat reset di admin.html
  ADMIN_TOKEN_KEY: 'aitp_admin_token', // admin token di admin.html
};
