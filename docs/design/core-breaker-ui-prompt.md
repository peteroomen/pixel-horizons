# Design prompt — Core Breaker UI & planet-aesthetic integration (initial pass)

> Paste-ready brief to hand to Claude (design). Self-contained — assumes no prior context.
> Goal: an **initial, low-fi** design pass on the Core Breaker screen UI and how the playfield
> sits inside the game's existing planet/colour aesthetic. Not final art — layout, hierarchy,
> readability, and the icon/colour language.

---

## The prompt

You are designing the UI for **Core Breaker**, the planet-extraction mode of a browser roguelite
called *Pixel Horizons*. I need an **initial design pass** — wireframes/mockups and a clear
rationale — for the Core Breaker gameplay screen and how it integrates with the game's existing
planet aesthetic. Low-fidelity is fine; prioritise layout, information hierarchy, readability at
small sizes, and a coherent icon/colour language over polish.

### The game in one breath

Pixel Horizons is a pixel-art, mobile-first roguelite deckbuilder. You build a spaceship out of
**modules**; those same modules project into two play modes:
- **Space combat** — a deliberate, turn-based card game (modules → a deck of cards).
- **Core Breaker** — a Peglin-style physics-extraction toy (modules → a bag of **balls**).

Core Breaker is the "hands" half to combat's "brain." Reference library: **Peglin**, Slay the
Spire, Balatro, Into the Breach.

### What Core Breaker is

The ship sits in orbit over a procedurally-generated planet; a drop pod fires extraction ordnance
into the planet's crust, shown as a **side-on cross-section** packed with **deposit pegs**. The
player **drags to aim from the top, releases to fire** a ball. The ball falls under gravity,
**bounces/ricochets off pegs**, and **shatters** them; shattered pegs **drop resources** that fall
into a **hopper** at the bottom and **bank on contact**. A drop is a **bounded number of shots**
(the budget); spend them, then launch back to orbit. The pleasure is the carom — one shot that
chains through a cluster and pays out big.

### Peg types to communicate (each must read at a glance)

| Peg | Meaning | Notes |
| --- | --- | --- |
| **Mineral node** | common, 1 hit → Scrap | the bulk of the field |
| **Ore vein** | 3 hits → Biominerals | richer; chips down as you hit it |
| **Hardrock** | 2 hits → Scrap | wants a heavy/piercing ball |
| **Bloom growth** | hazard — **consumes your ball** (shot wasted) unless pierced/phased | biological enemy; sits guarding ore/crystal |
| **Crystal** | rare, deep, armoured → Core Crystal | the jackpot |

### Ball types to communicate (the "bag")

Balls come from the player's installed modules. Four behaviours, each needs an at-a-glance
**trajectory glyph** (readable with no text):
- **Pierce** (straight) — punches through pegs in a line.
- **Bouncy** (arc) — high-restitution caroms; explodes on rest (AoE).
- **Homing** (curve) — magnetises toward ore.
- **Phase** — passes through one Bloom growth unharmed.

The player fires from a **bag** (multiset of these balls, like a deck); it cycles/reshuffles when
empty. They need to see the **current ball**, the **next few**, and **how many shots remain**.

### HUD / readouts the screen must carry

- **Shots remaining** (the budget — primary pressure; reactor sets it).
- **Banked this drop** (resources in the hopper, by type: Scrap / Biominerals / Core Crystal).
- **The bag**: current ball + upcoming order, via the trajectory glyphs + a count.
- **Aim guide** while dragging (a few projected dots).
- A **LAUNCH / leave** affordance (end the drop early).

### The aesthetic it must live inside (this is the integration ask)

The whole game is **colour-locked to the Resurrect 64 palette** (a fixed 64-colour pixel-art
palette). Planets are **generated at runtime** and each has its own **6-step colour ramp** (light→
dark) drawn from that palette — a verdant planet skews teal/green, a tundra one cool grey-blue, a
rust one warm peach. The existing surface and sky already **recolour to match the planet** the
player is visiting. The Core Breaker field must do the same: **the crust/pegs/backdrop should be
themed from the visited planet's ramp**, so the same planet reads consistently from the orbit
screen into the extraction screen. There's also an emerging **"module grammar"** — a small,
consistent icon language for modules/ship parts — that the ball glyphs should extend.

**Design within these constraints:**
- **Mobile-first, 375px-wide minimum.** Touch is the primary input (drag-to-aim/release-to-fire);
  no hover-dependent UI. The playfield + HUD must all fit and stay legible at phone size.
- **Pixel-art, nearest-neighbour, Resurrect 64 only.** No gradients/soft shadows that break the
  palette lock; suggest specific ramp roles (e.g. "pegs use the land ramp's mid steps, hopper uses
  the darkest, drops pop on the lightest").
- **Readability over decoration.** Peg types and ball types must be distinguishable by **shape +
  palette role**, not colour alone (accessibility) and ideally **without text**.
- One **`<ModuleCard>` concept, two faces**: a module shows a combat-card face and a Core-Breaker
  ball face off one anchor (icon · name · tier pips · count). Sketch how the ball face reads.

### Deliverables for this initial pass

1. A **wireframe of the Core Breaker gameplay screen** at 375px (portrait) — playfield, HUD,
   bag/shots, aim state — with a note on how it reflows to a wider/landscape view.
2. A **peg-type visual set** — distinct shapes/palette roles for the 5 pegs against a
   planet-themed (recoloured) crust, including how a chipped multi-hit peg shows damage.
3. The **ball trajectory-glyph set** (pierce/bouncy/homing/phase) + how the bag/shots HUD presents
   current + upcoming balls.
4. A short note on **how the field is themed from the planet ramp** (which ramp steps map to crust,
   pegs, hopper, drops, hazards) so the planet reads consistently orbit → extraction.
5. The **orbit → Core Breaker → bank/launch** flow at a glance (what the player sees on entry,
   during, and on leaving).

Keep it concrete and buildable in pixel art. Call out the few highest-impact decisions and any
open questions you'd want answered before a polish pass.
