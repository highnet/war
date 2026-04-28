import { createDeck, shuffle, splitDeck } from '@war/utils';
import type { Card } from '@war/types';

export class DeckService {
  createAndSplit(): [Card[], Card[]] {
    const deck = shuffle(createDeck());
    return splitDeck(deck);
  }
}

export const deckService = new DeckService();
