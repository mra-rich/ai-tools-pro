# Deploy Cloudflare Worker — Panduan 5 Langkah

Worker ini adalah "penjaga" aktivasi: lynk.id melapor transaksi sukses ke sini,
dan app pembeli menanyakan validitas Order ID ke sini. Gratis (Cloudflare Workers
free tier: 100.000 request/hari, cukup untuk ribuan penjualan).

## Prasyarat

- Akun Cloudflare (gratis) — daftar di https://dash.cloudflare.com
- Node.js terinstall (untuk `npx wrangler`)

## Langkah 1 — Login

```bash
cd worker
npx wrangler login
```

## Langkah 2 — Buat KV namespace

```bash
npx wrangler kv namespace create ORDERS
```

Output akan berisi `id = "xxxxxxxx..."`. **Paste id itu ke `wrangler.toml`**
menggantikan `GANTI_DENGAN_ID_KV_KAMU`.

## Langkah 3 — Set secret

Buat dua nilai acak panjang (bisa pakai password apa saja yang acak):

```bash
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put ADMIN_TOKEN
```

> Catat ADMIN_TOKEN — kamu butuh ini nanti di `admin.html`.
> WEBHOOK_SECRET dipakai di URL webhook langkah 5.

## Langkah 4 — Deploy

```bash
npx wrangler deploy
```

Output berisi URL worker, misal: `https://ai-tools-pro.kamu.workers.dev`

**Lalu:** buka `../js/shared/config.js` dan ganti `WORKER_URL` dengan URL ini.

## Langkah 5 — Pasang webhook di lynk.id

1. Login dashboard lynk.id → menu **Settings (Pengaturan) → Integrations / Webhook**
2. Isi endpoint: `https://ai-tools-pro.kamu.workers.dev/webhook?key=WEBHOOK_SECRET_KAMU`
   (ganti `WEBHOOK_SECRET_KAMU` dengan nilai dari langkah 3)
3. Simpan. Setelah tersimpan, lynk.id akan menampilkan **merchant key** —
   opsional tapi disarankan: jalankan `npx wrangler secret put MERCHANT_KEY` dengan nilai itu
   agar Worker juga memverifikasi header `X-Lynk-Signature` setiap webhook.

> Jika menu Webhook tidak ada di dashboard-mu: kemungkinan fitur ini belum aktif
> di plan akun kamu. Hubungi CS lynk.id untuk mengaktifkannya.

## Format Payload Asli lynk.id (sudah diverifikasi)

Order ID yang dilihat pembeli di email konfirmasi = field `refId` di payload
webhook (`data.message_data.refId`). Worker sudah menanganinya — tidak ada yang
perlu diubah. Status sukses = `data.message_action === 'SUCCESS'`.

Jika suatu saat webhook asli gagal tercatat (`order_id_not_found`), jalankan
`npx wrangler tail` untuk melihat payload aslinya, lalu tambahkan nama field
yang benar ke fungsi `extractOrderId()` di `src/index.js`.

## Uji Manual (opsional)

```bash
# Simulasi webhook — format asli lynk.id (payment.received)
curl -X POST "https://URL_WORKER/webhook?key=SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.received","data":{"message_action":"SUCCESS","message_code":"0","message_data":{"customer":{"email":"buyer@test.com"},"refId":"TEST-123"},"message_id":"API_CALL_X"}}'

# Simulasi aktivasi
curl -X POST "https://URL_WORKER/activate" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"TEST-123","deviceId":"0123456789ABCDEF"}'
# → {"ok":true,...}

# Aktivasi di "device lain" harus ditolak
curl -X POST "https://URL_WORKER/activate" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"TEST-123","deviceId":"FFFFFFFFFFFFFFFF"}'
# → 409 {"ok":false,"error":"bound_to_other_device"}

# Reset binding (admin)
curl -X POST "https://URL_WORKER/reset" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: ADMIN_TOKEN_KAMU" \
  -d '{"orderId":"TEST-123"}'
```

## Catatan Pengiriman Webhook lynk.id

Nama field Order ID pada payload webhook lynk.id bisa berbeda antar versi API.
Worker sudah mencari di banyak nama field umum (`order_id`, `orderId`,
`invoice`, `data.id`, dst). Jika webhook lynk.id asli gagal tercatat
(`order_id_not_found`), jalankan `npx wrangler tail` untuk melihat payload aslinya,
lalu tambahkan nama field yang benar ke fungsi `extractOrderId()` di `src/index.js`.
