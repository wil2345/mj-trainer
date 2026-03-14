// constants.js
// Mahjong tile definitions and metadata

export const SUITS = ['m', 'p', 's', 'z'];

export const TILE_MAP = {
    m: Array.from({ length: 9 }, (_, i) => `${i + 1}m`),
    p: Array.from({ length: 9 }, (_, i) => `${i + 1}p`),
    s: Array.from({ length: 9 }, (_, i) => `${i + 1}s`),
    z: Array.from({ length: 7 }, (_, i) => `${i + 1}z`)
};

export const ALL_TILES = [
    ...TILE_MAP.m,
    ...TILE_MAP.p,
    ...TILE_MAP.s,
    ...TILE_MAP.z
];

export const TILE_NAMES = {
    '1m': '一萬', '2m': '二萬', '3m': '三萬', '4m': '四萬', '5m': '五萬', '6m': '六萬', '7m': '七萬', '8m': '八萬', '9m': '九萬',
    '1p': '一筒', '2p': '二筒', '3p': '三筒', '4p': '四筒', '5p': '五筒', '6p': '六筒', '7p': '七筒', '8p': '八筒', '9p': '九筒',
    '1s': '一索', '2s': '二索', '3s': '三索', '4s': '四索', '5s': '五索', '6s': '六索', '7s': '七索', '8s': '八索', '9s': '九索',
    '1z': '東', '2z': '南', '3z': '西', '4z': '北', '5z': '中', '6z': '發', '7z': '白'
};

// Helper to get all 144 tiles in a deck
export const createDeck = () => {
    const deck = [];
    ALL_TILES.forEach(tile => {
        for (let i = 0; i < 4; i++) {
            deck.push(tile);
        }
    });
    return deck;
};
