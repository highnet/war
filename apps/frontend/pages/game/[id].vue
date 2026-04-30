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
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '~/stores/game';
import { useSocketStore } from '~/stores/socket';
import { useUserStore } from '~/stores/user';
import { useGraphQL } from '~/composables/useGraphQL';

const route = useRoute();
const router = useRouter();
const gameStore = useGameStore();
const socketStore = useSocketStore();
const userStore = useUserStore();
const { query, mutate } = useGraphQL();

const gameId = route.params.id as string;
const DISCONNECT_KEY = `war-disconnect-${gameId}`;

onMounted(async () => {
  // Clear any previous game state to prevent old modals from flashing
  gameStore.setGame(null);

  // Restore user from localStorage before any checks
  const savedUser = localStorage.getItem('war-user-v2');
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      userStore.setUser(parsed);
      gameStore.setCurrentUserId(parsed.id);
    } catch {
      localStorage.removeItem('war-user-v2');
    }
  }

  // Check if this is a refresh (grace period)
  const disconnectData = sessionStorage.getItem(DISCONNECT_KEY);
  let isRefresh = false;
  if (disconnectData) {
    const { timestamp } = JSON.parse(disconnectData);
    const elapsed = Date.now() - timestamp;
    if (elapsed < 5000) {
      isRefresh = true;
      sessionStorage.removeItem(DISCONNECT_KEY);
    } else {
      // Grace period expired - forfeit and redirect
      sessionStorage.removeItem(DISCONNECT_KEY);
      if (userStore.id) {
        await mutate('leaveGame', { gameId, userId: userStore.id });
      }
      router.push('/lobby');
      return;
    }
  }

  // Load game state
  const res = await query('getGame', { gameId });
  if (!res.getGame) {
    router.push('/lobby');
    return;
  }

  const inactive = res.getGame.status === 'ENDED' || res.getGame.status === 'FORFEITED';
  const notInGame = !res.getGame.players.some((p: { id: string }) => p.id === userStore.id);

  // If it's a refresh, always stay (even if game ended while we were away)
  if (!isRefresh && (inactive || notInGame)) {
    router.push('/lobby');
    return;
  }

  gameStore.setGame(res.getGame);

  // Connect WebSocket
  socketStore.connect(gameId, (game) => {
    gameStore.setGame(game);
  });

  // Mark refresh intention on beforeunload
  window.addEventListener('beforeunload', markRefreshing);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', markRefreshing);
  // Only forfeit if this is NOT a refresh
  if (!sessionStorage.getItem(DISCONNECT_KEY)) {
    handleLeave();
  }
  socketStore.disconnect();
  // Clear game state so old modals don't flash on next game
  gameStore.setGame(null);
});

function markRefreshing() {
  // Store disconnect timestamp for grace period check on reload
  sessionStorage.setItem(DISCONNECT_KEY, JSON.stringify({ timestamp: Date.now() }));
}

function handleLeave() {
  if (userStore.id && gameStore.game) {
    mutate('leaveGame', { gameId, userId: userStore.id });
  }
}
</script>
