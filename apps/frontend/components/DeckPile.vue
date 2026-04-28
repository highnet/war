<template>
  <div class="flex flex-col items-center gap-2">
    <div class="text-sm font-medium" :class="position === 'top' ? 'text-gray-300' : 'text-white'">
      {{ player?.name || 'Waiting...' }}
      <span v-if="player?.isConnected === false" class="text-red-400 ml-2">(disconnected)</span>
    </div>
    <div class="relative">
      <div class="w-20 h-28 rounded-lg border-2 border-gray-600 bg-gray-800 flex items-center justify-center">
        <div class="text-center">
          <div class="text-2xl font-bold">{{ player?.deckSize || 0 }}</div>
          <div class="text-xs text-gray-400">cards</div>
        </div>
      </div>
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
