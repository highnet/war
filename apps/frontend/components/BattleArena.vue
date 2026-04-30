<template>
  <div class="flex flex-col items-center justify-center gap-2 sm:gap-3 relative w-full py-2">
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
        class="absolute top-1 z-10 text-lg sm:text-2xl font-black tracking-wide"
        :class="winnerTextColor"
      >
        {{ winnerText }}
      </div>
    </Transition>

    <!-- Timer -->
    <TurnTimer />

    <!-- === OPPONENT (always top) === -->
    <div class="flex flex-col items-center gap-1 w-full">
      <div class="text-xs sm:text-sm font-semibold text-gray-400 truncate max-w-[150px]">
        {{ gameStore.opponentPlayer?.name || 'Opponent' }}
      </div>
      <!-- Fixed-size card slot — never collapses or shifts -->
      <div class="relative w-16 h-[5.6rem] sm:w-20 sm:h-28">
        <!-- Empty slot placeholder (visible when no card) -->
        <div
          class="absolute inset-0 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center"
          v-show="!opponentTopCard"
        >
          <div class="w-8 h-12 sm:w-12 sm:h-16 bg-gray-800/50 rounded" />
        </div>
        <!-- Active card (the top of opponent's committed stack) -->
        <div
          v-if="opponentTopCard"
          class="absolute inset-0"
          :class="opponentTopCard.justRevealed ? 'animate-flip-in' : ''"
        >
          <Card
            :card="opponentTopCard.card"
            :face-down="opponentTopCard.faceDown"
            :winner="isWinnerCard(opponentTopCard.playerId)"
            :loser="isLoserCard(opponentTopCard.playerId)"
          />
        </div>
        <!-- Stack depth badge -->
        <div
          v-if="opponentStackDepth > 1"
          class="absolute -top-1.5 -right-1.5 bg-gray-700 text-white text-[10px] sm:text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center border border-gray-600"
        >
          {{ opponentStackDepth }}
        </div>
      </div>
    </div>

    <!-- === CENTER === -->
    <div class="flex items-center justify-center min-h-[2rem]">
      <div
        v-if="warPotCount > 0"
        class="flex items-center gap-1.5 text-yellow-400 bg-yellow-900/30 rounded-full px-3 py-1 border border-yellow-700"
      >
        <span class="text-xs sm:text-sm font-bold">{{ warPotCount }} cards at stake</span>
      </div>
      <div v-else-if="anyCardShowing" class="text-xs sm:text-sm text-gray-600 font-bold">VS</div>
      <div v-else class="text-xs text-gray-700">—</div>
    </div>

    <!-- === PLAYER (always bottom) === -->
    <div class="flex flex-col items-center gap-1 w-full">
      <!-- Fixed-size card slot — never collapses or shifts -->
      <div class="relative w-16 h-[5.6rem] sm:w-20 sm:h-28">
        <!-- Empty slot placeholder (visible when no card) -->
        <div
          class="absolute inset-0 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center"
          v-show="!playerTopCard"
        >
          <div class="w-8 h-12 sm:w-12 sm:h-16 bg-gray-800/50 rounded" />
        </div>
        <!-- Active card (the top of player's committed stack) -->
        <div
          v-if="playerTopCard"
          class="absolute inset-0"
          :class="playerTopCard.justRevealed ? 'animate-flip-in' : ''"
        >
          <Card
            :card="playerTopCard.card"
            :face-down="playerTopCard.faceDown"
            :winner="isWinnerCard(playerTopCard.playerId)"
            :loser="isLoserCard(playerTopCard.playerId)"
          />
        </div>
        <!-- Stack depth badge -->
        <div
          v-if="playerStackDepth > 1"
          class="absolute -top-1.5 -right-1.5 bg-gray-700 text-white text-[10px] sm:text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center border border-gray-600"
        >
          {{ playerStackDepth }}
        </div>
      </div>
      <div class="text-xs sm:text-sm font-semibold text-white truncate max-w-[150px]">
        {{ gameStore.myPlayer?.name || 'You' }}
      </div>
    </div>

    <!-- Empty state (only when no battle at all) -->
    <div
      v-if="!anyCardShowing && gameStore.game?.status === 'PLAYING'"
      class="text-gray-500 text-xs sm:text-sm absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      Press Play Turn
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

interface DisplayCard {
  playerId: string;
  card: { value: number; suit: string };
  faceDown: boolean;
  justRevealed: boolean;
}

// Get the "active" card for opponent — the last one they committed for the current step
const opponentTopCard = computed<DisplayCard | null>(() => {
  const battle = gameStore.game?.currentBattle;
  if (!battle || !opponentId.value) return null;
  const cards = battle.cards.filter((c) => c.playerId === opponentId.value);
  if (cards.length === 0) return null;
  const top = cards[cards.length - 1];
  return {
    playerId: top.playerId,
    card: top.card,
    faceDown: top.faceDown,
    justRevealed: !top.faceDown && battle.phase === 'REVEAL',
  };
});

const opponentStackDepth = computed(() => {
  const battle = gameStore.game?.currentBattle;
  if (!battle || !opponentId.value) return 0;
  return battle.cards.filter((c) => c.playerId === opponentId.value).length;
});

// Get the "active" card for player — the last one they committed for the current step
const playerTopCard = computed<DisplayCard | null>(() => {
  const battle = gameStore.game?.currentBattle;
  if (!battle || !myId.value) return null;
  const cards = battle.cards.filter((c) => c.playerId === myId.value);
  if (cards.length === 0) return null;
  const top = cards[cards.length - 1];
  return {
    playerId: top.playerId,
    card: top.card,
    faceDown: top.faceDown,
    justRevealed: !top.faceDown && battle.phase === 'REVEAL',
  };
});

const playerStackDepth = computed(() => {
  const battle = gameStore.game?.currentBattle;
  if (!battle || !myId.value) return 0;
  return battle.cards.filter((c) => c.playerId === myId.value).length;
});

const anyCardShowing = computed(() => !!opponentTopCard.value || !!playerTopCard.value);

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
  if (!battle) return 0;
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
