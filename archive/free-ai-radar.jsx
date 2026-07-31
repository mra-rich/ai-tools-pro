import { useState, useCallback } from "react";

const SEED_PROVIDERS = [
  {
    id: "groq",
    name: "Groq",
    base_url: "https://api.groq.com/openai/v1",
    website: "console.groq.com",
    requires_card: false,
    openai_compatible: true,
    free_models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", context_window: 131072, rate_limit: "14,400/day" },
      { id: "qwen-qwen3-32b", name: "Qwen3 32B", context_window: 131072, rate_limit: "14,400/day" },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 70B", context_window: 131072, rate_limit: "14,400/day" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B", context_window: 8192, rate_limit: "14,400/day" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", context_window: 131072, rate_limit: "14,400/day" },
    ],
    notes: "Chip AI custom, inferensi tercepat. Free tier paling generous.",
    status: "active",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    base_url: "https://openrouter.ai/api/v1",
    website: "openrouter.ai",
    requires_card: false,
    openai_compatible: true,
    free_models: [
      { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B", context_window: 131072, rate_limit: "20 req/min" },
      { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B", context_window: 131072, rate_limit: "20 req/min" },
      { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1", context_window: 65536, rate_limit: "20 req/min" },
      { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B", context_window: 32768, rate_limit: "20 req/min" },
    ],
    notes: "Marketplace terbesar. Semua model gratis pakai suffix :free.",
    status: "active",
  },
  {
    id: "together",
    name: "Together AI",
    base_url: "https://api.together.xyz/v1",
    website: "together.ai",
    requires_card: false,
    openai_compatible: true,
    free_models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", name: "Llama 3.3 70B Turbo", context_window: 131072, rate_limit: "60 req/min" },
      { id: "meta-llama/Llama-Vision-Free", name: "Llama 3.2 11B Vision", context_window: 131072, rate_limit: "60 req/min" },
      { id: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-Free", name: "DeepSeek R1 Distill", context_window: 16384, rate_limit: "60 req/min" },
    ],
    notes: "$5 credit gratis saat daftar. Model suffix -Free tidak habis.",
    status: "active",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    base_url: "https://api.cerebras.ai/v1",
    website: "cerebras.ai",
    requires_card: false,
    openai_compatible: true,
    free_models: [
      { id: "llama-3.3-70b", name: "Llama 3.3 70B", context_window: 131072, rate_limit: "30 req/min" },
      { id: "llama-3.1-8b", name: "Llama 3.1 8B", context_window: 131072, rate_limit: "30 req/min" },
      { id: "qwen-3-32b", name: "Qwen3 32B", context_window: 131072, rate_limit: "30 req/min" },
    ],
    notes: "Inferensi sangat cepat dengan chip Wafer Scale Engine.",
    status: "active",
  },
  {
    id: "github-models",
    name: "GitHub Models",
    base_url: "https://models.inference.ai.azure.com",
    website: "github.com/marketplace/models",
    requires_card: false,
    openai_compatible: true,
    free_models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", context_window: 128000, rate_limit: "15 req/min" },
      { id: "Meta-Llama-3.1-70B-Instruct", name: "Llama 3.1 70B", context_window: 131072, rate_limit: "15 req/min" },
      { id: "Phi-3.5-mini-instruct", name: "Phi 3.5 Mini", context_window: 131072, rate_limit: "15 req/min" },
    ],
    notes: "Perlu GitHub account. Termasuk GPT-4o Mini gratis.",
    status: "active",
  },
  {
    id: "cloudflare",
    name: "Cloudflare AI",
    base_url: "https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1",
    website: "developers.cloudflare.com/workers-ai",
    requires_card: false,
    openai_compatible: true,
    free_models: [
      { id: "@cf/meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B", context_window: 131072, rate_limit: "10K neurons/day" },
      { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 Qwen 32B", context_window: 32768, rate_limit: "10K neurons/day" },
    ],
    notes: "Perlu Cloudflare account. Limit dalam 'neurons', bukan token.",
    status: "active",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    base_url: "https://api.mistral.ai/v1",
    website: "console.mistral.ai",
    requires_card: false,
    openai_compatible: true,
    free_models: [
      { id: "mistral-small-latest", name: "Mistral Small", context_window: 32768, rate_limit: "1 req/sec" },
      { id: "open-mistral-7b", name: "Mistral 7B", context_window: 32768, rate_limit: "1 req/sec" },
    ],
    notes: "Trial tier tersedia. Verifikasi email saja, tidak perlu kartu.",
    status: "active",
  },
];

function fmtCtx(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M ctx`;
  if (n >= 1000) return `${Math.round(n / 1000)}K ctx`;
  return `${n} ctx`;
}

function ProviderCard({ provider, copied, onCopy, expanded, onToggle }) {
  const dotColor =
    provider.status === "active"
      ? "#10B981"
      : provider.status === "degraded"
      ? "#F59E0B"
      : "#64748B";

  return (
    <div
      style={{
        backgroundColor: "#0C1421",
        border: "1px solid #1E293B",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#164E63";
        e.currentTarget.style.boxShadow = "0 0 20px rgba(6,182,212,0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#1E293B";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Header */}
      <div style={{ padding: "14px 16px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: dotColor,
                boxShadow: `0 0 6px ${dotColor}`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 700, fontSize: 14, color: "#F1F5F9" }}>{provider.name}</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {!provider.requires_card && (
              <span style={{ padding: "2px 7px", borderRadius: 4, backgroundColor: "#052E16", color: "#4ADE80", fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
                NO CARD
              </span>
            )}
            {provider.openai_compatible && (
              <span style={{ padding: "2px 7px", borderRadius: 4, backgroundColor: "#1C1531", color: "#A78BFA", fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
                OAI
              </span>
            )}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>{provider.notes}</p>
      </div>

      {/* Models */}
      <div style={{ borderTop: "1px solid #1A2638", padding: "10px 16px", flex: 1 }}>
        <div style={{ fontSize: 9, color: "#475569", marginBottom: 8, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>
          {provider.free_models.length} MODEL GRATIS
        </div>
        {provider.free_models.slice(0, expanded ? undefined : 3).map((m) => (
          <div
            key={m.id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #0F1A27" }}
          >
            <span style={{ fontSize: 12, color: "#CBD5E1", fontWeight: 500 }}>{m.name}</span>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#334155" }}>{fmtCtx(m.context_window)}</span>
              {m.rate_limit && (
                <span style={{ fontSize: 9, color: "#0EA5E9", padding: "1px 5px", borderRadius: 3, backgroundColor: "#082035" }}>
                  {m.rate_limit}
                </span>
              )}
            </div>
          </div>
        ))}
        {provider.free_models.length > 3 && (
          <button
            onClick={onToggle}
            style={{ marginTop: 8, width: "100%", background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: "4px 0", textAlign: "center" }}
          >
            {expanded ? "▲ Sembunyikan" : `▼ +${provider.free_models.length - 3} model lagi`}
          </button>
        )}
      </div>

      {/* Footer: base URL */}
      <div style={{ borderTop: "1px solid #1A2638", padding: "9px 16px", display: "flex", alignItems: "center", gap: 8, backgroundColor: "#080E18" }}>
        <code style={{ flex: 1, fontSize: 10, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
          {provider.base_url}
        </code>
        <button
          onClick={() => onCopy(provider.base_url, provider.id)}
          style={{
            padding: "3px 10px",
            borderRadius: 5,
            border: "1px solid #1E3A5F",
            backgroundColor: "transparent",
            color: copied === provider.id ? "#10B981" : "#0EA5E9",
            fontSize: 11,
            cursor: "pointer",
            flexShrink: 0,
            transition: "color 0.2s",
            fontFamily: "inherit",
          }}
        >
          {copied === provider.id ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function FreeAIRadar() {
  const [providers, setProviders] = useState(SEED_PROVIDERS);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const scanLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: `You are a researcher who tracks free AI API providers. Search the web for the LATEST information (2026) about free AI model API providers. Focus on providers with free tiers that require no credit card.

Return ONLY a raw valid JSON object. No markdown, no backticks, no explanation. Exact schema:
{
  "providers": [
    {
      "id": "slug-no-spaces",
      "name": "Display Name",
      "base_url": "https://full-base-url/v1",
      "website": "domain.com",
      "requires_card": false,
      "openai_compatible": true,
      "free_models": [
        { "id": "model-api-id", "name": "Short Name", "context_window": 131072, "rate_limit": "X req/min" }
      ],
      "notes": "Catatan singkat Bahasa Indonesia max 90 karakter",
      "status": "active"
    }
  ]
}

Search for: Groq free tier 2026, OpenRouter free models 2026, Together AI free models, Cerebras free tier, GitHub Models free, Cloudflare Workers AI free, Mistral free tier, new free AI API providers 2026.

Include minimum 6 providers. Return ONLY the JSON object, nothing else before or after it.`,
          messages: [{ role: "user", content: "Cari semua provider AI model API yang gratis per Juli 2026. Prioritaskan yang tidak perlu kartu kredit. Return JSON only." }],
        }),
      });

      const data = await res.json();

      let jsonText = "";
      for (const block of data.content || []) {
        if (block.type === "text") {
          const t = block.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          if (t.startsWith("{")) jsonText = t;
        }
      }

      if (!jsonText) throw new Error("Tidak ada JSON di response");

      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed.providers) || parsed.providers.length === 0) throw new Error("Data tidak valid");

      setProviders(parsed.providers);
      setUpdatedAt(new Date());
    } catch (err) {
      setError("Scan gagal — menampilkan data cache. " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const copyUrl = (url, id) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const FILTERS = [
    { key: "all", label: "Semua", fn: () => true },
    { key: "nocard", label: "Tanpa Kartu", fn: (p) => !p.requires_card },
    { key: "oai", label: "OpenAI Compat", fn: (p) => p.openai_compatible },
    { key: "best", label: "★ Best Pick", fn: (p) => !p.requires_card && p.openai_compatible },
  ];

  const filtered = providers.filter(FILTERS.find((f) => f.key === filter).fn);
  const totalModels = providers.reduce((s, p) => s + p.free_models.length, 0);
  const noCardCount = providers.filter((p) => !p.requires_card).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070B14", color: "#E2E8F0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* === HEADER === */}
      <div style={{ borderBottom: "1px solid #1A2638", background: "linear-gradient(180deg, #0D1117 0%, #070B14 100%)", padding: "20px 24px 18px" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  backgroundColor: "#06B6D4",
                  boxShadow: loading ? "0 0 12px #06B6D4" : "0 0 6px #06B6D4",
                  animation: loading ? "blink 0.8s ease-in-out infinite" : "none",
                }} />
                <span style={{ fontSize: 10, letterSpacing: 3, color: "#0891B2", fontWeight: 700, textTransform: "uppercase" }}>
                  Live Tracker
                </span>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 5px", color: "#F1F5F9", letterSpacing: -0.5 }}>
                Free AI Model Radar
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>
                <span style={{ color: "#0EA5E9" }}>{providers.length}</span> provider ·{" "}
                <span style={{ color: "#0EA5E9" }}>{totalModels}</span> model gratis ·{" "}
                <span style={{ color: "#10B981" }}>{noCardCount}</span> tanpa kartu kredit
                {updatedAt && (
                  <span style={{ marginLeft: 10, color: "#06B6D4" }}>
                    · Diperbarui {updatedAt.toLocaleTimeString("id-ID")}
                  </span>
                )}
              </p>
            </div>

            <button
              onClick={scanLatest}
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 18px",
                borderRadius: 8,
                border: `1px solid ${loading ? "#164E63" : "#0891B2"}`,
                backgroundColor: "#0A1929",
                color: loading ? "#164E63" : "#06B6D4",
                fontSize: 13, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                flexShrink: 0,
                letterSpacing: 0.3,
              }}
            >
              <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none", fontSize: 16 }}>
                {loading ? "⟳" : "⊕"}
              </span>
              {loading ? "Scanning web..." : "Scan Update"}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, backgroundColor: "#130A0A", border: "1px solid #450A0A", color: "#FCA5A5", fontSize: 11 }}>
              ⚠ {error}
            </div>
          )}
        </div>
      </div>

      {/* === FILTER TABS === */}
      <div style={{ borderBottom: "1px solid #1A2638", padding: "0 24px", backgroundColor: "#090D18" }}>
        <div style={{ maxWidth: 940, margin: "0 auto", display: "flex", gap: 0 }}>
          {FILTERS.map((tab) => {
            const count = providers.filter(tab.fn).length;
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: "11px 14px",
                  border: "none",
                  borderBottom: `2px solid ${active ? "#06B6D4" : "transparent"}`,
                  backgroundColor: "transparent",
                  color: active ? "#06B6D4" : "#475569",
                  fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {tab.label}
                <span style={{ padding: "1px 6px", borderRadius: 10, backgroundColor: active ? "#083344" : "#0F172A", color: active ? "#06B6D4" : "#334155", fontSize: 10 }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* === GRID === */}
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "20px 24px 40px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0 20px", color: "#0891B2", fontSize: 13 }}>
            <div style={{ fontSize: 28, animation: "spin 1.5s linear infinite", display: "inline-block", marginBottom: 12 }}>⟳</div>
            <p style={{ margin: 0 }}>Mencari provider terbaru di web...</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(275px, 1fr))", gap: 14 }}>
          {filtered.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              copied={copied}
              onCopy={copyUrl}
              expanded={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#334155" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⊘</div>
            <p style={{ margin: 0, fontSize: 13 }}>Tidak ada provider yang cocok.</p>
          </div>
        )}

        <p style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#1E293B" }}>
          Data seed: Juli 2026 · Klik "Scan Update" untuk data real-time via web search
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  );
}