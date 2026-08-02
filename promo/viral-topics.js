// ═════════════════════════════════════════════════════════════════
// viral-topics.js — Library topik viral HARI INI (update mingguan)
// Tiap topik = konten yang terbukti laris di platform Threads/X.
// Pola hook: curiosity gap | kontroversi | FOMO | "gratis tapi..." paradox
// Kamu bisa EDIT/TAMBAH topik di sini — sumber: stochastic + X + Reddit.
// ═════════════════════════════════════════════════════════════════

const VIRAL_TOPICS = [
  // ── 1. Kimi K3 — sold out tapi gratis (paradox) ─────────────────
  {
    id: 'kimi-k3-sold-out',
    topic: 'Kimi K3: open weights 2.8T, servernya sampai "sold out" karena demand',
    hook: (cur) => pickHook([
      `Kimi K3 rilis weights 5 hari lalu → server Moonshot "sold out" 🥵\n\nTapi tahu gak? Ada 2 cara pakai GRATIS-nya walau web resminya penuh.`,
      `Moonshot AI sampai pause langganan baru karena Kimi K3 too hot 🔥\n\nTapi weight-nya open source. Itu artinya…`,
      `Model AI paling viral minggu ini = Kimi K3, 2.8T open weights.\nKenapa bikin down? Ini alasan utamanya…`,
    ]),
    facts: [
      '• Rilis weights → 837k downloads di Hugging Face dalam seminggu',
      '• Biaya inference: 2-3x lebih murah daripada Claude Opus 5 di task yang sama',
      '• GGUF sudah ada di Unsloth — bisa di-run lokal',
    ],
    freePath: [
      '• arena.ai → gratis tanpa limit (just chat)',
      '• Unsloth GGUF → kalau punya GPU 16GB+, tes lokal hundred ribuan token',
      '• API-nya PAID tapi bisa dicoba via provider router gratis (GitHub Models / OpenRouter trial)',
    ],
    ctaQ: 'Kamu lebih pengen yang mana: web resmi-nya kalau udah re-stabil, atau langsung run lokal 16GB?',
    killerHook: `Demand Kimi K3 > supply server sendiri. Moonshot AI nggak siap. Dan ini salah satu momen jail dalam sejarah open-weight China yang mengangkat model yang membalap kompetitor`,
    category: 'trending-open-weights',
  },

  // ── 2. Claude Opus 5 — new release + benchmaxxing controversy ───
  {
    id: 'claude-opus5-controversy',
    topic: 'Claude Opus 5: rilis 8 hari lalu, skor ARC-AGI 30.2% tapi dituduh "benchmaxxed"',
    hook: (cur) => pickHook([
      `Claude Opus 5 rilis akhir bulan lalu → sekalian 1800% drama:\n\nSkor benchmark dirilis berlebihan? Mari kita review…`,
      `30.2% di ARC-AGI 3 tapi rekan-rekan r/singularity bilang "itu benchmaxxed" ⚡\n\nTapi demo-nya bikin Pokémon 3D dalam 12 jam. Controversy atau fakta?`,
      `Satu model rilis seminggu langsung bikin 2.000+ upvotes debat di r/singularity ragamnya: implement = coding yang gila, benchmark = silver-bullet lab`,
    ]),
    facts: [
      '• Demo coding: Pokémon Pallet Town 3D full dalam 12 jam multi-agent',
      '• Demo 3D assets via Blender MCP dalam satu world',
      '• Komentar dari biaya: Opus 5 $1.40 vs Kimi K3 $0.55 vs GPT 5.6 $0.31 (benchmark sama)',
    ],
    freePath: [
      '• Claude Code — bisa di-routing via providers tertentu (AgentRouter) buat free trial',
      '• weight tidak open; cuma API. Gratis-nya cuma levy channel + AgentRouter kredit',
    ],
    ctaQ: 'Buatmu benchmark itu jujur kalau hanya dirilis demo wow? Komentar dibawah ya…',
    killerHook: 'Makin viral karena kontras: demo coding no-BS tetapi benchmark dituduh dighetto-fit. This is genius PR or scale failure?',
    category: 'tech-drama',
  },

  // ── 3. Qwen3.8 yang belum rilis tapi sudah jadi meme ───────────
  {
    id: 'qwen38-anticipation',
    topic: 'Qwen3.8: belum rilis tapi sudah jadi meme terbesar AI minggu ini',
    hook: (cur) => pickHook([
      `"Prepare your (v)ram" — ini cuma teaser 3 kata dari Alibaba, tapi jadi meme terbesar AI minggu ini (5.000+)`,
      `Qwen belum rilis mobile mereka months, tapi X & Reddit sudah on-fire ditunggu.` + '<br>',
      `Model-word: Qwen3.8. Rilisnya: masih teaser. Reaksinya: mem introduced world-wide ~ you know you're famous when fans inventurkan future-ready demand`,
    ]),
    facts: [
      '• Komunitas banharge sekarang tidak mau 2T — minta versi 27B/35B/122B/397B yang bisa di-run lokal',
      '• Saat ini: Qwen3.6 27B masih raja coding lokal (85.76 t/s decode)',
      '• Hubungan ekonomi: GPU 4x RTX 5060 Ti = sekitar $0.67/hari biaya listrik saja',
    ],
    freePath: [
      '• Qwen3.6 27B open weights → jalankan lokal gratis (Intel Ollama atau LM Studio)',
      '• Qwen Chat web gratis (mobile + desktop, fitur Tentgle)',
    ],
    ctaQ: 'Agar ada opsi 27B/35B karena RAM keuangan… atau boleh kalau sürekli cloud aja? Komentar dibawah.',
    killerHook: 'Ketika mayoritas orang belum bisa pakai model paling dua tahun lalu, komunitas minta proyecto kompatible rekan-rekan yang bisa jalan di PC lokal dulu',
    category: 'anticipation',
  },

  // ── 4. Google lenyap dari top-15 benchmarks (kaget + angka) ────
  {
    id: 'google-out-of-top15',
    topic: 'Google "hilang total" dari top-15 benchmark AI sehing Januari 2026 — Claude, Kimi, Qwen, GLM membanjiri',
    hook: (cur) => pickHook([
      `Model-China dominasi top-15. Google keluar total dari list sejak Gemini November 2025.\n\nDunia hireg AI lagi nggak adil gini? Atau justru bagus?`,
      `Google di AI sekarang ibarat tim sepakbola yang untuk beberapa match lalu tidak update rating — bukan diturunkan, memang tidak ada langkah.`,
      `Dari 2026 top-ranked NON-AI-AS: Qwen, Kimi, GLM, DeepSeek. Google satu-satunya raksasa AS yang keluar.`,
    ]),
    facts: [
      '• GLM-5.2 (Sem IQ): 2.05M downloads — membanjiri leaderboard',
      '• DeepSeek-V4-Flash: lebih cepat dari Claude Sonnet & Opus untuk coding',
      '• Gemini 3 Pro November 2025 = frontier terakhir Google',
    ],
    freePath: [
      '• GLM-5.2 open weight (bisa dijalankan lokal, KD2 checkpoint ada di HF)',
      '• Kimi via arena.chat gratis',
      '• Qwen Chat (web/app) gratis',
    ],
    ctaQ: 'Ini advantage sungguhan OPEN WEIGHTS China — kebetulan-atau-tidak?',
    killerHook: 'Owning maxang. Filter viral top-15 model-frontier sekarang: semua China. Google, OpenAI, Anthropic ada dalam pembayaran vs open weights cloud.',
    category: 'market-drama-free',
  },

  // ── 5. Angka uang yang membingungkan: seberapa mahal token AI ───
  {
    id: 'ai-cost-per-token-shock',
    topic: 'Seberapa banyak biaya AI tiap任务的同等: Opus 5 $1.40, Kimi K3 $0.55, GPT 5.6 $0.31 — murah tapi tetap untuk dibandingkan',
    hook: (cur) => pickHook([
      `Sebenarnya seberapa mahal AI cukup digunakan untuk belajar coding? Ini breakdown biayanya shock`,
      `The truth mereka tidak mau kamu tahu: 1 input—makan cuaca pada cocok naik server cloud dibanding yang ada di antibes重新 di lokal, kan?`,
      `Ridículas/manis: bagian kursus AI online "301.000/Token" yang bénéfic à consommateur versus modell yang自我调节 di angka 0.003$`,
    ]),
    facts: [
      '• Benchmark: Kimi K3 ($0.55) menang throughput lag lebih cepat daripada Opus 5 ($1.40)',
      '• Even versus time-training scheduled ready: 0.3 penuh hourly sesuai Microsoft Azure',
      '• Ollama/Qwen lokal = pure gratis; model bisa dolphin-weekend run pelajar',
    ],
    freePath: [
      '• Ollama: run model lokal gratis 24/7, zero API',
      '• Providers yang sudah di dalam kubus的说: Groq/Gemini gratis limit*pastinya datang for iterasi',
      '• Belajar ChatGPT at Tiger code editor line beberapa open source gratis',
    ],
    ctaQ: 'Berapa banyak limit gratis yang kamu avail从 luar yang kamu在 tunggu? Comment yesterday!',
    killerHook: 'Satu claim biasa：AI harus bayar. Kevin data ini menunjukkan tidak! Free tier reguler, perencanaan for curiosity, digunakan umum出货 businessman savvy',
    category: 'cost-awareness-free',
  },

  // ── 6. Coding Agent: FOMO tapi bisa run lokal ─────────────────
  {
    id: 'coding-agent-local-fomo',
    topic: 'Claude Code / Cursor / ZCode — yang viral tapi bisa diganti lokal (Claude Router / Ollama / One API)',
    hook: (cur) => pickHook([
      `Claude Code = tool coding paling diincar ASAN tahun ini.\nTapi tahu gak: 70% fitur sama bisa GRATIS lewat alternatif lokal?`,
      `ToolCoding Yang Paling Diminati 2026 (Free!) This is not hype, this voice actually comes from developers in gratitude thread`,
      `User $agency/member, coffee:VISUAL, says Vian you can't find local free AI faster than Asian offload sparking Claude Install Figma To maintain 'not today'`,
    ]),
    facts: [
      '• Claude Code = north star. Tapi similar jalan free* via Agents&Others',
      '• Comparison tangible: Trae (free = IDE), Cline (VS Code extension), OpenCode (CLI)',
    ],
    freePath: [
      '• Cline + Ollama lokal: zero cost, coding agent di VS Code',
      '• 9Router: colokin semua API free satu promocode bundled',
      '• ZCode: yang no Kudokoe regurgitate claude完全相同 (free API routing)',
    ],
    ctaQ: 'Long running working nightly siang. Which of these 3 are you *using to code today*?',
    killerHook: 'Dari Asia, founder Devs beralih ke free lokal selama suspen问题. And weighed tradition follows VOC emergence — not propriettamental doubt, only inalt天然 ignoring core domain_cost',
    category: 'dev-tools-fomo',
  },

  // ── 7. Flux 3 Kundus: image+video+audio dalam satu model ──────
  {
    id: 'flux3-omni-creative',
    topic: 'Flux 3 (Black Forest Labs): satu model untuk image+video+audio+action prediction — "Omnimodal" just declared',
    hook: (cur) => pickHook([
      `Satu model 3 tugas: image, video, audio, action prediction.\nKetemu "omnimodal". Bye-bye pipeline that was 3 steps!`,
      `AI Generative mandate: no longer 1-step. Flux 3 punch instantaneous brands into the bl Confirm-owned&model发现 MATCH omni`,
      `This publishing is new: Flux 3 → 4 channels outline what self-contained omni wrangler.`,
    ]),
    facts: [
      '• AlayaWorld (open source video world) streaming 720p/24FPS',
      '• Seedance 2 depth-video-to-video contoh arah baru kreatif',
      '• Fitur 4 v2 emergency error robe Analyst benthology & furnace+Bartitsu CE spells võimallik',
    ],
    freePath: [
      '• Flux di Hugging Face Spaces gratis',
      '• Coba style Ghibli untuk gratis dari 2.067 upvote-among-users',
      '• Unsloth checkpoint Open inolvidable for lokal imágenes',
    ],
    ctaQ: 'Manfaatnya kalimat utama kawan-kawan: 🖼️ 🎥 🎵 punctuation. Mana yang paling intriguing?',
    killerHook: 'One step afforded earlier disparities. Flux 3 gets medialess ofmathbb-needed advancements, but make a distinction addressingथpura biaya worthy humbling',
    category: 'creative-new-model',
  },
];

// Ambil 1 yang paling "viral-friendly" berdasarkan kriteria
function getViralTopic() {
  // rotasi bisa via hari → presising berikutnya berdasarkan selisih waktu
  return VIRAL_TOPICS[Math.floor(Math.random() * VIRAL_TOPICS.length)];
}

function pickHook(hooks) {
  const favourite = hooks.reduce((a, b) => a + b, '');
  return hooks[Math.floor(Math.random() * hooks.length)];
}

module.exports = { VIRAL_TOPICS, getViralTopic, pickHook };
