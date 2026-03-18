import { runMatch } from './simulator.js';

const ITERATIONS = 50; // Number of unique seeds (reduced for speed)
const CHUNK_SIZE = 10; // How many seeds to process concurrently

const PROFILES = [
    { name: 'Gambler (Aggressive)', difficulty: 'expert', style: 'aggressive' },
    { name: 'Tactician (Balanced)', difficulty: 'expert', style: 'balanced' },
    { name: 'Wall (Defensive)', difficulty: 'expert', style: 'defensive' },
    { name: 'Folder (Cowardly)', difficulty: 'expert', style: 'cowardly' }
];

async function runBenchmark(profile1, profile2) {
    console.log(`\n>>> Benchmarking: ${profile1.name} vs ${profile2.name} (${ITERATIONS} Seeds, Mirrored)`);
    
    const stats = {
        p1Wins: 0,
        p2Wins: 0,
        draws: 0,
        mirrorMatchesWonByP1: 0,
        mirrorMatchesWonByP2: 0
    };

    // Helper to run a single seed (both A and B matches)
    const runSeed = async (seed) => {
        const resA = await runMatch(seed, profile1, profile2, false);
        const resB = await runMatch(seed, profile1, profile2, true);
        return { seed, resA, resB };
    };

    for (let i = 0; i < ITERATIONS; i += CHUNK_SIZE) {
        const chunkPromises = [];
        for (let j = 0; j < CHUNK_SIZE && (i + j) < ITERATIONS; j++) {
            chunkPromises.push(runSeed(1000 + i + j));
        }

        // Wait for the chunk to finish and allow the event loop to breathe
        const results = await Promise.all(chunkPromises);
        
        results.forEach(({ resA, resB }) => {
            const p1WonA = resA.winner === 'A';
            const p1WonB = resB.winner === 'B';
            const p2WonA = resA.winner === 'B';
            const p2WonB = resB.winner === 'A';

            if (p1WonA) stats.p1Wins++;
            if (p1WonB) stats.p1Wins++;
            if (p2WonA) stats.p2Wins++;
            if (p2WonB) stats.p2Wins++;
            if (resA.winner === 'DRAW') stats.draws++;
            if (resB.winner === 'DRAW') stats.draws++;

            if (p1WonA && p1WonB) stats.mirrorMatchesWonByP1++;
            if (p2WonA && p2WonB) stats.mirrorMatchesWonByP2++;
        });

        process.stdout.write('.');
        
        // Yield to the event loop so VS Code doesn't freeze
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    console.log('\n-----------------------------------------');
    console.log(`Results for ${profile1.name}:`);
    console.log(`  Total Wins: ${stats.p1Wins} (${((stats.p1Wins / (ITERATIONS * 2)) * 100).toFixed(1)}%)`);
    console.log(`  Dominant Wins (Both Seats): ${stats.mirrorMatchesWonByP1}`);
    console.log(`Results for ${profile2.name}:`);
    console.log(`  Total Wins: ${stats.p2Wins} (${((stats.p2Wins / (ITERATIONS * 2)) * 100).toFixed(1)}%)`);
    console.log(`  Dominant Wins (Both Seats): ${stats.mirrorMatchesWonByP2}`);
    console.log(`Draws: ${stats.draws}`);
    console.log('-----------------------------------------');
}

async function startTournament() {
    console.log("=========================================");
    console.log("  AI vs AI Tournament Simulation");
    console.log("  (16-tile Taiwan Mahjong rules)");
    console.log("=========================================");

    const startTime = Date.now();

    await runBenchmark(PROFILES[0], PROFILES[2]); // Gambler vs Wall
    await runBenchmark(PROFILES[1], PROFILES[3]); // Tactician vs Folder
    await runBenchmark(PROFILES[0], PROFILES[3]); // Gambler vs Folder

    const endTime = Date.now();
    console.log(`\nSimulation completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);
}

startTournament().catch(console.error);
