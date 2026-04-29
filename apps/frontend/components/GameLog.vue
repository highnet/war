<template>
  <div ref="logContainer" class="w-full max-w-md bg-gray-800 rounded-lg p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto">
    <h3 class="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Battle Log</h3>
    <div class="space-y-1">
      <div
        v-for="entry in logs"
        :key="entry.id"
        class="text-xs sm:text-sm"
        :class="logColor(entry.type)"
      >
        <span class="text-gray-500">{{ formatTime(entry.timestamp) }}</span>
        — {{ entry.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useGameStore } from '~/stores/game';

const gameStore = useGameStore();
const logContainer = ref<HTMLDivElement | null>(null);

const logs = computed(() => gameStore.game?.logs || []);

watch(
  () => logs.value.length,
  async () => {
    await nextTick();
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  }
);

function logColor(type: string): string {
  switch (type) {
    case 'WAR': return 'text-yellow-300 font-semibold';
    case 'RESOLVED': return 'text-green-300';
    case 'FORFEIT': return 'text-red-300';
    default: return 'text-gray-300';
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
</script>
