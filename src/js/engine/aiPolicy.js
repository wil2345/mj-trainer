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

const CHARACTER_PROFILES = {
    'aggressive': { efficiencyWeight: 1.0, dangerWeight: 0.1 },
    'balanced': { efficiencyWeight: 0.8, dangerWeight: 0.5 },
    'defensive': { efficiencyWeight: 0.4, dangerWeight: 1.5 },
    'cowardly': { efficiencyWeight: 0.1, dangerWeight: 5.0 }
};

/**
 * Calculates a danger score (0-100) for a tile from the AI's perspective
 * relative to the player's potential hand.
 */
function calculateTileDanger(tile, boardState) {
    const playerRiver = boardState.player.river;
    const playerOpen = boardState.player.open;
    const deadTiles = getDeadTiles(boardState);

    // 1. Genbutsu (現物) - 100% safe
    // Also include tiles the player has "stolen" via Chi/Pon as safe
    const playerRiverPlusStolen = [...playerRiver];
    playerOpen.forEach(m => { 
        if (Array.isArray(m)) playerRiverPlusStolen.push(m[1]); 
        else if (m.tiles) playerRiverPlusStolen.push(m.tiles[0]);
    });
    
    if (playerRiverPlusStolen.includes(tile)) return 0;

    const val = parseInt(tile[0]);
    const suit = tile[1];

    // 2. Honors (Jihai)
    if (suit === 'z') {
        const visibleCount = deadTiles.filter(t => t === tile).length;
        if (visibleCount === 4) return 0;
        if (visibleCount === 3) return 5;
        if (visibleCount === 2) return 15;
        return 50;
    }

    // 3. Suji (筋)
    let isSuji = false;
    if (val === 1) isSuji = playerRiverPlusStolen.includes(`4${suit}`);
    else if (val === 2) isSuji = playerRiverPlusStolen.includes(`5${suit}`);
    else if (val === 3) isSuji = playerRiverPlusStolen.includes(`6${suit}`);
    else if (val === 4) isSuji = playerRiverPlusStolen.includes(`1${suit}`) && playerRiverPlusStolen.includes(`7${suit}`);
    else if (val === 5) isSuji = playerRiverPlusStolen.includes(`2${suit}`) && playerRiverPlusStolen.includes(`8${suit}`);
    else if (val === 6) isSuji = playerRiverPlusStolen.includes(`3${suit}`) && playerRiverPlusStolen.includes(`9${suit}`);
    else if (val === 7) isSuji = playerRiverPlusStolen.includes(`4${suit}`);
    else if (val === 8) isSuji = playerRiverPlusStolen.includes(`5${suit}`);
    else if (val === 9) isSuji = playerRiverPlusStolen.includes(`6${suit}`);

    if (isSuji) return 15;

    // 4. Kabe (壁)
    const counts = {};
    deadTiles.forEach(t => counts[t] = (counts[t] || 0) + 1);
    
    // If all 4 copies of an adjacent tile are visible, it's safer
    const checkKabe = (v) => v >= 1 && v <= 9 && counts[`${v}${suit}`] === 4;
    if (checkKabe(val - 1) || checkKabe(val + 1)) return 10;

    // 5. Default
    return 100;
}

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

        if (aiSettings.style === 'defensive' || aiSettings.style === 'cowardly') {
            // Defensive/Cowardly AI ONLY makes a call if it can discard a 100% safe tile 
            // (already in player's river or stolen from player)
            const playerRiverPlusStolen = [...boardState.player.river];
            boardState.player.open.forEach(m => { 
                if (Array.isArray(m)) playerRiverPlusStolen.push(m[1]); 
                else if (m.tiles) playerRiverPlusStolen.push(m.tiles[0]);
            });

            const hasSafeDiscard = nextAnalysis.some(a => 
                a.shanten === nextShanten && playerRiverPlusStolen.includes(a.discard)
            );
            if (!hasSafeDiscard) return { valid: false };

            // Cowardly AI refuses to open its hand if the opponent is very dangerous (3+ melds)
            if (aiSettings.style === 'cowardly' && boardState.player.open.length >= 3) {
                return { valid: false };
            }
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
export async function decideAiDiscard(boardState, aiSettings, forbiddenDiscard, previousStatus = null) {
    const ai = boardState.ai;
    const deadTiles = getDeadTiles(boardState);
    const analysis = getDiscardAnalysis(ai.closed, ai.open.length, deadTiles)
        .filter(a => a.discard !== forbiddenDiscard);

    if (analysis.length === 0) {
        const allowed = ai.closed.filter(t => t !== forbiddenDiscard);
        return { discard: allowed.length > 0 ? allowed[0] : ai.closed[0], analysisPayload: null };
    }

    // 1. Get Character Profile (Attack/Defend Weights)
    const profile = CHARACTER_PROFILES[aiSettings.style] || CHARACTER_PROFILES['balanced'];
    
    // 2. Calculate Opponent Danger Multiplier
    // The multiplier increases based on how close the player looks to winning.
    let opponentDangerMultiplier = 1.0;
    const playerOpenCount = boardState.player.open.length;
    if (playerOpenCount === 1) opponentDangerMultiplier = 1.2;
    else if (playerOpenCount === 2) opponentDangerMultiplier = 1.5;
    else if (playerOpenCount === 3) opponentDangerMultiplier = 2.5;
    else if (playerOpenCount === 4) opponentDangerMultiplier = 5.0;

    // 3. Score each potential move
    const scoredMoves = analysis.map(m => {
        // Efficiency Score: Higher is better. 
        // Shanten is dominant (100 pts per level), Acceptance is a tie-breaker.
        const efficiencyScore = (10 - m.shanten) * 100 + (m.acceptance / 4);
        
        // Danger Score: 0 to 100. Higher is more dangerous.
        const dangerScore = calculateTileDanger(m.discard, boardState);
        
        // Final Weighted Score
        const finalScore = (profile.efficiencyWeight * efficiencyScore) - 
                           (profile.dangerWeight * dangerScore * opponentDangerMultiplier);
        
        return { 
            ...m, 
            efficiencyScore, 
            dangerScore, 
            finalScore 
        };
    });

    // Sort by Final Score (Descending)
    scoredMoves.sort((a, b) => b.finalScore - a.finalScore);

    let bestMove;
    const handSizeAfterDiscard = ai.closed.length - 1;
    let analysisPayload = null;

    if (aiSettings.difficulty === 'expert') {
        // Find candidates that are very close in score to the top choice
        const topTierCandidates = scoredMoves.filter(m => m.finalScore >= (scoredMoves[0].finalScore * 0.98));

        // Use Monte Carlo if there's a tie to break and we're close to winning
        if (topTierCandidates.length > 1 && scoredMoves[0].shanten <= 2 && handSizeAfterDiscard < 14) {
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
                    danger: c.dangerScore,
                    winRate: evaluations[idx] 
                })).sort((a, b) => b.winRate - a.winRate)
            };
        } else {
            bestMove = scoredMoves[0].discard;
            analysisPayload = { 
                type: 'scoring', 
                style: aiSettings.style,
                options: scoredMoves.slice(0, 3).map(m => ({ 
                    discard: m.discard, 
                    shanten: m.shanten, 
                    acceptance: m.acceptance,
                    acceptedTilesCount: m.acceptedTiles.length,
                    danger: m.dangerScore,
                    efficiency: Math.round(m.efficiencyScore),
                    score: Math.round(m.finalScore)
                })) 
            };
        }
    } else if (aiSettings.difficulty === 'random') {
        const allowedClosedHand = ai.closed.filter(t => t !== forbiddenDiscard);
        bestMove = allowedClosedHand[Math.floor(Math.random() * allowedClosedHand.length)];
        analysisPayload = { type: 'random', options: [] };
    } else if (aiSettings.difficulty === 'beginner') {
        const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
        bestMove = topMoves[Math.floor(Math.random() * topMoves.length)].discard;
        analysisPayload = { 
            type: 'beginner', 
            options: topMoves.map(m => ({ 
                discard: m.discard, 
                shanten: m.shanten, 
                acceptance: m.acceptance,
                acceptedTilesCount: m.acceptedTiles.length,
                danger: m.dangerScore,
                efficiency: Math.round(m.efficiencyScore),
                score: Math.round(m.finalScore)
            })) 
        };
    } else {
        bestMove = scoredMoves[0].discard;
        analysisPayload = { 
            type: 'scoring', 
            style: aiSettings.style,
            options: scoredMoves.slice(0, 3).map(m => ({ 
                discard: m.discard, 
                shanten: m.shanten, 
                acceptance: m.acceptance,
                acceptedTilesCount: m.acceptedTiles.length,
                danger: m.dangerScore,
                efficiency: Math.round(m.efficiencyScore),
                score: Math.round(m.finalScore)
            })) 
        };
    }
    
    if (analysisPayload) {
        const chosenAnalysis = scoredMoves.find(a => a.discard === bestMove) || scoredMoves[0];
        if (chosenAnalysis) {
            analysisPayload.chosenStatus = { 
                shanten: chosenAnalysis.shanten, 
                acceptance: chosenAnalysis.acceptance,
                acceptedTilesCount: chosenAnalysis.acceptedTiles.length
            };
        }
        
        // Use the explicitly provided previous status if available
        if (previousStatus) {
            analysisPayload.previousStatus = previousStatus;
        } else {
            // Fallback: If no previous status was recorded, use the current best possible move as the baseline
            // (Note: This will show no improvement if the AI makes the optimal move)
            analysisPayload.previousStatus = {
                shanten: scoredMoves[0].shanten,
                acceptance: scoredMoves[0].acceptance,
                acceptedTilesCount: scoredMoves[0].acceptedTiles.length
            };
        }
    }

    return { discard: bestMove, analysisPayload };
}
