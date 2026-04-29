<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-4">
    <h1 class="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8">War Multiplayer</h1>

    <div v-if="!userStore.id" class="w-full max-w-md mb-6 text-center">
      <div class="text-gray-400 animate-pulse text-sm sm:text-base">Summoning your warrior...</div>
    </div>

    <div v-if="error" class="w-full max-w-md mb-4 p-3 sm:p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm sm:text-base">
      {{ error }}
    </div>

    <div v-if="userStore.id" class="w-full max-w-md space-y-3 sm:space-y-4">
      <div class="bg-gray-800 rounded-lg p-4 sm:p-6 text-center">
        <div class="text-xl sm:text-2xl font-bold text-white mb-1">{{ userStore.name }}</div>
        <div class="text-xs sm:text-sm text-gray-400">Ready for battle</div>
      </div>

      <div class="bg-gray-800 rounded-lg p-4 sm:p-6">
        <div class="flex gap-3 sm:gap-4">
          <button
            @click="findGame('multiplayer')"
            class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 sm:py-3 px-3 sm:px-4 rounded transition disabled:opacity-50 text-sm sm:text-base"
            :disabled="loading"
          >
            {{ loading && pendingMode === 'multiplayer' ? 'Matching...' : 'Multiplayer' }}
          </button>
          <button
            @click="findGame('ai')"
            class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 sm:py-3 px-3 sm:px-4 rounded transition disabled:opacity-50 text-sm sm:text-base"
            :disabled="loading"
          >
            vs AI
          </button>
        </div>
      </div>

      <div v-if="activeGame" class="bg-gray-800 rounded-lg p-4 sm:p-6 text-center">
        <div class="text-xs sm:text-sm text-gray-400 mb-2">You have an active game</div>
        <div class="text-base sm:text-lg font-semibold text-white mb-3">
          vs {{ activeGame.players.find((p) => p.id !== userStore.id)?.name || 'Opponent' }}
          <span class="text-xs sm:text-sm text-gray-400">({{ activeGame.mode === 'ai' ? 'AI' : 'Multiplayer' }})</span>
        </div>
        <button
          @click="reconnect"
          class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded transition text-sm sm:text-base"
        >
          Reconnect to Game
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '~/stores/user';
import { useGraphQL } from '~/composables/useGraphQL';
import type { Game } from '@war/types';

const userStore = useUserStore();
const router = useRouter();
const { query, mutate } = useGraphQL();
const activeGame = ref<Game | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const pendingMode = ref<string | null>(null);

async function createUser() {
  loading.value = true;
  error.value = null;
  try {
    const res = await mutate('createUser', {});
    userStore.setUser(res.createUser);
    localStorage.setItem('war-user-v2', JSON.stringify(res.createUser));
  } catch (err: any) {
    error.value = err.message || 'Failed to create warrior';
  } finally {
    loading.value = false;
  }
}

async function findGame(mode: string) {
  if (!userStore.id) return;
  loading.value = true;
  pendingMode.value = mode;
  error.value = null;
  try {
    const res = await mutate('findOrCreateGame', { mode, userId: userStore.id });
    router.push(`/game/${res.findOrCreateGame.id}`);
  } catch (err: any) {
    error.value = err.message || 'Failed to find game';
  } finally {
    loading.value = false;
    pendingMode.value = null;
  }
}

function reconnect() {
  if (activeGame.value) {
    router.push(`/game/${activeGame.value.id}`);
  }
}

onMounted(async () => {
  // Migrate away from old localStorage that may contain manual names like h1/h2
  const legacy = localStorage.getItem('war-user');
  if (legacy) {
    localStorage.removeItem('war-user');
  }

  const saved = localStorage.getItem('war-user-v2');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      userStore.setUser(parsed);
    } catch {
      localStorage.removeItem('war-user-v2');
      await createUser();
    }
  } else {
    await createUser();
  }

  // Check if user is already in an active game
  if (userStore.id) {
    try {
      const res = await query('myActiveGame', { userId: userStore.id });
      if (res.myActiveGame) {
        activeGame.value = res.myActiveGame;
      }
    } catch {
      // ignore query errors
    }
  }
});
</script>
