import { currentGameState, vsGameState } from '../state.js';
import { mulberry32 } from '../utils.js';
import { createDeck } from '../constants.js';
import { sortHand } from '../engine/handGenerator.js';
import { 
    isWinningHand, 
    calculateShanten, 
    getClosedKanOptions, 
    getKanOptions, 
    getPonOptions, 
    getChiOptions 
} from '../engine/shanten.js';
import { decideAiInterrupt, decideAiTurnAction, decideAiDiscard, calculateRestingStatus } from '../engine/aiPolicy.js';
import { addMatchRecord } from '../storage.js';
import { renderTile } from '../components/Tile.js';
import { initApp } from '../app.js';
import { showSettingsModal } from '../ui/settings.js';
import { initReplayMode } from './replay.js';

export function showAiActionBubble(message) {
    const container = document.getElementById('vs-notification-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-gray-900/90 backdrop-blur text-white px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 ring-4 ring-black/5 animate-slide-down">
            <div class="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">AI</div>
            <span class="font-bold tracking-wider text-sm">${message}</span>
        </div>
    `;
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 1500);
}

export function saveVsSnapshot() {
    if (vsGameState.historyStack.length >= 50) {
        vsGameState.historyStack.shift();
    }
    
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
        forbiddenDiscard: vsGameState.forbiddenDiscard,
        aiLastStatus: vsGameState.aiLastStatus
    }));
    
    vsGameState.historyStack.push(snapshot);
}

export function startVsMode(providedSeed = null) {
    currentGameState.mode = 'AI對戰練習';
    
    const seed = (providedSeed !== null && typeof providedSeed === 'number') 
        ? providedSeed 
        : Math.floor(Math.random() * 1000000);
    vsGameState.currentSeed = seed;
    
    const seededRandom = mulberry32(seed);
    
    vsGameState.wall = createDeck();
    
    for (let i = vsGameState.wall.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [vsGameState.wall[i], vsGameState.wall[j]] = [vsGameState.wall[j], vsGameState.wall[i]];
    }

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

    const firstTile = vsGameState.wall.shift();
    vsGameState.player.closed.push(firstTile);
    vsGameState.trajectory.push({ actor: 'player', action: 'draw', tile: firstTile });

    renderVsArena();
}

export function renderVsArena() {
    const appContainer = document.getElementById('app');
    const { player, ai, wall, currentTurn, isGameOver, winner, pendingAction, showAiHand, latestDiscard } = vsGameState;

    appContainer.classList.remove('p-4');
    appContainer.classList.add('p-0');

    const renderRiverTile = (t, owner, idx) => {
        const isLatest = latestDiscard && latestDiscard.owner === owner && latestDiscard.index === idx;
        const extraClasses = isLatest ? 'ring-2 ring-blue-500 shadow-md transform -translate-y-0.5 z-10 scale-110' : 'opacity-90';
        return renderTile(t, { size: 'xs', extraClasses });
    };

    const renderOpenMelds = (melds, isAi = false) => melds.map(meld => {
        const isAnkan = !Array.isArray(meld) && meld.isClosed;
        const tiles = Array.isArray(meld) ? meld : meld.tiles;
        const shouldShow = !isAnkan || !isAi || showAiHand || isGameOver;
        return `
            <div class="flex border border-gray-200 rounded-md p-0.5 bg-gray-50/50 w-fit justify-center gap-0.5 shadow-sm">      
                ${tiles.map(t => renderTile(t, { size: 'xs', faceDown: !shouldShow })).join('')}
            </div>
        `;
    }).join('');

    const aiShanten = calculateShanten(ai.closed, ai.open.length);
    
    let turnActions = [];
    if (currentTurn === 'player' && !isGameOver && !pendingAction && player.closed.length % 3 === 2) {
        const lastAction = vsGameState.trajectory.length > 0 ? vsGameState.trajectory[vsGameState.trajectory.length - 1] : null;
        const playerJustDrew = lastAction && (lastAction.action === 'draw' || lastAction.action === 'draw_replacement');

        if (playerJustDrew) {
            if (isWinningHand(player.closed, player.open.length)) {
                turnActions.push({ type: 'tsumo', label: '自摸' });
            }
            const kanOpts = getClosedKanOptions(player.closed, player.open);
            if (kanOpts.length > 0) {
                turnActions.push({ type: 'kan_self', label: '槓', options: kanOpts });
            }
        }
    }

    appContainer.innerHTML = `
        <div class="flex flex-col h-screen overflow-hidden bg-gray-100 relative">
            
            <!-- Scrollable Content (Header + AI + Rivers) -->
            <div class="flex-grow overflow-y-auto pb-52 pt-2 px-2 hide-scrollbar" id="vs-scroll-area">
                
                <!-- Header (Compact) -->
                <div class="max-w-4xl mx-auto flex justify-between items-center mb-2 px-1">
                    <div class="flex items-center gap-2">
                        <h2 class="text-xs font-black text-gray-700 uppercase tracking-tighter flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h.01M15 9h.01M8 13h8" />
                            </svg>
                            ${currentGameState.mode}
                        </h2>
                        <div class="text-[9px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">W: ${wall.length}</div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button id="vs-rollback-btn" class="p-1.5 rounded-lg bg-white border border-gray-200 text-blue-600 disabled:opacity-30 transition-all active:scale-90 shadow-sm" title="Undo" ${vsGameState.historyStack.length === 0 ? 'disabled' : ''}>
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        </button>
                        <button id="vs-settings-btn" class="p-1.5 rounded-lg bg-white border border-gray-200 text-orange-600 active:scale-90 shadow-sm" title="Settings">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                        </button>
                        <button id="vs-back-btn" class="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 active:scale-90 shadow-sm" title="Back">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                    </div>
                </div>

                <!-- AI Section (Super Compact) -->
                <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-2 mb-2">
                    <div class="flex justify-between items-center mb-1.5 px-1">
                        <div class="flex items-center gap-1.5">
                            <div class="w-4 h-4 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-[8px] font-black">AI</div>
                            ${(currentGameState.showAiTenpai && !isGameOver) ? (
                                aiShanten === -1
                                ? '<span class="bg-yellow-400 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">胡牌</span>'
                                : (aiShanten === 0 
                                    ? '<span class="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded animate-pulse">叫糊</span>' 
                                    : `<span class="bg-gray-400 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">${aiShanten}向聽</span>`)
                            ) : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            <button id="toggle-ai-hand-btn" class="text-[8px] font-black text-gray-400 uppercase tracking-tighter hover:text-gray-600 transition">
                                ${showAiHand ? 'Hide' : 'Show'} Hand
                            </button>
                            <span class="text-[8px] font-bold text-gray-300 uppercase tracking-widest">${ai.closed.length} T</span>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-0.5 justify-center mb-2">
                        ${ai.closed.map(t => renderTile(t, { size: 'xs', faceDown: !showAiHand && !isGameOver })).join('')}
                    </div>

                    <div class="flex flex-wrap gap-1 justify-start overflow-x-auto hide-scrollbar" id="ai-open-melds">
                        ${renderOpenMelds(ai.open, true)}
                    </div>
                </div>

                <!-- Central Table (Combined Rivers) -->
                <div class="max-w-4xl mx-auto">
                    <div class="bg-emerald-800/10 rounded-2xl p-2 sm:p-3 border-2 border-dashed border-emerald-200/50 min-h-[300px] grid grid-rows-2 relative">
                        <!-- AI River Area -->
                        <div class="flex flex-wrap gap-0.5 sm:gap-1 justify-start content-start border-b border-emerald-300/30 border-dashed pb-2">
                            ${ai.river.map((t, i) => renderRiverTile(t, 'ai', i)).join('')}
                        </div>
                        
                        <!-- Player River Area -->
                        <div class="flex flex-wrap gap-0.5 sm:gap-1 justify-start content-start pt-2">
                            ${player.river.map((t, i) => renderRiverTile(t, 'player', i)).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Fixed Player Command Center -->
            <div class="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
                <div class="max-w-4xl mx-auto w-full px-2 pb-[env(safe-area-inset-bottom,1rem)]">
                    
                    <!-- Floating Actions Overlay -->
                    <div class="flex flex-col items-center gap-2 mb-3 pointer-events-auto">
                        ${pendingAction ? `
                            <div class="flex gap-2 animate-fade-in-up">
                                ${pendingAction.actions.map(action => `
                                    <button class="vs-action-btn ${action.type === 'ron' ? 'bg-yellow-500 ring-4 ring-yellow-200' : 'bg-mj-green ring-4 ring-emerald-100'} text-white font-black px-6 py-3 rounded-xl shadow-xl transition active:scale-95 text-sm uppercase tracking-wider" data-type="${action.type}">
                                        ${action.label}
                                    </button>
                                `).join('')}
                                <button id="vs-skip-btn" class="bg-white text-gray-700 font-bold px-6 py-3 rounded-xl shadow-xl transition active:scale-95 border border-gray-200 text-sm uppercase tracking-wider">
                                    Skip
                                </button>
                            </div>
                        ` : ''}
                        
                        ${turnActions.length > 0 ? `
                            <div class="flex gap-2 animate-fade-in-up">
                                ${turnActions.map(action => `
                                    <button class="vs-turn-action-btn ${action.type === 'tsumo' ? 'bg-yellow-500 ring-4 ring-yellow-200' : 'bg-mj-green ring-4 ring-emerald-100'} text-white font-black px-6 py-3 rounded-xl shadow-xl transition active:scale-95 text-sm uppercase tracking-wider" data-type="${action.type}">
                                        ${action.label}
                                    </button>
                                `).join('')}
                            </div>
                        ` : ''}

                        ${isGameOver && !vsGameState.isReplaying ? `
                            <div class="bg-white p-5 rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center animate-fade-in-up w-full max-w-sm">
                                <h3 class="text-2xl font-black ${winner === 'player' ? 'text-mj-green' : (winner === 'ai' ? 'text-mj-red' : 'text-gray-600')} mb-1 drop-shadow-sm tracking-widest text-center">
                                    ${winner === 'player' ? '🎉 YOU WIN!' : (winner === 'ai' ? '💀 AI WINS!' : '🤝 DRAW (流局)')}
                                </h3>
                                <p class="text-xs text-gray-500 mb-4 font-medium text-center">Match finished.</p>
                                
                                <div class="flex gap-3 w-full">
                                    <button id="vs-review-btn" class="bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-600 transition active:scale-95 flex-1 whitespace-nowrap">
                                        覆盤 (Replay)
                                    </button>
                                    <button id="vs-restart-btn" class="bg-mj-green text-white px-4 py-2.5 rounded-xl font-bold shadow-md hover:bg-emerald-600 transition active:scale-95 flex-1 whitespace-nowrap">
                                        下一局(Next Game)
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Player Hand & Melds (Frosted Glass Card) -->
                    <div class="bg-white/95 backdrop-blur-md border border-white/50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] rounded-t-3xl p-3 pointer-events-auto transition-all">
                        <div class="flex flex-wrap gap-1 mb-2 justify-start overflow-x-auto hide-scrollbar" id="player-open-melds">
                            ${renderOpenMelds(player.open)}
                        </div>

                        <div class="flex flex-wrap gap-0.5 sm:gap-1 justify-center" id="vs-hand-container">
                            ${player.closed.map((t, i) => renderTile(t, { 
                                size: 'sm', 
                                id: `vs-tile-${i}`,
                                extraClasses: currentTurn === 'player' && !isGameOver && !pendingAction ? 'hover:-translate-y-4 active:-translate-y-6 cursor-pointer transition-all duration-200' : 'opacity-40 cursor-default grayscale-[0.5]'
                            })).join('')}
                        </div>
                    </div>
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
    
    document.getElementById('toggle-ai-hand-btn').addEventListener('click', () => {
        vsGameState.showAiHand = !vsGameState.showAiHand;
        renderVsArena();
    });

    if (isGameOver && document.getElementById('vs-restart-btn')) {
        document.getElementById('vs-restart-btn').addEventListener('click', () => startVsMode());
    }

    const vsReviewBtn = document.getElementById('vs-review-btn');
    if (isGameOver && vsReviewBtn && !vsGameState.isReplaying) {
        vsReviewBtn.addEventListener('click', () => {
            initReplayMode();
        });
    }

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
            } else if (type === 'tsumo') {
                handleVsAction(type);
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

export function saveMatchIfOver() {
    if (vsGameState.isGameOver) {
        addMatchRecord({
            seed: vsGameState.currentSeed,
            winner: vsGameState.winner,
            trajectory: vsGameState.trajectory,
            timestamp: Date.now()
        });
    }
}

export function handleVsAction(type) {
    const { pendingAction } = vsGameState;
    const tile = pendingAction ? pendingAction.tile : null;

    saveVsSnapshot();

    if (type === 'tsumo') {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'player';
        vsGameState.trajectory.push({ actor: 'player', action: 'tsumo' });
        vsGameState.pendingAction = null;
        saveMatchIfOver();
        renderVsArena();
    } else if (type === 'ron') {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'player';
        vsGameState.ai.river.pop(); 
        vsGameState.player.closed.push(tile);
        vsGameState.trajectory.push({ actor: 'player', action: 'ron', tile });
        vsGameState.pendingAction = null;
        saveMatchIfOver();
        renderVsArena();
    } else if (type === 'pon') {
        vsGameState.ai.river.pop(); 
        vsGameState.player.closed.splice(vsGameState.player.closed.indexOf(tile), 1);
        vsGameState.player.closed.splice(vsGameState.player.closed.indexOf(tile), 1);
        vsGameState.player.open.push([tile, tile, tile]);
        vsGameState.trajectory.push({ actor: 'player', action: 'pon', tile });
        vsGameState.pendingAction = null;
        vsGameState.currentTurn = 'player';
        vsGameState.forbiddenDiscard = tile; 
        renderVsArena();
    } else if (type === 'chi') {
        const action = pendingAction.actions.find(a => a.type === 'chi');
        if (action.options.length === 1) {
            executeChi(action.options[0], tile);
        } else {
            showChiModal(action.options, tile);
        }
    } else if (type === 'kan') {
        vsGameState.ai.river.pop(); 
        vsGameState.player.closed = vsGameState.player.closed.filter(t => t !== tile);
        vsGameState.player.open.push([tile, tile, tile, tile]);
        vsGameState.trajectory.push({ actor: 'player', action: 'kan', tile });
        vsGameState.pendingAction = null;
        vsGameState.currentTurn = 'player';
        vsDrawReplacement('player');
    }
}

export function showChiModal(options, tile) {
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

export function executeChi(opt, tile) {
    vsGameState.ai.river.pop(); 
    vsGameState.player.closed.splice(vsGameState.player.closed.indexOf(opt[0]), 1);
    vsGameState.player.closed.splice(vsGameState.player.closed.indexOf(opt[1]), 1);
    vsGameState.player.open.push([opt[0], tile, opt[1]]);
    vsGameState.trajectory.push({ actor: 'player', action: 'chi', tile, opt });
    vsGameState.pendingAction = null;
    vsGameState.currentTurn = 'player';
    vsGameState.forbiddenDiscard = tile; 
    renderVsArena();
}

export function vsPlayerDiscard(index) {
    if (vsGameState.currentTurn !== 'player' || vsGameState.pendingAction) return;

    const tileToDiscard = vsGameState.player.closed[index];
    
    if (vsGameState.forbiddenDiscard === tileToDiscard) {
        const tileEl = document.getElementById(`vs-tile-${index}`);
        if (tileEl) {
            tileEl.classList.add('ring-4', 'ring-red-500', 'animate-shake');
            setTimeout(() => {
                tileEl.classList.remove('ring-4', 'ring-red-500', 'animate-shake');
            }, 300);
        }
        return;
    }

    saveVsSnapshot();

    const tile = vsGameState.player.closed.splice(index, 1)[0];
    vsGameState.player.river.push(tile);
    vsGameState.latestDiscard = { owner: 'player', index: vsGameState.player.river.length - 1 };
    vsGameState.player.closed = sortHand(vsGameState.player.closed);
    vsGameState.trajectory.push({ actor: 'player', action: 'discard', tile: tile });
    
    vsGameState.forbiddenDiscard = null;

    if (checkAiInterrupt(tile)) return;

    vsGameState.currentTurn = 'ai';
    renderVsArena();

    if (vsGameState.wall.length === 0) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'draw';
        saveMatchIfOver();
        renderVsArena();
        return;
    }

    setTimeout(() => {
        vsAiTurn();
    }, currentGameState.aiSpeedMode ? 0 : 1000);
}

export function checkAiInterrupt(tile) {
    const aiSettings = { difficulty: currentGameState.aiDifficulty, style: currentGameState.aiStyle };
    const decision = decideAiInterrupt(tile, vsGameState, aiSettings);

    if (!decision) return false;

    vsGameState.aiLastStatus = calculateRestingStatus(vsGameState.ai.closed, vsGameState.ai.open.length, vsGameState);

    if (decision.action === 'ron') {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'ai';
        vsGameState.ai.closed.push(tile);
        vsGameState.trajectory.push({ actor: 'ai', action: 'ron', tile: tile });
        showAiActionBubble('糊');
        saveMatchIfOver();
        renderVsArena();
        return true;
    }

    if (decision.action === 'kan') {
        vsGameState.ai.closed = sortHand(vsGameState.ai.closed.filter(t => t !== tile));
        vsGameState.player.river.pop(); 
        vsGameState.ai.open.push([tile, tile, tile, tile]);
        vsGameState.trajectory.push({ actor: 'ai', action: 'kan', tile: tile });
        vsGameState.latestDiscard = null;
        vsGameState.currentTurn = 'ai';
        showAiActionBubble('槓');
        renderVsArena();
        setTimeout(() => {
            vsDrawReplacement('ai');
        }, currentGameState.aiSpeedMode ? 0 : 1000);
        return true;
    }

    if (decision.action === 'pon') {
        vsGameState.ai.closed.splice(vsGameState.ai.closed.indexOf(tile), 1);
        vsGameState.ai.closed.splice(vsGameState.ai.closed.indexOf(tile), 1);
        vsGameState.ai.closed = sortHand(vsGameState.ai.closed);
        vsGameState.player.river.pop(); 
        vsGameState.ai.open.push([tile, tile, tile]);
        vsGameState.trajectory.push({ actor: 'ai', action: 'pon', tile: tile });
        vsGameState.latestDiscard = null; 
        vsGameState.currentTurn = 'ai';
        vsGameState.forbiddenDiscard = tile; 
        showAiActionBubble('碰');
        renderVsArena(); 
        setTimeout(() => {
            vsAiDiscard();
        }, currentGameState.aiSpeedMode ? 0 : 1000);
        return true;
    }

    if (decision.action === 'chi') {
        const opt = decision.opt;
        vsGameState.ai.closed.splice(vsGameState.ai.closed.indexOf(opt[0]), 1);
        vsGameState.ai.closed.splice(vsGameState.ai.closed.indexOf(opt[1]), 1);
        vsGameState.ai.closed = sortHand(vsGameState.ai.closed);
        vsGameState.player.river.pop(); 
        vsGameState.ai.open.push([opt[0], tile, opt[1]]);
        vsGameState.trajectory.push({ actor: 'ai', action: 'chi', tile: tile, opt: opt });
        vsGameState.latestDiscard = null; 
        vsGameState.currentTurn = 'ai';
        vsGameState.forbiddenDiscard = tile; 
        showAiActionBubble('上');
        renderVsArena(); 
        vsAiDiscard();
        return true;
    }

    return false;
}

export function checkPlayerInterrupt(tile) {
    const actions = [];

    if (isWinningHand([...vsGameState.player.closed, tile], vsGameState.player.open.length)) {
        actions.push({ type: 'ron', label: '糊', tile });
    }

    if (getKanOptions(vsGameState.player.closed, tile)) {
        actions.push({ type: 'kan', label: '槓', tile });
    }

    if (getPonOptions(vsGameState.player.closed, tile)) {
        actions.push({ type: 'pon', label: '碰', tile });
    }

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

export async function vsAiDiscard() {
    const aiSettings = { difficulty: currentGameState.aiDifficulty, style: currentGameState.aiStyle };
    const { discard: bestMove, analysisPayload } = await decideAiDiscard(vsGameState, aiSettings, vsGameState.forbiddenDiscard);
    
    vsGameState.forbiddenDiscard = null;
    
    if (analysisPayload) {
        analysisPayload.previousStatus = vsGameState.aiLastStatus;
    }

    executeAiDiscard(bestMove, analysisPayload);
}

export function executeAiDiscard(bestMove, analysisPayload = null) {
    const discardIndex = vsGameState.ai.closed.indexOf(bestMove);
    vsGameState.ai.closed.splice(discardIndex, 1);
    vsGameState.ai.river.push(bestMove);
    vsGameState.latestDiscard = { owner: 'ai', index: vsGameState.ai.river.length - 1 };
    vsGameState.ai.closed = sortHand(vsGameState.ai.closed);
    
    const trajectoryEntry = { actor: 'ai', action: 'discard', tile: bestMove };
    if (analysisPayload) {
        trajectoryEntry.analysis = analysisPayload;
    }
    vsGameState.trajectory.push(trajectoryEntry);

    if (checkPlayerInterrupt(bestMove)) return;

    vsPlayerDraw();
}

export function vsPlayerDraw() {
    if (vsGameState.wall.length === 0) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'draw';
        saveMatchIfOver();
        renderVsArena();
        return;
    }

    vsGameState.currentTurn = 'player';
    const playerTile = vsGameState.wall.shift();
    vsGameState.player.closed.push(playerTile);
    vsGameState.trajectory.push({ actor: 'player', action: 'draw', tile: playerTile });

    renderVsArena();
}

export function vsAiTurn() {
    if (vsGameState.isGameOver) return;

    const tile = vsGameState.wall.shift();
    vsGameState.ai.closed.push(tile);
    vsGameState.trajectory.push({ actor: 'ai', action: 'draw', tile: tile });

    const aiSettings = { difficulty: currentGameState.aiDifficulty, style: currentGameState.aiStyle };
    const decision = decideAiTurnAction(vsGameState, aiSettings);

    if (decision && decision.action === 'tsumo') {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'ai';
        showAiActionBubble('自摸');
        saveMatchIfOver();
        renderVsArena();
        return;
    }
    
    renderVsArena(); 

    if (decision && (decision.action === 'ankan' || decision.action === 'kakan')) {
        const opt = decision;
        if (opt.action === 'ankan') {
            vsGameState.ai.closed = sortHand(vsGameState.ai.closed.filter(t => t !== opt.tile));
            vsGameState.ai.open.push({ tiles: [opt.tile, opt.tile, opt.tile, opt.tile], isClosed: true });
        } else {
            const meldIdx = vsGameState.ai.open.findIndex(m => !Array.isArray(m) ? (m.tiles[0] === opt.tile) : (m[0] === opt.tile && m.length === 3));
            if (Array.isArray(vsGameState.ai.open[meldIdx])) {
                vsGameState.ai.open[meldIdx].push(opt.tile);
            } else {
                vsGameState.ai.open[meldIdx].tiles.push(opt.tile);
            }
            vsGameState.ai.closed.splice(vsGameState.ai.closed.indexOf(opt.tile), 1);
            vsGameState.ai.closed = sortHand(vsGameState.ai.closed);
        }
        vsGameState.trajectory.push({ actor: 'ai', action: opt.action, tile: opt.tile });
        showAiActionBubble(opt.action === 'ankan' ? '暗槓' : '加槓');
        renderVsArena();
        setTimeout(() => {
            vsDrawReplacement('ai');
        }, currentGameState.aiSpeedMode ? 0 : 1000);
        return;
    }

    setTimeout(() => {
        vsGameState.aiLastStatus = calculateRestingStatus(vsGameState.ai.closed, vsGameState.ai.open.length, vsGameState);
        vsAiDiscard();
    }, currentGameState.aiSpeedMode ? 0 : 1000);
}


export function showKanModal(options) {
    let modalEl = document.getElementById('chi-modal-root'); 
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

export function rollbackVsMove() {
    if (vsGameState.historyStack.length === 0) return;
    
    const lastState = vsGameState.historyStack.pop();
    
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
    vsGameState.forbiddenDiscard = lastState.forbiddenDiscard;
    
    renderVsArena();
}

export function executeKanSelf(kan) {
    saveVsSnapshot();
    if (kan.type === 'ankan') {
        vsGameState.player.closed = vsGameState.player.closed.filter(t => t !== kan.tile);
        vsGameState.player.open.push({ tiles: [kan.tile, kan.tile, kan.tile, kan.tile], isClosed: true });
    } else {
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

export function vsDrawReplacement(actor) {
    if (vsGameState.wall.length === 0) {
        vsGameState.isGameOver = true;
        vsGameState.winner = 'draw';
        saveMatchIfOver();
        renderVsArena();
        return;
    }
    
    const tile = vsGameState.wall.shift();
    vsGameState[actor].closed.push(tile);
    vsGameState.trajectory.push({ actor, action: 'draw_replacement', tile });
    
    if (actor === 'ai') {
        showAiActionBubble('槓');
        if (isWinningHand(vsGameState.ai.closed, vsGameState.ai.open.length)) {
            vsGameState.isGameOver = true;
            vsGameState.winner = 'ai';
            showAiActionBubble('自摸');
            saveMatchIfOver();
        }
    }
    
    renderVsArena();

    if (actor === 'ai' && !vsGameState.isGameOver) {
        setTimeout(() => {
            vsAiDiscard();
        }, currentGameState.aiSpeedMode ? 0 : 1000);
    }
}
