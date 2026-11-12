// Browser smoke test: opens every mode and panel, fails on any JavaScript error,
// runs the in-page self-test, traces exam-style code, and checks the phone layout.
// Run with:  npm run test:e2e   (first time: npx playwright install chromium)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const port = 5400 + Math.floor(Math.random() * 500);
const url = `http://127.0.0.1:${port}/`;
let server;
let browser;

before(async () => {
  server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: 'pipe',
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* server still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

async function openPage(options = { viewport: { width: 1440, height: 900 } }) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url);
  return { page, errors, context };
}

test('every mode, panel and instruction opens without JavaScript errors', async () => {
  const { page, errors, context } = await openPage();
  for (const name of ['add', 'addi', 'lw', 'sw', 'beq', 'j']) {
    await page.click(`#instruction-picker button >> text="${name}"`);
    for (let i = 0; i < 8; i++) await page.click('#next');
  }
  for (const mode of ['auto', 'auto', 'dict', 'srl', 'manual'])
    await page.click(`.mode-btn[data-mode="${mode}"]`);
  await page.click('[data-arch="pipeline"]');
  for (const name of ['add', 'addi', 'lw', 'sw', 'beq', 'j']) {
    await page.click(`#pipeline-instruction-picker button >> text="${name}"`);
    for (let i = 0; i < 5; i++) await page.click('#pipe-next');
  }
  await page.click('[data-pipe-panel="hazards"]');
  for (const hazard of await page.$$('#pipeline-view [data-hazard]'))
    if (await hazard.isVisible()) await hazard.click();
  await page.click('[data-pipe-panel="code"]');
  await page.click('#track-program');
  await page.click('[data-pipe-panel="diagram"]');
  await page.click('[data-arch="single"]');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the in-page self-test passes completely', async () => {
  const { page, context } = await openPage();
  await page.click('#open-selftest');
  await page.click('text=הריצי בדיקה עכשיו');
  await page.waitForSelector('#selftest-results li');
  const failed = await page.$$eval('#selftest-results li.fail', (items) =>
    items.map((item) => item.textContent),
  );
  assert.deepEqual(failed, []);
  await context.close();
});

test('the code tracer handles exam-style code with hexadecimal offsets', async () => {
  const { page, errors, context } = await openPage();
  await page.click('[data-arch="pipeline"]');
  await page.click('[data-pipe-panel="code"]');
  await page.fill('#pipeline-code', 'sub $13,$3,$5\nlw $2,-0x400($13)\nslt $4,$13,$2\nsw $4,4($13)');
  await page.click('#track-program');
  const status = await page.textContent('#program-status');
  assert.match(status, /1 בועות/);
  const cycle5 = await page.$$eval('#program-schedule tbody tr', (rows) =>
    rows.map((row) => row.cells[5]?.textContent.trim()),
  );
  assert.deepEqual(cycle5, ['WB', 'MEM', 'ID', 'IF (קפוא)', 'ID/EX.Flush · בועה']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('pipeline multiplexer boxes follow the selected instruction', async () => {
  const { page, errors, context } = await openPage();
  await page.click('[data-arch="pipeline"]');
  const read = async name => {
    await page.click(`#pipeline-instruction-picker button >> text="${name}"`);
    return [await page.textContent('#pipe-alusrc-value'), await page.textContent('#pipe-regdst-value')];
  };
  assert.deepEqual(await read('add'), ['0 · B=5', '1 · rd=$t0']);
  assert.deepEqual(await read('lw'), ['1 · B=4', '0 · rt=$t0']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('on a phone the page never scrolls sideways', async () => {
  const { page, context } = await openPage({ ...devices['iPhone 13'] });
  const widths = [];
  const measure = async () => widths.push(await page.evaluate(() => document.documentElement.scrollWidth));
  await measure();
  for (const mode of ['auto', 'dict', 'srl', 'manual']) {
    await page.tap(`.mode-btn[data-mode="${mode}"]`);
    await measure();
  }
  await page.tap('[data-arch="pipeline"]');
  await measure();
  for (const panel of ['hazards', 'code', 'diagram']) {
    await page.tap(`[data-pipe-panel="${panel}"]`);
    await measure();
  }
  const viewport = page.viewportSize().width;
  assert.ok(
    widths.every((width) => width <= viewport),
    `page widths ${widths.join(', ')} exceed ${viewport}`,
  );
  await context.close();
});
