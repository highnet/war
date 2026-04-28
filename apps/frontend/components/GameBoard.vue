<template>
  <div class="max-w-3xl mx-auto flex flex-col items-center gap-6 py-8">
    <!-- Opponent -->
    <DeckPile
      :player="gameStore.opponentPlayer"
      position="top"
    />

    <!-- Battle Arena -->
    <BattleArena />

    <!-- War Indicator -->
    <WarIndicator />

    <!-- Player -->
    <DeckPile
      :player="gameStore.myPlayer"
      position="bottom"
    />

    <!-- Controls -->
    <div class="flex flex-col items-center gap-4 w-full">
      <PlayTurnButton />
      <SpeedControl />
    </div>

    <!-- Game Log -->
    <GameLog />

    <!-- Game Over Modal -->
    <div
      v-if="gameStore.gameEnded"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >
      <div class="bg-gray-800 rounded-lg p-8 text-center max-w-sm w-full">
        <h2 class="text-3xl font-bold mb-4">
          {{ gameStore.game?.winnerId === gameStore.myPlayer?.id ? 'You Win!' : 'You Lose!' }}
        </h2>
        <button
          @click="goToLobby"
          class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded transition"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '~/stores/game';
import { useRouter } from 'vue-router';

const gameStore = useGameStore();
const router = useRouter();

function goToLobby() {
  router.push('/lobby');
}
</script>
