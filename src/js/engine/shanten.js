// shanten.js
// High-performance Dynamic Programming (DP) Algorithm for Shanten and Tile Acceptance

import { ALL_TILES, TILE_NAMES } from '../constants.js';

// Global cache for the DP engine to ensure high performance across multiple checks
let dpMemo = new Map();

/**
 * Converts a hand array to 4 suit arrays containing counts
 */
const handToSuitCounts = (hand) => {
    let counts = {
        m: Array(9).fill(0),
        p: Array(9).fill(0),
        s: Array(9).fill(0),
        z: Array(7).fill(0)
    };

    hand.forEach(tile => {
        let val = parseInt(tile[0]) - 1;
        let suit = tile[1];
        counts[suit][val]++;
    });
    return counts;
};

/**
 * DP Recursive function to find optimal (Melds, Taatsus, Pairs) combinations for a suit
 */
const getSuitCombos = (counts) => {
    let key = counts.join('');
    if (dpMemo.has(key)) return dpMemo.get(key);

    let results = [];
    let i = counts.findIndex(val => val > 0);
    
    // Base case: empty suit
    if (i === -1) {
        return [{m: 0, t: 0, p: 0}];
    }

    // Branch 1: Ignore 1 copy of this tile (useful for isolating optimal structures)
    let c_disc = [...counts];
    c_disc[i]--;
    results.push(...getSuitCombos(c_disc));

    // Branch 2: Extract a Pung (Triplet)
    if (counts[i] >= 3) {
        let c_pung = [...counts];
        c_pung[i] -= 3;
        let res = getSuitCombos(c_pung);
        for (let r of res) results.push({m: r.m + 1, t: r.t, p: r.p});
    }

    // Branch 3: Extract a Pair or Proto-Pung
    if (counts[i] >= 2) {
        let c_pair = [...counts];
        c_pair[i] -= 2;
        let res = getSuitCombos(c_pair);
        for (let r of res) {
            results.push({m: r.m, t: r.t, p: r.p + 1}); // Used as Pair
            results.push({m: r.m, t: r.t + 1, p: r.p}); // Used as Taatsu (Incomplete Pung)
        }
    }

    // Branch 4: Extract a Chow (Sequence)
    if (i <= 6 && counts[i] >= 1 && counts[i+1] >= 1 && counts[i+2] >= 1) {
        let c_chow = [...counts];
        c_chow[i]--; c_chow[i+1]--; c_chow[i+2]--;
        let res = getSuitCombos(c_chow);
        for (let r of res) results.push({m: r.m + 1, t: r.t, p: r.p});
    }

    // Branch 5: Extract a Taatsu (Two consecutive tiles waiting for edges)
    if (i <= 7 && counts[i] >= 1 && counts[i+1] >= 1) {
        let c_t1 = [...counts];
        c_t1[i]--; c_t1[i+1]--;
        let res = getSuitCombos(c_t1);
        for (let r of res) results.push({m: r.m, t: r.t + 1, p: r.p});
    }

    // Branch 6: Extract a Kanchan (Two tiles separated by 1, waiting for middle)
    if (i <= 6 && counts[i] >= 1 && counts[i+2] >= 1) {
        let c_t2 = [...counts];
        c_t2[i]--; c_t2[i+2]--;
        let res = getSuitCombos(c_t2);
        for (let r of res) results.push({m: r.m, t: r.t + 1, p: r.p});
    }

    // Pareto Filter: Only keep configurations that maximize Taatsus for a given (Pairs, Melds)
    let maxT = {};
    for (let r of results) {
        if (r.p > 1) continue; // Standard hand only has up to 1 pair
        let k = `${r.p}_${r.m}`;
        if (maxT[k] === undefined || r.t > maxT[k]) {
            maxT[k] = r.t;
        }
    }

    let filtered = [];
    for (let k in maxT) {
        let [p, m] = k.split('_').map(Number);
        filtered.push({p, m, t: maxT[k]});
    }

    dpMemo.set(key, filtered);
    return filtered;
};

/**
 * Honor tiles cannot form sequences, so their combos are calculated linearly.
 */
const getHonorCombos = (counts) => {
    let z_combos = [{m:0, t:0, p:0}];
    for (let i = 0; i < 7; i++) {
        let c = counts[i];
        let tile_combos = [{m:0, t:0, p:0}];
        if (c >= 3) {
            tile_combos.push({m:1, t:0, p:0}); // Pung
            tile_combos.push({m:0, p:1, t:0}); // Pair
            tile_combos.push({m:0, p:0, t:1}); // Proto-pung
        } else if (c === 2) {
            tile_combos.push({m:0, p:1, t:0}); // Pair
            tile_combos.push({m:0, p:0, t:1}); // Proto-pung
        }
        z_combos = mergeCombos(z_combos, tile_combos);
    }
    return z_combos;
};

/**
 * Cross-multiplies configurations from different suits, pruning invalid ones
 */
const mergeCombos = (combosA, combosB) => {
    let maxT = {};
    for (let a of combosA) {
        for (let b of combosB) {
            let p = a.p + b.p;
            let m = a.m + b.m;
            let t = a.t + b.t;
            if (p > 1 || m > 5) continue; // Exceeds max possible standard rules
            
            let key = `${p}_${m}`;
            if (maxT[key] === undefined || t > maxT[key]) {
                maxT[key] = t;
            }
        }
    }
    let res = [];
    for (let key in maxT) {
        let [p, m] = key.split('_').map(Number);
        res.push({p, m, t: maxT[key]});
    }
    return res;
};

// --- Special Forms Helper Functions ---
const ORPHANS = ['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];
const ALL_TILE_TYPES = [
    '1m','2m','3m','4m','5m','6m','7m','8m','9m',
    '1p','2p','3p','4p','5p','6p','7p','8p','9p',
    '1s','2s','3s','4s','5s','6s','7s','8s','9s',
    '1z','2z','3z','4z','5z','6z','7z'
];

const getCountsMap = (hand) => {
    let counts = {};
    hand.forEach(tile => {
        counts[tile] = (counts[tile] || 0) + 1;
    });
    return counts;
};

const getChiitoitsuShanten = (hand) => {
    const counts = getCountsMap(hand);
    let pairs = 0;
    let unique = 0;
    for (let tile in counts) {
        unique++;
        if (counts[tile] >= 2) pairs++;
    }
    let shanten = 6 - pairs;
    if (unique < 7) shanten += (7 - unique);
    return shanten;
};

const getKokushiShanten = (hand) => {
    const counts = getCountsMap(hand);
    let uniqueOrphans = 0;
    let hasPair = false;
    for (let o of ORPHANS) {
        if (counts[o] >= 1) uniqueOrphans++;
        if (counts[o] >= 2) hasPair = true;
    }
    return 13 - uniqueOrphans - (hasPair ? 1 : 0);
};

const getLiGuLiGuShanten = (hand) => {
    const counts = getCountsMap(hand);
    let countsArr = Object.values(counts).sort((a, b) => b - a);
    let score = 0;
    if (countsArr.length > 0) score += Math.min(countsArr[0], 3);
    for (let i = 1; i < 8; i++) {
        if (i < countsArr.length) score += Math.min(countsArr[i], 2);
    }
    return 16 - score;
};

const getTaiwanKokushiShanten = (hand) => {
    const counts = getCountsMap(hand);
    let maxScore = 0;
    for (let t of ALL_TILE_TYPES) {
        for (let p of ORPHANS) {
            let score = 0;
            for (let x of ALL_TILE_TYPES) {
                let required = 0;
                if (x === t) required += 3;
                if (x === p) required += 1;
                if (ORPHANS.includes(x)) required += 1;
                if (counts[x]) score += Math.min(counts[x], required);
            }
            if (score > maxScore) maxScore = score;
        }
    }
    return 16 - maxScore;
};

const getShiLiuBuDaShanten = (hand) => {
    const counts = getCountsMap(hand);
    const validBuDaSets = [];
    for(let a=1; a<=7; a++) {
        for(let b=a+3; b<=8; b++) {
            for(let c=b+3; c<=9; c++) {
                validBuDaSets.push([a, b, c]);
            }
        }
    }
    
    let honors = ['1z','2z','3z','4z','5z','6z','7z'];
    let maxScore = 0;
    
    for (let m_set of validBuDaSets) {
        for (let p_set of validBuDaSets) {
            for (let s_set of validBuDaSets) {
                let score = 0;
                let hasPair = false;
                
                for (let h of honors) {
                    if (counts[h] >= 1) score++;
                    if (counts[h] >= 2) hasPair = true;
                }
                for (let val of m_set) {
                    let tile = val + 'm';
                    if (counts[tile] >= 1) score++;
                    if (counts[tile] >= 2) hasPair = true;
                }
                for (let val of p_set) {
                    let tile = val + 'p';
                    if (counts[tile] >= 1) score++;
                    if (counts[tile] >= 2) hasPair = true;
                }
                for (let val of s_set) {
                    let tile = val + 's';
                    if (counts[tile] >= 1) score++;
                    if (counts[tile] >= 2) hasPair = true;
                }
                
                if (hasPair) score++;
                if (score > maxScore) maxScore = score;
            }
        }
    }
    return 16 - maxScore;
};

/**
 * Calculates accurate Shanten for any size hand (base size before drawing: 3n)
 * e.g., Base 16 for 17-tile Taiwan, Base 13 for 14-tile JP/HK, Base 4, 7, 10 for practice.
 */
export const calculateShanten = (hand) => {
    let counts = handToSuitCounts(hand);

    let totalCombos = [{m:0, t:0, p:0}];
    totalCombos = mergeCombos(totalCombos, getSuitCombos(counts.m));
    totalCombos = mergeCombos(totalCombos, getSuitCombos(counts.p));
    totalCombos = mergeCombos(totalCombos, getSuitCombos(counts.s));
    totalCombos = mergeCombos(totalCombos, getHonorCombos(counts.z));

    // Calculate required melds based on hand size.
    // E.g. A 16-tile base hand (before drawing to 17) requires 5 melds.
    // E.g. A 17-tile hand (after drawing) requires 5 melds and 1 pair to WIN (-1 shanten).
    // The formula targets the base size: Math.floor(hand.length / 3)
    const isDrawnState = hand.length % 3 === 2;
    const baseLength = isDrawnState ? hand.length - 1 : hand.length;
    const targetMelds = Math.floor(baseLength / 3);
    const maxShanten = targetMelds * 2; // e.g. 5 melds = 10 shanten max

    let minShanten = 99;
    for (let r of totalCombos) {
        let usable_taatsus = Math.min(r.t, targetMelds - r.m);
        // Formula: MaxShanten - (2 * Melds) - UsableTaatsus - Pair
        let shanten = maxShanten - (2 * r.m) - usable_taatsus - r.p;
        
        // If the hand is in a "drawn" state (e.g. 17 tiles), check if it's already complete.
        // A complete 17-tile hand has exactly targetMelds (5) and 1 pair.
        if (isDrawnState && r.m === targetMelds && r.p === 1) {
            minShanten = -1; // Standard Winning Hand
            break;
        }
        
        if (shanten < minShanten) {
            minShanten = shanten;
        }
    }

    // --- Special Form Calculations ---
    if (baseLength === 13) {
        // Japanese 13-tile base special forms (For Tenhou tests / 14-tile practice)
        minShanten = Math.min(minShanten, getChiitoitsuShanten(hand));
        minShanten = Math.min(minShanten, getKokushiShanten(hand));
    } else if (baseLength === 16) {
        // Taiwan 16-tile base special forms (17-tile practice)
        minShanten = Math.min(minShanten, getLiGuLiGuShanten(hand));
        minShanten = Math.min(minShanten, getTaiwanKokushiShanten(hand));
        minShanten = Math.min(minShanten, getShiLiuBuDaShanten(hand));
    }

    return minShanten;
};

/**
 * Checks if a fully drawn hand (3n + 2) is a winning hand.
 */
export const isWinningHand = (hand) => {
    dpMemo.clear();
    return calculateShanten(hand) === -1;
};

/**
 * For a 17-tile hand, find all possible discards and their resulting tile acceptance.
 */
export const getDiscardAnalysis = (hand) => {
    dpMemo.clear(); // Clear cache at the start of a new analysis run to save memory
    
    const analysis = [];
    const uniqueTiles = [...new Set(hand)];
    
    // Count current occurrences to prevent drawing > 4 of a tile
    const initialCounts = {};
    hand.forEach(tile => {
        initialCounts[tile] = (initialCounts[tile] || 0) + 1;
    });
    
    uniqueTiles.forEach(discard => {
        // Simulate discarding
        const tempHand = [...hand];
        const index = tempHand.indexOf(discard);
        tempHand.splice(index, 1);
        
        const currentShanten = calculateShanten(tempHand);
        
        // Find accepted tiles
        let acceptanceCount = 0;
        const acceptedTiles = [];

        // We only need to check the 34 unique tile types, not the 136 full deck.
        const UNIQUE_TILE_TYPES = Object.keys(TILE_NAMES);

        UNIQUE_TILE_TYPES.forEach(tile => {
            // How many of this tile did we originally draw?
            const countInHand = initialCounts[tile] || 0;
            
            // To simulate the draw, we add 'tile' to our 16-tile hand.
            // If the resulting 17-tile hand has a lower shanten, it's an accepted tile.
            const nextHand = [...tempHand, tile];
            
            // We can never draw a tile if we already drew all 4 copies initially.
            if (countInHand >= 4) return;

            if (calculateShanten(nextHand) < currentShanten) {
                // The remaining tiles in the deck are ALWAYS 4 minus whatever we
                // originally held in our initial hand. Discarding a tile doesn't 
                // put it back into the deck to be drawn again.
                const remaining = 4 - countInHand;
                acceptanceCount += remaining;
                acceptedTiles.push({ tile, count: remaining });
            }
        });

        analysis.push({
            discard,
            shanten: currentShanten,
            acceptance: acceptanceCount,
            acceptedTiles
        });
    });

    // Sort: 1st by Lowest Shanten, 2nd by Highest Acceptance
    return analysis.sort((a, b) => {
        if (a.shanten !== b.shanten) return a.shanten - b.shanten;
        return b.acceptance - a.acceptance;
    });
};
