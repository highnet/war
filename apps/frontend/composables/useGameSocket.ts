import { useSocketStore } from '~/stores/socket';
import { useGameStore } from '~/stores/game';

export function useGameSocket() {
  const socketStore = useSocketStore();
  const gameStore = useGameStore();

  function connect(gameId: string) {
    socketStore.connect(gameId, (game) => {
      gameStore.setGame(game);
    });
  }

  function disconnect() {
    socketStore.disconnect();
  }

  return { connect, disconnect, status: socketStore.status };
}
