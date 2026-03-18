// history.js
import { currentGameState, vsGameState } from '../state.js';
import { loadStats } from '../storage.js';
import { renderTile } from '../components/Tile.js';
import { TILE_NAMES } from '../constants.js';
import { initApp } from '../app.js';
import { startTrainingSession } from '../modes/training.js';
import { initReplayMode } from '../modes/replay.js';

export function renderHistoryScene(activeTab = 'arena') {
    currentGameState.mode = 'History';
    const appContainer = document.getElementById('app');
    const stats = loadStats();
    const history = stats.history || [];
    const matches = stats.matches || [];

    let listHtml = '';

    if (activeTab === 'training') {
        listHtml = history.length === 0 
            ? `<div class="flex flex-col items-center justify-center h-48 text-gray-400">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 <p>No training history yet.</p>
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

                        <div class="flex-shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors pl-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </div>
                `;
            }).join('');
    } else {
        listHtml = matches.length === 0 
            ? `<div class="flex flex-col items-center justify-center h-48 text-gray-400">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 <p>No AI matches played yet.</p>
               </div>`
            : matches.map((record, index) => {
                const isPlayerWin = record.winner === 'player';
                const isDraw = record.winner === 'draw';
                const totalTurns = record.trajectory.filter(t => t.action === 'discard').length;
                
                return `
                    <div class="match-card bg-white p-4 rounded-xl shadow-md border border-gray-200 flex flex-col gap-2 relative cursor-pointer hover:border-orange-400 hover:shadow-lg transition group" data-index="${index}">
                        <div class="flex justify-between items-center border-b border-gray-50 pb-2">
                            <div class="flex items-center gap-2">
                                <span class="bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded text-xs shadow-sm">Seed: ${record.seed}</span>
                            </div>
                            <span class="text-xs font-medium text-gray-500">${new Date(record.timestamp).toLocaleDateString()} ${new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div class="flex justify-between items-center mt-1">
                            <div class="flex items-center gap-2">
                                <span class="${isPlayerWin ? 'bg-mj-green' : (isDraw ? 'bg-gray-400' : 'bg-mj-red')} text-white text-[11px] font-black px-2.5 py-1 rounded shadow-sm">
                                    ${isPlayerWin ? '🏆 YOU WON' : (isDraw ? '🤝 DRAW' : '💀 AI WON')}
                                </span>
                                <span class="text-xs text-gray-500 font-bold ml-1">${totalTurns} turns</span>
                            </div>
                            <div class="text-gray-400 group-hover:text-orange-500 font-bold text-xs flex items-center gap-1 transition-colors">
                                Review <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
    }

    appContainer.innerHTML = `
        <div class="flex flex-col h-full max-w-4xl mx-auto mt-2 px-2 w-full">
            <div class="w-full flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    History
                </h2>
                <button id="back-btn" class="text-xs font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span class="hidden sm:inline">Back</span>
                </button>
            </div>

            <!-- Tabs -->
            <div class="flex gap-2 mb-4 bg-gray-200/50 p-1 rounded-xl w-full">
                <button id="tab-training" class="flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'training' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}">
                    Training
                </button>
                <button id="tab-arena" class="flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'arena' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}">
                    AI Arena
                </button>
            </div>
            
            <div id="history-scroll-container" class="flex flex-col gap-3 pb-8 overflow-y-auto" style="max-height: calc(100vh - 160px);">
                ${listHtml}
            </div>
        </div>
    `;

    document.getElementById('back-btn').addEventListener('click', initApp);

    document.getElementById('tab-training').addEventListener('click', () => {
        if (activeTab !== 'training') renderHistoryScene('training');
    });

    document.getElementById('tab-arena').addEventListener('click', () => {
        if (activeTab !== 'arena') renderHistoryScene('arena');
    });

    if (activeTab === 'training') {
        document.querySelectorAll('.history-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                const record = history[index];
                if (record) {
                    currentGameState.reviewingHistoryIndex = index;
                    currentGameState.hand = [...record.hand];
                    currentGameState.selectedHandSize = record.hand.length;
                    currentGameState.mcCache = {}; 
                    currentGameState.enableMC = false; 
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
    } else {
        // AI Matches
        document.querySelectorAll('.match-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                const record = matches[index];
                if (record) {
                    // Load the game into replay mode directly
                    vsGameState.currentSeed = record.seed;
                    vsGameState.trajectory = record.trajectory;
                    vsGameState.winner = record.winner;
                    initReplayMode();
                }
            });
        });
    }
}
