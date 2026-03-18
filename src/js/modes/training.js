import { currentGameState } from '../state.js';
import { loadStats, updateStat } from '../storage.js';
import { renderTile } from '../components/Tile.js';
import { generateTrainingHand } from '../engine/handGenerator.js';
import { getDiscardAnalysis, isWinningHand } from '../engine/shanten.js';
import { TILE_NAMES } from '../constants.js';
import { showSettingsModal } from '../ui/settings.js';
import { runMonteCarlo } from './mc.js';
import { renderEditScene } from './calculator.js';
import { initApp } from '../app.js';
import { generateShareUrl } from '../utils.js';
import { renderHistoryScene } from '../ui/history.js';

let liveTimerInterval = null;
export function startTrainingSession(modeName, isCalculator = false, isMCMode = false) {
    currentGameState.mode = modeName;
    currentGameState.isCalculator = isCalculator;
    currentGameState.isMCMode = isMCMode;
    currentGameState.isEditing = false;
    
    // Clear any existing timer
    if (liveTimerInterval) {
        clearInterval(liveTimerInterval);
        liveTimerInterval = null;
    }
    
    // Only generate a new hand if we aren't returning from the editor
    if (!currentGameState.hand.length || currentGameState.hand.length !== currentGameState.selectedHandSize) {
        currentGameState.hand = generateTrainingHand(currentGameState.selectedHandSize, currentGameState.includeHonors);
    }
    
    // Check for winning hand FIRST
    if (isWinningHand(currentGameState.hand)) {
        currentGameState.isResolved = true;
        currentGameState.analysis = []; // No discards needed
    } else {
        currentGameState.analysis = getDiscardAnalysis(currentGameState.hand);
        currentGameState.isResolved = false;
        
        if (!isCalculator) {
            currentGameState.handStartTime = Date.now(); // Always track start time internally
            
            // Start live timer if enabled, regardless of whether we record it to stats
            if (currentGameState.showTimer) {
                liveTimerInterval = setInterval(() => {
                    const display = document.getElementById('live-timer-display');
                    if (display && !currentGameState.isResolved) {
                        const elapsed = (Date.now() - currentGameState.handStartTime) / 1000;
                        display.innerText = elapsed.toFixed(1);
                    }
                }, 100);
            }
        }
    }

    renderGameScene();
}

export function renderGameScene() {
    const appContainer = document.getElementById('app');
    const { hand, mode, isResolved, isCalculator, isEditing } = currentGameState;

    if (isEditing) {
        renderEditScene(appContainer);
        return;
    }

    const isWin = isWinningHand(hand);
    const isReviewing = currentGameState.reviewingHistoryIndex !== null;
    const isMC = currentGameState.isMCMode;
    const stats = loadStats();
    const history = stats.history || [];
    
    let displayTitle = mode;
    if (isReviewing) {
        displayTitle = `Record #${history.length - currentGameState.reviewingHistoryIndex}`;
    }

    const handHtml = hand.map((tile, index) => 
        renderTile(tile, { 
            size: 'sm', 
            id: `tile-${index}`,
            extraClasses: (!isCalculator && isResolved) || isWin ? 'opacity-50 cursor-default' : 'hover:-translate-y-2 cursor-pointer'
        })
    ).join('');

    appContainer.innerHTML = `
        <div class="flex flex-col items-center justify-start h-full max-w-4xl mx-auto mt-2 px-2">
            <div class="w-full flex justify-between items-center mb-3 gap-2">
                <h2 class="text-lg font-bold text-gray-800 leading-none truncate flex items-center gap-2">
                    ${displayTitle}
                </h2>
                <div class="flex gap-1.5 sm:gap-2 items-center flex-shrink-0">
                    ${(!isCalculator && currentGameState.showTimer && !isResolved) ? `
                        <div class="bg-gray-800 text-white text-xs font-black px-3 py-1.5 rounded flex items-center shadow-inner min-w-[75px] justify-center mr-1">
                            ⏱️<span id="live-timer-display" class="font-mono w-[4ch] text-right inline-block tracking-tighter">0.0</span><span class="ml-0.5">s</span>
                        </div>
                    ` : ''}
                    
                    ${isCalculator && !isMC ? `
                        <button id="header-to-mc-btn" class="bg-purple-50 text-purple-600 hover:text-purple-800 border border-purple-100 px-2 py-1.5 rounded-lg transition flex items-center gap-1 shadow-sm font-bold text-[10px] whitespace-nowrap" title="Run Monte Carlo Simulation">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            <span class="hidden sm:inline">Monte Carlo</span>
                        </button>
                    ` : ''}

                    ${isReviewing ? '' : `
                    <button id="open-settings-btn" class="text-xs font-medium ${isMC ? 'text-purple-600 hover:text-purple-800 bg-purple-50 border-purple-100' : (isCalculator ? 'text-blue-600 hover:text-blue-800 bg-blue-50 border-blue-100' : 'text-emerald-600 hover:text-emerald-800 bg-emerald-50 border-emerald-100')} flex items-center gap-1 px-2 py-1.5 rounded transition border" title="Settings">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span class="hidden sm:inline">Settings</span>
                    </button>
                    `}
                    <button id="share-btn" class="text-xs font-medium text-blue-500 hover:text-blue-700 flex items-center gap-1 transition bg-blue-50 px-2 py-1.5 rounded" title="Share Hand">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span class="hidden sm:inline">Share</span>
                    </button>
                    <button id="back-btn" class="text-xs font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1 bg-gray-100 px-2 py-1.5 rounded transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span class="hidden sm:inline">Back</span>
                    </button>
                </div>
            </div>

            <div class="bg-white p-3 md:p-5 rounded-xl shadow-lg border-t-4 ${isWin ? 'border-yellow-400' : (isMC ? 'border-purple-500' : (isCalculator ? 'border-blue-500' : 'border-mj-green'))} w-full text-center flex flex-col mb-2 transition-colors">
                
                ${isCalculator ? `
                    <div class="flex flex-wrap justify-between items-center bg-gray-50 p-2 rounded-lg mb-3 gap-2 transition-colors">
                        <p class="text-xs text-gray-500 font-medium whitespace-nowrap text-left hidden sm:block">${isReviewing ? 'Analyzing past hand:' : (isMC ? 'Click a discard to simulate:' : 'Click tile to analyze:')}</p>
                        <div class="flex gap-2 w-full sm:w-auto justify-center">
                            ${isReviewing ? '' : `
                            <button id="calc-edit-btn" class="px-2 py-1 ${isMC ? 'bg-purple-100 hover:bg-purple-200 text-purple-700' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'} text-xs font-bold rounded shadow-sm transition flex items-center gap-1">
                                Edit
                            </button>
                            <button id="calc-refresh-btn" class="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 shadow-sm transition flex items-center gap-1 text-xs font-bold">
                                Random
                            </button>
                            `}
                        </div>
                    </div>
                ` : `
                    <p class="text-xs text-gray-400 mb-3">${isWin ? 'Game Over' : (isResolved ? 'Result' : 'Choose one tile to discard:')}</p>
                `}
                
                <div class="flex flex-wrap gap-0.5 sm:gap-1 justify-center mb-4 min-h-[60px]" id="hand-container">
                    ${handHtml}
                </div>
                
                <div id="feedback-container" class="flex flex-col items-center justify-center w-full">
                    ${isWin ? `
                        <div class="animate-fade-in-up w-full flex flex-col items-center py-2">
                            <h3 class="text-3xl font-black text-yellow-500 mb-1 tracking-widest drop-shadow-sm">胡牌</h3>
                            <p class="text-xs text-gray-500 mb-4 font-medium">This is already a winning hand!</p>
                            <button id="next-btn" class="bg-mj-green text-white text-sm font-bold px-8 py-2.5 rounded-lg shadow-md hover:bg-emerald-600 transition active:scale-95">
                                Next Hand
                            </button>
                        </div>
                    ` : (isCalculator || !isResolved ? '<div class="h-10 flex items-center justify-center"><p class="text-gray-300 text-xs italic">Select a tile above.</p></div>' : '')}
                </div>
            </div>
        </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => {
        // Clear query param from url when going back
        window.history.replaceState({}, document.title, window.location.pathname);
        if (liveTimerInterval) {
            clearInterval(liveTimerInterval);
            liveTimerInterval = null;
        }
        if (currentGameState.reviewingHistoryIndex !== null) {
            renderHistoryScene();
        } else {
            initApp();
        }
    });

    const settingsBtn = document.getElementById('open-settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            showSettingsModal(currentGameState.mode, currentGameState.isCalculator, true, currentGameState.isMCMode);
        });
    }

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const url = generateShareUrl(currentGameState.hand);
            navigator.clipboard.writeText(url).then(() => {
                const originalHtml = shareBtn.innerHTML;
                shareBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                `;
                shareBtn.classList.remove('text-blue-500');
                shareBtn.classList.add('text-mj-green');
                setTimeout(() => {
                    shareBtn.innerHTML = originalHtml;
                    shareBtn.classList.add('text-blue-500');
                    shareBtn.classList.remove('text-mj-green');
                }, 2000);
            });
        });
    }

    if (isWin && document.getElementById('next-btn')) {
        document.getElementById('next-btn').addEventListener('click', () => {
            currentGameState.hand = []; // Force new hand gen
            startTrainingSession(currentGameState.mode, isCalculator);
        });
    }

    if (isCalculator) {
        const refreshBtn = document.getElementById('calc-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                currentGameState.hand = []; // Force new hand gen
                currentGameState.mcCache = {}; // clear cache for safety
                // Restart with the exact current mode we are already in
                startTrainingSession(currentGameState.mode, true, currentGameState.isMCMode);
            });
        }
        
        const editBtn = document.getElementById('calc-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                currentGameState.isEditing = true;
                renderGameScene();
            });
        }
        
        const toMCBtn = document.getElementById('calc-to-mc-btn');
        if (toMCBtn) {
            toMCBtn.addEventListener('click', () => {
                // Ensure MC default settings are set
                currentGameState.includeHonors = true;
                currentGameState.enableMC = true;
                currentGameState.mcDraws = 5;
                currentGameState.mcRuns = 1000;
                currentGameState.reviewingHistoryIndex = null; // Exit review context
                startTrainingSession('蒙地卡羅演算法', true, true);
            });
        }
        
        const headerToMCBtn = document.getElementById('header-to-mc-btn');
        if (headerToMCBtn) {
            headerToMCBtn.addEventListener('click', () => {
                // Ensure MC default settings are set
                currentGameState.includeHonors = true;
                currentGameState.enableMC = true;
                currentGameState.mcDraws = 5;
                currentGameState.mcRuns = 1000;
                currentGameState.reviewingHistoryIndex = null; // Exit review context
                startTrainingSession('蒙地卡羅演算法', true, true);
            });
        }
    }

    if (!isWin && (isCalculator || !isResolved)) {
        hand.forEach((tile, index) => {
            document.getElementById(`tile-${index}`).addEventListener('click', () => {
                handleDiscard(tile, index);
            });
        });
    }
}

let currentOptimalIndex = 0; // Track which optimal move we are viewing

export function handleDiscard(tile, index) {
    if (currentGameState.isMCRunning) return; // Prevent clicking while simulation is running
    if (!currentGameState.isCalculator && currentGameState.isResolved) return;

    // Stop live timer
    if (liveTimerInterval) {
        clearInterval(liveTimerInterval);
        liveTimerInterval = null;
    }

    const { analysis, isCalculator } = currentGameState;
    
    // Find all optimal moves (lowest shanten, then highest acceptance)
    const bestShanten = analysis[0].shanten;
    const bestAcceptance = analysis[0].acceptance;
    const allOptimalMoves = analysis.filter(a => a.shanten === bestShanten && a.acceptance === bestAcceptance);
    
    // reset index
    currentOptimalIndex = 0;
    
    const userMove = analysis.find(a => a.discard === tile);
    const isCorrect = userMove.acceptance === bestAcceptance && userMove.shanten === bestShanten;

    if (!isCalculator) {
        currentGameState.isResolved = true;
        
        // Time Tracking Logic
        let timeTakenMs = 0;
        if (currentGameState.recordTime && currentGameState.handStartTime > 0) {
            timeTakenMs = Date.now() - currentGameState.handStartTime;
            updateStat('totalTimeMs', prev => prev + timeTakenMs);
            updateStat('timedDecisions', prev => prev + 1);
        }

        // Update Stats
        updateStat('totalDecisions', prev => prev + 1);
        if (isCorrect) {
            updateStat('correctDecisions', prev => prev + 1);
            updateStat('currentStreak', prev => prev + 1);
        } else {
            updateStat('currentStreak', 0);
        }
        
        // Add to history
        import('../storage.js').then(module => {
             module.addHistoryRecord({
                 hand: currentGameState.hand,
                 userDiscard: tile,
                 isCorrect: isCorrect,
                 timeMs: timeTakenMs,
                 timestamp: Date.now()
             });
        });
    }

    renderFeedbackState(userMove, allOptimalMoves, isCorrect, isCalculator, tile, index);
}



export function renderFeedbackState(userMove, allOptimalMoves, isCorrect, isCalculator, tile, index) {
    // Acceptance Tiles HTML
    const acceptanceHtml = userMove.acceptedTiles.map(item => `
        <div class="flex flex-col items-center gap-1">
            ${renderTile(item.tile, { size: 'xs', extraClasses: 'hover:translate-y-0 cursor-default' })}
            <span class="text-[10px] font-bold text-gray-400">${item.count}</span>
        </div>
    `).join('');

    // Slider HTML
    const otherOptimalMoves = isCorrect ? allOptimalMoves.filter(m => m.discard !== tile) : [];
    const showOtherSlider = isCorrect && !isCalculator && otherOptimalMoves.length > 0;
    
    // For Correct moves, we show the slider of *other* optimal moves. For Incorrect, we show all optimal.
    const displayMoves = showOtherSlider ? otherOptimalMoves : allOptimalMoves;
    const bestMove = displayMoves.length > 0 ? displayMoves[currentOptimalIndex] : allOptimalMoves[0];

    const bestAcceptanceHtml = (showOtherSlider || !isCorrect) && !isCalculator ? bestMove.acceptedTiles.map(item => `
        <div class="flex flex-col items-center gap-1">
            ${renderTile(item.tile, { size: 'xs', extraClasses: 'hover:translate-y-0 cursor-default' })}
            <span class="text-[10px] font-bold text-gray-400">${item.count}</span>
        </div>
    `).join('') : '';

    const sliderHtml = ((showOtherSlider || !isCorrect) && !isCalculator && displayMoves.length > 1) ? `
        <div class="flex justify-between items-center w-full px-1 mb-2">
            <button id="optimal-prev-btn" class="text-emerald-500 hover:bg-emerald-100 p-2 rounded-full transition ${currentOptimalIndex === 0 ? 'invisible' : ''}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div class="flex flex-col items-center">
                <span class="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter mb-1">${isCorrect ? 'Other Best Option' : 'Best Option'} ${currentOptimalIndex + 1}/${displayMoves.length}</span>
                <div class="flex items-center gap-2">
                    ${renderTile(bestMove.discard, { size: 'xs', extraClasses: 'shadow-sm' })}
                    <p class="text-lg font-black text-gray-800 leading-none">${TILE_NAMES[bestMove.discard]}</p>
                </div>
            </div>
            <button id="optimal-next-btn" class="text-emerald-500 hover:bg-emerald-100 p-2 rounded-full transition ${currentOptimalIndex === displayMoves.length - 1 ? 'invisible' : ''}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
    ` : ((showOtherSlider || !isCorrect) && !isCalculator ? `
        <div class="flex flex-col items-center mb-2">
            <span class="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter mb-1 text-center">${isCorrect ? 'Other Best Discard' : 'Best Discard'}</span>
            <div class="flex items-center gap-2">
                ${renderTile(bestMove.discard, { size: 'xs', extraClasses: 'shadow-sm' })}
                <p class="text-lg font-black text-gray-800 leading-none">${TILE_NAMES[bestMove.discard]}</p>
            </div>
        </div>
    ` : '');

    // Render Feedback
    const feedbackContainer = document.getElementById('feedback-container');
    
    if (isCalculator) {
        // Calculator Feedback
        const isOptimal = userMove.acceptance === bestMove.acceptance && userMove.shanten === bestMove.shanten;
        
        feedbackContainer.innerHTML = `
            <div class="animate-fade-in-up w-full">
                <div class="flex flex-col items-center justify-center gap-2 mb-2">
                    <div class="flex items-center gap-2">
                        <p class="text-gray-600 text-sm">
                            Discard <span class="font-bold text-gray-800 text-base">${TILE_NAMES[tile]}</span>
                        </p>
                        ${isOptimal ? '<span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Best Choice</span>' : ''}
                    </div>
                    
                    <div class="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 shadow-inner w-full justify-center">
                        <div class="text-center min-w-[60px]">
                            <p class="text-[10px] text-gray-500 font-bold mb-0.5">狀態</p>
                            <p class="text-xl font-black tracking-tight ${userMove.shanten === 0 ? 'text-mj-red' : 'text-blue-600'}">
                                ${userMove.shanten === 0 ? '叫糊' : `${userMove.shanten}<span class="text-xs font-bold ml-0.5 text-gray-600">向聽</span>`}
                            </p>
                        </div>
                        <div class="w-px h-8 bg-gray-300 rounded"></div>
                        <div class="text-center min-w-[60px]">
                            <p class="text-[10px] text-gray-500 font-bold mb-0.5">進張</p>
                            <p class="text-xl font-black text-blue-500 tracking-tight">
                                ${userMove.acceptedTiles.length}<span class="text-xs font-bold text-gray-400 mx-0.5">款</span>${userMove.acceptance}<span class="text-xs font-bold text-gray-400 mx-0.5">張</span>
                            </p>
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1 justify-center bg-white p-2 rounded-lg">
                    ${acceptanceHtml || '<p class="text-xs text-gray-400">No tiles improve this hand</p>'}
                </div>
                
                ${currentGameState.enableMC ? `
                    <div id="mc-results-container" class="mt-4 pt-4 border-t border-gray-100 flex flex-col items-center w-full min-h-[100px]">
                        <div class="flex flex-col items-center gap-2 w-full max-w-[200px] mb-2">
                            <div class="flex items-center gap-2 text-gray-500">
                                <svg class="animate-spin h-4 w-4 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span id="mc-progress-text" class="text-xs font-bold uppercase tracking-wider">Running Monte Carlo... 0%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                                <div id="mc-progress-bar" class="bg-purple-500 h-1.5 rounded-full transition-all duration-150 ease-out" style="width: 0%"></div>
                            </div>
                        </div>
                        <p class="text-[10px] text-gray-400">Simulating ${currentGameState.mcRuns} runs of ${currentGameState.mcDraws} draws</p>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Highlight active tile in Calculator
        document.querySelectorAll('.tile-container').forEach(el => el.classList.remove('scale-110', 'brightness-110', 'translate-y-[-8px]', 'z-10'));
        document.getElementById(`tile-${index}`).classList.add('scale-110', 'brightness-110', 'translate-y-[-8px]', 'z-10');

        if (currentGameState.enableMC) {
            runMonteCarlo(currentGameState.hand, tile, currentGameState.mcRuns, currentGameState.mcDraws, currentGameState.includeHonors);
        }

    } else {
        // Training Feedback
        feedbackContainer.innerHTML = `
            <div class="animate-fade-in-up w-full">
                <h3 class="text-xl font-black ${isCorrect ? 'text-mj-green' : 'text-mj-red'} mb-1 text-center leading-none">
                    ${isCorrect ? 'Correct!' : 'Not Optimal'}
                </h3>
                
                <div class="flex flex-col gap-2 items-center">
                    <p class="text-gray-500 text-xs">
                        Discard <span class="font-bold text-gray-800">${TILE_NAMES[tile]}</span>
                    </p>

                    <div class="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 shadow-inner w-full justify-center">
                        <div class="text-center min-w-[60px]">
                            <p class="text-[10px] text-gray-500 font-bold mb-0.5">狀態</p>
                            <p class="text-xl font-black tracking-tight ${userMove.shanten === 0 ? 'text-mj-red' : 'text-blue-600'}">
                                ${userMove.shanten === 0 ? '叫糊' : `${userMove.shanten}<span class="text-xs font-bold ml-0.5 text-gray-600">向聽</span>`}
                            </p>
                        </div>
                        <div class="w-px h-8 bg-gray-300 rounded"></div>
                        <div class="text-center min-w-[60px]">
                            <p class="text-[10px] text-gray-500 font-bold mb-0.5">進張</p>
                            <p class="text-xl font-black text-blue-500 tracking-tight">
                                ${userMove.acceptedTiles.length}<span class="text-xs font-bold text-gray-400 mx-0.5">款</span>${userMove.acceptance}<span class="text-xs font-bold text-gray-400 mx-0.5">張</span>
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-1 justify-center bg-white p-1 rounded-lg w-full mb-1">
                        ${acceptanceHtml || '<p class="text-xs text-gray-400">No tiles improve this hand</p>'}
                    </div>

                    ${showOtherSlider ? `
                        <div class="w-full pt-2 border-t border-gray-100 flex flex-col items-center">
                            ${sliderHtml}
                            <div class="flex flex-wrap gap-1 justify-center bg-white p-1 rounded-lg border border-emerald-50 w-full">
                                ${bestAcceptanceHtml}
                            </div>
                        </div>
                    ` : ''}

                    ${!isCorrect ? `
                        <div class="w-full pt-2 border-t border-gray-100 flex flex-col items-center">
                            ${sliderHtml}
                            
                            <div class="flex items-center gap-4 bg-emerald-50/50 px-4 py-2 rounded-lg border border-emerald-100 w-full justify-center mb-1">
                                <div class="text-center min-w-[60px]">
                                    <p class="text-[10px] text-emerald-600 font-bold mb-0.5">狀態</p>
                                    <p class="text-xl font-black tracking-tight ${bestMove.shanten === 0 ? 'text-mj-red' : 'text-emerald-700'}">
                                        ${bestMove.shanten === 0 ? '叫糊' : `${bestMove.shanten}<span class="text-xs font-bold ml-0.5 text-emerald-600">向聽</span>`}
                                    </p>
                                </div>
                                <div class="w-px h-8 bg-emerald-200 rounded"></div>
                                <div class="text-center min-w-[60px]">
                                    <p class="text-[10px] text-emerald-600 font-bold mb-0.5">進張</p>
                                    <p class="text-xl font-black text-emerald-600 tracking-tight">
                                        ${bestMove.acceptedTiles.length}<span class="text-xs font-bold text-emerald-400 mx-0.5">款</span>${bestMove.acceptance}<span class="text-xs font-bold text-emerald-400 mx-0.5">張</span>
                                    </p>
                                </div>
                            </div>

                            <div class="flex flex-wrap gap-1 justify-center bg-white p-1 rounded-lg border border-emerald-50 w-full">
                                ${bestAcceptanceHtml}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <button id="next-btn" class="bg-mj-green text-white text-sm font-bold px-8 py-2.5 rounded-lg shadow-md hover:bg-emerald-600 transition active:scale-95 w-full mt-3">
                    Next Hand
                </button>
            </div>
        `;

        // Wire up optimal slider buttons
        if (showOtherSlider || (!isCorrect && allOptimalMoves.length > 1)) {
            const prevBtn = document.getElementById('optimal-prev-btn');
            const nextBtn = document.getElementById('optimal-next-btn');
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (currentOptimalIndex > 0) {
                        currentOptimalIndex--;
                        renderFeedbackState(userMove, allOptimalMoves, isCorrect, isCalculator, tile, index);
                    }
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    if (currentOptimalIndex < displayMoves.length - 1) {
                        currentOptimalIndex++;
                        renderFeedbackState(userMove, allOptimalMoves, isCorrect, isCalculator, tile, index);
                    }
                });
            }
        }

        document.getElementById('next-btn').addEventListener('click', () => {
            currentGameState.hand = []; // Clear hand to force generation of a new one
            startTrainingSession(currentGameState.mode, false);
        });

        // Highlight the selected tile in Training
        document.getElementById(`tile-${index}`).classList.remove('opacity-50');
        document.getElementById(`tile-${index}`).classList.add('ring-4', isCorrect ? 'ring-mj-green' : 'ring-mj-red', 'translate-y-[-8px]', 'z-10');
    }
}

