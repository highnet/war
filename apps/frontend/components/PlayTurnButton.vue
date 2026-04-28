<template>
  <button
    @click="playTurn"
    :disabled="!canPlay"
    class="px-8 py-3 rounded-lg font-bold text-lg transition"
    :class="canPlay
      ? 'bg-green-600 hover:bg-green-700 text-white'
      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
    "
  >
    <span v-if="loading">Playing...</span>
    <span v-else-if="gameStore.gameEnded">Game Over</span>
    <span v-else-if="!gameStore.isMyTurn">Opponent's Turn</span>
    <span v-else>Play Turn</span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameStore } from '~/stores/game';
import { useUserStore } from '~/stores/user';
import { useGraphQL } from '~/composables/useGraphQL';

const gameStore = useGameStore();
const userStore = useUserStore();
const { mutate } = useGraphQL();
const loading = ref(false);

const canPlay = computed(() => {
  return gameStore.isMyTurn && !gameStore.gameEnded && !loading.value;
});

async function playTurn() {
  if (!canPlay.value) return;
  if (!gameStore.game) return;
  loading.value = true;
  try {
    await mutate('playTurn', {
      gameId: gameStore.game.id,
      userId: userStore.id,
    });
  } catch (err) {
    console.error('playTurn error:', err);
  } finally {
    loading.value = false;
  }
}
</script>
