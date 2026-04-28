import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGameStore } from '../stores/game';
import type { Game, GameStatus, BattlePhase } from '@war/types';

describe('gameStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes empty', () => {
    const store = useGameStore();
    expect(store.game).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('setGame updates state', () => {
    const store = useGameStore();
    const mockGame: Game = {
      id: 'test',
      status: 'PLAYING' as GameStatus,
      mode: 'multiplayer',
      players: [
        { id: 'p1', name: 'Alice', deckSize: 26, pileCount: 26, isConnected: true },
        { id: 'p2', name: 'Bob', deckSize: 26, pileCount: 26, isConnected: true },
      ],
      currentBattle: {
        phase: 'DRAW' as BattlePhase,
        cards: [],
        winnerId: null,
        isWar: false,
      },
      winnerId: null,
      logs: [],
      activePlayerId: 'p1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.setGame(mockGame);
    expect(store.game).toEqual(mockGame);
  });

  it('warActive computed is true when battle phase is WAR', () => {
    const store = useGameStore();
    store.setGame({
      id: 'test',
      status: 'PLAYING' as GameStatus,
      mode: 'multiplayer',
      players: [],
      currentBattle: {
        phase: 'WAR' as BattlePhase,
        cards: [],
        winnerId: null,
        isWar: true,
      },
      winnerId: null,
      logs: [],
      activePlayerId: 'p1',
      createdAt: '',
      updatedAt: '',
    });
    expect(store.warActive).toBe(true);
  });
});
