// mcWorker.js
import { calculateShanten, getDiscardAnalysis, isWinningHand } from './shanten.js';
import { ALL_TILES } from '../constants.js';

// Helper to shuffle an array
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// Helper to sort a hand properly for Mahjong
function sortMahjongHand(hand) {
    const suitOrder = { 'm': 1, 'p': 2, 's': 3, 'z': 4 };
    return hand.sort((a, b) => {
        if (suitOrder[a[1]] !== suitOrder[b[1]]) {
            return suitOrder[a[1]] - suitOrder[b[1]];
        }
        return parseInt(a[0]) - parseInt(b[0]);
    });
}

self.onmessage = function(e) {
    const { hand, discard, runs, maxDraws, includeHonors } = e.data;
    
    // Validate inputs
    if (!hand || !discard) {
        self.postMessage({ error: 'Invalid hand or discard' });
        return;
    }

    // 1. Build initial remaining wall
    const initialWall = [];
    const tileCounts = {};
    ALL_TILES.forEach(t => tileCounts[t] = 4);
    
    // Remove tiles in current hand (including the one about to be discarded)
    hand.forEach(t => {
        if (tileCounts[t]) tileCounts[t]--;
    });
    
    // Generate the flat array of remaining tiles
    for (let tile in tileCounts) {
        // Respect the includeHonors setting if it's a z tile
        if (!includeHonors && tile.endsWith('z')) continue;
        for (let i = 0; i < tileCounts[tile]; i++) {
            initialWall.push(tile);
        }
    }

    // Hand after discard
    const startHand = [...hand];
    const discardIndex = startHand.indexOf(discard);
    if (discardIndex !== -1) {
        startHand.splice(discardIndex, 1);
    }

    const initialShanten = calculateShanten(startHand);
    
    let totalDrawsToWin = 0;
    let winCount = 0;
    let tenpaiCount = 0;
    let finalHands = {}; // To track top final forms
    
    // Cache optimal moves for specific hand states to bypass heavy DP calculations
    const stateCache = {}; 
    
    // 2. Run simulation loop
    for (let run = 0; run < runs; run++) {
        let wall = [...initialWall];
        shuffle(wall);
        
        let simHand = [...startHand];
        let won = false;
        
        for (let drawIndex = 0; drawIndex < maxDraws; drawIndex++) {
            if (wall.length === 0) break; // Shouldn't happen but just in case
            
            // Draw
            const drawnTile = wall.pop();
            simHand.push(drawnTile);
            
            // Sort hand immediately for consistent state caching and final stringification
            sortMahjongHand(simHand);
            const stateKey = simHand.join('');
            
            // Check win
            if (isWinningHand(simHand)) {
                won = true;
                winCount++;
                totalDrawsToWin += (drawIndex + 1);
                
                finalHands[stateKey] = (finalHands[stateKey] || 0) + 1;
                break;
            }
            
            // Not a win, we must discard
            let discardTile;
            
            // Check if we've already calculated the optimal move for this exact hand shape
            if (stateCache[stateKey]) {
                discardTile = stateCache[stateKey];
            } else {
                const analysis = getDiscardAnalysis(simHand);
                // Analysis is sorted by shanten ascending, then acceptance descending
                const bestShanten = analysis[0].shanten;
                const bestAcceptance = analysis[0].acceptance;
                
                const optimalMoves = analysis.filter(a => a.shanten === bestShanten && a.acceptance === bestAcceptance);
                
                // Pick a random optimal move
                discardTile = optimalMoves[Math.floor(Math.random() * optimalMoves.length)].discard;
                
                // Save to cache for future runs
                stateCache[stateKey] = discardTile;
            }
            
            // Remove the discarded tile
            const discardIdx = simHand.indexOf(discardTile);
            if (discardIdx !== -1) {
                simHand.splice(discardIdx, 1);
            }
        }
        
        // If the run finished without a win, record its final shape and check Tenpai
        if (!won) {
            // Check if it reached Tenpai
            if (calculateShanten(simHand) === 0) {
                tenpaiCount++;
            }
            
            // Always record the final shape reached at the end of the simulation
            // Ensure we sort it first since the last loop iteration modified it
            sortMahjongHand(simHand);
            const stateKey = simHand.join('');
            finalHands[stateKey] = (finalHands[stateKey] || 0) + 1;
        }

        // Report progress every 5% or minimum every 100 runs
        const reportInterval = Math.max(100, Math.floor(runs / 20));
        if (run % reportInterval === 0 && run > 0) {
            self.postMessage({
                progress: true,
                percent: Math.floor((run / runs) * 100)
            });
        }
    }
    
    // 3. Process results
    const winRate = (winCount / runs) * 100;
    const tenpaiRate = ((tenpaiCount + winCount) / runs) * 100; // Tenpai includes wins
    const avgDraws = winCount > 0 ? (totalDrawsToWin / winCount) : null;
    
    // Sort final hands by frequency, then by shanten (ascending)
    const topFinalHands = Object.entries(finalHands)
        .map(entry => {
            // Reconstruct array from string (every 2 chars)
            const handArr = [];
            for (let i = 0; i < entry[0].length; i += 2) {
                handArr.push(entry[0].substring(i, i+2));
            }
            return {
                hand: handArr,
                count: entry[1],
                shanten: calculateShanten(handArr)
            };
        })
        .sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.shanten - b.shanten;
        })
        .slice(0, 20);

    self.postMessage({
        success: true,
        stats: {
            winRate,
            tenpaiRate,
            avgDraws,
            winCount,
            runs,
            maxDraws,
            topFinalHands
        }
    });
};
