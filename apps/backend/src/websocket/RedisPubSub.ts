import { redisStore } from './store/RedisStore.js';
import { MercuriusCommonOptions } from 'mercurius';

// SCALE: Redis Pub/Sub already supports multi-instance backends;
// for higher throughput, switch to Redis Streams or a managed gateway.
class RedisPubSub {
  private publisher = redisStore.getClient();
  private subscriber = redisStore.getClient().duplicate();
  private emitter: MercuriusCommonOptions['subscription']['emitter'];

  constructor() {
    this.emitter = {
      emit: async (event) => {
        await this.publisher.publish(event.topic, JSON.stringify(event.payload));
      },
      on: (topic, listener) => {
        this.subscriber.subscribe(topic, (err) => {
          if (err) console.error('Redis subscribe error:', err);
        });
        this.subscriber.on('message', (channel, message) => {
          if (channel === topic) {
            listener(JSON.parse(message));
          }
        });
      },
    };
  }

  getEmitter(): MercuriusCommonOptions['subscription']['emitter'] {
    return this.emitter;
  }

  async publishGameUpdated(gameId: string, game: unknown): Promise<void> {
    const topic = `game:${gameId}:updates`;
    await this.publisher.publish(topic, JSON.stringify({ gameUpdated: game }));
  }

  async disconnect(): Promise<void> {
    await this.subscriber.quit();
  }
}

export const redisPubSub = new RedisPubSub();
