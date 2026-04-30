<template>
  <div class="max-w-3xl mx-auto flex flex-col items-center gap-3 sm:gap-5 py-4 sm:py-6 px-2">
    <!-- Opponent -->
    <DeckPile
      :player="gameStore.opponentPlayer"
      position="top"
    />

    <!-- Battle Arena — fixed height prevents parent layout shift -->
    <div class="w-full min-h-[240px] sm:min-h-[320px] flex items-center justify-center">
      <BattleArena />
    </div>

    <!-- Player -->
    <DeckPile
      :player="gameStore.myPlayer"
      position="bottom"
    />

    <!-- Waiting to Start -->
    <div v-if="gameStore.game?.status === 'WAITING'" class="flex flex-col items-center gap-2 sm:gap-4">
      <div class="text-lg sm:text-xl text-yellow-400 animate-pulse">Waiting to start...</div>
      <div class="text-xs sm:text-sm text-gray-400">
        Players: {{ gameStore.game?.players.length ?? 0 }}/2
      </div>
      <button
        v-if="canStart"
        @click="startGame"
        class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded transition text-sm sm:text-base"
      >
        Start Game
      </button>
      <button
        @click="confirmForfeit"
        class="text-xs sm:text-sm text-gray-400 hover:text-red-400 underline transition"
      >
        Back to Lobby
      </button>
    </div>

    <!-- Controls -->
    <div v-else class="flex flex-col items-center gap-2 sm:gap-4 w-full">
      <PlayTurnButton />
      <button
        v-if="!gameStore.gameEnded"
        @click="confirmForfeit"
        class="text-xs sm:text-sm text-gray-400 hover:text-red-400 underline transition"
      >
        Back to Lobby
      </button>
    </div>

    <!-- Error Toast -->
    <div v-if="gameError" class="w-full max-w-md p-2 sm:p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-xs sm:text-sm text-center">
      {{ gameError }}
    </div>

    <!-- Game Log -->
    <GameLog />

    <!-- Forfeit Confirmation Modal -->
    <Transition name="zoom">
      <div
        v-if="showForfeitConfirm"
        class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      >
        <div class="bg-gray-800 rounded-lg p-6 sm:p-8 text-center max-w-sm w-full border-2 border-red-500 shadow-2xl shadow-red-500/20">
          <div class="text-2xl sm:text-3xl mb-3 sm:mb-4">⚠️</div>
          <h2 class="text-lg sm:text-xl font-bold mb-2 text-red-400">Forfeit Game?</h2>
          <p class="text-gray-300 mb-4 sm:mb-6 text-sm">You will lose this match and return to the lobby.</p>
          <div class="flex gap-3 sm:gap-4 justify-center">
            <button
              @click="showForfeitConfirm = false"
              class="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded transition text-sm"
            >
              Cancel
            </button>
            <button
              @click="forfeitAndLeave"
              class="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition text-sm"
            >
              Forfeit
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Game Over Modal -->
    <Transition name="zoom">
      <div
        v-if="gameStore.gameEnded"
        class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      >
        <div class="bg-gray-800 rounded-lg p-6 sm:p-8 text-center max-w-sm w-full border-2 shadow-2xl"
          :class="gameStore.game?.winnerId === gameStore.myPlayer?.id ? 'border-yellow-500 shadow-yellow-500/20' : gameStore.game?.winnerId ? 'border-red-500 shadow-red-500/20' : 'border-gray-500'">
          <div class="text-4xl sm:text-5xl mb-3 sm:mb-4">{{ resultEmoji }}</div>
          <h2 class="text-2xl sm:text-3xl font-bold mb-2" :class="winnerColor">
            {{ resultText }}
          </h2>
          <div class="text-base sm:text-lg text-gray-300 mb-4 sm:mb-6">
            Final Score: {{ myScore }} - {{ opponentScore }}
          </div>
          <button
            @click="goToLobby"
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded transition text-sm sm:text-base"
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
const showForfeitConfirm = ref(false);

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

const resultText = computed(() => {
  if (!gameStore.game?.winnerId) return "It's a Tie!";
  return gameStore.game.winnerId === gameStore.myPlayer?.id ? 'You Win!' : 'You Lose!';
});

const resultEmoji = computed(() => {
  if (!gameStore.game?.winnerId) return '🤝';
  return gameStore.game.winnerId === gameStore.myPlayer?.id ? '🏆' : '💀';
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

function confirmForfeit() {
  showForfeitConfirm.value = true;
}

async function forfeitAndLeave() {
  showForfeitConfirm.value = false;
  if (userStore.id && gameStore.game) {
    try {
      await mutate('leaveGame', { gameId: gameStore.game.id, userId: userStore.id });
    } catch {
      // ignore errors, just navigate away
    }
  }
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
