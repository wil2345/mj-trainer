const fs = require('fs');
const content = fs.readFileSync('src/js/app.js', 'utf-8');

const settingsMatch = content.match(/export function showSettingsModal[\s\S]+?(?=export function startTrainingSession)/);
const settingsStr = settingsMatch[0];

const out = `import { currentGameState, vsGameState } from '../state.js';
import { startVsMode, renderVsArena } from '../modes/arena.js';
import { startTrainingSession } from '../modes/training.js';

` + settingsStr;

fs.writeFileSync('src/js/ui/settings.js', out);

let newContent = content.replace(settingsStr, '');
fs.writeFileSync('src/js/app.js', newContent);
console.log('Settings extracted!');
