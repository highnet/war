<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-4">
    <h1 class="text-4xl font-bold mb-8">War Multiplayer</h1>

    <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mb-6">
      <h2 class="text-xl font-semibold mb-4">Enter Your Name</h2>
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        class="w-full px-4 py-2 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        @keyup.enter="createUser"
      />
      <button
        @click="createUser"
        class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
        :disabled="!name.trim() || loading"
      >
        {{ loading ? 'Setting...' : 'Set Name' }}
      </button>
    </div>

    <div v-if="error" class="w-full max-w-md mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
      {{ error }}
    </div>

    <div v-if="userStore.id" class="w-full max-w-md space-y-4">
      <div class="bg-gray-800 rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">Create Game</h2>
        <div class="flex gap-4">
          <button
            @click="createGame('multiplayer')"
            class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition disabled:opacity-50"
            :disabled="loading"
          >
            Multiplayer
          </button>
          <button
            @click="createGame('ai')"
            class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded transition disabled:opacity-50"
            :disabled="loading"
          >
            vs AI
          </button>
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">Open Games</h2>
        <div v-if="games.length === 0" class="text-gray-400">No open games</div>
        <div v-else class="space-y-2">
          <div
            v-for="game in games"
            :key="game.id"
            class="flex items-center justify-between bg-gray-700 rounded p-3"
          >
            <div>
              <div class="font-medium">{{ game.mode }} — {{ game.status }}</div>
              <div class="text-sm text-gray-400">{{ game.players.length }}/2 players</div>
            </div>
            <button
              v-if="canJoin(game)"
              @click="joinGame(game.id)"
              class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded transition disabled:opacity-50"
              :disabled="loading"
            >
              Join
            </button>
            <button
              v-else
              @click="goToGame(game.id)"
              class="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-3 rounded transition"
            >
              View
            </button>
          </div>
        </div>
        <button
          @click="fetchGames"
          class="mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
        >
          Refresh
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

const name = ref('');
const userStore = useUserStore();
const router = useRouter();
const { query, mutate } = useGraphQL();
const games = ref<Game[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

async function createUser() {
  if (!name.value.trim()) return;
  loading.value = true;
  error.value = null;
  try {
    const res = await mutate('createUser', { name: name.value.trim() });
    userStore.setUser(res.createUser);
    localStorage.setItem('war-user', JSON.stringify(res.createUser));
    await fetchGames();
  } catch (err: any) {
    error.value = err.message || 'Failed to set name';
  } finally {
    loading.value = false;
  }
}

async function createGame(mode: string) {
  loading.value = true;
  error.value = null;
  try {
    const res = await mutate('createGame', { mode });
    // Creator always joins their game; backend auto-starts when 2nd player joins
    await mutate('joinGame', { gameId: res.createGame.id, userId: userStore.id });
    router.push(`/game/${res.createGame.id}`);
  } catch (err: any) {
    error.value = err.message || 'Failed to create game';
  } finally {
    loading.value = false;
  }
}

async function joinGame(gameId: string) {
  loading.value = true;
  error.value = null;
  try {
    await mutate('joinGame', { gameId, userId: userStore.id });
    router.push(`/game/${gameId}`);
  } catch (err: any) {
    error.value = err.message || 'Failed to join game';
  } finally {
    loading.value = false;
  }
}

function goToGame(gameId: string) {
  router.push(`/game/${gameId}`);
}

function canJoin(game: Game): boolean {
  return game.status === 'WAITING' && game.players.length < 2 && !game.players.some((p) => p.id === userStore.id);
}

async function fetchGames() {
  try {
    const res = await query('getGames');
    games.value = res.getGames || [];
  } catch (err: any) {
    error.value = err.message || 'Failed to load games';
  }
}

onMounted(async () => {
  const saved = localStorage.getItem('war-user');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      userStore.setUser(parsed);
      await fetchGames();
    } catch {
      localStorage.removeItem('war-user');
    }
  }
});
</script>
