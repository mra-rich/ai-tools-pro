// ═════════════════════════════════════════════════════════════════
// KONFIGURASI — SATU-SATUNYA FILE YANG PERLU DIEDIT SAAT SETUP
// Dipakai oleh index.html (pembeli) dan admin.html (penjual).
// ═════════════════════════════════════════════════════════════════

const APP_CONFIG = {
  // URL Cloudflare Worker kamu (setelah deploy — lihat worker/README.md)
  WORKER_URL: 'https://ai-tools-pro.rodliarif.workers.dev',

  // Konten dinamis (token/tutorial) diambil dari Worker, bukan dari repo —
  // agar key API tidak pernah terekspos public. Lihat admin.html tab Konten.

  // Link produk kamu di lynk.id
  LYNK_URL: 'https://lynk.id/rodlirich',

  // Link grup WhatsApp support pembeli (banner di landing & dashboard)
  WA_GROUP_URL: 'https://chat.whatsapp.com/LvHUenBEmmN32MxVT4wmLP',

  // Pesan kontak untuk pembeli yang ganti device / error aktivasi
  SELLER_CONTACT: 'Kirim Order ID kamu ke penjual untuk minta reset device.',

  // Kunci localStorage (jangan diubah setelah app live)
  SESSION_KEY: 'aitp_session', // sesi pembeli di index.html
  HIST_KEY: 'aitp_admin_history', // riwayat reset di admin.html
  ADMIN_TOKEN_KEY: 'aitp_admin_token', // admin token di admin.html
};
