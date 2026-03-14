// handGenerator.js
// Logic to generate Mahjong hands for training

import { createDeck } from '../constants.js';

/**
 * Shuffles an array in place
 */
const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

/**
 * Sorts Mahjong tiles by suit and number
 */
export const sortHand = (hand) => {
    const suitOrder = { 'm': 0, 'p': 1, 's': 2, 'z': 3 };
    return [...hand].sort((a, b) => {
        const suitA = a.slice(-1);
        const suitB = b.slice(-1);
        if (suitA !== suitB) return suitOrder[suitA] - suitOrder[suitB];
        return parseInt(a) - parseInt(b);
    });
};

/**
 * Generates a random Taiwan Mahjong hand of a specific length
 */
export const generateRandomHand = (count = 17, includeHonors = true) => {
    let deck = createDeck();
    if (!includeHonors) {
        deck = deck.filter(tile => !tile.endsWith('z'));
    }
    deck = shuffle(deck);
    return sortHand(deck.slice(0, count));
};

/**
 * Generates a training hand based on desired tile count.
 * Valid options for standard play are usually 3n + 1 (4, 7, 10, 13) or 17 for Taiwan MJ.
 */
export const generateTrainingHand = (tileCount = 17, includeHonors = false) => {
    return generateRandomHand(tileCount, includeHonors);
};
