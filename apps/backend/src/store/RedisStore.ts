import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// SCALE: Replace single Redis instance with Redis Cluster or AWS ElastiCache for horizontal scaling
class RedisStore {
  private client: Redis;

  constructor() {
    this.client = new Redis(REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export const redisStore = new RedisStore();
