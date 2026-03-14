// app.js
// Main entry point for the Taiwan Mahjong Trainer application

import { loadStats, updateStat, getAccuracy, clearStats, getAverageTime } from './storage.js';
import { renderTile } from './components/Tile.js';
import { generateTrainingHand, sortHand } from './engine/handGenerator.js';
import { getDiscardAnalysis, isWinningHand } from './engine/shanten.js';
import { TILE_NAMES, TILE_MAP } from './constants.js';
let currentGameState = {
    mode: null,
    hand: [],
    analysis: [],
    isResolved: false,
    selectedHandSize: 8,
    isCalculator: false,
    isEditing: false,
    includeHonors: false,
    recordTime: false,
    showTimer: false,
    handStartTime: 0,
    reviewingHistoryIndex: null
};

let liveTimerInterval = null;

// --- URL Sharing Helper ---
function parseHandFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const handStr = params.get('hand');
    if (!handStr) return null;
    
    // Parse format like "123m456p789s11z"
    let parsedHand = [];
    let currentNumbers = [];
    for (let char of handStr) {
        if (['m', 'p', 's', 'z'].includes(char)) {
            currentNumbers.forEach(num => {
                // Ensure valid tile
                if ((char === 'z' && num >= 1 && num <= 7) || (char !== 'z' && num >= 1 && num <= 9)) {
                    parsedHand.push(`${num}${char}`);
                }
            });
            currentNumbers = [];
        } else if (!isNaN(parseInt(char))) {
            currentNumbers.push(char);
        }
    }
    
    // Validate length
    if ([5, 8, 11, 14, 17].includes(parsedHand.length)) {
        return sortHand(parsedHand);
    }
    return null;
}

function generateShareUrl(handArray) {
    // Group by suit
    const grouped = { m: [], p: [], s: [], z: [] };
    handArray.forEach(tile => grouped[tile[1]].push(tile[0]));
    
    let resultStr = "";
    for (let suit of ['m', 'p', 's', 'z']) {
        if (grouped[suit].length > 0) {
            grouped[suit].sort((a, b) => a - b);
            resultStr += grouped[suit].join('') + suit;
        }
    }
    
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?hand=${resultStr}`;
}

// --- Dynamic Stat Colors ---
function getAccuracyColor(accuracyStr) {
    if (accuracyStr === '-') return 'text-gray-400';
    const val = parseFloat(accuracyStr);
    if (isNaN(val)) return 'text-gray-400';
    if (val < 50) return 'text-red-500';
    if (val < 75) return 'text-blue-500';
    if (val < 90) return 'text-mj-green';
    return 'text-yellow-500 drop-shadow-sm';
}

function getStreakColor(streak) {
    if (streak === 0 || streak === '-') return 'text-gray-400';
    if (streak < 3) return 'text-gray-600';
    if (streak < 6) return 'text-blue-500';
    if (streak < 10) return 'text-emerald-500';
    return 'text-yellow-500 drop-shadow-sm';
}

let globalListenersBound = false;

document.addEventListener('DOMContentLoaded', () => {
    // Check if we loaded from a shared link
    const sharedHand = parseHandFromUrl();
    if (sharedHand) {
        currentGameState.hand = sharedHand;
        currentGameState.selectedHandSize = sharedHand.length;
        startTrainingSession('進張計算機', true); // Open shared hands in Calculator mode
        // Clean up URL so refresh doesn't keep reloading it
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        initApp();
    }

    if (!globalListenersBound) {
        // Initialize Global Nav Menu
        const menuBtn = document.getElementById('global-menu-btn');
        const menuDropdown = document.getElementById('global-menu-dropdown');
        const resetBtn = document.getElementById('reset-stats-btn');
        const historyBtn = document.getElementById('view-history-btn');

        if (menuBtn && menuDropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.toggle('hidden');
                setTimeout(() => {
                    menuDropdown.classList.toggle('scale-95');
                    menuDropdown.classList.toggle('opacity-0');
                }, 10);
            });

            document.addEventListener('click', (e) => {
                if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
                    menuDropdown.classList.add('scale-95', 'opacity-0');
                    setTimeout(() => menuDropdown.classList.add('hidden'), 200);
                }
            });
        }

        if (historyBtn) {
            historyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.add('scale-95', 'opacity-0');
                setTimeout(() => menuDropdown.classList.add('hidden'), 200);
                renderHistoryScene();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to reset all your statistics and streaks?')) {
                    clearStats();
                    menuDropdown.classList.add('scale-95', 'opacity-0');
                    setTimeout(() => menuDropdown.classList.add('hidden'), 200);
                    // If on main dashboard, force a re-render
                    if (currentGameState.mode === null || currentGameState.mode === 'History') {
                        initApp(); 
                    }
                }
            });
        }
        globalListenersBound = true;
    }
});

function initApp() {
    currentGameState.isResolved = false;
    currentGameState.isEditing = false;
    const appContainer = document.getElementById('app');
    
    const stats = loadStats();
    const accuracy = getAccuracy();
    const streakDisplay = stats.totalDecisions === 0 ? '-' : stats.maxStreak;
    const currentStreakDisplay = stats.totalDecisions === 0 ? '-' : stats.currentStreak;
    const testsDoneDisplay = stats.totalDecisions === 0 ? '-' : stats.totalDecisions;

    // Render the initial dashboard view
    appContainer.innerHTML = `
        <div class="max-w-lg mx-auto mt-8 flex flex-col gap-6 px-2">
            <!-- Stats Overview Card -->
            <div class="bg-white rounded-xl shadow-md p-6 flex flex-col items-center relative transition-colors">

                <div class="flex items-center gap-2 mb-2">
                    <h2 class="text-2xl font-bold text-gray-800 text-center">Taiwan Mahjong Trainer</h2>
                    <span class="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">v1.1.6</span>
                </div>
                <p class="text-gray-500 mb-6 text-center text-sm">Improve your discard efficiency and tile recognition.</p>
                
                <div class="grid grid-cols-2 gap-3 w-full">
                    <div class="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-100 transition-colors flex flex-col items-center justify-center">
                        <div class="flex items-center gap-1 mb-1">
                            <span class="text-base sm:text-lg">🎯</span>
                            <p class="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-wider">Accuracy</p>
                        </div>
                        <p class="text-2xl sm:text-3xl font-black ${getAccuracyColor(accuracy)}" id="dash-accuracy">${accuracy}</p>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-100 transition-colors flex flex-col items-center justify-center">
                        <div class="flex items-center gap-1 mb-1">
                            <span class="text-base sm:text-lg">📝</span>
                            <p class="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-wider whitespace-nowrap">Tests Done</p>
                        </div>
                        <p class="text-2xl sm:text-3xl font-black text-gray-700" id="dash-tests-done">${testsDoneDisplay}</p>
                    </div>

                    <div class="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-100 transition-colors flex flex-col items-center justify-center">
                        <div class="flex items-center gap-1 mb-1">
                            <span class="text-base sm:text-lg">⚡</span>
                            <p class="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-wider whitespace-nowrap">Current Streak</p>
                        </div>
                        <p class="text-2xl sm:text-3xl font-black ${getStreakColor(currentStreakDisplay)}" id="dash-current-streak">${currentStreakDisplay}</p>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-100 transition-colors flex flex-col items-center justify-center">
                        <div class="flex items-center gap-1 mb-1">
                            <span class="text-base sm:text-lg">🔥</span>
                            <p class="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-wider whitespace-nowrap">Max Streak</p>
                        </div>
                        <p class="text-2xl sm:text-3xl font-black ${getStreakColor(streakDisplay)}" id="dash-max-streak">${streakDisplay}</p>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-100 transition-colors flex flex-col items-center justify-center col-span-2">
                        <div class="flex items-center gap-1 mb-1">
                            <span class="text-base sm:text-lg">⏱️</span>
                            <p class="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-wider whitespace-nowrap">Average Time</p>
                        </div>
                        <p class="text-2xl sm:text-3xl font-black text-gray-700" id="dash-avg-time">${getAverageTime()}</p>
                    </div>
                </div>
            </div>

            <!-- Game Modes Section -->
            <div class="flex flex-col gap-3">
                <h3 class="text-lg font-bold text-gray-700 px-1">Select Mode</h3>
                
                <div id="btn-trainer" class="bg-white p-5 rounded-xl shadow-md border border-gray-200 flex items-center justify-between cursor-pointer hover:border-mj-green hover:shadow-lg transition group">
                    <div class="text-left">
                        <p class="font-bold text-gray-800 text-lg">最大機率打法練習</p>
                        <p class="text-xs text-gray-500 mt-1">Train your discard efficiency.</p>
                    </div>
                    <div class="bg-emerald-50 group-hover:bg-mj-green p-3 rounded-xl transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-mj-green group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                </div>

                <div id="btn-calc" class="bg-white p-5 rounded-xl shadow-md border border-gray-200 flex items-center justify-between cursor-pointer hover:border-blue-500 hover:shadow-lg transition group">
                    <div class="text-left">
                        <p class="font-bold text-gray-800 text-lg">進張計算機</p>
                        <p class="text-xs text-gray-500 mt-1">Sandbox calculator & analyzer.</p>
                    </div>
                    <div class="bg-blue-50 group-hover:bg-blue-500 p-3 rounded-xl transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove old reset button and dark mode logic from here as it is either global or removed
    document.getElementById('btn-trainer').addEventListener('click', () => {
        showSettingsModal('最大機率打法', false, false);
    });

    document.getElementById('btn-calc').addEventListener('click', () => {
        showSettingsModal('進張計算機', true, false);
    });
}

function showSettingsModal(modeName, isCalculator, isUpdate) {
    let modalEl = document.getElementById('settings-modal-root');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'settings-modal-root';
        document.body.appendChild(modalEl);
    }

    let tempSize = currentGameState.selectedHandSize;
    let tempHonors = currentGameState.includeHonors;
    let tempRecordTime = currentGameState.recordTime;

    // Build the outer modal structure ONCE
    modalEl.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up transition-colors">
                <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 class="font-bold text-gray-800 dark:text-white">${isUpdate ? 'Settings' : 'Setup ' + modeName}</h3>
                    <button id="close-settings" class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-1 transition">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div class="p-5 flex flex-col gap-5">
                    <div>
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Hand Size</p>
                        <div class="flex gap-2" id="modal-size-container">
                            <!-- Size buttons rendered here -->
                        </div>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tile Pool</p>
                        <div id="modal-honors-toggle-wrapper" class="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer select-none">
                            <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">Include Winds & Dragons (字牌)</span>
                            <div class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tempHonors ? 'bg-mj-green' : 'bg-gray-200 dark:bg-gray-600'}">
                                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tempHonors ? 'translate-x-6' : 'translate-x-1'}"></span>
                            </div>
                        </div>
                    </div>
                    ${!isCalculator ? `
                    <div>
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Time</p>
                        <div class="flex flex-col gap-2">
                            <div id="modal-time-toggle-wrapper" class="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer select-none">
                                <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">Record Time Taken</span>
                                <div class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tempRecordTime ? 'bg-mj-green' : 'bg-gray-200 dark:bg-gray-600'}">
                                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tempRecordTime ? 'translate-x-6' : 'translate-x-1'}"></span>
                                </div>
                            </div>
                            <div id="modal-show-timer-toggle-wrapper" class="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer select-none">
                                <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">Display Live Timer</span>
                                <div class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${currentGameState.showTimer ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}">
                                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentGameState.showTimer ? 'translate-x-6' : 'translate-x-1'}"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                    <button id="apply-settings" class="${isCalculator ? 'bg-blue-500 hover:bg-blue-600' : 'bg-mj-green hover:bg-emerald-600'} text-white font-bold px-6 py-3 rounded-xl shadow-md transition active:scale-95 w-full">
                        ${isUpdate ? 'Apply & Restart Hand' : 'Start'}
                    </button>
                </div>
            </div>
        </div>
    `;

    const updateSizeButtons = () => {
        const container = document.getElementById('modal-size-container');
        if (!container) return;
        container.innerHTML = [5, 8, 11, 14, 17].map(s => `
            <button class="modal-size-btn flex-1 py-2 rounded-xl text-sm font-bold transition ${tempSize === s ? (isCalculator ? 'bg-blue-500' : 'bg-mj-green') + ' text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}" data-size="${s}">
                ${s}
            </button>
        `).join('');

        // Re-bind click events for the new buttons
        document.querySelectorAll('.modal-size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                tempSize = parseInt(e.currentTarget.dataset.size);
                updateSizeButtons(); // Only update the buttons, not the whole modal
            });
        });
    };

    // Initial render of buttons
    updateSizeButtons();

    const updateHonorsToggleUI = () => {
        const toggleWrapper = document.getElementById('modal-honors-toggle-wrapper');
        if (!toggleWrapper) return;
        
        const track = toggleWrapper.querySelector('.transition-colors');
        const knob = toggleWrapper.querySelector('.transition-transform');
        
        if (tempHonors) {
            track.classList.remove('bg-gray-200', 'dark:bg-gray-600');
            track.classList.add('bg-mj-green');
            knob.classList.remove('translate-x-1');
            knob.classList.add('translate-x-6');
        } else {
            track.classList.remove('bg-mj-green');
            track.classList.add('bg-gray-200', 'dark:bg-gray-600');
            knob.classList.remove('translate-x-6');
            knob.classList.add('translate-x-1');
        }
    };
    
    const updateTimeToggleUI = () => {
        const toggleWrapper = document.getElementById('modal-time-toggle-wrapper');
        if (!toggleWrapper) return;

        const track = toggleWrapper.querySelector('.transition-colors');
        const knob = toggleWrapper.querySelector('.transition-transform');

        if (tempRecordTime) {
            track.classList.remove('bg-gray-200', 'dark:bg-gray-600');
            track.classList.add('bg-mj-green');
            knob.classList.remove('translate-x-1');
            knob.classList.add('translate-x-6');
        } else {
            track.classList.remove('bg-mj-green');
            track.classList.add('bg-gray-200', 'dark:bg-gray-600');
            knob.classList.remove('translate-x-6');
            knob.classList.add('translate-x-1');
        }
    };
    const updateShowTimerToggleUI = () => {
        const toggleWrapper = document.getElementById('modal-show-timer-toggle-wrapper');
        if (!toggleWrapper) return;
        
        const track = toggleWrapper.querySelector('.transition-colors');
        const knob = toggleWrapper.querySelector('.transition-transform');
        
        if (currentGameState.showTimer) {
            track.classList.remove('bg-gray-200', 'dark:bg-gray-600');
            track.classList.add('bg-blue-500');
            knob.classList.remove('translate-x-1');
            knob.classList.add('translate-x-6');
        } else {
            track.classList.remove('bg-blue-500');
            track.classList.add('bg-gray-200', 'dark:bg-gray-600');
            knob.classList.remove('translate-x-6');
            knob.classList.add('translate-x-1');
        }
    };

    document.getElementById('close-settings').addEventListener('click', () => {
        modalEl.innerHTML = '';
    });

    const honorsWrapper = document.getElementById('modal-honors-toggle-wrapper');
    if (honorsWrapper) {
        honorsWrapper.addEventListener('click', () => {
            tempHonors = !tempHonors;
            updateHonorsToggleUI();
        });
    }

    const timeWrapper = document.getElementById('modal-time-toggle-wrapper');
    if (timeWrapper) {
        timeWrapper.addEventListener('click', () => {
            tempRecordTime = !tempRecordTime;
            updateTimeToggleUI();
        });
    }

    const showTimerWrapper = document.getElementById('modal-show-timer-toggle-wrapper');
    if (showTimerWrapper) {
        showTimerWrapper.addEventListener('click', () => {
            currentGameState.showTimer = !currentGameState.showTimer;
            updateShowTimerToggleUI();
        });
    }

    document.getElementById('apply-settings').addEventListener('click', () => {
        currentGameState.selectedHandSize = tempSize;
        currentGameState.includeHonors = tempHonors;
        currentGameState.recordTime = tempRecordTime;
        modalEl.innerHTML = '';
        
        if (isUpdate) {
            currentGameState.hand = [];
        }
        
        startTrainingSession(modeName, isCalculator);
    });
}

function startTrainingSession(modeName, isCalculator = false) {
    currentGameState.mode = modeName;
    currentGameState.isCalculator = isCalculator;
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

function renderGameScene() {
    const appContainer = document.getElementById('app');
    const { hand, mode, isResolved, isCalculator, isEditing } = currentGameState;

    if (isEditing) {
        renderEditScene(appContainer);
        return;
    }

    const isWin = isWinningHand(hand);
    const isReviewing = currentGameState.reviewingHistoryIndex !== null;
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
            <div class="w-full flex justify-between items-center mb-3">
                <h2 class="text-lg font-bold text-gray-800 leading-none truncate">${displayTitle}</h2>
                <div class="flex gap-2 sm:gap-3 items-center">
                    ${(!isCalculator && currentGameState.showTimer && !isResolved) ? `
                        <div class="bg-gray-800 text-white text-xs font-black px-3 py-1.5 rounded flex items-center shadow-inner min-w-[75px] justify-center">
                            ⏱️<span id="live-timer-display" class="font-mono w-[4ch] text-right inline-block tracking-tighter">0.0</span><span class="ml-0.5">s</span>
                        </div>
                    ` : ''}
                    ${isReviewing ? '' : `
                    <button id="open-settings-btn" class="text-xs font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2 py-1.5 rounded transition border border-emerald-100" title="Settings">
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

            <div class="bg-white p-3 md:p-5 rounded-xl shadow-lg border-t-4 ${isWin ? 'border-yellow-400' : (isCalculator ? 'border-blue-500' : 'border-mj-green')} w-full text-center flex flex-col mb-2 transition-colors">
                
                ${isCalculator ? `
                    <div class="flex flex-wrap justify-between items-center bg-gray-50 p-2 rounded-lg mb-3 gap-2 transition-colors">
                        <p class="text-xs text-gray-500 font-medium whitespace-nowrap text-left hidden sm:block">${isReviewing ? 'Analyzing past hand:' : 'Click tile to analyze:'}</p>
                        <div class="flex gap-2 w-full sm:w-auto justify-center">
                            ${isReviewing ? '' : `
                            <button id="calc-edit-btn" class="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold rounded shadow-sm transition flex items-center gap-1">
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
            showSettingsModal(currentGameState.mode, currentGameState.isCalculator, true);
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
                startTrainingSession('進張計算機', true);
            });
        }
        
        const editBtn = document.getElementById('calc-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                currentGameState.isEditing = true;
                renderGameScene();
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

function renderEditScene(appContainer) {
    const { hand } = currentGameState;

    // Render current hand (clickable to remove)
    const handHtml = hand.map((tile, index) => 
        renderTile(tile, { 
            size: 'sm', 
            id: `edit-tile-${index}`,
            extraClasses: 'hover:opacity-50 cursor-pointer transition'
        })
    ).join('');

    // Render Tile Keyboard
    const renderSuitRow = (suitArray) => suitArray.map(tile => 
        renderTile(tile, {
            size: 'xs',
            id: `key-${tile}`,
            extraClasses: 'hover:-translate-y-1 cursor-pointer transition'
        })
    ).join('');

    appContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full max-w-4xl mx-auto mt-4 px-2">
            <div class="bg-white p-4 md:p-6 rounded-2xl shadow-lg border-t-8 border-blue-500 w-full text-center relative">
                <h3 class="text-lg font-bold text-gray-800 mb-1">Edit Hand</h3>
                <p class="text-xs text-gray-500 mb-4">Click tiles below to add. Click hand tiles to remove.</p>
                
                <!-- Current Hand -->
                <div class="flex flex-wrap gap-1 justify-center min-h-[60px] pb-4 mb-4 border-b border-gray-100" id="edit-hand-container">
                    ${handHtml || '<p class="text-sm text-gray-300 italic my-auto">Hand is empty</p>'}
                </div>
                
                <p class="text-sm font-bold ${hand.length > 17 ? 'text-mj-red' : 'text-blue-500'} mb-4">${hand.length} / 17 Tiles</p>
                
                <!-- Keyboard -->
                <div class="flex flex-col gap-2 max-w-lg mx-auto bg-gray-50 p-4 rounded-xl">
                    <div class="flex justify-center gap-1">${renderSuitRow(TILE_MAP.m)}</div>
                    <div class="flex justify-center gap-1">${renderSuitRow(TILE_MAP.p)}</div>
                    <div class="flex justify-center gap-1">${renderSuitRow(TILE_MAP.s)}</div>
                    <div class="flex justify-center gap-1">${renderSuitRow(TILE_MAP.z)}</div>
                </div>
                
                <div class="mt-6 flex justify-center gap-4">
                    <button id="edit-cancel-btn" class="px-6 py-2 rounded-lg text-gray-500 hover:bg-gray-100 font-medium transition">
                        Cancel
                    </button>
                    <button id="edit-done-btn" class="px-8 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold shadow transition disabled:opacity-50" ${hand.length === 0 ? 'disabled' : ''}>
                        Analyze Hand
                    </button>
                </div>
            </div>
        </div>
    `;

    // Remove logic
    hand.forEach((tile, index) => {
        document.getElementById(`edit-tile-${index}`).addEventListener('click', () => {
            currentGameState.hand.splice(index, 1);
            renderGameScene();
        });
    });

    // Add logic
    const allTilesFlat = [...TILE_MAP.m, ...TILE_MAP.p, ...TILE_MAP.s, ...TILE_MAP.z];
    allTilesFlat.forEach(tileCode => {
        document.getElementById(`key-${tileCode}`).addEventListener('click', () => {
            if (currentGameState.hand.length >= 17) {
                alert("Cannot exceed 17 tiles.");
                return;
            }
            const countInHand = currentGameState.hand.filter(t => t === tileCode).length;
            if (countInHand >= 4) {
                alert("You cannot have more than 4 of the same tile.");
                return;
            }
            currentGameState.hand.push(tileCode);
            currentGameState.hand = sortHand(currentGameState.hand);
            renderGameScene();
        });
    });

    // Actions
    document.getElementById('edit-cancel-btn').addEventListener('click', () => {
        currentGameState.isEditing = false;
        // Re-sort the original just in case
        currentGameState.hand = sortHand(currentGameState.hand);
        renderGameScene();
    });

    const isValidHandSize = [5, 8, 11, 14, 17].includes(currentGameState.hand.length);
    
    document.getElementById('edit-done-btn').disabled = !isValidHandSize;
    if (!isValidHandSize) {
        document.getElementById('edit-done-btn').classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        document.getElementById('edit-done-btn').classList.remove('opacity-50', 'cursor-not-allowed');
    }

    document.getElementById('edit-done-btn').addEventListener('click', () => {
        if (![5, 8, 11, 14, 17].includes(currentGameState.hand.length)) return;
        currentGameState.isEditing = false;
        currentGameState.selectedHandSize = currentGameState.hand.length;
        currentGameState.analysis = getDiscardAnalysis(currentGameState.hand);
        renderGameScene();
    });
}

let currentOptimalIndex = 0; // Track which optimal move we are viewing

function handleDiscard(tile, index) {
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
        import('./storage.js').then(module => {
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

function renderHistoryScene() {
    currentGameState.mode = 'History';
    const appContainer = document.getElementById('app');
    const stats = loadStats();
    const history = stats.history || [];

    const historyHtml = history.length === 0 
        ? `<div class="flex flex-col items-center justify-center h-48 text-gray-400">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             <p>No history yet.</p>
             <p class="text-xs mt-1">Play some hands in Training Mode to see your records here!</p>
           </div>`
        : history.map((record, index) => {
            const timeStr = record.timeMs && record.timeMs > 0 ? `${(record.timeMs / 1000).toFixed(1)}s` : '-';
            const handHtml = record.hand.map(t => renderTile(t, { size: 'xs', extraClasses: 'shadow-sm' })).join('');
            const tileName = TILE_NAMES[record.userDiscard];
            
            return `
                <div class="history-card bg-white p-4 rounded-xl shadow-md border border-gray-200 flex items-center justify-between gap-4 relative cursor-pointer hover:border-blue-400 hover:shadow-lg transition group" data-index="${index}">
                    
                    <div class="flex flex-col gap-2 w-full overflow-hidden">
                        <div class="flex justify-between items-center border-b border-gray-50 pb-2">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-gray-400">#${history.length - index}</span>
                                <span class="text-xs font-medium text-gray-500">${new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-xs font-mono text-gray-500 flex items-center gap-0.5"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>${timeStr}</span>
                                <span class="${record.isCorrect ? 'bg-mj-green' : 'bg-mj-red'} text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                                    ${record.isCorrect ? 'CORRECT' : 'WRONG'}
                                </span>
                            </div>
                        </div>
                        
                        <div class="flex flex-wrap gap-0.5 mt-1 overflow-x-auto pb-1 pointer-events-none">
                            ${handHtml}
                        </div>
                        
                        <div class="flex items-center gap-2 mt-1 bg-gray-50 p-2 rounded-lg pointer-events-none">
                            <span class="text-xs text-gray-500 font-bold uppercase tracking-wider">SELECTED:</span>
                            <div class="flex items-center gap-1">
                                ${renderTile(record.userDiscard, { size: 'xs' })}
                                <span class="font-bold text-gray-800 text-sm">${tileName}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Right Arrow Indicator -->
                    <div class="flex-shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors pl-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>

                </div>
            `;
        }).join('');

    appContainer.innerHTML = `
        <div class="flex flex-col h-full max-w-4xl mx-auto mt-2 px-2 w-full">
            <div class="w-full flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Recent History
                </h2>
                <button id="back-btn" class="text-xs font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Dashboard
                </button>
            </div>
            
            <div id="history-scroll-container" class="flex flex-col gap-3 pb-8 overflow-y-auto" style="max-height: calc(100vh - 120px);">
                ${historyHtml}
            </div>
        </div>
    `;

    document.getElementById('back-btn').addEventListener('click', initApp);

    document.querySelectorAll('.history-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            const record = history[index];
            if (record) {
                currentGameState.reviewingHistoryIndex = index;
                currentGameState.hand = [...record.hand];
                currentGameState.selectedHandSize = record.hand.length;
                startTrainingSession('進張計算機', true);
            }
        });
    });

    if (currentGameState.reviewingHistoryIndex !== null) {
        setTimeout(() => {
            const targetCard = document.querySelector(`.history-card[data-index="${currentGameState.reviewingHistoryIndex}"]`);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
            currentGameState.reviewingHistoryIndex = null;
        }, 50);
    }
}

function renderFeedbackState(userMove, allOptimalMoves, isCorrect, isCalculator, tile, index) {
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
                                ${userMove.shanten === 0 ? '聽牌' : `${userMove.shanten}<span class="text-xs font-bold ml-0.5 text-gray-600">向聽</span>`}
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
            </div>
        `;
        
        // Highlight active tile in Calculator
        document.querySelectorAll('.tile-container').forEach(el => el.classList.remove('scale-110', 'brightness-110', 'translate-y-[-8px]', 'z-10'));
        document.getElementById(`tile-${index}`).classList.add('scale-110', 'brightness-110', 'translate-y-[-8px]', 'z-10');

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
                                ${userMove.shanten === 0 ? '聽牌' : `${userMove.shanten}<span class="text-xs font-bold ml-0.5 text-gray-600">向聽</span>`}
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
                                        ${bestMove.shanten === 0 ? '聽牌' : `${bestMove.shanten}<span class="text-xs font-bold ml-0.5 text-emerald-600">向聽</span>`}
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
