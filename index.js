const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

let currentPage = null;

app.use(express.json());

// --- Dashboard UI ---
app.get('/', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Keeper Active - Remote Control</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #1a1a1a; color: #fff; }
                h1 { color: #2ecc71; margin: 0 0 10px 0; }
                .status { background: #2a2a2a; padding: 15px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
                .status p { margin: 5px 0; font-size: 14px; color: #aaa; }
                .controls { background: #2a2a2a; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                .controls button { background: #2ecc71; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 600; }
                .controls button:hover { background: #27ae60; }
                .controls button:disabled { background: #555; cursor: not-allowed; }
                .controls button.secondary { background: #3498db; }
                .controls button.view-btn { background: #9b59b6; }
                .controls input { padding: 10px; margin: 5px; border-radius: 5px; border: 1px solid #444; background: #333; color: #fff; min-width: 300px; font-size: 14px; }
                .view-container { position: relative; border: 2px solid #444; border-radius: 8px; overflow: hidden; background: #000; min-height: 400px; text-align: center; }
                .screenshot-view { max-width: 100%; height: auto; border: 1px solid #333; }
                .no-view { padding: 40px; color: #666; }
            </style>
        </head>
        <body>
            <h1>🟢 Keeper Active - Remote Control</h1>
            <div class="status">
                <p><strong>Last View:</strong> <span id="lastCheck">Not generated yet</span></p>
                <p><strong>Status:</strong> <span id="liveStatus">Browser running in stealth mode</span></p>
            </div>
            <div class="controls">
                <button onclick="generateView()" class="view-btn" id="viewBtn">📷 Take Screenshot</button>
                <button onclick="reload()">↻ Reload Page</button>
                <button onclick="goBack()" class="secondary">← Back</button>
                <button onclick="goForward()" class="secondary">→ Forward</button>
                <br>
                <input type="text" id="urlInput" placeholder="Enter URL or JavaScript code">
                <button onclick="navigate()">🌐 Navigate</button>
                <button onclick="executeJS()">⚡ Execute JS</button>
                <button onclick="typeText()">⌨️ Type Text</button>
                <button onclick="clickAt()" class="secondary">🖱️ Click Coordinates</button>
            </div>
            <div class="view-container" id="viewContainer">
                <div class="no-view">No screenshot yet. Click "Take Screenshot".</div>
            </div>
            <script>
                async function generateView() {
                    const btn = document.getElementById('viewBtn');
                    btn.disabled = true;
                    btn.innerText = "📸 Capturing...";
                    try {
                        const res = await fetch('/generate-view', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                            document.getElementById('viewContainer').innerHTML = 
                                '<img src="' + data.image + '" class="screenshot-view" />';
                            document.getElementById('lastCheck').textContent = new Date().toLocaleString();
                        } else {
                            alert('Error: ' + data.message);
                        }
                    } catch(e) { console.error(e); } finally { btn.disabled = false; btn.innerText = "📷 Take Screenshot"; }
                }
                async function navigate() {
                    const url = document.getElementById('urlInput').value;
                    await fetch('/navigate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url}) });
                }
                async function clickAt() {
                    const coords = document.getElementById('urlInput').value;
                    const [x, y] = coords.split(',').map(n => parseInt(n.trim()));
                    await fetch('/click', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({x, y}) });
                }
                async function reload() { await fetch('/navigate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: 'RELOAD'}) }); }
                async function goBack() { await fetch('/navigate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: 'BACK'}) }); }
                async function goForward() { await fetch('/navigate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: 'FORWARD'}) }); }
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// --- API Endpoints ---
app.post('/generate-view', async (req, res) => {
    try {
        if (currentPage) {
            const screenshotBuffer = await currentPage.screenshot({ type: 'jpeg', quality: 60, encoding: 'base64' });
            res.json({ success: true, image: `data:image/jpeg;base64,${screenshotBuffer}` });
        } else { res.json({ success: false, message: 'Page not ready' }); }
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/navigate', async (req, res) => {
    try {
        const { url } = req.body;
        if (currentPage) {
            if (url === 'RELOAD') await currentPage.reload({ waitUntil: 'domcontentloaded' });
            else if (url === 'BACK') await currentPage.goBack();
            else if (url === 'FORWARD') await currentPage.goForward();
            else await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            res.json({ success: true });
        }
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/click', async (req, res) => {
    try {
        const { x, y } = req.body;
        if (currentPage) {
            await currentPage.mouse.click(x, y);
            res.json({ success: true });
        }
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// --- Browser Logic ---
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
            expirationDate: cookie.expires || undefined,
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
        const cookiesPath = path.join(__dirname, 'replit_cookies.json');
        fs.writeFileSync(cookiesPath, JSON.stringify(formattedCookies, null, 4));
        console.log(`✅ Updated ${formattedCookies.length} cookies.`);
    } catch (err) { console.error("❌ Cookie Update Failed:", err.message); }
}

// ⏱️ 30-Second Smart Clicker - ONLY clicks if app is NOT running
async function startRecurringClicker(page) {
    console.log("⏰ Starting smart 30s clicker - will only click PLAY button when app is stopped.");

    // PLAY button path (green triangle) - THIS is what we want to click
    const PLAY_PATH = "M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z";

    // STOP button path (square) - if we see this, DON'T click
    const STOP_PATH = "M3.25 6A2.75 2.75 0 0 1 6 3.25h12A2.75 2.75 0 0 1 20.75 6v12A2.75 2.75 0 0 1 18 20.75H6A2.75 2.75 0 0 1 3.25 18V6Z";

    setInterval(async () => {
        if (!page || page.isClosed()) return;

        try {
            // 1️⃣ Always handle Deny buttons first
            await page.evaluate(() => {
                const deny = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.includes('Deny'));
                if (deny) {
                    deny.click();
                    console.log('Clicked Deny button');
                }
            });

            await sleep(500);

            // 2️⃣ Check which button is currently visible
            const buttonState = await page.evaluate((playPath, stopPath) => {
                // Check for PLAY button (app is stopped - we SHOULD click)
                const playButton = document.querySelector(`path[d="${playPath}"]`)?.closest('button[data-cy="ws-run-btn"]');
                if (playButton) {
                    const rect = playButton.getBoundingClientRect();
                    return {
                        shouldClick: true,
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2,
                        state: 'STOPPED'
                    };
                }

                // Check for STOP button (app is running - we should NOT click)
                const stopButton = document.querySelector(`path[d="${stopPath}"]`)?.closest('button[data-cy="ws-run-btn"]');
                if (stopButton) {
                    return {
                        shouldClick: false,
                        state: 'RUNNING'
                    };
                }

                return { shouldClick: false, state: 'NOT_FOUND' };
            }, PLAY_PATH, STOP_PATH);

            // 3️⃣ Take action based on button state
            if (buttonState.state === 'RUNNING') {
                console.log("✅ App is RUNNING - no action needed");
            } else if (buttonState.state === 'STOPPED' && buttonState.shouldClick) {
                console.log(`🎯 App is STOPPED - clicking PLAY at (${buttonState.x}, ${buttonState.y})`);

                // Triple-threat click strategy
                try {
                    // A. Physical mouse click
                    await page.mouse.move(buttonState.x, buttonState.y);
                    await page.mouse.down();
                    await sleep(100);
                    await page.mouse.up();
                } catch (mouseErr) {
                    console.log(`⚠️ Mouse click warning: ${mouseErr.message}`);
                    await page.mouse.up().catch(() => {});
                }

                // B. JavaScript click with events
                await page.evaluate((playPath) => {
                    const btn = document.querySelector(`path[d="${playPath}"]`)?.closest('button[data-cy="ws-run-btn"]');
                    if (btn) {
                        btn.focus();
                        btn.click();
                        ['mousedown', 'mouseup', 'click'].forEach(evt => 
                            btn.dispatchEvent(new MouseEvent(evt, {bubbles: true, cancelable: true, view: window}))
                        );
                    }
                }, PLAY_PATH);

                console.log("✅ PLAY button clicked successfully");
            } else {
                console.log("⚠️ Run button not found in DOM");
            }

        } catch (e) {
            console.log(`⏰ Clicker Error: ${e.message}`);
        }
    }, 30000); 
}

async function startBrowser() {
    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');
    const REPL_URL = 'https://replit.com/@HUDV1/mb#main.py';

    const RELOAD_INTERVAL = 3 * 60 * 1000; // 3 Minutes
    const MAX_CYCLES_BEFORE_RESTART = 12; 
    const COOKIE_UPDATE_INTERVAL = 5;

    let browser = null;
    let cycleCount = 0;

    try {
        console.log("🚀 Launching Browser...");
        const chromePath = findChrome();
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled', '--window-size=1280,720',
                '--disable-gpu', '--no-first-run', '--disable-software-rasterizer'
            ],
            protocolTimeout: 300000 
        });

        const [page] = await browser.pages();
        currentPage = page; 
        page.setDefaultTimeout(60000);

        // Start the smart recurring clicker
        startRecurringClicker(page);

        await page.setViewport({ width: 1280, height: 720 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log("🍪 Loaded existing cookies");
        }

        async function runCycle() {
            cycleCount++;
            console.log(`\n🔄 Cycle ${cycleCount}/${MAX_CYCLES_BEFORE_RESTART} started...`);

            try {
                if (cycleCount > MAX_CYCLES_BEFORE_RESTART) {
                    console.log("♻️ Max cycles reached. Restarting browser...");
                    throw new Error("PLANNED_RESTART");
                }

                console.log(`⏳ Loading Replit Workspace...`);
                try {
                    await page.goto(REPL_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
                } catch (e) {
                    if (!e.message.includes('timeout')) console.log("⚠️ Load Warning: " + e.message);
                }

                await sleep(5000); 

                const pageTitle = await page.title();
                console.log(`📍 Current Title: "${pageTitle}"`);

                if (pageTitle === 'replit.com' || pageTitle === '' || pageTitle.includes('Aw, Snap')) {
                     throw new Error("PAGE_CRASHED");
                }

                if (cycleCount % COOKIE_UPDATE_INTERVAL === 0) {
                    await updateCookies(page);
                }

                // Extra deny button check on cycle
                await page.evaluate(() => {
                    const deny = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.includes('Deny'));
                    if (deny) deny.click();
                });

                setTimeout(runCycle, RELOAD_INTERVAL);

            } catch (error) {
                console.log(`❌ Cycle Error (${error.message}). Re-initializing...`);
                if (browser) await browser.close();
                setTimeout(startBrowser, 5000);
            }
        }

        runCycle();

    } catch (err) {
        console.error("❌ Fatal Launch Error:", err.message);
        if (browser) await browser.close();
        setTimeout(startBrowser, 10000);
    }
}

app.listen(8080, () => console.log('🌐 Dashboard on port 8080'));
startBrowser();