import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { Game, Player } from '@war/types';

export const useGameStore = defineStore('game', () => {
  const game = ref<Game | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isClearing = ref(false);
  let clearingTimeout: ReturnType<typeof setTimeout> | null = null;

  // Stable user ID — set once on game load, never re-read from localStorage
  const currentUserId = ref<string>('');

  const myPlayer = computed<Player | null>(() => {
    if (!game.value || !currentUserId.value) return null;
    return game.value.players.find((p) => p.id === currentUserId.value) || null;
  });

  const opponentPlayer = computed<Player | null>(() => {
    if (!game.value || !currentUserId.value) return null;
    return game.value.players.find((p) => p.id !== currentUserId.value) || null;
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

  // Lock commits during the visual clear animation after a battle resolves
  watch(battleResolved, (resolved) => {
    if (resolved) {
      isClearing.value = true;
      if (clearingTimeout) clearTimeout(clearingTimeout);
      clearingTimeout = setTimeout(() => {
        isClearing.value = false;
      }, 1200);
    }
  });

  const gameEnded = computed(() => {
    return game.value?.status === 'ENDED' || game.value?.status === 'FORFEITED';
  });

  const canCommit = computed(() => {
    if (!game.value || gameEnded.value) return false;
    if (isClearing.value) return false;
    if (!currentUserId.value) return false;
    const battle = game.value.currentBattle;
    if (battle?.phase === 'REVEAL') return false;
    if (battle?.phase === 'RESOLVED') return false; // wait for clear animation
    if (!battle) return true;
    // Check if player already committed for current step
    const myCount = battle.cards.filter((c) => c.playerId === currentUserId.value).length;
    const opponent = game.value.players.find((p) => p.id !== currentUserId.value);
    const theirCount = opponent ? battle.cards.filter((c) => c.playerId === opponent.id).length : 0;
    return myCount <= theirCount;
  });

  const hasCommitted = computed(() => {
    if (!game.value || !currentUserId.value) return false;
    const battle = game.value.currentBattle;
    if (!battle || battle.phase === 'RESOLVED') return false;
    const myCount = battle.cards.filter((c) => c.playerId === currentUserId.value).length;
    const opponent = game.value.players.find((p) => p.id !== currentUserId.value);
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

  function setCurrentUserId(id: string) {
    currentUserId.value = id;
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
    isClearing,
    currentUserId,
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
    setCurrentUserId,
    setLoading,
    setError,
  };
});
