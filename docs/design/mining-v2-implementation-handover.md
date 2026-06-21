# Mining Run v2 — Implementation Handover

> **Source prototype**: `docs/design/mining-run-v2.dc.html` (601 lines, canvas-based working prototype)
> **ADR**: `docs/decisions/adr-003-breakout-surface-loop.md`

This document describes the v2 Mining Run design that needs to be ported into the existing PixiJS + React game architecture. The prototype is a fully working canvas game — every mechanic, sprite, and layout is implemented and tested. Your job is to port it into the existing surface loop code.

---

## What the Prototype Contains (port all of this)

### 1. Formation System (6 types with distinct pixel-art silhouettes)

Each formation type has a unique **shape** so it reads at gameplay zoom by silhouette alone.

| Formation | Shape | Outline Color | HP | Drops |
|-----------|-------|---------------|-----|-------|
| **mineral** (Biomineral Cluster) | Rounded rectangular slab 14x13px | Green `#8ac926` | 1 | Biominerals |
| **hard** (Scrap Deposit) | Angular steel slab 14x12px, rivet dots | Steel `#9aa0ad` | 1 | Scrap |
| **ore** (Dense Vein) | Long horizontal bar 24x10px | Amber `#ffb454` | 3 | Biominerals (drops per hit + on break) |
| **crystal** (Core Crystal) | Diamond shape 16x16px | Cyan `#6ad1e3` | 4 | Core Crystal |
| **rock** (Inert Rock) | Triangle/wedge 15x13px | None (dead rock, uses `#2e222f` edge) | 2 | Nothing |
| **bloom** (Bloom Hazard) | Fleshy magenta sac 16x16px, pulsing | Magenta `#ff5ca0` | 99 (indestructible) | Nothing — SWALLOWS non-Ghost balls |

**Damage stages**: Each formation type has `ST[type]` stages (1-3). Sprite is re-rendered per stage showing progressive cracks. See `_makePeg()` in prototype.

**Weight rules** (critical for game feel):
- Squash-dent on hit: compress along impact direction (22% scale reduction along impact axis)
- Grid jiggle: nearby formations shift 1-2px when an adjacent one breaks (radius 22px)
- Hit flash: white overlay for 0.14s on contact
- Break sequence: 90ms hit-stop → screen shake → 5-8 beveled shards with gravity + drag + one bounce

### 2. Ball System (5 types with distinct silhouettes)

| Ball | Sprite Size | Silhouette | Bounces | Speed | Damage | Special |
|------|-------------|-----------|---------|-------|--------|---------|
| **standard** | 10x10 | Smooth round | 8 | 2.0 | 1 | Baseline |
| **heavy** | 13x13 | Larger circle + rivet studs at cardinals | 5 | 1.6 | 2 | Visibly bigger |
| **split** | 11x10 | Two half-spheres with seam gap | 6 | 2.0 | 1 | Forks into 2 on first hit |
| **drill** | 8x13 | Elongated pointed (NOT circular) | 4 | 2.3 | 1 | Passes through formations (no deflection), except rock |
| **ghost** | 11x11 | Translucent, dashed outline, null edge | 10 | 1.9 | 1 | Phases through bloom hazards, rendered at 55% alpha |

**Ball colors** (from `_ballColors()`):
- standard: body `#e6904e`, lite `#fbb954`, core `#fbff86`, acc `#ff9e2c`
- heavy: body `#cd683d`, lite `#e6904e`, core `#ffb454`, acc `#ff9e2c`
- split: body `#9aa6c9`, lite `#dbe2f2`, core `#ffffff`, acc `#aab6e0`
- drill: body `#239aa6`, lite `#6ad1e3`, core `#8ff8e2`, acc `#6ad1e3`
- ghost: body `#1f5a52`, lite `#0b8a8f`, core `#8ff8e2`, acc `#30e1b9`

**Visual states**:
- Spent balls render at 45% alpha
- Ghost balls always at 55% alpha
- Bounce countdown warning at ≤2 bounces: fast pulse between full and 40% alpha + warning ring pixels at cardinals
- Trail: last 7 positions drawn as accent-color pixels

### 3. Field Layout (Peglin-style top-drop)

Balls drop from a ceiling rig, NOT from the bottom. Dense staggered grid of pegs (8 cols x 9 rows, staggered every other row). See `_layout()`.

Key dimensions (prototype uses 125x194 logical pixels):
- Field top: y=32 (below ceiling rig)
- Field bottom: y=150
- Margins: x=15 to x=110
- Pod sits at y=178

Layout includes:
- Dense mineral/hard/rock pegs in staggered grid (8% chance to skip for variety)
- 3 Dense Vein bars at strategic positions
- 3 Bloom hazards threatening central lanes
- 1 Core Crystal at bottom center, funneled by 4 rock wedges

### 4. Physics & Collision

- Gravity: 0.0085 per frame
- Spent balls fall faster: gravity × 2.6
- Speed cap: 2.9
- Wall bounce: velocity × 0.94
- 3 sub-steps per frame for collision accuracy
- Ore bars use box collision (ABAR: hw=10, hh=3.5), all others use circular collision (RAD table)
- Crystal adds random angle perturbation on bounce (±0.5)
- Split ball forks on first formation hit (cap: 6 total balls)
- Drill passes through formations (no deflection) except rock
- Ghost passes through bloom hazards
- Balls ALWAYS damage formations regardless of spent status — bounce budget governs catch-value, not mining ability

### 5. Pod (Bottom Catcher) & Rig (Top Launcher)

**Pod** (bottom, y=178): Dual role — catches minerals AND catches balls.
- Bay width: 12px (or 15px with wideBay prop)
- Scoop teeth on rim (4 vertical bars) — reads as catcher
- Fill indicator (green bar grows with caught minerals)
- Catch flash: colored ring for 0.16-0.22s (orange=ball caught, green=mineral caught, steel=spent ball caught, red=ball missed, magenta=bloom swallow)
- Collective color ramp for pod body: LT=#92a984, MD=#547e64, DK=#374e4a, chassis=#3a3e48

**Rig** (top, y=13): Ceiling launcher.
- Mounted at the ceiling breach point
- Aperture rotates to show aim direction during drag
- Pulse glow when loaded (cyan)

### 6. Aim & Fire Mechanic

- Drag on canvas during `aim` phase to set trajectory
- Aim direction: from rig position toward pointer, clamped to downward (dy ≥ 0.25)
- Power: based on drag distance (max at 72px), affects speed multiplier (0.7 + power × 1.05)
- Trajectory preview: dotted line showing projected path with configurable bounce count (default 2), stops on formation hit (yellow cross)

### 7. Catch/Re-launch Mechanic

When pod catches a ball with bounces remaining:
- Player re-aims and re-fires with remaining bounce budget
- Caught ball gives +2 scrap bonus
- Spent ball catch gives +1 scrap
- If ball falls off bottom without being caught → ball lost, next ball loads

### 8. Reprint System

Spend escalating Scrap to re-fire a spent Standard ball:
- 1st: 2 Scrap, 2nd: 5 Scrap, 3rd: 10 Scrap
- Maximum 3 reprints per run

### 9. HUD Layout

**Header** (top, h=60px): Two FOUNDRY-style chamfered panels:
- Left: Biome name + countdown timer (3:00, VT323 font)
- Right: Haul counters — Scrap (grey square), Biominerals (green pentagon), Core (cyan diamond)

**Roster Tray** (bottom, h=170px): FOUNDRY panel containing:
- Armed ball: 48x48 preview + name + bounce pips (4x7px bars, orange=remaining, dark=spent)
- Queue: 3 upcoming ball previews (30x30) + overflow count
- Reprint button (orange) + Return to Orbit button (steel)

### 10. Intro Cinematic (4 phases, ~3.7s total)

1. **Orbit** (0-1s): Starfield + planet from ramp colors + mothership + docked pod
2. **Fall** (1-2s): Pod separates, falls toward planet, engine trail
3. **Burn** (2-2.4s): Atmosphere entry, screen flashes amber
4. **Reveal** (2.4-3.7s): Cavern fades up, scan sweep reveals formations top-to-bottom (cyan line), pod + rig appear

Skip button available throughout.

### 11. Mining Complete Overlay

Modal with FOUNDRY styling showing:
- Haul summary (Scrap, Biominerals, Core Crystal)
- Probes Caught / Missed stats
- "Drop on Next Planet" button (cycles through verdant→rust→tundra biomes)

### 12. Three Biome Ramps

```
verdant: ['#cddf6c','#91db69','#3aa06a','#239063','#1c5a4c','#123235']
rust:    ['#fdcbb0','#fca790','#e6904e','#cd683d','#8a4034','#4a2330']
tundra:  ['#c7dcd0','#9babb2','#7f8a9c','#566080','#3a4256','#262a3a']
```

Background is generated per-biome: gradient from ramp[4]→ramp[5], dithered, with wall pillars and ceiling with horizon line.

---

## Implementation Strategy

This is a big port. Suggested slicing:

**Slice A — Data layer + physics engine**: Port `BMETA`, `HP`, `ST`, `RAD`, `DROP` tables. Port the physics step (`_stepPlay` logic) into the existing `physics.ts` / `core-breaker.ts`. Port field generation (`_layout`) into `field-gen.ts`. Get balls bouncing off formations with correct collision, damage, and break sequences. No rendering yet — just the simulation.

**Slice B — Sprite rendering**: Port `_makePeg()` and `_makeBall()` into the PixiJS sprite system (likely `surface-sprites.ts`). Create formation and ball sprite factories that match the prototype's pixel art exactly. Wire up damage stage transitions.

**Slice C — Pod + Rig + Aim**: Port the dual-purpose pod (catcher + launcher rig) rendering and the aim/fire/catch mechanics. Wire up pointer/touch input for flick-aim.

**Slice D — HUD + Roster Tray**: Port the FOUNDRY-styled HUD panels and roster tray into React components. Wire up haul counters, timer, bounce pips, reprint button.

**Slice E — Juice + Polish**: Hit-stop, screen shake, grid jiggle, squash-dent, catch flash, bounce countdown warnings, spark/shard particles.

**Slice F — Intro + Complete**: Port the intro cinematic and mining complete overlay.

Start with Slice A — it's the foundation everything else builds on.
