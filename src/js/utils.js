// utils.js

// --- Seeded Random Helper ---
export function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

export function generateShareUrl(handArray) {
    // Group by suit
    const grouped = { m: [], p: [], s: [], z: [] };
    handArray.forEach(tile => grouped[tile[1]].push(tile[0]));
    
    let resultStr = "";
    for (let suit of ['m', 'p', 's', 'z']) {
        if (grouped[suit].length > 0) {
            grouped[suit].sort((a, b) => a - b);
            resultStr += grouped[suit].join('') + suit;
        }
    }
    
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?hand=${resultStr}`;
}
