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

const FAST = { revealDelayMs: 50, clearDelayMs: 200, forfeitDelayMs: 50 };

async function flushReveal() {
  await new Promise((r) => setTimeout(r, 120));
}

async function flushClear() {
  await new Promise((r) => setTimeout(r, 350));
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
    const service = new GameService(mockDeckService(deckA, deckB), FAST);
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);

    // Both commit simultaneously
    let g = await service.playTurn(game.id, alice.id);
    expect(g.currentBattle!.phase).toBe('DRAW');
    expect(g.currentBattle!.cards).toHaveLength(1);
    expect(g.currentBattle!.cards[0].faceDown).toBe(true);

    g = await service.playTurn(game.id, bob.id);
    expect(g.currentBattle!.phase).toBe('REVEAL');
    expect(g.currentBattle!.cards).toHaveLength(2);
    expect(g.currentBattle!.cards[0].faceDown).toBe(false);
    expect(g.currentBattle!.cards[1].faceDown).toBe(false);

    // Wait for auto-resolve
    await flushReveal();
    g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('RESOLVED');
    expect(g.currentBattle!.winnerId).toBe(alice.id);

    const winner = g.players.find((p) => p.id === alice.id)!;
    expect(winner.scorePile.length).toBe(2);

    // Wait for auto-clear
    await flushClear();
    g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle).toBeNull();
  });

  it('triggers war when cards are equal', async () => {
    const deckA = [
      { value: 10, suit: 'HEARTS' as const },
      { value: 5, suit: 'CLUBS' as const },
      { value: 8, suit: 'DIAMONDS' as const },
      { value: 2, suit: 'SPADES' as const },
    ];
    const deckB = [
      { value: 10, suit: 'DIAMONDS' as const },
      { value: 4, suit: 'HEARTS' as const },
      { value: 3, suit: 'CLUBS' as const },
      { value: 2, suit: 'DIAMONDS' as const },
    ];
    const service = new GameService(mockDeckService(deckA, deckB), FAST);
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);

    // Both commit draw
    let g = await service.playTurn(game.id, alice.id);
    g = await service.playTurn(game.id, bob.id);
    expect(g.currentBattle!.phase).toBe('REVEAL');

    // Wait for reveal -> WAR
    await flushReveal();
    g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('WAR');
    expect(g.currentBattle!.isWar).toBe(true);

    // Both commit war face-down
    g = await service.playTurn(game.id, alice.id);
    expect(g.currentBattle!.phase).toBe('WAR');
    g = await service.playTurn(game.id, bob.id);
    expect(g.currentBattle!.cards).toHaveLength(4);
    expect(g.currentBattle!.phase).toBe('WAR'); // stays WAR, no reveal for face-down

    // Both commit war face-up
    g = await service.playTurn(game.id, alice.id);
    expect(g.currentBattle!.phase).toBe('WAR');
    g = await service.playTurn(game.id, bob.id);
    expect(g.currentBattle!.phase).toBe('REVEAL');
    // Last two cards (war face-up) are flipped
    expect(g.currentBattle!.cards[2].faceDown).toBe(true);  // war face-down stays hidden
    expect(g.currentBattle!.cards[3].faceDown).toBe(true);  // war face-down stays hidden
    expect(g.currentBattle!.cards[4].faceDown).toBe(false); // war face-up flipped
    expect(g.currentBattle!.cards[5].faceDown).toBe(false); // war face-up flipped

    // Wait for war resolve
    await flushReveal();
    g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('RESOLVED');
  });

  it('resolves war step-by-step', async () => {
    const deckA = [
      { value: 10, suit: 'HEARTS' as const },
      { value: 5, suit: 'CLUBS' as const },
      { value: 8, suit: 'DIAMONDS' as const },
    ];
    const deckB = [
      { value: 10, suit: 'DIAMONDS' as const },
      { value: 4, suit: 'HEARTS' as const },
      { value: 3, suit: 'CLUBS' as const },
    ];
    const service = new GameService(mockDeckService(deckA, deckB), FAST);
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);

    // Draw
    await service.playTurn(game.id, alice.id);
    await service.playTurn(game.id, bob.id);
    await flushReveal();
    let g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('WAR');

    // War face-down
    await service.playTurn(game.id, alice.id);
    await service.playTurn(game.id, bob.id);

    // War face-up
    await service.playTurn(game.id, alice.id);
    await service.playTurn(game.id, bob.id);
    g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('REVEAL');

    await flushReveal();
    g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('RESOLVED');
    expect(g.currentBattle!.winnerId).toBe(alice.id);

    const winner = g.players.find((p) => p.id === alice.id)!;
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
    const service = new GameService(mockDeckService(deckA, deckB), FAST);
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);

    // Draw -> WAR
    await service.playTurn(game.id, alice.id);
    await service.playTurn(game.id, bob.id);
    await flushReveal();
    let g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('WAR');

    // War round 1 face-down
    await service.playTurn(game.id, alice.id);
    await service.playTurn(game.id, bob.id);

    // War round 1 face-up -> tie -> WAR continues
    await service.playTurn(game.id, alice.id);
    await service.playTurn(game.id, bob.id);
    await flushReveal();
    g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('WAR');

    // War round 2 face-down
    await service.playTurn(game.id, alice.id);
    await service.playTurn(game.id, bob.id);

    // War round 2 face-up -> RESOLVED
    await service.playTurn(game.id, alice.id);
    await service.playTurn(game.id, bob.id);
    await flushReveal();
    g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('RESOLVED');
    expect(g.currentBattle!.winnerId).toBe(alice.id);
  });

  it('ties war when player has insufficient cards for war', async () => {
    const deckA = [
      { value: 10, suit: 'HEARTS' as const },
    ];
    const deckB = [
      { value: 10, suit: 'DIAMONDS' as const },
      { value: 5, suit: 'CLUBS' as const },
      { value: 3, suit: 'SPADES' as const },
    ];
    const service = new GameService(mockDeckService(deckA, deckB), FAST);
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);

    // Draw -> WAR
    await service.playTurn(game.id, alice.id);
    await service.playTurn(game.id, bob.id);
    await flushReveal();
    let g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle!.phase).toBe('WAR');

    // Alice has 0 cards left. Alice tries to commit war face-down -> war ties
    g = await service.playTurn(game.id, alice.id);
    expect(g.status).toBe('PLAYING');
    expect(g.currentBattle!.phase).toBe('RESOLVED');
    expect(g.currentBattle!.winnerId).toBeNull();

    // After clear, both players should have their cards back
    await flushClear();
    g = (await gameRepository.getById(game.id))!;
    expect(g.currentBattle).toBeNull();
    // Alice got her 10 back, Bob still has his 3 cards
    expect(g.players.find((p) => p.name === 'Alice')!.deck.length).toBe(1);
    expect(g.players.find((p) => p.name === 'Bob')!.deck.length).toBe(3);
  });

  it('forfeits on leave during PLAYING', async () => {
    const service = new GameService();
    const game = await service.createGame('multiplayer');
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    await service.joinGame(game.id, alice.id);
    await service.joinGame(game.id, bob.id);
    const left = await service.leaveGame(game.id, alice.id);
    expect(left).not.toBeNull();
    expect(left!.status).toBe('FORFEITED');
    expect(left!.winnerId).toBe(bob.id);
  });
});
