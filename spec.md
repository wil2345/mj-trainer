# Taiwan Mahjong Trainer - Project Specification

## 1. Project Overview
**Taiwan Mahjong Trainer (`mj-trainer`)** is a Progressive Web App (PWA) designed to help players practice and master Taiwan Mahjong discard strategies. 

Unlike full game simulators, this app focuses heavily on **efficiency training**: calculating "Shanten" (how many tiles away from a winning hand) and finding the mathematically optimal discard to maximize "tile acceptance" (進張數).

## 2. Technology Stack
*   **Frontend Environment:** Vanilla JavaScript (ES6+ modules), HTML5.
*   **Styling:** Tailwind CSS (via Play CDN - *Note: No frontend build step is required*).
*   **Theme:** Emerald Green (`#10b981`) and Blue (`#3b82f6`) color palette.
*   **Data Persistence:** Browser `localStorage` (Offline-first, no backend database).
*   **PWA Support:** 
    *   `manifest.json` and Service Worker (`sw.js`) for caching and offline play.
    *   **Auto-Update Mechanism:** The service worker listens for `updatefound` events and prompts the user with a "New version available!" toast, using `skipWaiting()` to seamlessly hot-reload the app upon confirmation.
    *   Uses a singular, scalable vector graphic (`icon.svg`) for all device icon sizes.
*   **Testing / Tooling:** Node.js, Puppeteer (for scraping test cases from Tenhou).

## 3. Core Features

### A. Dashboard & Statistics
*   **Accuracy Tracking:** Tracks the percentage of times the user selects the mathematically optimal discard.
*   **Tests Done:** Total number of decisions made.
*   **Current & Max Streaks:** Tracks consecutive strings of correct discards.
*   **Average Time:** Tracks the average time (in seconds) it takes to make a discard (can be toggled in settings).
*   **Visual Tiers:** Stats change colors dynamically based on performance (e.g., Accuracy turns Red below 50%, Emerald above 75%, Golden above 90%).
*   **Data Management:** Users can reset all statistics via the "..." (Kebab menu) in the top right of the global header.

### B. Training Mode (最大機率打法練習)
*   **Objective:** The user is presented with a random, valid Mahjong hand. They must select the tile to discard that gives them the highest number of acceptable drawn tiles to advance their hand.
*   **Settings Modal:** Users can adjust settings before starting:
    *   **Hand Sizes:** 5, 8, 11, 14, and 17 tiles. (Defaults to 8).
    *   **Tile Pool:** Option to include or exclude Winds & Dragons (Honors).
    *   **Record Time Taken:** Toggles whether the decision time is logged to the dashboard's "Average Time" stat.
    *   **Display Live Timer:** Toggles a live `0.0s` clock in the header during the game.
*   **Feedback:** Analyzes the discard, showing:
    *   The user's resulting Shanten (向聽) and Acceptance (進張).
    *   If incorrect, it displays the optimal discard(s) below it for comparison.
    *   If correct (but multiple optimal moves exist), it shows a slider of the *other* optimal choices.
*   **Share Functionality:** Generates a custom URL with the exact hand state (e.g., `?hand=123m456p`) and copies it to the clipboard.

### C. Calculator Mode (進張計算機)
*   **Objective:** A sandbox mode for testing custom hands.
*   **Functionality:** 
    *   Users can freely click tiles in generated hands to see their exact discard stats without affecting their dashboard Accuracy.
    *   **Edit Hand:** A visual tile keyboard allows users to manually construct hands (up to 17 tiles) to analyze specific real-world scenarios.
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
    │   └── Tile.js       # UI Component logic for rendering Mahjong tiles (SVG wrappers)
    └── engine/
        ├── handGenerator.js # Logic to generate random, valid hands based on settings
        └── shanten.js       # The Core Engine: DP Algorithm for Shanten calculation
```

## 5. Mahjong Engine Deep Dive (`shanten.js`)

The most complex part of this application is the Mahjong Engine. Understanding this is crucial for any developer touching the project.

### Tile Representation
Tiles are represented as 2-character strings: `[value][suit]`.
*   **Suits:** `m` (Manzu/Characters), `p` (Pinzu/Circles), `s` (Souzu/Bamboos), `z` (Jihai/Honors).
*   **Values:** `1-9` for m, p, s. `1-7` for z (East, South, West, North, White, Green, Red).
*   *Example:* `1m` = 1 Character, `5z` = White Dragon.

### Shanten Calculation (Dynamic Programming)
*   **Shanten (向聴):** The minimum number of tile swaps required to reach a winning state (Tenpai is 0 Shanten, Win is -1 Shanten).
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