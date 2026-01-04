const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

let lastScreenshot = null;

// Dashboard UI
app.get('/', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Keeper Active</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
                h1 { color: #2ecc71; }
                .status { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .screenshot { border: 2px solid #ddd; border-radius: 8px; overflow: hidden; background: white; }
                .screenshot img { width: 100%; height: auto; display: block; }
                .no-screenshot { padding: 40px; text-align: center; color: #666; }
            </style>
        </head>
        <body>
            <h1>🟢 Keeper Active</h1>
            <div class="status">
                <p><strong>Last Check:</strong> ${lastScreenshot ? new Date().toLocaleString() : 'Waiting for initial load...'}</p>
                <p><strong>Status:</strong> Browser running in stealth mode</p>
            </div>
            <div class="screenshot">
                ${lastScreenshot 
                    ? `<img src="data:image/png;base64,${lastScreenshot}" alt="Latest Screenshot" />` 
                    : '<div class="no-screenshot">Waiting for first screenshot... (This can take up to 60s)</div>'}
            </div>
        </body>
        </html>
    `;
    res.send(html);
});

app.listen(8080, () => console.log('Admin Dashboard running on port 8080'));

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
                '--disable-blink-features=AutomationControlled', // Hides Puppeteer status
                '--window-size=1280,720'
            ]
        });

        const [page] = await browser.pages();
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
                // FIXED: Changed networkidle2 to domcontentloaded to avoid heartbeat timeouts
                await page.goto(REPL_URL, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 90000 
                });

                // Wait for the main workspace area to actually render
                await page.waitForSelector('main', { timeout: 30000 }).catch(() => console.log("Note: 'main' selector not found, proceeding anyway..."));

                console.log('⌛ Waiting for IDE to stabilize...');
                await sleep(15000); 

                // FIXED: Use mouse click at coordinates instead of body.click()
                // This is more likely to be detected as user activity by Replit
                await page.mouse.click(500, 300);
                console.log('🖱️ Performed mouse click in editor area');

                // Update screenshot
                const screenshot = await page.screenshot({ 
                    encoding: 'base64', 
                    type: 'jpeg', 
                    quality: 60 
                });
                lastScreenshot = screenshot;
                console.log('📸 Screenshot captured');

            } catch (e) {
                console.error("⚠️ Load/Click failed:", e.message);
                // Capture error state screenshot to help debug
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