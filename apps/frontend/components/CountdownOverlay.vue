<template>
  <Transition name="fade">
    <div
      v-if="showing"
      class="fixed inset-0 bg-black/60 flex items-center justify-center z-40 pointer-events-none"
    >
      <div class="text-center">
        <div class="text-6xl font-black text-white mb-4 animate-countdown">
          {{ display }}
        </div>
        <div class="text-lg text-gray-300">Revealing cards...</div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useGameStore } from '~/stores/game';

const gameStore = useGameStore();
const showing = ref(false);
const display = ref('3');

watch(
  () => gameStore.game?.currentBattle?.phase,
  (phase, oldPhase) => {
    // Trigger countdown when a new DRAW happens (not war, not resolved)
    if (phase === 'DRAW' && oldPhase !== 'DRAW' && !gameStore.warActive) {
      startCountdown();
    }
  }
);

function startCountdown() {
  showing.value = true;
  let count = 3;
  display.value = String(count);
  const interval = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(interval);
      showing.value = false;
    } else {
      display.value = String(count);
    }
  }, 600);
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes countdown-pop {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-countdown {
  animation: countdown-pop 0.4s ease-out;
}
</style>
