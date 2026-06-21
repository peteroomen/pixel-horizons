# ADR 003 — Carrom-Breakout Mining: Surface Loop as Flick-Aim Ball Physics

> **Status:** PROPOSED  
> **Date:** 2026-06-18  
> **Supersedes:** Platformer surface loop (GDD §6), Carrom surface loop (unpublished pivot)

---

## Context

The surface mining loop has been through two designs:

1. **Platformer** — drops to planet, runs/jumps/mines deposits, fights enemies, returns to pod. Extensive design work (Gemini 3.4 collaboration: HP system, moveset matrix, enemy roster, level grammar). Never felt like it connected to the deckbuilder identity strongly enough — your ship build determined items/abilities, but the moment-to-moment play was a generic action platformer.

2. **Carrom** — flick-aim mineral pucks into pockets. Satisfying per-flick, but passive after the flick lands. "Board clear" endpoint doesn't map naturally to timed mining runs. Abandoned quickly.

3. **Carrom-Breakout hybrid** (this proposal) — modules project balls with distinct physics properties; you flick-aim them at mineral formations via a drag-back slingshot gesture; the cargo pod is your cannon, mineral catcher, and ball catcher. Limited shots per landing (one ball per module activation), mining ends when all balls are spent.

## Decision

Replace the surface loop with a carrom-breakout hybrid: deliberate flick-aim firing (carrom) combined with brick-breaking mineral physics (breakout). Port the ball-type system from the Brickwave 2000 design project (same team, existing design work) with significant simplification, and add an active pod-catch mechanic to eliminate carrom's passivity problem.

## The Design

### Core Metaphor

Ship modules project "mining probes" (balls) at mineral formations (bricks). The cargo pod launches each probe via flick-aim, catches falling minerals as they break free, and catches still-active balls for re-launch. When all probes are spent, the mining run ends and the pod returns to orbit with whatever was caught.

This makes the surface loop a **direct expression of your ship build**: every module contributes a ball with distinct physics, so your deckbuilding choices in space directly shape your mining capability on the ground. The north star ("you are building a ship") is served in both loops.

### Carrom Input Model

Each shot is deliberate. Players drag back on the pod to aim and set power — a slingshot gesture with an aim-line preview showing the projected trajectory. On release, the ball fires.

This is **not** auto-paddle-return breakout: the player doesn't swipe the pod back and forth to keep balls alive. Every ball is a considered decision. The carrom precision of "where is this going?" is the primary skill expression.

### Dual-Purpose Pod

The cargo pod serves three functions simultaneously:

1. **Cannon** — launches balls via flick-aim; the drag-back slingshot sets trajectory and power
2. **Mineral catcher** — catches resource chunks as they fall from broken formations above
3. **Ball catcher** — catches active balls (that still have bounces remaining) for re-launch

This triple role makes pod positioning a live tactical decision rather than a rote tracking task.

### Ball Catching & Re-Launch

When the pod catches an active ball (one with bounces remaining), the player immediately re-aims and re-fires with the remaining bounce budget. If they let the ball pass, it expires. This creates the reactive layer that carrom alone lacked:

- **Calm phase (AIM):** drag-back, set trajectory, release
- **Active phase (BOUNCE & BREAK):** ball ricochets through formations, breaking minerals
- **Reactive phase (CATCH):** position pod to catch the falling ball; also catching freed minerals
- **Decision phase (RELOAD or RE-LAUNCH):** if caught, re-aim; if missed, next ball loads

**The rhythm:** AIM → FIRE → BOUNCE & BREAK → CATCH → RELOAD → repeat

Because you're actively catching (not just watching), every ball stays engaging until it expires.

### What We Port from Brickwave

**Ball types** (simplified from 7 to ~5 for launch):
| Ball | Source Module Type | Behaviour | Bounces |
|------|-------------------|-----------|---------|
| **Standard** | Weapon modules | Baseline, no modifier | 8 |
| **Heavy** | Heavy weapons (Railgun, Autocannon) | Slow, 2× break power, cracks reinforced minerals | 5 |
| **Split** | Utility modules (Phase Shifter, Scanner) | Forks into 2 on first mineral hit | 6 each |
| **Drill** | Engine modules (Thruster, Hauler) | Bores straight through a line of minerals, no deflection | 4 |
| **Ghost** | Shield modules (Deflector, Barrier) | Phases through minerals (breaks them but doesn't bounce off) | 10 |

**Dropped from Brickwave:**
- Lightning, Explosion ball types (too complex for v1)
- Elemental traits (fire/poison/ice) — gone entirely
- Compound balls / Artificer fusion — gone
- Tiers (T1/T2/T3) — replaced by module Mk level (Mk I = base, Mk II = upgraded stats)
- XP/gold/level-ups — replaced by mineral drops
- Hybrid ball system — gone, just base balls from components

**Kept from Brickwave:**
- Form = behaviour (ball shape/color tells you what it does)
- X bounces til ball expires (each ball has a bounce budget)
- Ball roster / rotation (you cycle through your available balls)
- Brick shapes and visual variety (reworked as mineral formations)
- Reinforced/multi-HP bricks (as dense mineral clusters)
- Per-pip bounce countdown readability

### Mineral Formations (Bricks → Resources)

| Formation | Resource | HP | Visual |
|-----------|----------|-----|--------|
| **Biomineral Cluster** | Biominerals | 1 | Organic green/teal slab |
| **Scrap Deposit** | Scrap | 1 | Metallic grey slab |
| **Dense Vein** | Biominerals ×2 | 2–3 | Reinforced, cracks per hit |
| **Core Crystal** | Core Crystal | 3–4 | Crystalline, refracts ball angle |
| **Hidden Deposit** | Random rare | 1 | Invisible until Scanner ball reveals |
| **Inert Rock** | Nothing | 2 | Obstacle, creates ricochet puzzles |

**Formation layouts are non-standard by design.** Because players aim deliberately, formations can be scattered across the field — not just tidy rows at the top. Inert rock placements create bank-shot and ricochet puzzles. Some deposits require specific ball types or approach angles. This depth is only possible because the input is intentional, not reactive.

Different shapes (wide, narrow, L-shaped, diamond) create varied puzzle layouts — this was compelling in Brickwave and translates directly.

### The Cargo Pod as Cannon & Catcher

The drop pod sits at the bottom of the screen. Thematically it's the mining platform: it fires probes upward and catches the freed minerals as they fall.

**Visual concept needed:** The pod needs to look like a chunky Horizon Collective utility vessel — a wide cargo bay opening facing upward, with a mounted launcher on one end and mechanical arms or a tractor beam catching falling resource chunks. Not a flat bar — it should feel like a machine doing a job.

**Touch controls:** Drag back on the pod to aim (slingshot gesture with aim-line preview); release to fire. Pod repositions by tapping a target position. The pod width could vary with Cargo Scanner module (wider = easier to catch minerals and balls, rewarding utility builds).

### Ball Roster & Module Mapping

Each installed module generates one ball for the mining roster. Your roster IS your module loadout:

- Gunship (3W/1S/1U/1E) → 6 balls (3 weapon + 1 shield + 1 utility + 1 engine)
- Scout (1W/1S/2E/2U) → 6 balls (1 weapon + 1 shield + 2 engine + 2 utility)
- Freighter (1W/1S/2E/1U) → 5 balls (1 weapon + 1 shield + 2 engine + 1 utility)

**Ball order:** Player chooses launch order from their roster (Brickwave's rotation tray, simplified). Active ball at bottom, rest queued.

**Mk II upgrades:** A Mk II module gives its ball +2 bounces and a small stat boost (wider break radius, faster speed, etc.)

### Bounce Budget & Reprint

Each ball has a fixed bounce count. When it expires, the next ball loads automatically. When all balls are spent, the mining run ends.

**Reprint:** Spending Scrap to re-fire a spent ball. Design tension:
- Pro: extends mining time, gives Scrap a sink on the surface
- Con: could be a no-brainer spam (always reprint = infinite mining)
- **Proposed rule:** Reprint costs escalate: 1st = 2 Scrap, 2nd = 5, 3rd = 10. Rapidly becomes uneconomical. Maximum 3 reprints per landing. This creates a decision: save Scrap for shop, or push for more minerals?

Reprint is strictly about spending Scrap to re-fire a spent ball — it has no narrative dimension.

### What the Pod Timer Becomes

The timer is implicit: you run out of balls. But a soft timer could add pressure:

**Option A:** No timer, balls-only. Mining pace is self-regulating.  
**Option B:** Timer still exists but is generous (~3 min). Running out of balls OR timer = pod returns. Timer prevents infinite stalling on the last ball.  
**Recommendation:** Option B with a generous timer. Keeps the "ticking clock" tension from the GDD without being the primary constraint.

### What Happens to the Platformer Design Work

The Gemini 3.4 collaboration (HP system, moveset, enemies, hazards) was good design work on the wrong loop. Some concepts translate:

- **Enemy concepts → Obstacle formations:** Bloom Hopper → a formation that moves around. Ceiling Dropper → a formation that falls when hit adjacent. The enemy-as-obstacle concept maps cleanly to the breakout field.
- **Dropped minerals:** If you miss a falling mineral with the pod, it sits on the "floor." Pod can sweep over it, but it's riskier with balls bouncing around.
- **Traversal skill expression:** The platformer's moment-to-moment skill expression (movement, jumping, timing) is replaced by the carrom aim mechanic — aiming deliberate shots, reading bank angles, and positioning the pod for active catches. Different skill surface, equivalent engagement depth.

### Difficulty Scaling

- **Sector 1:** Simple formations, mostly 1 HP minerals, generous layouts
- **Sector 2:** Dense veins, inert rock obstacles, tighter formations
- **Sector 3:** Core Crystals behind obstacle walls, hidden deposits, formation patterns that require specific ball types or bank shots
- **Biome modifiers:** Rocky = standard. Volcanic = minerals crack faster but inert rock is tougher. Ice = balls slide further (more bounces but less control).

## Consequences

### Positive
- Surface loop directly expresses ship build (north star alignment)
- Existing Brickwave design work is reusable (ball types, roster UI, brick grammar)
- Simpler to implement than a full platformer (no AABB physics, no enemy AI, no tile maps)
- Touch-native — breakout is a proven mobile genre; flick-aim is a proven touch input
- Clear session length (X balls = predictable mining duration)
- Deckbuilding choices have immediate, tangible surface impact
- Hybrid solves carrom's passivity problem: active ball catching keeps the player engaged between shots, eliminating the "watch it bounce" dead time
- Dual-purpose catching (minerals + balls) creates unique split-second prioritization decisions — the pod can't be in two places at once

### Negative
- Abandons weeks of platformer design work (Gemini 3.4, GDD §6)
- Third surface loop design — risk of never shipping if we pivot again
- Less exploration feel than a platformer (no "discovering" the planet)

### Risks
- **"Just another breakout"** — the carrom aim input (deliberate flick-aim vs. reactive paddle) and the ball-catching re-launch mechanic are structurally different from standard breakout. The module→ball mapping ensures each run has a unique loadout. Mitigated significantly.
- **Pivot fatigue** — this MUST be the final surface loop design. Commit and ship.

## Implementation Notes

- The breakout physics engine is simpler than the AABB platformer physics already built
- Ball rendering can use the existing PixiJS canvas pipeline
- Mineral formations are a grid of data — simpler than tile maps
- The roster/rotation UI maps to React components (existing card hand pattern)
- Seeded RNG for formation layouts (existing pattern from sector map)
- Aim-line preview: ray-cast a few bounces from the current drag angle; update per pointer-move event (not per frame — see coding conventions)
