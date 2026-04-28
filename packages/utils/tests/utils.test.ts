import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, compareCards, splitDeck } from '../src/index';

describe('createDeck', () => {
  it('returns 52 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('has 4 suits', () => {
    const deck = createDeck();
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
  });

  it('has values 2-14', () => {
    const deck = createDeck();
    const values = deck.map(c => c.value).sort((a, b) => a - b);
    expect(values[0]).toBe(2);
    expect(values[values.length - 1]).toBe(14);
  });
});

describe('shuffle', () => {
  it('returns same length', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(shuffled).toHaveLength(52);
  });

  it('changes order usually', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    // Very unlikely to be identical
    const same = deck.every((c, i) => c.value === shuffled[i].value && c.suit === shuffled[i].suit);
    expect(same).toBe(false);
  });
});

describe('compareCards', () => {
  it('returns positive when a > b', () => {
    expect(compareCards({ value: 10, suit: 'HEARTS' }, { value: 5, suit: 'CLUBS' })).toBe(5);
  });

  it('returns negative when a < b', () => {
    expect(compareCards({ value: 3, suit: 'HEARTS' }, { value: 14, suit: 'SPADES' })).toBe(-11);
  });

  it('returns zero when equal', () => {
    expect(compareCards({ value: 7, suit: 'HEARTS' }, { value: 7, suit: 'CLUBS' })).toBe(0);
  });
});

describe('splitDeck', () => {
  it('splits evenly', () => {
    const deck = createDeck();
    const [a, b] = splitDeck(deck);
    expect(a).toHaveLength(26);
    expect(b).toHaveLength(26);
  });
});
