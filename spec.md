# Taiwan Mahjong Trainer - Project Specification (v1.5.0)

## 1. Project Overview
**Taiwan Mahjong Trainer (`mj-trainer`)** is a Progressive Web App (PWA) designed to help players practice and master Taiwan Mahjong discard strategies. 

Beyond isolated efficiency training, the app features a full 1-on-1 AI Arena to simulate real game conditions including calling mechanics and endgame pressure.

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
*   **Accuracy Tracking:** Tracks the percentage of times the user selects the mathematically optimal discard.
*   **Tests Done:** Total number of decisions made.
*   **Current & Max Streaks:** Tracks consecutive strings of correct discards.
*   **Average Time:** Tracks the average time (in seconds) it takes to make a discard (can be toggled in settings).
*   **Visual Tiers:** Stats change colors dynamically based on performance (e.g., Accuracy turns Red below 50%, Emerald above 75%, Golden above 90%).
*   **Data Management:** Users can reset all statistics via the "Clear History" option in the global "..." menu.

### B. History Tracking
*   **Past Tests:** The app seamlessly records up to the last 500 decisions, saving the hand, user choice, correctness, and time spent.
*   **History View:** Accessible via the global menu. Displays a scrollable feed of past hands with clear "CORRECT" or "WRONG" badges.
*   **Review Mode:** Clicking any past record card instantly loads that specific hand into the Sandbox Calculator for in-depth analysis of the missed optimal discards.

### C. Training Mode (最大機率打法練習)
*   **Objective:** The user is presented with a random, valid Mahjong hand. They must select the tile to discard that gives them the highest number of acceptable drawn tiles to advance their hand.
*   **Settings Modal:** Users can adjust settings before starting:
    *   **Hand Sizes:** 5, 8, 11, 14, and 17 tiles. (Defaults to 8).
    *   **Tile Pool:** Option to include or exclude Winds & Dragons (Honors). **Defaults to Off**.
    *   **Record Time Taken:** Toggles whether the decision time is logged to the dashboard's "Average Time" stat.
    *   **Display Live Timer:** Toggles a live `0.0s` clock in the header during the game.
*   **Feedback:** Analyzes the discard, showing:
    *   The user's resulting Shanten (向聽) and Acceptance (進張).
    *   If incorrect, it displays the optimal discard(s) below it for comparison.
    *   If correct (but multiple optimal moves exist), it shows a slider of the *other* optimal choices.
*   **Share Functionality:** Generates a custom URL with the exact hand state (e.g., `?hand=123m456p`) and copies it to the clipboard.

### D. AI對戰練習 (1-on-1 AI Arena)
*   **Objective:** A full game simulation where the player plays against an AI bot in a 16-tile Taiwan Mahjong match.
*   **Full Mechanics:** Supports all standard Mahjong actions:
    *   **上 (Chi)**: Forming sequences from opponent discards.
    *   **碰 (Pon)**: Forming triplets from opponent discards.
    *   **槓 (Kan)**: Open Kan, Ankan (Closed), and Kakan (Added). 
    *   **糊 (Ron) / 自摸 (Tsumo)**: Winning mechanics with full Shanten validation. Both actions utilize golden UI highlights.
*   **AI Settings:**
    *   **Difficulty (難度):** Expert (Perfect efficiency), Beginner (Suboptimal moves), Random (Random discards).
    *   **Play Style (打法風格):** Aggressive (Calls to improve hand), Balanced (Calls to improve hand), Defensive (Calls only if discard is 100% safe).
    *   **Show AI State (顯示AI叫糊狀態):** Toggles dynamic badges showing the AI's exact Shanten count (X向聽) or a pulsing red "叫糊" badge when waiting. Hides automatically upon game over.
    *   **AI Speed Mode (極速AI模式):** Toggles between a 1-second "human-like" delay for AI actions (default) or instant execution (0ms) for speed training.
*   **Advanced Features:**
    *   **Strict Improvement Rule:** The AI will never make a "sideways" call (like kuikae) that locks its hand without mathematical benefit. A call MUST lower Shanten OR increase total tile acceptance.
    *   **Defensive Safety Logic:** When set to Defensive, the AI will prioritize discarding tiles that exist in the player's river or have been explicitly stolen from the player, ensuring it does not deal into a Ron.
    *   **Expert MC Logic:** The Expert AI uses internal Monte Carlo simulations for endgame hands (8 or fewer tiles, running up to 5 draws deep) to evaluate the best long-term discard, rigorously avoiding backward Shanten jumps.
    *   **Undo (悔棋):** Step back to previous moves to correct mistakes or test different strategies.
    *   **Seeded Matches:** Every game has a unique numeric seed (with a one-click copy button), allowing matches to be perfectly reproduced and shared.
    *   **Accurate Melds:** Open melds correctly reflect standard rules by displaying the "stolen" tile visually in the center of the set (e.g., placing the called `4s` between a `5s` and `6s` in a Chi).
    *   **Realism:** AI Ankan tiles remain hidden until game-over or manual "Show Hand" toggle.

### E. Monte Carlo Simulation Mode (蒙地卡羅演算法)
*   **Objective:** A deep-dive analytical mode to simulate thousands of future draws based on a specific discard. It evaluates the absolute best long-term outcome rather than just the immediate 1-step acceptance.
*   **Mechanics:**
    *   Simulates drawing and discarding repeatedly until a Win (-1 Shanten) or the max draw limit is reached.
    *   The bot uses a selectable policy (Greedy or Random) to play out the simulation.
    *   **Context-Aware Simulation:** The engine automatically detects "dead" tiles from the board (e.g., rivers and open melds in AI Arena) and subtracts them from the remaining wall prior to simulation, ensuring precise real-world probabilities.
*   **Settings Modal:**
    *   **Hand Sizes:** 5, 8, 11, 14, and 17 tiles.
    *   **Tile Pool:** Option to include or exclude Winds & Dragons. **Defaults to On**.
    *   **Bot Policy:** Choose between **最大機率 (Greedy)** (bot plays optimally) or **隨機 (Random)** (bot plays poorly).
    *   **Max Draws:** The limit of turns simulated per run (3, 5, 7, or 10 draws).
    *   **Iterations:** The number of times the simulation is run (100, 1,000, 5,000, or 10,000 runs).
*   **Performance (Multi-Threading):** 
    *   Utilizes a **Web Worker Pool** (`mcWorker.js`) to offload heavy DP calculations from the main thread.
    *   Spawns multiple workers dynamically based on the device's CPU cores (`navigator.hardwareConcurrency`) to execute runs in parallel, drastically reducing calculation time.
    *   Employs an **In-Worker State Cache** to memorize optimal moves for previously seen hand configurations during a simulation, providing a massive speed boost.
*   **Results Display:**
    *   **Win Rate:** Percentage of runs that reached a winning hand.
    *   **Reached Tenpai:** Percentage of runs that successfully built a ready hand (or won).
    *   **Average Draws:** Average turns required to win.
    *   **Top 20 Final Hands:** A detailed breakdown of the exact shapes the hand ended in, sorted by occurrence count and resulting Shanten, complete with exact probabilities and frequency counts.
    *   **Rerun:** Users can trigger a fresh background simulation bypassing the local cache to re-verify stochastic results.

### F. Calculator Mode (進張計算機)
*   **Objective:** A sandbox mode for testing custom hands.
*   **Functionality:** 
    *   Users can freely click tiles in generated hands to see their exact discard stats without affecting their dashboard Accuracy.
    *   **Edit Hand:** A visual tile keyboard allows users to manually construct hands (up to 17 tiles) to analyze specific real-world scenarios. Includes a "Clear All" utility.
    *   **To Monte Carlo:** A quick-action button allows seamless transition of the hand state into the Monte Carlo Simulation mode for deeper analysis.
    *   Shared URLs automatically open in this mode to prevent skewing the recipient's training stats.

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
