// replay.js
import { currentGameState, vsGameState } from '../state.js';
import { mulberry32 } from '../utils.js';
import { createDeck, TILE_NAMES } from '../constants.js';
import { sortHand } from '../engine/handGenerator.js';
import { calculateShanten } from '../engine/shanten.js';
import { renderTile } from '../components/Tile.js';
import { renderVsArena } from './arena.js';

export function initReplayMode() {
    currentGameState.mode = '覆盤';
    vsGameState.isReplaying = true;
    vsGameState.showAiHand = true; // Omniscience mode
    vsGameState.fullTrajectory = [...vsGameState.trajectory];
    vsGameState.replayStep = vsGameState.fullTrajectory.length; // Start at the end
    
    renderReplayStep(vsGameState.replayStep);
}

export function renderReplayStep(stepIndex, renderUI = true) {
    // 1. Deterministic Board Reconstruction
    const seed = vsGameState.currentSeed;
    const seededRandom = mulberry32(seed);
    
    vsGameState.wall = createDeck();
    for (let i = vsGameState.wall.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [vsGameState.wall[i], vsGameState.wall[j]] = [vsGameState.wall[j], vsGameState.wall[i]];
    }

    vsGameState.player = { closed: sortHand(vsGameState.wall.splice(0, 16)), open: [], river: [] };
    vsGameState.ai = { closed: sortHand(vsGameState.wall.splice(0, 16)), open: [], river: [] };
    vsGameState.latestDiscard = null;
    vsGameState.isGameOver = (stepIndex === vsGameState.fullTrajectory.length);
    
    let currentTrajectoryItem = null;

    for (let i = 0; i < stepIndex; i++) {
        const t = vsGameState.fullTrajectory[i];
        currentTrajectoryItem = t;
        const actor = t.actor;
        
        switch (t.action) {
            case 'draw':
            case 'draw_replacement':
                const drawnTile = vsGameState.wall.shift();
                vsGameState[actor].closed.push(drawnTile);
                break;
            case 'discard':
                vsGameState[actor].closed.splice(vsGameState[actor].closed.indexOf(t.tile), 1);
                vsGameState[actor].river.push(t.tile);
                vsGameState.latestDiscard = { owner: actor, index: vsGameState[actor].river.length - 1 };
                vsGameState[actor].closed = sortHand(vsGameState[actor].closed);
                break;
            case 'chi':
                const oppChi = actor === 'player' ? 'ai' : 'player';
                if (vsGameState.latestDiscard && vsGameState.latestDiscard.owner === oppChi) {
                    vsGameState[oppChi].river.pop();
                    vsGameState.latestDiscard = null;
                }
                let c1 = null, c2 = null;
                if (t.opt && t.opt.length === 2) {
                    c1 = t.opt[0]; c2 = t.opt[1];
                } else {
                    let valChi = parseInt(t.tile[0]);
                    let suitChi = t.tile[1];
                    if (vsGameState[actor].closed.includes(`${valChi-1}${suitChi}`) && vsGameState[actor].closed.includes(`${valChi+1}${suitChi}`)) {
                        c1 = `${valChi-1}${suitChi}`; c2 = `${valChi+1}${suitChi}`;
                    } else if (vsGameState[actor].closed.includes(`${valChi-2}${suitChi}`) && vsGameState[actor].closed.includes(`${valChi-1}${suitChi}`)) {
                        c1 = `${valChi-2}${suitChi}`; c2 = `${valChi-1}${suitChi}`;
                    } else if (vsGameState[actor].closed.includes(`${valChi+1}${suitChi}`) && vsGameState[actor].closed.includes(`${valChi+2}${suitChi}`)) {
                        c1 = `${valChi+1}${suitChi}`; c2 = `${valChi+2}${suitChi}`;
                    }
                }
                if (c1 && c2) {
                    vsGameState[actor].closed.splice(vsGameState[actor].closed.indexOf(c1), 1);
                    vsGameState[actor].closed.splice(vsGameState[actor].closed.indexOf(c2), 1);
                    vsGameState[actor].open.push([c1, t.tile, c2]);
                }
                break;
            case 'pon':
                const oppPon = actor === 'player' ? 'ai' : 'player';
                if (vsGameState.latestDiscard && vsGameState.latestDiscard.owner === oppPon) {
                    vsGameState[oppPon].river.pop();
                    vsGameState.latestDiscard = null;
                }
                vsGameState[actor].closed.splice(vsGameState[actor].closed.indexOf(t.tile), 1);
                vsGameState[actor].closed.splice(vsGameState[actor].closed.indexOf(t.tile), 1);
                vsGameState[actor].open.push([t.tile, t.tile, t.tile]);
                break;
            case 'kan':
                const oppKan = actor === 'player' ? 'ai' : 'player';
                if (vsGameState.latestDiscard && vsGameState.latestDiscard.owner === oppKan) {
                    vsGameState[oppKan].river.pop();
                    vsGameState.latestDiscard = null;
                }
                vsGameState[actor].closed = vsGameState[actor].closed.filter(tile => tile !== t.tile);
                vsGameState[actor].open.push([t.tile, t.tile, t.tile, t.tile]);
                break;
            case 'ankan':
                vsGameState[actor].closed = vsGameState[actor].closed.filter(tile => tile !== t.tile);
                vsGameState[actor].open.push({ tiles: [t.tile, t.tile, t.tile, t.tile], isClosed: true });
                break;
            case 'kakan':
                const meldIdx = vsGameState[actor].open.findIndex(m => !Array.isArray(m) ? (m.tiles[0] === t.tile) : (m[0] === t.tile && m.length === 3));
                if (meldIdx !== -1) {
                    if (Array.isArray(vsGameState[actor].open[meldIdx])) {
                        vsGameState[actor].open[meldIdx].push(t.tile);
                    } else {
                        vsGameState[actor].open[meldIdx].tiles.push(t.tile);
                    }
                }
                vsGameState[actor].closed.splice(vsGameState[actor].closed.indexOf(t.tile), 1);
                break;
            case 'ron':
                const oppRon = actor === 'player' ? 'ai' : 'player';
                if (vsGameState.latestDiscard && vsGameState.latestDiscard.owner === oppRon) {
                    const popped = vsGameState[oppRon].river.pop();
                    vsGameState[actor].closed.push(popped);
                }
                break;
            case 'tsumo':
                break;
        }
    }

    if (renderUI) {
        renderReplayUI(stepIndex, currentTrajectoryItem);
    }
}

export function renderReplayUI(stepIndex, currentTrajectoryItem) {
    const appContainer = document.getElementById('app');
    const { player, ai, latestDiscard, fullTrajectory } = vsGameState;

    const renderRiverTile = (t, owner, idx) => {
        const isLatest = latestDiscard && latestDiscard.owner === owner && latestDiscard.index === idx;
        const extraClasses = isLatest ? 'ring-2 ring-blue-500 shadow-md transform -translate-y-0.5 z-10 scale-110' : 'opacity-90';
        return renderTile(t, { size: 'xs', extraClasses });
    };
    const renderOpenMelds = (melds) => melds.map(meld => {
        const tiles = Array.isArray(meld) ? meld : meld.tiles;
        return `
            <div class="flex border border-gray-200 rounded-md p-0.5 bg-gray-50/50 w-fit justify-center gap-0.5 shadow-sm">      
                ${tiles.map(t => renderTile(t, { size: 'xs', faceDown: false })).join('')}
            </div>
        `;
    }).join('');

    const aiShanten = calculateShanten(ai.closed, ai.open.length);

    let insightHtml = '';
    if (currentTrajectoryItem && currentTrajectoryItem.actor === 'ai' && currentTrajectoryItem.action === 'discard' && currentTrajectoryItem.analysis) {
        const data = currentTrajectoryItem.analysis;
        
        let prev = data.previousStatus;
        if (!prev) {
            const tempHandWithDrawn = [...ai.closed, currentTrajectoryItem.tile];
            const deadTiles = [...player.river, ...ai.river];
            // The "Before Action" status of a 17-tile hand is the best 16-tile state it can reach
            const analysis = getDiscardAnalysis(tempHandWithDrawn, ai.open.length, deadTiles);
            if (analysis && analysis.length > 0) {
                prev = { 
                    shanten: analysis[0].shanten, 
                    acceptance: analysis[0].acceptance, 
                    acceptedTilesCount: analysis[0].acceptedTiles.length 
                };
            }
        }

        let chosen = data.chosenStatus;
        if (!chosen) {
            const deadTiles = [...player.river, ...ai.river];
            const analysis = getDiscardAnalysis(ai.closed, ai.open.length, deadTiles);
            const chosenAnalysis = analysis.find(a => a.discard === currentTrajectoryItem.tile) || analysis[0];
            chosen = { 
                shanten: chosenAnalysis.shanten, 
                acceptance: chosenAnalysis.acceptance, 
                acceptedTilesCount: chosenAnalysis.acceptedTiles.length 
            };
        }

        let statusCompareHtml = '';
        if (prev && chosen) {
            const getStatColor = (current, previous, isShanten = false) => {
                if (isShanten) {
                    if (current < previous) return 'text-mj-green';
                    if (current > previous) return 'text-mj-red';
                    return 'text-gray-700';
                }
                if (current > previous) return 'text-mj-green';
                if (current < previous) return 'text-mj-red';
                return 'text-blue-500';
            };

            const shantenColor = getStatColor(chosen.shanten, prev.shanten, true);
            const kuanColor = getStatColor(chosen.acceptedTilesCount, prev.acceptedTilesCount);
            const accColor = getStatColor(chosen.acceptance, prev.acceptance);
            const isImproved = (chosen.shanten < prev.shanten) || (chosen.shanten === prev.shanten && chosen.acceptance > prev.acceptance);
            const arrowColor = isImproved ? 'text-mj-green' : 'text-blue-200';

            statusCompareHtml = `
                <div class="flex items-center justify-between bg-blue-50/50 p-3 rounded-xl mb-3 border border-blue-100/50 text-xs shadow-inner w-full">
                    <div class="flex flex-col items-center flex-1">
                        <span class="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Before Action</span>
                        <div class="flex flex-col items-center">
                            <span class="font-black text-gray-700 text-sm">${prev.shanten === 0 ? '叫糊' : prev.shanten + '向聽'}</span>
                            <span class="text-blue-500 font-bold text-[10px]">${prev.acceptedTilesCount}款 ${prev.acceptance}張</span>
                        </div>
                    </div>
                    <div class="flex-shrink-0 ${arrowColor} mx-2">
                        <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </div>
                    <div class="flex flex-col items-center flex-1">
                        <span class="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">After Discard</span>
                        <div class="flex flex-col items-center">
                            <span class="font-black ${shantenColor} text-sm">${chosen.shanten === 0 ? '叫糊' : chosen.shanten + '向聽'}</span>
                            <div class="flex gap-1 items-baseline">
                                <span class="${kuanColor} font-bold text-[10px]">${chosen.acceptedTilesCount}款</span>
                                <span class="${accColor} font-bold text-[10px]">${chosen.acceptance}張</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        let insightDetails = '';
        if (data.type === 'mc') {
            insightDetails = `
                <div class="flex flex-col gap-1 w-full bg-white/50 p-2 rounded-lg">
                    <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Monte Carlo Simulation</p>
                    ${data.options.map((opt, idx) => `
                        <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center gap-2">
                                <span class="text-gray-400 font-mono">${idx + 1}.</span>
                                ${renderTile(opt.discard, { size: 'xs' })}
                            </div>
                            <span class="font-black ${idx === 0 ? 'text-purple-600' : 'text-gray-500'}">${opt.winRate.toFixed(1)}%</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (data.type === 'scoring') {
            insightDetails = `
                <div class="flex flex-col gap-1 w-full bg-white/50 p-2 rounded-lg">
                    <div class="flex items-center justify-between mb-1">
                        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Strategy: ${data.style.charAt(0).toUpperCase() + data.style.slice(1)}</p>
                        <p class="text-[9px] text-gray-400 font-medium">Ranked by Score</p>
                    </div>
                    ${data.options.map((opt, idx) => {
                        const sColor = opt.shanten < prev.shanten ? 'text-mj-green' : (opt.shanten > prev.shanten ? 'text-mj-red' : 'text-gray-500');
                        const dColor = opt.danger >= 50 ? 'text-red-500' : (opt.danger <= 15 ? 'text-mj-green' : 'text-orange-500');
                        
                        return `
                        <div class="flex flex-col py-1.5 border-b border-gray-100/50 last:border-0">
                            <div class="flex items-center justify-between mb-1">
                                <div class="flex items-center gap-2">
                                    <span class="text-gray-400 font-mono text-[9px]">${idx + 1}.</span>
                                    ${renderTile(opt.discard, { size: 'xs' })}
                                    <span class="${sColor} text-[10px] font-black">${opt.shanten === 0 ? '叫糊' : opt.shanten + '向聽'}</span>
                                </div>
                                <div class="flex gap-1.5">
                                    <span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-1 rounded-sm border border-blue-100">總分 ${opt.score}</span>
                                </div>
                            </div>
                            <div class="flex gap-3 text-[9px] font-bold pl-5">
                                <div class="flex items-center gap-1 text-gray-600">
                                    <span class="text-gray-400 font-normal">進張:</span>
                                    <span>${opt.acceptedTilesCount}款 ${opt.acceptance}張</span>
                                </div>
                                <div class="flex items-center gap-1 text-gray-600">
                                    <span class="text-gray-400 font-normal">效率:</span>
                                    <span class="text-emerald-600">${opt.efficiency || '-'}</span>
                                </div>
                                <div class="flex items-center gap-1 text-gray-600">
                                    <span class="text-gray-400 font-normal">風險:</span>
                                    <span class="${dColor}">${opt.danger}</span>
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            `;
        } else {
            insightDetails = `
                <div class="flex flex-col gap-1 w-full bg-white/50 p-2 rounded-lg">
                    <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">DP Analysis (${data.type === 'defensive' ? 'Defensive' : 'Greedy'})</p>
                    ${data.options.map((opt, idx) => {
                        let kCount = opt.acceptedTilesCount;
                        if (kCount === undefined) {
                            const tempH = ai.closed.filter(t => t !== opt.discard); 
                            const curS = calculateShanten(tempH, ai.open.length);
                            kCount = 0;
                            const hCounts = {};
                            tempH.forEach(t => { hCounts[t] = (hCounts[t] || 0) + 1; });
                            Object.keys(TILE_NAMES).forEach(t => {
                                if ((hCounts[t] || 0) >= 4) return;
                                if (calculateShanten([...tempH, t], ai.open.length) < curS) kCount++;
                            });
                        }
                        const sColor = opt.shanten < prev.shanten ? 'text-mj-green' : (opt.shanten > prev.shanten ? 'text-mj-red' : 'text-gray-500');
                        const kColor = kCount > prev.acceptedTilesCount ? 'text-mj-green' : (kCount < prev.acceptedTilesCount ? 'text-mj-red' : 'text-blue-500');
                        const aColor = opt.acceptance > prev.acceptance ? 'text-mj-green' : (opt.acceptance < prev.acceptance ? 'text-mj-red' : 'text-blue-500');
                        return `
                        <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center gap-2">
                                <span class="text-gray-400 font-mono">${idx + 1}.</span>
                                ${renderTile(opt.discard, { size: 'xs' })}
                            </div>
                            <div class="flex gap-2 text-[10px] font-bold">
                                <span class="${sColor}">${opt.shanten === 0 ? '叫糊' : opt.shanten + '向聽'}</span>
                                <span class="${kColor}">${kCount}款</span>
                                <span class="${aColor}">${opt.acceptance}張</span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            `;
        }

        insightHtml = `
            <div class="bg-white/80 backdrop-blur-md p-3 rounded-xl border border-blue-100 shadow-lg w-full mb-3 animate-fade-in-up">
                <div class="flex items-center gap-2 mb-2">
                    <span class="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-tighter">AI Analysis</span>
                    <span class="text-sm font-bold text-gray-700">Discarded ${TILE_NAMES[currentTrajectoryItem.tile]}</span>
                </div>
                ${statusCompareHtml}
                ${insightDetails}
            </div>
        `;
    }

    appContainer.innerHTML = `
        <div class="flex flex-col h-screen overflow-hidden bg-gray-100 relative">
            <div class="flex-grow overflow-y-auto pb-64 pt-2 px-2 hide-scrollbar">
                <div class="max-w-4xl mx-auto flex justify-between items-center mb-2 px-1">
                    <div class="flex items-center gap-2">
                        <h2 class="text-xs font-black text-gray-700 uppercase tracking-tighter flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            覆盤 (Review)
                        </h2>
                        <span class="bg-white border border-gray-200 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded shadow-sm">
                            Step ${stepIndex} / ${fullTrajectory.length}
                        </span>
                    </div>
                    <button id="exit-replay-btn" class="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-800 transition shadow-sm text-xs font-bold px-3">
                        Exit
                    </button>
                </div>

                <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-2 mb-2">
                    <div class="flex justify-between items-center mb-1.5 px-1">
                        <div class="flex items-center gap-1.5">
                            <div class="w-4 h-4 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-[8px] font-black">AI</div>
                            ${aiShanten === -1
                                ? '<span class="bg-yellow-400 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">胡牌</span>'
                                : (aiShanten === 0 
                                    ? '<span class="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded animate-pulse shadow-sm">叫糊</span>' 
                                    : `<span class="bg-gray-400 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">${aiShanten}向聽</span>`)
                            }
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-0.5 justify-center mb-2">
                        ${ai.closed.map(t => renderTile(t, { size: 'xs', faceDown: false })).join('')}
                    </div>
                    <div class="flex flex-wrap gap-1 justify-start overflow-x-auto hide-scrollbar">
                        ${renderOpenMelds(ai.open)}
                    </div>
                </div>

                <div class="max-w-4xl mx-auto">
                    <div class="bg-emerald-800/10 rounded-2xl p-2 sm:p-3 border-2 border-dashed border-emerald-200/50 min-h-[250px] grid grid-rows-2 relative">
                        <div class="flex flex-wrap gap-0.5 sm:gap-1 justify-start content-start border-b border-emerald-300/30 border-dashed pb-2">
                            ${ai.river.map((t, i) => renderRiverTile(t, 'ai', i)).join('')}
                        </div>
                        <div class="flex flex-wrap gap-0.5 sm:gap-1 justify-start content-start pt-2">
                            ${player.river.map((t, i) => renderRiverTile(t, 'player', i)).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
                <div class="max-w-4xl mx-auto w-full px-2 pb-[env(safe-area-inset-bottom,1rem)]">
                    <div class="pointer-events-auto">
                        ${insightHtml}
                    </div>
                    <div class="bg-white/95 backdrop-blur-md border border-white/50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] rounded-t-3xl p-3 pointer-events-auto">
                        <div class="flex flex-wrap gap-1 mb-2 justify-start overflow-x-auto hide-scrollbar">
                            ${renderOpenMelds(player.open)}
                        </div>
                        <div class="flex flex-wrap gap-0.5 sm:gap-1 justify-center mb-4">
                            ${player.closed.map(t => renderTile(t, { size: 'xs', extraClasses: 'opacity-80' })).join('')}
                        </div>
                        <div class="flex flex-col gap-2">
                            <input type="range" id="replay-slider" min="0" max="${fullTrajectory.length}" value="${stepIndex}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500">
                            <div class="flex justify-center gap-3 mt-2">
                                <button class="replay-btn bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-full transition active:scale-95" data-action="start">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                                </button>
                                <button class="replay-btn bg-blue-50 hover:bg-blue-100 text-blue-600 p-3 rounded-full transition active:scale-95 border border-blue-100" data-action="prev">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <button class="replay-btn bg-blue-50 hover:bg-blue-100 text-blue-600 p-3 rounded-full transition active:scale-95 border border-blue-100" data-action="next">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                                <button class="replay-btn bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-full transition active:scale-95" data-action="end">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('exit-replay-btn').addEventListener('click', () => {
        vsGameState.isReplaying = false;
        vsGameState.replayStep = fullTrajectory.length;
        renderReplayStep(vsGameState.replayStep, false); 
        renderVsArena(); 
    });

    const slider = document.getElementById('replay-slider');
    slider.addEventListener('input', (e) => {
        vsGameState.replayStep = parseInt(e.target.value);
        renderReplayStep(vsGameState.replayStep);
    });

    document.querySelectorAll('.replay-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            let newStep = vsGameState.replayStep;
            if (action === 'start') newStep = 0;
            else if (action === 'prev') newStep = Math.max(0, newStep - 1);
            else if (action === 'next') newStep = Math.min(fullTrajectory.length, newStep + 1);
            else if (action === 'end') newStep = fullTrajectory.length;
            if (newStep !== vsGameState.replayStep) {
                vsGameState.replayStep = newStep;
                renderReplayStep(vsGameState.replayStep);
            }
        });
    });
}
