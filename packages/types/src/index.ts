export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';

export interface Card {
  value: number;
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

export interface BattleLogEntry {
  id: string;
  type: 'DRAW' | 'WAR' | 'RESOLVED' | 'FORFEIT' | 'EXPIRED';
  message: string;
  timestamp: string;
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

export interface Player {
  id: string;
  name: string;
  deckSize: number;
  pileCount: number;
  scoreCount: number;
  isConnected: boolean;
}

export interface Game {
  id: string;
  status: GameStatus;
  mode: string;
  players: Player[];
  currentBattle: CurrentBattle | null;
  winnerId: string | null;
  logs: BattleLogEntry[];
  activePlayerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  isAI: boolean;
}
