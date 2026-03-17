# Taiwan Mahjong Trainer - Project Specification (v1.7.0)

## 1. Project Overview
**Taiwan Mahjong Trainer (`mj-trainer`)** is a Progressive Web App (PWA) designed to help players practice and master Taiwan Mahjong discard strategies. 

Beyond isolated efficiency training, the app features a full 1-on-1 AI Arena to simulate real game conditions including calling mechanics and endgame pressure, along with a comprehensive Replay (覆盤) system for post-game analysis.

## 2. Technology Stack
*   **Frontend Environment:** Vanilla JavaScript (ES6+ modules), HTML5.
*   **Styling:** Tailwind CSS (via local `assets/tailwind.js` script for 100% offline support).
*   **Theme:** Emerald Green (`#10b981`) and Blue (`#3b82f6`) color palette.
*   **Data Persistence:** Browser `localStorage` (Offline-first, no backend database).
*   **PWA Support:** 
    *   `manifest.json` and Service Worker (`sw.js`) for caching and offline play.
    *   **Auto-Update Mechanism:** The service worker listens for `updatefound` events and prompts the user with a "New version available!" toast, using `skipWaiting()` to seamlessly hot-reload the app upon confirmation.
    *   Uses a singular, scalable vector graphic (`icon.svg`) for all device icon sizes.
    *   All asset links use **relative paths** (`./`) to support hosting in subdirectories (like GitHub Pages).
*   **Testing / Tooling:** Node.js, Puppeteer (for scraping test cases from Tenhou).

## 3. Core Features

### A. Dashboard & Statistics
*   **Training Stats:** Tracks Accuracy, Tests Done, Current/Max Streaks, and Average Time.
*   **AI Arena Stats:** Tracks Win Rate (color-coded), Deal-in (出銃) rate (excluding AI Tsumo), and total matches played.
*   **Data Management:** Users can reset all statistics via the "Clear History" option in the global "..." menu.

### B. History Tracking
*   **Dual-Tab Interface:** Separates "Training" history from "AI Arena" history.
*   **Training History:** Records up to the last 500 decisions, saving the hand, user choice, correctness, and time spent. Clicking a card loads it into the Sandbox Calculator.
*   **AI Matches History:** Records the last 50 full 1-on-1 AI matches on a FIFO basis, saving the complete trajectory, seed, timestamp, and winner. Clicking a match card loads it directly into Replay Mode.

### C. Training Mode (最大機率打法練習)
*   **Objective:** The user is presented with a random, valid Mahjong hand. They must select the tile to discard that gives them the highest number of acceptable drawn tiles to advance their hand.
*   **Settings Modal:** Users can adjust settings before starting:
    *   **Hand Sizes:** 5, 8, 11, 14, and 17 tiles. (Defaults to 8).
    *   **Tile Pool:** Option to include or exclude Winds & Dragons (Honors). **Defaults to Off**.
    *   **Record Time Taken:** Toggles whether the decision time is logged to the dashboard's "Average Time" stat.
    *   **Display Live Timer:** Toggles a live `0.0s` clock in the header during the game.
*   **Feedback:** Analyzes the discard, showing:
    *   The user's resulting Shanten (向聽) and Acceptance (X款 Y張).
    *   If incorrect, it displays the optimal discard(s) below it for comparison.
    *   If correct (but multiple optimal moves exist), it shows a slider of the *other* optimal choices.
*   **Share Functionality:** Generates a custom URL with the exact hand state (e.g., `?hand=123m456p`) and copies it to the clipboard.

### D. AI對戰練習 (1-on-1 AI Arena)
*   **Objective:** A full game simulation where the player plays against an AI bot in a 16-tile Taiwan Mahjong match.
*   **Layout:** Utilizes a mobile-first "Central Table" design with shared rivers and fixed bottom player controls.
*   **Full Mechanics:** Supports all standard Mahjong actions:
    *   **上 (Chi)**: Forming sequences from opponent discards.
    *   **碰 (Pon)**: Forming triplets from opponent discards.
    *   **槓 (Kan)**: Open Kan, Ankan (Closed), and Kakan (Added). 
    *   **糊 (Ron) / 自摸 (Tsumo)**: Winning mechanics with full Shanten validation.
*   **AI Settings:**
    *   **Difficulty (難度):** Expert (Perfect efficiency), Beginner (Suboptimal moves), Random (Random discards).
    *   **Play Style (打法風格):** Aggressive (Calls to improve hand), Balanced (Calls to improve hand), Defensive (Calls only if discard is 100% safe).
    *   **Show AI State (顯示AI叫糊狀態):** Toggles dynamic badges showing the AI's exact state (-1=胡牌, 0=叫糊, >0=X向聽).
    *   **AI Speed Mode (極速AI模式):** Toggles between a 1-second "human-like" delay for AI actions or instant execution (0ms).
    *   **Match Seed:** Configurable numeric seed to guarantee deterministic draws.
*   **Advanced Features:**
    *   **Strict Improvement Rule:** The AI will never make a "sideways" call (like kuikae) that locks its hand without mathematical benefit. A call MUST lower Shanten OR increase total tile acceptance.
    *   **Kuikae (Forbidden Discard):** Both the player and AI are physically prevented from immediately discarding a tile they just claimed via a Chi or Pon.
    *   **Defensive Safety Logic:** When set to Defensive, the AI will prioritize discarding tiles that exist in the player's river or have been explicitly stolen from the player, ensuring it does not deal into a Ron.
    *   **Expert MC Logic:** The Expert AI uses internal Monte Carlo simulations for endgame hands (8 or fewer tiles) to evaluate the highest win-rate discard.
    *   **Undo (悔棋):** Step back up to 50 previous moves to correct mistakes or test different strategies.

### E. 覆盤 (Match Replay & Analysis Mode)
*   **Objective:** A post-game mode allowing users to scrub through a completed AI Arena match to analyze both player and AI decisions turn-by-turn.
*   **Functionality:**
    *   Accessed via the "覆盤" button on the Game Over screen or by clicking an old match in the History tab.
    *   **Omniscience:** The AI's hand is permanently revealed face-up.
    *   **Timeline Scrubbing:** Users can use a slider or Next/Prev buttons to fast-forward or rewind the exact state of the board at any given step.
    *   **AI Thoughts Panel:** Whenever the current timeline step is an AI discard, a frosted-glass panel reveals exactly why the AI made that move.
    *   **"Before ➡️ After" Comparison:** Displays the exact Shanten, Wait Types (款), and Tile Count (張) *before* the AI made its move compared to *after* its chosen discard, complete with dynamic green/red color coding to highlight mathematical improvements or regressions.
    *   **Decision Breakdown:** Lists the top alternative tiles the AI considered alongside their respective DP stats (X款 Y張) or Monte Carlo Win Rates (%).

### F. Monte Carlo Simulation Mode (蒙地卡羅演算法)
*   **Objective:** A deep-dive analytical mode to simulate thousands of future draws based on a specific discard. It evaluates the absolute best long-term outcome rather than just the immediate 1-step acceptance.
*   **Mechanics:**
    *   Simulates drawing and discarding repeatedly until a Win (-1 Shanten) or the max draw limit is reached.
    *   **Context-Aware Simulation:** The engine automatically detects "dead" tiles from the board (e.g., rivers and open melds in AI Arena) and subtracts them from the remaining wall prior to simulation.
*   **Settings Modal:** Hand Sizes, Tile Pool, Bot Policy (Greedy or Random), Max Draws, and Iterations.
*   **Performance:** Uses a Web Worker Pool (`mcWorker.js`) to run parallel simulations without freezing the UI, utilizing an In-Worker State Cache for speed.
*   **Results:** Displays Win Rate, Tenpai Rate, Avg Draws, and a breakdown of the Top 20 Final Hands achieved.

### G. Calculator Mode (進張計算機)
*   **Objective:** A sandbox mode for testing custom hands.
*   **Functionality:** 
    *   Users can freely click tiles in generated hands to see their exact discard stats without affecting their dashboard Accuracy.
    *   **Edit Hand:** A visual tile keyboard allows manual construction of hands (up to 17 tiles).
    *   **To Monte Carlo:** A quick-action button seamlessly transitions the hand state into MC mode.

## 4. Application Architecture & Folder Structure

```text
/
├── index.html            # Main entry point, UI layout, Tailwind config, PWA registration
├── sw.js                 # Service Worker (Caching logic and auto-update listener)
├── manifest.json         # PWA Manifest pointing to icon.svg
├── assets/icons/         
│   └── icon.svg          # Scalable Red Dragon "中" app icon
├── scripts/              
│   └── scrapeTenhou.js   # Puppeteer Node script to generate test cases
├── tests/
│   ├── engine.test.js    # Unit tests for the Shanten / Mahjong engine
│   └── scrapedCases.js   # Auto-generated test cases used by the test suite
└── src/js/
    ├── app.js            # Main application UI logic, stat rendering, and event bindings
    ├── constants.js      # Global constants (TILE_NAMES, SUITS, ALL_TILES)
    ├── storage.js        # Abstraction for localStorage operations (stats tracking)
    ├── components/
    │   └── Tile.js       # UI Component logic: Renders tiles using HTML/CSS and Unicode chars
    └── engine/
        ├── handGenerator.js # Logic to generate random, valid hands based on settings
        ├── shanten.js       # The Core Engine: DP Algorithm for Shanten calculation
        └── mcWorker.js      # Web Worker for off-thread Monte Carlo simulations
```

## 5. Mahjong Engine Deep Dive (`shanten.js`)

The most complex part of this application is the Mahjong Engine. Understanding this is crucial for any developer touching the project.

### Tile Representation
Tiles are represented as 2-character strings: `[value][suit]`.
*   **Suits:** `m` (Manzu/Characters), `p` (Pinzu/Circles), `s` (Souzu/Bamboos), `z` (Jihai/Honors).
*   **Values:** `1-9` for m, p, s. `1-7` for z (East, South, West, North, White, Green, Red).
*   *Example:* `1m` = 1 Character, `5z` = White Dragon.

**UI Rendering:**
The application uses pure HTML/CSS and standard Unicode Mahjong characters (e.g., `🀇`, `🀀`) inside `src/js/components/Tile.js` to render the tiles. This approach bypasses cross-platform SVG baseline alignment bugs and ensures perfect vertical centering across all mobile operating systems.

### Shanten Calculation (Dynamic Programming)
*   **Shanten (向聽):** The minimum number of tile swaps required to reach a winning state (Tenpai is 0 Shanten, Win is -1 Shanten).
*   **The DP Algorithm:** `shanten.js` uses a highly optimized Dynamic Programming (DP) approach with memoization. It converts a hand into frequency arrays and recursively attempts to extract valid structures:
    1.  **Melds (面子):** Sequences (Chows) or Triplets (Pungs).
    2.  **Pairs (雀頭):** Two identical tiles.
    3.  **Taatsus (塔子):** Incomplete melds waiting for one tile (e.g., 1-2 waiting for 3, or 1-3 waiting for 2).
*   **Performance:** Mahjong calculation trees can grow massive. The `dpMemo` Map caches suit evaluations so identical subsets aren't recalculated, ensuring real-time UI performance even for 17-tile hands.

### Special Hand Calculations
The engine automatically detects the "base size" of the hand (e.g., 13 for Japanese/HK style, 16 for Taiwan style) and calculates alternative Shanten for special winning hands that do not follow the standard "N Melds + 1 Pair" format. The final Shanten returned is the minimum across all possibilities.

**Supported Special Forms:**
*   **Japanese/HK Base (13/14 tiles):**
    *   **Seven Pairs (Chiitoitsu):** 7 pairs.
    *   **Thirteen Orphans (Kokushi Musou):** 1 of every 1s, 9s, 1p, 9p, 1m, 9m, and all 7 honors + 1 duplicate.
*   **Taiwan Base (16/17 tiles):**
    *   **嚦咕嚦咕 (Li Gu Li Gu):** 7 pairs + 1 triplet (Pung).
    *   **十三么 (Taiwan Kokushi):** 13 orphans + 1 pair + 1 triplet.
    *   **十六不搭 (Shi Liu Bu Da):** A hand composed entirely of the 7 honors + 3 specific, mutually un-connectable tiles per suit (e.g., 1-4-7, 2-5-9) + exactly 1 pair.

## 6. Testing & Validation

Validating a Mahjong algorithm is difficult. Instead of only hand-writing tests, this project utilizes **Tenhou.net's Hairi (牌理) calculator** as a ground truth.

*   **`scripts/scrapeTenhou.js`**: Generates random 14-tile strings, sends them to Tenhou using Puppeteer, parses Tenhou's DOM for the correct Shanten count, and outputs them as JSON format into `tests/scrapedCases.js`. 
*   *(Note: Tenhou is Japanese Mahjong which defaults to 13+1 tiles, but standard Shanten mathematical principles are identical to Taiwan Mahjong, making these tests perfectly valid for our engine).*
*   **Running tests:** Check `tests/engine.test.js` to see how the engine's output is validated against the scraped Tenhou cases.

## 7. Developer Onboarding Guide

1.  **Run Locally:** Since there is no build process (Tailwind via CDN), you just need a local static web server. You can use VS Code's "Live Server" extension, or run `npx serve` or `python -m http.server` in the root directory.
2.  **UI Edits:** Make changes directly in `index.html` or `src/js/app.js`. Tailwind classes are parsed dynamically by the CDN.
3.  **Engine Edits:** If you touch `src/js/engine/shanten.js`, you **must** run the test suite to ensure no regressions occur in Shanten calculation. The DP logic is extremely sensitive.
4.  **Generating More Tests:** Run `node scripts/scrapeTenhou.js` to fetch more edge cases if you encounter a bug in the engine. Ensure dependencies (`npm install`) are present first.

## 8. Developer Workflow & Efficiency Guide

For future developers picking up this project, here is the recommended mindset and methodology for efficiently debugging, tracing, and implementing features in this codebase.

### A. Tracing State (The "Data Flow" Mindset)
This app is fundamentally a state machine. Instead of trying to read DOM elements to figure out what is happening, always trace the data objects.
*   **Two Core States:** You only need to care about `currentGameState` (for Training/Calc modes) and `vsGameState` (for the AI Arena). 
*   **The Trajectory Pattern:** When debugging game logic (like "Why did the Tsumo button appear incorrectly?"), look at `vsGameState.trajectory`. It holds the precise history of actions (`[{actor: 'player', action: 'draw', tile: '1m'}, ...]`). Validating against this history is much safer than relying on arbitrary boolean flags.
*   **Rule Enforcement:** Implement game rules (like Kuikae / forbidden discards) directly in the state (`vsGameState.forbiddenDiscard`) immediately after the action that triggers them (e.g., inside `executeChi`), and validate them at the entry point of the next action (`vsPlayerDiscard`).

### B. Surgical Debugging & Implementation
When tasked with adding a new feature or fixing a bug, avoid full rewrites. Use "surgical" techniques:
*   **Locate via Constants:** Need to fix how a tile renders? Search for `TILE_NAMES` or `UNICODE_MAP` instead of blindly scrolling through HTML.
*   **Isolate the Engine:** If you suspect an engine calculation is wrong (Shanten or Acceptance), do not debug it through the UI. Write a quick hardcoded test case in `tests/engine.test.js`, run `npm test`, and use Node's debugger. The UI only formats the engine's output.
*   **Monte Carlo Debugging:** The MC engine runs in Web Workers. If it fails silently, the issue is almost always a data serialization problem between the main thread and `mcWorker.js` via `postMessage`. Ensure you are only passing standard arrays/objects, not DOM elements or complex class instances.

### C. UI/UX Philosophy (Mobile-First Constraints)
Taiwan Mahjong has massive physical constraints (up to 17 tiles in hand, dozens in the river). When designing UI, use the "Physical Table" mindset:
*   **Calculate Maximums First:** Before adding a grid or a container, ask: "What is the absolute maximum number of items this will hold?" (e.g., 52 discards per player in a draw). Build the layout to handle that maximum without breaking the screen.
*   **Fixed Overlays vs. Internal Scroll:** Internal scrollbars (`overflow-y-auto` on small divs) provide a poor touch experience. Instead, pin critical interaction areas (like the player's hand and action buttons) to the bottom of the screen (`position: fixed; bottom: 0`) and allow the central content (the rivers) to scroll naturally under them.
*   **Leverage Tailwind Power:** Use `flex flex-wrap gap-x` instead of strict `grid` layouts for tiles. Tiles need to flow naturally based on the device width. Use `backdrop-blur` for overlays so users can still perceive the table context underneath.

### D. The Golden Rule of Committing
If you touch `src/js/engine/shanten.js` or `src/js/engine/mcWorker.js`, you **must** run `npm test` before considering the job done. The DP algorithm is heavily memoized; changing a single index can break evaluation trees for 17-tile hands while 14-tile hands appear to work fine. Trust the test suite.
