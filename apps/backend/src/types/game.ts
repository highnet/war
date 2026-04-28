import type { Card, GameStatus, BattlePhase } from '@war/types';

export interface GameEntity {
  id: string;
  status: GameStatus;
  mode: 'multiplayer' | 'ai';
  players: PlayerEntity[];
  currentBattle: CurrentBattle | null;
  winnerId: string | null;
  activePlayerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerEntity {
  id: string;
  name: string;
  deck: Card[];
  pileCount: number;
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
  timestamp: string;
}

export class GameError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'GameError';
  }
}
