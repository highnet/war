import type { MercuriusContext } from 'mercurius';
import { gameService } from '../services/GameService.js';
import { userRepository } from '../store/UserRepository.js';
import { gameRepository } from '../store/GameRepository.js';
import { battleLogRepository } from '../store/BattleLogRepository.js';
import { redisPubSub } from '../websocket/RedisPubSub.js';
import { randomUUID } from 'crypto';

const ADJECTIVES = [
  'Fierce', 'Swift', 'Brave', 'Lucky', 'Mighty', 'Clever', 'Wild', 'Royal',
  'Bold', 'Sly', 'Cunning', 'Fearless', 'Noble', 'Savage', 'Sneaky',
  'Frosty', 'Blazing', 'Shadow', 'Iron', 'Golden',
];
const NOUNS = [
  'Tiger', 'Hawk', 'Wolf', 'Dragon', 'Shark', 'Eagle', 'Bear', 'Lion',
  'Fox', 'Cobra', 'Ace', 'King', 'Queen', 'Jack', 'Spade', 'Heart',
  'Diamond', 'Club', 'Raven', 'Phoenix', 'Viper', 'Stallion',
];

function randomName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n}`;
}

export const resolvers = {
  Query: {
    async getGames(_: unknown, _args: unknown, ctx: MercuriusContext) {
      const allGames = await gameRepository.getAll();
      // Only show games the caller is NOT in that are joinable (WAITING with room)
      const joinable = allGames.filter(
        (g) =>
          g.status === 'WAITING' &&
          g.players.length < 2 &&
          g.players.every((p) => p.isConnected)
      );
      return Promise.all(joinable.map(toGraphQLGame));
    },
    async getGame(_: unknown, { gameId }: { gameId: string }) {
      const game = await gameRepository.getById(gameId);
      if (!game) return null;
      return toGraphQLGame(game);
    },
    async myActiveGame(_: unknown, { userId }: { userId: string }) {
      const allGames = await gameRepository.getAll();
      const active = allGames.find(
        (g) =>
          g.status !== 'ENDED' &&
          g.status !== 'FORFEITED' &&
          g.players.some((p) => p.id === userId)
      );
      if (!active) return null;
      return toGraphQLGame(active);
    },
  },
  Mutation: {
    async createUser(_: unknown, { name }: { name?: string }) {
      const userName = name?.trim() || randomName();
      const user = { id: randomUUID(), name: userName, isAI: false };
      await userRepository.create(user);
      return user;
    },
    async createGame(_: unknown, { mode }: { mode: string }) {
      const game = await gameService.createGame(mode as 'multiplayer' | 'ai');
      return toGraphQLGame(game);
    },
    async findOrCreateGame(_: unknown, { mode, userId }: { mode: string; userId: string }) {
      // Auto-create user if missing (e.g. Redis cleared or stale localStorage)
      const user = await userRepository.getById(userId);
      if (!user) {
        const newUser = { id: userId, name: randomName(), isAI: false };
        await userRepository.create(newUser);
      }

      // Rule: a player can only be in ONE active game at a time.
      // If already in a non-finished game, return them to it.
      const allGames = await gameRepository.getAll();
      const myActiveGame = allGames.find(
        (g) =>
          g.status !== 'ENDED' &&
          g.status !== 'FORFEITED' &&
          g.players.some((p) => p.id === userId)
      );
      if (myActiveGame) {
        return toGraphQLGame(myActiveGame);
      }

      // Pre-emptively clean up any stale AI WAITING games (should never happen, but Redis persists)
      if (mode === 'ai') {
        const staleAiGames = allGames.filter(
          (g) => g.mode === 'ai' && g.status === 'WAITING'
        );
        for (const stale of staleAiGames) {
          await gameRepository.delete(stale.id);
        }
      }

      if (mode === 'multiplayer') {
        const openGame = allGames.find(
          (g) =>
            g.status === 'WAITING' &&
            g.mode === 'multiplayer' &&
            g.players.length < 2 &&
            g.players.every((p) => p.isConnected) &&
            !g.players.some((p) => p.id === userId)
        );
        if (openGame) {
          const game = await gameService.joinGame(openGame.id, userId);
          return toGraphQLGame(game);
        }
      }
      const game = await gameService.createGame(mode as 'multiplayer' | 'ai');
      const joined = await gameService.joinGame(game.id, userId);
      return toGraphQLGame(joined);
    },
    async joinGame(_: unknown, { gameId, userId }: { gameId: string; userId: string }) {
      const user = await userRepository.getById(userId);
      if (!user) {
        const newUser = { id: userId, name: randomName(), isAI: false };
        await userRepository.create(newUser);
      }
      // Prevent joining if already in another active game
      const allGames = await gameRepository.getAll();
      const myOtherActive = allGames.find(
        (g) =>
          g.id !== gameId &&
          g.status !== 'ENDED' &&
          g.status !== 'FORFEITED' &&
          g.players.some((p) => p.id === userId)
      );
      if (myOtherActive) {
        return toGraphQLGame(myOtherActive);
      }
      const game = await gameService.joinGame(gameId, userId);
      return toGraphQLGame(game);
    },
    async startGame(_: unknown, { gameId }: { gameId: string }) {
      const game = await gameService.startGame(gameId);
      return toGraphQLGame(game);
    },
    async playTurn(_: unknown, { gameId, userId }: { gameId: string; userId: string }) {
      const game = await gameService.playTurn(gameId, userId);
      return toGraphQLGame(game);
    },
    async leaveGame(_: unknown, { gameId, userId }: { gameId: string; userId: string }) {
      const game = await gameService.leaveGame(gameId, userId);
      return toGraphQLGame(game);
    },
  },
  Subscription: {
    gameUpdated: {
      subscribe: async (_: unknown, { gameId }: { gameId: string }) => {
        const topic = `game:${gameId}:updates`;
        return redisPubSub.subscribe(topic);
      },
    },
  },
};

async function toGraphQLGame(entity: Awaited<ReturnType<typeof gameRepository.getById>>) {
  if (!entity) return null;
  const logs = await battleLogRepository.getLogs(entity.id);
  return {
    ...entity,
    players: entity.players.map((p) => ({
      id: p.id,
      name: p.name,
      deckSize: p.deck.length,
      pileCount: p.scorePile.length,
      scoreCount: p.scorePile.length,
      isConnected: p.isConnected,
      isAI: p.isAI,
    })),
    logs,
  };
}
