<template>
  <div
    class="w-20 h-28 rounded-lg border-2 flex items-center justify-center text-2xl font-bold select-none transition-transform"
    :class="[
      faceDown
        ? 'bg-blue-800 border-blue-600 text-transparent'
        : suitColor + ' bg-white border-gray-300',
    ]"
  >
    <template v-if="!faceDown">
      {{ displayValue }}{{ suitSymbol }}
    </template>
    <template v-else>
      <div class="w-12 h-16 bg-blue-700 rounded" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Card } from '@war/types';

const props = defineProps<{
  card: Card;
  faceDown: boolean;
}>();

const displayValue = computed(() => {
  const map: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  return map[props.card.value] || String(props.card.value);
});

const suitSymbol = computed(() => {
  const map: Record<string, string> = {
    HEARTS: '♥',
    DIAMONDS: '♦',
    CLUBS: '♣',
    SPADES: '♠',
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
