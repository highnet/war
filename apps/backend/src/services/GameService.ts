import { randomUUID } from 'crypto';
import type { Card, GameStatus, BattlePhase, BattleLogEntry } from '@war/types';
import type { GameEntity, PlayerEntity, CurrentBattle, GameError } from '../types/game.js';
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
  await redisPubSub.publishGameUpdated(game.id, await toGraphQLGame(game));
  return game;
}

async function toGraphQLGame(entity: GameEntity): Promise<Record<string, unknown>> {
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

function cardToString(card: Card): string {
  const values: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const value = values[card.value] || String(card.value);
  const suits: Record<string, string> = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' };
  return `${value}${suits[card.suit] || card.suit}`;
}

export class GameService {
  private deckService: { createAndSplit(): [Card[], Card[]] };
  private timeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private revealDelayMs: number;
  private clearDelayMs: number;
  private forfeitDelayMs: number;

  constructor(
    deckServiceOverride?: { createAndSplit(): [Card[], Card[]] },
    options?: { revealDelayMs?: number; clearDelayMs?: number; forfeitDelayMs?: number }
  ) {
    this.deckService = deckServiceOverride || defaultDeckService;
    this.revealDelayMs = options?.revealDelayMs ?? 1500;
    this.clearDelayMs = options?.clearDelayMs ?? 2000;
    this.forfeitDelayMs = options?.forfeitDelayMs ?? 30000;
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
      commitDeadline: null,
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
    game.commitDeadline = null;

    await battleLogRepository.append(gameId, logEntry('DRAW', 'Game started!'));
    await gameRepository.update(game);
    return publishAndReturn(game);
  }

  async playTurn(gameId: string, userId: string): Promise<GameEntity> {
    const game = await gameRepository.getById(gameId);
    if (!game) throwError('GAME_NOT_FOUND', 'Game not found');
    if (game.status !== 'PLAYING') throwError('GAME_NOT_STARTED', 'Game not in progress');
    if (game.winnerId) throwError('INVALID_ACTION', 'Game already ended');

    const player = game.players.find((p) => p.id === userId);
    const opponent = game.players.find((p) => p.id !== userId);
    if (!player || !opponent) throwError('GAME_NOT_FOUND', 'Player not found');

    // Reject during reveal animation
    if (game.currentBattle?.phase === 'REVEAL') {
      throwError('REVEALING', 'Cards are being revealed');
    }

    // Check if player already committed for current step
    if (game.currentBattle && game.currentBattle.phase !== 'RESOLVED') {
      const myCount = game.currentBattle.cards.filter((c) => c.playerId === userId).length;
      const theirCount = game.currentBattle.cards.filter((c) => c.playerId === opponent.id).length;
      if (myCount > theirCount) {
        throwError('ALREADY_COMMITTED', 'You already played this round');
      }
    }

    return this.commitCard(game, player, opponent);
  }

  private async commitCard(game: GameEntity, player: PlayerEntity, opponent: PlayerEntity): Promise<GameEntity> {
    if (player.deck.length === 0) {
      if (game.currentBattle?.isWar) {
        return this.resolveWarTie(game);
      }
      return this.forfeit(game, player, opponent, `${player.name} has no cards left`);
    }

    const card = player.deck.shift()!;

    // Create new battle if needed
    if (!game.currentBattle || game.currentBattle.phase === 'RESOLVED') {
      game.currentBattle = {
        phase: 'DRAW' as BattlePhase,
        cards: [],
        winnerId: null,
        isWar: false,
      };
    }

    const battle = game.currentBattle;
    battle.cards.push({ playerId: player.id, card, faceDown: true });

    const myCount = battle.cards.filter((c) => c.playerId === player.id).length;
    const theirCount = battle.cards.filter((c) => c.playerId === opponent.id).length;

    if (myCount !== theirCount) {
      // Waiting for opponent to commit
      game.commitDeadline = new Date(Date.now() + 30000).toISOString();
      await gameRepository.update(game);
      await publishAndReturn(game);
      this.scheduleTimeout(game.id, this.forfeitDelayMs, () => this.checkForfeit(game.id));
      return game;
    }

    // Both committed for this step — clear forfeit timer
    this.clearTimeout(game.id);
    game.commitDeadline = null;

    const totalPairs = battle.cards.length / 2;
    const isRevealStep = totalPairs === 1 || totalPairs % 2 === 1;

    if (isRevealStep) {
      // Flip this step's cards face-up and enter REVEAL
      const stepCards = battle.cards.slice(-2);
      for (const c of stepCards) c.faceDown = false;
      battle.phase = 'REVEAL' as BattlePhase;
      await gameRepository.update(game);
      await publishAndReturn(game);
      this.scheduleTimeout(game.id, this.revealDelayMs, () => this.resolveReveal(game.id));
      return game;
    }

    // War face-down step — stay in WAR, no reveal
    await gameRepository.update(game);
    await publishAndReturn(game);
    return game;
  }

  private async resolveReveal(gameId: string) {
    const game = await gameRepository.getById(gameId);
    if (!game || game.status !== 'PLAYING') return;
    const battle = game.currentBattle;
    if (!battle || battle.phase !== 'REVEAL') return;

    const [playerA, playerB] = game.players;
    const totalPairs = battle.cards.length / 2;

    if (totalPairs === 1) {
      // Draw reveal resolve — find each player's card by playerId, NOT by array index
      const cardA = battle.cards.find((c) => c.playerId === playerA.id)!;
      const cardB = battle.cards.find((c) => c.playerId === playerB.id)!;
      await battleLogRepository.append(gameId, logEntry('DRAW', `${playerA.name} drew ${cardToString(cardA.card)}, ${playerB.name} drew ${cardToString(cardB.card)}`));

      if (cardA.card.value === cardB.card.value) {
        battle.phase = 'WAR' as BattlePhase;
        battle.isWar = true;
        await battleLogRepository.append(gameId, logEntry('WAR', 'WAR triggered!'));
        await gameRepository.update(game);
        await publishAndReturn(game);
        return;
      }

      // Resolve draw
      const winner = cardA.card.value > cardB.card.value ? playerA : playerB;
      const loser = cardA.card.value > cardB.card.value ? playerB : playerA;
      battle.winnerId = winner.id;
      battle.phase = 'RESOLVED' as BattlePhase;
      winner.scorePile.push(...battle.cards.map((c) => c.card));
      winner.pileCount = winner.scorePile.length;
      loser.pileCount = loser.scorePile.length;
      await battleLogRepository.append(gameId, logEntry('RESOLVED', `${winner.name} wins the battle!`));

      // Alternate starter for next round
      const roundStarter = battle.cards[0].playerId;
      game.activePlayerId = game.players.find((p) => p.id !== roundStarter)?.id || null;

      await gameRepository.update(game);
      await publishAndReturn(game);
      this.scheduleTimeout(game.id, this.clearDelayMs, () => this.clearBattle(game.id));
      return;
    }

    // War face-up reveal resolve — find each player's last (face-up) card by playerId
    const cardsA = battle.cards.filter((c) => c.playerId === playerA.id);
    const cardsB = battle.cards.filter((c) => c.playerId === playerB.id);
    const faceUpA = cardsA[cardsA.length - 1];
    const faceUpB = cardsB[cardsB.length - 1];

    if (faceUpA.card.value === faceUpB.card.value) {
      await battleLogRepository.append(gameId, logEntry('WAR', 'WAR continues!'));
      battle.phase = 'WAR' as BattlePhase;
      await gameRepository.update(game);
      await publishAndReturn(game);
      return;
    }

    // War resolved
    const winner = faceUpA.card.value > faceUpB.card.value ? playerA : playerB;
    const loser = faceUpA.card.value > faceUpB.card.value ? playerB : playerA;
    battle.winnerId = winner.id;
    battle.phase = 'RESOLVED' as BattlePhase;
    winner.scorePile.push(...battle.cards.map((c) => c.card));
    winner.pileCount = winner.scorePile.length;
    loser.pileCount = loser.scorePile.length;
    await battleLogRepository.append(gameId, logEntry('RESOLVED', `${winner.name} wins the war!`));

    const roundStarter = battle.cards[0].playerId;
    game.activePlayerId = game.players.find((p) => p.id !== roundStarter)?.id || null;

    await gameRepository.update(game);
    await publishAndReturn(game);
    this.scheduleTimeout(game.id, this.clearDelayMs, () => this.clearBattle(game.id));
  }

  private async resolveWarTie(game: GameEntity): Promise<GameEntity> {
    this.clearTimeout(game.id);
    const battle = game.currentBattle!;

    // Return each player's committed cards to their own deck
    for (const c of battle.cards) {
      const owner = game.players.find((p) => p.id === c.playerId);
      if (owner) {
        owner.deck.push(c.card);
      }
    }

    battle.winnerId = null;
    battle.phase = 'RESOLVED' as BattlePhase;
    game.commitDeadline = null;

    await battleLogRepository.append(game.id, logEntry('RESOLVED', 'War ends in a tie — cards returned to owners'));
    await gameRepository.update(game);
    await publishAndReturn(game);

    this.scheduleTimeout(game.id, this.clearDelayMs, () => this.clearBattle(game.id));
    return game;
  }

  private async clearBattle(gameId: string) {
    const game = await gameRepository.getById(gameId);
    if (!game || game.status !== 'PLAYING') return;
    if (!game.currentBattle || game.currentBattle.phase !== 'RESOLVED') return;

    // Check if game should end after battle clear
    const playerA = game.players[0];
    const playerB = game.players[1];

    if (playerA.deck.length === 0 && playerB.deck.length === 0) {
      await this.finishGameByScore(game, playerA, playerB);
      return;
    }

    game.currentBattle = null;
    await gameRepository.update(game);
    await publishAndReturn(game);
  }

  private async checkForfeit(gameId: string) {
    const game = await gameRepository.getById(gameId);
    if (!game || game.status !== 'PLAYING') return;
    if (game.commitDeadline && new Date(game.commitDeadline) > new Date()) return;

    const battle = game.currentBattle;
    if (!battle) return;

    const counts = game.players.map((p) => ({
      player: p,
      count: battle.cards.filter((c) => c.playerId === p.id).length,
    }));
    const maxCount = Math.max(...counts.map((c) => c.count));
    const missing = counts.find((c) => c.count < maxCount);

    if (missing) {
      if (battle.isWar) {
        const other = counts.find((c) => c.player.id !== missing.player.id)!;
        await this.resolveWarTie(game);
        return;
      }
      const winner = counts.find((c) => c.player.id !== missing.player.id)!;
      await this.forfeit(game, missing.player, winner.player, `${missing.player.name} ran out of time`);
    }
  }

  private async finishGameByScore(game: GameEntity, playerA: PlayerEntity, playerB: PlayerEntity): Promise<GameEntity> {
    this.clearTimeout(game.id);
    const scoreA = playerA.scorePile.length;
    const scoreB = playerB.scorePile.length;
    if (scoreA > scoreB) {
      game.winnerId = playerA.id;
    } else if (scoreB > scoreA) {
      game.winnerId = playerB.id;
    } else {
      game.winnerId = null;
    }
    game.status = 'ENDED' as GameStatus;
    const msg = game.winnerId
      ? `${game.winnerId === playerA.id ? playerA.name : playerB.name} wins the game ${Math.max(scoreA, scoreB)}-${Math.min(scoreA, scoreB)}!`
      : `Game tied ${scoreA}-${scoreB}!`;
    await battleLogRepository.append(game.id, logEntry('RESOLVED', msg));
    await gameRepository.update(game);
    return publishAndReturn(game);
  }

  private async forfeit(game: GameEntity, loser: PlayerEntity, winner: PlayerEntity, reason: string): Promise<GameEntity> {
    this.clearTimeout(game.id);
    winner.scorePile.push(...loser.deck, ...winner.deck);
    loser.deck = [];
    winner.deck = [];
    loser.pileCount = loser.scorePile.length;
    winner.pileCount = winner.scorePile.length;
    game.winnerId = winner.id;
    game.status = 'ENDED' as GameStatus;
    game.commitDeadline = null;
    await battleLogRepository.append(game.id, logEntry('FORFEIT', reason));
    await battleLogRepository.append(game.id, logEntry('RESOLVED', `${winner.name} wins the game by forfeit!`));
    await gameRepository.update(game);
    return publishAndReturn(game);
  }

  async leaveGame(gameId: string, userId: string): Promise<GameEntity | null> {
    const game = await gameRepository.getById(gameId);
    if (!game) throwError('GAME_NOT_FOUND', 'Game not found');

    const player = game.players.find((p) => p.id === userId);
    if (!player) throwError('GAME_NOT_FOUND', 'Player not in game');

    // If game hasn't started yet, delete it entirely so it doesn't become a ghost lobby
    if (game.status === 'WAITING') {
      await gameRepository.delete(gameId);
      return null;
    }

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
        game.commitDeadline = null;
        this.clearTimeout(game.id);
        await battleLogRepository.append(gameId, logEntry('FORFEIT', `${player.name} left. ${opponent.name} wins by forfeit.`));
      }
    }

    await gameRepository.update(game);
    return publishAndReturn(game);
  }

  private scheduleTimeout(gameId: string, delayMs: number, action: () => Promise<void> | void) {
    this.clearTimeout(gameId);
    const timeout = setTimeout(async () => {
      try {
        await action();
      } catch (err) {
        console.error('Game timeout error:', err);
      }
    }, delayMs);
    this.timeouts.set(gameId, timeout);
  }

  private clearTimeout(gameId: string) {
    const t = this.timeouts.get(gameId);
    if (t) {
      globalThis.clearTimeout(t);
      this.timeouts.delete(gameId);
    }
  }
}

export const gameService = new GameService();
