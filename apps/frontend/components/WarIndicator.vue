<template>
  <div class="h-10 flex items-center justify-center">
    <Transition name="bounce">
      <div
        v-if="gameStore.warActive"
        class="text-3xl font-extrabold text-yellow-400 animate-pulse"
      >
        ⚔️ WAR! ⚔️
      </div>
      <div
        v-else-if="gameStore.battleResolved"
        class="text-xl font-semibold text-green-400"
      >
        🏆 Battle Resolved
      </div>
      <div v-else class="text-sm text-gray-500">—</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '~/stores/game';

const gameStore = useGameStore();
</script>

<style scoped>
.bounce-enter-active {
  animation: bounce-in 0.5s;
}
.bounce-leave-active {
  animation: bounce-in 0.3s reverse;
}
@keyframes bounce-in {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
</style>
