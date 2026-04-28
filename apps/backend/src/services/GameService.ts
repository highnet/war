import { randomUUID } from 'crypto';
import type { Card, GameStatus, BattlePhase, BattleLogEntry } from '@war/types';
import type { GameEntity, PlayerEntity, CurrentBattle, BattleCard, GameError } from '../types/game.js';
import { gameRepository } from '../store/GameRepository.js';
import { userRepository } from '../store/UserRepository.js';
import { battleLogRepository } from '../store/BattleLogRepository.js';
import { deckService as defaultDeckService } from './DeckService.js';
import { redisPubSub } from '../websocket/RedisPubSub.js';

function toGameError(err: unknown): GameError {
  if (err instanceof Error && 'code' in err) {
    return err as GameError;
  }
  const e = new Error(err instanceof Error ? err.message : String(err)) as GameError;
  e.code = 'INTERNAL_ERROR';
  return e;
}

function throwError(code: string, message: string): never {
  const err = new Error(message) as GameError;
  err.code = code;
  throw err;
}

function now(): string {
  return new Date().toISOString();
}

function logEntry(type: BattleLogEntry['type'], message: string): BattleLogEntry {
  return { id: randomUUID(), type, message, timestamp: now() };
}

async function publishAndReturn(game: GameEntity): Promise<GameEntity> {
  await redisPubSub.publishGameUpdated(game.id, toGraphQLGame(game));
  return game;
}

function toGraphQLGame(entity: GameEntity): Record<string, unknown> {
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
  };
}

export class GameService {
  private deckService: { createAndSplit(): [Card[], Card[]] };

  constructor(deckServiceOverride?: { createAndSplit(): [Card[], Card[]] }) {
    this.deckService = deckServiceOverride || defaultDeckService;
  }

  async createGame(mode: 'multiplayer' | 'ai'): Promise<GameEntity> {
    const game: GameEntity = {
      id: randomUUID(),
      status: 'WAITING' as GameStatus,
      mode,
      players: [],
      currentBattle: null,
      winnerId: null,
      activePlayerId: null,
      createdAt: now(),
      updatedAt: now(),
    };

    await gameRepository.create(game);

    if (mode === 'ai') {
      const aiUser = {
        id: randomUUID(),
        name: 'AI Opponent',
        isAI: true,
      };
      await userRepository.create(aiUser);
      game.players.push({
        id: aiUser.id,
        name: aiUser.name,
        deck: [],
        pileCount: 0,
        scorePile: [],
        isConnected: true,
        isAI: true,
      });
      await gameRepository.update(game);
    }

    return publishAndReturn(game);
  }

  async joinGame(gameId: string, userId: string): Promise<GameEntity> {
    const game = await gameRepository.getById(gameId);
    if (!game) throwError('GAME_NOT_FOUND', 'Game not found');
    if (game.status !== 'WAITING') throwError('INVALID_ACTION', 'Game is not waiting for players');
    if (game.players.length >= 2) throwError('INVALID_ACTION', 'Game is full');
    if (game.players.some((p) => p.id === userId)) throwError('INVALID_ACTION', 'Already in game');

    const user = await userRepository.getById(userId);
    if (!user) throwError('GAME_NOT_FOUND', 'User not found');

    game.players.push({
      id: user.id,
      name: user.name,
      deck: [],
      pileCount: 0,
      scorePile: [],
      isConnected: true,
      isAI: user.isAI,
    });

    await gameRepository.update(game);

    // Auto-start when 2 players have joined
    if (game.players.length === 2) {
      return this.startGame(gameId);
    }

    return publishAndReturn(game);
  }

  async startGame(gameId: string): Promise<GameEntity> {
    const game = await gameRepository.getById(gameId);
    if (!game) throwError('GAME_NOT_FOUND', 'Game not found');
    if (game.status !== 'WAITING') throwError('INVALID_ACTION', 'Game already started');
    if (game.players.length !== 2) throwError('INVALID_ACTION', 'Need 2 players to start');

    const [deckA, deckB] = this.deckService.createAndSplit();
    game.players[0].deck = deckA;
    game.players[0].pileCount = deckA.length;
    game.players[0].scorePile = [];
    game.players[1].deck = deckB;
    game.players[1].pileCount = deckB.length;
    game.players[1].scorePile = [];

    game.status = 'PLAYING' as GameStatus;
    game.activePlayerId = game.players[0].id;

    await battleLogRepository.append(gameId, logEntry('DRAW', 'Game started. Player 1 begins.'));
    await gameRepository.update(game);
    return publishAndReturn(game);
  }

  async playTurn(gameId: string, userId: string): Promise<GameEntity> {
    const game = await gameRepository.getById(gameId);
    if (!game) throwError('GAME_NOT_FOUND', 'Game not found');
    if (game.status !== 'PLAYING') throwError('GAME_NOT_STARTED', 'Game not in progress');
    if (game.winnerId) throwError('INVALID_ACTION', 'Game already ended');
    if (game.activePlayerId !== userId) throwError('NOT_YOUR_TURN', 'Not your turn');

    const player = game.players.find((p) => p.id === userId);
    const opponent = game.players.find((p) => p.id !== userId);
    if (!player || !opponent) throwError('GAME_NOT_FOUND', 'Player not found');

    // If current battle is null or resolved, start a new draw
    if (!game.currentBattle || game.currentBattle.phase === 'RESOLVED') {
      return this.resolveDraw(game, player, opponent);
    }

    // If in war, resolve war step
    if (game.currentBattle.phase === 'WAR') {
      return this.resolveWarStep(game, player, opponent);
    }

    throwError('INVALID_ACTION', 'Invalid game state');
  }

  private async resolveDraw(game: GameEntity, player: PlayerEntity, opponent: PlayerEntity): Promise<GameEntity> {
    // Both decks empty -> final scoring
    if (player.deck.length === 0 && opponent.deck.length === 0) {
      return this.finishGameByScore(game, player, opponent);
    }
    // One deck empty -> forfeit
    if (player.deck.length === 0) {
      return this.forfeit(game, player, opponent, `${player.name} has no cards left`);
    }
    if (opponent.deck.length === 0) {
      return this.forfeit(game, opponent, player, `${opponent.name} has no cards left`);
    }

    const cardA = player.deck.shift()!;
    const cardB = opponent.deck.shift()!;

    const battle: CurrentBattle = {
      phase: 'DRAW' as BattlePhase,
      cards: [
        { playerId: player.id, card: cardA, faceDown: false },
        { playerId: opponent.id, card: cardB, faceDown: false },
      ],
      winnerId: null,
      isWar: false,
    };

    game.currentBattle = battle;
    await battleLogRepository.append(game.id, logEntry('DRAW', `${player.name} drew ${cardToString(cardA)}, ${opponent.name} drew ${cardToString(cardB)}`));

    if (cardA.value === cardB.value) {
      battle.phase = 'WAR' as BattlePhase;
      battle.isWar = true;
      await battleLogRepository.append(game.id, logEntry('WAR', 'WAR triggered!'));
      await gameRepository.update(game);
      return publishAndReturn(game);
    }

    const winner = cardA.value > cardB.value ? player : opponent;
    battle.winnerId = winner.id;
    battle.phase = 'RESOLVED' as BattlePhase;

    // Winner collects pile to scorePile
    winner.scorePile.push(...battle.cards.map((c) => c.card));
    winner.pileCount = winner.scorePile.length;
    opponent.pileCount = opponent.scorePile.length;

    await battleLogRepository.append(game.id, logEntry('RESOLVED', `${winner.name} wins the battle!`));

    game.activePlayerId = opponent.id; // Switch turn

    // Check if both decks empty after this draw
    if (player.deck.length === 0 && opponent.deck.length === 0) {
      return this.finishGameByScore(game, player, opponent);
    }

    await gameRepository.update(game);
    return publishAndReturn(game);
  }

  private async resolveWarStep(game: GameEntity, player: PlayerEntity, opponent: PlayerEntity): Promise<GameEntity> {
    // Check if both have enough cards for war (need at least 2: 1 face-down + 1 face-up)
    if (player.deck.length < 2) {
      return this.forfeit(game, player, opponent, `${player.name} has insufficient cards for war`);
    }
    if (opponent.deck.length < 2) {
      return this.forfeit(game, opponent, player, `${opponent.name} has insufficient cards for war`);
    }

    // Each places 1 face-down
    const faceDownA = player.deck.shift()!;
    const faceDownB = opponent.deck.shift()!;
    game.currentBattle!.cards.push(
      { playerId: player.id, card: faceDownA, faceDown: true },
      { playerId: opponent.id, card: faceDownB, faceDown: true }
    );

    // Each places 1 face-up
    const faceUpA = player.deck.shift()!;
    const faceUpB = opponent.deck.shift()!;
    game.currentBattle!.cards.push(
      { playerId: player.id, card: faceUpA, faceDown: false },
      { playerId: opponent.id, card: faceUpB, faceDown: false }
    );

    await battleLogRepository.append(game.id, logEntry('WAR', `${player.name} and ${opponent.name} placed war cards.`));

    if (faceUpA.value === faceUpB.value) {
      // Recursive war
      await battleLogRepository.append(game.id, logEntry('WAR', 'WAR continues!'));
      await gameRepository.update(game);
      return publishAndReturn(game);
    }

    const winner = faceUpA.value > faceUpB.value ? player : opponent;
    game.currentBattle!.winnerId = winner.id;
    game.currentBattle!.phase = 'RESOLVED' as BattlePhase;

    // Winner collects entire pile to scorePile
    winner.scorePile.push(...game.currentBattle!.cards.map((c) => c.card));
    winner.pileCount = winner.scorePile.length;
    opponent.pileCount = opponent.scorePile.length;

    await battleLogRepository.append(game.id, logEntry('RESOLVED', `${winner.name} wins the war!`));

    game.activePlayerId = opponent.id; // Switch turn

    if (player.deck.length === 0 && opponent.deck.length === 0) {
      return this.finishGameByScore(game, player, opponent);
    }

    await gameRepository.update(game);
    return publishAndReturn(game);
  }

  private async finishGameByScore(game: GameEntity, player: PlayerEntity, opponent: PlayerEntity): Promise<GameEntity> {
    const playerScore = player.scorePile.length;
    const opponentScore = opponent.scorePile.length;
    if (playerScore > opponentScore) {
      game.winnerId = player.id;
    } else if (opponentScore > playerScore) {
      game.winnerId = opponent.id;
    } else {
      game.winnerId = null; // Tie
    }
    game.status = 'ENDED' as GameStatus;
    const msg = game.winnerId
      ? `${game.winnerId === player.id ? player.name : opponent.name} wins the game ${Math.max(playerScore, opponentScore)}-${Math.min(playerScore, opponentScore)}!`
      : `Game tied ${playerScore}-${opponentScore}!`;
    await battleLogRepository.append(game.id, logEntry('RESOLVED', msg));
    await gameRepository.update(game);
    return publishAndReturn(game);
  }

  private async forfeit(game: GameEntity, loser: PlayerEntity, winner: PlayerEntity, reason: string): Promise<GameEntity> {
    // Winner gets any remaining cards from both decks added to their score pile
    winner.scorePile.push(...loser.deck, ...winner.deck);
    loser.deck = [];
    winner.deck = [];
    loser.pileCount = loser.scorePile.length;
    winner.pileCount = winner.scorePile.length;
    game.winnerId = winner.id;
    game.status = 'ENDED' as GameStatus;
    await battleLogRepository.append(game.id, logEntry('FORFEIT', reason));
    await battleLogRepository.append(game.id, logEntry('RESOLVED', `${winner.name} wins the game by forfeit!`));
    await gameRepository.update(game);
    return publishAndReturn(game);
  }

  async leaveGame(gameId: string, userId: string): Promise<GameEntity> {
    const game = await gameRepository.getById(gameId);
    if (!game) throwError('GAME_NOT_FOUND', 'Game not found');

    const player = game.players.find((p) => p.id === userId);
    if (!player) throwError('GAME_NOT_FOUND', 'Player not in game');

    player.isConnected = false;

    if (game.status === 'PLAYING') {
      const opponent = game.players.find((p) => p.id !== userId);
      if (opponent) {
        opponent.scorePile.push(...player.deck, ...opponent.deck);
        player.deck = [];
        opponent.deck = [];
        player.pileCount = player.scorePile.length;
        opponent.pileCount = opponent.scorePile.length;
        game.winnerId = opponent.id;
        game.status = 'FORFEITED' as GameStatus;
        await battleLogRepository.append(gameId, logEntry('FORFEIT', `${player.name} left the game. ${opponent.name} wins by forfeit.`));
      }
    }

    await gameRepository.update(game);
    return publishAndReturn(game);
  }
}

function cardToString(card: Card): string {
  const values: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const value = values[card.value] || String(card.value);
  const suits: Record<string, string> = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' };
  return `${value}${suits[card.suit] || card.suit}`;
}

export const gameService = new GameService();
