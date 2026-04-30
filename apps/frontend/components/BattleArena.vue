<template>
  <div class="flex flex-col items-center justify-center gap-1 sm:gap-2 relative w-full">
    <!-- War Overlay -->
    <Transition name="pop">
      <div
        v-if="showWarOverlay"
        class="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
      >
        <div class="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 sm:px-6 sm:py-3 border-2 border-yellow-500 animate-pulse">
          <div class="text-xl sm:text-3xl font-extrabold text-yellow-400 text-center">
            ⚔️ WAR! ⚔️
          </div>
          <div v-if="stakeCount > 0" class="text-xs sm:text-sm text-yellow-200 text-center mt-1">
            {{ stakeCount }} cards at stake
          </div>
        </div>
      </div>
    </Transition>

    <!-- Winner Banner -->
    <Transition name="pop">
      <div
        v-if="showWinner"
        class="absolute top-0 z-10 text-lg sm:text-2xl font-black tracking-wide"
        :class="winnerTextColor"
      >
        {{ winnerText }}
      </div>
    </Transition>

    <!-- Timer -->
    <TurnTimer />

    <!-- Opponent Area -->
    <div class="flex flex-col items-center gap-1 w-full">
      <div class="text-xs sm:text-sm font-semibold text-gray-400 truncate max-w-[150px]">
        {{ gameStore.opponentPlayer?.name || 'Opponent' }}
      </div>
      <!-- Fixed-height card area prevents layout shift -->
      <div class="flex items-center justify-center min-h-[5.6rem] sm:min-h-[7rem]">
        <div class="flex items-center">
          <template v-if="opponentCards.length > 0">
            <div
              v-for="(c, i) in opponentCards"
              :key="`${c.playerId}-${i}`"
              class="relative transition-all duration-500"
              :class="[
                i === opponentCards.length - 1 ? 'z-10' : '-mr-3 sm:-mr-4 opacity-80 scale-90',
                i === opponentCards.length - 1 && !c.faceDown ? 'animate-flip-in' : ''
              ]"
            >
              <Card
                :card="c.card"
                :face-down="c.faceDown"
                :winner="isWinnerCard(c.playerId) && i === opponentCards.length - 1"
                :loser="isLoserCard(c.playerId) && i === opponentCards.length - 1"
              />
            </div>
          </template>
          <template v-else>
            <!-- Invisible placeholder maintains layout -->
            <div class="w-16 h-[5.6rem] sm:w-20 sm:h-28 opacity-0" aria-hidden="true" />
          </template>
        </div>
      </div>
    </div>

    <!-- Center: VS or War Pot -->
    <div class="flex items-center justify-center gap-2 py-1 min-h-[2.5rem]">
      <div
        v-if="warPotCount > 0"
        class="flex items-center gap-1 text-yellow-400"
      >
        <div class="w-8 h-10 sm:w-10 sm:h-14 rounded border border-yellow-600 bg-yellow-900/40 flex items-center justify-center">
          <span class="text-xs sm:text-sm font-bold">+{{ warPotCount }}</span>
        </div>
      </div>
      <div v-else-if="hasCards" class="text-xs sm:text-sm text-gray-500 font-bold">VS</div>
      <div v-else class="text-xs text-gray-600">—</div>
    </div>

    <!-- Player Area -->
    <div class="flex flex-col items-center gap-1 w-full">
      <!-- Fixed-height card area prevents layout shift -->
      <div class="flex items-center justify-center min-h-[5.6rem] sm:min-h-[7rem]">
        <div class="flex items-center">
          <template v-if="playerCards.length > 0">
            <div
              v-for="(c, i) in playerCards"
              :key="`${c.playerId}-${i}`"
              class="relative transition-all duration-500"
              :class="[
                i === playerCards.length - 1 ? 'z-10' : '-mr-3 sm:-mr-4 opacity-80 scale-90',
                i === playerCards.length - 1 && !c.faceDown ? 'animate-flip-in' : ''
              ]"
            >
              <Card
                :card="c.card"
                :face-down="c.faceDown"
                :winner="isWinnerCard(c.playerId) && i === playerCards.length - 1"
                :loser="isLoserCard(c.playerId) && i === playerCards.length - 1"
              />
            </div>
          </template>
          <template v-else>
            <!-- Invisible placeholder maintains layout -->
            <div class="w-16 h-[5.6rem] sm:w-20 sm:h-28 opacity-0" aria-hidden="true" />
          </template>
        </div>
      </div>
      <div class="text-xs sm:text-sm font-semibold text-white truncate max-w-[150px]">
        {{ gameStore.myPlayer?.name || 'You' }}
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!hasCards && gameStore.game?.status === 'PLAYING'"
      class="text-gray-500 text-xs sm:text-sm"
    >
      Both players — press Play Turn
    </div>
    <div
      v-if="gameStore.game?.status === 'WAITING'"
      class="text-gray-500 text-xs sm:text-sm"
    >
      Waiting for players...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '~/stores/game';
import Card from './Card.vue';
import TurnTimer from './TurnTimer.vue';

const gameStore = useGameStore();

const opponentId = computed(() => gameStore.opponentPlayer?.id);
const myId = computed(() => gameStore.myPlayer?.id);

const opponentCards = computed(() => {
  const battle = gameStore.game?.currentBattle;
  if (!battle || !opponentId.value) return [];
  return battle.cards.filter((c) => c.playerId === opponentId.value);
});

const playerCards = computed(() => {
  const battle = gameStore.game?.currentBattle;
  if (!battle || !myId.value) return [];
  return battle.cards.filter((c) => c.playerId === myId.value);
});

const hasCards = computed(() => opponentCards.value.length > 0 || playerCards.value.length > 0);

const showWinner = computed(() => {
  return gameStore.battleResolved && !!gameStore.winnerName;
});

const winnerText = computed(() => {
  if (!showWinner.value) return '';
  const winner = gameStore.game?.players.find((p) => p.id === gameStore.game?.currentBattle?.winnerId);
  if (!winner) return '';
  return `${winner.name} wins!`;
});

const winnerTextColor = computed(() => {
  const myIdVal = gameStore.myPlayer?.id;
  const winnerId = gameStore.game?.currentBattle?.winnerId;
  if (winnerId === myIdVal) return 'text-green-400';
  return 'text-red-400';
});

const showWarOverlay = computed(() => {
  return gameStore.warActive && !gameStore.isRevealing && !gameStore.battleResolved;
});

const stakeCount = computed(() => {
  const battle = gameStore.game?.currentBattle;
  if (!battle) return 0;
  return battle.cards.length;
});

const warPotCount = computed(() => {
  const battle = gameStore.game?.currentBattle;
  if (!battle || !gameStore.warActive) return 0;
  return battle.cards.filter((c) => c.faceDown).length;
});

function isWinnerCard(playerId: string): boolean {
  return gameStore.battleResolved && gameStore.game?.currentBattle?.winnerId === playerId;
}

function isLoserCard(playerId: string): boolean {
  return gameStore.battleResolved && gameStore.game?.currentBattle?.winnerId !== null && gameStore.game?.currentBattle?.winnerId !== playerId;
}
</script>

<style scoped>
.pop-enter-active {
  animation: pop-in 0.4s ease-out;
}
.pop-leave-active {
  animation: pop-in 0.2s reverse;
}
@keyframes pop-in {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.animate-flip-in {
  animation: flip-in 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes flip-in {
  0% { transform: rotateY(90deg) scale(0.8); opacity: 0; }
  100% { transform: rotateY(0deg) scale(1); opacity: 1; }
}
</style>
