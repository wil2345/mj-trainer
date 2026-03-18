import { currentGameState } from '../state.js';
import { renderTile } from '../components/Tile.js';

export function getMCLoaderHtml(runs, draws) {
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


export function getMCResultsHtml(stats) {
    const { winRate, tenpaiRate, avgDraws, runs: doneRuns, maxDraws: doneMax, topFinalHands } = stats;
    
    const finalHandsHtml = topFinalHands.length > 0 ? topFinalHands.map((item, idx) => {
        let shantenBadge = '';
        if (item.shanten === -1) {
            shantenBadge = '<span class="bg-yellow-400 text-white text-[11px] font-black px-2 py-1 rounded shadow-sm whitespace-nowrap">胡牌</span>';
        } else if (item.shanten === 0) {
            shantenBadge = '<span class="bg-red-500 text-white text-[11px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">叫糊</span>';
        } else {
            shantenBadge = `<span class="bg-gray-400 text-white text-[11px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">${item.shanten}向聽</span>`;
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


export function runMonteCarlo(hand, discard, totalRuns, maxDraws, includeHonors, deadTiles = []) {
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
                
                runMonteCarlo(hand, discard, totalRuns, maxDraws, includeHonors, deadTiles);
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
