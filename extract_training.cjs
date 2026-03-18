const fs = require('fs');
let content = fs.readFileSync('src/js/app.js', 'utf-8');

const trainingMatch = content.match(/export function startTrainingSession[\s\S]+/);
const trainingStr = trainingMatch[0];

const out = `import { currentGameState } from '../state.js';
import { loadStats, updateStat } from '../storage.js';
import { renderTile } from '../components/Tile.js';
import { generateTrainingHand } from '../engine/handGenerator.js';
import { getDiscardAnalysis, isWinningHand } from '../engine/shanten.js';
import { TILE_NAMES } from '../constants.js';
import { showSettingsModal } from '../ui/settings.js';
import { runMonteCarlo } from './mc.js';
import { renderEditScene } from './calculator.js';

let liveTimerInterval = null;
` + trainingStr.replace(/function renderFeedbackState/g, 'export function renderFeedbackState');

fs.writeFileSync('src/js/modes/training.js', out);

content = content.replace(trainingStr, '');
content = content.replace('let liveTimerInterval = null;\n\n', '');
fs.writeFileSync('src/js/app.js', content);
console.log('Training extracted!');
