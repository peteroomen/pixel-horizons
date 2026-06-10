# Pixel Horizons

**Play:** https://pixel-horizons.vercel.app

A browser-based dual-loop roguelite: turn-based deckbuilder space combat fused with
action-platformer planet mining runs. Your ship's modules ARE your card deck in space
and your clone's equipment on planets.

## Docs

- [Roadmap](docs/roadmap.md) — phases, slices, build order
- [Game design](docs/game-design.md) — full GDD
- [Decisions](docs/decisions/) — architecture decision records
- [Work logs](docs/work/) — per-session plans and outcomes
- [CLAUDE.md](CLAUDE.md) — project conventions and session workflow

## Development

Requires Node 22 (`nvm use 22`) and pnpm.

```sh
pnpm install
pnpm dev          # localhost:3000
pnpm lint         # eslint src
pnpm type-check   # tsc --noEmit
pnpm test         # vitest
pnpm build
```
