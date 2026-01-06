const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

let currentPage = null;

app.use(express.json());

// Dashboard UI
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
                .controls input { padding: 10px; margin: 5px; border-radius: 5px; border: 1px solid #444; background: #333; color: #fff; min-width: 300px; font-size: 14px; }
                .view-container { position: relative; border: 2px solid #444; border-radius: 8px; overflow: hidden; background: #000; min-height: 400px; }
                .ascii-view { font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.2; color: #00ff00; padding: 20px; white-space: pre; overflow-x: auto; }
            </style>
        </head>
        <body>
            <h1>🟢 Keeper Active - Remote Control</h1>
            <div class="status">
                <p><strong>Last View:</strong> <span id="lastCheck">Not generated yet</span></p>
                <p><strong>Status:</strong> <span id="liveStatus">Browser running in stealth mode</span></p>
            </div>
            <div class="controls">
                <button onclick="generateView()" style="background: #9b59b6;">🎨 Generate View</button>
                <button onclick="location.reload()">↻ Refresh Dashboard</button>
                <br>
                <input type="text" id="urlInput" placeholder="Enter URL">
                <button onclick="navigate()">🌐 Navigate</button>
            </div>
            <div class="view-container" id="viewContainer">
                <div style="padding:40px; text-align:center; color:#666;">No view generated yet.</div>
            </div>
            <script>
                async function generateView() {
                    const res = await fetch('/generate-view', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        document.getElementById('viewContainer').innerHTML = '<div class="ascii-view">' + data.view + '</div>';
                        document.getElementById('lastCheck').textContent = new Date().toLocaleString();
                    }
                }
                async function navigate() {
                    const url = document.getElementById('urlInput').value;
                    await fetch('/navigate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url}) });
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
            const pageInfo = await currentPage.evaluate(() => ({ title: document.title, url: window.location.href }));
            let asciiView = `═`.repeat(80) + `\nURL: ${pageInfo.url}\nTITLE: ${pageInfo.title}\n` + `═`.repeat(80) + `\n\n[Live View Captured]`;
            res.json({ success: true, view: asciiView });
        } else { res.json({ success: false, message: 'Page not ready' }); }
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/navigate', async (req, res) => {
    try {
        const { url } = req.body;
        if (currentPage) {
            await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
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

    const RELOAD_INTERVAL = 5 * 60 * 1000; 
    const MAX_CYCLES_BEFORE_RESTART = 12; 

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
                '--disable-gpu', '--no-first-run'
            ]
        });

        const [page] = await browser.pages();
        currentPage = page;
        page.setDefaultTimeout(60000);

        await page.setViewport({ width: 1280, height: 720 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
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
                await page.goto(REPL_URL, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});

                // ==================================================
                // 🟢 RELIABLE TRIPLE-CLICK (Using data-cy)
                // ==================================================
                if (cycleCount === 1) {
                    console.log("👆 Cycle 1: Targeting 'Run' button...");
                    try {
                        // 1. Wait for the specific data-cy attribute
                        const runBtnSelector = 'button[data-cy="ws-run-btn"]';

                        // Increase timeout to 45s because Replit workspaces load slowly
                        await page.waitForSelector(runBtnSelector, { visible: true, timeout: 45000 });

                        console.log("✅ Run button found! Clicking 3 times...");
                        for (let i = 1; i <= 3; i++) {
                            // Using page.click on the selector is often more reliable than handle.click()
                            await page.click(runBtnSelector);
                            console.log(`   👉 Click ${i}/3 performed`);
                            await sleep(1500); // Wait for button animation/state change
                        }
                    } catch (err) {
                        console.log("⚠️ Click Sequence Failed: " + err.message);
                        console.log("🖱️ Executing coordinate backup click (280, 50)...");
                        await page.mouse.click(280, 50);
                    }
                }
                // ==================================================

                await sleep(10000); 
                await page.mouse.click(500, 300);
                console.log('🖱️ Standard cycle interaction complete.');

                setTimeout(runCycle, RELOAD_INTERVAL);

            } catch (error) {
                console.log(`❌ Error: ${error.message}. Restarting...`);
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