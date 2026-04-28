# War Multiplayer

A production-style fullstack monorepo implementation of the card game **War** with real-time multiplayer, AI opponents, and Redis-backed game state.

## Features

- **Real-time multiplayer** via GraphQL subscriptions over WebSockets
- **Single-player vs AI** with automatic turn execution
- **Step-by-step war resolution** — dramatic face-down / face-up card reveals
- **Battle logs** persisted in Redis for every game
- **Opponent deck size** visible at all times
- **Auto-forfeit** on disconnect or page leave
- **Game expiry** — old games auto-cleaned after 30 minutes of inactivity
- **Auto-play & speed control** for fast-forwarding games

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | npm workspaces |
| Backend | Fastify 5 + Mercurius 14 + TypeScript |
| Real-time | `graphql-ws` over WebSockets |
| Data Store | Redis 7 (hashes, lists, pub/sub) |
| Frontend | Nuxt 3.21.2 (SSR) + Vue 3 Composition API |
| State | Pinia |
| Styling | Tailwind CSS |
| Testing | Vitest |
| Containers | Docker + Docker Compose |

## Quick Start

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- npm 10+

### Install Dependencies

```bash
npm install
```

### Run with Docker Compose (Recommended)

Starts Redis, backend, and frontend:

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- GraphQL Playground: http://localhost:3001/graphql

### Run Locally for Development

```bash
# Terminal 1 — Start Redis
docker-compose up -d redis

# Terminal 2 — Backend
npm run dev --workspace=apps/backend

# Terminal 3 — Frontend
npm run dev --workspace=apps/frontend
```

## Architecture

### Backend (`apps/backend`)

- **GameService** — deterministic, pure game logic (draw, compare, war recursion, win detection)
- **AIService** — watches game state via Redis pub/sub; auto-plays AI turns after 500ms
- **RedisStore** — ioredis wrapper (single-node; marked with `// SCALE:` for cluster upgrade)
- **GameRepository** — Redis hashes with JSON fields + 30-min TTL
- **BattleLogRepository** — Redis lists capped at 100 entries
- **RedisPubSub** — Redis pub/sub powering GraphQL subscriptions
- **Forfeit logic** — `leaveGame` mutation ends the game if in `PLAYING` status

### Frontend (`apps/frontend`)

- **Pages:** `/lobby` (create/join), `/game/[id]` (play)
- **Stores:** `userStore`, `gameStore`, `socketStore`
- **Composables:** `useGraphQL` (mutations/queries via `$fetch`), `useGameSocket` (subscriptions via `graphql-ws`)
- **Real-time:** Single subscription `gameUpdated(gameId)` pushes full Game state; UI derives all events from it

## Game Rules

- Standard 52-card deck (values 2–14, Ace = 14)
- Shuffled and split 26/26
- Each **Play Turn** reveals top cards
- Higher card wins the pile (added to bottom of winner's deck)
- **Tie → WAR:** each player places 1 face-down + 1 face-up card; compare again recursively
- **Insufficient cards during war → immediate loss**
- Game ends when opponent has 0 cards or forfeits

## Testing

```bash
# Utils
npm run test --workspace=packages/utils

# Backend
npm run test --workspace=apps/backend

# Frontend
npm run test --workspace=apps/frontend
```

## Environment Variables

### Backend
- `REDIS_URL` — Redis connection string (default: `redis://localhost:6379`)
- `PORT` — HTTP port (default: `3001`)
- `NODE_ENV` — `development` or `production`

### Frontend
- `NUXT_PUBLIC_API_URL` — GraphQL HTTP endpoint (default: `http://localhost:3001/graphql`)
- `NUXT_PUBLIC_WS_URL` — GraphQL WS endpoint (default: `ws://localhost:3001/graphql`)

## Scalability Notes

Marked throughout the codebase with `// SCALE:` comments:
- **RedisStore** → Redis Cluster or AWS ElastiCache
- **BattleLogRepository** → append-only event store (Kafka/EventStoreDB)
- **graphql-ws** → sticky sessions or managed WebSocket gateway
- **GameService** → snapshot game state to PostgreSQL every N turns for recovery

## Project Structure

```
war/
├── apps/
│   ├── backend/        # Fastify + Mercurius + Redis
│   └── frontend/       # Nuxt 3 + Pinia + Tailwind
├── packages/
│   ├── types/          # Shared TypeScript types
│   └── utils/          # Deck logic, shuffle, helpers
├── docker-compose.yml  # Redis + backend + frontend
├── PLAN.md             # Detailed implementation plan
└── AGENTS.md           # Agent quick-start guide
```

## License

MIT
