const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

let lastScreenshot = null;
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
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: #1a1a1a;
                    color: #fff;
                }
                h1 { color: #2ecc71; margin: 0 0 10px 0; }
                .status {
                    background: #2a2a2a;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
                .status p { margin: 5px 0; font-size: 14px; color: #aaa; }
                .controls {
                    background: #2a2a2a;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .controls button {
                    background: #2ecc71;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    margin: 5px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                }
                .controls button:hover {
                    background: #27ae60;
                }
                .controls button.secondary {
                    background: #3498db;
                }
                .controls button.secondary:hover {
                    background: #2980b9;
                }
                .controls button.screenshot-btn {
                    background: #9b59b6;
                }
                .controls button.screenshot-btn:hover {
                    background: #8e44ad;
                }
                .controls input {
                    padding: 10px;
                    margin: 5px;
                    border-radius: 5px;
                    border: 1px solid #444;
                    background: #333;
                    color: #fff;
                    min-width: 300px;
                    font-size: 14px;
                }
                .screenshot-container {
                    position: relative;
                    border: 2px solid #444;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #000;
                    cursor: crosshair;
                }
                .screenshot-container img {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .no-screenshot {
                    padding: 40px;
                    text-align: center;
                    color: #666;
                }
                .live-status {
                    color: #2ecc71;
                    font-size: 12px;
                    margin-bottom: 10px;
                }
                .click-indicator {
                    position: absolute;
                    width: 20px;
                    height: 20px;
                    border: 2px solid #2ecc71;
                    border-radius: 50%;
                    pointer-events: none;
                    animation: pulse 0.5s ease-out;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(2); opacity: 0; }
                }
            </style>
        </head>
        <body>
            <h1>🟢 Keeper Active - Remote Control</h1>

            <div class="status">
                <p><strong>Last Check:</strong> ${lastScreenshot ? new Date().toLocaleString() : 'Waiting for initial load...'}</p>
                <p><strong>Status:</strong> <span id="liveStatus">Browser running in stealth mode</span></p>
            </div>

            <div class="controls">
                <button onclick="takeScreenshot()" class="screenshot-btn">📸 Take Screenshot</button>
                <button onclick="refresh()">🔄 Refresh Screenshot</button>
                <button onclick="reload()">↻ Reload Page</button>
                <button onclick="goBack()" class="secondary">← Back</button>
                <button onclick="goForward()" class="secondary">→ Forward</button>
                <br>
                <input type="text" id="urlInput" placeholder="Enter URL or JavaScript code">
                <button onclick="navigate()">🌐 Navigate</button>
                <button onclick="executeJS()">⚡ Execute JS</button>
                <button onclick="typeText()">⌨️ Type Text</button>
            </div>

            <div class="live-status" id="actionStatus">Click anywhere on the screenshot to interact with the browser</div>

            <div class="screenshot-container" id="screenshotContainer" onclick="handleClick(event)">
                ${lastScreenshot 
                    ? `<img id="screenshot" src="data:image/jpeg;base64,${lastScreenshot}" alt="Latest Screenshot" />` 
                    : '<div class="no-screenshot">Waiting for first screenshot... (This can take up to 60s)</div>'}
            </div>

            <script>
                function updateStatus(msg) {
                    document.getElementById('actionStatus').textContent = msg;
                }

                function updateLiveStatus(msg) {
                    document.getElementById('liveStatus').textContent = msg;
                }

                async function takeScreenshot() {
                    updateStatus('Taking screenshot...');
                    const res = await fetch('/take-screenshot', { method: 'POST' });
                    const data = await res.json();
                    if (data.screenshot) {
                        const img = document.getElementById('screenshot');
                        if (img) {
                            img.src = 'data:image/jpeg;base64,' + data.screenshot;
                        } else {
                            location.reload();
                        }
                        updateStatus('Screenshot captured!');
                    } else {
                        updateStatus('Failed to take screenshot');
                    }
                }

                async function refresh() {
                    updateStatus('Refreshing screenshot...');
                    const res = await fetch('/screenshot');
                    const data = await res.json();
                    if (data.screenshot) {
                        const img = document.getElementById('screenshot');
                        if (img) {
                            img.src = 'data:image/jpeg;base64,' + data.screenshot;
                        } else {
                            location.reload();
                        }
                        updateStatus('Screenshot updated');
                    }
                }

                async function handleClick(event) {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const img = document.getElementById('screenshot');
                    if (!img) return;

                    const x = (event.clientX - rect.left) / rect.width;
                    const y = (event.clientY - rect.top) / rect.height;

                    // Visual feedback
                    const indicator = document.createElement('div');
                    indicator.className = 'click-indicator';
                    indicator.style.left = (event.clientX - rect.left - 10) + 'px';
                    indicator.style.top = (event.clientY - rect.top - 10) + 'px';
                    event.currentTarget.appendChild(indicator);
                    setTimeout(() => indicator.remove(), 500);

                    updateStatus(\`Clicking at (\${Math.round(x*100)}%, \${Math.round(y*100)}%)...\`);

                    const res = await fetch('/click', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({x, y})
                    });

                    const data = await res.json();
                    updateStatus(data.message || 'Clicked');

                    // Auto refresh after click
                    setTimeout(takeScreenshot, 1000);
                }

                async function reload() {
                    updateStatus('Reloading page...');
                    await fetch('/reload', {method: 'POST'});
                    updateStatus('Page reloaded');
                    setTimeout(takeScreenshot, 2000);
                }

                async function goBack() {
                    updateStatus('Going back...');
                    await fetch('/back', {method: 'POST'});
                    updateStatus('Navigated back');
                    setTimeout(takeScreenshot, 2000);
                }

                async function goForward() {
                    updateStatus('Going forward...');
                    await fetch('/forward', {method: 'POST'});
                    updateStatus('Navigated forward');
                    setTimeout(takeScreenshot, 2000);
                }

                async function navigate() {
                    const url = document.getElementById('urlInput').value;
                    if (!url) return;
                    updateStatus('Navigating to ' + url + '...');
                    await fetch('/navigate', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({url})
                    });
                    updateStatus('Navigation complete');
                    setTimeout(takeScreenshot, 2000);
                }

                async function executeJS() {
                    const code = document.getElementById('urlInput').value;
                    if (!code) return;
                    updateStatus('Executing JavaScript...');
                    const res = await fetch('/execute', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({code})
                    });
                    const data = await res.json();
                    updateStatus('Result: ' + JSON.stringify(data.result));
                    setTimeout(takeScreenshot, 1000);
                }

                async function typeText() {
                    const text = document.getElementById('urlInput').value;
                    if (!text) return;
                    updateStatus('Typing text...');
                    await fetch('/type', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({text})
                    });
                    updateStatus('Text typed');
                    setTimeout(takeScreenshot, 1000);
                }

                // Auto-refresh every 10 seconds
                setInterval(refresh, 10000);
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// API Endpoints
app.get('/screenshot', async (req, res) => {
    try {
        res.json({ screenshot: lastScreenshot });
    } catch (e) {
        res.json({ screenshot: lastScreenshot, error: e.message });
    }
});

app.post('/take-screenshot', async (req, res) => {
    try {
        if (currentPage) {
            const screenshot = await currentPage.screenshot({ 
                encoding: 'base64', 
                type: 'jpeg', 
                quality: 60 
            });
            lastScreenshot = screenshot;
            console.log('📸 Manual screenshot captured');
            res.json({ success: true, screenshot });
        } else {
            res.json({ success: false, message: 'Page not ready' });
        }
    } catch (e) {
        console.error('Screenshot error:', e);
        res.json({ success: false, error: e.message });
    }
});

app.post('/click', async (req, res) => {
    try {
        const { x, y } = req.body;
        if (currentPage) {
            const viewport = await currentPage.viewport();
            const clickX = viewport.width * x;
            const clickY = viewport.height * y;
            await currentPage.mouse.click(clickX, clickY);
            console.log(`🖱️ Remote clicked at (${Math.round(clickX)}, ${Math.round(clickY)})`);
            res.json({ success: true, message: 'Clicked' });
        } else {
            res.json({ success: false, message: 'Page not ready' });
        }
    } catch (e) {
        console.error('Click error:', e);
        res.json({ success: false, error: e.message });
    }
});

app.post('/reload', async (req, res) => {
    try {
        if (currentPage) {
            await currentPage.reload({ waitUntil: 'domcontentloaded' });
            console.log('🔄 Page reloaded remotely');
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/back', async (req, res) => {
    try {
        if (currentPage) {
            await currentPage.goBack({ waitUntil: 'domcontentloaded' });
            console.log('← Navigated back');
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/forward', async (req, res) => {
    try {
        if (currentPage) {
            await currentPage.goForward({ waitUntil: 'domcontentloaded' });
            console.log('→ Navigated forward');
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/navigate', async (req, res) => {
    try {
        const { url } = req.body;
        if (currentPage && url) {
            await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            console.log(`🌐 Navigated to ${url}`);
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/execute', async (req, res) => {
    try {
        const { code } = req.body;
        if (currentPage && code) {
            const result = await currentPage.evaluate((code) => {
                return eval(code);
            }, code);
            console.log(`⚡ Executed JS: ${code}`);
            res.json({ success: true, result });
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/type', async (req, res) => {
    try {
        const { text } = req.body;
        if (currentPage && text) {
            await currentPage.keyboard.type(text);
            console.log(`⌨️ Typed: ${text}`);
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.listen(8080, () => console.log('🌐 Remote Control Dashboard running on port 8080'));

function findChrome() {
    const paths = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', process.env.CHROME_PATH].filter(Boolean);
    for (const p of paths) { if (fs.existsSync(p)) return p; }
    throw new Error('Chrome not found. Ensure chromium is installed in your environment.');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startBrowser() {
    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');
    const REPL_URL = 'https://replit.com/@HUDV1/mb#main.py';
    const RELOAD_INTERVAL = 5 * 60 * 1000; 

    console.log("🚀 Starting browser session...");
    let browser = null;

    try {
        const chromePath = findChrome();
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,720'
            ]
        });

        const [page] = await browser.pages();
        currentPage = page; // Make page accessible to API endpoints

        await page.setViewport({ width: 1280, height: 720 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded`);
        }

        async function loadAndClick() {
            console.log(`⏳ Loading Replit Workspace...`);
            try {
                await page.goto(REPL_URL, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 90000 
                });

                await page.waitForSelector('main', { timeout: 30000 }).catch(() => console.log("Note: 'main' selector not found, proceeding anyway..."));

                console.log('⌛ Waiting for IDE to stabilize...');
                await sleep(15000); 

                await page.mouse.click(500, 300);
                console.log('🖱️ Performed automated mouse click in editor area');

                const screenshot = await page.screenshot({ 
                    encoding: 'base64', 
                    type: 'jpeg', 
                    quality: 60 
                });
                lastScreenshot = screenshot;
                console.log('📸 Screenshot captured');

            } catch (e) {
                console.error("⚠️ Load/Click failed:", e.message);
                const errSnap = await page.screenshot({ encoding: 'base64' }).catch(() => null);
                if (errSnap) lastScreenshot = errSnap;

                await sleep(30000);
                return loadAndClick();
            }
        }

        await loadAndClick();

        setInterval(async () => {
            console.log("🔄 Performing scheduled 5-minute refresh...");
            await loadAndClick();
        }, RELOAD_INTERVAL);

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
        if (browser) await browser.close();
        console.log("Attempting restart in 10s...");
        setTimeout(startBrowser, 10000);
    }
}

startBrowser();