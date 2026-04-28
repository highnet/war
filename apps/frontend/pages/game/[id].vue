<template>
  <div class="min-h-screen bg-gray-900 text-white p-4">
    <div v-if="!gameStore.game" class="flex items-center justify-center h-screen">
      <div class="text-xl">Loading game...</div>
    </div>
    <GameBoard v-else />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useGameStore } from '~/stores/game';
import { useSocketStore } from '~/stores/socket';
import { useUserStore } from '~/stores/user';
import { useGraphQL } from '~/composables/useGraphQL';

const route = useRoute();
const gameStore = useGameStore();
const socketStore = useSocketStore();
const userStore = useUserStore();
const { query, mutate } = useGraphQL();

const gameId = route.params.id as string;

onMounted(async () => {
  // Load game state
  const res = await query('getGame', { gameId });
  if (res.getGame) {
    gameStore.setGame(res.getGame);
  }

  // Connect WebSocket
  socketStore.connect(gameId, (game) => {
    gameStore.setGame(game);
  });

  // Handle graceful leave
  window.addEventListener('beforeunload', handleLeave);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleLeave);
  handleLeave();
  socketStore.disconnect();
});

function handleLeave() {
  if (userStore.id && gameStore.game) {
    mutate('leaveGame', { gameId, userId: userStore.id });
  }
}
</script>
