const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const s of [0,1,2,3,4,6]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`file://${process.cwd()}/pitch.html?slide=${s}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `clean${s}.png` });
    await page.close();
  }
  await browser.close();
})();
