// storage.js
// Handles saving and loading user data from local storage

const STORAGE_KEY = 'tw-mj-trainer-stats';

// Default stats object
const defaultStats = {
    gamesPlayed: 0,
    correctDecisions: 0,
    totalDecisions: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalTimeMs: 0,
    timedDecisions: 0
};

/**
 * Load user stats from local storage.
 * @returns {Object} Stats object
 */
export const loadStats = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            return { ...defaultStats, ...JSON.parse(data) };
        }
    } catch (e) {
        console.error("Error loading stats from localStorage", e);
    }
    return { ...defaultStats };
};

/**
 * Save user stats to local storage.
 * @param {Object} stats Stats object to save
 */
export const saveStats = (stats) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
        console.error("Error saving stats to localStorage", e);
    }
};

/**
 * Update a specific stat.
 * @param {string} key Stat key to update
 * @param {any} value Value or function to modify the stat
 */
export const updateStat = (key, value) => {
    const stats = loadStats();
    
    if (typeof value === 'function') {
        stats[key] = value(stats[key]);
    } else {
        stats[key] = value;
    }

    // Automatically recalculate derived stats (like max streak)
    if (key === 'currentStreak' && stats.currentStreak > stats.maxStreak) {
        stats.maxStreak = stats.currentStreak;
    }

    saveStats(stats);
    return stats;
};

/**
 * Calculate win rate/accuracy
 * @returns {string} percentage
 */
export const getAccuracy = () => {
    const stats = loadStats();
    if (stats.totalDecisions === 0) return '-';
    const rate = (stats.correctDecisions / stats.totalDecisions) * 100;
    return `${rate.toFixed(1)}%`;
};

/**
 * Calculate average time taken per decision
 * @returns {string} time in seconds
 */
export const getAverageTime = () => {
    const stats = loadStats();
    if (!stats.timedDecisions || stats.timedDecisions === 0) return '-';
    const avgMs = stats.totalTimeMs / stats.timedDecisions;
    return `${(avgMs / 1000).toFixed(1)}s`;
};

/**
 * Clears all user stats from local storage.
 */
export const clearStats = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error("Error clearing stats from localStorage", e);
    }
};
