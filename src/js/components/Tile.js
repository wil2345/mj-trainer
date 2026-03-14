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
export const renderTile = (tileCode, { size = 'md', extraClasses = '', id = '' } = {}) => {
    // Maximized font sizes to fill the tile face completely
    const sizeClasses = {
        xs: 'w-7 h-9 text-3xl',
        sm: 'w-10 h-13 text-5xl',
        md: 'w-14 h-19 text-7xl',
        lg: 'w-20 h-27 text-8xl'
    };

    const { char, colorClass } = getTileDetails(tileCode);
    
    return `
        <div 
            ${id ? `id="${id}"` : ''}
            data-tile="${tileCode}"
            class="tile-container relative cursor-pointer transition-all hover:-translate-y-1 active:scale-95 ${sizeClasses[size]} ${extraClasses} select-none"
        >
            <!-- Shadow Layer (Depth) -->
            <div class="absolute inset-0 bg-gray-300 rounded-md mt-[12%]"></div>
            <!-- Face Layer -->
            <div class="absolute inset-0 bottom-[6%] bg-[#fdfbf7] border-[0.5px] border-gray-400 rounded-md flex items-center justify-center overflow-hidden">
                <span class="${colorClass} leading-none font-sans">${char}</span>
            </div>
        </div>
    `;
};
