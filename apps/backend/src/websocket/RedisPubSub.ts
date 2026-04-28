import { redisStore } from '../store/RedisStore.js';
import { EventEmitter } from 'events';

// SCALE: Redis Pub/Sub already supports multi-instance backends;
// for higher throughput, switch to Redis Streams or a managed gateway.
class RedisPubSub {
  private publisher = redisStore.getClient();
  private subscriber = redisStore.getClient().duplicate();
  private emitters = new Map<string, EventEmitter>();

  constructor() {
    this.subscriber.on('message', (channel, message) => {
      const emitter = this.emitters.get(channel);
      if (emitter) {
        emitter.emit('message', JSON.parse(message));
      }
    });
  }

  async subscribe(topic: string): Promise<AsyncIterableIterator<unknown>> {
    await this.subscriber.subscribe(topic);
    const emitter = new EventEmitter();
    this.emitters.set(topic, emitter);

    const asyncIterator: AsyncIterableIterator<unknown> = {
      [Symbol.asyncIterator]() {
        return asyncIterator;
      },
      async next() {
        return new Promise((resolve) => {
          emitter.once('message', (data) => {
            resolve({ value: data, done: false });
          });
        });
      },
      async return() {
        return { value: undefined, done: true };
      },
      async throw(err) {
        throw err;
      },
    };

    return asyncIterator;
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
