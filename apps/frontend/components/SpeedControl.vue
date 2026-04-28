<template>
  <div class="flex items-center gap-4">
    <label class="text-sm text-gray-300">Speed:</label>
    <select
      v-model="speed"
      class="bg-gray-700 text-white rounded px-2 py-1 text-sm"
    >
      <option :value="1">1x</option>
      <option :value="2">2x</option>
      <option :value="4">4x</option>
    </select>
    <button
      @click="autoPlay = !autoPlay"
      class="text-sm px-3 py-1 rounded transition"
      :class="autoPlay
        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
      "
    >
      {{ autoPlay ? 'Auto-play ON' : 'Auto-play OFF' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useGameStore } from '~/stores/game';
import { useUserStore } from '~/stores/user';
import { useGraphQL } from '~/composables/useGraphQL';

const speed = ref(1);
const autoPlay = ref(false);
const gameStore = useGameStore();
const userStore = useUserStore();
const { mutate } = useGraphQL();

let interval: ReturnType<typeof setInterval> | null = null;

watch(autoPlay, (val) => {
  if (val) {
    const delay = 800 / speed.value;
    interval = setInterval(async () => {
      if (gameStore.isMyTurn && !gameStore.gameEnded && gameStore.game) {
        try {
          await mutate('playTurn', {
            gameId: gameStore.game.id,
            userId: userStore.id,
          });
        } catch (err) {
          console.error('Auto-play error:', err);
        }
      }
    }, delay);
  } else {
    if (interval) clearInterval(interval);
    interval = null;
  }
});

watch(speed, (val) => {
  if (autoPlay.value) {
    autoPlay.value = false;
    setTimeout(() => { autoPlay.value = true; }, 50);
  }
});
</script>
