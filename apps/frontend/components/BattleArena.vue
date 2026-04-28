<template>
  <div class="flex items-center justify-center gap-8 min-h-[140px]">
    <template v-if="gameStore.game?.currentBattle">
      <div
        v-for="(bc, index) in visibleCards"
        :key="bc.playerId + index"
        class="flex flex-col items-center gap-2"
      >
        <div class="text-sm text-gray-400">
          {{ playerName(bc.playerId) }}
        </div>
        <Card
          :card="bc.card"
          :face-down="bc.faceDown"
        />
      </div>
    </template>
    <div v-else class="text-gray-500">Battle area</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '~/stores/game';
import type { BattleCard } from '@war/types';

const gameStore = useGameStore();

const visibleCards = computed(() => {
  const battle = gameStore.game?.currentBattle;
  if (!battle) return [];
  // Show only the last cards from each player for clarity
  const cards: BattleCard[] = [];
  const playerIds = gameStore.game?.players.map((p) => p.id) || [];
  for (const pid of playerIds) {
    const playerCards = battle.cards.filter((c) => c.playerId === pid);
    if (playerCards.length > 0) {
      cards.push(playerCards[playerCards.length - 1]);
    }
  }
  return cards;
});

function playerName(playerId: string): string {
  return gameStore.game?.players.find((p) => p.id === playerId)?.name || 'Unknown';
}
</script>
