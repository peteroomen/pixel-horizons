# FOUNDRY Combat UI — Implementation Plan

**Date:** 2026-06-12
**Branch:** feature/foundry-ui
**Roadmap item:** Combat UI design system (visual pass over Slice 2.2/2.3 UI — UI-only, no sim changes)
**Spec source:** Claude Design "FOUNDRY" export (reproduced in full in this plan — implement from here, not from memory)

---

## 1. Summary

Replace the placeholder styling of the combat screen (HUD, card hand, buttons, outcome overlay) with the FOUNDRY design system: a chamfered-plate industrial language with a strict five-color semantic palette (orange = player, red = enemy, cyan = shields/discard, amber = warnings/malfunction, green = Bloom) and a two-font type system (Silkscreen for labels, VT323 for numbers and sentences).

**Hard constraints (do not violate):**

- **UI-only slice.** No changes to `src/game/sim/`, `src/game/data/`, `src/renderer/`, or `combat-view.ts` logic — the only permitted `combat-view.ts` change is the *additive* optional `CardView.infested?: boolean` field described in §6 (and it stays unset). React components keep consuming `CombatView` via callbacks per ADR 001.
- **No new libraries.** Everything here is CSS + React. `motion` stays unused (card-feel is slice 6.6). If you find yourself wanting a library, stop and write an ADR first.
- **No shadows, no border-radius, no elevation.** Layering is expressed by chamfer + border color only.
- **Touch-first.** Pointer/click handlers only (already true); hover effects are cosmetic extras, never load-bearing.
- All work in React components + `globals.css` + `layout.tsx`. PixiJS scene untouched.

**What "done" looks like:** the combat screen at 1920×1080 and 375×812 matches the spec values in this document; `pnpm lint`, `pnpm type-check`, `pnpm test` green (existing 142 tests must not change — they're sim-only and nothing here touches sim).

---

## 2. Design tokens

All tokens go in [src/app/globals.css](../../src/app/globals.css) inside the existing file. Use a real `@theme` block (NOT `@theme inline` — these are literal values, not var references). Prefix everything `fd-` to avoid colliding with the existing shadcn tokens (`--color-muted` already exists).

Add after the existing `@theme inline` block:

```css
/* ── FOUNDRY design tokens ─────────────────────────────────────────── */
@theme {
  /* Semantic palette — see docs/work/foundry-ui-plan.md §2 for usage rules */
  --color-fd-orange: #ff9e2c; /* THE PLAYER: hull bar, AP, End Turn, selected/active */
  --color-fd-orange-press: #d9821a; /* primary button pressed fill */
  --color-fd-red: #ff4757; /* THE ENEMY: HP bar, intent chip, incoming damage */
  --color-fd-cyan: #6ad1e3; /* shields + discard-mode selection */
  --color-fd-amber: #ffb454; /* warnings, armor, temp shields, malfunction, scrap */
  --color-fd-green: #8ac926; /* the Bloom ONLY — nothing mechanical is green */

  /* Neutrals */
  --color-fd-void: #0b0d18; /* scene background */
  --color-fd-plate: #16181d; /* plate fill */
  --color-fd-strip: #23262d; /* header strips, bar troughs */
  --color-fd-steel: #3a3e48; /* borders, dividers, normal card frames */
  --color-fd-muted: #9aa0ad; /* labels, secondary text */
  --color-fd-ink: #e8e6e0; /* primary text */
  --color-fd-ink-dark: #14151a; /* text on orange fills (buttons, AP chips) */

  /* Card-state fills (frame color × dark fill × header strip × body text) */
  --color-fd-card: #1a1c22; /* normal card fill */
  --color-fd-card-body: #c9cdd6; /* normal card body text */
  --color-fd-card-amber: #211a10; /* malfunction card fill */
  --color-fd-card-amber-header: #3a2c14;
  --color-fd-card-amber-body: #d9c79a;
  --color-fd-card-green: #131a0d; /* infested card fill */
  --color-fd-card-green-header: #1d2a12;
  --color-fd-card-green-body: #9ab886;
  --color-fd-card-cyan: #14242a; /* discard-mode card fill */
  --color-fd-card-cyan-header: #1c333a;

  /* Button armed state */
  --color-fd-armed: #2a2010; /* armed button fill */

  /* Type — fonts wired to next/font variables in layout.tsx (§8) */
  --font-label: var(--font-silkscreen), monospace; /* machine engraving — CAPS only */
  --font-readout: var(--font-vt323), monospace; /* machine readout — all numbers + sentences */

  /* Type ramp (desktop values; mobile uses responsive overrides, §9) */
  --text-fd-numeral: 32px; /* VT323 — hull, HP, big counts */
  --text-fd-numeral--line-height: 1;
  --text-fd-intent: 27px; /* VT323 — move names */
  --text-fd-intent--line-height: 1;
  --text-fd-readout: 24px; /* VT323 — counters, statuses */
  --text-fd-readout--line-height: 1.1;
  --text-fd-body: 22px; /* VT323 — card effect text, warnings (21–23px band) */
  --text-fd-body--line-height: 1.15;
  --text-fd-label: 15px; /* Silkscreen — labels, buttons (caps) */
  --text-fd-label--line-height: 1.2;
  --text-fd-tag: 12px; /* Silkscreen — state chips (11–13px band) */
  --text-fd-tag--line-height: 1.2;
}
```

These generate utilities automatically in Tailwind v4: `bg-fd-plate`, `border-fd-steel`, `text-fd-ink`, `font-label`, `font-readout`, `text-fd-numeral`, etc.

**Spacing:** base unit 4px — the default Tailwind scale already is 4px-based, so use standard utilities: plate padding `p-4` (16px), rows gap `gap-2.5` (10px), sibling plates gap `gap-3` (12px), screen inset `p-6` (24px desktop), hand cards gap `gap-3.5` (14px desktop). No new spacing tokens needed.

**Palette discipline (enforce in review):** orange never appears on enemy UI; red never on player resources; green only on Bloom content; amber is the only "broken/warning" color. The current code violates all of these (hull bar is `#4fc3f7` cyan, AP pips are `#e94560` red, enemy is `#e94560`) — every hardcoded hex in `src/components/` gets replaced (§10).

---

## 3. Chamfer utility

The chamfer is the brand: opposite corners only (top-left + bottom-right), cut with `clip-path`. Formula for chamfer size N:

```
polygon(Npx 0, 100% 0, 100% calc(100% - Npx), calc(100% - Npx) 100%, 0 100%, 0 Npx)
```

Add to `globals.css` as Tailwind v4 `@utility` definitions (so they compose with variants like `sm:chamfer-10`). Use a CSS-variable indirection so only one polygon is written:

```css
@utility chamfer {
  clip-path: polygon(
    var(--fd-chamfer) 0,
    100% 0,
    100% calc(100% - var(--fd-chamfer)),
    calc(100% - var(--fd-chamfer)) 100%,
    0 100%,
    0 var(--fd-chamfer)
  );
}
@utility chamfer-5 {
  --fd-chamfer: 5px;
}
@utility chamfer-6 {
  --fd-chamfer: 6px;
}
@utility chamfer-8 {
  --fd-chamfer: 8px;
}
@utility chamfer-10 {
  --fd-chamfer: 10px;
}
```

Usage: `chamfer chamfer-6 sm:chamfer-10` (the size utilities only set the variable, so they respond to breakpoints; `chamfer` applies the clip-path once).

**Two-layer plate construction** (every plate, card, and secondary button):

```html
<div class="chamfer chamfer-6 sm:chamfer-10 bg-fd-steel p-[2px]">
  <!-- outer = border layer -->
  <div class="chamfer chamfer-6 sm:chamfer-10 bg-fd-plate p-4">
    <!-- inner = fill -->
    ...content...
  </div>
</div>
```

Both layers use the **same** chamfer size — because the inner div is inset 2px by the outer padding, the cuts read as a uniform 2px chamfered border. `clip-path` clips normal borders, which is exactly why the border must be this padding layer, never `border-*`.

Chamfer sizes by element:

| Element                            | Desktop | Mobile |
| ---------------------------------- | ------- | ------ |
| Hero plates (PlayerPlate, EnemyPlate) | 10px    | 6px    |
| Cards, buttons, strips             | 8px     | 5px    |
| Cards (mobile)                     | —       | 5px    |

---

## 4. Component inventory

New directory `src/components/foundry/` for the design-system primitives; combat-specific plates stay in `src/components/`. None of these import from `src/game/` internals — they receive `CombatView` fragments as props (ADR 001 boundary unchanged; `import type` from `@/game/main` is the established, allowed pattern).

### Primitives (`src/components/foundry/`)

**`Plate.tsx`** — the two-layer chamfered container.

```ts
interface PlateProps {
  /** Frame (outer layer) color class. Default 'bg-fd-steel'. */
  frameClassName?: string;
  /** Fill (inner layer) classes — background + padding. Default 'bg-fd-plate p-4'. */
  fillClassName?: string;
  /** Chamfer utilities, e.g. 'chamfer-6 sm:chamfer-10'. Default 'chamfer-5 sm:chamfer-8'. */
  chamfer?: string;
  className?: string; // outer wrapper extras (width, pointer-events)
  children: React.ReactNode;
}
```

Renders the two-div construction from §3. Every other component composes this.

**`FoundryButton.tsx`** — replaces the 8bit Button inside combat (§10).

```ts
interface FoundryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary';
  /** Armed state (secondary only): orange border, dark fill, orange text. */
  armed?: boolean;
  /** Cost rendered inside the label, colored by resource. */
  cost?: { amount: number; resource: 'ap' | 'scrap' };
  children: React.ReactNode; // the label — component upcases via CSS, pass normal case
}
```

Specs (§ "BUTTONS" of the design spec):

- Common: `font-label text-fd-label uppercase`, chamfer 8px desktop / 5px mobile (`chamfer chamfer-5 sm:chamfer-8`), min hit target `min-h-11 sm:min-h-[52px]` (44px / 52px), horizontal padding `px-4`, `pointer-events-auto`.
- **Primary** (End Turn — the ONLY primary on the screen): single layer, `bg-fd-orange text-fd-ink-dark`, pressed `active:bg-fd-orange-press`. **No movement on press** — fill shifts darker only (the 8bit button's `active:translate-y-1` must NOT carry over).
- **Secondary**: Plate construction — steel frame, `bg-fd-plate` fill, `text-fd-ink` label. Hover (cosmetic only): frame brightens to `hover:bg-fd-muted` on the outer layer.
- **Armed** (secondary + `armed`): frame `bg-fd-orange`, fill `bg-fd-armed`, text `text-fd-orange`.
- **Disabled**: `disabled:opacity-40`, label still rendered, `disabled:pointer-events-none` on interactions but keep the element visible.
- **Cost**: rendered after the label inside the button, `font-readout` (numbers are never Silkscreen), `text-fd-orange` for AP / `text-fd-amber` for scrap. E.g. label `SLIPSTREAM` + cost span `1AP` in orange VT323.

**`StatBar.tsx`** — flat resource bar.

```ts
interface StatBarProps {
  value: number;
  max: number;
  /** Fill color class: 'bg-fd-orange' (hull) or 'bg-fd-red' (enemy HP). */
  fillClassName: string;
  className?: string; // width control
}
```

Trough: `h-3 bg-fd-strip` (12px tall), **no border**, no chamfer. Fill: flat color div, `width: pct%`, no transition (animation is 6.6). Replaces the current bordered 8px `Bar` in HUD.tsx.

### Combat components (`src/components/`)

**`CombatCard.tsx`** — extracted from CombatHand's inline button. Full spec in §6.

**`PlayerPlate.tsx`**, **`EnemyPlate.tsx`**, **`MetaStrip.tsx`**, **`ButtonBar.tsx`** — full specs in §7.

**`HUD.tsx`** — becomes a thin layout orchestrator composing the four above (keeps its current props interface so `page.tsx` barely changes).

**`CombatHand.tsx`** — keeps its props; body becomes a map over `CombatCard`.

**`page.tsx`** — outcome overlay restyle + FoundryButton (§10).

---

## 5. Implementation order

1. **Fonts** — `layout.tsx`: add Silkscreen + VT323 via `next/font/google` (§8). Verify both render via a throwaway class on the page, then remove it.
2. **Tokens + chamfer utilities** — `globals.css` per §2 and §3. Nothing visible changes yet.
3. **`Plate.tsx`** — build, then temporarily wrap the existing player HUD block to verify the chamfer renders correctly at both breakpoints (top-left + bottom-right cuts only).
4. **`FoundryButton.tsx` + `StatBar.tsx`** — primitives complete.
5. **`CombatCard.tsx`** — all 5 states (§6). Verify with the dev knobs: normal/unaffordable always visible; malfunction by letting the Lamprey/Parasite hit modules; discard mode via Slipstream (`?hull=` knob — see [2026-06-11-malfunctions.md](2026-06-11-malfunctions.md) for the hull ids); infested via a temporary hardcoded `infested: true` on one card in `CombatHand` (remove before commit).
6. **`CombatHand.tsx`** — swap inline buttons for `CombatCard`, new sizing/gaps (§6 layout).
7. **`PlayerPlate` / `EnemyPlate`** — §7; gut HUD.tsx's top block.
8. **`MetaStrip` / `ButtonBar`** — §7; gut HUD.tsx's bottom block; fix the hand-clearance offsets (§10).
9. **`HUD.tsx` final form** — orchestrator only.
10. **`page.tsx`** — outcome overlay + buttons.
11. **Mobile pass** — 375×812 layout per §9; fix any text overflow (card names like "Damaged Static Lance" are the stress case at Silkscreen 6px).
12. **Cleanup** — grep `src/components` for leftover hex colors and `retro` classes (§10); `pnpm lint && pnpm type-check && pnpm test`.
13. **Manual test steps** (§11), screenshots, PR.

---

## 6. CombatCard spec

File: `src/components/CombatCard.tsx`.

```ts
type CardState = 'normal' | 'malfunction' | 'infested' | 'discard';

interface CombatCardProps {
  card: CardView; // from '@/game/main' (type-only import)
  state: CardState; // derived by CombatHand, see below
  disabled: boolean; // !selectable — discard mode overrides affordability
  onClick: () => void;
}
```

**State derivation in CombatHand** (priority order):
`discardMode` → `'discard'`; else `card.infested` → `'infested'`; else `card.malfunction` → `'malfunction'`; else `'normal'`. Unaffordable is NOT a state — it's an orthogonal opacity modifier: when `!discardMode && !card.affordable`, the whole card gets `opacity-40` regardless of state. `disabled = !(discardMode || card.affordable)`.

**`CardView.infested`:** add `infested?: boolean` to `CardView` in [combat-view.ts](../../src/game/combat-view.ts) as an optional field that `buildCombatView` never sets yet (Bloom infestation cards are a later slice). This is the one permitted `combat-view.ts` touch — additive, type-only in effect, no test changes. The styling ships now so the Bloom slice only flips a bit.

**Geometry:**

- Desktop (sm+): `w-[200px] h-[210px]`, hand gap 14px (`sm:gap-3.5`).
- Mobile: five equal columns — `flex-1 basis-0 min-w-0 h-[142px]`, gap 5px (`gap-[5px]`), full-bleed width (~66px/card at 375px).
- Chamfer: `chamfer chamfer-5 sm:chamfer-8`, frame border 2px (Plate construction).

**Anatomy (top to bottom inside the fill layer):**

1. **Header strip** — full-width row, background per state (below), padding `px-1.5 py-1 sm:px-2 sm:py-1.5`. Left: name, `font-label uppercase`, `text-[6px] sm:text-[10px]` (Silkscreen mobile floor is 6px; never below), `min-w-0 [overflow-wrap:anywhere] leading-tight`, color per state. Right: **AP cost square** — `shrink-0 size-4 sm:size-6 bg-fd-orange text-fd-ink-dark font-readout text-[12px] sm:text-[18px] text-center` (orange chip, ink numeral, VT323 — numbers never Silkscreen). **Omitted entirely in `infested` state.**
2. **Body** — effect text, `font-readout text-[12px] sm:text-fd-body` (VT323 22px desktop / 12px mobile), sentence case (use `card.text` as-is), color per state, `p-1.5 sm:p-2`.
3. **Footer tags** — pinned to bottom (`mt-auto`), `font-label uppercase text-[6px] sm:text-[10px]`, max 2 tags, gap 4px:
   - `EXHAUST` → `text-fd-muted` (shown when `card.exhaust`)
   - `MALFUNCTION` → `text-fd-amber` (state = malfunction)
   - `INFESTED` → `text-fd-green` (state = infested)
   - `TAP TO DISCARD` → `text-fd-cyan` (state = discard — replaces other tags if it would exceed 2; priority: state tag first, EXHAUST second)

**The frame color IS the state signal.** Per-state values:

| State           | Frame (outer)  | Fill            | Header strip               | Name text     | Body text             |
| --------------- | -------------- | --------------- | -------------------------- | ------------- | --------------------- |
| 1. NORMAL       | `bg-fd-steel`  | `bg-fd-card` (#1a1c22) | `bg-fd-strip` (#23262d)    | `text-fd-ink` | `text-fd-card-body` (#c9cdd6) |
| 2. UNAFFORDABLE | (state colors) | (state colors)  | (state colors)             | (state)       | (state) — whole card `opacity-40` |
| 3. MALFUNCTION  | `bg-fd-amber` (#ffb454) | `bg-fd-card-amber` (#211a10) | `bg-fd-card-amber-header` (#3a2c14) | `text-fd-amber` | `text-fd-card-amber-body` (#d9c79a) |
| 4. INFESTATION  | `bg-fd-green` (#8ac926) | `bg-fd-card-green` (#131a0d) | `bg-fd-card-green-header` (#1d2a12) | `text-fd-green` | `text-fd-card-green-body` (#9ab886) — **no AP chip** |
| 5. DISCARD MODE | `bg-fd-cyan` (#6ad1e3) | `bg-fd-card-cyan` (#14242a) | `bg-fd-card-cyan-header` (#1c333a) | `text-fd-ink` (normal) | `text-fd-card-body` |

Interaction: keep the existing CSS-only hover lift (`hover:-translate-y-2 active:-translate-y-1` on selectable cards) — it's cosmetic and already pointer-safe; the real card-feel pass is 6.6. The card root stays a `<button type="button">` for free hit-testing and keyboard access.

Implementation note: don't force this through the generic `Plate` if it fights you — a card-local two-layer construction with a small `STATE_STYLES: Record<CardState, {...}>` lookup is clearer than threading five class fragments through props. Either way, the two-layer chamfer pattern from §3 is mandatory.

---

## 7. HUD plate components

All four live in `src/components/`, receive slices of `CombatView` as props, no game imports. Reading-order hierarchy the layout must express: **1st** enemy intent + AP pips → **2nd** hull/HP numerals + bars → **3rd** shields/armor/warnings → **last** the meta strip.

### PlayerPlate (top-left)

```ts
interface PlayerPlateProps {
  view: CombatView; // uses hullHp, hullMaxHp, shields, tempShieldLayers, ap, apPerTurn, modules
}
```

Hero plate: `Plate` with `chamfer-6 sm:chamfer-10`, fill `bg-fd-plate p-2.5 sm:p-4`, rows `space-y-1.5 sm:space-y-2.5` (10px row gap desktop). Content top-to-bottom:

1. **Hull row**: label `HULL` (`font-label text-[8px] sm:text-fd-label text-fd-muted uppercase`) + numeral `{hullHp}/{hullMaxHp}` (`font-readout text-[18px] sm:text-fd-numeral text-fd-ink`). Baseline-aligned flex row, label left, numeral right.
2. **Hull bar**: `StatBar` with `fillClassName="bg-fd-orange"` — **orange, the player color** (currently cyan; that dies).
3. **AP row**: label `AP` (muted Silkscreen) + pips: `Math.max(apPerTurn, ap)` squares, `size-2.5 sm:size-3`; filled = `bg-fd-orange` (currently red; dies), empty = `bg-fd-strip` (no border — flat trough color). High in the hierarchy: keep directly under the hull bar.
4. **Shields row**: label `SHLD` mobile / `SHIELDS` desktop (`<span class="sm:hidden">SHLD</span><span class="hidden sm:inline">SHIELDS</span>`, muted Silkscreen). Squares `size-3` (12px both breakpoints per spec): up = `bg-fd-cyan`; down = `bg-fd-strip` with the recharge countdown centered in `font-readout text-[10px] text-fd-muted`; temp layers = `bg-fd-amber` (amber = temp shields per palette). "none" placeholder: `font-readout text-fd-muted`.
5. **Warnings**: one line per malfunctioning module: `⚠ {NAME} OFFLINE`, `font-readout text-[13px] sm:text-fd-body text-fd-amber`.

### EnemyPlate (top-right)

```ts
interface EnemyPlateProps {
  view: CombatView; // uses enemyName, enemyHp, enemyMaxHp, intent
}
```

Hero plate, same construction, content right-aligned on desktop:

1. **Name + HP row**: name (`font-label text-[8px] sm:text-fd-label text-fd-muted uppercase`) + numeral `{enemyHp}/{enemyMaxHp}` (`font-readout text-[18px] sm:text-fd-numeral text-fd-ink`).
2. **HP bar**: `StatBar` `fillClassName="bg-fd-red"`.
3. **Intent chip — fused directly under the HP bar, zero gap** (intent is 1st in the reading hierarchy; the fusion is the point). Full plate width, `chamfer chamfer-5 sm:chamfer-8`:
   - Revealed: `bg-fd-red text-fd-ink-dark`, content = Silkscreen tag `INTENT` (`font-label text-[6px] sm:text-fd-tag`) + the move in `font-readout text-[13px] sm:text-fd-intent` (VT323 27px): `{name} {amount}{hits>1 ? '×'+hits : ''}{piercing ? ' PIERCE' : ''}{targetsModule === 'highest-value' ? ' → BEST MODULE' : targetsModule === 'random' ? ' → RANDOM MODULE' : ''}`.
   - Hidden (`intent === null`): `bg-fd-strip text-fd-muted`, readout `???`. (Deep Scan reveal economy unchanged — presentation only.)

### MetaStrip (above the hand, bottom-left) — "last" in hierarchy, keep it quiet

```ts
interface MetaStripProps {
  view: CombatView; // turn, drawCount, discardCount, travelProgress, scrapGained, innate (passive label)
}
```

No plate — bare text block (quiet). `font-readout text-[12px] sm:text-fd-readout text-fd-muted`. Two lines (mobile spec; fine on desktop too):

- Line 1: `TURN {turn} · DRAW {drawCount} · DISCARD {discardCount}`
- Line 2 (only parts that apply): `TRAVEL +{travelProgress}` · `SCRAP +{scrapGained}` in `text-fd-amber` (scrap = amber) · passive innate label `{NAME} · PASSIVE`.

### ButtonBar (above the hand, bottom-right)

```ts
interface ButtonBarProps {
  view: CombatView; // innate, outcome
  onEndTurn: () => void;
  onInnate: () => void;
  innateArmed: boolean;
}
```

- Innate button (when `!innate.passive`): `FoundryButton variant="secondary"`, `armed={innateArmed}`, `disabled={!innate.usable}`, label = `innateArmed ? 'PICK A CARD…' : innate.name`, `cost={innate.apCost > 0 ? { amount: innate.apCost, resource: 'ap' } : undefined}`, `title={innate.description}`.
- End Turn: `FoundryButton variant="primary"`, `disabled={outcome !== 'ongoing'}`. The only primary on screen.
- Layout: desktop `flex-row gap-3 items-end`; mobile `flex-col gap-2.5 items-end` with **End Turn last/bottom** (closest to thumb). Current DOM order already does this — keep it.

### HUD.tsx (orchestrator)

Keeps its existing props (`view`, `onEndTurn`, `onInnate`, `innateArmed`). Renders:

```
top:    absolute inset-x-0 top-0  p-2 sm:p-6   → grid grid-cols-2 gap-3 items-start
          <PlayerPlate/> <EnemyPlate/>
bottom: absolute inset-x-0 px-2 sm:px-6, bottom = hand clearance (§10)
          flex justify-between items-end → <MetaStrip/> <ButtonBar/>
```

Mobile: the same `grid-cols-2` gives both plates side-by-side at equal width (spec). Screen inset: 24px desktop (`p-6` replaces the current `p-4`), 8px mobile (phones can't afford 24px). Plates `pointer-events-none` except buttons (`pointer-events-auto` lives on FoundryButton).

---

## 8. Font loading

[src/app/layout.tsx](../../src/app/layout.tsx) — extend the existing `next/font/google` setup (self-hosted by Next, no FOUC, no external request):

```tsx
import { Geist, Geist_Mono, Silkscreen, VT323 } from 'next/font/google';

const silkscreen = Silkscreen({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-silkscreen',
});

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323',
});
```

Add `${silkscreen.variable} ${vt323.variable}` to the `<html>` className alongside the Geist variables. The `@theme` block (§2) maps them to `font-label` / `font-readout` utilities.

**Press Start 2P is retired from the UI shell** (logo only, and there's no logo yet): combat components must not use the `.retro` class. Leave [retro.css](../../src/components/ui/8bit/styles/retro.css) and the 8bit button files in place — they're imported by `ui/8bit/button.tsx` which other future screens may still use — but after this slice nothing in the combat path imports them (§10 has the list).

Font rules, enforced everywhere: Silkscreen = labels/names/buttons/tags, ALWAYS uppercase (use the `uppercase` utility — don't upcase strings in JS), never below 8px desktop / 6px mobile floor. VT323 = every number and every sentence, never below 16px desktop / 12px mobile. **No numeral ever renders in Silkscreen** — AP costs, HP, counts are all `font-readout`.

---

## 9. Responsive strategy

One breakpoint: Tailwind's `sm:` (640px). Below it = the 375×812 mobile spec; at/above = the 1920×1080 desktop spec. This matches the codebase's existing convention (everything already uses `sm:`). Mobile-first: base classes are the mobile values, `sm:` overrides to desktop.

| Aspect          | Mobile (base)                                   | Desktop (`sm:`)                       |
| --------------- | ----------------------------------------------- | ------------------------------------- |
| Scene           | full-bleed canvas, plates float over it         | same                                  |
| Screen inset    | `p-2` (8px)                                     | `p-6` (24px)                          |
| Top plates      | side-by-side, equal width (`grid-cols-2 gap-3`) | same grid, plates size to content via max-width if needed |
| Hero chamfer    | 6px                                             | 10px                                  |
| Card chamfer    | 5px                                             | 8px                                   |
| Cards           | 5 equal flex columns, 5px gaps, 142px tall (~66px wide at 375px) | `w-[200px] h-[210px]`, 14px gaps, centered |
| Buttons         | stacked vertically, right-aligned, End Turn at bottom | row, right-aligned                    |
| Meta strip      | two lines, bottom-left                          | same position                         |
| SHIELDS label   | `SHLD`                                          | `SHIELDS`                             |
| Shield squares  | 12px (`size-3`)                                 | 12px (`size-3`)                       |
| Numerals        | VT323 18px                                      | VT323 32px                            |
| Body/warnings   | VT323 12px / 13px                               | VT323 22px                            |
| Card names      | Silkscreen 6px                                  | Silkscreen 10px                       |
| Labels/buttons  | Silkscreen 8px                                  | Silkscreen 15px                       |
| Tags            | Silkscreen 6px                                  | Silkscreen 10–12px                    |
| Hit targets     | min 44px                                        | min 52px                              |

Type floors are absolute: if something doesn't fit at the floor size, fix the layout (wrap, truncate, abbreviate like SHLD), never shrink the type further.

Hand container ([page.tsx](../../src/app/page.tsx)): replace `max-w-2xl` with mobile `w-full px-1 gap-[5px]` / desktop `sm:w-auto sm:gap-3.5` (5 × 200px + 4 × 14px = 1056px, centered — fits 1920 with room).

---

## 10. Migration notes

**Hardcoded hexes to kill** (grep `#` in `src/components/*.tsx` after the pass — the only hexes left should be none):

| Current                                   | Where                  | Becomes                                  |
| ----------------------------------------- | ---------------------- | ---------------------------------------- |
| `#4fc3f7` hull bar fill                    | HUD `Bar`              | `bg-fd-orange` (hull = player = orange)  |
| `#4fc3f7` shield squares / armed ring / victory text | HUD, page.tsx | `fd-cyan` (shields, discard); victory text → `text-fd-orange` (player wins = player color) |
| `#e94560` AP pips                          | HUD                    | `bg-fd-orange`                           |
| `#e94560` enemy bar / intent / defeat text | HUD, page.tsx          | `fd-red`                                 |
| `#e94560` AP cost chip / exhaust tag       | CombatHand             | chip `bg-fd-orange text-fd-ink-dark`; tag `text-fd-muted` |
| `#ffd166` malfunction amber                | HUD, CombatHand        | `fd-amber` (#ffb454)                     |
| `#101024` / `#241410` card fills           | CombatHand             | `fd-card` / `fd-card-amber`              |
| `#050508` page background                  | page.tsx `<main>`      | `bg-fd-void` (#0b0d18)                   |
| `border-white/*`, `text-white/*` washes    | everywhere             | `fd-steel` borders, `fd-ink`/`fd-muted` text |

**Other removals/replacements:**

- `retro` class: gone from HUD, CombatHand, page.tsx (replaced by `font-label`/`font-readout`). `ui/8bit/button.tsx` import disappears from combat files entirely — combat uses `FoundryButton`. Don't delete the 8bit files.
- HUD `Bar` helper → `StatBar` (12px trough, no border; old one was 8px bordered).
- The 8bit button's `active:translate-y-1`: FoundryButton must NOT replicate it — spec says pressed = darker fill, **no movement**.
- Outcome overlay (page.tsx): keep the `bg-black/70` scrim concept but restyle: `VICTORY` in `font-label text-fd-orange`, `DEFEAT` in `font-label text-fd-red`, buttons → `FoundryButton variant="primary"`. (Exception to one-primary-per-screen: the overlay replaces the screen, End Turn is disabled beneath it.)
- **Hand clearance offsets**: HUD's bottom block currently sits at `bottom-32 sm:bottom-36` to clear a ~112px hand. New hand heights: 142px mobile / 210px desktop. New offsets: `bottom-[158px] sm:bottom-[242px]` (hand height + hand's bottom inset + 8px breathing room — tune by eye at both sizes, this is the one place magic numbers are acceptable; comment why).
- The pixel-corner decorations the 8bit button drew (all those absolute divs) have no FOUNDRY equivalent — chamfer replaces them; nothing to port.
- Don't touch: `pixelated` utility, `pixel-scale.ts`, anything in `src/game/` or `src/renderer/`, the shadcn `:root`/`.dark` token blocks (the base `ui/button.tsx` still consumes them).

---

## 11. Test plan

**Automated (must stay green, no new failures):** `pnpm lint`, `pnpm type-check`, `pnpm test`. The 142 Vitest tests are sim/view-level and touch nothing here; the `CardView.infested?` addition is optional so `combat-view.test.ts` compiles unchanged. **Do not add a component-testing library** (RTL/jsdom/Playwright) — that needs an ADR and is out of scope; visual verification is manual this slice.

**Manual test steps (also = the plan-file checklist):**

Desktop (1920×1080 viewport, `pnpm dev`):

- [ ] Combat loads: two hero plates top (player left, enemy right), chamfered 10px on top-left + bottom-right corners ONLY, 2px steel border via the two-layer construction (zoom in and check the corner cut is clean on both layers).
- [ ] Hull bar fill is orange #ff9e2c; AP pips orange; nothing red on the player plate. Enemy bar red #ff4757; nothing orange on the enemy plate.
- [ ] Intent: hidden shows a strip-colored chip with `???`; play Deep Scan → chip turns red with the move name in VT323 ~27px, fused (no gap) under the HP bar.
- [ ] Hand: 5 cards at 200×210, 14px gaps. Names in Silkscreen caps; effect text in VT323 ~22px sentence case; AP chip orange square with VT323 ink numeral.
- [ ] Spend AP until a card is unaffordable → whole card at 40% opacity, layout unchanged.
- [ ] Let the enemy break a module (Lamprey volley or Parasite) → flipped card shows amber frame #ffb454, dark amber fill, amber name, `MALFUNCTION` tag; playing it at 1 AP repairs (sim behavior unchanged).
- [ ] `?hull=` Slipstream hull: arm the innate → button goes armed (orange border, dark fill, orange text); every card gets cyan frame + `TAP TO DISCARD` tag; tap discards and draws; mode clears.
- [ ] End Turn: orange fill, ink text, press shows darker orange with NO movement; disabled (after victory) drops to 40% opacity but stays labeled.
- [ ] Win and lose a fight: VICTORY orange / DEFEAT red, overlay buttons work.
- [ ] Edge: malfunction a module AND drop to 0 AP → flipped card is amber-framed AND 40% opaque (state + affordability compose).

Mobile (375×812 via responsive devtools or `preview_resize`):

- [ ] Plates side-by-side, equal width, 6px chamfer; SHIELDS reads SHLD; shield squares still 12px.
- [ ] Hand: 5 equal columns, 5px gaps, 142px tall, no horizontal scroll, no text escaping the 5px-chamfered frame at Silkscreen 6px names (stress: "DAMAGED STATIC LANCE").
- [ ] Buttons stacked vertically, right-aligned, End Turn bottom-most; both ≥ 44px tall; thumb-reachable above the hand.
- [ ] Meta strip: two lines, bottom-left, doesn't collide with the button stack.
- [ ] Edge: 5 malfunction warnings (dev-force) don't push the player plate into the hand.

**Proof for the PR:** screenshots at both sizes (Claude Preview `preview_screenshot` after `preview_resize`), one per: normal hand, malfunction card, discard mode, hidden + revealed intent, outcome overlay.

---

## 12. Files to create / modify

**Create:**

| Path                                   | What                                          |
| -------------------------------------- | --------------------------------------------- |
| `src/components/foundry/Plate.tsx`     | Two-layer chamfered plate primitive (§4)      |
| `src/components/foundry/FoundryButton.tsx` | Primary/secondary/armed/disabled button (§4) |
| `src/components/foundry/StatBar.tsx`   | 12px flat trough/fill bar (§4)                |
| `src/components/CombatCard.tsx`        | 5-state card (§6)                             |
| `src/components/PlayerPlate.tsx`       | Hull/shields/AP/warnings hero plate (§7)      |
| `src/components/EnemyPlate.tsx`        | Name/HP/intent-chip hero plate (§7)           |
| `src/components/MetaStrip.tsx`         | Quiet counters strip (§7)                     |
| `src/components/ButtonBar.tsx`         | Innate + End Turn (§7)                        |

**Modify:**

| Path                          | Change                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| `src/app/globals.css`         | `@theme` fd-tokens + `@utility chamfer*` (§2, §3)             |
| `src/app/layout.tsx`          | Silkscreen + VT323 via next/font (§8)                         |
| `src/components/HUD.tsx`      | Becomes orchestrator of the four plates; old Bar/markup deleted (§7) |
| `src/components/CombatHand.tsx` | Maps to CombatCard; new sizing/gaps; state derivation (§6)  |
| `src/app/page.tsx`            | `bg-fd-void`, hand container sizing, outcome overlay, FoundryButton (§10) |
| `src/game/combat-view.ts`     | ONLY the additive `infested?: boolean` on `CardView` (§6)     |

**Do not touch:** `src/game/sim/**`, `src/game/data/**`, `src/game/main.ts`, `src/renderer/**`, `src/components/GameCanvas.tsx`, `src/components/ui/**` (8bit + shadcn files stay as-is, just unused by combat), all tests.

**Process (CLAUDE.md):** branch `feature/foundry-ui`; `nvm use 22` before anything; this plan file gets its "What actually happened / Files / Deferred / Status" sections filled in post-session; update CLAUDE.md Current State; conventional commit (`feat: FOUNDRY combat UI — chamfered plates, semantic palette, Silkscreen/VT323 type`); PR. No ADR needed (no new library, no architecture change — this implements a design spec within ADR 001's boundaries), unless you deviate.

## Out of scope for this session (implementation session: do not do these)

- Card animations / flip / draw / fan — slice 6.6 (`motion` stays unused).
- Wiring `infested` to real Bloom card data — future Bloom slice.
- Armor display (spec mentions amber armor; no armor exists in `CombatView` yet — `strip-armor` throws until Carapace, 2.5).
- Restyling anything outside combat (there is nothing else yet).
- Component-test infrastructure (needs an ADR).
- Logo / Press Start 2P usage.

---

<!-- Fill in below during/after the implementation session -->

## What actually happened

Implemented exactly as planned — no deviations. All design tokens, chamfer utilities, fonts, primitives (Plate, FoundryButton, StatBar), combat components (CombatCard with 5 states, PlayerPlate, EnemyPlate, MetaStrip, ButtonBar), HUD orchestrator, and page.tsx restyling landed in one pass. `CardView.infested?: boolean` added to combat-view.ts (additive, unset). All hardcoded hex colors removed from combat components; `retro` class and 8bit Button imports eliminated from the combat path. 233 tests pass, lint and type-check clean.

Manually verified at desktop (1280×800) and mobile (375×812): chamfered plates with correct corner cuts, orange hull bar + AP pips, red enemy bar, cyan shields, amber temp shields + malfunction warnings, intent chip fused under HP bar, Silkscreen labels (uppercase), VT323 numerals + body text, 5-state cards (normal, unaffordable opacity, malfunction amber, discard cyan with TAP TO DISCARD, infested green placeholder), armed Slipstream button, End Turn primary button (orange, no translate on press), VICTORY/DEFEAT/ARRIVED outcome overlays with FoundryButton.

## Files created / modified

**Created:**
- `src/components/foundry/Plate.tsx`
- `src/components/foundry/FoundryButton.tsx`
- `src/components/foundry/StatBar.tsx`
- `src/components/CombatCard.tsx`
- `src/components/PlayerPlate.tsx`
- `src/components/EnemyPlate.tsx`
- `src/components/MetaStrip.tsx`
- `src/components/ButtonBar.tsx`

**Modified:**
- `src/app/globals.css` — FOUNDRY @theme tokens + @utility chamfer definitions
- `src/app/layout.tsx` — Silkscreen + VT323 via next/font/google
- `src/components/HUD.tsx` — rewritten as thin orchestrator
- `src/components/CombatHand.tsx` — maps to CombatCard, new sizing/gaps
- `src/app/page.tsx` — bg-fd-void, FoundryButton, outcome overlay restyle
- `src/game/combat-view.ts` — additive `infested?: boolean` on CardView

## Deferred to next session

- Card animations / flip / draw / fan — slice 6.6 (`motion` stays unused)
- Wiring `infested` to real Bloom card data — future Bloom slice
- Armor display (no data source yet — `strip-armor` throws until Carapace 2.5)
- Component-test infrastructure (needs an ADR)

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
