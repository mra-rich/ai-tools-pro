#!/usr/bin/env python3
# ═════════════════════════════════════════════════════════════════
# learn-virality.py — BELAJAR dari data, bukan nebak.
#
# Baca analytics/report.json (all_posts) → ekstrak BANYAK parameter
# per post → hitung korelasi tiap parameter terhadap views →
# tulis promo/analytics/learnings.json (rangkuman "apa yang terbukti
# berkorelasi dengan views dari data historis").
#
# Bukan 1-2 dimensi: 17 parameter + interaksi. Hasilnya korelasi
# (Spearman), BUKAN klaim kausal — tapi jauh lebih baik dari tebakan.
#
# Pakai:  python3 promo/learn-virality.py
# ═════════════════════════════════════════════════════════════════
import json, re, math, os, statistics
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT = os.path.join(REPO, 'promo', 'analytics', 'report.json')
OUT = os.path.join(REPO, 'promo', 'analytics', 'learnings.json')

WIB = timezone.utc  # ts di report pakai +0000; WIB = +7 (di-offset saat ekstrak)

# ── Ekstrak fitur dari 1 post ─────────────────────────────────────
def features(p):
    prev = str(p.get('preview', ''))
    views = p.get('views', 0) or 0
    likes = p.get('likes', 0) or 0
    replies = p.get('replies', 0) or 0
    quotes = p.get('quotes', 0) or 0

    # waktu posting
    hour = None
    weekday = None
    ts = p.get('ts', '')
    try:
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        dt_wib = dt.astimezone(WIB)
        hour = dt_wib.hour
        weekday = dt_wib.weekday()  # 0=Senin..6=Minggu
    except Exception:
        pass

    # fitur teks
    txt = prev.lower()
    words = re.findall(r'\w+', prev)
    emojis = len(re.findall(r'[\U0001F300-\U0001FAFF\u2600-\u27BF]', prev))
    exclam = prev.count('!')
    question = prev.count('?')
    caps_words = sum(1 for w in re.findall(r'\b[A-Z]{2,}\b', prev))
    has_link = 1 if re.search(r'https?://|tokengratis', txt) else 0
    has_number = 1 if re.search(r'\d', prev) else 0
    has_model = 1 if re.search(r'claude|sonnet|opus|kimi|qwen|gemini|gpt|flux|llama|deepseek|glm|zhipu|mistral|jarvis', txt) else 0
    has_free = 1 if re.search(r'gratis|free|irit|murah|hemat', txt) else 0
    has_cara = 1 if re.search(r'cara|caranya|begini|gimana|tutorial|langkah', txt) else 0
    has_kalah = 1 if re.search(r'kalah|lebih|banding|vs\.?|daripada|ternyata', txt) else 0
    has_emo = 1 if re.search(r'gila|akhirnya|wow|astaga|nggak nyangka|benar-benar|real|asli', txt) else 0

    # engagement ratios
    like_rate = likes / views if views else 0
    reply_rate = replies / views if views else 0

    return {
        'id': p.get('id'),
        'views': views,
        'hour_wib': hour,
        'weekday': weekday,
        'len': len(prev),
        'words': len(words),
        'emojis': emojis,
        'exclam': exclam,
        'question': question,
        'caps_words': caps_words,
        'has_link': has_link,
        'has_number': has_number,
        'has_model': has_model,
        'has_free': has_free,
        'has_cara': has_cara,
        'has_kalah': has_kalah,
        'has_emo': has_emo,
        'like_rate': like_rate,
        'reply_rate': reply_rate,
        'cat': p.get('cat', ''),
    }


# ── Spearman rank correlation (pure python, tanpa dependensi) ────
def spearman(xs, ys):
    n = len(xs)
    if n < 4:
        return None
    def rank(v):
        s = sorted(v)
        r = []
        for val in v:
            # average rank untuk duplikat
            lo = s.index(val); hi = len(s) - 1 - s[::-1].index(val)
            r.append((lo + hi) / 2 + 1)
        return r
    rx, ry = rank(xs), rank(ys)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else None


# ── Main ─────────────────────────────────────────────────────────
def main():
    if not os.path.exists(REPORT):
        print('Tidak ada report.json — jalankan analytics workflow dulu.')
        return 1
    rep = json.load(open(REPORT))
    posts = rep.get('all_posts', [])
    if not posts:
        print('all_posts kosong.')
        return 1

    rows = [features(p) for p in posts]
    rows = [r for r in rows if r['views'] is not None]
    n = len(rows)
    views = [r['views'] for r in rows]

    # log10(views) — distribusi views sangat miring, log lebih stabil
    log_views = [math.log10(v + 1) for v in views]

    numeric_cols = [
        'hour_wib', 'weekday', 'len', 'words', 'emojis', 'exclam',
        'question', 'caps_words', 'has_link', 'has_number', 'has_model',
        'has_free', 'has_cara', 'has_kalah', 'has_emo', 'like_rate', 'reply_rate',
    ]
    labels = {
        'hour_wib': 'jam posting (WIB)',
        'weekday': 'hari (0=Senin..6=Minggu)',
        'len': 'panjang teks (chars)',
        'words': 'jumlah kata',
        'emojis': 'jumlah emoji',
        'exclam': 'jumlah tanda seru (!)',
        'question': 'jumlah tanda tanya (?)',
        'caps_words': 'kata ALL-CAPS',
        'has_link': 'memuat link',
        'has_number': 'memuat angka',
        'has_model': 'sebut model AI',
        'has_free': 'kata gratis/free/irit/murah',
        'has_cara': 'kata cara/langkah',
        'has_kalah': 'perbandingan (kalah/lebih/vs)',
        'has_emo': 'kata emosi (gila/akhirnya/wow)',
        'like_rate': 'like/views',
        'reply_rate': 'reply/views',
    }

    corrs = []
    for col in numeric_cols:
        xs = [r[col] for r in rows]
        if all(x is None for x in xs):
            continue
        xs_clean = [(x if x is not None else 0) for x in xs]
        rho = spearman(xs_clean, log_views)
        if rho is not None:
            corrs.append((abs(rho), rho, labels[col], col))

    corrs.sort(reverse=True)

    print(f'=== BELAJAR dari {n} post — korelasi Spearman vs log10(views) ===')
    print(f'{"rho":>7}  parameter')
    print('-' * 60)
    for _, rho, lab, _ in corrs:
        arrow = '🟢 positif' if rho > 0.1 else ('🔴 negatif' if rho < -0.1 else '⚪ lemah')
        print(f'{rho:>+7.3f}  {lab:<28} {arrow}')
    print()

    # ── analisis per kategori ──
    print('=== views rata-rata per kategori ===')
    by_cat = {}
    for r in rows:
        by_cat.setdefault(r['cat'], []).append(r['views'])
    for cat, vs in sorted(by_cat.items(), key=lambda kv: -statistics.mean(kv[1])):
        print(f'  {cat:<18} n={len(vs):>3}  rata2={statistics.mean(vs):>8.0f}  median={statistics.median(vs):>8.0f}')

    print()
    print('=== views rata-rata per jam WIB (jam posting) ===')
    by_hour = {}
    for r in rows:
        if r['hour_wib'] is not None:
            by_hour.setdefault(r['hour_wib'], []).append(r['views'])
    for h in sorted(by_hour):
        vs = by_hour[h]
        print(f'  {h:>2}:00 WIB  n={len(vs):>2}  rata2={statistics.mean(vs):>8.0f}')

    # simpan learnings
    out = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'n_posts': n,
        'method': 'Spearman rank correlation vs log10(views) — korelasi, BUKAN kausal',
        'correlations': [
            {'param': col, 'label': labels[col], 'rho': round(rho, 4)}
            for _, rho, lab, col in corrs
        ],
        'cat_avg_views': {c: round(statistics.mean(v), 1) for c, v in sorted(by_cat.items(), key=lambda kv: -statistics.mean(kv[1]))},
    }
    json.dump(out, open(OUT, 'w'), indent=2)
    print()
    print(f'✅ learnings.json ditulis: {OUT}')


if __name__ == '__main__':
    main()
