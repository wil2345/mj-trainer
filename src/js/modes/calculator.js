import { currentGameState } from '../state.js';
import { renderTile } from '../components/Tile.js';
import { sortHand } from '../engine/handGenerator.js';
import { getDiscardAnalysis } from '../engine/shanten.js';
import { renderGameScene } from './training.js';
import { TILE_MAP } from '../constants.js';

export function renderEditScene(appContainer) {
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

