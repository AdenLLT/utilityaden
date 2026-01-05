const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

let currentPage = null;
const REPL_URL = 'https://replit.com/@HUDV1/mb#main.py';

app.use(express.json());

// --- Dashboard UI ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Keeper Active v2</title>
            <style>
                body { font-family: sans-serif; background: #121212; color: #ececec; padding: 20px; }
                .card { background: #1e1e1e; padding: 20px; border-radius: 10px; border: 1px solid #333; }
                button { background: #00A86B; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; margin: 5px; }
                input { padding: 10px; border-radius: 5px; border: 1px solid #444; background: #222; color: white; width: 300px; }
                #log { background: #000; color: #0f0; padding: 10px; font-family: monospace; height: 200px; overflow-y: auto; margin-top: 20px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🟢 Keeper Active v2</h1>
                <p>Status: <span id="status">Monitoring...</span></p>
                <input type="text" id="cmd" placeholder="URL or JS Code">
                <button onclick="doAction('/navigate', 'url')">Navigate</button>
                <button onclick="doAction('/execute', 'code')">Exec JS</button>
                <button onclick="fetch('/generate-view', {method:'POST'}).then(r=>r.json()).then(d=>document.getElementById('log').innerText=d.view)">Refresh View</button>
            </div>
            <pre id="log">Console output will appear here...</pre>
            <script>
                async function doAction(path, key) {
                    const val = document.getElementById('cmd').value;
                    await fetch(path, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({[key]: val})
                    });
                    alert('Action sent');
                }
            </script>
        </body>
        </html>
    `);
});

// --- API Endpoints ---
app.post('/generate-view', async (req, res) => {
    if (!currentPage) return res.json({success: false});
    const txt = await currentPage.evaluate(() => document.body.innerText.substring(0, 800));
    res.json({ success: true, view: `URL: ${currentPage.url()}\n\n${txt}` });
});

app.post('/navigate', async (req, res) => {
    const { url } = req.body;
    if (currentPage) await currentPage.goto(url, {waitUntil: 'domcontentloaded'});
    res.json({success: true});
});

app.post('/execute', async (req, res) => {
    const { code } = req.body;
    const result = await currentPage.evaluate((c) => eval(c), code);
    res.json({success: true, result});
});

// --- Browser Logic ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function startBrowser() {
    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');

    console.log("🚀 Launching Stealth Browser...");

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/usr/bin/chromium-browser', // Standard for Replit
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
            protocolTimeout: 300000
        });

        const [page] = await browser.pages();
        currentPage = page;
        await page.setViewport({ width: 1280, height: 720 });

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log("🍪 Session cookies loaded.");
        }

        async function maintainSession() {
            // 1. Randomize the wait to avoid "9-hour" pattern detection
            const jitter = Math.floor(Math.random() * 60000); // Up to 1 min random delay
            console.log(`⏳ Next refresh in ${5} minutes (+${jitter/1000}s jitter)...`);

            try {
                console.log("🔄 Refreshing Replit Workspace...");
                await page.goto(REPL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

                // 2. Human-like movement
                await sleep(5000 + Math.random() * 5000);
                const x = 400 + Math.random() * 200;
                const y = 300 + Math.random() * 200;
                await page.mouse.click(x, y);
                console.log(`🖱️ Clicked at (${Math.round(x)}, ${Math.round(y)})`);

                // 3. Check for "Login" or "Logged Out" text
                const isLoggedOut = await page.evaluate(() => {
                    return document.body.innerText.includes('Log in') || document.body.innerText.includes('Sign up');
                });
                if (isLoggedOut) console.log("⚠️ WARNING: It looks like you are logged out!");

            } catch (e) {
                console.log("⚠️ Minor error during refresh (normal for Replit):", e.message);
            }

            setTimeout(maintainSession, (5 * 60 * 1000) + jitter);
        }

        await maintainSession();

    } catch (err) {
        console.error("❌ Fatal Browser Error:", err.message);
        setTimeout(startBrowser, 10000);
    }
}

app.listen(8080, () => {
    console.log('🌐 Dashboard: http://localhost:8080');
    startBrowser();
});