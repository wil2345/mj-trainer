import { decideAiInterrupt, decideAiDiscard } from '../src/js/engine/aiPolicy.js';

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

    console.log("\n=========================================");
    console.log(`  RESULT: ${passed} / ${passed + failed} Passed`);
    console.log("=========================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
