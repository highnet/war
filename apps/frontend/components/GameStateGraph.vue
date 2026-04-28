<template>
  <div class="w-full bg-gray-800 rounded-lg p-4">
    <h3 class="text-sm font-semibold text-gray-300 mb-3">Game Flow</h3>
    <div class="flex flex-wrap items-center gap-2">
      <Node label="Lobby" :active="isLobby" :visited="hasVisitedLobby" />
      <Arrow />
      <Node label="Waiting" :active="isWaiting" :visited="hasVisitedWaiting" />
      <Arrow />
      <Node label="Playing" :active="isPlaying" :visited="hasVisitedPlaying" />
      <Arrow />
      <Node label="Draw" :active="isDraw" :visited="hasVisitedDraw" />
      <Arrow v-if="isWar || wasWar" />
      <Node v-if="isWar || wasWar" label="War" :active="isWar" :visited="wasWar" />
      <Arrow />
      <Node label="Resolved" :active="isResolved" :visited="hasVisitedResolved" />
      <Arrow />
      <Node label="Ended" :active="isEnded" :visited="hasVisitedEnded" />
    </div>
    <div v-if="statusText" class="mt-3 text-xs text-center" :class="statusColor">
      {{ statusText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '~/stores/game';

const gameStore = useGameStore();

const status = computed(() => gameStore.game?.status ?? 'LOBBY');
const phase = computed(() => gameStore.game?.currentBattle?.phase ?? null);
const isWar = computed(() => gameStore.game?.currentBattle?.isWar ?? false);

const isLobby = computed(() => status.value === 'WAITING' && !gameStore.game?.players.length);
const isWaiting = computed(() => status.value === 'WAITING');
const isPlaying = computed(() => status.value === 'PLAYING' && !phase.value);
const isDraw = computed(() => phase.value === 'DRAW');
const isWarActive = computed(() => phase.value === 'WAR');
const isResolved = computed(() => phase.value === 'RESOLVED');
const isEnded = computed(() => status.value === 'ENDED' || status.value === 'FORFEITED');

const hasVisitedLobby = computed(() => true);
const hasVisitedWaiting = computed(() => isWaiting.value || isPlaying.value || isDraw.value || isWarActive.value || isResolved.value || isEnded.value);
const hasVisitedPlaying = computed(() => isPlaying.value || isDraw.value || isWarActive.value || isResolved.value || isEnded.value);
const hasVisitedDraw = computed(() => isDraw.value || isWarActive.value || isResolved.value || isEnded.value);
const wasWar = computed(() => isWarActive.value || isResolved.value || isEnded.value);
const hasVisitedResolved = computed(() => isResolved.value || isEnded.value);
const hasVisitedEnded = computed(() => isEnded.value);

const statusText = computed(() => {
  if (isEnded.value) return gameStore.game?.winnerId ? 'Game Over — Winner declared!' : 'Game Over — Tie!';
  if (isResolved.value) return 'Battle resolved — cards awarded!';
  if (isWarActive.value) return 'WAR! Place your war cards!';
  if (isDraw.value) return 'Cards drawn — comparing values...';
  if (isWaiting.value) {
    const p = gameStore.game?.players.length ?? 0;
    return p < 2 ? `Waiting for players... (${p}/2)` : 'Ready to start!';
  }
  if (status.value === 'PLAYING') return 'Game in progress';
  return '';
});

const statusColor = computed(() => {
  if (isEnded.value) return 'text-green-400 font-bold';
  if (isResolved.value) return 'text-green-300';
  if (isWarActive.value) return 'text-yellow-400 font-bold animate-pulse';
  if (isDraw.value) return 'text-blue-300';
  if (isWaiting.value) return 'text-yellow-300';
  return 'text-gray-400';
});
</script>

<script lang="ts">
import { defineComponent, h } from 'vue';

const Node = defineComponent({
  props: { label: String, active: Boolean, visited: Boolean },
  setup(props) {
    return () => h('div', {
      class: [
        'px-3 py-1 rounded-full text-xs font-bold transition border',
        props.active
          ? 'bg-green-600 border-green-400 text-white scale-110 shadow-lg shadow-green-500/30'
          : props.visited
            ? 'bg-gray-700 border-gray-500 text-gray-300'
            : 'bg-gray-900 border-gray-700 text-gray-600',
      ],
    }, props.label);
  },
});

const Arrow = defineComponent({
  setup() {
    return () => h('div', { class: 'text-gray-500 text-xs' }, '→');
  },
});
</script>
