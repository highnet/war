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

      const battle = game.currentBattle;

      // Determine if AI needs to commit
      let shouldCommit = false;

      if (!battle || battle.phase === 'RESOLVED') {
        // New round — AI can start whenever
        shouldCommit = true;
      } else if (battle.phase === 'DRAW' || battle.phase === 'WAR') {
        // Commit phase — check if AI already committed for current step
        const aiCount = battle.cards?.filter((c: { playerId: string }) => c.playerId === aiPlayer.id).length || 0;
        const humanCount = battle.cards?.filter((c: { playerId: string }) => c.playerId !== aiPlayer.id).length || 0;
        shouldCommit = aiCount <= humanCount;
      }
      // REVEAL phase — wait, do nothing

      if (shouldCommit) {
        this.clearTimer(gameId);
        const delay = 600 + Math.random() * 1400; // 0.6s - 2s human-like delay
        const timer = setTimeout(async () => {
          try {
            await gameService.playTurn(gameId, aiPlayer.id);
          } catch (err) {
            console.error('AI playTurn error:', err);
          }
        }, delay);
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
