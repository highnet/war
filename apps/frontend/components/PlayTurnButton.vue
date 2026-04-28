<template>
  <div class="flex flex-col items-center gap-2">
    <button
      @click="playTurn"
      :disabled="!canPlay"
      class="px-8 py-3 rounded-lg font-bold text-lg transition"
      :class="buttonClass"
    >
      <span v-if="loading">Playing...</span>
      <span v-else-if="gameStore.gameEnded">Game Over</span>
      <span v-else-if="!gameStore.isMyTurn">Opponent's Turn</span>
      <span v-else>Play Turn</span>
    </button>
    <div v-if="error" class="text-sm text-red-400 max-w-xs text-center">
      {{ error }}
    </div>
  </div>
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
const error = ref<string | null>(null);

const canPlay = computed(() => {
  return gameStore.isMyTurn && !gameStore.gameEnded && !loading.value;
});

const buttonClass = computed(() => {
  if (gameStore.gameEnded) return 'bg-gray-700 text-gray-400 cursor-not-allowed';
  if (gameStore.warActive) return canPlay.value ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed';
  return canPlay.value ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed';
});

async function playTurn() {
  if (!canPlay.value) return;
  if (!gameStore.game) return;
  loading.value = true;
  error.value = null;
  try {
    await mutate('playTurn', {
      gameId: gameStore.game.id,
      userId: userStore.id,
    });
  } catch (err: any) {
    error.value = err.message || 'Turn failed';
    console.error('playTurn error:', err);
  } finally {
    loading.value = false;
  }
}
</script>
