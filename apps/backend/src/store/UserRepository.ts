import { redisStore } from './RedisStore.js';

export interface UserEntity {
  id: string;
  name: string;
  isAI: boolean;
}

export class UserRepository {
  private redis = redisStore.getClient();

  private userKey(id: string): string {
    return `user:${id}`;
  }

  async create(user: UserEntity): Promise<void> {
    const key = this.userKey(user.id);
    await this.redis.hset(key, {
      id: user.id,
      name: user.name,
      isAI: String(user.isAI),
    });
    await this.redis.expire(key, 86400); // 24 hours
  }

  async getById(id: string): Promise<UserEntity | null> {
    const key = this.userKey(id);
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    return {
      id: data.id,
      name: data.name,
      isAI: data.isAI === 'true',
    };
  }
}

export const userRepository = new UserRepository();
