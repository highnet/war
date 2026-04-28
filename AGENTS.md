# AGENTS.md — War Multiplayer Monorepo

## Workspace
- **Tool:** npm workspaces (root `package.json` defines `"workspaces": ["apps/*", "packages/*"]`)
- **Apps:** `apps/backend`, `apps/frontend`
- **Packages:** `packages/types`, `packages/utils`

## Developer Commands

```bash
# Install all dependencies (must run from repo root)
npm install

# Start Redis (required before backend)
docker-compose up -d redis

# Terminal 1 — Backend (local dev)
npm run dev --workspace=apps/backend
# → http://localhost:3001
# → GraphQL Playground at /graphql

# Terminal 2 — Frontend (local dev)
npm run dev --workspace=apps/frontend
# → http://localhost:3000

# Docker Compose (starts Redis + backend + frontend)
docker-compose up --build

# Run tests
npm run test --workspace=packages/utils
npm run test --workspace=apps/backend
npm run test --workspace=apps/frontend
```

## Tech Stack & Constraints
- **Backend:** Fastify 5 + Mercurius 14 + `graphql-ws` + TypeScript (no NestJS)
- **Frontend:** Nuxt 3.21.2 (SSR enabled) + Pinia + `@nuxtjs/tailwindcss` + `graphql-ws`
- **Data Store:** Redis 7 (ioredis 5.x) for game state (hashes), battle logs (lists), and pub/sub
- **Containerization:** Docker Compose with `redis`, `backend`, and `frontend` services
- **Shared packages:** imported directly via workspace links; no separate build step required
- **Backend dev runtime:** `tsx` (fast TypeScript execution, no pre-build needed)

## Architecture Rules
- Game logic lives entirely in `apps/backend/src/services/GameService.ts` — deterministic, pure functions for draw/compare/war/win
- Redis is the single source of truth:
  - Game state: Redis hashes (`game:{id}`) with JSON-serialized fields
  - Battle logs: Redis lists (`game:{id}:logs`) capped at 100 entries via `LTRIM`
  - Pub/sub: Redis `PUBLISH`/`SUBSCRIBE` on `game:{id}:updates` for subscriptions
  - TTL: 30 minutes (`EXPIRE`) refreshed on every game mutation
- WebSocket events are broadcast via `RedisPubSub` in `apps/backend/src/websocket/RedisPubSub.ts`
- AI opponent handled by `AIService.ts` watching `activePlayerId`; auto-invokes `playTurn` after 500ms
- Forfeit on disconnect: `leaveGame` mutation sets `isConnected = false`; if `PLAYING`, opponent wins immediately
- Frontend real-time updates via single GraphQL subscription `gameUpdated(gameId)`; mutations use `$fetch`

## Environment Variables

### Backend
- `REDIS_URL` — defaults to `redis://localhost:6379`
- `PORT` — defaults to `3001`
- `NODE_ENV` — `development` or `production`

### Frontend
- `NUXT_PUBLIC_API_URL` — GraphQL HTTP endpoint, defaults to `http://localhost:3001/graphql`
- `NUXT_PUBLIC_WS_URL` — GraphQL WS endpoint, defaults to `ws://localhost:3001/graphql`

## Testing
- Backend unit tests: `vitest run` inside `apps/backend` — cover normal round, war, recursive war, insufficient cards, AI auto-play
- Frontend unit tests: `vitest run` inside `apps/frontend` — cover Pinia store state updates and computed properties
- Utils tests: `vitest run` inside `packages/utils`

## Docker Notes
- `docker-compose.yml` defines three services: `redis`, `backend`, `frontend`
- Backend and frontend Dockerfiles use `node:22-alpine`
- Backend Dockerfile exposes port `3001`
- Frontend Dockerfile exposes port `3000`
- For local dev, `docker-compose up redis` is sufficient; run backend/frontend locally for hot-reload

## Scalability Extension Points (marked with `// SCALE:`)
- `RedisStore` → Redis Cluster or AWS ElastiCache
- `BattleLogRepository` → append-only event store (Kafka/EventStoreDB)
- `graphql-ws` → sticky sessions or managed WebSocket gateway
- `GameService` → snapshot game state to PostgreSQL every N turns for recovery
