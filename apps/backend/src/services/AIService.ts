import { gameService } from './GameService.js';
import { gameRepository } from '../store/GameRepository.js';
import { redisPubSub } from '../websocket/RedisPubSub.js';
import { redisStore } from '../store/RedisStore.js';

// AI Service watches Redis pub/sub for game updates and auto-plays when it's AI's turn
class AIService {
  private subscriber = redisStore.getClient().duplicate({ enableReadyCheck: false });
  private activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  start() {
    this.subscriber.psubscribe('game:*:updates', (err) => {
      if (err) console.error('AI Service subscribe error:', err);
    });

    this.subscriber.on('pmessage', async (_pattern, channel, message) => {
      const gameId = channel.split(':')[1];
      const data = JSON.parse(message);
      const game = data.gameUpdated;
      if (!game) return;

      if (game.status !== 'PLAYING') {
        this.clearTimer(gameId);
        return;
      }

      const aiPlayer = game.players?.find((p: { isAI?: boolean }) => p.isAI);
      if (!aiPlayer) return;

      if (game.activePlayerId === aiPlayer.id) {
        this.clearTimer(gameId);
        const timer = setTimeout(async () => {
          try {
            await gameService.playTurn(gameId, aiPlayer.id);
          } catch (err) {
            console.error('AI playTurn error:', err);
          }
        }, 500);
        this.activeTimers.set(gameId, timer);
      }
    });
  }

  private clearTimer(gameId: string) {
    const existing = this.activeTimers.get(gameId);
    if (existing) {
      clearTimeout(existing);
      this.activeTimers.delete(gameId);
    }
  }

  async stop() {
    for (const [gameId, timer] of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    await this.subscriber.punsubscribe('game:*:updates');
    await this.subscriber.quit();
  }
}

export const aiService = new AIService();
