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
                .controls button.key-btn { background: #e67e22; }
                .controls input { padding: 10px; margin: 5px; border-radius: 5px; border: 1px solid #444; background: #333; color: #fff; min-width: 300px; font-size: 14px; }
                .view-container { position: relative; border: 2px solid #444; border-radius: 8px; overflow: hidden; background: #000; min-height: 400px; }
                .screenshot-view { position: relative; width: 100%; cursor: crosshair; }
                .screenshot-view img { width: 100%; display: block; }
                .no-view { padding: 40px; text-align: center; color: #666; }
                .click-indicator { position: absolute; width: 20px; height: 20px; border: 2px solid #ff0000; border-radius: 50%; pointer-events: none; transform: translate(-50%, -50%); animation: pulse 0.5s ease-out; }
                @keyframes pulse { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(2); opacity: 0; } }
                .keyboard-section { margin-top: 10px; padding-top: 10px; border-top: 1px solid #444; }
            </style>
        </head>
        <body>
            <h1>🟢 Keeper Active - Remote Control</h1>
            <div class="status">
                <p><strong>Last Screenshot:</strong> <span id="lastCheck">Not taken yet</span></p>
                <p><strong>Status:</strong> <span id="liveStatus">Browser running in stealth mode</span></p>
            </div>
            <div class="controls">
                <button onclick="takeScreenshot()" class="view-btn" id="viewBtn">📸 Take Screenshot</button>
                <button onclick="reload()">↻ Reload Page</button>
                <button onclick="goBack()" class="secondary">← Back</button>
                <button onclick="goForward()" class="secondary">→ Forward</button>
                <br>
                <input type="text" id="urlInput" placeholder="Enter URL or JavaScript code">
                <button onclick="navigate()">🌐 Navigate</button>
                <button onclick="executeJS()">⚡ Execute JS</button>
                <button onclick="typeText()">⌨️ Type Text</button>
                <button onclick="clickAt()" class="secondary">🖱️ Click Coordinates</button>
                <div class="keyboard-section">
                    <button onclick="pressKey('Enter')" class="key-btn">↵ Enter</button>
                    <button onclick="pressKey('Escape')" class="key-btn">⎋ Escape</button>
                    <button onclick="pressKey('Tab')" class="key-btn">⇥ Tab</button>
                    <button onclick="pressKey('Backspace')" class="key-btn">⌫ Backspace</button>
                    <button onclick="pressKey('ArrowUp')" class="key-btn">↑</button>
                    <button onclick="pressKey('ArrowDown')" class="key-btn">↓</button>
                    <button onclick="pressKey('ArrowLeft')" class="key-btn">←</button>
                    <button onclick="pressKey('ArrowRight')" class="key-btn">→</button>
                    <input type="text" id="customKey" placeholder="Custom key (e.g., F5, Space)" style="min-width: 150px;">
                    <button onclick="pressCustomKey()" class="key-btn">⌨️ Press Custom Key</button>
                </div>
            </div>
            <div class="view-container" id="viewContainer">
                <div class="no-view">No screenshot taken yet. Click "Take Screenshot" to capture the browser view.</div>
            </div>
            <script>
                let screenshotData = null;

                async function takeScreenshot() {
                    const btn = document.getElementById('viewBtn');
                    btn.disabled = true;
                    try {
                        const res = await fetch('/take-screenshot', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                            screenshotData = data;
                            const container = document.getElementById('viewContainer');
                            container.innerHTML = '<div class="screenshot-view" id="screenshotView"><img id="screenshotImg" src="data:image/png;base64,' + data.screenshot + '" /></div>';
                            document.getElementById('lastCheck').textContent = new Date().toLocaleString();

                            // Add click handler to screenshot
                            document.getElementById('screenshotView').addEventListener('click', handleScreenshotClick);
                        }
                    } finally { btn.disabled = false; }
                }

                async function handleScreenshotClick(e) {
                    const img = document.getElementById('screenshotImg');
                    const rect = img.getBoundingClientRect();

                    // Calculate click position relative to the image
                    const clickX = e.clientX - rect.left;
                    const clickY = e.clientY - rect.top;

                    // Calculate scale between displayed image and actual viewport
                    const scaleX = screenshotData.viewport.width / rect.width;
                    const scaleY = screenshotData.viewport.height / rect.height;

                    // Calculate actual coordinates in the browser
                    const actualX = Math.round(clickX * scaleX);
                    const actualY = Math.round(clickY * scaleY);

                    // Visual feedback
                    const indicator = document.createElement('div');
                    indicator.className = 'click-indicator';
                    indicator.style.left = clickX + 'px';
                    indicator.style.top = clickY + 'px';
                    e.currentTarget.appendChild(indicator);
                    setTimeout(() => indicator.remove(), 500);

                    // Send click to server
                    await fetch('/click', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({x: actualX, y: actualY})
                    });
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

                async function pressKey(key) {
                    await fetch('/press-key', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({key})
                    });
                }

                async function pressCustomKey() {
                    const key = document.getElementById('customKey').value;
                    if (key) {
                        await pressKey(key);
                    }
                }

                async function reload() {
                    await fetch('/reload', { method: 'POST' });
                }

                async function goBack() {
                    await fetch('/back', { method: 'POST' });
                }

                async function goForward() {
                    await fetch('/forward', { method: 'POST' });
                }

                async function executeJS() {
                    const code = document.getElementById('urlInput').value;
                    await fetch('/execute-js', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({code})
                    });
                }

                async function typeText() {
                    const text = document.getElementById('urlInput').value;
                    await fetch('/type-text', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({text})
                    });
                }
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// API Endpoints
app.post('/take-screenshot', async (req, res) => {
    try {
        if (currentPage) {
            const screenshot = await currentPage.screenshot({ 
                encoding: 'base64',
                type: 'png',
                fullPage: false
            });

            const viewport = await currentPage.viewport();

            res.json({ 
                success: true, 
                screenshot: screenshot,
                viewport: viewport
            });
        } else { 
            res.json({ success: false, message: 'Page not ready' }); 
        }
    } catch (e) { 
        res.json({ success: false, error: e.message }); 
    }
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
            console.log(`🖱️ Clicking at coordinates: (${x}, ${y})`);

            // Get information about frames
            const frames = currentPage.frames();
            console.log(`📊 Total frames on page: ${frames.length}`);

            // Try multiple click strategies for better compatibility
            let clickSuccess = false;

            // Strategy 1: Try to find and click the element directly
            try {
                const elementInfo = await currentPage.evaluate((clickX, clickY) => {
                    const element = document.elementFromPoint(clickX, clickY);
                    if (element) {
                        const tagName = element.tagName;
                        const className = element.className;
                        const id = element.id;

                        // Try clicking the element
                        element.click();

                        return {
                            success: true,
                            tagName: tagName,
                            className: className,
                            id: id
                        };
                    }
                    return { success: false };
                }, x, y);

                if (elementInfo.success) {
                    console.log(`✅ Element click: <${elementInfo.tagName}> class="${elementInfo.className}" id="${elementInfo.id}"`);
                    clickSuccess = true;
                }
            } catch (evalError) {
                console.log('⚠️ Element click strategy failed:', evalError.message);
            }

            // Strategy 2: If element click failed, try mouse click with mouse down/up for better compatibility
            if (!clickSuccess) {
                try {
                    await currentPage.mouse.click(x, y, { delay: 50 });
                    console.log('✅ Mouse click executed with delay');
                    clickSuccess = true;
                } catch (mouseError) {
                    console.log('⚠️ Mouse click failed:', mouseError.message);
                }
            }

            // Strategy 3: Try clicking in each frame if it's an iframe-heavy page
            if (!clickSuccess && frames.length > 1) {
                console.log('🔍 Attempting frame-based click...');
                for (const frame of frames) {
                    try {
                        const frameElement = await frame.frameElement();
                        if (frameElement) {
                            const box = await frameElement.boundingBox();
                            if (box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
                                const frameX = x - box.x;
                                const frameY = y - box.y;
                                await frame.evaluate((fx, fy) => {
                                    const el = document.elementFromPoint(fx, fy);
                                    if (el) el.click();
                                }, frameX, frameY);
                                console.log(`✅ Clicked inside frame at relative position (${frameX}, ${frameY})`);
                                clickSuccess = true;
                                break;
                            }
                        }
                    } catch (frameError) {
                        // Continue to next frame
                    }
                }
            }

            if (!clickSuccess) {
                console.log('⚠️ All click strategies failed, but command sent');
            }

            res.json({ success: true });
        }
    } catch (e) { 
        console.error('❌ Click error:', e.message);
        res.json({ success: false, error: e.message }); 
    }
});

app.post('/press-key', async (req, res) => {
    try {
        const { key } = req.body;
        if (currentPage && key) {
            console.log(`⌨️ Pressing key: ${key}`);
            await currentPage.keyboard.press(key);
            res.json({ success: true });
        }
    } catch (e) { 
        console.error('❌ Key press error:', e.message);
        res.json({ success: false, error: e.message }); 
    }
});

app.post('/reload', async (req, res) => {
    try {
        if (currentPage) {
            await currentPage.reload({ waitUntil: 'domcontentloaded' });
            res.json({ success: true });
        }
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/back', async (req, res) => {
    try {
        if (currentPage) {
            await currentPage.goBack({ waitUntil: 'domcontentloaded' });
            res.json({ success: true });
        }
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/forward', async (req, res) => {
    try {
        if (currentPage) {
            await currentPage.goForward({ waitUntil: 'domcontentloaded' });
            res.json({ success: true });
        }
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/execute-js', async (req, res) => {
    try {
        const { code } = req.body;
        if (currentPage && code) {
            const result = await currentPage.evaluate(code);
            res.json({ success: true, result });
        }
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/type-text', async (req, res) => {
    try {
        const { text } = req.body;
        if (currentPage && text) {
            await currentPage.keyboard.type(text);
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

                // 4. Wait and Click at specific coordinates (797, 393)
                await sleep(15000); 
                await page.mouse.click(797, 393);
                console.log('🖱️ Performed automated mouse click at coordinates (797, 393)');

                // 5. Schedule Next Cycle (Recursive setTimeout is better than setInterval)
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