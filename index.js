import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting Puppeteer environment...');
  
  try {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    console.log('Opening example.com...');
    await page.goto('https://example.com');
    
    const title = await page.title();
    console.log('Page Title:', title);
    
    await page.screenshot({ path: 'example.png' });
    console.log('Screenshot saved as example.png');
    
    await browser.close();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
})();
