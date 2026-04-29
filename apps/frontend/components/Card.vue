<template>
  <div class="perspective w-16 h-[5.6rem] sm:w-20 sm:h-28">
    <div
      class="relative w-full h-full card-flipper preserve-3d"
      :class="{ 'rotate-y-180': !faceDown }"
    >
      <!-- Face-down side -->
      <div
        class="absolute inset-0 backface-hidden rounded-lg border-2 flex items-center justify-center bg-blue-800 border-blue-600"
      >
        <div class="w-8 h-12 sm:w-12 sm:h-16 bg-blue-700 rounded" />
      </div>

      <!-- Face-up side -->
      <div
        class="absolute inset-0 backface-hidden rounded-lg border-2 bg-white border-gray-300 flex items-center justify-center rotate-y-180"
        :class="[suitColor, winner ? 'ring-4 ring-green-400 shadow-lg shadow-green-500/50 scale-110 z-10' : '', loser ? 'opacity-60 grayscale' : '']"
      >
        <div class="text-xl sm:text-2xl font-bold">
          {{ displayValue }}{{ suitSymbol }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Card } from '@war/types';

const props = defineProps<{
  card: Card;
  faceDown: boolean;
  winner?: boolean;
  loser?: boolean;
}>();

const displayValue = computed(() => {
  const map: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  return map[props.card.value] || String(props.card.value);
});

const suitSymbol = computed(() => {
  const map: Record<string, string> = {
    HEARTS: '\u2665',
    DIAMONDS: '\u2666',
    CLUBS: '\u2663',
    SPADES: '\u2660',
  };
  return map[props.card.suit] || props.card.suit;
});

const suitColor = computed(() => {
  if (props.card.suit === 'HEARTS' || props.card.suit === 'DIAMONDS') {
    return 'text-red-600';
  }
  return 'text-gray-900';
});
</script>

<style scoped>
.perspective {
  perspective: 1000px;
}
.preserve-3d {
  transform-style: preserve-3d;
}
.backface-hidden {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.rotate-y-180 {
  transform: rotateY(180deg);
}
.card-flipper {
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
