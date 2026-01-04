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
                .controls button:disabled {
                    background: #555;
                    cursor: not-allowed;
                }
                .controls button.secondary {
                    background: #3498db;
                }
                .controls button.secondary:hover {
                    background: #2980b9;
                }
                .controls button.view-btn {
                    background: #9b59b6;
                }
                .controls button.view-btn:hover {
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
                .view-container {
                    position: relative;
                    border: 2px solid #444;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #000;
                    min-height: 400px;
                }
                .ascii-view {
                    font-family: 'Courier New', monospace;
                    font-size: 10px;
                    line-height: 1.2;
                    color: #00ff00;
                    padding: 20px;
                    white-space: pre;
                    overflow-x: auto;
                }
                .no-view {
                    padding: 40px;
                    text-align: center;
                    color: #666;
                }
                .live-status {
                    color: #2ecc71;
                    font-size: 12px;
                    margin-bottom: 10px;
                }
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

            <div class="live-status" id="actionStatus">Click "Generate View" to see a representation of the browser page</div>

            <div class="view-container" id="viewContainer">
                <div class="no-view">No view generated yet. Click "Generate View" to create one.</div>
            </div>

            <script>
                function updateStatus(msg) {
                    document.getElementById('actionStatus').textContent = msg;
                }

                function updateLiveStatus(msg) {
                    document.getElementById('liveStatus').textContent = msg;
                }

                function updateLastCheck() {
                    document.getElementById('lastCheck').textContent = new Date().toLocaleString();
                }

                async function generateView() {
                    const btn = document.getElementById('viewBtn');
                    btn.disabled = true;
                    updateStatus('Generating view...');

                    try {
                        const res = await fetch('/generate-view', { method: 'POST' });
                        const data = await res.json();

                        if (data.success && data.view) {
                            const container = document.getElementById('viewContainer');
                            container.innerHTML = '<div class="ascii-view">' + data.view + '</div>';
                            updateStatus('View generated!');
                            updateLastCheck();
                        } else {
                            updateStatus('Failed: ' + (data.message || data.error || 'Unknown error'));
                        }
                    } catch (e) {
                        updateStatus('Error: ' + e.message);
                    } finally {
                        btn.disabled = false;
                    }
                }

                async function clickAt() {
                    const coords = document.getElementById('urlInput').value;
                    if (!coords) {
                        updateStatus('Enter coordinates like: 500,300');
                        return;
                    }
                    const [x, y] = coords.split(',').map(n => parseInt(n.trim()));
                    if (isNaN(x) || isNaN(y)) {
                        updateStatus('Invalid coordinates. Use format: x,y');
                        return;
                    }

                    updateStatus(\`Clicking at (\${x}, \${y})...\`);

                    const res = await fetch('/click', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({x, y})
                    });

                    const data = await res.json();
                    updateStatus((data.message || 'Clicked') + ' - Generate view to see result');
                }

                async function reload() {
                    updateStatus('Reloading page...');
                    await fetch('/reload', {method: 'POST'});
                    updateStatus('Page reloaded - Generate view to see result');
                }

                async function goBack() {
                    updateStatus('Going back...');
                    await fetch('/back', {method: 'POST'});
                    updateStatus('Navigated back - Generate view to see result');
                }

                async function goForward() {
                    updateStatus('Going forward...');
                    await fetch('/forward', {method: 'POST'});
                    updateStatus('Navigated forward - Generate view to see result');
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
                    updateStatus('Navigation complete - Generate view to see result');
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
                    updateStatus('Result: ' + JSON.stringify(data.result) + ' - Generate view to see changes');
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
                    updateStatus('Text typed - Generate view to see result');
                }
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
            console.log('🎨 Generating ASCII view...');

            // Get page info
            const pageInfo = await currentPage.evaluate(() => {
                return {
                    title: document.title,
                    url: window.location.href,
                    width: window.innerWidth,
                    height: window.innerHeight,
                    bodyText: document.body ? document.body.innerText.substring(0, 500) : 'No content'
                };
            });

            // Generate ASCII art representation
            const width = 80;
            const height = 30;
            let asciiView = '';

            // Header
            asciiView += '═'.repeat(width) + '\n';
            asciiView += `URL: ${pageInfo.url}\n`;
            asciiView += `TITLE: ${pageInfo.title}\n`;
            asciiView += `VIEWPORT: ${pageInfo.width}x${pageInfo.height}\n`;
            asciiView += '═'.repeat(width) + '\n\n';

            // Generate random 1s and 0s pattern
            for (let y = 0; y < height; y++) {
                let line = '';
                for (let x = 0; x < width; x++) {
                    // Create some pattern based on position
                    const val = Math.random();
                    if (val > 0.7) line += '█';
                    else if (val > 0.5) line += '▓';
                    else if (val > 0.3) line += '▒';
                    else if (val > 0.15) line += '░';
                    else if (val > 0.1) line += '1';
                    else if (val > 0.05) line += '0';
                    else line += ' ';
                }
                asciiView += line + '\n';
            }

            asciiView += '\n' + '═'.repeat(width) + '\n';
            asciiView += 'PAGE CONTENT PREVIEW:\n';
            asciiView += '═'.repeat(width) + '\n';
            asciiView += pageInfo.bodyText.substring(0, 400) + '...\n';

            console.log('✓ View generated successfully');
            res.json({ success: true, view: asciiView });
        } else {
            res.json({ success: false, message: 'Page not ready' });
        }
    } catch (e) {
        console.error('View generation error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

app.post('/click', async (req, res) => {
    try {
        const { x, y } = req.body;
        if (currentPage) {
            await currentPage.mouse.click(x, y);
            console.log(`🖱️ Remote clicked at (${x}, ${y})`);
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
            await currentPage.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
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
            await currentPage.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 });
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
            await currentPage.goForward({ waitUntil: 'domcontentloaded', timeout: 30000 });
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
            ],
            protocolTimeout: 60000
        });

        const [page] = await browser.pages();
        currentPage = page;

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

            } catch (e) {
                console.error("⚠️ Load/Click failed:", e.message);
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