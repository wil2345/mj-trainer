const puppeteer = require('puppeteer');
const fs = require('fs');

// Helper to generate a random valid 14-tile Tenhou string
const SUITS = ['m', 'p', 's', 'z'];
const MAX_VALS = { m: 9, p: 9, s: 9, z: 7 };

function generateRandomTenhouString(count = 14) {
    let pool = [];
    for (let suit of SUITS) {
        for (let i = 1; i <= MAX_VALS[suit]; i++) {
            pool.push({ val: i, suit: suit });
            pool.push({ val: i, suit: suit });
            pool.push({ val: i, suit: suit });
            pool.push({ val: i, suit: suit });
        }
    }

    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const hand = pool.slice(0, count);
    
    // Group by suit
    const grouped = { m: [], p: [], s: [], z: [] };
    hand.forEach(tile => grouped[tile.suit].push(tile.val));

    let resultStr = "";
    for (let suit of SUITS) {
        if (grouped[suit].length > 0) {
            grouped[suit].sort((a, b) => a - b); // Sort numbers
            resultStr += grouped[suit].join('') + suit;
        }
    }
    return resultStr;
}

async function scrapeTenhouTestCases(numCases = 5) {
    console.log(`Starting Puppeteer to generate ${numCases} test cases from Tenhou...`);
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    const generatedCases = [];

    for (let i = 0; i < numCases; i++) {
        const query = generateRandomTenhouString(14);
        const url = `https://tenhou.net/2/?q=${query}`;
        
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            
            // Wait for the specific element Tenhou uses to show text results
            await page.waitForSelector('#tehai', { timeout: 5000 });
            
            // Extract the result text
            const resultText = await page.evaluate(() => {
                const el = document.getElementById('tehai');
                return el ? el.innerText : "";
            });

            // Parse Shanten from Tenhou's output
            let shanten = -99;
            if (resultText.includes("和了")) {
                shanten = -1; // Win
            } else if (resultText.includes("聴牌") || resultText.includes("テンパイ")) {
                shanten = 0; // Tenpai
            } else {
                const match = resultText.match(/(\d+)向聴/);
                if (match && match[1]) {
                    shanten = parseInt(match[1], 10);
                }
            }

            if (shanten !== -99) {
                generatedCases.push({
                    query: query,
                    expectedShanten: shanten
                });
                console.log(`[${i+1}/${numCases}] Created: ${query} -> ${shanten} Shanten`);
            } else {
                console.log(`[${i+1}/${numCases}] Failed to parse. Raw output snippet: ${resultText.substring(0, 50)}`);
            }

        } catch (e) {
            console.log(`[${i+1}/${numCases}] Timeout or error on ${query}: ${e.message}`);
        }
    }

    await browser.close();

    // Write to a JS file so we can import it into our tests
    const fileContent = `// Auto-generated from tenhou.net\nexport const tenhouScrapedCases = ${JSON.stringify(generatedCases, null, 4)};\n`;
    fs.writeFileSync('./tests/scrapedCases.js', fileContent);
    console.log(`\nSuccessfully saved ${generatedCases.length} cases to tests/scrapedCases.js`);
}

// Run the scraper (generating 100 for speed right now)
scrapeTenhouTestCases(100);
