# War Multiplayer — Implementation Plan

## 1. Overview & Goals

Build a production-style fullstack monorepo for the card game **War** with:
- Real-time multiplayer via WebSockets
- Single-player vs AI
- Step-by-step war resolution
- Battle log persistence in Redis
- Opponent deck size always visible
- Automatic forfeit on disconnect/leave
- Old games expire after inactivity
- Docker & Docker Compose orchestration
- Redis for game state, logs, and pub/sub
- Comprehensive documentation

---

## 2. Tech Stack (Latest Stable Versions)

| Layer | Package | Version | Note |
|---|---|---|---|
| Root Monorepo | npm workspaces | built-in |  |
| Containerization | docker / docker-compose | 29.x / 2.40.x | Desktop available |
| Data Store | redis | 7.x | via Docker Compose |
| Redis Client | ioredis | 5.x |  |
| Backend Framework | fastify | 5.8.5 |  |
| GraphQL | mercurius | 16.9.0 | Fastify-native GraphQL |
| GraphQL Core | graphql | 16.13.2 | peer dep for Mercurius |
| WebSocket Subscriptions | graphql-ws | 6.0.8 | Mercurius subscription driver |
| Backend Language | typescript | 5.8.x | via `tsx` for dev |
| Frontend Framework | nuxt | 3.21.2 | latest stable Nuxt 3 (SSR) |
| Frontend UI | vue | 3.5.33 | Composition API |
| State Management | pinia | 3.0.4 |  |
| Pinia Nuxt Module | @pinia/nuxt | 0.11.3 |  |
| Styling | tailwindcss | 4.2.4 |  |
| Tailwind Nuxt Module | @nuxtjs/tailwindcss | 6.14.0 |  |
| Testing | vitest | 4.1.5 | both frontend & backend |
| HTTP Client | $fetch (ofetch) | built-in | Nuxt universal fetch |

> **Decision:** Using Nuxt 3.21.2 (latest stable 3.x) rather than Nuxt 4.x to honor the original `Nuxt 3` spec while remaining current. Nuxt 4.x is marked `latest` on npm but the `3x` tag confirms 3.21.2 is the maintained LTS line.

---

## 3. Monorepo Structure

```
war/
├── package.json                  # workspace root
├── docker-compose.yml            # Redis + backend services
├── PLAN.md                       # this file
├── AGENTS.md                     # agent quick-start guide
├── README.md                     # user-facing setup & run guide
├── apps/
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── src/
│   │   │   ├── index.ts          # entrypoint
│   │   │   ├── server.ts         # Fastify factory
│   │   │   ├── graphql/
│   │   │   │   ├── schema.ts     # SDL
│   │   │   │   ├── resolvers.ts  # root resolvers
│   │   │   │   └── context.ts    # context builder
│   │   │   ├── services/
│   │   │   │   ├── GameService.ts
│   │   │   │   ├── AIService.ts
│   │   │   │   └── DeckService.ts
│   │   │   ├── store/
│   │   │   │   ├── RedisStore.ts         # ioredis wrapper
│   │   │   │   ├── GameRepository.ts     # Redis game CRUD
│   │   │   │   ├── UserRepository.ts     # Redis user CRUD
│   │   │   │   └── BattleLogRepository.ts # Redis list logs
│   │   │   ├── websocket/
│   │   │   │   └── RedisPubSub.ts        # Redis pub/sub for subscriptions
│   │   │   └── types/
│   │   │       └── game.ts
│   │   ├── tests/
│   │   │   ├── GameService.test.ts
│   │   │   └── DeckService.test.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── Dockerfile
│       ├── .dockerignore
│       ├── pages/
│       │   ├── lobby.vue
│       │   └── game/
│       │       └── [id].vue
│       ├── components/
│       │   ├── GameBoard.vue
│       │   ├── BattleArena.vue
│       │   ├── Card.vue
│       │   ├── DeckPile.vue
│       │   ├── WarIndicator.vue
│       │   ├── GameLog.vue
│       │   ├── PlayTurnButton.vue
│       │   └── SpeedControl.vue
│       ├── stores/
│       │   ├── user.ts
│       │   ├── game.ts
│       │   └── socket.ts
│       ├── composables/
│       │   ├── useGraphQL.ts
│       │   └── useGameSocket.ts
│       ├── graphql/
│       │   ├── queries.ts
│       │   ├── mutations.ts
│       │   └── subscriptions.ts
│       ├── tests/
│       │   └── gameStore.test.ts
│       ├── nuxt.config.ts
│       ├── app.vue
│       ├── tailwind.config.ts
│       ├── package.json
│       └── tsconfig.json
└── packages/
    ├── types/
    │   ├── src/
    │   │   └── index.ts
    │   ├── package.json
    │   └── tsconfig.json
    └── utils/
        ├── src/
        │   └── index.ts
        ├── tests/
        │   └── utils.test.ts
        ├── package.json
        └── tsconfig.json
```

---

## 4. Backend Architecture

### 4.1 GraphQL Schema (SDL)

```graphql
enum GameStatus {
  WAITING
  PLAYING
  ENDED
  FORFEITED
}

enum BattlePhase {
  DRAW
  WAR
  RESOLVED
}

type User {
  id: ID!
  name: String!
  isAI: Boolean!
}

type Card {
  value: Int!
  suit: String!
}

type BattleCard {
  playerId: ID!
  card: Card!
  faceDown: Boolean!
}

type Player {
  id: ID!
  name: String!
  deckSize: Int!
  pileCount: Int!
  isConnected: Boolean!
}

type CurrentBattle {
  phase: BattlePhase!
  cards: [BattleCard!]!
  winnerId: ID
  isWar: Boolean!
}

type GameLogEntry {
  id: ID!
  type: String!
  message: String!
  timestamp: String!
}

type Game {
  id: ID!
  status: GameStatus!
  mode: String!
  players: [Player!]!
  currentBattle: CurrentBattle
  winnerId: ID
  logs: [GameLogEntry!]!
  activePlayerId: ID
  createdAt: String!
  updatedAt: String!
}

type Query {
  getGames: [Game!]!
  getGame(gameId: ID!): Game
}

type Mutation {
  createUser(name: String!): User!
  createGame(mode: String!): Game!
  joinGame(gameId: ID!, userId: ID!): Game!
  startGame(gameId: ID!): Game!
  playTurn(gameId: ID!, userId: ID!): Game!
  leaveGame(gameId: ID!, userId: ID!): Game!
}

type Subscription {
  gameUpdated(gameId: ID!): Game!
}
```

### 4.2 Redis Data Model

**Game State:**
- Key: `game:{gameId}`
- Type: Hash
- Fields: `status`, `mode`, `players` (JSON), `currentBattle` (JSON), `winnerId`, `activePlayerId`, `createdAt`, `updatedAt`
- TTL: 1800 seconds (30 minutes) — refreshed on every update

**Battle Logs:**
- Key: `game:{gameId}:logs`
- Type: List
- Max length: 100 entries (LTRIM after LPUSH)

**Users:**
- Key: `user:{userId}`
- Type: Hash
- Fields: `id`, `name`, `isAI`

**Pub/Sub Channel:**
- Channel: `game:{gameId}:updates`
- Payload: full Game JSON

### 4.3 Game State Machine (Step-by-Step War)

**States stored per Game (in Redis hash):**
- `players[0..1].deck: Card[]` — serialized as JSON string in hash field
- `players[0..1].isConnected: boolean`
- `currentBattle: { phase, cards[], winnerId, isWar }`
- `activePlayerId` — whose turn it is to click **Play Turn**
- `winnerId` — set when game ends
- `logs[]` — stored in separate Redis list

**`playTurn(gameId, userId)` logic:**

1. **Validation:** game exists, started, not ended, is user's turn, random 5% simulated failure
2. **If `currentBattle` is null or `RESOLVED`** → **Start new battle (DRAW)**
   - Each player draws top card → `currentBattle.cards`
   - `phase = DRAW`
   - Compare drawn cards
   - If **not equal**: `winnerId = higher player`, `phase = RESOLVED`, give pile to winner, switch `activePlayerId`
   - If **equal**: `isWar = true`, `phase = WAR`, do NOT switch active player
3. **If `currentBattle.phase === WAR`** → **Resolve war step**
   - Check both players have ≥ 2 cards. If not, player with insufficient cards loses immediately.
   - Each player draws 1 card (`faceDown: true`) → pile
   - Each player draws 1 card (`faceDown: false`) → pile
   - Compare the **last drawn** (face-up) cards
   - If **not equal**: `winnerId = higher player`, `phase = RESOLVED`, give entire pile to winner, switch `activePlayerId`
   - If **equal**: `phase = WAR` (stay in war, same player clicks again)
4. **After every mutation** → publish to Redis pub/sub + append to battle logs + refresh TTL

### 4.4 AI Opponent

- `AIService` watches Redis keyspace notifications or polls game state changes
- When `game.mode === 'ai'` and `activePlayerId === aiPlayerId`:
  - `setTimeout(500ms)` → call `GameService.playTurn(gameId, aiUserId)`
- AI user created automatically when AI game is created

### 4.5 Battle Log Repository

- `BattleLogRepository` uses Redis lists (`LPUSH` + `LTRIM`)
- Every turn appends: `{ type: 'DRAW'|'WAR'|'RESOLVED'|'FORFEIT'|'EXPIRED', message, timestamp }`
- Logs exposed via `Game.logs` GraphQL field (read via `LRANGE`)
- Max 100 entries per game (LTRIM to 99 after LPUSH)

### 4.6 Game Expiry (TTL)

- Every game hash key is set with `EXPIRE 1800` (30 minutes)
- On every game update, `EXPIRE` is refreshed
- If a game expires in Redis:
  - If status was `PLAYING`, the game is considered expired; neither player wins
  - The expiry event can be caught via Redis keyspace notifications (optional)
- Frontend can also poll `getGame` and handle `null` as "game expired"

### 4.7 Forfeit on Leave/Disconnect

- `leaveGame(gameId, userId)` mutation sets player `isConnected = false`
- If game status is `PLAYING`, the leaving player immediately forfeits:
  - `status = FORFEITED`
  - `winnerId = opponentId`
  - Log entry: `type: 'FORFEIT'`
  - Publish final update
- If game status is `WAITING`, the leaving player is simply removed; game returns to `WAITING` for new join
- Frontend calls `leaveGame` on `beforeunload` / page close for graceful exit
- WebSocket disconnect also triggers `leaveGame` via server-side connection close handler

### 4.8 Error Handling

- `GameError` extends Error with codes:
  - `GAME_NOT_FOUND`
  - `INVALID_ACTION`
  - `NOT_YOUR_TURN`
  - `GAME_NOT_STARTED`
  - `INSUFFICIENT_CARDS`
  - `SIMULATED_FAILURE` (random 5%)
- Returned as structured GraphQL errors with `extensions.code`

### 4.9 Scalability Extension Points

Inline `// SCALE:` comments mark:
- `RedisStore` → Redis Cluster or AWS ElastiCache for horizontal scaling
- `BattleLogRepository` → append-only event store (Kafka/EventStoreDB) for audit trails
- `graphql-ws` → sticky sessions or shared subscription state via Redis
- `GameService` → snapshot game state to PostgreSQL every N turns for recovery

---

## 5. Frontend Architecture

### 5.1 Pages & Routing

| Route | Purpose |
|---|---|
| `/lobby` | Name entry, create/join games, list open games |
| `/game/[id]` | Main game board |

### 5.2 Game Board Layout

```
┌─────────────────────────────────────┐
│  Opponent Deck (26)  [connected]    │  ← DeckPile, count always visible
│                                     │
│        ┌─────────┐                  │
│        │ Battle  │                  │  ← BattleArena: face-up cards
│        │ Arena   │                  │     + face-down stacks in war
│        └─────────┘                  │
│           WAR!                      │  ← WarIndicator (animated)
│                                     │
│  Your Deck (26)                     │  ← DeckPile
│                                     │
│  [     Play Turn     ]              │  ← PlayTurnButton
│  Speed: [1x ▼]  [Auto-play]         │  ← SpeedControl
│  ┌─────────────────────────────┐    │
│  │ Battle Log                  │    │  ← GameLog
│  │ • 10:05 — You drew 10♠      │    │
│  │ • 10:05 — AI drew 10♥       │    │
│  │ • 10:05 — WAR triggered!    │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 5.3 Pinia Stores

- **`userStore`** — `id`, `name`, `isAI`. Persisted to `localStorage`
- **`gameStore`** — `game`, `loading`, `error`. Computed: `isMyTurn`, `myPlayer`, `opponentPlayer`, `warActive`, `battleResolved`
- **`socketStore`** — `graphql-ws` client, connection status (`CONNECTED` | `DISCONNECTED` | `RECONNECTING`), exponential backoff reconnection

### 5.4 Real-Time Flow

1. Page mount → `socketStore.connect(gameId)` → subscribe to `gameUpdated`
2. User clicks **Play Turn** → `useGraphQL` mutation via `$fetch`
3. Backend processes → publishes via Redis pub/sub
4. Frontend subscription receives `gameUpdated` → `gameStore.game = payload`
5. UI reacts via computed properties

### 5.5 Performance

- `gameStore` patches only top-level `game` object reference
- All derived UI state uses `computed`
- `BattleArena` uses `:key="battleCard.playerId + index"` for Vue transitions
- Battle log is append-only (Vue handles list diff efficiently)

### 5.6 Error Handling

- Network errors: toast notification + retry button
- GraphQL errors: parsed by `useGraphQL`, shown inline
- Disconnect: `socketStore` attempts exponential backoff reconnect
- Desync: on reconnect, refetch `getGame` to restore full state

---

## 6. Game Rules Summary

- Standard 52-card deck, values 2–14 (Ace = 14), 4 suits
- Shuffled and split 26/26
- Each **Play Turn** advances one step:
  - Normal: both reveal top card → compare → higher wins pile
  - War: tie → each places 1 face-down + 1 face-up → compare again → repeat if tied
- If player lacks 2 cards during war → immediate loss
- Winner of battle collects all pile cards to bottom of deck
- Game ends when opponent has 0 cards or forfeits

---

## 7. WebSocket Events (Backend → Frontend)

All events flow through the single GraphQL subscription `gameUpdated(gameId)`, which pushes the full `Game` object. The frontend derives specific UI states from `Game` fields.

**Implicit events (derived from Game state):**
- `TURN_PLAYED` — `currentBattle.phase === DRAW`
- `WAR_TRIGGERED` — `currentBattle.isWar === true`
- `BATTLE_RESOLVED` — `currentBattle.phase === RESOLVED`
- `GAME_UPDATED` — any state change
- `GAME_ENDED` — `status === ENDED || status === FORFEITED`

---

## 8. Data Models

### 8.1 Shared Types (`packages/types/src/index.ts`)

```typescript
export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';

export interface Card {
  value: number; // 2-14
  suit: Suit;
}

export enum GameStatus {
  WAITING = 'WAITING',
  PLAYING = 'PLAYING',
  ENDED = 'ENDED',
  FORFEITED = 'FORFEITED',
}

export enum BattlePhase {
  DRAW = 'DRAW',
  WAR = 'WAR',
  RESOLVED = 'RESOLVED',
}
```

### 8.2 Backend Runtime Types (`apps/backend/src/types/game.ts`)

```typescript
export interface GameEntity {
  id: string;
  status: GameStatus;
  mode: 'multiplayer' | 'ai';
  players: PlayerEntity[];
  currentBattle: CurrentBattle | null;
  winnerId: string | null;
  logs: BattleLogEntry[];
  activePlayerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerEntity {
  id: string;
  name: string;
  deck: Card[];
  pileCount: number; // alias for deck.length
  isConnected: boolean;
  isAI: boolean;
}

export interface CurrentBattle {
  phase: BattlePhase;
  cards: BattleCard[];
  winnerId: string | null;
  isWar: boolean;
}

export interface BattleCard {
  playerId: string;
  card: Card;
  faceDown: boolean;
}

export interface BattleLogEntry {
  id: string;
  type: 'DRAW' | 'WAR' | 'RESOLVED' | 'FORFEIT' | 'EXPIRED';
  message: string;
  timestamp: Date;
}
```

---

## 9. Implementation Checkpoints

### Checkpoint 0: Project Bootstrap
- [ ] Root `package.json` with npm workspaces
- [ ] `docker-compose.yml` with Redis service
- [ ] Shared packages `types` and `utils` with TypeScript config
- [ ] `apps/backend` package scaffold + Dockerfile
- [ ] `apps/frontend` Nuxt 3 scaffold + Dockerfile
- [ ] Install all dependencies
- [ ] Verify `npm install` succeeds at root
- [ ] Verify `docker-compose up redis` starts Redis successfully

### Checkpoint 1: Shared Packages
- [ ] `packages/types` — enums and interfaces
- [ ] `packages/utils` — `createDeck`, `shuffle`, `compareCards`
- [ ] Unit tests for utils
- [ ] All tests pass

### Checkpoint 2: Backend Core
- [ ] Fastify + Mercurius server boot
- [ ] GraphQL schema + resolvers (Queries, Mutations)
- [ ] `RedisStore` — ioredis wrapper with connection management
- [ ] `GameRepository` — Redis game CRUD (hashes + TTL)
- [ ] `UserRepository` — Redis user CRUD
- [ ] `BattleLogRepository` — Redis list logs with LTRIM
- [ ] `GameService` — `createGame`, `joinGame`, `startGame`, `playTurn`, `leaveGame`
- [ ] `DeckService` — shuffle, split
- [ ] `AIService` — auto-play with delay
- [ ] `RedisPubSub` — Redis pub/sub for subscriptions
- [ ] Battle log persistence on every turn
- [ ] Game TTL refresh on every update
- [ ] Forfeit on `leaveGame`
- [ ] Unit tests for GameService (normal, war, recursive war, insufficient cards)

### Checkpoint 3: Backend Real-Time
- [ ] `graphql-ws` integration with Mercurius
- [ ] `gameUpdated` subscription backed by Redis pub/sub
- [ ] WebSocket broadcasts on all state changes
- [ ] Test subscription via GraphQL playground
- [ ] Verify Redis pub/sub messages are received

### Checkpoint 4: Frontend Foundation
- [ ] Nuxt 3 pages: `/lobby`, `/game/[id]`
- [ ] Tailwind CSS configured
- [ ] Pinia stores: `user`, `game`, `socket`
- [ ] `useGraphQL` composable (mutation + query via `$fetch`)
- [ ] `useGameSocket` composable (subscription via `graphql-ws`)

### Checkpoint 5: Frontend Game UI
- [ ] `GameBoard.vue` — layout shell
- [ ] `DeckPile.vue` — deck with count badge (opponent always visible)
- [ ] `BattleArena.vue` — card reveal area
- [ ] `Card.vue` — card visual
- [ ] `WarIndicator.vue` — animated war banner
- [ ] `GameLog.vue` — scrollable battle history
- [ ] `PlayTurnButton.vue` — disabled state, loading
- [ ] `SpeedControl.vue` — speed selector + auto-play toggle

### Checkpoint 6: Frontend State & Real-Time
- [ ] Lobby: create/join/list games
- [ ] Game page: load game, subscribe to updates
- [ ] Play Turn mutation + optimistic UI
- [ ] Handle `GAME_ENDED` → show winner modal
- [ ] Reconnection logic with exponential backoff
- [ ] Leave game on page close / navigate away

### Checkpoint 7: Docker & End-to-End
- [ ] `docker-compose up` starts Redis + backend together
- [ ] Backend Docker image builds and runs
- [ ] AI mode: create AI game → play full match → verify win/loss
- [ ] Multiplayer: two browser tabs → create + join → play full match
- [ ] War scenario: force tie → verify step-by-step war
- [ ] Forfeit: tab close → opponent wins
- [ ] Expiry: verify Redis TTL cleans up old games

### Checkpoint 8: Documentation
- [ ] `README.md` — setup, run, test, architecture overview
- [ ] `AGENTS.md` — agent quick-start
- [ ] Inline code comments for scalability notes
- [ ] Verify all markdown files are complete

---

## 10. Testing Strategy

| Test File | Coverage |
|---|---|
| `packages/utils/tests/utils.test.ts` | `createDeck` returns 52 cards; `shuffle` randomizes; `compareCards` returns winner |
| `apps/backend/tests/GameService.test.ts` | Normal round; war; recursive war; insufficient cards = loss; AI auto-play |
| `apps/backend/tests/DeckService.test.ts` | Shuffle distribution; split equality |
| `apps/frontend/tests/gameStore.test.ts` | Store init; `setGame` updates; `isMyTurn` computed; `warActive` computed |

Run commands:
```bash
npm run test --workspace=packages/utils
npm run test --workspace=apps/backend
npm run test --workspace=apps/frontend
```

---

## 11. Docker Configuration

### 11.1 docker-compose.yml

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  backend:
    build: ./apps/backend
    ports:
      - "3001:3001"
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=3001
      - NODE_ENV=development
    depends_on:
      - redis
    volumes:
      - ./apps/backend:/app
      - /app/node_modules

  frontend:
    build: ./apps/frontend
    ports:
      - "3000:3000"
    environment:
      - NUXT_PUBLIC_API_URL=http://localhost:3001
      - NUXT_PUBLIC_WS_URL=ws://localhost:3001/graphql
    depends_on:
      - backend
    volumes:
      - ./apps/frontend:/app
      - /app/node_modules

volumes:
  redis-data:
```

### 11.2 Backend Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]
```

### 11.3 Frontend Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

---

## 12. Scalability Notes

### Current Architecture
Redis is used for state, logs, and pub/sub. This is production-grade for moderate scale but still single-node Redis.

### Scaling Path
1. **Redis Store:** Upgrade to Redis Cluster or AWS ElastiCache for high availability.
2. **Pub/Sub:** Redis Pub/Sub already supports multi-instance backends; just point all instances to the same Redis.
3. **WebSocket Connections:** Use a load balancer with sticky sessions or migrate to a managed WebSocket gateway.
4. **Battle Logs:** Move from Redis lists to an append-only event store (PostgreSQL with TimescaleDB, or Kafka) for long-term audit trails.
5. **Game Snapshots:** Snapshot game state to PostgreSQL every N turns for crash recovery. Replay events from snapshot on restart.
6. **AI Service:** Move AI decisions to a separate worker queue (BullMQ + Redis) to decouple from HTTP request cycle.

---

## 13. Run Instructions

### Local Dev (without Docker)
```bash
# Start Redis manually (requires local Redis installed)
redis-server

# Install dependencies
npm install

# Terminal 1 — Backend
npm run dev --workspace=apps/backend
# → http://localhost:3001
# → GraphQL Playground at /graphql

# Terminal 2 — Frontend
npm run dev --workspace=apps/frontend
# → http://localhost:3000
```

### Docker Compose (recommended)
```bash
# Start everything
 docker-compose up --build

# Start only Redis
 docker-compose up redis

# Start backend + Redis
 docker-compose up backend redis

# Start all services
 docker-compose up
```

### Run Tests
```bash
npm run test --workspace=packages/utils
npm run test --workspace=apps/backend
npm run test --workspace=apps/frontend
```

---

## 14. Decisions Log

| Decision | Rationale |
|---|---|
| npm workspaces | Built-in, no extra tooling, matches user's `npm` environment |
| Mercurius over Apollo Server | Native Fastify integration, lower overhead, `graphql-ws` built-in support |
| Single subscription `gameUpdated` | Simpler frontend state management; derive all UI events from full Game object |
| Redis for state + logs + pub/sub | Production-grade in-memory store with TTL, persistence options, and built-in pub/sub |
| Step-by-step war | Dramatic UX; each click reveals one phase of war |
| Nuxt 3.21.2 | Latest stable 3.x line; Nuxt 4.x is `latest` on npm but may introduce breaking changes |
| `tsx` for backend dev | Fast, zero-config TypeScript execution for Node.js |
| Random 5% failure | Simulates real-world instability for robust error handling testing |
| 30-minute TTL | Prevents memory leaks from abandoned games; adjustable via env var |
| Max 100 log entries | Prevents unbounded memory growth in long games |
| Docker Compose | One-command startup for full stack including Redis |
