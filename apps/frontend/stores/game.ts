import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Game, Player } from '@war/types';

export const useGameStore = defineStore('game', () => {
  const game = ref<Game | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isMyTurn = computed(() => {
    if (!game.value) return false;
    const userId = localStorage.getItem('war-user');
    if (!userId) return false;
    const parsed = JSON.parse(userId);
    return game.value.activePlayerId === parsed.id;
  });

  const myPlayer = computed<Player | null>(() => {
    if (!game.value) return null;
    const userId = localStorage.getItem('war-user');
    if (!userId) return null;
    const parsed = JSON.parse(userId);
    return game.value.players.find((p) => p.id === parsed.id) || null;
  });

  const opponentPlayer = computed<Player | null>(() => {
    if (!game.value) return null;
    return game.value.players.find((p) => p.id !== myPlayer.value?.id) || null;
  });

  const warActive = computed(() => {
    return game.value?.currentBattle?.phase === 'WAR';
  });

  const battleResolved = computed(() => {
    return game.value?.currentBattle?.phase === 'RESOLVED';
  });

  const gameEnded = computed(() => {
    return game.value?.status === 'ENDED' || game.value?.status === 'FORFEITED';
  });

  function setGame(newGame: Game) {
    game.value = newGame;
  }

  function setLoading(val: boolean) {
    loading.value = val;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  return {
    game,
    loading,
    error,
    isMyTurn,
    myPlayer,
    opponentPlayer,
    warActive,
    battleResolved,
    gameEnded,
    setGame,
    setLoading,
    setError,
  };
});
