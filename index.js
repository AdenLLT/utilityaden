const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Global variables to manage state across restarts
let currentPage = null;
let currentBrowser = null;
let isBrowserRunning = false;

app.use(express.json());

// --- Dashboard UI ---
app.get('/', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Keeper Active - Fresh Cycle</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #1a1a1a; color: #fff; }
                h1 { color: #e74c3c; margin: 0 0 10px 0; }
                .status { background: #2a2a2a; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                .controls { background: #2a2a2a; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                button { background: #e74c3c; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 5px; cursor: pointer; }
                button:disabled { background: #555; cursor: not-allowed; }
                .view-container { border: 2px solid #444; min-height: 400px; text-align: center; background: #000; }
                img { max-width: 100%; }
            </style>
        </head>
        <body>
            <h1>🔴 Keeper Active - Restart Mode</h1>
            <div class="status">
                <p><strong>Status:</strong> <span id="statusText">Checking...</span></p>
                <p>⚠️ Browser closes completely between cycles to ensure freshness.</p>
            </div>
            <div class="controls">
                <button onclick="generateView()" id="viewBtn">📷 Screenshot (Only if Active)</button>
            </div>
            <div class="view-container" id="viewContainer"></div>
            <script>
                async function generateView() {
                    const btn = document.getElementById('viewBtn');
                    btn.disabled = true;
                    try {
                        const res = await fetch('/generate-view', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                            document.getElementById('viewContainer').innerHTML = '<img src="' + data.image + '" />';
                        } else {
                            alert('Browser is currently SLEEPING (Between cycles). Wait for launch.');
                        }
                    } catch(e) { console.error(e); } finally { btn.disabled = false; }
                }
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// --- API Endpoints ---
app.post('/generate-view', async (req, res) => {
    if (isBrowserRunning && currentPage) {
        try {
            const buffer = await currentPage.screenshot({ type: 'jpeg', quality: 60, encoding: 'base64' });
            res.json({ success: true, image: `data:image/jpeg;base64,${buffer}` });
        } catch (e) { res.json({ success: false, message: 'Browser Error' }); }
    } else {
        res.json({ success: false, message: 'Browser Closed' });
    }
});

// --- Helper Functions ---
function findChrome() {
    const paths = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', process.env.CHROME_PATH].filter(Boolean);
    for (const p of paths) { if (fs.existsSync(p)) return p; }
    throw new Error('Chrome not found.');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function updateCookies(page) {
    try {
        const cookies = await page.cookies();
        const formattedCookies = cookies.map((cookie, index) => ({
            domain: cookie.domain,
            hostOnly: !cookie.domain.startsWith('.'),
            httpOnly: cookie.httpOnly || false,
            name: cookie.name,
            path: cookie.path,
            sameSite: cookie.sameSite || 'unspecified',
            secure: cookie.secure || false,
            session: !cookie.expires || cookie.expires === -1,
            storeId: "0",
            value: cookie.value,
            id: index + 1
        }));
        fs.writeFileSync(path.join(__dirname, 'replit_cookies.json'), JSON.stringify(formattedCookies, null, 4));
    } catch (err) { console.error("❌ Cookie Save Failed:", err.message); }
}

// 🛡️ TRIPLE THREAT LOGIC
async function performTripleThreat(page) {
    const targetPathD = "M3.25 6A2.75 2.75 0 0 1 6 3.25h12A2.75 2.75 0 0 1 20.75 6v12A2.75 2.75 0 0 1 18 20.75H6A2.75 2.75 0 0 1 3.25 18V6Z";

    try {
        // 1. Deny
        await page.evaluate(() => {
            const deny = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.includes('Deny'));
            if (deny) deny.click();
        });

        // 2. Locate Run Button
        const buttonHandle = await page.evaluateHandle((dVal) => {
            const btn = document.querySelector('button[data-cy="ws-run-btn"]') || 
                        document.querySelector('button[aria-label*="Run"]') ||
                        document.querySelector(`path[d="${dVal}"]`)?.closest('button');
            if (btn) {
                const rect = btn.getBoundingClientRect();
                return { x: rect.left + rect.width/2, y: rect.top + rect.height/2, found: true };
            }
            return { found: false };
        }, targetPathD);

        const coords = await buttonHandle.jsonValue();

        if (coords.found) {
            console.log(`🎯 Clicking Target at ${coords.x}, ${coords.y}`);
            // A. Physical Click
            try {
                await page.mouse.move(coords.x, coords.y);
                await page.mouse.down();
                await sleep(100);
                await page.mouse.up();
            } catch(e) {}

            // B. JS Click & Dispatch
            await page.evaluate((dVal) => {
                const btn = document.querySelector('button[data-cy="ws-run-btn"]') || 
                            document.querySelector('button[aria-label*="Run"]') ||
                            document.querySelector(`path[d="${dVal}"]`)?.closest('button');
                if (btn) {
                    btn.focus();
                    btn.click();
                    ['mousedown', 'mouseup', 'click'].forEach(evt => 
                        btn.dispatchEvent(new MouseEvent(evt, {bubbles: true, cancelable: true, view: window}))
                    );
                }
            }, targetPathD);
        } else {
             // Blind Fallback
             try { await page.mouse.click(500, 40); } catch(e) {}
        }
    } catch (e) { console.log("Click Error: " + e.message); }
}

// ♻️ THE MASTER CYCLE (Open -> Run -> Close)
async function runBotCycle() {
    const REPL_URL = 'https://replit.com/@HUDV1/mb#main.py';
    const PAUSE_BETWEEN_CYCLES = 2 * 60 * 1000; // Wait 2 minutes after closing before starting next
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');

    console.log("\n🚀 STARTING NEW BROWSER CYCLE...");
    isBrowserRunning = true;

    try {
        const chromePath = findChrome();
        currentBrowser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: path.join(__dirname, 'chrome_user_data'),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,720', '--disable-gpu']
        });

        const page = await currentBrowser.newPage();
        currentPage = page; // Expose to Dashboard
        await page.setViewport({ width: 1280, height: 720 });

        // Load Cookies
        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
        }

        console.log("⏳ Navigating to Workspace...");
        await page.goto(REPL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(5000); // Warmup

        // ⚡ TRIPLE THREAT LOOP (3 Times, 15s Interval)
        console.log("⚡ Executing Triple Threat Sequence (3x)...");

        for (let i = 1; i <= 3; i++) {
            console.log(`👉 Action ${i}/3`);
            await performTripleThreat(page);

            if (i < 3) {
                console.log("⏳ Waiting 15s...");
                await sleep(15000);
            }
        }

        // Save Cookies before death
        await updateCookies(page);

    } catch (e) {
        console.error(`❌ Cycle Error: ${e.message}`);
    } finally {
        // 💀 KILL SWITCH: Close everything
        console.log("💀 Closing Browser & Tab (End of Cycle)");
        if (currentBrowser) await currentBrowser.close();

        currentBrowser = null;
        currentPage = null;
        isBrowserRunning = false;

        console.log(`💤 Sleeping for ${PAUSE_BETWEEN_CYCLES/1000} seconds before next fresh launch...`);
        setTimeout(runBotCycle, PAUSE_BETWEEN_CYCLES);
    }
}

// Start Server & Bot
app.listen(8080, () => console.log('🌐 Dashboard Active'));
runBotCycle();