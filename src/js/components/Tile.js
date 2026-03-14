// Tile.js
// Component for rendering a Mahjong tile

/**
 * Returns the HTML string for a Mahjong tile
 * @param {string} tileCode - e.g., '1m', '7z'
 * @param {Object} options - { size: 'md', onClick: null, extraClasses: '' }
 * @returns {string} HTML string
 */
export const renderTile = (tileCode, { size = 'md', extraClasses = '', id = '' } = {}) => {
    const sizeClasses = {
        xs: 'w-6 h-8',
        sm: 'w-8 h-10.5',
        md: 'w-12 h-16',
        lg: 'w-16 h-21'
    };

    const tilePath = `./assets/tiles/${tileCode}.svg`;
    
    return `
        <div 
            ${id ? `id="${id}"` : ''}
            data-tile="${tileCode}"
            class="tile-container cursor-pointer transition-all hover:-translate-y-1 active:scale-95 ${sizeClasses[size]} ${extraClasses} border-none bg-transparent"
        >
            <img src="${tilePath}" alt="${tileCode}" class="w-full h-full pointer-events-none block" />
        </div>
    `;
};
