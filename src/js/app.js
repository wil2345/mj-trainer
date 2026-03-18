// app.js
// Main entry point for the Taiwan Mahjong Trainer application

import { loadStats, getAccuracy, clearStats, getAverageTime } from './storage.js';
import { sortHand } from './engine/handGenerator.js';
import { currentGameState } from './state.js';
import { renderHistoryScene } from './ui/history.js';
import { showSettingsModal } from './ui/settings.js';
import { startTrainingSession } from './modes/training.js';


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

export function initApp() {
    currentGameState.isResolved = false;
    currentGameState.isEditing = false;
    const appContainer = document.getElementById('app');
    
    const stats = loadStats();
    
    // --- Training Stats ---
    const accuracy = getAccuracy();
    const streakDisplay = stats.totalDecisions === 0 ? '-' : stats.maxStreak;
    const currentStreakDisplay = stats.totalDecisions === 0 ? '-' : stats.currentStreak;
    const testsDoneDisplay = stats.totalDecisions === 0 ? '-' : stats.totalDecisions;

    // --- AI Arena Stats ---
    const matches = stats.matches || [];
    const arenaGames = matches.length;
    let playerWins = 0;
    let dealIns = 0;

    matches.forEach(m => {
        if (m.winner === 'player') {
            playerWins++;
        } else if (m.winner === 'ai') {
            // Check if it was a deal-in (AI ron)
            const aiActions = m.trajectory.filter(t => t.actor === 'ai');
            const lastAiAction = aiActions[aiActions.length - 1];
            if (lastAiAction && lastAiAction.action === 'ron') {
                dealIns++;
            }
        }
    });

    const winRate = arenaGames > 0 ? ((playerWins / arenaGames) * 100).toFixed(1) + '%' : '-';
    const dealInRate = arenaGames > 0 ? ((dealIns / arenaGames) * 100).toFixed(1) + '%' : '-';
    
    const getWinRateColor = (rateStr) => {
        if (rateStr === '-') return 'text-gray-400';
        const val = parseFloat(rateStr);
        if (val >= 50) return 'text-mj-green';
        if (val < 30) return 'text-red-500';
        return 'text-blue-500';
    };
    
    const getDealInColor = (rateStr) => {
        if (rateStr === '-') return 'text-gray-400';
        const val = parseFloat(rateStr);
        if (val > 20) return 'text-red-500';
        if (val <= 10) return 'text-mj-green';
        return 'text-orange-500';
    };

    // Render the initial dashboard view
    appContainer.innerHTML = `
        <div class="max-w-lg mx-auto mt-6 flex flex-col gap-6 px-2 mb-10">
            
            <div class="flex flex-col items-center">
                <div class="flex items-center gap-2 mb-1">
                    <h2 class="text-2xl font-bold text-gray-800 text-center tracking-tight">Taiwan Mahjong Trainer</h2>
                    <span class="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">v1.8.1</span>
                </div>
                <p class="text-gray-500 text-xs font-medium">Master your efficiency & intuition</p>
            </div>
            
            <!-- Statistics Section -->
            <div class="flex flex-col gap-3 w-full">
                
                <!-- Training Mode Stats -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-colors">
                    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Training Stats
                    </h3>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-gray-50 rounded-lg p-2 sm:p-3 text-center border border-gray-100 flex flex-col items-center justify-center">
                            <p class="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Accuracy</p>
                            <p class="text-xl sm:text-2xl font-black ${getAccuracyColor(accuracy)}" id="dash-accuracy">${accuracy}</p>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-2 sm:p-3 text-center border border-gray-100 flex flex-col items-center justify-center">
                            <p class="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5 whitespace-nowrap">Tests Done</p>
                            <p class="text-xl sm:text-2xl font-black text-gray-700" id="dash-tests-done">${testsDoneDisplay}</p>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-2 sm:p-3 text-center border border-gray-100 flex flex-col items-center justify-center">
                            <p class="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5 whitespace-nowrap">Cur/Max Streak</p>
                            <p class="text-lg font-black text-gray-700">
                                <span class="${getStreakColor(currentStreakDisplay)}">${currentStreakDisplay}</span> <span class="text-xs text-gray-400">/</span> <span class="${getStreakColor(streakDisplay)} text-sm">${streakDisplay}</span>
                            </p>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-2 sm:p-3 text-center border border-gray-100 flex flex-col items-center justify-center">
                            <p class="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5 whitespace-nowrap">Avg Time</p>
                            <p class="text-lg font-black text-gray-700" id="dash-avg-time">${getAverageTime()}</p>
                        </div>
                    </div>
                </div>

                <!-- AI Arena Stats -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-colors">
                    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h.01M15 9h.01M8 13h8" /></svg>
                        AI Arena Stats
                    </h3>
                    <div class="grid grid-cols-3 gap-2">
                        <div class="bg-gray-50 rounded-lg p-2 sm:p-3 text-center border border-gray-100 flex flex-col items-center justify-center">
                            <p class="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Win Rate</p>
                            <p class="text-lg font-black ${getWinRateColor(winRate)}">${winRate}</p>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-2 sm:p-3 text-center border border-gray-100 flex flex-col items-center justify-center">
                            <p class="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5 whitespace-nowrap">Deal-in (出銃)</p>
                            <p class="text-lg font-black ${getDealInColor(dealInRate)}">${dealInRate}</p>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-2 sm:p-3 text-center border border-gray-100 flex flex-col items-center justify-center">
                            <p class="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5 whitespace-nowrap">Matches</p>
                            <p class="text-lg font-black text-gray-700">${arenaGames}</p>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Game Modes Section -->
            <div class="flex flex-col gap-3 mt-2">
                <h3 class="text-sm font-bold text-gray-400 px-1 uppercase tracking-widest">Select Mode</h3>
                
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
        showSettingsModal('AI對戰練習', false, false);
    });
}

