import { mulberry32 } from '../src/js/utils.js';
import { createDeck } from '../src/js/constants.js';
import { sortHand } from '../src/js/engine/handGenerator.js';
import { 
    isWinningHand, 
    getChiOptions, 
    getPonOptions, 
    getKanOptions,
    getClosedKanOptions
} from '../src/js/engine/shanten.js';
import { 
    decideAiInterrupt, 
    decideAiTurnAction, 
    decideAiDiscard, 
    calculateRestingStatus 
} from '../src/js/engine/aiPolicy.js';

// Mock Worker for Node.js environment since aiPolicy uses it
if (typeof global.Worker === 'undefined') {
    global.Worker = class {
        constructor() { this.onmessage = null; }
        postMessage(data) {
            // In simulation, we disable MC for speed and resolve immediately.
            if (this.onmessage) {
                this.onmessage({ data: { success: true, stats: { winRate: 0 } } });
            }
        }
        terminate() {}
    };
}

export async function runMatch(seed, profile1, profile2, swapPositions = false) {
    const seededRandom = mulberry32(seed);
    let wall = createDeck();
    
    // Shuffle
    for (let i = wall.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [wall[i], wall[j]] = [wall[j], wall[i]];
    }

    const handA = sortHand(wall.splice(0, 16));
    const handB = sortHand(wall.splice(0, 16));

    const player1 = { 
        id: swapPositions ? 'B' : 'A',
        profile: profile1,
        closed: swapPositions ? [...handB] : [...handA],
        open: [],
        river: []
    };
    const player2 = { 
        id: swapPositions ? 'A' : 'B',
        profile: profile2,
        closed: swapPositions ? [...handA] : [...handB],
        open: [],
        river: []
    };

    const state = {
        wall,
        player: player1, // We map player1 to 'player' and player2 to 'ai' for aiPolicy compatibility
        ai: player2,
        latestDiscard: null,
        isGameOver: false,
        winner: null,
        turn: 'player',
        trajectory: []
    };

    // First draw for player 1
    const firstTile = state.wall.shift();
    state.player.closed.push(firstTile);
    
    let turnCounter = 0;
    const MAX_TURNS = 1000; // Safety break

    while (!state.isGameOver && turnCounter < MAX_TURNS) {
        turnCounter++;
        const currentPlayer = state.turn === 'player' ? state.player : state.ai;
        const opponent = state.turn === 'player' ? state.ai : state.player;

        // 1. Turn Start Action (Tsumo / Ankan / Kakan)
        // We need to adapt aiPolicy to work with our simulator state
        const policyState = {
            player: opponent, // Perspective of the opponent from the current player's view
            ai: currentPlayer
        };
        
        const turnAction = decideAiTurnAction(policyState, currentPlayer.profile);
        if (turnAction) {
            if (turnAction.action === 'tsumo') {
                state.isGameOver = true;
                state.winner = currentPlayer.id;
                break;
            } else if (turnAction.action === 'ankan') {
                currentPlayer.closed = sortHand(currentPlayer.closed.filter(t => t !== turnAction.tile));
                currentPlayer.open.push({ tiles: [turnAction.tile, turnAction.tile, turnAction.tile, turnAction.tile], isClosed: true });
                const repl = state.wall.shift();
                currentPlayer.closed.push(repl);
                continue; // Re-evaluate turn start
            } else if (turnAction.action === 'kakan') {
                const meldIdx = currentPlayer.open.findIndex(m => !Array.isArray(m) ? (m.tiles[0] === turnAction.tile) : (m[0] === turnAction.tile && m.length === 3));
                if (Array.isArray(currentPlayer.open[meldIdx])) currentPlayer.open[meldIdx].push(turnAction.tile);
                else currentPlayer.open[meldIdx].tiles.push(turnAction.tile);
                currentPlayer.closed.splice(currentPlayer.closed.indexOf(turnAction.tile), 1);
                currentPlayer.closed = sortHand(currentPlayer.closed);
                const repl = state.wall.shift();
                currentPlayer.closed.push(repl);
                continue;
            }
        }

        // 2. Discard
        const { discard } = await decideAiDiscard(policyState, currentPlayer.profile, null);
        currentPlayer.closed.splice(currentPlayer.closed.indexOf(discard), 1);
        currentPlayer.river.push(discard);
        currentPlayer.closed = sortHand(currentPlayer.closed);
        state.latestDiscard = discard;

        // 3. Interrupt Check
        const interruptState = {
            player: currentPlayer,
            ai: opponent
        };
        const interrupt = decideAiInterrupt(discard, interruptState, opponent.profile);
        
        if (interrupt) {
            if (interrupt.action === 'ron') {
                state.isGameOver = true;
                state.winner = opponent.id;
                break;
            } else if (interrupt.action === 'kan') {
                opponent.closed = sortHand(opponent.closed.filter(t => t !== discard));
                opponent.open.push([discard, discard, discard, discard]);
                currentPlayer.river.pop();
                const repl = state.wall.shift();
                opponent.closed.push(repl);
                state.turn = state.turn === 'player' ? 'ai' : 'player'; // Turn shifts to opponent
                continue;
            } else if (interrupt.action === 'pon') {
                opponent.closed.splice(opponent.closed.indexOf(discard), 1);
                opponent.closed.splice(opponent.closed.indexOf(discard), 1);
                opponent.open.push([discard, discard, discard]);
                currentPlayer.river.pop();
                state.turn = state.turn === 'player' ? 'ai' : 'player';
                continue; // Opponent will discard next
            } else if (interrupt.action === 'chi') {
                opponent.closed.splice(opponent.closed.indexOf(interrupt.opt[0]), 1);
                opponent.closed.splice(opponent.closed.indexOf(interrupt.opt[1]), 1);
                opponent.open.push([interrupt.opt[0], discard, interrupt.opt[1]]);
                currentPlayer.river.pop();
                state.turn = state.turn === 'player' ? 'ai' : 'player';
                continue;
            }
        }

        // 4. Next Turn Draw
        if (state.wall.length === 0) {
            state.isGameOver = true;
            state.winner = 'DRAW';
            break;
        }

        state.turn = state.turn === 'player' ? 'ai' : 'player';
        const nextPlayer = state.turn === 'player' ? state.player : state.ai;
        const drawnTile = state.wall.shift();
        nextPlayer.closed.push(drawnTile);
    }

    return {
        winner: state.winner,
        turns: turnCounter,
        remainingWall: state.wall.length
    };
}
