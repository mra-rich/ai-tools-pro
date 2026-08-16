// ═════════════════════════════════════════════════════════════════
// viral-topics.js — Library topik viral HARI INI (update mingguan)
// Tiap topik = konten yang terbukti laris di platform Threads/X.
// Pola hook: curiosity gap | kontroversi | FOMO | "gratis tapi..." paradox
// Kamu bisa EDIT/TAMBAH topik di sini — sumber: stochastic + X + Reddit.
// Catatan: teks di sini ikut dikirim ke Gemini sebagai BAHAN angle,
// jadi semua harus bahasa Indonesia bersih (tanpa bahasa campuran).
//
// PENTING (2026-08-04): tiap topik WAJIB punya `added` (ISO date) dan
// `staleAfterDays`. generate.js melewati topik yang sudah kedaluwarsa,
// jadi topik basi TIDAK akan pernah dipakai lagi tanpa di-refresh.
// ═════════════════════════════════════════════════════════════════

const VIRAL_TOPICS = [
  // ── 1. Kimi K3 — sold out tapi gratis (paradox) ─────────────────
  {
    id: 'kimi-k3-sold-out',
    topic: 'Kimi K3: open weights 2.8T, servernya sampai "sold out" karena demand membludak',
    added: '2026-07-20',
    staleAfterDays: 3,
    hook: (cur) => pickHook([
      `Kimi K3 rilis weights 5 hari lalu → server Moonshot "sold out" 🥵\n\nTapi tahu nggak? Ada 2 cara pakai GRATIS-nya walau web resminya penuh.`,
      `Moonshot AI sampai pause langganan baru karena Kimi K3 too hot 🔥\n\nTapi weight-nya open source. Itu artinya…`,
      `Model AI paling viral minggu ini: Kimi K3, 2.8T open weights.\nKenapa bikin down servernya sendiri? Alasannya…`,
    ]),
    facts: [
      '• Rilis weights → 837k download di Hugging Face dalam seminggu',
      '• Biaya inference: 2–3x lebih murah dari Claude Opus 5 di task yang sama',
      '• Versi GGUF sudah ada di Unsloth — bisa jalan lokal',
    ],
    freePath: [
      '• arena.ai → chat gratis tanpa limit',
      '• Unsloth GGUF → jalan lokal kalau punya GPU 16GB+',
      '• API resminya berbayar, tapi bisa dicoba lewat router gratis (GitHub Models / OpenRouter trial)',
    ],
    ctaQ: 'Kamu nunggu server resminya stabil, atau langsung jalanin lokal aja? Komen 👇',
    category: 'trending-open-weights',
  },

  // ── 2. Claude Opus 5 — rilis baru + kontroversi benchmark ─────
  {
    id: 'claude-opus5-controversy',
    topic: 'Claude Opus 5: rilis 8 hari lalu, skor ARC-AGI 30.2% tapi dituduh "benchmaxxed"',
    added: '2026-07-20',
    staleAfterDays: 3,
    hook: (cur) => pickHook([
      `Claude Opus 5 baru rilis langsung kena drama: skor benchmark dipoles?\n\nTapi demo codingnya bikin Pokémon 3D dalam 12 jam. Jadi… controversy atau fakta?`,
      `30.2% di ARC-AGI, tapi r/singularity ramai bilang "itu benchmaxxed" ⚡\n\nPadahal demo nyatanya jauh lebih gila dari angkanya.`,
      `Satu model rilis seminggu, langsung 2.000+ upvote debat di reddit.\nKlaimnya: coding terkuat. Bantahannya: benchmarknya "diet".`,
    ]),
    facts: [
      '• Demo coding: Pokémon Pallet Town 3D full dalam 12 jam multi-agent',
      '• Demo generate asset 3D via Blender MCP dalam satu world',
      '• Harga per task benchmark: Opus 5 $1.40 vs Kimi K3 $0.55 vs GPT 5.6 $0.31',
    ],
    freePath: [
      '• Tidak open weight — cuma via API resmi (berbayar)',
      '• Alternatif gratis: bisa dicoba lewat router yang ngasih kredit trial (cek database tokengratis)',
      '• Untuk coding gratis total: Cline/Qwen lokal tetap solusi tanpa biaya',
    ],
    ctaQ: 'Menurutmu benchmark itu valid kalau demonya yang "wow"? Komen 👇',
    category: 'tech-drama',
  },

  // ── 3. Qwen3.8 yang belum rilis tapi sudah jadi meme ───────────
  {
    id: 'qwen38-anticipation',
    topic: 'Qwen3.8: belum rilis, tapi teaser 3 kata dari Alibaba jadi meme terbesar AI minggu ini',
    added: '2026-07-20',
    staleAfterDays: 3,
    hook: (cur) => pickHook([
      `"Prepare your (v)ram" — cuma 3 kata teaser dari Alibaba.\n\nTapi jadi meme AI terbesar minggu ini (5.000+ share). Komunitas beneran nunggu.`,
      `Qwen belum rilis model barunya.\n\nTapi X & Reddit sudah riuh. Kenapa seserius itu? Kalau kamu tahu sejarah Qwen, kamu ngerti.`,
      `Yang ditunggu: belum tentu modelnya.\nYang jelas: komunitas minta versi 27B/35B yang bisa jalan di RAM laptop biasa.`,
    ]),
    facts: [
      '• Komunitas tidak minta model 2T — minta versi 27B/35B/122B yang bisa di-run lokal',
      '• Rilis sebelumnya (Qwen3.6 27B) masih jadi raja coding lokal: 85.76 token/decodet',
      '• Hitung-hitungan komunitas: 4x RTX 5060 Ti ≈ $0.67/hari biaya listrik saja',
    ],
    freePath: [
      '• Qwen3.6 27B open weights → jalankan lokal gratis via Ollama / LM Studio',
      '• Qwen Chat web & aplikasi gratis (mobile + desktop)',
      '• Provider gratis lain di tokengratis yang sekelas: GLM, Kimi, DeepSeek',
    ],
    ctaQ: 'Kamu tim "tunggu versi lokal" atau tim "pakai yang cloud aja"? Komen 👇',
    category: 'anticipation',
  },

  // ── 4. Google lenyap dari top-15 benchmarks ───────────────────
  {
    id: 'google-out-of-top15',
    topic: 'Top-15 benchmark AI Januari 2026 didominasi model China (Kimi, Qwen, GLM, DeepSeek) — Google absen dari list',
    added: '2026-07-20',
    staleAfterDays: 3,
    hook: (cur) => pickHook([
      `Top-15 AI benchmark bulan ini: Kimi, Qwen, GLM, DeepSeek, MiniMax…\n\nSemua China. Google? Hilang dari list sejak Gemini November lalu.`,
      `Google di AI sekarang kayak tim sepakbola yang absen rangking bukan karena turun — memang tidak ada update game-nya.`,
      `Dari top-15 frontier bulan ini, yang non-China tinggal sedikit.\nYang rame: mayoritas open weights, artinya bisa kamu pakai gratis.`,
    ]),
    facts: [
      '• GLM-5.2: 2.05 juta download — membanjiri leaderboard komunitas',
      '• DeepSeek-V4-Flash: lebih cepat dari Claude Sonnet & Opus untuk coding',
      '• Gemini 3 Pro (Nov 2025) = update frontier terakhir dari Google',
    ],
    freePath: [
      '• GLM-5.2 open weight → jalan lokal gratis',
      '• Kimi via arena chat gratis',
      '• Qwen Chat (web/app) gratis',
      '• DeepSeek Chat gratis di web & app',
    ],
    ctaQ: 'Menurutmu ini keunggulan strategi open weights China, atau Google/OpenAI lagi nyiapin kejutan? Komen 👇',
    category: 'market-drama-free',
  },

  // ── 5. Berapa sih biaya token AI yang sebenarnya? ─────────────
  {
    id: 'ai-cost-per-token-shock',
    topic: 'Biaya asli panggil API AI ternyata murah: K3 $0.55/task vs Opus $1.40/task vs GPT 5.6 $0.31/task — beda dengan harga langganan bulanan',
    added: '2026-07-20',
    staleAfterDays: 3,
    hook: (cur) => pickHook([
      `Harga langganan AI: $20/bulan.\nBiaya asli task yang sama via API: $0.31.\n\nYang bikin kaget bukan angkanya — yang bikin kaget banyak yang belum tahu.`,
      `Rata-rata orang mikir "AI = mahal langganan".\nPadahal per-task via API: Opus 5 $1.40, Kimi K3 $0.55, GPT 5.6 $0.31.`,
      `Satu rahasia yang jarang diomongin kursus AI online:\n\nTask yang sama, beda harga 4–5x cuma lewat bedanya provider.`,
    ]),
    facts: [
      '• Benchmark yang sama: Kimi K3 ($0.55) kadang lebih cepat daripada Opus 5 ($1.40)',
      '• Groq & Gemini free tier ngasih limit gratis yang cukup buat eksperimen tiap hari',
      '• Ollama lokal = benar-benar Rp0 (listrik doang)',
    ],
    freePath: [
      '• Ollama: jalan model lokal 24/7 gratis, tanpa API',
      '• Groq: free tier pakai cepat untuk eksperimen',
      '• Google AI Studio: key Gemini gratis lewat satu klik',
      '• Lihat daftar lengkap 110+ provider gratis di tokengratis',
    ],
    ctaQ: 'Kamu lebih sering pakai langganan atau free tier? Komen 👇',
    category: 'cost-awareness-free',
  },

  // ── 6. AI coding assistant paling diincar — alternatif gratisnya ──
  {
    id: 'coding-agent-local-fomo',
    topic: 'AI coding assistant (Claude Code, Cursor, ZCode dll.) yang lagi viral — dan alternatif gratisnya yang setara',
    added: '2026-07-20',
    staleAfterDays: 3,
    hook: (cur) => pickHook([
      `Tool coding dengan AI paling dicari 2026: mahal.\n\nTapi 70% fiturnya bisa kamu ganti gratis lewat routing API lokal. Ini daftarnya.`,
      `Dengar-dengar "harus langganan buat AI coding"? Mitos.\n\nAda 3 alternatif gratis yang di komunitas developer sudah bukan rahasia.`,
      `Coding assistant premium itu memang bagus.\nTapi kalau kamu mahasiswa/freelancer baru, ini cara dapat 90%-nya tanpa bayar:`,
    ]),
    facts: [
      '• Trae = IDE AI gratis; Cline = extension VS Code; OpenCode = CLI gratis',
      '• ZCode ngasih routing API yang fleksibel ke banyak provider',
      '• Claude Code bisa dirouting via provider lain buat kredit trial',
    ],
    freePath: [
      '• Cline + Ollama di VS Code = coding agent lokal Rp0',
      '• Trae IDE = gratis, no kartu',
      '• Kilo Code untuk VS Code/JetBrains: gratis',
      '• Daftar lengkap di tokengratis.web.id',
    ],
    ctaQ: 'Tool mana yang kamu pakai buat coding sekarang? Komen 👇',
    category: 'dev-tools-fomo',
  },

  // ── 7. Flux 3 omnimodal: image + video + audio satu model ──────
  {
    id: 'flux3-omni-creative',
    topic: 'Flux 3 (Black Forest Labs): satu model untuk image + video + audio + action prediction — era "omnimodal" dimulai',
    added: '2026-07-20',
    staleAfterDays: 3,
    hook: (cur) => pickHook([
      `Satu model, 4 tugas: bikin gambar, video, audio, sampi prediksi gerakan.\n\nNamanya Flux 3. Era pipeline 3-langkah tinggal kenangan.`,
      `Generasi AI baru ini tidak menulis teks aja — dia jadi satu model untuk semua media sekaligus. Dan yang keren: ada jalannya gratis.`,
      `Gambar, video, musik — biasanya 3 tool. Flux 3 ngasih satu model untuk semuanya. Ini yang disebut "omnimodal".`,
    ]),
    facts: [
      '• Proyek video world open source (AlayaWorld) sudah streaming 720p/24FPS',
      '• Mode depth-video-to-video = kontrol kamera sinematik tanpa manual staging',
      '• Checkpoint lokal sudah di-share komunitas di Hugging Face',
    ],
    freePath: [
      '• Coba langsung di Hugging Face Spaces — gratis',
      '• Style Ghibli tren: ada versi demo gratisnya',
      '• Checkpoint lokal via Unsloth untuk kreator yang pegang GPU sendiri',
    ],
    ctaQ: 'Paling kepikiran mau bikin apa: 🖼️ gambar, 🎥 video, atau 🎵 musik? Komen 👇',
    category: 'creative-new-model',
  },
];

// Ambil 1 topik (untuk referensi manual/CLI)
function getViralTopic() {
  return VIRAL_TOPICS[Math.floor(Math.random() * VIRAL_TOPICS.length)];
}

function pickHook(hooks) {
  return hooks[Math.floor(Math.random() * hooks.length)];
}

module.exports = { VIRAL_TOPICS, getViralTopic, pickHook };
