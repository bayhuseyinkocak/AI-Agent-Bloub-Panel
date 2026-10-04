# Agent Panel

An interactive multi-agent UI built with Vue 3 + TypeScript. Eight AI agents live on a spatial stage, react to chat commands, and collaborate through a typed event bus. Currently runs fully client-side with a mock LocalBus; a real backend stub is ready for future WS/SSE integration.

## Quick start

```bash
npm install
npm run dev        # → http://127.0.0.1:5199/
```

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Language | TypeScript (strict via `vue-tsc`) |
| Build | Vite 8 |
| Styling | Plain CSS (no Tailwind) |
| Bot engine | Bloub SVG morph (copy from [bayhuseyinkocak/bloub](https://github.com/bayhuseyinkocak/bloub)) |

No runtime dependencies beyond Vue.

## Agents

| ID | Name | Skin | Style |
|----|------|------|-------|
| ARIA | Aria | Blue | Strategist, lead by default |
| BLITZ | Blitz | Red | Executor, fast and direct |
| SAGE | Sage | Green | Analyst, calm and measured |
| NOVA | Nova | Purple | Researcher, exploratory |
| ECHO | Echo | Cyan | Communicator, diplomatic |
| HEX | Hex | Orange | Debugger, detail-focused |
| PIXEL | Pixel | Yellow | Designer, visual thinker |
| ORB | Orb | White | Oracle, broad perspective |

## Chat commands

| Command | What it does |
|---------|--------------|
| `/ARIA mesaj` | Summon ARIA as lead, send message |
| `/ARIA /BLITZ mesaj` | Multi-summon: ARIA = lead, BLITZ = helper; pair forms automatically |
| `/AR` (live typing) | Previews ARIA summon as you type (unique prefix match) |
| `devret BLITZ` or `@BLITZ` (in message) | Handoff from current speaker to BLITZ |
| `!pair side` / `!pair orbit` / `!pair` | Switch pair mode (yan yana / orbit) |
| Side menu → Ajanlar | Click an agent to summon |
| Side menu → Ayarlar | Toggle pair mode via UI |

## Architecture

```
User input
    ↓
App.vue  ──dispatch──▶  LocalBus (mock)  ──▶  Bus events
    ↑                                              ↓
    └──── subscribe ────────────────────────────────┘
              ↓
      AgentStage  +  ChatDock  (both read-only on bus)
```

- **`src/bus/types.ts`** — Event contracts (`user.message`, `agent.called`, `agent.say`, `agent.handoff`, `agent.pair`, `agent.done`, etc.) and the `AgentBus` interface
- **`src/bus/localBus.ts`** — Mock implementation: subscribes/dispatches, generates fake replies and handoffs
- **`src/bus/backendBus.ts`** — Stub for real WS/SSE backend (no-op today, same interface)
- **`src/agents.ts`** — Agent identities, partner lists, `parseCommand` (multi-mention parser)
- **`src/layout.ts`** — Slot assignment: focus, ally, companion, outer, pair (side/orbit)
- **`src/pairMode.ts`** — Runtime pair mode switch (`getPairMode` / `setPairMode`)
- **`src/components/AgentStage.vue`** — Renders all agents with bounce, dust, gaze, pair bond SVG
- **`src/components/ChatDock.vue`** — Chat input, live preview, message list
- **`src/components/DustField.vue`** — Atmospheric particle canvas
- **`src/components/SideMenu.vue`** — Left navigation: Agents / Log / Settings
- **`src/bot/*`** — Bloub engine (SVG shapes, expressions, eyes). Do not edit casually.

## Visual system

- **Perspective**: `perspective: 900px` on stage; agents use `translate3d` z-depth
- **Gaze**: Focus looks down at chat (`effraye`) while typing; looks forward (`surpris` → `attentif`) on dismiss. Side agents get soft `lookFront` only.
- **`spin: 0`** — Always. Non-zero spin causes eye mask disappearance bug.
- **Paper color**: `#E8EDF7` — cream; controls eye visibility through bloub mask holes
- **Depth fog**: Far agents get blur + lower opacity
- **Dust**: Canvas particles; burst on summon via `dust:burst` CustomEvent

## Build & lint

```bash
npm run build      # vue-tsc --noEmit && vite build   (CI gate)
npm run preview    # production preview
```

No automated UI test suite yet. Verify by hand using the command table above.

## Design files

- `DESIGN.md` — Visual direction, palette, typography
- `PLAN.md` — Phase 1–5 completion log and future notes

## License

Private project.
