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

function mockDeckService(deckA: import('@war/types').Card[], deckB: import('@war/types').Card[]) {
  return {
    createAndSplit(): [typeof deckA, typeof deckB] {
      return [deckA, deckB];
    },
  };
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

  it('auto-starts when 2nd player joins', async () => {
    const service = new GameService();
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    const started = await service.joinGame(game.id, bob.id);
    expect(started.status).toBe('PLAYING');
    expect(started.players[0].deck.length).toBe(26);
    expect(started.players[1].deck.length).toBe(26);
  });

  it('plays a normal turn', async () => {
    const deckA = [
      { value: 10, suit: 'HEARTS' as const },
      { value: 5, suit: 'CLUBS' as const },
    ];
    const deckB = [
      { value: 9, suit: 'DIAMONDS' as const },
      { value: 4, suit: 'HEARTS' as const },
    ];
    const service = new GameService(mockDeckService(deckA, deckB));
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    let g = await service.joinGame(game.id, bob.id);
    const firstPlayerId = g.activePlayerId!;
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.currentBattle).not.toBeNull();
    expect(g.currentBattle!.phase).toBe('RESOLVED');
    // Winner gets cards in scorePile, not deck
    const winner = g.players.find(p => p.id === g.currentBattle!.winnerId)!;
    expect(winner.scorePile.length).toBe(2);
  });

  it('triggers war when cards are equal', async () => {
    const deckA = [
      { value: 10, suit: 'HEARTS' as const },
      { value: 5, suit: 'CLUBS' as const },
      { value: 3, suit: 'DIAMONDS' as const },
      { value: 2, suit: 'SPADES' as const },
    ];
    const deckB = [
      { value: 10, suit: 'DIAMONDS' as const },
      { value: 4, suit: 'HEARTS' as const },
      { value: 3, suit: 'CLUBS' as const },
      { value: 2, suit: 'DIAMONDS' as const },
    ];
    const service = new GameService(mockDeckService(deckA, deckB));
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    let g = await service.joinGame(game.id, bob.id);
    const firstPlayerId = g.activePlayerId!;
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.currentBattle!.phase).toBe('WAR');
    expect(g.currentBattle!.isWar).toBe(true);
  });

  it('resolves war step-by-step', async () => {
    const deckA = [
      { value: 10, suit: 'HEARTS' as const },   // draw
      { value: 5, suit: 'CLUBS' as const },     // war face-down
      { value: 8, suit: 'DIAMONDS' as const },  // war face-up (wins)
    ];
    const deckB = [
      { value: 10, suit: 'DIAMONDS' as const },  // draw
      { value: 4, suit: 'HEARTS' as const },     // war face-down
      { value: 3, suit: 'CLUBS' as const },      // war face-up (loses)
    ];
    const service = new GameService(mockDeckService(deckA, deckB));
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    let g = await service.joinGame(game.id, bob.id);
    const firstPlayerId = g.activePlayerId!;

    // First playTurn triggers war
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.currentBattle!.phase).toBe('WAR');

    // Second playTurn resolves war (same player because activePlayerId doesn't change during war)
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.currentBattle!.phase).toBe('RESOLVED');
    expect(g.currentBattle!.winnerId).toBe(firstPlayerId);
    // Winner gets 6 cards in scorePile (2 draw + 4 war)
    const winner = g.players.find(p => p.id === firstPlayerId)!;
    expect(winner.scorePile.length).toBe(6);
  });

  it('handles recursive war', async () => {
    const deckA = [
      { value: 10, suit: 'HEARTS' as const },
      { value: 5, suit: 'CLUBS' as const },
      { value: 7, suit: 'DIAMONDS' as const },
      { value: 9, suit: 'SPADES' as const },
      { value: 14, suit: 'HEARTS' as const },
    ];
    const deckB = [
      { value: 10, suit: 'DIAMONDS' as const },
      { value: 4, suit: 'HEARTS' as const },
      { value: 7, suit: 'CLUBS' as const },
      { value: 2, suit: 'DIAMONDS' as const },
      { value: 3, suit: 'SPADES' as const },
    ];
    const service = new GameService(mockDeckService(deckA, deckB));
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    let g = await service.joinGame(game.id, bob.id);
    const firstPlayerId = g.activePlayerId!;

    // First playTurn: 10 vs 10 -> WAR
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.currentBattle!.phase).toBe('WAR');

    // Second playTurn: 7 vs 7 -> WAR continues (recursive)
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.currentBattle!.phase).toBe('WAR');

    // Third playTurn: 14 vs 3 -> RESOLVED
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.currentBattle!.phase).toBe('RESOLVED');
    expect(g.currentBattle!.winnerId).toBe(firstPlayerId);
  });

  it('ends game when player has insufficient cards for war', async () => {
    const deckA = [
      { value: 10, suit: 'HEARTS' as const },
    ];
    const deckB = [
      { value: 10, suit: 'DIAMONDS' as const },
      { value: 5, suit: 'CLUBS' as const },
      { value: 3, suit: 'SPADES' as const },
    ];
    const service = new GameService(mockDeckService(deckA, deckB));
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    let g = await service.joinGame(game.id, bob.id);
    const firstPlayerId = g.activePlayerId!;
    const secondPlayerId = g.players.find(p => p.id !== firstPlayerId)!.id;

    // First playTurn triggers war
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.currentBattle!.phase).toBe('WAR');

    // Second playTurn resolves war step, but first player only has 0 cards left -> insufficient
    g = await service.playTurn(game.id, firstPlayerId);
    expect(g.status).toBe('ENDED');
    expect(g.winnerId).toBe(secondPlayerId);
  });

  it('forfeits on leave during PLAYING', async () => {
    const service = new GameService();
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);
    const left = await service.leaveGame(game.id, alice.id);
    expect(left.status).toBe('FORFEITED');
    expect(left.winnerId).toBe(bob.id);
  });
});
