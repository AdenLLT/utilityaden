const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.get('/', (req, res) => res.send('Keeper Active'));
app.listen(8080);

function findChrome() {
    const paths = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', process.env.CHROME_PATH].filter(Boolean);
    for (const p of paths) { if (fs.existsSync(p)) return p; }
    throw new Error('Chrome not found');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startBrowser() {
    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');
    const REPL_URL = 'https://replit.com/@HUDV1/mb#main.py';
    const RELOAD_INTERVAL = 5 * 60 * 1000; // Reload every 5 minutes

    console.log("Starting browser session...");
    let browser = null;

    try {
        const chromePath = findChrome();
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Pass browser logs to terminal
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(cookies);
            console.log(`✓ Cookies loaded`);
        }

        async function loadAndClick() {
            console.log(`⏳ Loading Replit Workspace...`);
            try {
                await page.goto(REPL_URL, { waitUntil: 'networkidle2', timeout: 120000 });
                await sleep(10000); // Wait for page to fully load

                // Click anywhere on the screen using native JS click
                await page.evaluate(() => {
                    document.body.click();
                    console.log('🖱️ Clicked on page body');
                });

                console.log('✓ Click executed successfully');
            } catch (e) {
                console.error("Load failed, retrying in 30s...", e.message);
                await sleep(30000);
                return loadAndClick();
            }
        }

        // Initial Load and Click
        await loadAndClick();

        // Periodically refresh the page every 5 minutes
        setInterval(async () => {
            console.log("🔄 Performing scheduled 5-minute refresh...");
            await loadAndClick();
        }, RELOAD_INTERVAL);

        // Keep process alive
        await new Promise(() => {});

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
        if (browser) await browser.close();
        setTimeout(startBrowser, 10000); // Restart entire browser on crash
    }
}

startBrowser();