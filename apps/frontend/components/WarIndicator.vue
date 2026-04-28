<template>
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
    Battle Resolved
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '~/stores/game';

const gameStore = useGameStore();
</script>
