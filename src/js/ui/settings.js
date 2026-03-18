import { currentGameState, vsGameState } from '../state.js';
import { startVsMode, renderVsArena } from '../modes/arena.js';
import { startTrainingSession } from '../modes/training.js';

export function showSettingsModal(modeName, isCalculator, isUpdate, isMCMode = false) {
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
    let tempAiSpeedMode = currentGameState.aiSpeedMode || false;
    let tempSeed = isVsMode ? (vsGameState.currentSeed || '') : '';

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
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Match Seed</p>
                        <div class="relative mb-4">
                            <input type="number" id="settings-seed-input" step="1"
                                class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-mono focus:border-orange-500 focus:outline-none transition-colors pr-10"
                                placeholder="Leave blank for random" value="${tempSeed}">
                            <button id="settings-copy-seed-btn" class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-orange-500 transition" title="Copy Seed">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                            </button>
                        </div>

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
                            <div id="modal-ai-tenpai-toggle-wrapper" class="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer select-none mt-1">
                                <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">顯示AI叫糊狀態</span>
                                <div class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tempShowAiTenpai ? activeColorClass : 'bg-gray-200 dark:bg-gray-600'}">
                                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tempShowAiTenpai ? 'translate-x-6' : 'translate-x-1'}"></span>
                                </div>
                            </div>
                            <div id="modal-ai-speed-toggle-wrapper" class="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer select-none mt-1">
                                <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">極速AI模式</span>
                                <div class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tempAiSpeedMode ? activeColorClass : 'bg-gray-200 dark:bg-gray-600'}">
                                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tempAiSpeedMode ? 'translate-x-6' : 'translate-x-1'}"></span>
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

    if (isVsMode) {
        const copySeedBtn = document.getElementById('settings-copy-seed-btn');
        if (copySeedBtn) {
            copySeedBtn.addEventListener('click', () => {
                const input = document.getElementById('settings-seed-input');
                navigator.clipboard.writeText(input.value).then(() => {
                    const originalHtml = copySeedBtn.innerHTML;
                    copySeedBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>';
                    setTimeout(() => copySeedBtn.innerHTML = originalHtml, 2000);
                });
            });
        }
    }

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

    const aiSpeedWrapper = document.getElementById('modal-ai-speed-toggle-wrapper');
    if (aiSpeedWrapper) {
        aiSpeedWrapper.addEventListener('click', () => {
            tempAiSpeedMode = !tempAiSpeedMode;
            updateToggleUI('modal-ai-speed-toggle-wrapper', tempAiSpeedMode);
        });
    }

    const mcPolicySelect = document.getElementById('mc-policy-select');

    const mcDrawsSelect = document.getElementById('mc-draws-select');
    const mcRunsSelect = document.getElementById('mc-runs-select');

    document.getElementById('apply-settings').addEventListener('click', () => {
        if (isVsMode) {
            const seedInput = document.getElementById('settings-seed-input');
            const parsedSeed = seedInput ? parseInt(seedInput.value) : NaN;

            currentGameState.aiDifficulty = tempAiDifficulty;
            currentGameState.aiStyle = tempAiStyle;
            currentGameState.showAiTenpai = tempShowAiTenpai;
            currentGameState.aiSpeedMode = tempAiSpeedMode;
            modalEl.innerHTML = '';

            if (!isNaN(parsedSeed) && parsedSeed !== vsGameState.currentSeed) {
                // If the user entered a valid new seed, always start a new game with it
                startVsMode(parsedSeed);
            } else if (isUpdate) {
                renderVsArena(); // Refresh labels
            } else {
                startVsMode(isNaN(parsedSeed) ? null : parsedSeed); // Fresh game
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


