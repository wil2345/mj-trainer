// aiPolicy.js
// Pure functional engine to decide AI moves based on board state and settings.
// Does NOT mutate the game state or interact with the DOM/UI.

import { 
    calculateShanten, 
    getDiscardAnalysis, 
    isWinningHand, 
    getChiOptions, 
    getPonOptions, 
    getKanOptions, 
    getClosedKanOptions 
} from './shanten.js';
import { TILE_NAMES } from '../constants.js';

/**
 * Extracts all visibly dead tiles from the board state from the AI's perspective.
 */
function getDeadTiles(boardState) {
    const deadTiles = [];
    deadTiles.push(...boardState.player.river);
    deadTiles.push(...boardState.ai.river);
    
    const extractOpenTiles = (openMelds, isAi) => {
        const tiles = [];
        openMelds.forEach(meld => {
            if (Array.isArray(meld)) {
                tiles.push(...meld);
            } else if (meld.tiles) {
                // For Ankan: AI knows its own Ankan. 
                // AI does NOT technically know the contents of the Player's Ankan unless revealed.
                // To keep the AI strictly mathematical, we only count the player's Ankan if it's explicitly revealed.
                // Note: The UI layer might reveal it at game over, but the AI policy evaluates during active play.
                if (isAi || !meld.isClosed) {
                    tiles.push(...meld.tiles);
                }
            }
        });
        return tiles;
    };
    
    deadTiles.push(...extractOpenTiles(boardState.player.open, false));
    deadTiles.push(...extractOpenTiles(boardState.ai.open, true));
    return deadTiles;
}

/**
 * Calculates the exact DP status (Shanten, Types, Counts) of a given closed hand.
 */
export function calculateRestingStatus(closedHand, openMeldCount, boardState) {
    const currentShanten = calculateShanten(closedHand, openMeldCount);
    let currentAcceptance = 0;
    let currentAcceptedTilesCount = 0;

    const initialCounts = {};
    closedHand.forEach(t => { initialCounts[t] = (initialCounts[t] || 0) + 1; });

    const deadTiles = getDeadTiles(boardState);
    deadTiles.forEach(t => { initialCounts[t] = (initialCounts[t] || 0) + 1; });

    Object.keys(TILE_NAMES).forEach(t => {
        if ((initialCounts[t] || 0) >= 4) return;
        if (calculateShanten([...closedHand, t], openMeldCount) < currentShanten) {
            currentAcceptance += (4 - (initialCounts[t] || 0));
            currentAcceptedTilesCount += 1;
        }
    });

    return { shanten: currentShanten, acceptance: currentAcceptance, acceptedTilesCount: currentAcceptedTilesCount };
}

/**
 * Determines if the AI should steal a discarded tile.
 * Returns an action object { action: 'ron'|'kan'|'pon'|'chi', tile, opt? } or null.
 */
export function decideAiInterrupt(tile, boardState, aiSettings) {
    const ai = boardState.ai;
    
    // 1. Check Ron (Always Ron if possible)
    if (isWinningHand([...ai.closed, tile], ai.open.length)) {
        return { action: 'ron', tile };
    }

    // Evaluate resting status to compare improvements
    const currentStatus = calculateRestingStatus(ai.closed, ai.open.length, boardState);
    const deadTiles = getDeadTiles(boardState);

    // Helper to evaluate if a call is worth it based on style
    const evaluateCall = (tempHand, nextOpenCount, tilesFromHandUsedForCall) => {
        const hypotheticalDeadTiles = [...deadTiles, ...tilesFromHandUsedForCall];
        const nextAnalysisRaw = getDiscardAnalysis(tempHand, nextOpenCount, hypotheticalDeadTiles);
        const nextAnalysis = nextAnalysisRaw.filter(a => a.discard !== tile); // Cannot discard stolen tile
        
        if (nextAnalysis.length === 0) return { valid: false };
        
        const nextShanten = nextAnalysis[0].shanten;
        const nextAcceptance = nextAnalysis[0].acceptance;

        // A call MUST either be faster (lower shanten) OR result in more acceptance (better wait)
        const isImprovement = (nextShanten < currentStatus.shanten) || 
                              (nextShanten === currentStatus.shanten && nextAcceptance > currentStatus.acceptance);
        
        if (!isImprovement) return { valid: false };

        if (aiSettings.style === 'defensive') {
            // Defensive AI ONLY makes a call if it can discard a 100% safe tile 
            // (already in player's river or stolen from player)
            const playerRiverPlusStolen = [...boardState.player.river];
            ai.open.forEach(m => { if (Array.isArray(m)) playerRiverPlusStolen.push(m[1]); });

            const hasSafeDiscard = nextAnalysis.some(a => 
                a.shanten === nextShanten && playerRiverPlusStolen.includes(a.discard)
            );
            if (!hasSafeDiscard) return { valid: false };
        }
        
        // Aggressive & Balanced take any move that is a strict improvement
        return { valid: true, shanten: nextShanten, acceptance: nextAcceptance };
    };

    // 2. Check AI Kan (Open)
    if (getKanOptions(ai.closed, tile)) {
        const tempHand = ai.closed.filter(t => t !== tile);
        if (evaluateCall(tempHand, ai.open.length + 1, [tile, tile, tile]).valid) {
            return { action: 'kan', tile };
        }
    }

    // 3. Check AI Pon
    if (getPonOptions(ai.closed, tile)) {
        const tempHand = [...ai.closed];
        tempHand.splice(tempHand.indexOf(tile), 1);
        tempHand.splice(tempHand.indexOf(tile), 1);
        if (evaluateCall(tempHand, ai.open.length + 1, [tile, tile]).valid) {
            return { action: 'pon', tile };
        }
    }

    // 4. Check AI Chi
    const chiOptions = getChiOptions(ai.closed, tile);
    let bestChi = null;
    let bestChiEval = null;

    for (let opt of chiOptions) {
        const tempHand = [...ai.closed];
        tempHand.splice(tempHand.indexOf(opt[0]), 1);
        tempHand.splice(tempHand.indexOf(opt[1]), 1);
        
        const evalResult = evaluateCall(tempHand, ai.open.length + 1, opt);
        if (evalResult.valid) {
            if (!bestChiEval || 
                evalResult.shanten < bestChiEval.shanten || 
                (evalResult.shanten === bestChiEval.shanten && evalResult.acceptance > bestChiEval.acceptance)) {
                bestChi = opt;
                bestChiEval = evalResult;
            }
        }
    }

    if (bestChi) {
        return { action: 'chi', tile, opt: bestChi };
    }

    return null;
}

/**
 * Determines what the AI should do at the start of its turn after drawing.
 * Returns { action: 'tsumo'|'ankan'|'kakan', tile? } or null.
 */
export function decideAiTurnAction(boardState, aiSettings) {
    const ai = boardState.ai;
    
    if (isWinningHand(ai.closed, ai.open.length)) {
        return { action: 'tsumo' };
    }

    if (aiSettings.style !== 'defensive') {
        const kanOpts = getClosedKanOptions(ai.closed, ai.open);
        if (kanOpts.length > 0) {
            // Simple heuristic: always Kan if it doesn't increase Shanten
            const currentShanten = calculateShanten(ai.closed, ai.open.length);
            for (let opt of kanOpts) {
                let tempHand;
                if (opt.type === 'ankan') {
                    tempHand = ai.closed.filter(t => t !== opt.tile);
                } else {
                    tempHand = [...ai.closed];
                    tempHand.splice(tempHand.indexOf(opt.tile), 1);
                }
                
                if (calculateShanten(tempHand, ai.open.length + 1) <= currentShanten) {
                    return { action: opt.type, tile: opt.tile };
                }
            }
        }
    }
    
    return null;
}

/**
 * Internal helper to spawn a Monte Carlo worker evaluation.
 */
function runMCEvaluation(hand, discard, runs, maxDraws, includeHonors, deadTiles = []) {
    return new Promise((resolve) => {
        const worker = new Worker('./src/js/engine/mcWorker.js', { type: 'module' });
        worker.onmessage = function(e) {
            if (e.data.success) {
                resolve(e.data.stats.winRate);
                worker.terminate();
            } else if (e.data.error) {
                resolve(0); // On error, treat as 0% win rate
                worker.terminate();
            }
        };
        worker.postMessage({ 
            hand, 
            discard, 
            runs, 
            maxDraws, 
            includeHonors,
            policy: 'greedy',
            deadTiles
        });
    });
}

/**
 * Determines the best tile for the AI to discard.
 * Returns a Promise that resolves to: { discard: string, analysisPayload: object }
 */
export async function decideAiDiscard(boardState, aiSettings, forbiddenDiscard) {
    const ai = boardState.ai;
    const allowedClosedHand = ai.closed.filter(t => t !== forbiddenDiscard);
    const deadTiles = getDeadTiles(boardState);
    
    const analysis = getDiscardAnalysis(ai.closed, ai.open.length, deadTiles)
        .filter(a => a.discard !== forbiddenDiscard);

    if (aiSettings.style === 'defensive') {
        // Gathering player discards specifically for safety logic
        const playerRiverPlusStolen = [...boardState.player.river];
        ai.open.forEach(m => { if (Array.isArray(m)) playerRiverPlusStolen.push(m[1]); });

        // Defensive AI prioritizes safe discards within the same Shanten level
        analysis.sort((a, b) => {
            if (a.shanten !== b.shanten) return a.shanten - b.shanten;
            const aSafe = playerRiverPlusStolen.includes(a.discard);
            const bSafe = playerRiverPlusStolen.includes(b.discard);
            if (aSafe && !bSafe) return -1;
            if (!aSafe && bSafe) return 1;
            return b.acceptance - a.acceptance;
        });
    }

    if (analysis.length === 0 && allowedClosedHand.length === 0) {
        return { discard: ai.closed[0], analysisPayload: null };
    }

    let bestMove;
    const handSizeAfterDiscard = ai.closed.length - 1;
    let analysisPayload = null;

    if (aiSettings.difficulty === 'expert') {
        const bestPossibleShanten = analysis[0].shanten;
        const bestAcceptance = analysis[0].acceptance;
        const bestTypes = analysis[0].acceptedTiles.length;
        
        let topTierCandidates = analysis.filter(a => 
            a.shanten === bestPossibleShanten && 
            a.acceptance === bestAcceptance &&
            a.acceptedTiles.length === bestTypes
        );

        if (aiSettings.style === 'defensive') {
            const playerRiverPlusStolen = [...boardState.player.river];
            ai.open.forEach(m => { if (Array.isArray(m)) playerRiverPlusStolen.push(m[1]); });
            
            const safeCandidates = topTierCandidates.filter(a => playerRiverPlusStolen.includes(a.discard));
            if (safeCandidates.length > 0) {
                topTierCandidates = safeCandidates;
            }
        }

        // Only run MC if there is a tie to break, close to winning (<= 2 shanten), and hand size is < 14
        if (topTierCandidates.length > 1 && bestPossibleShanten <= 2 && handSizeAfterDiscard < 14) {
            let iterations, maxDraws;
            if (handSizeAfterDiscard > 10) {
                iterations = 200;
                maxDraws = 3;
            } else {
                iterations = 1000;
                maxDraws = 5;
            }
            
            const evaluations = await Promise.all(topTierCandidates.map(c => 
                runMCEvaluation(ai.closed, c.discard, iterations, maxDraws, true, deadTiles)
            ));
            
            let maxWinRate = -1;
            let bestCandidateIdx = 0;
            evaluations.forEach((rate, idx) => {
                if (rate > maxWinRate) {
                    maxWinRate = rate;
                    bestCandidateIdx = idx;
                }
            });
            bestMove = topTierCandidates[bestCandidateIdx].discard;
            
            analysisPayload = {
                type: 'mc',
                options: topTierCandidates.map((c, idx) => ({ 
                    discard: c.discard, 
                    shanten: c.shanten,
                    acceptance: c.acceptance,
                    acceptedTilesCount: c.acceptedTiles.length,
                    winRate: evaluations[idx] 
                })).sort((a, b) => b.winRate - a.winRate)
            };
        } else {
            bestMove = topTierCandidates[0].discard;
            analysisPayload = { 
                type: aiSettings.style === 'defensive' ? 'defensive' : 'dp', 
                options: analysis.slice(0, 3).map(m => ({ 
                    discard: m.discard, 
                    shanten: m.shanten, 
                    acceptance: m.acceptance,
                    acceptedTilesCount: m.acceptedTiles.length
                })) 
            };
        }
    } else if (aiSettings.difficulty === 'random') {
        bestMove = allowedClosedHand[Math.floor(Math.random() * allowedClosedHand.length)];
        analysisPayload = { type: 'random', options: [] };
    } else if (aiSettings.difficulty === 'beginner') {
        const topMoves = analysis.slice(0, Math.min(3, analysis.length));
        bestMove = topMoves[Math.floor(Math.random() * topMoves.length)].discard;
        analysisPayload = { 
            type: 'beginner', 
            options: topMoves.map(m => ({ 
                discard: m.discard, 
                shanten: m.shanten, 
                acceptance: m.acceptance,
                acceptedTilesCount: m.acceptedTiles.length 
            })) 
        };
    } else {
        // Fallback for an unknown difficulty (shouldn't happen, defaults to best DP move)
        bestMove = analysis[0].discard;
        analysisPayload = { 
            type: aiSettings.style === 'defensive' ? 'defensive' : 'dp', 
            options: analysis.slice(0, 3).map(m => ({ 
                discard: m.discard, 
                shanten: m.shanten, 
                acceptance: m.acceptance,
                acceptedTilesCount: m.acceptedTiles.length
            })) 
        };
    }
    
    if (analysisPayload) {
        const chosenAnalysis = analysis.find(a => a.discard === bestMove) || analysis[0];
        if (chosenAnalysis) {
            analysisPayload.chosenStatus = { 
                shanten: chosenAnalysis.shanten, 
                acceptance: chosenAnalysis.acceptance,
                acceptedTilesCount: chosenAnalysis.acceptedTiles.length
            };
        }
    }

    return { discard: bestMove, analysisPayload };
}
