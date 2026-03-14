import { getDiscardAnalysis, calculateShanten } from '../src/js/engine/shanten.js';
import { ALL_TILES } from '../src/js/constants.js';
import { tenhouScrapedCases } from './scrapedCases.js';

// --- HELPER: Parse Tenhou String to our Array Format ---
// e.g. "123m456p" -> ["1m", "2m", "3m", "4p", "5p", "6p"]
function parseTenhouString(tenhouStr) {
    let hand = [];
    let currentNumbers = [];
    
    for (let char of tenhouStr) {
        if (['m', 'p', 's', 'z'].includes(char)) {
            currentNumbers.forEach(num => {
                hand.push(`${num}${char}`);
            });
            currentNumbers = []; // reset for next suit
        } else {
            // It's a number
            currentNumbers.push(char);
        }
    }
    return hand;
}

// --- HARDCODED TEST CASES ---
// Format: { query: 'tenhou_string', expectedShanten: number, bestDiscard: 'tile' }
const hardcodedTestCases = [
    {
        name: "Simple 1-Shanten (Wait for 3m or 6m)",
        query: "111m45m123p456s11z", 
        expectedShanten: 0 // 0 shanten (Tenpai) because we only need 1 tile to win.
    },
    {
        name: "User provided tenhou example (14 tiles)",
        query: "1555m469p13469s36z", 
        expectedShanten: 3
    },
    {
        name: "Winning Hand (14 tiles)",
        query: "123m456p789s11222z", 
        expectedShanten: -1
    },
    {
        name: "Complex Overlap (14 tiles)",
        query: "2334455m11p123s55z", 
        // 2334455m is a complex shape: [234] + [345] + [5]
        // This is 0 Shanten (Tenpai) waiting for the final pair/meld
        expectedShanten: 0
    },
    {
        name: "Standard 3-Shanten (14 tiles)",
        query: "1258m369p147s1233z", // added an extra '3z' to make it 14 tiles
        // Terribly disconnected hand. Wait for pairs/shapes.
        // Current: 1 pair (33z). 0 melds. 1 taatsu (12m).
        // Standard Shanten = 8 (max for 14) - 0 (melds) - 1 (usable taatsu) - 1 (pair) = 6 Shanten.
        // However, with Kokushi Musou (13 Orphans) logic now added, this hand has:
        // 1m, 9p, 1s, 1z, 2z, 3z (6 orphans) + 1 pair of 3z.
        // Kokushi Shanten = 13 - 6 - 1 = 6 Shanten? Wait, let's recalculate Kokushi:
        // Orphans present: 1m, 9p, 1s, 1z, 2z, 3z. (6 unique orphans). Pair is present.
        // 13 - 6 (unique) - 1 (pair) = 6 Shanten.
        // What about Chiitoitsu (7 pairs)? 1 pair. 6 - 1 = 5 Shanten!
        // Chiitoitsu is 5 Shanten because it only needs to upgrade 5 singles to pairs.
        expectedShanten: 5
    },
    {
        name: "Ittsu (Straight) shape with extra tiles (14 tiles)",
        query: "123456789m11p123s",
        // 1-9m (3 melds), 123s (1 meld), 11p (pair) -> Winning hand
        expectedShanten: -1
    },
    {
        name: "Sanbaiman shape - Ryanpeikou base (14 tiles)",
        query: "223344556677m11z",
        // Seven Pairs / Ryanpeikou (Two sets of identical sequences)
        // 234, 234, 567, 567 + pair. 
        expectedShanten: -1
    },
    {
        name: "Heavy Taatsu overlap (14 tiles)",
        query: "33345678m11p111s",
        // 333 (1 meld), 456 (1 meld), 78 (taatsu), 11 (pair), 111 (1 meld). 
        // We have 3 melds + 1 taatsu + 1 pair = 1 tile away from 4 melds.
        expectedShanten: 0
    }
];

function runTests() {
    console.log("=========================================");
    console.log("  Mahjong Engine Test Suite (Shanten DP)");
    console.log("=========================================\n");

    let totalTests = 0;
    let passedTests = 0;

    // 1. Run Hardcoded Cases
    console.log("--- PART 1: Hardcoded Edge Cases ---");
    hardcodedTestCases.forEach((tc, index) => {
        totalTests++;
        const hand = parseTenhouString(tc.query);
        const shanten = calculateShanten(hand);
        
        if (shanten === tc.expectedShanten) {
            passedTests++;
            console.log(`✅ [Hardcoded ${index + 1}] Pass: ${tc.name}`);
        } else {
            console.log(`❌ [Hardcoded ${index + 1}] FAIL: ${tc.name}`);
            console.log(`   Query: ${tc.query}`);
            console.log(`   Expected: ${tc.expectedShanten}, Got: ${shanten}`);
        }
    });

    // 2. Run Scraped Cases
    console.log("\n--- PART 2: Scraped Tenhou Cases (100) ---");
    tenhouScrapedCases.forEach((tc, index) => {
        totalTests++;
        const hand = parseTenhouString(tc.query);
        const shanten = calculateShanten(hand);
        
        if (shanten === tc.expectedShanten) {
            passedTests++;
            // Don't log every single success to avoid cluttering terminal
            if ((index + 1) % 10 === 0) console.log(`Processed ${index + 1}/100 scraped cases...`);
        } else {
            console.log(`❌ [Scraped ${index + 1}] FAIL!`);
            console.log(`   Query: ${tc.query}`);
            console.log(`   Expected: ${tc.expectedShanten}, Got: ${shanten}`);
        }
    });

    console.log("\n=========================================");
    console.log(`  RESULT: ${passedTests} / ${totalTests} Passed`);
    console.log("=========================================");

    if (passedTests === totalTests) {
        console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    } else {
        process.exit(1); // Exit with failure code
    }
}

runTests();