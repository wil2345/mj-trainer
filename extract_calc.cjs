const fs = require('fs');
const content = fs.readFileSync('src/js/app.js', 'utf-8');

const editMatch = content.match(/function renderEditScene[\s\S]+?(?=let currentOptimalIndex = 0;)/);
const editStr = editMatch[0];

const outCalc = `import { currentGameState } from '../state.js';
import { renderTile } from '../components/Tile.js';
import { sortHand } from '../engine/handGenerator.js';
import { getDiscardAnalysis } from '../engine/shanten.js';
import { renderGameScene } from './training.js';

export ` + editStr;

fs.writeFileSync('src/js/modes/calculator.js', outCalc);

let newContent = content.replace(editStr, '');
fs.writeFileSync('src/js/app.js', newContent);
console.log('Calc extracted!');
