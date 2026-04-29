<template>
  <div class="flex flex-col items-center gap-1 sm:gap-2">
    <div class="text-xs sm:text-sm font-medium" :class="position === 'top' ? 'text-gray-300' : 'text-white'">
      {{ player?.name || 'Waiting...' }}
      <span v-if="player?.isConnected === false" class="text-red-400 ml-1">(disconnected)</span>
    </div>
    <div class="relative">
      <div class="w-16 h-[5.6rem] sm:w-20 sm:h-28 rounded-lg border-2 border-gray-600 bg-gray-800 flex items-center justify-center">
        <div class="text-center">
          <div class="text-xl sm:text-2xl font-bold">{{ player?.deckSize || 0 }}</div>
          <div class="text-[10px] sm:text-xs text-gray-400">cards</div>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-1 sm:gap-2 bg-gray-800 rounded-full px-2 sm:px-3 py-0.5 sm:py-1">
      <span class="text-yellow-400 text-sm sm:text-lg">⭐</span>
      <span class="text-xs sm:text-sm font-bold">{{ player?.scoreCount || 0 }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Player } from '@war/types';

defineProps<{
  player: Player | null;
  position: 'top' | 'bottom';
}>();
</script>
