// state.js
// Centralized state management for the application

export const currentGameState = {
    mode: null,
    hand: [],
    analysis: [],
    isResolved: false,
    selectedHandSize: 8,
    isCalculator: false,
    isMCMode: false,
    isEditing: false,
    includeHonors: false,
    recordTime: false,
    showTimer: false,
    handStartTime: 0,
    reviewingHistoryIndex: null,
    enableMC: false,
    mcDraws: 5,
    mcRuns: 1000,
    mcPolicy: 'greedy', // 'greedy' (最大機率) or 'random' (隨機)
    isMCRunning: false,
    mcCache: {},
    aiDifficulty: 'expert', // 'expert', 'beginner', 'random'
    aiStyle: 'balanced',   // 'balanced', 'defensive'
    showAiTenpai: false,
    aiSpeedMode: false
};

// --- AI對戰練習 Mode State ---
export const vsGameState = {
    wall: [],
    player: { closed: [], open: [], river: [] },
    ai: { closed: [], open: [], river: [] },
    currentTurn: 'player',
    pendingAction: null, // { type: 'chi'|'pon'|'kan'|'ron', options: [] }
    trajectory: [],
    isGameOver: false,
    winner: null,
    showAiHand: false,
    latestDiscard: null, // { owner: 'player'|'ai', index: number }
    historyStack: [],
    currentSeed: null,
    aiActionMessage: null, // For temporary action bubbles
    forbiddenDiscard: null, // Tile that cannot be discarded this turn (Kuikae rule)
    aiLastStatus: null, // { shanten: number, acceptance: number } - Tracks state before AI draws/calls
    
    // Replay Mode State
    isReplaying: false,
    replayStep: 0,
    fullTrajectory: []
};
