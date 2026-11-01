// Screenshot the architecture diagram HTML at 2x device scale for print quality
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('playwright-core')); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1480, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto('file://' + path.resolve(__dirname, 'report-diagram.html'));
  await page.waitForTimeout(600);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: 1480, height: h });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, 'report-diagram.png'), fullPage: true });
  await browser.close();
  console.log('DIAGRAM PNG OK, height=' + h);
})();
