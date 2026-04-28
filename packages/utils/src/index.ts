import type { Card, Suit } from '@war/types';

const SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let value = 2; value <= 14; value++) {
      deck.push({ value, suit });
    }
  }
  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function compareCards(a: Card, b: Card): number {
  return a.value - b.value;
}

export function splitDeck(deck: Card[]): [Card[], Card[]] {
  const mid = Math.floor(deck.length / 2);
  return [deck.slice(0, mid), deck.slice(mid)];
}
