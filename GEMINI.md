# Taiwan Mahjong Trainer (mj-trainer)

## Project Overview
This project is a Progressive Web App (PWA) designed to help players train and improve their Taiwan Mahjong skills. It focuses on core mechanics like discard strategy, wait calculation, and hand efficiency.

### Technology Stack
*   **Frontend:** Vanilla JavaScript (ES6+) and HTML5.
*   **Styling:** Tailwind CSS (via Play CDN).
*   **Platform:** Progressive Web App (PWA) for cross-platform mobile and desktop usage.
*   **Data Persistence:** Browser `localStorage` for tracking progress and statistics.

## Directory Structure
*   `index.html`: Main entry point and layout.
*   `src/js/app.js`: Main application logic.
*   `src/js/storage.js`: Handles `localStorage` reads/writes for user stats.
*   `assets/icons/`: PWA icons.
*   `manifest.json`: PWA web app manifest.
*   `sw.js`: Service Worker for offline caching support.

## Building and Running
*   **Development:** Open `index.html` via a local live server (e.g., VS Code Live Server, or `npx serve`, `python -m http.server`). There is no build step since we are using the Tailwind Play CDN.
*   **Deployment:** Static hosting (GitHub Pages, Vercel, Netlify, etc.).

## Development Conventions
*   **Modular JS:** Use ES modules to separate game logic from UI state and storage.
*   **Utility-First:** Use Tailwind classes for all styling; avoid custom CSS where possible.
*   **PWA First:** Ensure offline-first functionality and responsive design for mobile play.
*   **Persistent Data:** Always read/write user progress to `localStorage` to ensure a continuous training experience.
