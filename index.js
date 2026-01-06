const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

let currentPage = null;

app.use(express.json());

// Dashboard UI with Remote Control
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
                .view-container { position: relative; border: 2px solid #444; border-radius: 8px; overflow: hidden; background: #000; min-height: 400px; }
                .ascii-view { font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.2; color: #00ff00; padding: 20px; white-space: pre; overflow-x: auto; }
                .no-view { padding: 40px; text-align: center; color: #666; }
            </style>
        </head>
        <body>
            <h1>🟢 Keeper Active - Remote Control</h1>
            <div class="status">
                <p><strong>Last View:</strong> <span id="lastCheck">Not generated yet</span></p>
                <p><strong>Status:</strong> <span id="liveStatus">Browser running in stealth mode</span></p>
            </div>
            <div class="controls">
                <button onclick="generateView()" class="view-btn" id="viewBtn">🎨 Generate View</button>
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
                <div class="no-view">No view generated yet. Click "Generate View" to create one.</div>
            </div>
            <script>
                async function generateView() {
                    const btn = document.getElementById('viewBtn');
                    btn.disabled = true;
                    try {
                        const res = await fetch('/generate-view', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                            document.getElementById('viewContainer').innerHTML = '<div class="ascii-view">' + data.view + '</div>';
                            document.getElementById('lastCheck').textContent = new Date().toLocaleString();
                        }
                    } finally { btn.disabled = false; }
                }
                async function navigate() {
                    const url = document.getElementById('urlInput').value;
                    await fetch('/navigate', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({url})
                    });
                }
                async function clickAt() {
                    const coords = document.getElementById('urlInput').value;
                    const [x, y] = coords.split(',').map(n => parseInt(n.trim()));
                    await fetch('/click', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({x, y})
                    });
                }
                // Other functions (reload, back, forward, executeJS, typeText) follow the same fetch pattern...
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// API Endpoints
app.post('/generate-view', async (req, res) => {
    try {
        if (currentPage) {
            const pageInfo = await currentPage.evaluate(() => ({
                title: document.title,
                url: window.location.href,
                width: window.innerWidth,
                height: window.innerHeight,
                bodyText: document.body ? document.body.innerText.substring(0, 500) : 'No content'
            }));
            const width = 80;
            const height = 30;
            let asciiView = `═`.repeat(width) + `\nURL: ${pageInfo.url}\nTITLE: ${pageInfo.title}\nVIEWPORT: ${pageInfo.width}x${pageInfo.height}\n` + `═`.repeat(width) + `\n\n`;
            for (let y = 0; y < height; y++) {
                let line = '';
                for (let x = 0; x < width; x++) {
                    const val = Math.random();
                    if (val > 0.8) line += '█';
                    else if (val > 0.6) line += '▒';
                    else if (val > 0.4) line += '░';
                    else line += ' ';
                }
                asciiView += line + '\n';
            }
            res.json({ success: true, view: asciiView });
        } else { res.json({ success: false, message: 'Page not ready' }); }
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/navigate', async (req, res) => {
    try {
        const { url } = req.body;
        if (currentPage && url) {
            await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log("Nav check: " + e.message));
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

// Start Browser Logic
function findChrome() {
    const paths = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', process.env.CHROME_PATH].filter(Boolean);
    for (const p of paths) { if (fs.existsSync(p)) return p; }
    throw new Error('Chrome not found.');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startBrowser() {
    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');
    const REPL_URL = 'https://replit.com/@HUDV1/mb#main.py';

    // Config
    const RELOAD_INTERVAL = 5 * 60 * 1000; // 5 Minutes
    const MAX_CYCLES_BEFORE_RESTART = 12; // Restart browser every ~1 hour (12 * 5min)

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
        currentPage = page; // Update global variable
        page.setDefaultTimeout(60000);

        await page.setViewport({ width: 1280, height: 720 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
        }

        // --- THE LOGIC LOOP ---
        async function runCycle() {
            cycleCount++;
            console.log(`\n🔄 Cycle ${cycleCount}/${MAX_CYCLES_BEFORE_RESTART} started...`);

            try {
                // 1. Check if we need a full restart
                if (cycleCount > MAX_CYCLES_BEFORE_RESTART) {
                    console.log("♻️ Max cycles reached. Restarting browser to free memory...");
                    throw new Error("PLANNED_RESTART");
                }

                // 2. Load Page
                console.log(`⏳ Loading Replit Workspace...`);
                try {
                    await page.goto(REPL_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
                } catch (e) {
                    // Ignore timeout, usually page is loaded enough
                    if (!e.message.includes('timeout')) console.log("⚠️ Load Warning: " + e.message);
                }

                // 3. Check where we actually are (Debug Log)
                const pageTitle = await page.title();
                console.log(`📍 Current Title: "${pageTitle}"`);

                // If we are on a crash screen or empty page, throw error to trigger restart
                if (pageTitle === 'replit.com' || pageTitle === '' || pageTitle.includes('Aw, Snap')) {
                     console.log("⚠️ Page seems crashed or stuck on login. Restarting...");
                     throw new Error("PAGE_CRASHED");
                }

                // ==========================================
                // 🟢 NEW: CLICK BUTTON 3 TIMES ON 1ST CYCLE
                // ==========================================
                if (cycleCount === 1) {
                    console.log("👆 First cycle detected: Attempting triple-click sequence...");
                    try {
                        // Wait 5 seconds for React/UI to fully hydrate
                        await sleep(5000);

                        // XPath targeting the BUTTON containing the SVG (more stable than targeting the SVG path)
                        const targetXPath = '/html/body/div[1]/div[1]/div[1]/div/div/div[1]/div/div[2]/div/button';

                        // Wait until button is actually in the DOM
                        await page.waitForXPath(targetXPath, { timeout: 10000 });

                        const elements = await page.$x(targetXPath);
                        if (elements.length > 0) {
                            for (let i = 1; i <= 3; i++) {
                                await elements[0].click();
                                console.log(`   👉 Click ${i}/3 performed on target button`);
                                await sleep(1000); // 1 second delay between clicks
                            }
                        } else {
                            console.log("⚠️ Target button not found via XPath.");
                        }
                    } catch (err) {
                        console.log("⚠️ Error executing triple-click: " + err.message);
                    }
                }
                // ==========================================

                // 4. Wait and Click (General Interaction)
                await sleep(15000); 
                await page.mouse.click(500, 300);
                console.log('🖱️ Performed automated mouse click');

                // 5. Schedule Next Cycle
                setTimeout(runCycle, RELOAD_INTERVAL);

            } catch (error) {
                console.log(`❌ Cycle Error (${error.message}). Re-initializing...`);
                if (browser) await browser.close();
                setTimeout(startBrowser, 5000); // Restart the whole function
            }
        }

        // Start the first cycle
        runCycle();

    } catch (err) {
        console.error("❌ Fatal Launch Error:", err.message);
        if (browser) await browser.close();
        setTimeout(startBrowser, 10000);
    }
}

app.listen(8080, () => console.log('🌐 Dashboard on port 8080'));
startBrowser();