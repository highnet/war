import { useRuntimeConfig } from '#app';

export function useGraphQL() {
  const config = useRuntimeConfig();

  async function query(operation: string, variables?: Record<string, unknown>) {
    return request(operation, variables);
  }

  async function mutate(operation: string, variables?: Record<string, unknown>) {
    return request(operation, variables);
  }

  async function request(operation: string, variables?: Record<string, unknown>) {
    const query = buildQuery(operation, variables);
    const res = await $fetch(config.public.apiUrl as string, {
      method: 'POST',
      body: { query, variables },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (res.errors) {
      throw new Error(res.errors[0].message);
    }
    return res.data;
  }

  return { query, mutate };
}

function buildQuery(operation: string, variables?: Record<string, unknown>): string {
  const fields = {
    getGames: `
      getGames {
        id
        status
        mode
        players { id name deckSize pileCount isConnected }
        winnerId
        activePlayerId
        createdAt
        updatedAt
      }
    `,
    getGame: `
      getGame(gameId: $gameId) {
        id
        status
        mode
        players { id name deckSize pileCount isConnected }
        currentBattle {
          phase
          cards { playerId card { value suit } faceDown }
          winnerId
          isWar
        }
        winnerId
        logs { id type message timestamp }
        activePlayerId
        createdAt
        updatedAt
      }
    `,
    createUser: `
      createUser(name: $name) {
        id
        name
        isAI
      }
    `,
    createGame: `
      createGame(mode: $mode) {
        id
        status
        mode
        players { id name deckSize pileCount isConnected }
        activePlayerId
        createdAt
        updatedAt
      }
    `,
    joinGame: `
      joinGame(gameId: $gameId, userId: $userId) {
        id
        status
        mode
        players { id name deckSize pileCount isConnected }
        activePlayerId
        createdAt
        updatedAt
      }
    `,
    startGame: `
      startGame(gameId: $gameId) {
        id
        status
        mode
        players { id name deckSize pileCount isConnected }
        activePlayerId
        createdAt
        updatedAt
      }
    `,
    playTurn: `
      playTurn(gameId: $gameId, userId: $userId) {
        id
        status
        mode
        players { id name deckSize pileCount isConnected }
        currentBattle {
          phase
          cards { playerId card { value suit } faceDown }
          winnerId
          isWar
        }
        winnerId
        logs { id type message timestamp }
        activePlayerId
        createdAt
        updatedAt
      }
    `,
    leaveGame: `
      leaveGame(gameId: $gameId, userId: $userId) {
        id
        status
        mode
        players { id name deckSize pileCount isConnected }
        winnerId
        activePlayerId
        createdAt
        updatedAt
      }
    `,
  };

  const body = fields[operation as keyof typeof fields] || '';
  return `query ${operation}${variables ? `(${Object.entries(variables).map(([k, _v]) => `$${k}: ${inferType(k)}`).join(', ')})` : ''} { ${body} }`;
}

function inferType(key: string): string {
  if (key.includes('Id')) return 'ID!';
  if (key === 'name' || key === 'mode') return 'String!';
  return 'String!';
}
