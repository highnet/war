import { gameService } from '../services/GameService.js';
import { userRepository } from '../store/UserRepository.js';
import { gameRepository } from '../store/GameRepository.js';
import { battleLogRepository } from '../store/BattleLogRepository.js';
import { redisPubSub } from '../websocket/RedisPubSub.js';
import { randomUUID } from 'crypto';

export const resolvers = {
  Query: {
    async getGames() {
      const games = await gameRepository.getAll();
      return Promise.all(games.map(toGraphQLGame));
    },
    async getGame(_: unknown, { gameId }: { gameId: string }) {
      const game = await gameRepository.getById(gameId);
      if (!game) return null;
      return toGraphQLGame(game);
    },
  },
  Mutation: {
    async createUser(_: unknown, { name }: { name: string }) {
      const user = { id: randomUUID(), name, isAI: false };
      await userRepository.create(user);
      return user;
    },
    async createGame(_: unknown, { mode }: { mode: string }) {
      const game = await gameService.createGame(mode as 'multiplayer' | 'ai');
      return toGraphQLGame(game);
    },
    async joinGame(_: unknown, { gameId, userId }: { gameId: string; userId: string }) {
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
    })),
    logs,
  };
}
