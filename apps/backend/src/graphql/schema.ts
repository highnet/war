export const schema = `
  enum GameStatus {
    WAITING
    PLAYING
    ENDED
    FORFEITED
  }

  enum BattlePhase {
    DRAW
    WAR
    RESOLVED
  }

  type User {
    id: ID!
    name: String!
    isAI: Boolean!
  }

  type Card {
    value: Int!
    suit: String!
  }

  type BattleCard {
    playerId: ID!
    card: Card!
    faceDown: Boolean!
  }

  type Player {
    id: ID!
    name: String!
    deckSize: Int!
    pileCount: Int!
    scoreCount: Int!
    isConnected: Boolean!
  }

  type CurrentBattle {
    phase: BattlePhase!
    cards: [BattleCard!]!
    winnerId: ID
    isWar: Boolean!
  }

  type GameLogEntry {
    id: ID!
    type: String!
    message: String!
    timestamp: String!
  }

  type Game {
    id: ID!
    status: GameStatus!
    mode: String!
    players: [Player!]!
    currentBattle: CurrentBattle
    winnerId: ID
    logs: [GameLogEntry!]!
    activePlayerId: ID
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    getGames: [Game!]!
    getGame(gameId: ID!): Game
  }

  type Mutation {
    createUser(name: String!): User!
    createGame(mode: String!): Game!
    joinGame(gameId: ID!, userId: ID!): Game!
    startGame(gameId: ID!): Game!
    playTurn(gameId: ID!, userId: ID!): Game!
    leaveGame(gameId: ID!, userId: ID!): Game!
  }

  type Subscription {
    gameUpdated(gameId: ID!): Game!
  }
`;
