// app.js
// Main entry point for the Taiwan Mahjong Trainer application

import { loadStats, updateStat, getAccuracy, clearStats, getAverageTime } from './storage.js';
import { renderTile } from './components/Tile.js';
import { generateTrainingHand, sortHand } from './engine/handGenerator.js';
import { getDiscardAnalysis, isWinningHand, getChiOptions, getPonOptions, calculateShanten, getKanOptions, getClosedKanOptions } from './engine/shanten.js';
import { TILE_NAMES, TILE_MAP, createDeck } from './constants.js';
let currentGameState = {
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
    showAiTenpai: false
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
                    <span class="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">v1.3.1</span>
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

                <div id="btn-vs" class="bg-white p-5 rounded-xl shadow-md border border-gray-200 flex items-center justify-between cursor-pointer hover:border-orange-500 hover:shadow-lg transition group">
                    <div class="text-left">
                        <p class="font-bold text-gray-800 text-lg">AI對戰練習</p>
                        <p class="text-xs text-gray-500 mt-1">Full match against the AI.</p>
                    </div>
                    <div class="bg-orange-50 group-hover:bg-orange-500 p-3 rounded-xl transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-orange-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h.01M15 9h.01M8 13h8" />
                        </svg>
                    </div>
                </div>

                <div id="btn-mc" class="bg-white p-5 rounded-xl shadow-md border border-gray-200 flex items-center justify-between cursor-pointer hover:border-purple-500 hover:shadow-lg transition group">
                    <div class="text-left">
                        <p class="font-bold text-gray-800 text-lg">蒙地卡羅演算法</p>
                        <p class="text-xs text-gray-500 mt-1">Deep simulation for sub-hands.</p>
                    </div>

                    <div class="bg-purple-50 group-hover:bg-purple-500 p-3 rounded-xl transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove old reset button and dark mode logic from here as it is either global or removed
    document.getElementById('btn-trainer').addEventListener('click', () => {
        currentGameState.includeHonors = false; // Default off for Training
        showSettingsModal('最大機率打法', false, false);
    });

    document.getElementById('btn-calc').addEventListener('click', () => {
        currentGameState.includeHonors = false; // Default off for Calculator
        showSettingsModal('進張計算機', true, false);
    });

    document.getElementById('btn-mc').addEventListener('click', () => {
        currentGameState.includeHonors = true; // Default to true for MC mode
        showSettingsModal('蒙地卡羅演算法', true, false, true); // (mode, isCalc, isUpdate, isMCMode)
    });

    document.getElementById('btn-vs').addEventListener('click', () => {
        startVsMode();
    });
}

function showSettingsModal(modeName, isCalculator, isUpdate, isMCMode = false) {
    let modalEl = document.getElementById('settings-modal-root');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'settings-modal-root';
        document.body.appendChild(modalEl);
    }

    const isVsMode = modeName === 'AI對戰練習';

    let tempSize = currentGameState.selectedHandSize;
    let tempHonors = currentGameState.includeHonors;
    let tempRecordTime = currentGameState.recordTime;
    let tempEnableMC = currentGameState.enableMC || false;
    let tempMCDraws = currentGameState.mcDraws || 5;
    let tempMCRuns = currentGameState.mcRuns || 1000;
    
    // AI Settings
    let tempAiDifficulty = currentGameState.aiDifficulty || 'expert';
    let tempAiStyle = currentGameState.aiStyle || 'aggressive';
    let tempShowAiTenpai = currentGameState.showAiTenpai || false;

    const activeColorClass = isMCMode ? 'bg-purple-500' : (isCalculator ? 'bg-blue-500' : (isVsMode ? 'bg-orange-500' : 'bg-mj-green'));
    const sizes = [5, 8, 11, 14, 17];
    
    if (isVsMode) {
        tempSize = 17;
        tempHonors = true; // AI Arena always uses full deck
    } else if (!sizes.includes(tempSize)) {
        tempSize = 8;
    }

    modalEl.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in-up transition-colors">
                <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
                    <h3 class="font-bold text-gray-800 dark:text-white">${isUpdate ? 'Settings' : 'Setup ' + modeName}</h3>
                    <button id="close-settings" class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-1 transition">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div class="p-5 flex flex-col gap-5">
                    
                    ${!isVsMode ? `
                    <div>
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Hand Size</p>
                        <div class="flex gap-2" id="modal-size-container"></div>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tile Pool</p>
                        <div id="modal-honors-toggle-wrapper" class="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer select-none">
                            <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">Include Winds & Dragons (字牌)</span>
                            <div class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tempHonors ? activeColorClass : 'bg-gray-200 dark:bg-gray-600'}">
                                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tempHonors ? 'translate-x-6' : 'translate-x-1'}"></span>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    ${isVsMode ? `
                    <div>
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">AI Settings</p>
                        <div class="grid grid-cols-1 gap-3 border border-gray-100 dark:border-gray-700 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-800/50">
                            <div class="flex flex-col">
                                <label class="text-[11px] font-bold text-gray-400 mb-1">Difficulty (難度)</label>
                                <select id="ai-difficulty-select" class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-orange-500">
                                    <option value="expert" ${tempAiDifficulty === 'expert' ? 'selected' : ''}>專家 (Expert)</option>
                                    <option value="beginner" ${tempAiDifficulty === 'beginner' ? 'selected' : ''}>新手 (Beginner)</option>
                                    <option value="random" ${tempAiDifficulty === 'random' ? 'selected' : ''}>隨機 (Random)</option>
                                </select>
                            </div>
                            <div class="flex flex-col">
                                <label class="text-[11px] font-bold text-gray-400 mb-1">Play Style (打法風格)</label>
                                <select id="ai-style-select" class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-orange-500">
                                    <option value="aggressive" ${tempAiStyle === 'aggressive' ? 'selected' : ''}>積極 (Aggressive)</option>
                                    <option value="balanced" ${tempAiStyle === 'balanced' ? 'selected' : ''}>平衡 (Balanced)</option>
                                    <option value="defensive" ${tempAiStyle === 'defensive' ? 'selected' : ''}>保守 (Defensive)</option>
                                </select>
                            </div>
                            <div id="modal-ai-tenpai-toggle-wrapper" class="flex items-center justify-between p-2 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer select-none mt-1">
                                <span class="text-xs text-gray-700 dark:text-gray-300 font-medium">Show AI Tenpai (聽牌) Indicator</span>
                                <div class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${tempShowAiTenpai ? activeColorClass : 'bg-gray-200 dark:bg-gray-600'}">
                                    <span class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${tempShowAiTenpai ? 'translate-x-5' : 'translate-x-1'}"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    ${!isCalculator && !isMCMode && !isVsMode ? `
                    <div>
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Time</p>
                        <div class="flex flex-col gap-2">
                            <div id="modal-time-toggle-wrapper" class="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer select-none">
                                <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">Record Time Taken</span>
                                <div class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tempRecordTime ? activeColorClass : 'bg-gray-200 dark:bg-gray-600'}">
                                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tempRecordTime ? 'translate-x-6' : 'translate-x-1'}"></span>
                                </div>
                            </div>
                            <div id="modal-show-timer-toggle-wrapper" class="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer select-none">
                                <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">Display Live Timer</span>
                                <div class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${currentGameState.showTimer ? activeColorClass : 'bg-gray-200 dark:bg-gray-600'}">
                                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentGameState.showTimer ? 'translate-x-6' : 'translate-x-1'}"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${isMCMode ? `
                    <div>
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Simulation Settings</p>
                        <div class="grid grid-cols-2 gap-3 border border-gray-100 dark:border-gray-700 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-800/50">
                            <div class="flex flex-col col-span-2 sm:col-span-1">
                                <label class="text-[11px] font-bold text-gray-400 mb-1">Bot Policy</label>
                                <select id="mc-policy-select" class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-purple-500">
                                    <option value="greedy" ${currentGameState.mcPolicy === 'greedy' ? 'selected' : ''}>最大機率 (Greedy)</option>
                                    <option value="random" ${currentGameState.mcPolicy === 'random' ? 'selected' : ''}>隨機 (Random)</option>
                                </select>
                            </div>
                            <div class="flex flex-col">
                                <label class="text-[11px] font-bold text-gray-400 mb-1">Max Draws</label>
                                <select id="mc-draws-select" class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-purple-500">
                                    <option value="3" ${tempMCDraws === 3 ? 'selected' : ''}>3</option>
                                    <option value="5" ${tempMCDraws === 5 ? 'selected' : ''}>5</option>
                                    <option value="7" ${tempMCDraws === 7 ? 'selected' : ''}>7</option>
                                    <option value="10" ${tempMCDraws === 10 ? 'selected' : ''}>10</option>
                                </select>
                            </div>
                            <div class="flex flex-col">
                                <label class="text-[11px] font-bold text-gray-400 mb-1">Iterations</label>
                                <select id="mc-runs-select" class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-purple-500">
                                    <option value="100" ${tempMCRuns === 100 ? 'selected' : ''}>100</option>
                                    <option value="1000" ${tempMCRuns === 1000 ? 'selected' : ''}>1,000</option>
                                    <option value="5000" ${tempMCRuns === 5000 ? 'selected' : ''}>5,000</option>
                                    <option value="10000" ${tempMCRuns === 10000 ? 'selected' : ''}>10,000</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 sticky bottom-0 z-10">
                    <button id="apply-settings" class="${activeColorClass} hover:opacity-90 text-white font-bold px-6 py-3 rounded-xl shadow-md transition active:scale-95 w-full">
                        ${isUpdate ? (isVsMode ? 'Apply Changes' : 'Apply & Restart Hand') : 'Start'}
                    </button>
                </div>
            </div>
        </div>
    `;

    // --- Helper UI Updaters ---
    const updateSizeButtons = () => {
        const container = document.getElementById('modal-size-container');
        if (!container) return;
        container.innerHTML = sizes.map(s => `
            <button class="modal-size-btn flex-1 py-2 rounded-xl text-sm font-bold transition ${tempSize === s ? activeColorClass + ' text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}" data-size="${s}">
                ${s}
            </button>
        `).join('');

        document.querySelectorAll('.modal-size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                tempSize = parseInt(e.currentTarget.dataset.size);
                updateSizeButtons();
            });
        });
    };

    const updateToggleUI = (wrapperId, state) => {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;
        const track = wrapper.querySelector('.transition-colors');
        const knob = wrapper.querySelector('.transition-transform');
        if (state) {
            track.classList.remove('bg-gray-200', 'dark:bg-gray-600');
            track.classList.add(activeColorClass);
            knob.classList.remove('translate-x-1');
            knob.classList.add('translate-x-6');
        } else {
            track.classList.remove(activeColorClass);
            track.classList.add('bg-gray-200', 'dark:bg-gray-600');
            knob.classList.remove('translate-x-6');
            knob.classList.add('translate-x-1');
        }
    };

    // --- Initialization ---
    if (!isVsMode) updateSizeButtons();

    // --- Event Listeners ---
    document.getElementById('close-settings').addEventListener('click', () => { modalEl.innerHTML = ''; });

    const honorsWrapper = document.getElementById('modal-honors-toggle-wrapper');
    if (honorsWrapper) {
        honorsWrapper.addEventListener('click', () => {
            tempHonors = !tempHonors;
            updateToggleUI('modal-honors-toggle-wrapper', tempHonors);
        });
    }

    const timeWrapper = document.getElementById('modal-time-toggle-wrapper');
    if (timeWrapper) {
        timeWrapper.addEventListener('click', () => {
            tempRecordTime = !tempRecordTime;
            updateToggleUI('modal-time-toggle-wrapper', tempRecordTime);
        });
    }

    const showTimerWrapper = document.getElementById('modal-show-timer-toggle-wrapper');
    if (showTimerWrapper) {
        showTimerWrapper.addEventListener('click', () => {
            currentGameState.showTimer = !currentGameState.showTimer;
            updateToggleUI('modal-show-timer-toggle-wrapper', currentGameState.showTimer);
        });
    }

    const difficultySelect = document.getElementById('ai-difficulty-select');
    if (difficultySelect) {
        difficultySelect.addEventListener('change', (e) => { tempAiDifficulty = e.target.value; });
    }

    const aiStyleSelect = document.getElementById('ai-style-select');
    if (aiStyleSelect) {
        aiStyleSelect.addEventListener('change', (e) => { tempAiStyle = e.target.value; });
    }

    const aiTenpaiWrapper = document.getElementById('modal-ai-tenpai-toggle-wrapper');
    if (aiTenpaiWrapper) {
        aiTenpaiWrapper.addEventListener('click', () => {
            tempShowAiTenpai = !tempShowAiTenpai;
            updateToggleUI('modal-ai-tenpai-toggle-wrapper', tempShowAiTenpai);
        });
    }

    const mcPolicySelect = document.getElementById('mc-policy-select');

    const mcDrawsSelect = document.getElementById('mc-draws-select');
    const mcRunsSelect = document.getElementById('mc-runs-select');

    document.getElementById('apply-settings').addEventListener('click', () => {
        if (isVsMode) {
            currentGameState.aiDifficulty = tempAiDifficulty;
            currentGameState.aiStyle = tempAiStyle;
            currentGameState.showAiTenpai = tempShowAiTenpai;
            modalEl.innerHTML = '';
            if (isUpdate) {
                renderVsArena(); // Refresh labels
            } else {
                startVsMode(); // Fresh game
            }
            return;
        }

        const handNeedsReset = currentGameState.selectedHandSize !== tempSize || currentGameState.includeHonors !== tempHonors;
        const mcParamsChanged = isMCMode && (
            currentGameState.mcDraws !== parseInt(mcDrawsSelect.value) || 
            currentGameState.mcRuns !== parseInt(mcRunsSelect.value) ||
            currentGameState.mcPolicy !== mcPolicySelect.value
        );

        currentGameState.selectedHandSize = tempSize;
        currentGameState.includeHonors = tempHonors;
        currentGameState.recordTime = tempRecordTime;
        currentGameState.isMCMode = isMCMode;
        
        if (isMCMode) {
            currentGameState.mcDraws = parseInt(mcDrawsSelect.value);
            currentGameState.mcRuns = parseInt(mcRunsSelect.value);
            currentGameState.mcPolicy = mcPolicySelect.value;
            currentGameState.enableMC = true;
        } else {
            currentGameState.enableMC = false;
        }

        if (handNeedsReset || mcParamsChanged) {
            currentGameState.mcCache = {};
            if (isUpdate && handNeedsReset) currentGameState.hand = [];
        }

        modalEl.innerHTML = '';
        startTrainingSession(modeName, isCalculator, isMCMode);
    });
}


function startTrainingSession(modeName, isCalculator = false, isMCMode = false) {
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

function renderGameScene() {
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
                            â±ï¸<span id="live-timer-display" class="font-mono w-[4ch] text-right inline-block tracking-tighter">0.0</span><span class="ml-0.5">s</span>
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
                            <h3 class="text-3xl font-black text-yellow-500 mb-1 tracking-widest drop-shadow-sm">èƒ¡ç‰Œ</h3>
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
                startTrainingSession('è’™åœ°å¡ç¾…æ¼”ç®—æ³•', true, true);
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
                startTrainingSession('è’™åœ°å¡ç¾…æ¼”ç®—æ³•', true, true);
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
    const { hand, isMCMode } = currentGameState;
    const maxTiles = 17;
    const validSizes = [5, 8, 11, 14, 17];

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
            <div class="bg-white p-4 md:p-6 rounded-2xl shadow-lg border-t-8 ${isMCMode ? 'border-purple-500' : 'border-blue-500'} w-full text-center relative">
                <h3 class="text-lg font-bold text-gray-800 mb-1">Edit Hand</h3>
                <p class="text-xs text-gray-500 mb-4">Click tiles below to add. Click hand tiles to remove.</p>
                
                <!-- Current Hand -->
                <div class="flex flex-wrap gap-1 justify-center min-h-[60px] pb-4 mb-2 border-b border-gray-100" id="edit-hand-container">
                    ${handHtml || '<p class="text-sm text-gray-300 italic my-auto">Hand is empty</p>'}
                </div>

                <div class="flex justify-between items-center mb-4 max-w-lg mx-auto px-2">
                    <p class="text-sm font-bold ${hand.length > maxTiles ? 'text-mj-red' : (isMCMode ? 'text-purple-500' : 'text-blue-500')}">${hand.length} / ${maxTiles} Tiles</p>
                    <button id="edit-clear-btn" class="text-xs font-bold text-red-500 hover:text-red-700 transition ${hand.length === 0 ? 'invisible' : ''}">Clear All</button>
                </div>                
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
                    <button id="edit-done-btn" class="px-8 py-2 rounded-lg ${isMCMode ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'} text-white font-bold shadow transition disabled:opacity-50" ${hand.length === 0 ? 'disabled' : ''}>
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
            if (currentGameState.hand.length >= maxTiles) {
                alert(`Cannot exceed ${maxTiles} tiles.`);
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

    // Clear logic
    const clearBtn = document.getElementById('edit-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            currentGameState.hand = [];
            renderGameScene();
        });
    }

    // Actions
    document.getElementById('edit-cancel-btn').addEventListener('click', () => {
        currentGameState.isEditing = false;
        // Re-sort the original just in case
        currentGameState.hand = sortHand(currentGameState.hand);
        renderGameScene();
    });

    const isValidHandSize = validSizes.includes(currentGameState.hand.length);
    
    document.getElementById('edit-done-btn').disabled = !isValidHandSize;
    if (!isValidHandSize) {
        document.getElementById('edit-done-btn').classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        document.getElementById('edit-done-btn').classList.remove('opacity-50', 'cursor-not-allowed');
    }

    document.getElementById('edit-done-btn').addEventListener('click', () => {
        if (!validSizes.includes(currentGameState.hand.length)) return;
        currentGameState.isEditing = false;
        currentGameState.selectedHandSize = currentGameState.hand.length;
        currentGameState.analysis = getDiscardAnalysis(currentGameState.hand);
        currentGameState.mcCache = {};
        renderGameScene();
    });
}

let currentOptimalIndex = 0; // Track which optimal move we are viewing

function handleDiscard(tile, index) {
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
                    <span class="hidden sm:inline">Back</span>
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
                currentGameState.mcCache = {}; // Clear old MC results
                currentGameState.enableMC = false; // Ensure MC is off in normal calculator
                currentGameState.isMCMode = false;
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

function getMCLoaderHtml(runs, draws) {
    return `
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
        <p class="text-[10px] text-gray-400">Simulating ${runs} runs of ${draws} draws</p>
    `;
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
                            <p class="text-[10px] text-gray-500 font-bold mb-0.5">ç‹€æ…‹</p>
                            <p class="text-xl font-black tracking-tight ${userMove.shanten === 0 ? 'text-mj-red' : 'text-blue-600'}">
                                ${userMove.shanten === 0 ? 'è½ç‰Œ' : `${userMove.shanten}<span class="text-xs font-bold ml-0.5 text-gray-600">å‘è½</span>`}
                            </p>
                        </div>
                        <div class="w-px h-8 bg-gray-300 rounded"></div>
                        <div class="text-center min-w-[60px]">
                            <p class="text-[10px] text-gray-500 font-bold mb-0.5">é€²å¼µ</p>
                            <p class="text-xl font-black text-blue-500 tracking-tight">
                                ${userMove.acceptedTiles.length}<span class="text-xs font-bold text-gray-400 mx-0.5">æ¬¾</span>${userMove.acceptance}<span class="text-xs font-bold text-gray-400 mx-0.5">å¼µ</span>
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
                            <p class="text-[10px] text-gray-500 font-bold mb-0.5">ç‹€æ…‹</p>
                            <p class="text-xl font-black tracking-tight ${userMove.shanten === 0 ? 'text-mj-red' : 'text-blue-600'}">
                                ${userMove.shanten === 0 ? 'è½ç‰Œ' : `${userMove.shanten}<span class="text-xs font-bold ml-0.5 text-gray-600">å‘è½</span>`}
                            </p>
                        </div>
                        <div class="w-px h-8 bg-gray-300 rounded"></div>
                        <div class="text-center min-w-[60px]">
                            <p class="text-[10px] text-gray-500 font-bold mb-0.5">é€²å¼µ</p>
                            <p class="text-xl font-black text-blue-500 tracking-tight">
                                ${userMove.acceptedTiles.length}<span class="text-xs font-bold text-gray-400 mx-0.5">æ¬¾</span>${userMove.acceptance}<span class="text-xs font-bold text-gray-400 mx-0.5">å¼µ</span>
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
                                    <p class="text-[10px] text-emerald-600 font-bold mb-0.5">ç‹€æ…‹</p>
                                    <p class="text-xl font-black tracking-tight ${bestMove.shanten === 0 ? 'text-mj-red' : 'text-emerald-700'}">
                                        ${bestMove.shanten === 0 ? 'è½ç‰Œ' : `${bestMove.shanten}<span class="text-xs font-bold ml-0.5 text-emerald-600">å‘è½</span>`}
                                    </p>
                                </div>
                                <div class="w-px h-8 bg-emerald-200 rounded"></div>
                                <div class="text-center min-w-[60px]">
                                    <p class="text-[10px] text-emerald-600 font-bold mb-0.5">é€²å¼µ</p>
                                    <p class="text-xl font-black text-emerald-600 tracking-tight">
                                        ${bestMove.acceptedTiles.length}<span class="text-xs font-bold text-emerald-400 mx-0.5">æ¬¾</span>${bestMove.acceptance}<span class="text-xs font-bold text-emerald-400 mx-0.5">å¼µ</span>
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

function getMCResultsHtml(stats) {
    const { winRate, tenpaiRate, avgDraws, runs: doneRuns, maxDraws: doneMax, topFinalHands } = stats;
    
    const finalHandsHtml = topFinalHands.length > 0 ? topFinalHands.map((item, idx) => {
        let shantenBadge = '';
        if (item.shanten === -1) {
            shantenBadge = '<span class="bg-yellow-400 text-white text-[11px] font-black px-2 py-1 rounded shadow-sm whitespace-nowrap">ç³Šç‰Œ</span>';
        } else if (item.shanten === 0) {
            shantenBadge = '<span class="bg-red-500 text-white text-[11px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">è½ç‰Œ</span>';
        } else {
            shantenBadge = `<span class="bg-gray-400 text-white text-[11px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">${item.shanten}å‘è½</span>`;
        }

        return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between w-full p-2 bg-white rounded-lg border border-gray-100 mb-1 gap-2">
            <div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar flex-grow">
                <span class="text-xs font-bold text-gray-400 w-4 flex-shrink-0">${idx + 1}.</span>
                <div class="flex flex-wrap sm:flex-nowrap gap-0.5 pointer-events-none flex-shrink-0">
                    ${item.hand.map(t => renderTile(t, { size: 'xs', extraClasses: 'shadow-sm' })).join('')}
                </div>
            </div>
            <div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto bg-gray-50 sm:bg-transparent p-1.5 sm:p-0 rounded-lg">
                ${shantenBadge}
                <div class="flex items-center gap-3">
                    <div class="flex flex-col items-center">
                        <span class="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Occur.</span>
                        <span class="text-xs font-black text-gray-700">${item.count}</span>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Prob.</span>
                        <span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">${((item.count / doneRuns) * 100).toFixed(4)}%</span>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('') : '<p class="text-xs text-gray-400 italic p-2">No data available</p>';

    return `
        <div class="w-full animate-fade-in-up">
            <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span>Simulation Results</span>
                    <button id="mc-rerun-btn" class="p-1 hover:bg-gray-200 rounded-full transition text-gray-400 hover:text-purple-600" title="Rerun Simulation">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
                <span class="text-[10px] font-normal text-gray-400 normal-case bg-gray-100 px-1.5 py-0.5 rounded">${doneRuns} runs, limit ${doneMax} draws</span>
            </h4>
            
            <div class="grid grid-cols-2 gap-2 mb-3">
                <div class="bg-blue-50/50 rounded-lg p-2 text-center border border-blue-100">
                    <p class="text-[10px] text-blue-600/70 font-bold mb-0.5">Win Rate</p>
                    <p class="text-lg font-black text-blue-600">${winRate.toFixed(1)}<span class="text-xs ml-0.5">%</span></p>
                </div>
                <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                    <p class="text-[10px] text-gray-500 font-bold mb-0.5">Avg Draws to Win</p>
                    <p class="text-lg font-black text-gray-700">${avgDraws ? avgDraws.toFixed(2) : '-'}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-100 col-span-2">
                    <p class="text-[10px] text-gray-500 font-bold mb-0.5">Reached Tenpai (or Win)</p>
                    <p class="text-lg font-black text-gray-700">${tenpaiRate.toFixed(1)}<span class="text-xs ml-0.5">%</span></p>
                </div>
            </div>

            <div class="w-full text-left">
                <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Top Final Hands</p>
                <div class="flex flex-col gap-1 w-full bg-gray-50 p-1.5 rounded-xl border border-gray-100 max-h-64 overflow-y-auto">
                    ${finalHandsHtml}
                </div>
            </div>
        </div>
    `;
}

// Keep track of active workers to terminate them if a new tile is clicked
let activeMCWorkers = [];

function runMonteCarlo(hand, discard, totalRuns, maxDraws, includeHonors) {
    // Terminate existing workers
    if (activeMCWorkers.length > 0) {
        activeMCWorkers.forEach(w => w.terminate());
        activeMCWorkers = [];
    }
    
    const bindRerun = () => {
        const rerunBtn = document.getElementById('mc-rerun-btn');
        if (rerunBtn) {
            rerunBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Clear cache for this specific discard before rerunning
                if (currentGameState.mcCache) delete currentGameState.mcCache[discard];
                
                // Show loader immediately
                const mcContainer = document.getElementById('mc-results-container');
                if (mcContainer) {
                    mcContainer.innerHTML = getMCLoaderHtml(totalRuns, maxDraws);
                }
                
                runMonteCarlo(hand, discard, totalRuns, maxDraws, includeHonors);
            });
        }
    };

    // Check Cache first
    if (currentGameState.mcCache && currentGameState.mcCache[discard]) {
        const mcContainer = document.getElementById('mc-results-container');
        if (mcContainer) {
            mcContainer.innerHTML = getMCResultsHtml(currentGameState.mcCache[discard]);
            bindRerun();
        }
        return;
    }
    
    // Set running state
    currentGameState.isMCRunning = true;
    const handContainer = document.getElementById('hand-container');
    if (handContainer) {
        handContainer.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
    }

    const mcContainer = document.getElementById('mc-results-container');
    
    // Determine worker pool size (cap at 4 to prevent overloading low-end devices, or fewer if runs is small)
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const numWorkers = totalRuns >= 1000 ? Math.min(hardwareConcurrency, 4) : 1;
    
    const runsPerWorker = Math.floor(totalRuns / numWorkers);
    const leftoverRuns = totalRuns % numWorkers;

    let completedWorkers = 0;
    let workerProgress = new Array(numWorkers).fill(0);
    
    // Aggregated stats
    let aggWinCount = 0;
    let aggTenpaiCount = 0;
    let aggTotalDrawsToWin = 0;
    let aggFinalHands = {};

    for (let i = 0; i < numWorkers; i++) {
        const worker = new Worker('./src/js/engine/mcWorker.js', { type: 'module' });
        activeMCWorkers.push(worker);
        
        // Calculate exact runs for this specific worker
        const workerRuns = i === 0 ? runsPerWorker + leftoverRuns : runsPerWorker;
        
        worker.onmessage = function(e) {
            if (!currentGameState.isMCRunning) return; // Ignore if cancelled
            
            if (e.data.progress) {
                workerProgress[i] = e.data.percent;
                const totalProgress = Math.floor(workerProgress.reduce((a, b) => a + b, 0) / numWorkers);
                
                if (mcContainer) {
                    const progressBar = document.getElementById('mc-progress-bar');
                    const progressText = document.getElementById('mc-progress-text');
                    if (progressBar) progressBar.style.width = `${totalProgress}%`;
                    if (progressText) progressText.innerText = `Running Monte Carlo... ${totalProgress}%`;
                }
                return;
            }
            
            if (e.data.error) {
                activeMCWorkers.forEach(w => w.terminate());
                activeMCWorkers = [];
                currentGameState.isMCRunning = false;
                if (handContainer) handContainer.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                if (mcContainer) mcContainer.innerHTML = `<p class="text-xs text-red-500">Error: ${e.data.error}</p>`;
                return;
            }
            
            // Worker finished successfully - Aggregate data
            const stats = e.data.stats;
            aggWinCount += stats.winCount;
            // The worker sends tenpaiRate, but we need raw counts to aggregate properly
            // Re-derive tenpaiCount from the worker's rate logic: tenpaiRate = ((tenpaiCount + winCount) / runs) * 100
            const workerTenpaiCount = Math.round((stats.tenpaiRate / 100) * stats.runs) - stats.winCount;
            aggTenpaiCount += workerTenpaiCount;
            
            // Re-derive total draws for wins
            if (stats.avgDraws !== null) {
                aggTotalDrawsToWin += (stats.avgDraws * stats.winCount);
            }

            // Merge final hands
            // The worker sends an array of top 10 already reconstructed objects.
            // For perfectly accurate aggregation, the worker should really send raw counts, but since we are just doing Top Hands, merging these counts is acceptable.
            stats.topFinalHands.forEach(item => {
                const stateKey = item.hand.join('');
                if (!aggFinalHands[stateKey]) {
                    aggFinalHands[stateKey] = { hand: item.hand, count: 0, shanten: item.shanten };
                }
                aggFinalHands[stateKey].count += item.count;
            });

            completedWorkers++;

            if (completedWorkers === numWorkers) {
                // All workers done - calculate final numbers
                const finalWinRate = (aggWinCount / totalRuns) * 100;
                const finalTenpaiRate = ((aggTenpaiCount + aggWinCount) / totalRuns) * 100;
                const finalAvgDraws = aggWinCount > 0 ? (aggTotalDrawsToWin / aggWinCount) : null;

                // Sort aggregated hands
                const finalTopHands = Object.values(aggFinalHands)
                    .sort((a, b) => {
                        if (b.count !== a.count) {
                            return b.count - a.count;
                        }
                        return a.shanten - b.shanten;
                    })
                    .slice(0, 20);

                const finalStats = {
                    winRate: finalWinRate,
                    tenpaiRate: finalTenpaiRate,
                    avgDraws: finalAvgDraws,
                    winCount: aggWinCount,
                    runs: totalRuns,
                    maxDraws: maxDraws,
                    topFinalHands: finalTopHands
                };

                // Cleanup state
                activeMCWorkers = [];
                currentGameState.isMCRunning = false;
                if (handContainer) {
                    handContainer.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                }

                if (!currentGameState.mcCache) currentGameState.mcCache = {};
                currentGameState.mcCache[discard] = finalStats;
                
                if (mcContainer) {
                    mcContainer.innerHTML = getMCResultsHtml(finalStats);
                    bindRerun();
                }
            }
        };
        
        // Start worker
        worker.postMessage({ 
            hand, 
            discard, 
            runs: workerRuns, 
            maxDraws, 
            includeHonors,
            policy: currentGameState.mcPolicy 
        });
    }
}

// --- Seeded Random Helper ---
function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// --- AI對戰練習 Mode ---
let vsGameState = {
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
    forbiddenDiscard: null // Tile that cannot be discarded this turn (Kuikae rule)
};

/**
 * Displays a temporary action bubble over the AI's avatar.
 */
function showAiActionBubble(message) {
    const container = document.getElementById('vs-notification-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-gray-900/90 backdrop-blur text-white px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 ring-4 ring-black/5 animate-slide-down">
            <div class="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">AI</div>
            <span class="font-bold tracking-wider text-sm">${message}</span>
        </div>
    `;
    
    // Clear notification after 1.5 seconds
    setTimeout(() => {
        container.innerHTML = '';
    }, 1500);
}

/**
 * Saves a snapshot of the current VS game state for rollback support.
 */
function saveVsSnapshot() {
    // Limit stack size to 50 moves to save memory
    if (vsGameState.historyStack.length >= 50) {
        vsGameState.historyStack.shift();
    }
    
    // Deep clone the essential state (exclude the stack itself to avoid circular refs)
    const snapshot = JSON.parse(JSON.stringify({
        wall: vsGameState.wall,
        player: vsGameState.player,
        ai: vsGameState.ai,
        currentTurn: vsGameState.currentTurn,
        pendingAction: vsGameState.pendingAction,
        trajectory: vsGameState.trajectory,
        isGameOver: vsGameState.isGameOver,
        winner: vsGameState.winner,
        showAiHand: vsGameState.showAiHand,
        latestDiscard: vsGameState.latestDiscard,
        currentSeed: vsGameState.currentSeed,
        forbiddenDiscard: vsGameState.forbiddenDiscard
    }));
    
    vsGameState.historyStack.push(snapshot);
}

function startVsMode(providedSeed = null) {
    currentGameState.mode = 'AI對戰練習';
    
    // Use provided seed or generate a random numeric seed
    // Ensure seed is a number to avoid [object PointerEvent] issues
    const seed = (providedSeed !== null && typeof providedSeed === 'number') 
        ? providedSeed 
        : Math.floor(Math.random() * 1000000);
    vsGameState.currentSeed = seed;
    
    const seededRandom = mulberry32(seed);
    
    // Initialize Wall (136 tiles, no flowers)
    vsGameState.wall = createDeck();
    
    // Seeded Shuffle
    for (let i = vsGameState.wall.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [vsGameState.wall[i], vsGameState.wall[j]] = [vsGameState.wall[j], vsGameState.wall[i]];
    }

    // Deal 16 tiles each
    vsGameState.player = {
        closed: sortHand(vsGameState.wall.splice(0, 16)),
        open: [],
        river: []
    };
    vsGameState.ai = {
        closed: sortHand(vsGameState.wall.splice(0, 16)),
        open: [],
        river: []
    };

    vsGameState.currentTurn = 'player';
    vsGameState.isGameOver = false;
    vsGameState.winner = null;
    vsGameState.trajectory = [];
    vsGameState.pendingAction = null;
    vsGameState.showAiHand = false;
    vsGameState.latestDiscard = null;
    vsGameState.historyStack = [];
    vsGameState.forbiddenDiscard = null;

    // Player draws the 17th tile to start
    const firstTile = vsGameState.wall.shift();
    vsGameState.player.closed.push(firstTile);
    vsGameState.trajectory.push({ actor: 'player', action: 'draw', tile: firstTile });

    renderVsArena();
    
    // Initial check for self-draw win (extremely rare but possible)
    if (isWinningHand(vsGameState.player.closed, vsGameState.player.open.length)) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'player';
        renderVsArena();
    }
}

function renderVsArena() {
    const appContainer = document.getElementById('app');
    const { player, ai, wall, currentTurn, isGameOver, winner, pendingAction, showAiHand, latestDiscard } = vsGameState;

    const renderRiver = (river, owner) => river.map((t, idx) => {
        const isLatest = latestDiscard && latestDiscard.owner === owner && latestDiscard.index === idx;
        const size = isLatest ? 'sm' : 'xs';
        const extraClasses = isLatest ? 'ring-2 ring-blue-500 shadow-md transform -translate-y-1' : 'opacity-80';
        return renderTile(t, { size, extraClasses });
    }).join('');

    const renderOpenMelds = (melds, isAi = false) => melds.map(meld => {
        const isAnkan = !Array.isArray(meld) && meld.isClosed;
        const tiles = Array.isArray(meld) ? meld : meld.tiles;
        // Reveal if it's not Ankan, or if it IS Ankan but showAiHand or isGameOver is true
        const shouldShow = !isAnkan || !isAi || showAiHand || isGameOver;
        return `
            <div class="flex border border-gray-200 rounded p-0.5 bg-gray-50 sm:w-auto w-[calc(50%-0.25rem)] justify-center gap-0.5">
                ${tiles.map(t => renderTile(t, { size: 'xs', faceDown: !shouldShow })).join('')}
            </div>
        `;
    }).join('');

    const isAiTenpai = calculateShanten(ai.closed, ai.open.length) === 0;
    
    // Check for player's self-actions (Ankan/Kakan) during their turn
    let turnActions = [];
    if (currentTurn === 'player' && !isGameOver && !pendingAction && player.closed.length % 3 === 2) {
        const kanOpts = getClosedKanOptions(player.closed, player.open);
        if (kanOpts.length > 0) {
            turnActions.push({ type: 'kan_self', label: '槓', options: kanOpts });
        }
    }

    appContainer.innerHTML = `
        <!-- AI Action Notification (Phone Style) -->
        ${vsGameState.aiActionMessage ? `
            <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slide-down">
                <div class="bg-gray-900/90 backdrop-blur text-white px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 ring-4 ring-black/5">
                    <div class="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">AI</div>
                    <span class="font-bold tracking-wider text-sm">${vsGameState.aiActionMessage}</span>
                </div>
            </div>
        ` : ''}

        <div class="flex flex-col items-center justify-start h-full max-w-4xl mx-auto mt-2 px-2 pb-10">
            <!-- Header -->
            <div class="w-full flex justify-between items-center mb-3">
                <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h.01M15 9h.01M8 13h8" />
                    </svg>
                    AI對戰練習
                </h2>
                <div class="flex items-center gap-2">
                    <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                        Wall: ${wall.length}
                    </div>
                    <button id="vs-rollback-btn" class="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-100 flex items-center gap-1 px-2 py-1.5 rounded transition disabled:opacity-30 disabled:cursor-not-allowed" title="Rollback Move (悔棋)" ${vsGameState.historyStack.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span class="hidden sm:inline">Undo</span>
                    </button>
                    <button id="vs-seed-btn" class="text-xs font-medium text-purple-600 hover:text-purple-800 bg-purple-50 border border-purple-100 flex items-center gap-1 px-2 py-1.5 rounded transition" title="Match Seed">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m0 0a2 2 0 01-2 2m0-4a2 2 0 01-2-2m0 0a2 2 0 012-2m0 4v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2M9 5a2 2 0 114 0" />
                        </svg>
                        <span class="hidden sm:inline">Seed: ${vsGameState.currentSeed}</span>
                    </button>
                    <button id="vs-settings-btn" class="text-xs font-medium text-orange-600 hover:text-orange-800 bg-orange-50 border border-orange-100 flex items-center gap-1 px-2 py-1.5 rounded transition" title="Settings">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span class="hidden sm:inline">Settings</span>
                    </button>
                    <button id="vs-back-btn" class="text-xs font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1 bg-gray-100 px-2 py-1.5 rounded transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span class="hidden sm:inline">Back</span>
                    </button>
                </div>
            </div>

            <!-- AI Area -->
            <div class="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-2">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex flex-col gap-1.5">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-[10px] font-bold">AI</div>
                            ${currentGameState.showAiTenpai && isAiTenpai ? '<span class="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse shadow-sm">聽牌</span>' : ''}
                        </div>
                        <div class="flex flex-wrap gap-1 min-h-[24px] max-w-full" id="ai-open-melds">
                            ${renderOpenMelds(ai.open, true)}
                        </div>
                    </div>
                    
                    <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div class="flex items-center gap-2">
                            <button id="toggle-ai-hand-btn" class="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition whitespace-nowrap">
                                ${showAiHand ? 'Hide Hand' : 'Show Hand'}
                            </button>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">${ai.closed.length} Tiles</span>
                        </div>
                    </div>
                </div>
                <!-- AI Hand -->
                <div class="flex flex-wrap gap-0.5 sm:gap-1 justify-center mb-2" id="ai-hand-container">
                    ${ai.closed.map(t => renderTile(t, { size: 'xs', faceDown: !showAiHand && !isGameOver })).join('')}
                </div>
                <!-- AI River -->
                <div class="flex flex-wrap gap-1 min-h-[40px] bg-gray-50 rounded-lg p-2 justify-start items-end">
                    ${renderRiver(ai.river, 'ai')}
                </div>
            </div>

            <!-- Action Center -->
            <div class="w-full flex flex-col items-center justify-center py-4 relative min-h-[60px]">
                <div id="vs-action-buttons" class="flex gap-2">
                    ${pendingAction ? `
                        ${pendingAction.actions.map(action => `
                            <button class="vs-action-btn bg-mj-green hover:bg-emerald-600 text-white font-black px-5 py-2 rounded-lg shadow-md transition active:scale-95" data-type="${action.type}">
                                ${action.label}
                            </button>
                        `).join('')}
                        <button id="vs-skip-btn" class="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-5 py-2 rounded-lg shadow-sm transition active:scale-95">
                            Skip
                        </button>
                    ` : ''}
                    
                    ${turnActions.length > 0 ? `
                        ${turnActions.map(action => `
                            <button class="vs-turn-action-btn bg-orange-500 hover:bg-orange-600 text-white font-black px-5 py-2 rounded-lg shadow-md transition active:scale-95" data-type="${action.type}">
                                ${action.label}
                            </button>
                        `).join('')}
                    ` : ''}
                </div>

                ${isGameOver ? `
                    <div class="flex flex-col items-center">
                        <div class="bg-yellow-400 text-white font-black px-6 py-2 rounded-full shadow-lg animate-bounce mt-2">
                            ${winner === 'player' ? 'YOU WIN!' : (winner === 'ai' ? 'AI WINS!' : 'DRAW (流局)')}
                        </div>
                        <button id="vs-restart-btn" class="mt-4 bg-mj-green text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-emerald-600 transition">
                            Play Again
                        </button>
                    </div>
                ` : ''}
            </div>

            <!-- Player River -->
            <div class="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-2">
                <div class="flex flex-wrap gap-1 min-h-[40px] bg-gray-50 rounded-lg p-2 justify-start items-start">
                    ${renderRiver(player.river, 'player')}
                </div>
            </div>

            <!-- Player Area -->
            <div class="w-full bg-white rounded-xl shadow-md border-t-4 border-orange-500 p-3">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex flex-wrap gap-1 max-w-[70%]" id="player-open-melds">
                        ${renderOpenMelds(player.open)}
                    </div>
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex-shrink-0">Your Hand</span>
                </div>
                <div class="flex flex-wrap gap-0.5 sm:gap-1 justify-center" id="vs-hand-container">
                    ${player.closed.map((t, i) => renderTile(t, { 
                        size: 'sm', 
                        id: `vs-tile-${i}`,
                        extraClasses: currentTurn === 'player' && !isGameOver && !pendingAction ? 'hover:-translate-y-2 cursor-pointer transition-transform' : 'opacity-50 cursor-default'
                    })).join('')}
                </div>
            </div>
        </div>
    `;

    document.getElementById('vs-back-btn').addEventListener('click', () => {
        if (confirm('Exit the current game?')) initApp();
    });

    const vsSettingsBtn = document.getElementById('vs-settings-btn');
    if (vsSettingsBtn) {
        vsSettingsBtn.addEventListener('click', () => {
            showSettingsModal('AI對戰練習', false, true, false);
        });
    }

    const vsRollbackBtn = document.getElementById('vs-rollback-btn');
    if (vsRollbackBtn) {
        vsRollbackBtn.addEventListener('click', () => {
            rollbackVsMove();
        });
    }

    const vsSeedBtn = document.getElementById('vs-seed-btn');
    if (vsSeedBtn) {
        vsSeedBtn.addEventListener('click', () => {
            showSeedModal();
        });
    }
    
    document.getElementById('toggle-ai-hand-btn').addEventListener('click', () => {
        vsGameState.showAiHand = !vsGameState.showAiHand;
        renderVsArena();
    });

    if (isGameOver && document.getElementById('vs-restart-btn')) {
        document.getElementById('vs-restart-btn').addEventListener('click', () => startVsMode());
    }

    // Action Center Button Handlers
    if (pendingAction) {
        document.getElementById('vs-skip-btn').addEventListener('click', () => {
            vsGameState.pendingAction = null;
            vsPlayerDraw();
        });

        document.querySelectorAll('.vs-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                handleVsAction(type);
            });
        });
    }

    // --- ADDED: Turn Actions (Ankan/Kakan) ---
    document.querySelectorAll('.vs-turn-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            if (type === 'kan_self') {
                const kanOpts = getClosedKanOptions(player.closed, player.open);
                if (kanOpts.length === 1) {
                    executeKanSelf(kanOpts[0]);
                } else if (kanOpts.length > 1) {
                    showKanModal(kanOpts);
                }
            }
        });
    });

    if (currentTurn === 'player' && !isGameOver && !pendingAction) {
        player.closed.forEach((t, i) => {
            const el = document.getElementById(`vs-tile-${i}`);
            if (el) {
                el.addEventListener('click', () => {
                    vsPlayerDiscard(i);
                });
            }
        });
    }
}


function handleVsAction(type) {
    const { pendingAction } = vsGameState;
    const tile = pendingAction.tile;

    saveVsSnapshot();

    if (type === 'ron') {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'player';
        vsGameState.player.closed.push(tile);
        vsGameState.trajectory.push({ actor: 'player', action: 'ron', tile });
        vsGameState.pendingAction = null;
        renderVsArena();
    } else if (type === 'pon') {
        // Remove 2 tiles from hand
        vsGameState.player.closed.splice(vsGameState.player.closed.indexOf(tile), 1);
        vsGameState.player.closed.splice(vsGameState.player.closed.indexOf(tile), 1);
        vsGameState.player.open.push([tile, tile, tile]);
        vsGameState.trajectory.push({ actor: 'player', action: 'pon', tile });
        vsGameState.pendingAction = null;
        vsGameState.currentTurn = 'player';
        vsGameState.forbiddenDiscard = tile; // Cannot discard the tile just Poned
        renderVsArena();
        // Player must discard now
    } else if (type === 'chi') {
        const action = pendingAction.actions.find(a => a.type === 'chi');
        if (action.options.length === 1) {
            executeChi(action.options[0], tile);
        } else {
            showChiModal(action.options, tile);
        }
    } else if (type === 'kan') {
        // --- ADDED: Open Kan (Daiminkan) ---
        vsGameState.player.closed = vsGameState.player.closed.filter(t => t !== tile);
        vsGameState.player.open.push([tile, tile, tile, tile]);
        vsGameState.trajectory.push({ actor: 'player', action: 'kan', tile });
        vsGameState.pendingAction = null;
        vsGameState.currentTurn = 'player';
        vsDrawReplacement('player');
    }
}

function showChiModal(options, tile) {
    let modalEl = document.getElementById('chi-modal-root');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'chi-modal-root';
        document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div class="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl">
                <h3 class="font-bold text-gray-800 mb-4 text-center">Choose Chi Combination</h3>
                <div class="flex flex-col gap-3">
                    ${options.map((opt, i) => `
                        <button class="chi-opt-btn flex items-center justify-center gap-2 p-3 border-2 border-gray-100 rounded-xl hover:border-mj-green hover:bg-emerald-50 transition" data-index="${i}">
                            ${renderTile(opt[0], { size: 'xs' })}
                            ${renderTile(tile, { size: 'xs', extraClasses: 'ring-2 ring-mj-green' })}
                            ${renderTile(opt[1], { size: 'xs' })}
                        </button>
                    `).join('')}
                </div>
                <button id="close-chi-modal" class="w-full mt-4 text-gray-500 font-bold py-2">Cancel</button>
            </div>
        </div>
    `;

    document.querySelectorAll('.chi-opt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            modalEl.innerHTML = '';
            executeChi(options[index], tile);
        });
    });

    document.getElementById('close-chi-modal').addEventListener('click', () => {
        modalEl.innerHTML = '';
    });
}

function executeChi(opt, tile) {
    vsGameState.player.closed.splice(vsGameState.player.closed.indexOf(opt[0]), 1);
    vsGameState.player.closed.splice(vsGameState.player.closed.indexOf(opt[1]), 1);
    vsGameState.player.open.push(sortHand([...opt, tile]));
    vsGameState.trajectory.push({ actor: 'player', action: 'chi', tile });
    vsGameState.pendingAction = null;
    vsGameState.currentTurn = 'player';
    renderVsArena();
}

function vsPlayerDiscard(index) {
    if (vsGameState.currentTurn !== 'player' || vsGameState.pendingAction) return;

    saveVsSnapshot();

    const tile = vsGameState.player.closed.splice(index, 1)[0];
    vsGameState.player.river.push(tile);
    vsGameState.latestDiscard = { owner: 'player', index: vsGameState.player.river.length - 1 };
    vsGameState.player.closed = sortHand(vsGameState.player.closed);
    vsGameState.trajectory.push({ actor: 'player', action: 'discard', tile: tile });

    // Check if AI can steal
    if (checkAiInterrupt(tile)) return;

    vsGameState.currentTurn = 'ai';
    renderVsArena();

    // Check if Wall is empty
    if (vsGameState.wall.length === 0) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'draw';
        renderVsArena();
        return;
    }

    // Trigger AI Turn
    setTimeout(vsAiTurn, 1000);
}

function checkAiInterrupt(tile) {
    // 1. Check AI Ron (Always Ron if possible, regardless of style)
    if (isWinningHand([...vsGameState.ai.closed, tile], vsGameState.ai.open.length)) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'ai';
        vsGameState.ai.closed.push(tile);
        vsGameState.trajectory.push({ actor: 'ai', action: 'ron', tile: tile });
        showAiActionBubble('食');
        renderVsArena();
        return true;
    }

    if (currentGameState.aiStyle === 'defensive') {
        return false; // Defensive style NEVER calls Chi or Pon
    }

    // AI logic for Pon/Chi/Kan
    const currentAnalysis = getDiscardAnalysis(vsGameState.ai.closed, vsGameState.ai.open.length);
    const currentShanten = currentAnalysis.length > 0 ? currentAnalysis[0].shanten : calculateShanten(vsGameState.ai.closed, vsGameState.ai.open.length);

    // Helper to evaluate if a call is worth it based on style
    const evaluateCall = (tempHand, nextOpenCount) => {
        const nextAnalysis = getDiscardAnalysis(tempHand, nextOpenCount);
        if (nextAnalysis.length === 0) return false;
        
        const nextShanten = nextAnalysis[0].shanten;

        if (currentGameState.aiStyle === 'aggressive') {
            return nextShanten <= currentShanten;
        } else {
            return nextShanten < currentShanten;
        }
    };

    // 2. Check AI Kan (Open)
    const kanOption = getKanOptions(vsGameState.ai.closed, tile);
    if (kanOption) {
        const tempHand = vsGameState.ai.closed.filter(t => t !== tile);
        if (evaluateCall(tempHand, vsGameState.ai.open.length + 1)) {
            vsGameState.ai.closed = sortHand(tempHand);
            vsGameState.ai.open.push([tile, tile, tile, tile]);
            vsGameState.trajectory.push({ actor: 'ai', action: 'kan', tile: tile });
            vsGameState.latestDiscard = null;
            vsGameState.currentTurn = 'ai';
            vsDrawReplacement('ai');
            return true;
        }
    }

    // 3. Check AI Pon
    const ponOption = getPonOptions(vsGameState.ai.closed, tile);
    if (ponOption) {
        const tempHand = [...vsGameState.ai.closed];
        tempHand.splice(tempHand.indexOf(tile), 1);
        tempHand.splice(tempHand.indexOf(tile), 1);
        
        if (evaluateCall(tempHand, vsGameState.ai.open.length + 1)) {
            // AI Ponds
            vsGameState.ai.closed = sortHand(tempHand);
            vsGameState.ai.open.push([tile, tile, tile]);
            vsGameState.trajectory.push({ actor: 'ai', action: 'pon', tile: tile });
            vsGameState.latestDiscard = null; // Clear latest discard since it was stolen
            vsGameState.currentTurn = 'ai';
            vsGameState.forbiddenDiscard = tile; // Rule: Cannot discard stolen tile same turn
            showAiActionBubble('碰');
            renderVsArena(); // Show the new meld immediately
            vsAiDiscard(); // AI must discard after stealing
            return true;
        }
    }

    // 4. Check AI Chi (only because it's 1v1 and AI is always next)
    const chiOptions = getChiOptions(vsGameState.ai.closed, tile);
    for (let opt of chiOptions) {
        const tempHand = [...vsGameState.ai.closed];
        tempHand.splice(tempHand.indexOf(opt[0]), 1);
        tempHand.splice(tempHand.indexOf(opt[1]), 1);
        
        if (evaluateCall(tempHand, vsGameState.ai.open.length + 1)) {
            // AI Chis
            vsGameState.ai.closed = sortHand(tempHand);
            vsGameState.ai.open.push(sortHand([...opt, tile]));
            vsGameState.trajectory.push({ actor: 'ai', action: 'chi', tile: tile });
            vsGameState.latestDiscard = null; // Clear latest discard since it was stolen
            vsGameState.currentTurn = 'ai';
            vsGameState.forbiddenDiscard = tile; // Rule: Cannot discard stolen tile same turn
            showAiActionBubble('上');
            renderVsArena(); // Show the new meld immediately
            vsAiDiscard();
            return true;
        }
    }

    return false;
}

function checkPlayerInterrupt(tile) {
    const actions = [];

    // 1. Check Ron
    if (isWinningHand([...vsGameState.player.closed, tile], vsGameState.player.open.length)) {
        actions.push({ type: 'ron', label: '食', tile });
    }

    // 2. Check Kan (Open)
    if (getKanOptions(vsGameState.player.closed, tile)) {
        actions.push({ type: 'kan', label: '槓', tile });
    }

    // 3. Check Pon
    if (getPonOptions(vsGameState.player.closed, tile)) {
        actions.push({ type: 'pon', label: '碰', tile });
    }

    // 4. Check Chi
    const chiOptions = getChiOptions(vsGameState.player.closed, tile);
    if (chiOptions.length > 0) {
        actions.push({ type: 'chi', label: '上', tile, options: chiOptions });
    }

    if (actions.length > 0) {
        vsGameState.pendingAction = { actions, tile };
        renderVsArena();
        return true;
    }
    return false;
}

/**
 * Internal helper for AI to run a quick MC simulation on a candidate discard.
 * Returns a Promise that resolves to the win rate.
 */
function runMCEvaluation(hand, discard, runs, maxDraws, includeHonors) {
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
            policy: 'greedy' 
        });
    });
}

async function vsAiDiscard() {
    // Artificial delay for realism
    await new Promise(r => setTimeout(r, 1000));

    // Rule: AI cannot discard the tile it just called (forbiddenDiscard)
    const allowedClosedHand = vsGameState.ai.closed.filter(t => t !== vsGameState.forbiddenDiscard);
    const analysis = getDiscardAnalysis(vsGameState.ai.closed, vsGameState.ai.open.length)
        .filter(a => a.discard !== vsGameState.forbiddenDiscard);
    
    // reset forbidden discard after it has been used to filter this turn
    vsGameState.forbiddenDiscard = null;

    if (analysis.length === 0 && allowedClosedHand.length === 0) {
        // Fallback in case every single tile is somehow forbidden (should be impossible in Mahjong)
        const fallbackMove = vsGameState.ai.closed[0];
        executeAiDiscard(fallbackMove);
        return;
    }

    let bestMove;
    const handSizeAfterDiscard = vsGameState.ai.closed.length - 1;

    if (currentGameState.aiDifficulty === 'expert' && (handSizeAfterDiscard === 8 || handSizeAfterDiscard <= 5)) {
        // --- Expert internal Monte Carlo logic ---
        const iterations = handSizeAfterDiscard === 8 ? 100 : 1000;
        const maxDraws = 3;
        
        // Consider only top 3 candidates from filtered analysis
        const candidates = analysis.slice(0, Math.min(3, analysis.length));
        
        if (candidates.length > 1) {
            // Evaluate each candidate in parallel
            const evaluations = await Promise.all(candidates.map(c => 
                runMCEvaluation(vsGameState.ai.closed, c.discard, iterations, maxDraws, true)
            ));
            
            // Find candidate with highest win rate
            let maxWinRate = -1;
            let bestCandidateIdx = 0;
            evaluations.forEach((rate, idx) => {
                if (rate > maxWinRate) {
                    maxWinRate = rate;
                    bestCandidateIdx = idx;
                }
            });
            bestMove = candidates[bestCandidateIdx].discard;
        } else {
            bestMove = candidates[0].discard;
        }
    } else if (currentGameState.aiDifficulty === 'random') {
        // Pick a completely random tile from ALLOWED hand
        bestMove = allowedClosedHand[Math.floor(Math.random() * allowedClosedHand.length)];
    } else if (currentGameState.aiDifficulty === 'beginner') {
        // Pick from the top 3 optimal discards (already filtered)
        const topMoves = analysis.slice(0, Math.min(3, analysis.length));
        bestMove = topMoves[Math.floor(Math.random() * topMoves.length)].discard;
    } else {
        // Expert (Standard): Always pick the absolute best move from DP (already filtered)
        bestMove = analysis[0].discard;
    }

    executeAiDiscard(bestMove);
}

function executeAiDiscard(bestMove) {
    const discardIndex = vsGameState.ai.closed.indexOf(bestMove);
    vsGameState.ai.closed.splice(discardIndex, 1);
    vsGameState.ai.river.push(bestMove);
    vsGameState.latestDiscard = { owner: 'ai', index: vsGameState.ai.river.length - 1 };
    vsGameState.ai.closed = sortHand(vsGameState.ai.closed);
    vsGameState.trajectory.push({ actor: 'ai', action: 'discard', tile: bestMove });

    // After AI discards, check if Player can steal
    if (checkPlayerInterrupt(bestMove)) return;

    // Transition back to Player draw
    vsPlayerDraw();
}

function vsPlayerDraw() {
    if (vsGameState.wall.length === 0) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'draw';
        renderVsArena();
        return;
    }

    vsGameState.currentTurn = 'player';
    const playerTile = vsGameState.wall.shift();
    vsGameState.player.closed.push(playerTile);
    vsGameState.trajectory.push({ actor: 'player', action: 'draw', tile: playerTile });

    if (isWinningHand(vsGameState.player.closed, vsGameState.player.open.length)) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'player';
    }
    renderVsArena();
}

function vsAiTurn() {
    if (vsGameState.isGameOver) return;

    // 1. Draw
    const tile = vsGameState.wall.shift();
    vsGameState.ai.closed.push(tile);
    vsGameState.trajectory.push({ actor: 'ai', action: 'draw', tile: tile });

    // 2. Check for AI win (Tsumo)
    if (isWinningHand(vsGameState.ai.closed, vsGameState.ai.open.length)) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'ai';
        showAiActionBubble('自摸');
        renderVsArena();
        return;
    }
    
    // 3. Check for AI Ankan/Kakan
    if (currentGameState.aiStyle !== 'defensive') {
        const kanOpts = getClosedKanOptions(vsGameState.ai.closed, vsGameState.ai.open);
        if (kanOpts.length > 0) {
            // Simple heuristic: always Kan if it doesn't increase Shanten
            const currentShanten = calculateShanten(vsGameState.ai.closed, vsGameState.ai.open.length);
            for (let opt of kanOpts) {
                let tempHand;
                if (opt.type === 'ankan') {
                    tempHand = vsGameState.ai.closed.filter(t => t !== opt.tile);
                } else {
                    tempHand = [...vsGameState.ai.closed];
                    tempHand.splice(tempHand.indexOf(opt.tile), 1);
                }
                
                if (calculateShanten(tempHand, vsGameState.ai.open.length + 1) <= currentShanten) {
                    if (opt.type === 'ankan') {
                        vsGameState.ai.closed = sortHand(tempHand);
                        vsGameState.ai.open.push({ tiles: [opt.tile, opt.tile, opt.tile, opt.tile], isClosed: true });
                    } else {
                        const meldIdx = vsGameState.ai.open.findIndex(m => !Array.isArray(m) ? (m.tiles[0] === opt.tile) : (m[0] === opt.tile && m.length === 3));
                        if (Array.isArray(vsGameState.ai.open[meldIdx])) {
                            vsGameState.ai.open[meldIdx].push(opt.tile);
                        } else {
                            vsGameState.ai.open[meldIdx].tiles.push(opt.tile);
                        }
                        vsGameState.ai.closed = sortHand(tempHand);
                    }
                    vsGameState.trajectory.push({ actor: 'ai', action: opt.type, tile: opt.tile });
                    vsDrawReplacement('ai');
                    return; // Replacement draw logic will handle next steps
                }
            }
        }
    }

    // 4. AI Discards
    vsAiDiscard();
}


function showSeedModal() {
    let modalEl = document.getElementById('seed-modal-root');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'seed-modal-root';
        document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div class="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-fade-in-up">
                <h3 class="font-bold text-gray-800 mb-2 text-center text-lg">Match Seed</h3>
                <p class="text-xs text-gray-500 mb-4 text-center">Enter a custom seed to replay a specific match.</p>
                
                <input type="number" id="seed-input" 
                    class="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-center font-mono text-xl focus:border-purple-500 focus:outline-none transition-colors mb-4"
                    placeholder="e.g. 123456" value="${vsGameState.currentSeed}">
                
                <div class="flex gap-2">
                    <button id="close-seed-modal" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition">
                        Cancel
                    </button>
                    <button id="apply-seed-btn" class="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-xl shadow-md transition active:scale-95">
                        Apply
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('close-seed-modal').addEventListener('click', () => {
        modalEl.innerHTML = '';
    });

    document.getElementById('apply-seed-btn').addEventListener('click', () => {
        const input = document.getElementById('seed-input');
        const val = parseInt(input.value);
        if (!isNaN(val)) {
            modalEl.innerHTML = '';
            startVsMode(val);
        } else {
            alert('Please enter a valid numeric seed.');
        }
    });
}

function rollbackVsMove() {
    if (vsGameState.historyStack.length === 0) return;
    
    // Restore the last snapshot
    const lastState = vsGameState.historyStack.pop();
    
    // Assign everything back
    vsGameState.wall = lastState.wall;
    vsGameState.player = lastState.player;
    vsGameState.ai = lastState.ai;
    vsGameState.currentTurn = lastState.currentTurn;
    vsGameState.pendingAction = lastState.pendingAction;
    vsGameState.trajectory = lastState.trajectory;
    vsGameState.isGameOver = lastState.isGameOver;
    vsGameState.winner = lastState.winner;
    vsGameState.showAiHand = lastState.showAiHand;
    vsGameState.latestDiscard = lastState.latestDiscard;
    vsGameState.currentSeed = lastState.currentSeed;
    
    renderVsArena();
}


function executeKanSelf(kan) {
    saveVsSnapshot();
    if (kan.type === 'ankan') {
        vsGameState.player.closed = vsGameState.player.closed.filter(t => t !== kan.tile);
        vsGameState.player.open.push({ tiles: [kan.tile, kan.tile, kan.tile, kan.tile], isClosed: true });
    } else {
        // Kakan
        const meldIndex = vsGameState.player.open.findIndex(m => !Array.isArray(m) ? (m.tiles[0] === kan.tile) : (m[0] === kan.tile && m.length === 3));
        if (Array.isArray(vsGameState.player.open[meldIndex])) {
            vsGameState.player.open[meldIndex].push(kan.tile);
        } else {
            vsGameState.player.open[meldIndex].tiles.push(kan.tile);
        }
        vsGameState.player.closed.splice(vsGameState.player.closed.indexOf(kan.tile), 1);
    }
    vsGameState.trajectory.push({ actor: 'player', action: kan.type, tile: kan.tile });
    vsDrawReplacement('player');
}

function vsDrawReplacement(actor) {
    if (vsGameState.wall.length === 0) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'draw';
        renderVsArena();
        return;
    }
    
    const tile = vsGameState.wall.shift();
    vsGameState[actor].closed.push(tile);
    vsGameState.trajectory.push({ actor, action: 'draw_replacement', tile });
    
    if (actor === 'ai') {
        showAiActionBubble('槓');
    }
    
    if (isWinningHand(vsGameState[actor].closed, vsGameState[actor].open.length)) {
        vsGameState.isGameOver = true;
        vsGameState.winner = actor;
        showAiActionBubble('自摸');
    }
    
    renderVsArena();
}

function showKanModal(options) {
    let modalEl = document.getElementById('chi-modal-root'); // Reuse chi modal root
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'chi-modal-root';
        document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div class="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-fade-in-up">
                <h3 class="font-bold text-gray-800 mb-4 text-center">Choose Kan Type</h3>
                <div class="flex flex-col gap-3">
                    ${options.map((opt, i) => `
                        <button class="kan-opt-btn flex items-center justify-center gap-2 p-3 border-2 border-gray-100 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition" data-index="${i}">
                            ${renderTile(opt.tile, { size: 'xs' })}
                            <span class="text-xs font-bold text-gray-600">${opt.type === 'ankan' ? '暗槓' : '加槓'}</span>
                        </button>
                    `).join('')}
                </div>
                <button id="close-kan-modal" class="w-full mt-4 text-gray-500 font-bold py-2">Cancel</button>
            </div>
        </div>
    `;

    document.querySelectorAll('.kan-opt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            modalEl.innerHTML = '';
            executeKanSelf(options[index]);
        });
    });

    document.getElementById('close-kan-modal').addEventListener('click', () => {
        modalEl.innerHTML = '';
    });
}

