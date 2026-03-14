import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TILE_DIR = path.join(__dirname, '..', 'assets', 'tiles');

if (!fs.existsSync(TILE_DIR)) {
    fs.mkdirSync(TILE_DIR, { recursive: true });
}

const TILE_WIDTH = 48;
const TILE_HEIGHT = 64;
const CORNER_RADIUS = 6;

// Mahjong Unicode Map
const UNICODE_MAP = {
    m: ['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'], // 1m-9m
    p: ['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🀟', '🀠', '🀡'], // 1p-9p
    s: ['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗', '🀘'], // 1s-9s
    z: ['🀀', '🀁', '🀂', '🀃', '🀄', '🀅', '🀆']  // East, South, West, North, Red, Green, White
};

function generateSVG(name, char) {
    let color = '#1f2937'; // Default Dark Gray
    
    if (name.endsWith('m')) {
        color = '#ef4444'; // Characters: Red
    } else if (name.endsWith('s')) {
        color = '#10b981'; // Bamboo: Green
    } else if (name.endsWith('p')) {
        color = '#3b82f6'; // Dots: Blue
    } else if (name.endsWith('z')) {
        const val = parseInt(name);
        if (val <= 4) color = '#1e3a8a'; // Winds: Deep Blue
        if (val === 5) color = '#ef4444'; // Red Dragon: Red
        if (val === 6) color = '#10b981'; // Green Dragon: Green
        if (val === 7) color = '#3b82f6'; // White Dragon: Blue Frame
    }

    const svg = `<svg width="${TILE_WIDTH}" height="${TILE_HEIGHT}" viewBox="0 0 ${TILE_WIDTH} ${TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <!-- Tile Shadow/Depth -->
    <rect x="2" y="4" width="${TILE_WIDTH-4}" height="${TILE_HEIGHT-4}" rx="${CORNER_RADIUS}" fill="#d1d5db" />
    <!-- Tile Face -->
    <rect x="2" y="2" width="${TILE_WIDTH-4}" height="${TILE_HEIGHT-6}" rx="${CORNER_RADIUS}" fill="#fdfbf7" stroke="#9ca3af" stroke-width="0.5" />
    
    <!-- Unicode Character -->
    <text 
        x="24" 
        y="34" 
        text-anchor="middle" 
        dominant-baseline="central" 
        font-size="50" 
        fill="${color}"
    >${char}</text>
</svg>`;
    fs.writeFileSync(path.join(TILE_DIR, `${name}.svg`), svg);
}

// Generate all suits
Object.keys(UNICODE_MAP).forEach(suit => {
    UNICODE_MAP[suit].forEach((char, i) => {
        generateSVG(`${i + 1}${suit}`, char);
    });
});

console.log('Successfully generated 34 Mahjong tile assets using Unicode characters in assets/tiles/');
