import { redisStore } from './RedisStore.js';
import type { GameEntity, PlayerEntity, CurrentBattle } from '../types/game.js';
import type { GameStatus, BattleLogEntry } from '@war/types';

const TTL_SECONDS = 1800; // 30 minutes

export class GameRepository {
  private redis = redisStore.getClient();

  private gameKey(id: string): string {
    return `game:${id}`;
  }

  async create(game: GameEntity): Promise<void> {
    const key = this.gameKey(game.id);
    await this.redis.hset(key, {
      id: game.id,
      status: game.status,
      mode: game.mode,
      players: JSON.stringify(game.players),
      currentBattle: JSON.stringify(game.currentBattle),
      winnerId: game.winnerId ?? '',
      activePlayerId: game.activePlayerId ?? '',
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    });
    await this.redis.expire(key, TTL_SECONDS);
  }

  async getById(id: string): Promise<GameEntity | null> {
    const key = this.gameKey(id);
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    return this.deserialize(data);
  }

  async update(game: GameEntity): Promise<void> {
    const key = this.gameKey(game.id);
    game.updatedAt = new Date().toISOString();
    await this.redis.hset(key, {
      id: game.id,
      status: game.status,
      mode: game.mode,
      players: JSON.stringify(game.players),
      currentBattle: JSON.stringify(game.currentBattle),
      winnerId: game.winnerId ?? '',
      activePlayerId: game.activePlayerId ?? '',
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    });
    await this.redis.expire(key, TTL_SECONDS);
  }

  async getAll(): Promise<GameEntity[]> {
    const keys = await this.redis.keys('game:*');
    const games: GameEntity[] = [];
    for (const key of keys) {
      if (key.includes(':logs')) continue;
      const data = await this.redis.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        games.push(this.deserialize(data));
      }
    }
    return games;
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(this.gameKey(id));
    await this.redis.del(`${this.gameKey(id)}:logs`);
  }

  private deserialize(data: Record<string, string>): GameEntity {
    return {
      id: data.id,
      status: data.status as GameStatus,
      mode: data.mode as 'multiplayer' | 'ai',
      players: JSON.parse(data.players || '[]') as PlayerEntity[],
      currentBattle: data.currentBattle ? JSON.parse(data.currentBattle) as CurrentBattle : null,
      winnerId: data.winnerId || null,
      activePlayerId: data.activePlayerId || null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

export const gameRepository = new GameRepository();
