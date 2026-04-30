<template>
  <!-- Fixed-height container prevents layout shifts -->
  <div class="flex flex-col items-center gap-1 min-h-[4.5rem]">
    <div
      class="relative w-12 h-12 transition-opacity duration-300"
      :class="showTimer ? 'opacity-100' : 'opacity-0'"
    >
      <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <path
          class="text-gray-700"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
        />
        <path
          class="text-yellow-400 transition-all duration-1000 ease-linear"
          :stroke-dasharray="`${timerProgress}, 100`"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
        {{ Math.ceil(secondsLeft) }}s
      </div>
    </div>
    <div
      class="text-xs text-gray-400 transition-opacity duration-300 min-h-[1rem]"
      :class="showLabel ? 'opacity-100' : 'opacity-0'"
    >
      {{ labelText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useGameStore } from '~/stores/game';

const gameStore = useGameStore();
const secondsLeft = ref(30);
let timerInterval: ReturnType<typeof setInterval> | null = null;

const showTimer = computed(() => {
  return !gameStore.gameEnded && !!gameStore.game?.commitDeadline;
});

const showLabel = computed(() => {
  return !gameStore.gameEnded && !!gameStore.game?.commitDeadline && gameStore.hasCommitted;
});

const labelText = computed(() => {
  return gameStore.hasCommitted ? 'Waiting for opponent' : 'Your turn!';
});

const timerProgress = computed(() => {
  return Math.max(0, (secondsLeft.value / 30) * 100);
});

function updateTimer() {
  const deadline = gameStore.game?.commitDeadline;
  if (!deadline) {
    secondsLeft.value = 30;
    return;
  }
  const remaining = new Date(deadline).getTime() - Date.now();
  secondsLeft.value = Math.max(0, remaining / 1000);
}

watch(() => gameStore.game?.commitDeadline, () => {
  if (timerInterval) clearInterval(timerInterval);
  if (showTimer.value) {
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }
}, { immediate: true });

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
});
</script>
