# Project: Multiplayer Game Platform

## Overview
A real-time multiplayer party game platform featuring multiple game modes including **Pixel Challenge** (the main/most developed mode). Supports multiple players via QR code joining, has a host/player architecture, and runs on a single Express + Socket.io server.

## Local Development
- **Local path**: `C:\wamp\www\game`
- **Dev server**: `npm run dev` (Vite, port 5173)
- **Game server**: `npm run server` (Express + Socket.io, `server.js`)
- **Build**: `npm run build`

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| State Management | Zustand |
| Real-time | Socket.io (client + server) |
| Animations | Framer Motion |
| i18n | i18next + react-i18next |
| Icons | Lucide React |
| QR Codes | qrcode.react |
| Backend | Express 5, Node.js (`server.js`) |
| Confetti | canvas-confetti |

## Project Structure
```
game/
├── src/                # React frontend source
├── public/
│   └── images/pc/      # Pixel Challenge local images (hosted here!)
├── server.js           # Main Express + Socket.io server (all game logic)
├── dist/               # Built frontend (for production)
├── index.html          # Entry point
└── vite.config.ts
```

## Key Architecture: Pixel Challenge
- **Mystery image is revealed progressively** (pixelated → clear) as time runs out
- **10 rounds** per game by default
- **Tie-breaker**: If top players tied at round 10, up to 5 additional buffer rounds
- **Option shuffling**: Answer buttons randomized every question (correct answer position varies)
- **30-image pool**: 10 main rounds + 5 buffer = needs 15 unique questions per game

## Image Assets (Pixel Challenge)
All images are hosted **locally** in `/public/images/pc/` — do NOT use external URLs (they cause "Mystery" text bug)

Currently hosted locally:
- Eiffel Tower, Pyramids, Panda, Mango, Apple Logo, Bitcoin, Lion, Pizza, Football, Ferrari
- Images are **vertical (9:16 aspect ratio)** — this is intentional for cinematic feel
- Container: 1400px max-width, vertical layout

Remaining questions use high-quality portrait URLs (kept as fallback).

**IMPORTANT**: When adding new Pixel Challenge questions, generate images and save locally to `/public/images/pc/` — do not use Unsplash or external links.

## Sydney Opera House Image
- Image labeled '14' (Sydney Opera House) was corrected with an accurate image
- This was a known issue — do not revert

## Game Modes (Known)
- **Pixel Challenge** — Fully polished, competitive experience
- **Drawing Challenge** — Real-time collaborative canvas drawing; one player draws, others guess
- Other modes may exist in `server.js` — check before adding new ones

## Key Game Logic (server.js)
- All multiplayer game state lives in `server.js`
- Players join via QR code scan → unique session rooms
- Host controls game flow (start, next question, show results)

## Timer Bar
- Timer bar sits **below the answer options** — this layout is intentional and should be preserved

## Scoring
- Points displayed top-left: **18px font size** — discreet and precisely placed
- Compact HUD to maximize vertical image real estate

## What NOT to Change
- Do NOT move images to external hosting (Unsplash, etc.) — causes "Mystery" text bug
- Do NOT change aspect ratio from vertical (9:16)
- Do NOT move timer bar above answer options
- Do NOT remove tie-breaker logic
- Do NOT make answer options appear in fixed positions (shuffle is intentional)

## Drawing Challenge Architecture
- Canvas strokes are sent as `drawing_stroke` socket events (individual segments: `{type, from, to, color, size, eraser}`)
- Only the **drawer's** socket receives `drawingCurrentWord`; guessers receive `drawingWordLength` (blank count)
- `drawing_clear` event resets `drawingStrokes[]` on server and clears all canvases
- Words pool: `src/data/drawingWords.json` — 100 Arabic words in 6 categories
- Timer is broadcast only as `drawing_timer` event during active rounds (not re-sent on every room_data to avoid word reveal)
