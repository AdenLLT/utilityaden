import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export async function captureScreenshot(id: number, url: string): Promise<string> {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport to something reasonable
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const filename = `screenshot-${id}-${Date.now()}.png`;
    const filepath = path.join(uploadsDir, filename);
    
    await page.screenshot({ path: filepath, fullPage: true });
    
    return filepath;
  } catch (error) {
    throw error;
  } finally {
    await browser.close();
  }
}
