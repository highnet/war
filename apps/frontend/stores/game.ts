import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Game, Player } from '@war/types';

export const useGameStore = defineStore('game', () => {
  const game = ref<Game | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const myPlayer = computed<Player | null>(() => {
    if (!game.value) return null;
    const userId = localStorage.getItem('war-user-v2');
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

  const isRevealing = computed(() => {
    return game.value?.currentBattle?.phase === 'REVEAL';
  });

  const battleResolved = computed(() => {
    return game.value?.currentBattle?.phase === 'RESOLVED';
  });

  const gameEnded = computed(() => {
    return game.value?.status === 'ENDED' || game.value?.status === 'FORFEITED';
  });

  const canCommit = computed(() => {
    if (!game.value || gameEnded.value) return false;
    const userId = localStorage.getItem('war-user-v2');
    if (!userId) return false;
    const parsed = JSON.parse(userId);
    const battle = game.value.currentBattle;
    if (battle?.phase === 'REVEAL') return false;
    if (battle?.phase === 'RESOLVED') return true; // can start next round
    if (!battle) return true;
    // Check if player already committed for current step
    const myCount = battle.cards.filter((c) => c.playerId === parsed.id).length;
    const opponent = game.value.players.find((p) => p.id !== parsed.id);
    const theirCount = opponent ? battle.cards.filter((c) => c.playerId === opponent.id).length : 0;
    return myCount <= theirCount;
  });

  const hasCommitted = computed(() => {
    if (!game.value) return false;
    const userId = localStorage.getItem('war-user-v2');
    if (!userId) return false;
    const parsed = JSON.parse(userId);
    const battle = game.value.currentBattle;
    if (!battle || battle.phase === 'RESOLVED') return false;
    const myCount = battle.cards.filter((c) => c.playerId === parsed.id).length;
    const opponent = game.value.players.find((p) => p.id !== parsed.id);
    const theirCount = opponent ? battle.cards.filter((c) => c.playerId === opponent.id).length : 0;
    return myCount > theirCount;
  });

  const winnerName = computed(() => {
    if (!game.value?.currentBattle?.winnerId) return null;
    return game.value.players.find((p) => p.id === game.value!.currentBattle!.winnerId)?.name || null;
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
    myPlayer,
    opponentPlayer,
    warActive,
    isRevealing,
    battleResolved,
    gameEnded,
    canCommit,
    hasCommitted,
    winnerName,
    setGame,
    setLoading,
    setError,
  };
});
