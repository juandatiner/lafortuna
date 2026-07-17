const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  for (const s of [0,1,2,3,4,6]) {
    await page.goto(`file://${process.cwd()}/pitch.html?slide=${s}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `s${s}.png` });
  }
  await browser.close();
})();
