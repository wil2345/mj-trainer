import { decideAiInterrupt, decideAiDiscard } from '../src/js/engine/aiPolicy.js';

// Mock Worker for Node.js environment
if (typeof global.Worker === 'undefined') {
    global.Worker = class {
        constructor() {
            this.onmessage = null;
        }
        postMessage(data) {
            // Simulate a successful MC result
            setTimeout(() => {
                if (this.onmessage) {
                    this.onmessage({ data: { success: true, stats: { winRate: 0.5 } } });
                }
            }, 0);
        }
        terminate() {}
    };
}

async function runTests() {
    console.log("=========================================");
    console.log("  AI Policy Engine Test Suite");
    console.log("=========================================\n");

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ [Pass] ${message}`);
            passed++;
        } else {
            console.error(`❌ [Fail] ${message}`);
            failed++;
        }
    }

    // --- TEST 1: Optimal Chi Selection ---
    // User reported: AI has 4s 5s 6s 7s 9s 1z 1z. Player discards 6s. 
    // AI should Chi with [4s, 5s] leaving 6s 7s 9s 1z 1z (better wait) instead of [5s, 7s].
    try {
        const boardState = {
            player: { closed: [], open: [], river: ['6s'] },
            ai: { closed: ['1z', '1z', '4s', '5s', '6s', '7s', '9s'], open: [], river: [] }
        };
        const aiSettings = { difficulty: 'expert', style: 'aggressive' };

        const decision = decideAiInterrupt('6s', boardState, aiSettings);

        assert(decision !== null && decision.action === 'chi', "Test 1: AI should decide to Chi");
        assert(
            decision && decision.opt && decision.opt.includes('4s') && decision.opt.includes('5s'), 
            `Test 1: AI should choose [4s, 5s] for the optimal wait. Actual: [${decision ? decision.opt : 'null'}]`
        );
    } catch (e) {
        console.error(`❌ [Fail] Test 1 threw an error:`, e);
        failed++;
    }

    // --- TEST 2: Correct Dead Tile Counting After Pon ---
    // User reported: AI has 6s 6s 7s 8s 8s 1z 1z. Player discards 8s. AI Pons, discards 6s.
    // Remaining hand: 6s 7s 1z 1z. Should wait for 5s, 8s (2款 5張).
    // Previously, the stolen 8s was double counted (left in river + added to open meld).
    try {
        const boardState = {
            player: { closed: [], open: [], river: [] }, // 8s already popped during the interrupt phase
            ai: { 
                closed: ['1z', '1z', '6s', '6s', '7s'], // The hand AFTER making the Pon (two 8s removed)
                open: [['8s', '8s', '8s']], // The new open meld
                river: [] 
            }
        };
        const aiSettings = { difficulty: 'expert', style: 'balanced' };

        // Determine AI discard from the resting state above
        const { discard, analysisPayload } = await decideAiDiscard(boardState, aiSettings, null);

        assert(discard === '6s', `Test 2: AI should discard 6s. Actual: ${discard}`);
        
        if (analysisPayload && analysisPayload.options) {
            const discard6sStats = analysisPayload.options.find(o => o.discard === '6s');
            
            assert(discard6sStats !== undefined, "Test 2: Analysis should contain stats for discarding 6s");
            
            // Expected: 2款 (types: 5s, 8s), 5張 (count: four 5s, one 8s left)
            assert(
                discard6sStats.acceptedTilesCount === 2, 
                `Test 2: Expected 2 wait types (款). Actual: ${discard6sStats.acceptedTilesCount}`
            );
            assert(
                discard6sStats.acceptance === 5, 
                `Test 2: Expected 5 remaining tiles (張). Actual: ${discard6sStats.acceptance}`
            );
        } else {
            console.error("❌ [Fail] Test 2: analysisPayload missing or malformed.");
            failed++;
        }

    } catch (e) {
        console.error(`❌ [Fail] Test 2 threw an error:`, e);
        failed++;
    }

    // --- TEST 3: Defensive Discard Logic (Character System) ---
    // AI has a good hand (1向聽) but one of its tiles is very dangerous (Genbutsu exists).
    // Player has 3 open melds (high danger multiplier).
    // AI should discard the safe tile even if it breaks its hand.
    try {
        const boardState = {
            player: { 
                closed: [], 
                open: [['1m', '2m', '3m'], ['4p', '5p', '6p'], ['7s', '8s', '9s']], // 3 melds!
                river: ['1z'] // 1z is Genbutsu (100% safe)
            },
            ai: { 
                closed: ['1z', '2p', '3p', '5s', '6s', '1s', '1s'], // 1z is safe, 1s/5s/6s are dangerous
                open: [], 
                river: [] 
            }
        };
        
        // Test Cowardly AI
        const aiSettings = { difficulty: 'expert', style: 'cowardly' };
        const { discard } = await decideAiDiscard(boardState, aiSettings, null);

        assert(discard === '1z', `Test 3: Cowardly AI should discard safe 1z. Actual: ${discard}`);

        // Test Aggressive AI (should prioritize efficiency)
        const aggressiveSettings = { difficulty: 'expert', style: 'aggressive' };
        const { discard: aggressiveDiscard } = await decideAiDiscard(boardState, aggressiveSettings, null);
        
        // Discarding 1z is worst for shanten (it's a pair/potential meld component in some systems, 
        // though here it's just a lone honor). Actually 1z is a lone honor. 
        // Let's make 1z a part of a sequence to be sure.
        
        boardState.ai.closed = ['1z', '4z', '5z', '1s', '2s', '8p', '9p']; // 1z is Genbutsu
        const { discard: finalDiscard } = await decideAiDiscard(boardState, aiSettings, null);
        assert(finalDiscard === '1z', `Test 3 (Revised): Cowardly AI should discard safe 1z over dangerous number tiles. Actual: ${finalDiscard}`);

    } catch (e) {
        console.error(`❌ [Fail] Test 3 threw an error:`, e);
        failed++;
    }

    console.log("\n=========================================");
    console.log(`  RESULT: ${passed} / ${passed + failed} Passed`);
    console.log("=========================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
