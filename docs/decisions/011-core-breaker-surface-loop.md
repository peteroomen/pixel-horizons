# ADR 011: Replace the surface platformer with Core Breaker (physics extraction)

Date: 2026-06-19
Status: Accepted

## Context

The GDD's second loop (§6) was an action-platformer planet mining run: a printed clone
runs/jumps/melees through a tilemap, mines deposits, and races a pod timer. Phases 3.1–3.4
shipped most of it (platformer core, mining + drop pod, clone death/hazards; PRs in main).

Two problems made us re-open the choice:

1. **Mobile is a launch requirement, not a port** (CLAUDE.md, GDD §13). Precision touch
   platforming is a known, persistent UX problem — virtual d-pads/jump buttons feel mushy on
   glass — and the "2.5 fun checkpoint" + "3.1 platformer feel" hand-plays were *never*
   signed off (they sit in the deferred list). We were polishing renderer art (6.1 recolor
   slices) on a loop whose core fun was unvalidated.
2. **Tonal whiplash.** A deliberate, turn-based deckbuilder fused with a twitch
   action-platformer is two different brains. Nothing in the target player's library is
   real-time action; it's STS, Balatro, Dicey Dungeons, **Peglin**, Into-the-Breach-adjacent
   tactics, Kingdom Rush, Lichess, Shattered Pixel Dungeon — deliberate, readable games.

We evaluated three replacements (Peglin-style physics extraction; Into-the-Breach-style
turn-based tactical grid; Kingdom Rush-style tower defense) and an incremental layer (kept as
metagame, not the surface loop). The physics-extraction option won: it has a direct precedent
in the player's library (Peglin is itself a physics-deckbuilder-roguelite), the input
(drag-to-aim, release-to-fire) is the best-feeling touch interaction available, and it gives
*textural contrast* to turn-based combat (combat = your brain, mining = your hands) while
staying inside the same roguelite-deckbuilder genre.

Crucially, the expensive 6.1 work survives: runtime planet generation (ADR 010), the
Resurrect 64 palette ramps, and the recolor pipeline all feed the new playfield unchanged.
What retires is the least-proven code — `surface/physics.ts` (AABB platformer), the clone
moveset/feel tuning, touch controls, the chunk-grammar level design, and the platformer
surface-enemy/hazard entities.

## Decision

**Replace the surface platformer with "Core Breaker": a Peglin-style deterministic
physics-extraction loop.** The planet surface is a cross-section playfield of mineral
deposits; the player aims and fires *balls* into it; balls bounce/ricochet, shatter deposits,
and resources fall into the pod's hopper. A bounded number of shots per drop (the pod
budget), then launch.

This preserves the North Star (§1 "you are building a ship"): modules already project to
combat **cards** (`deck.ts`); Core Breaker adds a *third projection*, module → **ball**.

- **Module → ball/passive, two roles only.** Most modules project to a *ball* (a
  projectile); some project to a *passive* (e.g. reactor → shots-per-drop). No placeable
  board pieces. This mirrors "most modules are attack cards, some are powers."
- **Shared upgrade axis.** A module's Mk tier buffs *both* faces together (the combat card
  and the ball). Module *count* = number of copies of that ball in the firing bag. There is
  no separate mining-only upgrade economy.
- **Divergence only via events.** A ball and its card stay locked together except when a
  rare event targets one face — exactly parallel to today's event-modifies-a-module →
  changes-its-combat-card. Data model: tier drives both; an event stores a per-face override.
- **Determinism is preserved (ADR 003).** The ball physics core is a new, seeded,
  fixed-timestep simulation (circle-vs-peg restitution — *not* the retired AABB model). Same
  seed + same inputs = same outcome, keeping shareable URLs and daily runs intact.
- **Reuses the planet pipeline (ADR 010).** Biome/planet type drives peg layout density, ore
  richness, hazard count, and special pegs; the playfield is themed from the *same* R64 ramp
  the orbit planet was generated from.

### UI constraint adopted with this decision

A module now carries three player-facing things to read (combat card, ball behaviour, any
passive) across Workbench / DeckViewer / shop / event / orbit loadout / bag preview, down to
375px. To keep that legible:

- **One `<ModuleCard>` component, two faces** — a single anchor (icon + name + tier pips +
  count) that flips/expands to combat side and surface side; never two unrelated
  representations to reconcile.
- **A ball *glyph grammar*** — a tiny trajectory icon per ball type (straight = pierce, arc =
  bounce, curve = homing) + a count badge, readable without text, extending the "module
  grammar" visual language started for the hull sprites.
- **Tier and count are the only numbers that change** — fixed, prominent positions
  everywhere; effects described once and reused via shared keyword tooltips across both faces.

## Consequences

- **Retires shipped code.** `surface/physics.ts` (AABB), clone moveset/feel, touch controls,
  chunk-grammar level gen, and platformer enemy/hazard entities are removed or converted to
  peg/hazard types. GDD §6 is rewritten (this ADR supersedes the platformer spec in §6.1–6.10;
  the old text remains in git history). Roadmap Phase 3 platformer slices are superseded by a
  new Core Breaker surface-rebuild track.
- **Keeps the art pipeline.** ADR 010 (runtime planets), `palette.ts` ramps, orbit screen,
  and surface recolor are unchanged — they feed the new playfield directly.
- **New physics to write and test.** Circle-vs-peg restitution with deterministic
  fixed-timestep is new sim surface area; it is the single riskiest piece, so it gets a
  throwaway feel-prototype before the real slice (cf. the `/planet-spike` precedent).
- **Pace cohesion + mobile fit improve;** the loop's contrast (aim vs. turn-based) is now a
  feature rather than a tonal seam.
- **Clone fiction narrows.** No walking avatar; the Clone Bay slot keeps its combat card and
  projects a surface *passive* instead of a platformer chassis (GDD §6 details). Clone death /
  corpse-run / re-print economy (§6.4, §6.10) are retired; surface risk comes from bounded
  shots + Bloom hazard pegs that waste shots or cut yield.
- **Some GDD sections need follow-up edits** (§4.2 slot "projects items" wording, §5.8
  per-module "Planet Item" columns) — flagged in-place, re-specced as the Core Breaker module
  table is built.
