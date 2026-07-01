---
version: v2-research-driven
name: CryptoSense-research-tool-design
description: A crypto risk-research tool, not an exchange. It reads like a quiet analytical instrument — closer to Perplexity's "invisible brand" and a Bloomberg/Linear cockpit than to a consumer fintech marketing site. There is no login, no "Sign Up" CTA, no full-bleed marketing hero. The canvas stays white and editorial; one scarce blue (`#0052ff`, inherited from the Coinbase exploration) still marks the wordmark and the rare "this is knowledge-base evidence" moment, but it no longer drives CTA buttons because the product has no conversion funnel. The single dark surface in the system is the AI research console — reused everywhere as the place where synthesis happens, not as marketing set-dressing. Every data surface discloses its source and timestamp. Every status (up/down/positive/negative/risk) is triple-encoded — color + icon + text — because color alone fails ~8% of users and fails the "one glance, no ambiguity" bar a research tool must clear.

sources:
  - .superpowers/sdd/research/07-nng-dashboard-dataviz.md
  - .superpowers/sdd/research/08-nng-ai-trust-citations.md
  - .superpowers/sdd/research/09-analytical-tool-precedents.md
  - .superpowers/sdd/research/10-risk-communication-ux.md
  - .superpowers/sdd/research/11-nng-typography-scanning.md
  - cryptosense/DESIGN-coinbase (1).md (retained: primary blue, Inter/Geist Mono, 24px card radius, semantic text-only colors)

colors:
  primary: "#0052ff"          # scarce: wordmark + KB-evidence accent only, never a CTA color
  primary-soft: "#e8eeff"     # KB citation chip background
  ink: "#0a0b0d"
  body: "#5b616e"
  muted: "#7c828a"
  muted-soft: "#a8acb3"
  hairline: "#dee1e6"
  hairline-soft: "#eef0f3"
  canvas: "#ffffff"
  surface-soft: "#f7f7f7"
  surface-strong: "#eef0f3"
  surface-dark: "#121316"        # NOT pure black — halation research (analytical-tool-precedents §4)
  surface-dark-elevated: "#1b1d22"
  surface-dark-elevated-2: "#24262c"   # 4th layer: nested card / hover state inside the dark console
  on-dark: "#f2f1ee"              # near-white, not pure white — same halation reasoning
  on-dark-soft: "#a8acb3"
  semantic-up: "#05b169"
  semantic-down: "#cf202f"        # reserved for genuinely high-risk / high-severity states only
  semantic-down-soft: "#b3541f"   # amber/brick — default "negative" color; see Do/Don't
  semantic-neutral: "#7c828a"

typography:
  kpi-glanceable:
    fontFamily: "'Geist Mono', monospace"
    fontSize: 32px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -0.01em
    numericVariant: tabular-nums
    note: "Glanceable-reading tier — large, non-condensed, one-glance recognition (research 11 §2)"
  price-display:
    fontFamily: "'Geist Mono', monospace"
    fontSize: 44px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: -0.02em
    numericVariant: tabular-nums
  table-number:
    fontFamily: "'Geist Mono', monospace"
    fontSize: 15px
    fontWeight: 500
    numericVariant: tabular-nums
    textAlign: right
  section-title:
    fontFamily: "'Inter', sans-serif"
    fontSize: 18px
    fontWeight: 600
    letterSpacing: -0.01em
  body-md:
    fontFamily: "'Inter', sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  ai-body:
    fontFamily: "'Inter', sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
    note: "Deep-reading tier, not glanceable — line-height 1.4-1.6 per research 11 §2"
  caption:
    fontFamily: "'Inter', sans-serif"
    fontSize: 13px
    fontWeight: 400
    color-ref: "{colors.muted}"
  caption-mono:
    fontFamily: "'Geist Mono', monospace"
    fontSize: 12px
    fontWeight: 500

rounded:
  sm: 8px
  md: 12px
  card: 24px
  chip: 100px      # tags, chips, follow-up-question buttons — NOT primary CTAs (there are none)
  full: 9999px     # asset icon circles

spacing:
  xs: 8px
  sm: 12px
  base: 16px
  md: 20px
  lg: 24px
  xl: 32px
  section: 64px    # reduced from Coinbase's 96px — this is a working tool, not an editorial marketing site

components:
  top-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    height: 56px
    note: "Wordmark + breadcrumb only. No Sign In/Sign Up, no hamburger, no marketing nav items."
  kpi-strip:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
    note: "Replaces the Coinbase dark marketing hero. Light, quiet, sits directly under the top bar — no headline, no CTA."
  kpi-card:
    backgroundColor: "{colors.canvas}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
    requiredParts: ["label", "value (kpi-glanceable)", "delta (icon+color+text)", "source+timestamp caption"]
  data-table:
    firstColumn: sticky, human-readable identifier (logo+name+ticker)
    headerRow: sticky
    numberColumns: right-aligned, tabular-nums, Geist Mono
    rowTreatment: zebra striping + hover highlight
    sort: clickable column headers with direction indicator
  ai-console:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.card}"
    padding: "{spacing.xl}"
    note: "The one deliberate dark surface in the whole system — reused, not a one-off hero. Four elevation layers inside: surface-dark (base) / surface-dark-elevated (message bubbles, verdict card) / surface-dark-elevated-2 (nested/expanded citation) / modal overlay."
  verdict-card:
    backgroundColor: "{colors.surface-dark-elevated}"
    rounded: "{rounded.md}"
    padding: "{spacing.base}"
    requiredParts:
      - "stance label as TEXT (正面/中性/負面), never color-only"
      - "confidence as tier text (高/中/低) + one-line reason, never a bare percentage"
      - "one-line first-person conclusion with necessary caveat (truncated pyramid, research 08 §1)"
      - "disclaimer sentence embedded in the card, tied to an action (\"點擊下方引文核對來源\")"
  evidence-list:
    positive: "✅ heading, up-color icon, paired 1-1 with negative — never shown alone"
    negative: "⚠️ heading, semantic-down-soft icon (not full red), paired 1-1 with positive"
    note: "Positive/negative must always appear together — an AI summary with only upside is a trust failure (research 08 §2)."
  citation-chip-kb:
    borderLeft: "2px solid {colors.primary}"
    backgroundColor: "{colors.surface-dark-elevated-2}"
    label: "📚 + exact filename/section, never \"Source 1\""
    note: "The one scarce blue moment inside the console — reserved for knowledge-base evidence only."
  citation-chip-public:
    borderLeft: "2px solid {colors.muted}"
    backgroundColor: "{colors.surface-dark-elevated-2}"
    label: "📰/📊 + exact publication or API name, never \"Source 2\""
  followup-chip:
    backgroundColor: transparent
    border: "1px solid #2a2d34"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.chip}"
    note: "Dynamic per-turn suggestions, not a static starter list (research 08 §1 guideline 4)."
  chart-line:
    gridlines: "none if tooltip/data-label present, else minimal"
    seriesLabeling: "direct end-of-line label, not a legend box"
    colorRule: "grayscale base + single accent on the highlighted/selected series"
    forbidden: ["pie", "donut", "gauge/speedometer", "3D", "stacked bar for time series"]
---

## Overview

CryptoSense is a research instrument, not a storefront. The prior Coinbase-style exploration borrowed a consumer exchange's visual grammar — a full-bleed dark marketing hero, pill "Get Started" CTAs, a Sign In / Sign Up top nav — none of which map to a product that has no account, no order flow, and no conversion goal. This version keeps the parts of the Coinbase system that were never actually about selling (the 24px card radius, Inter + Geist Mono, text-only semantic color) and replaces everything that was about selling with patterns drawn from research/analysis tools: Bloomberg's "cockpit, not gallery" density philosophy, Perplexity's citation-first trust model, Linear/Notion's layered dark-surface system, and NN/g's dashboard, chatbot-trust, and risk-communication guidelines.

**What changed from the Coinbase exploration, and why:**

| Coinbase pattern | Problem for a research tool | Replacement |
|---|---|---|
| Dark marketing hero + headline + 2 CTAs | Hero band exists to sell an account; CryptoSense has none | `kpi-strip` — a quiet analytical status row, no headline, no CTA |
| Sign In / Sign Up top nav | Implies an account system that doesn't exist | `top-bar` — wordmark + breadcrumb only |
| Pill CTA as the "action" color | There is no primary action to drive users toward | `{colors.primary}` demoted to a single evidence-marking accent (KB citations only) |
| Trading-style red/green urgency | Encourages snap reactions; this product's job is to slow the user down and show risk | Triple-encoded status (color+icon+text); `semantic-down-soft` amber as the *default* negative, full red reserved for genuinely severe risk |
| Extreme whitespace, low density | Signals "browse casually"; research tasks want scanning efficiency | `data-table` follows Bloomberg/NN/g table guidance: sticky ID column, tabular-nums, zebra striping — density is a feature here, not a flaw |
| No disclosure of data provenance | Fine for a price ticker; fatal for a tool whose entire value is "trustworthy analysis" | Every `kpi-card` and every AI citation carries a source + timestamp |

**What stayed, and why:** the 24px card radius, Inter for text, Geist Mono for numbers, and text-only semantic color were never Coinbase-specific — NN/g's own clutter/contrast guidance (research 07 §2) endorses the same restraint. The dark "AI console" card also survives, but its role changes: it's no longer a one-off hero decoration, it's the recurring, load-bearing surface where synthesis and citation happen — closer to how Linear treats its dark product canvas than how Coinbase treats its marketing hero.

## Color

- `{colors.primary}` (#0052ff) is now scarce to the point of being almost a private signal: it appears on the wordmark, and as the left border on knowledge-base citation chips — nowhere else. It no longer marks buttons, because there are no primary-action buttons to mark.
- Up/down are still text-only (no background fills), but down now defaults to `{colors.semantic-down-soft}` (a desaturated brick/amber), with full-saturation `{colors.semantic-down}` red reserved for a small, deliberate set of "this is a severe/urgent risk" moments. Reserving red keeps it meaningful instead of habituating users to ignore it (research 10 §4, "warning fatigue").
- Every up/down/positive/negative/risk indicator must pair color with an icon (▲/▼, ✅/⚠️) and a text label. Color is never the sole carrier of state (research 07 §1, research 10 §2 — ~8% of men have red-green color blindness).
- Dark surfaces use `#121316` / `#1b1d22` / `#24262c`, not pure black — pure black next to near-white text causes halation and eye fatigue on long reading sessions (research 09 §4).

## Typography

Unchanged fonts (Inter + Geist Mono, already shipped via `next/font` in Task 1), but the type scale is now organized around **reading mode**, not just visual hierarchy:

1. **Glanceable tier** (`kpi-glanceable`, `price-display`) — large, normal-width (never condensed), tabular-nums. For numbers the user needs to recognize in under a second (research 11 §2).
2. **Scanning tier** (`table-number`, `section-title`) — table cells, headings, news titles. Right-aligned tabular-nums on every numeric column so a whole column can be compared without re-reading each row (research 11 §3).
3. **Deep-reading tier** (`ai-body`, `body-md`) — AI analysis prose, line-height 1.4–1.6, never condensed, never all-caps. This is the one place in the product where the user is expected to actually read sentences, not scan (research 11 §2).

Three tiers only — NN/g's own guidance (research 11 §4) is that more than 3 size levels adds visual complexity without adding clarity.

## Layout Philosophy

- **First screen = conclusion, not a wall of data.** Coin page opens with price + one-line AI verdict; technical indicators, full news list, and citation detail live one level down (progressive disclosure, research 07 §3) — the opposite of an exchange page that flattens everything so a trade can happen in one glance.
- **Density is earned, not avoided.** The market-overview ranking table and KPI strip use Bloomberg/Linear-style compact rows with a clear alignment grid, rather than Coinbase's generous 96px editorial rhythm — a research tool's users want to scan many rows quickly, not be walked through a story (research 09 §1, §3).
- **The AI console is the one place density relaxes** — deep-reading typography, more line-height, more breathing room — because that's the one surface doing a different job (comprehension, not comparison).

## The AI Console (signature component)

This is the most load-bearing surface in the product, and the one place research findings changed the most from the original Coinbase-flavored mockup:

- **Verdict card** leads with a one-sentence, first-person conclusion + the caveat needed to not be misread (e.g. "根據近期新聞情緒轉弱與流動性風險，我判斷偏負面，但此類判斷有時效性") — never a bare "Negative (80%)" (research 08 §2, "truncated pyramid").
- **Confidence is a tier + a reason, never a lone percentage.** "信心：中 — 近期新聞樣本較少" beats "信心 73%", because a precise number implies a precision the model doesn't have, and miscalibrated confidence actively damages trust (research 10 §3).
- **Positive and negative evidence are always paired**, never positive-only — an AI summary that only lists upside reads as filtered/biased (research 08 §2).
- **Citations are chips, not footnotes** — inline, next to the sentence they support, labeled with the real filename/publication (not "Source 1"), and visually split into two families: knowledge-base (blue left border — the one scarce blue moment) vs. public source (neutral left border) so the user can judge evidentiary weight at a glance (research 08 §3, research 09 §2).
- **The disclaimer lives inside the verdict card**, phrased as an instruction ("點擊下方引文核對來源後再自行判斷"), not as a footer legal string — and it appears *especially* when stance is positive and confidence is high, since that's the moment a user is most likely to act without checking (research 10 §4).
- **No anthropomorphism** — no avatar, no name, no "I feel/I think" phrasing. NN/g's own study found perceived warmth correlates *negatively* with advice-taking in decision-oriented tasks (B = −1.04), while perceived competence correlates positively (research 08 §2).

## Charts

- Line/bar only. No pie, donut, gauge/speedometer, or 3D — all rejected by NN/g on preattentive-processing grounds (humans misjudge area/angle; research 07 §1–2).
- Grayscale-first: draw every series in gray, then apply the single accent color only to the series the user is currently comparing against (research 07 §2, "Contrast").
- Direct end-of-line labels instead of legend boxes — removes the back-and-forth eye movement a legend requires (research 07 §2, "Clutter-Free").
- Chart titles are active, not descriptive: "ETH 7 日波動度上升 40%", not "ETH Volatility Chart" — the chart should state the finding, matching this product's analytical purpose (research 07 §2).

## Do's and Don'ts

### Do
- Disclose source + timestamp on every data-bearing card — this is the product's core trust mechanism (research 07 §5, research 09 §4).
- Keep `{colors.primary}` scarce enough that its one appearance (KB citations) actually reads as meaningful.
- Pair every status indicator with color + icon + text.
- Default negative states to `semantic-down-soft`; reserve full red for genuinely severe risk.
- Let some friction exist on purpose — "expand methodology", "expand full citation list" are trust signals, not UX debt (research 09 §4).

### Don't
- Don't add a Sign In/Sign Up, hamburger nav, or any account-system chrome — there is no account system.
- Don't build a marketing hero band. The KPI strip replaces it.
- Don't use pie/donut/gauge charts, ever.
- Don't show AI confidence as a bare percentage.
- Don't let an AI summary present only positive evidence.
- Don't hide the "not investment advice" line in a footer — it lives inside the verdict card.
- Don't use FOMO patterns (countdown timers, "X people viewing this") — they contradict a tool whose entire premise is helping users slow down and spot risk (research 10 §4).
