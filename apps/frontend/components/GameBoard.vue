<template>
  <div class="max-w-3xl mx-auto flex flex-col items-center gap-6 py-8">
    <!-- Game State Graph -->
    <GameStateGraph class="max-w-xl" />

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

    <!-- Waiting to Start -->
    <div v-if="gameStore.game?.status === 'WAITING'" class="flex flex-col items-center gap-4">
      <div class="text-xl text-yellow-400 animate-pulse">Waiting to start...</div>
      <div class="text-sm text-gray-400">
        Players: {{ gameStore.game?.players.length ?? 0 }}/2
      </div>
      <button
        v-if="canStart"
        @click="startGame"
        class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded transition"
      >
        Start Game
      </button>
    </div>

    <!-- Controls -->
    <div v-else class="flex flex-col items-center gap-4 w-full">
      <PlayTurnButton />
      <SpeedControl />
    </div>

    <!-- Error Toast -->
    <div v-if="gameError" class="w-full max-w-md p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm text-center">
      {{ gameError }}
    </div>

    <!-- Game Log -->
    <GameLog />

    <!-- Countdown Overlay -->
    <CountdownOverlay />

    <!-- Game Over Modal -->
    <Transition name="zoom">
      <div
        v-if="gameStore.gameEnded"
        class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      >
        <div class="bg-gray-800 rounded-lg p-8 text-center max-w-sm w-full border-2 border-yellow-500 shadow-2xl shadow-yellow-500/20">
          <div class="text-5xl mb-4">🏆</div>
          <h2 class="text-3xl font-bold mb-2" :class="winnerColor">
            {{ gameStore.game?.winnerId === gameStore.myPlayer?.id ? 'You Win!' : gameStore.game?.winnerId ? 'You Lose!' : 'It\'s a Tie!' }}
          </h2>
          <div class="text-lg text-gray-300 mb-6">
            Final Score: {{ myScore }} - {{ opponentScore }}
          </div>
          <button
            @click="goToLobby"
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGameStore } from '~/stores/game';
import { useUserStore } from '~/stores/user';
import { useRouter } from 'vue-router';
import { useGraphQL } from '~/composables/useGraphQL';

const gameStore = useGameStore();
const userStore = useUserStore();
const router = useRouter();
const { mutate } = useGraphQL();
const gameError = ref<string | null>(null);

const canStart = computed(() => {
  return (
    gameStore.game?.status === 'WAITING' &&
    gameStore.game?.players.length === 2
  );
});

const myScore = computed(() => gameStore.myPlayer?.scoreCount ?? 0);
const opponentScore = computed(() => gameStore.opponentPlayer?.scoreCount ?? 0);

const winnerColor = computed(() => {
  if (!gameStore.game?.winnerId) return 'text-gray-300';
  return gameStore.game.winnerId === gameStore.myPlayer?.id ? 'text-green-400' : 'text-red-400';
});

async function startGame() {
  if (!gameStore.game) return;
  gameError.value = null;
  try {
    await mutate('startGame', { gameId: gameStore.game.id });
  } catch (err: any) {
    gameError.value = err.message || 'Failed to start game';
  }
}

function goToLobby() {
  router.push('/lobby');
}

// Clear error when game state updates
watch(() => gameStore.game?.updatedAt, () => {
  gameError.value = null;
});
</script>

<style scoped>
.zoom-enter-active {
  animation: zoom-in 0.4s ease-out;
}
.zoom-leave-active {
  animation: zoom-in 0.3s reverse;
}
@keyframes zoom-in {
  0% { transform: scale(0.7); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
