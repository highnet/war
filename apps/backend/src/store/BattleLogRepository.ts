import { redisStore } from './RedisStore.js';
import type { BattleLogEntry } from '@war/types';

const MAX_LOGS = 100;

export class BattleLogRepository {
  private redis = redisStore.getClient();

  private logKey(gameId: string): string {
    return `game:${gameId}:logs`;
  }

  async append(gameId: string, entry: BattleLogEntry): Promise<void> {
    const key = this.logKey(gameId);
    await this.redis.lpush(key, JSON.stringify(entry));
    await this.redis.ltrim(key, 0, MAX_LOGS - 1);
    await this.redis.expire(key, 1800);
  }

  async getLogs(gameId: string): Promise<BattleLogEntry[]> {
    const key = this.logKey(gameId);
    const items = await this.redis.lrange(key, 0, -1);
    return items.map((item) => JSON.parse(item) as BattleLogEntry).reverse();
  }

  async delete(gameId: string): Promise<void> {
    await this.redis.del(this.logKey(gameId));
  }
}

export const battleLogRepository = new BattleLogRepository();
