# Agent Panel — Design

## Subject
A single-screen **agent constellation floor**: living bloub bots (x.ai-style morphing blobs) as AI agents, summoned from a bottom command chat. Frontend only. No chrome, no nav, no extra panels — stage + chat.

## Style anchor
Night observatory / mission floor around x.ai product minimalism. The avatars are the product; the UI is a quiet instrument rail under a dark sky. Not SaaS cards, not broadsheet, not cream-warm landing page.

## Palette
| Token | Hex | Role |
|-------|-----|------|
| void | `#070B14` | stage floor (cool deep blue-black, not neutral #0B0B0B) |
| panel | `#0C1322` | chat dock surface |
| line | `#1A2740` | hairline structure |
| ink | `#E8EDF7` | primary text |
| muted | `#6B7A99` | secondary text, idle labels |
| accent | `#5B8CFF` | summon / active / focus ring |

Agent body colors come from the bloub palette (rouge, violet, vert…). Accent is reserved for interaction state so the floor stays chromatically quiet.

## Typography
- **Space Grotesk** — UI, chat, agent names. Technical without being default Inter.
- **IBM Plex Mono** — `/COMMAND` tokens and timestamps only (functional, not decorative labels).
- Scale: 12 / 13 / 15 / 18 / 22. Weights 400 / 500 / 600. Sentence case. No ALL-CAPS eyebrows.

## Layout
Full viewport. Stage = entire screen. Chat dock bottom-center (`max-width: 720px`, inset 20px). Agents live in the upper ~72% as free-floating absolute nodes.

```
┌──────────────────────────────────────┐
│  ·  ARIA                 PIXEL  ·    │
│        ·        ·                   │
│           [ FOCUS BOT ]             │     ← summon zone (~38% height)
│      ally ·        · ally           │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ transcript                     │  │
│  │ input  /ARIA merhaba           │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

Alignment: chat text left; agent name tags under each bot, centered.

## Motion
- One orchestrated event: **summon choreography** (user action).
  - Called agent → center summon zone, scale up (~1.0), soft shadow lift.
  - Explicit co-calls → flank slots at medium scale.
  - Partners of the focus agent → near ring (still large-ish).
  - Everyone else → far corners, scale down, opacity dip.
- Idle life: gentle float drift + bloub blink/gaze. `prefers-reduced-motion` freezes drift and shortens transitions.
- CSS transforms + one shared clock. No animation library.

## Signature moments
1. **Summon glide** — `/NOVA` makes the blob grow and slide to center while the field scatters to corners.
2. **Living ink** — bloub morph states (idle / thinking / exclaim) so the agents feel like characters, not icons.

## Agents (bloub skins)
| id | shape | color | expression | role |
|----|-------|-------|------------|------|
| ARIA | cercle | bleu | attentif | orchestration |
| BLITZ | goutte | rouge | excite | execution |
| SAGE | galet | vert | somnolent | research |
| NOVA | squircle | violet | surpris | creative |
| ECHO | capsule | turquoise | curieux | comms |
| HEX | hexagone | ambre | mefiant | security |
| PIXEL | nuage | rose | heureux | design |
| ORB | triangle | orange | fier | ops |

Partner graph keeps allies closer (e.g. ARIA↔PIXEL, BLITZ↔HEX, SAGE↔ECHO, NOVA↔ORB).

## Interaction contract
- Chat input accepts `/AGENT` (case-insensitive, multiple allowed).
- First token = focus; later tokens = allies.
- Pure frontend: canned agent replies, no network.
