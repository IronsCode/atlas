# Elocin — Brand & Design System Guidelines

**Version 1.0 (proposed identity) · "Calm Intelligence"**

> ⚠️ **Status: proposal, not yet implemented.** The product and marketing site
> currently ship a *warm-beige / sage / DM Sans + Lora* identity. This document
> defines a **new, industry-neutral identity (deep teal / slate / coral / Inter)**
> intended to scale Elocin beyond education. Adopting it is a full rebrand —
> see [§14 Migration & Risks](#14-migration-risks--alternatives). Nothing here is
> live until we deliberately migrate `tailwind.config.js` and the component layer.

---

## 1. Brand foundations

**Positioning.** Elocin is the observation and documentation platform. It turns
what a professional *notices* into structured, trustworthy evidence. The brand
must read as a **calm, intelligent instrument** — the quiet confidence of a
well-made tool — not a cheerful classroom app.

**Personality (and what it rules out).**

| Trait | Expressed as | Deliberately avoided |
|---|---|---|
| Calm | Generous whitespace, low-saturation surfaces, slow motion | Busy dashboards, hard shadows |
| Intelligent | Precise typography, meaningful color, data clarity | Gimmicky "AI" glow, sci-fi tropes |
| Professional | Restrained palette, aligned grid, consistent radii | Rainbow charts, decorative gradients |
| Human | Warm-neutral background, one warm accent (coral), rounded corners | Cold corporate gray, sharp corners |
| Premium | Optical spacing, few weights used well, soft elevation | Heavy borders, cluttered UI |
| Trustworthy | Deep teal as the anchor, accessible contrast, audit-friendly clarity | Alarmist reds, low-contrast text |

**Why this scales past education.** The identity carries **no education-specific
signifiers** (no primary crayon colors, no rounded "friendly" mascots, no
chalkboard motifs). Deep teal reads equally at home in healthcare, HR, and
manufacturing analytics. That is the point: one identity, many verticals, **no
rebrand required**.

---

## 2. Color system

### 2.1 Brand & neutral ramps

Full 50–950 ramps are provided so components have hover/active/subtle states,
not just single stops. Anchor stops match the brief exactly.

**Teal — primary** (brand, primary actions, focus, links). Anchor `700 = #0F766E`.

| 50 | 100 | 200 | 300 | 400 | 500 | 600 | **700** | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|
| #F0FDFA | #CCFBF1 | #99F6E4 | #5EEAD4 | #2DD4BF | #14B8A6 | #0D9488 | **#0F766E** | #115E59 | #134E4A | #042F2E |

**Slate — secondary / neutral** (text, surfaces-in-dark, structure). Anchors:
`700 = #334155` (secondary brand), `900 = #0F172A` (primary text), `500 = #64748B`
(secondary text).

| 50 | 100 | 200 | 300 | 400 | **500** | 600 | **700** | 800 | **900** | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| #F8FAFC | #F1F5F9 | #E2E8F0 | #CBD5E1 | #94A3B8 | **#64748B** | #475569 | **#334155** | #1E293B | **#0F172A** | #020617 |

**Coral — accent** (sparingly: highlights, one focal CTA, human warmth). Anchor `500 = #F97366`.

| 50 | 100 | 200 | 300 | 400 | **500** | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| #FFF3F1 | #FFE4E0 | #FFCEC7 | #FCA89D | #FB8A7B | **#F97366** | #E85A4D | #C4453A | #A03A31 | #83332C |

### 2.2 Semantic (functional) colors

| Role | Token | Hex | On-white text? |
|---|---|---|---|
| Success | `--color-success` | #22C55E | ❌ fill/indicator only |
| Warning | `--color-warning` | #F59E0B | ❌ fill/indicator only |
| Error | `--color-error` | #DC2626 | ✅ 4.8:1 (AA) |
| Info | `--color-info` | #0284C7 | ✅ (dedicated sky, so it never collides with brand teal) |

Each ships a `-subtle` (tinted background) and `-strong` (text-on-tint) pair — see tokens.

### 2.3 Surface & text roles (light)

| Role | Token | Hex |
|---|---|---|
| Background (page) | `--color-bg` | #FCFCFB (warm white) |
| Surface (card) | `--color-surface` | #FFFFFF |
| Surface sunken | `--color-surface-sunken` | #F8FAFC |
| Border | `--color-border` | #E5E7EB |
| Border strong | `--color-border-strong` | #CBD5E1 |
| Text primary | `--color-text` | #0F172A |
| Text secondary | `--color-text-muted` | #64748B |
| Text on-brand | `--color-on-brand` | #FFFFFF |

### 2.4 Usage rules (color communicates meaning, not decoration)

1. **Teal is for action and trust, not fills.** Primary buttons, active nav,
   links, focus rings, selected states. Don't tint whole panels teal.
2. **Coral is a scalpel, not a paintbrush.** ~5% of any screen, max. One
   emphasis per view (a single hero CTA, a "new" highlight, a positive-trend
   spark). **Never** as a large text-on-color surface — see contrast note.
3. **Semantic colors are indicators, never the only signal.** Pair with an icon
   and/or label (colorblind users, print, audit exports).
4. **Neutral does the heavy lifting.** 90% of the UI is warm-white + slate.
   Color earns attention precisely because most of the screen has none.
5. **No gradients** except (a) chart area-fills at ≤12% alpha, and (b) skeleton
   shimmer. Flat brand surfaces read more premium and more enterprise.

### 2.5 Contrast (verified, WCAG 2.1)

| Pair | Ratio | Verdict |
|---|---|---|
| Text #0F172A on bg #FCFCFB | ~16.9:1 | AAA |
| Muted #64748B on #FCFCFB | **4.7:1** | AA (borderline — use slate-600 #475569 for text < 16px) |
| White on teal-700 #0F766E | **5.5:1** | AA (buttons, normal text) |
| White on coral-500 #F97366 | **2.7:1** | ❌ FAIL — coral gets **ink** text (#0F172A → 6.3:1) or is non-text |
| White on error-600 #DC2626 | 4.8:1 | AA |
| Ink on success/warning fills | pass | use ink text on green/amber, never white |

---

## 3. Typography

**Primary typeface: Inter.** Chosen over Geist/Manrope for three reasons: it is
the most battle-tested UI face at data density (tabular figures, huge glyph set,
optical sizes), it feels neutral-premium across every vertical, and it is free +
variable so weight/tracking are cheap. **Geist** is the sanctioned alternative if
we want a slightly more geometric, "Vercel-modern" tone; **Manrope** if we want a
touch warmer. Do not mix them.

- **Product/UI + body:** Inter (variable).
- **Marketing display (optional):** Inter Display / Inter at large sizes with
  tighter tracking. A serif is intentionally **not** part of the core system
  (keeps it minimal and cross-industry). One optional editorial serif
  (e.g. *Newsreader*) may appear on marketing *only*, never in-product.
- **Numeric/data:** Inter with `font-variant-numeric: tabular-nums`.

### 3.1 Type scale (1.20 minor-third for headings; tight UI steps)

| Token | Size / Line height | Weight | Tracking | Use |
|---|---|---|---|---|
| display | 48 / 52px (3rem) | 600 | -0.02em | Marketing hero |
| h1 | 36 / 42px | 600 | -0.02em | Page title |
| h2 | 28 / 36px | 600 | -0.015em | Section |
| h3 | 22 / 30px | 600 | -0.01em | Subsection / card title |
| h4 | 18 / 26px | 600 | -0.01em | Small heading |
| body-lg | 18 / 28px | 400 | 0 | Lead paragraph |
| body | 16 / 24px | 400 | 0 | Default text |
| body-sm | 14 / 20px | 400 | 0 | Secondary, dense UI |
| caption | 13 / 18px | 500 | 0 | Metadata, table headers |
| overline | 12 / 16px | 600 | 0.08em (UPPERCASE) | Eyebrows, labels |

**Weights:** 400 (body), 500 (UI labels, emphasis), 600 (headings, buttons),
700 (rare — big marketing display only). Never use <400 or 800/900 — they read
either weak or shouty and break the "calm" tone.

**Line-height rule:** ~1.5 for body, ~1.2–1.3 for headings, 1.0–1.2 for single-
line UI. **Measure (line length):** 60–75ch for prose; cap marketing paragraphs
at ~65ch.

---

## 4. Spacing — 4px base grid (8px rhythm)

Base unit **4px**. Layout rhythm prefers multiples of 8. Named scale:

`0=0 · 0.5=2 · 1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 12=48 · 16=64 · 20=80 · 24=96 · 32=128`

- **Component internal padding:** buttons 8/16, inputs 10/12, cards 20–24.
- **Stack rhythm:** 8 (tight), 16 (default), 24 (grouped), 48–64 (sections).
- **Page gutters:** 16 (mobile), 24 (tablet), 32+ (desktop), max content 1200px.
- **Data density mode:** rows may drop to 4/8 padding; never below 4.

---

## 5. Border radius (10–12px cards)

| Token | Value | Use |
|---|---|---|
| radius-xs | 4px | tags, chips, inline code |
| radius-sm | 6px | badges, small buttons |
| radius-md | 8px | buttons, inputs, dropdowns |
| radius-lg | 10px | cards, popovers |
| radius-xl | 12px | modals, primary panels |
| radius-2xl | 16px | marketing feature cards |
| radius-full | 9999px | avatars, pills, toggles |

Consistency rule: an element and the elements *nested* inside it should differ by
one step (12px modal → 8px buttons inside), never share the exact radius.

---

## 6. Elevation / shadows (soft, minimal)

Low-contrast, cool-tinted shadows (slate, not black) for a calm, premium feel.

| Token | Value | Use |
|---|---|---|
| shadow-xs | `0 1px 2px rgba(15,23,42,.04)` | inputs, resting rows |
| shadow-sm | `0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)` | cards |
| shadow-md | `0 4px 12px rgba(15,23,42,.08)` | dropdowns, hover-lift |
| shadow-lg | `0 12px 32px -8px rgba(15,23,42,.12)` | popovers, modals |
| shadow-xl | `0 24px 64px -16px rgba(15,23,42,.18)` | marketing hero mock |
| focus-ring | `0 0 0 3px rgba(15,118,110,.35)` | keyboard focus (teal) |

Rule: **borders define, shadows lift.** Most surfaces use a 1px border + tiny
shadow, not a big shadow. Reserve `lg`+ for true overlays.

---

## 7. Component library specs

Baseline: 1px borders, `radius-md`/`lg`, `shadow-sm`, generous padding, 150ms
color transitions, always a visible focus ring.

- **Buttons.** Heights 32/40/48 (sm/md/lg), `radius-md`, weight 600.
  - *Primary:* teal-700 fill, white text, hover teal-800, active teal-900.
  - *Secondary:* white fill, slate-300 border, ink text, hover slate-50.
  - *Ghost:* transparent, ink text, hover slate-100.
  - *Accent (rare):* coral-500 fill with **ink** text (never white).
  - *Destructive:* error-600 fill, white text.
  - Disabled = 45% opacity + `not-allowed`. Loading = inline spinner, keep width.
- **Inputs.** 40px, white, slate-300 border, ink text, muted placeholder; focus =
  teal border + focus-ring. Error = error-600 border + helper text + icon.
  Label above (500/14px), helper below (13px muted). Never rely on placeholder as label.
- **Dropdowns / Select.** Trigger = input style + chevron; menu = white,
  `radius-lg`, `shadow-md`, 1px border, 8px padding; items 36px, hover slate-100,
  selected teal-50 + teal-700 check. Keyboard: ↑↓ + type-ahead.
- **Cards.** White, 1px slate-200 border, `radius-lg`, `shadow-sm`, 20–24px
  padding. Optional header row (h3 + actions) and hairline divider. Hover-lift
  (`shadow-md`, -1px translate) only if the whole card is a link.
- **Tables.** Header row: slate-50 bg, caption/overline labels, 12px. Body rows
  56px (comfortable) / 44px (compact), 1px bottom hairlines, hover slate-50.
  Numbers right-aligned + tabular figures. Sticky header on scroll. Zebra OFF by
  default (borders are enough — calmer). Row selection = teal-50 + left teal bar.
- **Top navigation.** 56–64px, white, bottom hairline, sticky. Left: wordmark.
  Center/left: primary nav (active = teal text + 2px teal underline). Right:
  search, notifications, avatar menu. Blur-backdrop on scroll.
- **Sidebar.** 240–260px (collapsible to 64px icon rail). Slate-50 or white bg,
  right hairline. Item 40px, `radius-md`; active = teal-50 bg + teal-700 text +
  icon; hover = slate-100. Section overlines. Org switcher pinned top, user
  pinned bottom.
- **Modals.** Centered, max 560px (dialog) / 720px (form), `radius-xl`,
  `shadow-lg`, 24–32px padding. Scrim = `rgba(15,23,42,.45)`. Title (h3) +
  close (top-right, 40px hit area) + footer actions (primary right). Trap focus,
  restore on close, Esc to dismiss.
- **Empty states.** Centered: line-style icon in a slate-100 circle, h3, one-line
  muted explanation, one primary action. Warm, never cute. (e.g. "No observations
  yet — capture your first to start building a record.")
- **Notifications / Toasts.** Bottom-right stack, white, `radius-lg`,
  `shadow-md`, 4px left semantic bar + semantic icon, title + optional body +
  optional action. Auto-dismiss 5s (not for errors). Max 3 visible.
- **Badges.** `radius-sm`, 12px/500, `-subtle` bg + `-strong` text
  (e.g. success = green-50 / green-700). Uppercase optional per context.
- **Tags / Chips.** `radius-full` or `xs`, slate-100 bg + slate-700 text;
  removable = trailing ×; input chips for multi-select.
- **Progress.** Linear (6px track slate-200, teal fill) and radial for
  single-metric. Determinate by default; indeterminate = slow teal sweep.
  Steppers use teal for done, slate for upcoming.
- **Charts / Data-viz.** See §8.

---

## 8. Data visualization

Calm, low-saturation, colorblind-aware. **Category order matters** — assign in
sequence so the first series is always brand teal.

**Categorical (up to 8):**
`teal-600 #0D9488 · slate-500 #64748B · coral-500 #F97366 · amber-500 #F59E0B ·
info #0284C7 · violet #7C3AED · teal-300 #5EEAD4 · slate-400 #94A3B8`

**Sequential (heatmaps, intensity):** teal-50 → teal-900.
**Diverging (below/above target):** coral-500 ↔ slate-200 ↔ teal-600.
**Rules:** grid lines slate-200 at 60% alpha; axis labels caption/muted; area
fills ≤12% alpha; never encode meaning by color alone (add direct labels /
patterns); trends use semantic green/red *only* for genuine good/bad, not
category.

---

## 9. Brand assets

- **Logo direction.** A precise wordmark "Elocin" in Inter/Geist 600 with a
  custom-tuned lowercase, paired with a **geometric monogram "e"** that doubles
  as an app icon and an abstract "observation" mark (an aperture / concentric
  eye-and-record motif). Teal monogram on white; white on teal. One-color and
  mono versions mandatory. Avoid literal eyes, apples, ABC blocks, speech bubbles.
- **Icon style.** Line icons, 1.75px stroke, 24px grid, round caps/joins, ~2px
  corner radius — one consistent set (Lucide/Phosphor-line or a custom set in
  that language). No filled/duotone in-product; filled allowed only for tiny
  status dots. Icons are ink/slate by default, teal when active.
- **Illustration style.** Restrained, geometric, 2-tone (teal + slate) line-and-
  soft-fill "diagram" illustrations that explain the product (nodes, records,
  flows) — the *calm* of Headspace's palette, none of its characters. No mascots,
  no cartoon children.
- **Photography.** Optional and editorial: natural light, muted grade, real
  professionals in real settings, candid not staged-stocky, shallow depth. A
  cool-neutral color grade so photography sits beside teal without clashing.
  Education imagery must never dominate (it narrows the brand).
- **Brand voice.** Clear, warm, expert, economical. Short sentences. Verbs over
  adjectives. Say what the product does, not that it's "revolutionary AI."
  Respect professional judgment ("Elocin organizes what you write — it never
  puts words in your mouth"). Reading level: plain, ~grade 8. Never cutesy, never
  hypey, never clinical-cold.

---

## 10. UI motion principles

- **Purposeful & quick.** Durations 120–160ms (micro), 200–260ms (overlays),
  ≤400ms (page/section). Nothing decorative loops.
- **Easing.** Standard `cubic-bezier(.2,.8,.2,1)` for enter, `(.4,0,1,1)` for
  exit. Calm = ease-out, no bounce/overshoot.
- **Choreography.** Fade + 8–12px rise for entrances; scale 0.98→1 for modals;
  content settles, chrome stays still.
- **Respect `prefers-reduced-motion`:** drop transforms, keep opacity, disable
  loops. (Already the pattern in the current codebase.)

---

## 11. Accessibility (non-negotiable)

- Text contrast ≥ 4.5:1 (≥ 3:1 for ≥ 24px/700). Follow §2.5; prefer slate-600
  for small muted text.
- Visible focus on every interactive element (teal focus-ring), never
  `outline:none` without a replacement.
- Hit targets ≥ 44×44px on touch.
- Color never the sole signal — pair with icon/label/text.
- Full keyboard operability; logical focus order; focus trap + restore in modals.
- Semantic HTML + ARIA only where semantics fall short; live regions for toasts.
- Honor reduced-motion and dark-mode `color-scheme`.
- Charts: direct labels, patterns, and data-table fallbacks.

---

## 12. Dark mode palette

Not an inversion — a re-mapped, slightly desaturated set. Brand teal **lightens**
(teal-700 is too dark on dark), coral softens, shadows become near-invisible so
**borders + surface elevation carry hierarchy**.

| Role | Light | Dark |
|---|---|---|
| bg | #FCFCFB | #0B1220 |
| surface | #FFFFFF | #131C2B |
| surface-raised | #F8FAFC | #1B2536 |
| border | #E5E7EB | #26324A |
| text | #0F172A | #E6EAF2 |
| text-muted | #64748B | #94A3B8 |
| brand (actions/links) | #0F766E | #2DD4BF (teal-400) |
| brand-hover | #115E59 | #5EEAD4 |
| on-brand | #FFFFFF | #04231F |
| accent | #F97366 | #FB8A7B |
| success / warning / error / info | 500/600 | lighten one step (400/500) for text |
| focus-ring | teal .35 | `rgba(45,212,191,.4)` |

Dark elevation = lighter surface + 1px border (not shadow). Set
`color-scheme: dark` so form controls/scrollbars follow.

---

## 13. Surface directions

- **Homepage (marketing).** Warm-white canvas, one teal-anchored hero with a
  crisp product mock (browser frame, real UI, no gradients), a single coral
  accent (the primary CTA or one metric), generous 96px section rhythm, calm
  fade-up reveals. Trust > flash: logos, outcomes, a security line above the fold.
- **Dashboard.** Left sidebar (icon+label) + top bar. Content = a spacious grid
  of white cards on warm-white, 12px radius, hairline borders, `shadow-sm`. KPI
  row (4 stat cards, tabular numbers, one teal spark), then "needs attention"
  and recent-activity. Minimal chrome, ≤1 accent per view, lots of air. No
  gradient headers, no boxed-in density.
- **Mobile.** Single column, 16px gutters, 44px targets, bottom tab bar (≤5
  items) for primary nav, sheets instead of modals, sticky primary action.
  Tables collapse to stacked cards. Type scale drops one step; touch spacing up.
- **Marketing style guide.** Same tokens as product (proves the "seamless
  extension" principle), but one radius step larger (16px feature cards), more
  whitespace, optional editorial serif for display only, product mocks built
  from the *real* component library.

---

## 14. Migration, risks & alternatives

### 14.1 The elephant: this replaces a shipped identity
The live app + marketing site are **beige/sage/DM Sans + Lora**. This system is
**warm-white/teal/Inter**. Adopting it means editing `tailwind.config.js`,
`index.css`, `index.html` fonts, and every component's color/radius classes.
**Recommended path (phased, low-risk):**
1. Land tokens as CSS variables (`tokens.css`) and repoint Tailwind at the
   variables (semantic names, not hexes) — one PR, no visual change if variables
   still hold the old values.
2. Flip the variable values to the new palette + swap the font link. The whole
   app re-themes at once because components already reference semantic tokens.
3. Sweep the handful of hardcoded hexes (mockups, conference report `ti-*`).
4. Re-verify with screenshots (light + dark) exactly as the marketing build was.

### 14.2 Risks & mitigations
- **Teal-700 on white is 5.5:1 — fine, but teal *text* on teal-tinted surfaces
  can slip below AA.** Mitigation: use teal-800 for text on teal-50.
- **Coral is a contrast trap.** It fails white-text at 2.7:1. Mitigation: coded
  into rules — coral is accent/ink-text/non-text only; primary CTA stays teal.
  *Alternative:* if marketing wants a bolder CTA, use coral-700 fill + white
  (≈4.6:1) rather than coral-500.
- **Slate-500 muted text is borderline (4.7:1).** Mitigation: slate-600 for
  anything < 16px. *Alternative:* promote muted default to slate-600 globally.
- **Teal is having a moment (Linear-adjacent).** Risk of looking generic-SaaS.
  Mitigation: the *warm* white + coral warmth + restraint differentiate us.
  *Alternative:* shift primary to a deeper teal-800 for a more distinctive,
  "ink-teal" signature.
- **Losing the current warmth/personality.** The beige+serif identity is
  genuinely warm and memorable for teachers; pure teal/slate risks reading
  cold/corporate — the exact opposite of "human." Mitigations baked in: **warm**
  white (not cool gray), coral accent, rounded 10–12px, soft cool shadows.
  *Alternative:* keep a whisper of warmth by using a warm-neutral surface ramp
  (stone) instead of slate for backgrounds, reserving slate for text only.
- **Dropping Lora removes editorial character.** *Alternative:* keep one optional
  serif for marketing display only (documented in §3) so product stays minimal.
- **Cross-industry ambition vs. today's users.** A neutral teal identity is
  correct for the long game but slightly less immediately warm for preschool
  teachers. *Alternative:* vertical "skins" — same tokens, an optional accent
  swap per industry — but only if data shows it's needed (avoid premature
  theming complexity).

### 14.3 When *not* to adopt this
If near-term priority is preschool conversion and the beige/sage identity is
testing well, a rebrand is a distraction. This system pays off when Elocin
starts selling outside education. **Recommendation:** land the *token
architecture* now (semantic variables), defer the *palette flip* until the
multi-vertical push — you get the migration safety without betting the current
brand prematurely.

---

*Machine-readable tokens: `design-tokens.json` (Figma/Style Dictionary),
`tokens.css` (CSS custom properties, light+dark), `tailwind.tokens.cjs`
(Tailwind theme extension).*
