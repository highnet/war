import { useRuntimeConfig } from '#app';

const QUERIES: Record<string, string> = {
  getGames: `
    query GetGames {
      getGames {
        id status mode
        players { id name deckSize pileCount scoreCount isConnected }
        winnerId activePlayerId createdAt updatedAt
      }
    }
  `,
  getGame: `
    query GetGame($gameId: ID!) {
      getGame(gameId: $gameId) {
        id status mode
        players { id name deckSize pileCount scoreCount isConnected }
        currentBattle {
          phase
          cards { playerId card { value suit } faceDown }
          winnerId isWar
        }
        winnerId
        logs { id type message timestamp }
        activePlayerId createdAt updatedAt
      }
    }
  `,
};

const MUTATIONS: Record<string, string> = {
  createUser: `
    mutation CreateUser($name: String!) {
      createUser(name: $name) { id name isAI }
    }
  `,
  createGame: `
    mutation CreateGame($mode: String!) {
      createGame(mode: $mode) {
        id status mode
        players { id name deckSize pileCount scoreCount isConnected }
        activePlayerId createdAt updatedAt
      }
    }
  `,
  joinGame: `
    mutation JoinGame($gameId: ID!, $userId: ID!) {
      joinGame(gameId: $gameId, userId: $userId) {
        id status mode
        players { id name deckSize pileCount scoreCount isConnected }
        activePlayerId createdAt updatedAt
      }
    }
  `,
  startGame: `
    mutation StartGame($gameId: ID!) {
      startGame(gameId: $gameId) {
        id status mode
        players { id name deckSize pileCount scoreCount isConnected }
        activePlayerId createdAt updatedAt
      }
    }
  `,
  playTurn: `
    mutation PlayTurn($gameId: ID!, $userId: ID!) {
      playTurn(gameId: $gameId, userId: $userId) {
        id status mode
        players { id name deckSize pileCount scoreCount isConnected }
        currentBattle {
          phase
          cards { playerId card { value suit } faceDown }
          winnerId isWar
        }
        winnerId
        logs { id type message timestamp }
        activePlayerId createdAt updatedAt
      }
    }
  `,
  leaveGame: `
    mutation LeaveGame($gameId: ID!, $userId: ID!) {
      leaveGame(gameId: $gameId, userId: $userId) {
        id status mode
        players { id name deckSize pileCount scoreCount isConnected }
        winnerId activePlayerId createdAt updatedAt
      }
    }
  `,
};

export function useGraphQL() {
  const config = useRuntimeConfig();

  async function query(operation: string, variables?: Record<string, unknown>) {
    return request(QUERIES[operation], variables);
  }

  async function mutate(operation: string, variables?: Record<string, unknown>) {
    return request(MUTATIONS[operation], variables);
  }

  async function request(query: string, variables?: Record<string, unknown>) {
    const res = await $fetch(config.public.apiUrl as string, {
      method: 'POST',
      body: { query, variables },
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.errors) {
      throw new Error(res.errors[0].message);
    }
    return res.data;
  }

  return { query, mutate };
}
