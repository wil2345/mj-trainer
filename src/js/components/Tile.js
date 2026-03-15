// Tile.js
// Component for rendering a Mahjong tile using pure HTML/CSS to fix mobile OS SVG baseline bugs

// Mahjong Unicode Map
const UNICODE_MAP = {
    m: ['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'], // 1m-9m
    p: ['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🀟', '🀠', '🀡'], // 1p-9p
    s: ['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗', '🀘'], // 1s-9s
    z: ['🀀', '🀁', '🀂', '🀃', '🀄', '🀅', '🀆']  // East, South, West, North, Red, Green, White
};

function getTileDetails(tileCode) {
    const suit = tileCode.slice(-1);
    const val = parseInt(tileCode.slice(0, -1));
    const char = UNICODE_MAP[suit][val - 1];

    let colorClass = 'text-gray-800'; // Default
    
    if (suit === 'm') {
        colorClass = 'text-red-500';
    } else if (suit === 's') {
        colorClass = 'text-emerald-500';
    } else if (suit === 'p') {
        colorClass = 'text-blue-500';
    } else if (suit === 'z') {
        if (val <= 4) colorClass = 'text-blue-900';
        else if (val === 5) colorClass = 'text-red-500';
        else if (val === 6) colorClass = 'text-emerald-500';
        else if (val === 7) colorClass = 'text-blue-500';
    }

    return { char, colorClass };
}

/**
 * Returns the HTML string for a Mahjong tile
 * @param {string} tileCode - e.g., '1m', '7z'
 * @param {Object} options - { size: 'md', onClick: null, extraClasses: '' }
 * @returns {string} HTML string
 */
export const renderTile = (tileCode, { size = 'md', extraClasses = '', id = '', faceDown = false } = {}) => {
    // Fixed size classes: use font-size to drive the tile size, avoiding forced w/h stretching
    const sizeClasses = {
        xs: 'text-3xl w-[1.1em] h-[1.5em]',
        sm: 'text-5xl w-[1.1em] h-[1.5em]',
        md: 'text-6xl w-[1.1em] h-[1.5em]',
        lg: 'text-7xl w-[1.1em] h-[1.5em]'
    };

    if (faceDown) {
        return `
            <div 
                ${id ? `id="${id}"` : ''}
                class="tile-container relative inline-flex flex-col transition-all ${sizeClasses[size]} ${extraClasses} select-none flex-shrink-0"
            >
                <div class="absolute inset-0 bg-gray-300 rounded-md mt-[10%]"></div>
                <div class="absolute inset-0 bottom-[6%] bg-yellow-500 border-[0.5px] border-yellow-600 rounded-md overflow-hidden flex items-center justify-center">
                    <div class="absolute inset-[2px] bg-yellow-400 rounded-sm"></div>
                </div>
            </div>
        `;
    }

    const { char, colorClass } = getTileDetails(tileCode);
    
    return `
        <div 
            ${id ? `id="${id}"` : ''}
            data-tile="${tileCode}"
            class="tile-container relative inline-flex flex-col cursor-pointer transition-all hover:-translate-y-1 active:scale-95 ${sizeClasses[size]} ${extraClasses} select-none flex-shrink-0"
        >
            <!-- Shadow Layer (Depth) -->
            <div class="absolute inset-0 bg-gray-300 rounded-md mt-[10%]"></div>
            <!-- Face Layer -->
            <div class="absolute inset-0 bottom-[6%] bg-[#fdfbf7] border-[0.5px] border-gray-400 rounded-md overflow-hidden flex items-center justify-center">
                <!-- Use transform scale to fit nicely without breaking flex boundaries -->
                <span class="${colorClass} leading-[0] block transform scale-y-[1.1] scale-x-[0.95] translate-y-[2%]">${char}</span>
            </div>
        </div>
    `;
};
