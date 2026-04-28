import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createClient, type Client } from 'graphql-ws';
import type { Game } from '@war/types';

export const useSocketStore = defineStore('socket', () => {
  const client = ref<Client | null>(null);
  const status = ref<'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'>('DISCONNECTED');

  function connect(gameId: string, onUpdate: (game: Game) => void) {
    if (client.value) return;

    const wsUrl = useRuntimeConfig().public.wsUrl as string;

    const c = createClient({
      url: wsUrl,
      retryAttempts: 10,
      keepAlive: 30000,
      on: {
        connected: () => {
          status.value = 'CONNECTED';
        },
        closed: () => {
          status.value = 'DISCONNECTED';
        },
      },
    });

    client.value = c;

    const subscription = c.subscribe(
      {
        query: `
          subscription GameUpdated($gameId: ID!) {
            gameUpdated(gameId: $gameId) {
              id
              status
              mode
              players {
                id
                name
                deckSize
                pileCount
                isConnected
              }
              currentBattle {
                phase
                cards {
                  playerId
                  card {
                    value
                    suit
                  }
                  faceDown
                }
                winnerId
                isWar
              }
              winnerId
              logs {
                id
                type
                message
                timestamp
              }
              activePlayerId
              createdAt
              updatedAt
            }
          }
        `,
        variables: { gameId },
      },
      {
        next: (data: { data?: { gameUpdated: Game } }) => {
          if (data.data?.gameUpdated) {
            onUpdate(data.data.gameUpdated);
          }
        },
        error: (err) => {
          console.error('Subscription error:', err);
          status.value = 'DISCONNECTED';
        },
        complete: () => {
          status.value = 'DISCONNECTED';
        },
      }
    );
  }

  function disconnect() {
    if (client.value) {
      client.value.dispose();
      client.value = null;
      status.value = 'DISCONNECTED';
    }
  }

  return { client, status, connect, disconnect };
});
