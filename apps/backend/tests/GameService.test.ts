import { describe, it, expect, beforeEach } from 'vitest';
import { GameService } from '../src/services/GameService.js';
import { gameRepository } from '../src/store/GameRepository.js';
import { userRepository } from '../src/store/UserRepository.js';
import { battleLogRepository } from '../src/store/BattleLogRepository.js';
import { redisStore } from '../src/store/RedisStore.js';

// Helper to create a user
async function createUser(name: string) {
  const user = { id: crypto.randomUUID(), name, isAI: false };
  await userRepository.create(user);
  return user;
}

describe('GameService', () => {
  beforeEach(async () => {
    const redis = redisStore.getClient();
    const keys = await redis.keys('*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it('creates a game', async () => {
    const service = new GameService();
    const game = await service.createGame('multiplayer');
    expect(game.status).toBe('WAITING');
    expect(game.mode).toBe('multiplayer');
  });

  it('joins a game', async () => {
    const service = new GameService();
    const game = await service.createGame('multiplayer');
    const user = await createUser('Alice');
    const updated = await service.joinGame(game.id, user.id);
    expect(updated.players).toHaveLength(1);
  });

  it('starts a game and splits deck', async () => {
    const service = new GameService();
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);
    const started = await service.startGame(game.id);
    expect(started.status).toBe('PLAYING');
    expect(started.players[0].deck.length).toBe(26);
    expect(started.players[1].deck.length).toBe(26);
  });

  it('plays a normal turn', async () => {
    const service = new GameService();
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);
    let g = await service.startGame(game.id);
    const firstPlayerId = g.activePlayerId!;
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.currentBattle).not.toBeNull();
    expect(g.currentBattle!.phase).toBe('DRAW');
  });

  it('forfeits on leave during PLAYING', async () => {
    const service = new GameService();
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);
    await service.startGame(game.id);
    const left = await service.leaveGame(game.id, alice.id);
    expect(left.status).toBe('FORFEITED');
    expect(left.winnerId).toBe(bob.id);
  });
});
