import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test.describe.skip('Deferred upload workflow — step 4 hidden by owner request', () => {
const fixture = JSON.parse(readFileSync(new URL('./fixtures/catalog.json', import.meta.url), 'utf8'));
test.beforeEach(async ({ page }) => { await page.route('**/catalog.json', route => route.fulfill({ json: { ...fixture, workerGroups: [{ key: 'dev-east', label: 'Example · East region' }, { key: 'dev-west', label: 'Example · West region' }] } })); });
const sample = (name = 'events.log', size = 120) => ({ name, mimeType: 'text/plain', buffer: Buffer.alloc(size, 65) });
async function complete(page: import('@playwright/test').Page) {
  await page.getByLabel('Where does your data reside?').selectOption('dev-east');
  await page.getByLabel('Daily volume', {exact:true}).fill('1');
  await page.getByLabel('Upload a sample of your logs', { exact: true }).setInputFiles(sample());
  await page.getByLabel('What methods are available to collect your logs?').selectOption('hec');
}
test('complete request is reviewed without sending a sample or changing Cribl', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) mutations.push(r.url()); });
  await page.goto('/'); await complete(page);
  await page.getByRole('button', { name: 'Review preview' }).click();
  await expect(page.locator('#preview-result')).toBeVisible();
  await expect(page.locator('#review-group')).toHaveText('Example · East region');
  await expect(page.locator('#review-sample')).toContainText('events.log');
  await expect(page.locator('#review-method')).toHaveText('HEC');
  await expect(page.getByText('No Cribl changes', { exact: true })).toBeVisible();
  expect(mutations).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await page.getByLabel('Where does your data reside?').selectOption('dev-west');
  await expect(page.locator('#preview-result')).toBeHidden();
});
test('requires answers and rejects oversized samples while accepting exact boundary', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Review preview' })).toBeEnabled();
  await page.getByRole('button', { name: 'Review preview' }).click();
  await expect(page.locator('#group-error')).not.toBeEmpty();
  await expect(page.locator('#method-error')).not.toBeEmpty();
  await expect(page.locator('#sample-error')).not.toBeEmpty();
  await page.getByLabel('Upload a sample of your logs', { exact: true }).setInputFiles(sample('too-large.log', 1_000_001));
  await expect(page.locator('#sample-error')).toContainText('1 MB');
  await expect(page.locator('#sample-info')).toBeHidden();
  await page.getByLabel('Upload a sample of your logs', { exact: true }).setInputFiles(sample('boundary.log', 1_000_000));
  await expect(page.locator('#sample-name')).toHaveText('boundary.log');
  await expect(page.locator('#sample-error')).toBeEmpty();
});
test('replacement, removal, reset, and reload discard sample and preview state', async ({ page }) => {
  await page.goto('/'); await complete(page); await page.getByRole('button', { name: 'Review preview' }).click();
  await page.getByLabel('Upload a sample of your logs', { exact: true }).setInputFiles(sample('replacement.log'));
  await expect(page.locator('#preview-result')).toBeHidden();
  await expect(page.locator('#sample-name')).toHaveText('replacement.log');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('#sample-info')).toBeHidden();
  await complete(page); await page.getByRole('button', { name: 'Clear request' }).click();
  await expect(page.locator('#worker-group')).toHaveValue('');
  await expect(page.locator('#sample-info')).toBeHidden();
  await complete(page); await page.reload();
  await expect(page.locator('#sample-info')).toBeHidden();
});
test('mobile form stays within viewport and filenames are rendered as text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByLabel('Upload a sample of your logs', { exact: true }).setInputFiles(sample('<img src=x onerror=alert(1)>.log'));
  await expect(page.locator('#sample-name')).toHaveText('<img src=x onerror=alert(1)>.log');
  expect(await page.locator('#sample-info img').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('unavailable catalogs explain the problem and prevent preview', async ({ page }) => {
  await page.route('**/catalog.json', route => route.fulfill({ json: { version: 1, provenance: 'Development fixtures', workerGroups: [], collectionMethods: [] } }));
  await page.goto('/');
  await expect(page.locator('#catalog-status')).toContainText('No choices are available');
  await expect(page.getByRole('button', { name: 'Review preview' })).toBeDisabled();
});
for (const status of [400, 500]) {
  test(`shows the supplied error image when choices fail with HTTP ${status}`, async ({ page }) => {
    await page.route('**/catalog.json', route => route.fulfill({ status, body: 'Request failed' }));
    await page.goto('/');
    await expect(page.locator('#service-error')).toBeVisible();
    await expect(page.getByAltText('Something went wrong — sad Pepe at a broken computer.')).toBeVisible();
    await expect(page.getByAltText('Something went wrong — sad Pepe at a broken computer.')).toHaveJSProperty('naturalWidth', 1536);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review preview' })).toBeDisabled();
    await page.unroute('**/catalog.json');
    await page.route('**/catalog.json', route => route.fulfill({ json: { ...fixture, workerGroups: [{ key: 'dev-east', label: 'Example · East region' }] } }));
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('#service-error')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Review preview' })).toBeEnabled();
  });
}

test('sample upload is the final question in reading and keyboard order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.question').last().locator('label').first()).toHaveText('Upload a sample of your logs');
});

test('collection methods are fixed and sample type is shown in selection and preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#collection-method option')).toHaveText(['Select a collection method', 'HEC', 'API', 'Other']);
  await page.getByLabel('Where does your data reside?').selectOption('dev-east');
  await page.getByLabel('Daily volume', {exact:true}).fill('1');
  await page.getByLabel('What methods are available to collect your logs?').selectOption('api');
  await page.locator('#sample').setInputFiles({ name: 'events.log', mimeType: 'text/plain', buffer: Buffer.from('{"event":"login"}') });
  await expect(page.locator('#sample-type')).toContainText('JSON');
  await page.getByRole('button', { name: 'Review preview' }).click();
  await expect(page.locator('#review-type')).toHaveText('JSON');
  await page.locator('#sample').setInputFiles({ name: 'events.json', mimeType: 'application/json', buffer: Buffer.from('Oct 11 22:14:15 host app: hello') });
  await expect(page.locator('#sample-type')).toContainText('Syslog');
  await expect(page.locator('#preview-result')).toBeHidden();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('#sample-type')).toBeEmpty();
});

test('non-UTF-8 samples are Other with a readable limitation', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sample').setInputFiles({ name: 'binary.log', mimeType: 'application/octet-stream', buffer: Buffer.from([255, 254, 0, 1]) });
  await expect(page.locator('#sample-type')).toContainText('Detected type: Other');
  await expect(page.locator('#sample-type')).toContainText('could not be read as UTF-8');
});
test('removing a file while analysis is pending cannot restore its finding', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#sample')!;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['{"event":"secret"}'], 'pending.log'));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    document.querySelector<HTMLButtonElement>('#remove-sample')!.click();
  });
  // Allow the pending file read to finish before checking that its result stays discarded.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  await expect(page.locator('#sample-info')).toBeHidden();
  await expect(page.locator('#sample-type')).toBeEmpty();
  await expect(page.locator('#sample')).toHaveValue('');
});

test('manual log type replaces detection in preview and resets for a replacement sample', async ({ page }) => {
  await page.goto('/'); await complete(page);
  await page.getByLabel('Log type override').selectOption('JSON');
  await page.getByRole('button', {name:'Review preview'}).click();
  await expect(page.locator('#review-type')).toHaveText('JSON');
  await expect(page.locator('#review-type-note')).toContainText('Selected by you');
  await expect(page.locator('#review-type-note')).toContainText('Other');
  await page.getByLabel('Log type override').selectOption('');
  await expect(page.locator('#preview-result')).toBeHidden();
  await page.getByRole('button', {name:'Review preview'}).click();
  await expect(page.locator('#review-type')).toHaveText('Other');
  await page.getByLabel('Log type override').selectOption('Syslog');
  await page.locator('#sample').setInputFiles(sample('replacement.log'));
  await expect(page.getByLabel('Log type override')).toHaveValue('');
});
test('daily volume rejects less than 1 GB and accepts its TB equivalent', async ({ page }) => {
  await page.goto('/'); await complete(page);
  await page.getByLabel('Daily volume', {exact:true}).fill('0.5');
  await page.getByRole('button', {name:'Review preview'}).click();
  await expect(page.locator('#volume-error')).toContainText('1 GB');
  await expect(page.locator('#preview-result')).toBeHidden();
  await page.getByLabel('Volume units').selectOption('TB');
  await page.getByLabel('Daily volume', {exact:true}).fill('0.0009');
  await page.getByRole('button', {name:'Review preview'}).click();
  await expect(page.locator('#volume-error')).toContainText('1 GB');
  await page.getByLabel('Daily volume', {exact:true}).fill('0.001');
  await page.getByRole('button', {name:'Review preview'}).click();
  await expect(page.locator('#review-volume')).toHaveText('0.001 TB per day');
  await page.getByLabel('Volume units').selectOption('GB');
  await expect(page.locator('#preview-result')).toBeHidden();
  await expect(page.locator('#volume-error')).toContainText('1 GB');
});

test('detects well-formed XML by content, rejects malformed XML, and supports XML overrides', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5173/')) external.push(request.url()); });
  await page.goto('/'); await complete(page);
  for (const text of ['<?xml version="1.0"?><events><event level="info">login</event></events>', '<event/>', '<events xmlns="urn:logs"><event><![CDATA[a < b]]></event></events>']) {
    await page.locator('#sample').setInputFiles({name:'sample.log', mimeType:'text/plain', buffer:Buffer.from(text)});
    await expect(page.locator('#sample-type')).toContainText('Detected type: XML');
    await page.getByRole('button', {name:'Review preview'}).click();
    await expect(page.locator('#review-type')).toHaveText('XML');
  }
  for (const text of ['<events><event></events>', '<one/><two/>', '<!DOCTYPE event SYSTEM "http://example.invalid/log.dtd"><event/>', '<!DOCTYPE event [<!ENTITY e "expanded">]><event>&e;</event>']) {
    await page.locator('#sample').setInputFiles({name:'sample.xml', mimeType:'application/xml', buffer:Buffer.from(text)});
    await expect(page.locator('#sample-type')).toContainText('Detected type: Other');
  }
  await page.getByLabel('Log type override').selectOption('XML');
  await page.getByRole('button', {name:'Review preview'}).click();
  await expect(page.locator('#review-type')).toHaveText('XML');
  await expect(page.locator('#review-type-note')).toContainText('Selected by you');
  expect(external).toEqual([]);
});

async function dropSamples(page: import('@playwright/test').Page, files: {name:string; text?:string; size?:number}[]) {
  const transfer = await page.evaluateHandle(files => {
    const data = new DataTransfer();
    for (const file of files) data.items.add(new File([file.text ?? 'A'.repeat(file.size ?? 120)], file.name, {type:'text/plain'}));
    return data;
  }, files);
  await page.locator('#upload-box').dispatchEvent('dragenter', {dataTransfer:transfer});
  await expect(page.locator('#upload-box')).toHaveClass(/drag-over/);
  await page.locator('#upload-box').dispatchEvent('dragover', {dataTransfer:transfer});
  await page.locator('#upload-box').dispatchEvent('drop', {dataTransfer:transfer});
  await transfer.dispose();
}
test('dropped files use detection, replace prior state, and work in preview', async ({page}) => {
  await page.goto('/'); await complete(page);
  await page.getByLabel('Log type override').selectOption('Syslog');
  await page.getByRole('button',{name:'Review preview'}).click();
  await dropSamples(page, [{name:'dropped.log',text:'{"event":"login"}'}]);
  await expect(page.locator('#sample-name')).toHaveText('dropped.log');
  await expect(page.locator('#sample-type')).toContainText('Detected type: JSON');
  await expect(page.locator('#log-type-override')).toHaveValue('');
  await expect(page.locator('#preview-result')).toBeHidden();
  await expect(page.locator('#upload-box')).not.toHaveClass(/drag-over/);
  await page.getByRole('button',{name:'Review preview'}).click();
  await expect(page.locator('#review-type')).toHaveText('JSON');
  await expect(page.locator('#review-sample')).toContainText('dropped.log');
  await page.getByRole('button',{name:'Remove',exact:true}).click();
  await expect(page.locator('#sample-info')).toBeHidden();
});
test('drops enforce the same size boundary and reject multiple files', async ({page}) => {
  await page.goto('/');
  await dropSamples(page, [{name:'too-large.log',size:1_000_001}]);
  await expect(page.locator('#sample-error')).toContainText('1 MB');
  await expect(page.locator('#sample-info')).toBeHidden();
  await dropSamples(page, [{name:'boundary.log',size:1_000_000}]);
  await expect(page.locator('#sample-name')).toHaveText('boundary.log');
  await expect(page.locator('#sample-type')).toContainText('Other');
  await dropSamples(page, [{name:'one.log'},{name:'two.log'}]);
  await expect(page.locator('#sample-error')).toContainText('one file');
  await expect(page.locator('#sample-info')).toBeHidden();
});


test('HEC creation is explicit and successful deployment displays endpoint and token', async ({page}) => {
 let requests=0;
 await page.route('**/api/hec', async route=>{
  requests++;
  expect(route.request().postDataJSON().group).toBe('dev-east');
  await route.fulfill({json:{endpoint:'http://example:8088/services/collector',token:'test-only-hec-token'}});
 });
 await page.goto('/');
 await page.getByLabel('Where does your data reside?').selectOption('dev-east');
 await page.getByLabel('What methods are available to collect your logs?').selectOption('hec');
 expect(requests).toBe(0);
 await page.getByRole('button',{name:'Create HEC credentials'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.locator('#hec-endpoint')).toHaveText('http://example:8088/services/collector');
 await expect(page.locator('#hec-token')).toHaveText('test-only-hec-token');
 await page.getByRole('button',{name:'Close credentials'}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await expect(page.locator('#hec-token')).toHaveText('');
 await page.getByRole('button',{name:'View HEC credentials'}).click();
 expect(requests).toBe(1);
 await page.keyboard.press('Escape');
 await page.getByLabel('What methods are available to collect your logs?').selectOption('api');
 await expect(page.locator('#hec-action')).toBeHidden();
});
test('HEC failure shows error illustration and retry reuses request ID', async({page})=>{
 const ids:string[]=[];
 await page.route('**/api/hec',async route=>{
 ids.push(route.request().postDataJSON().requestId);
 await route.fulfill({status:503,json:{message:'HEC setup could not be completed. Retry the same request.'}});
 });
 await page.goto('/');
 await page.getByLabel('Where does your data reside?').selectOption('dev-east');
 await page.getByLabel('What methods are available to collect your logs?').selectOption('hec');
 await page.getByRole('button',{name:'Create HEC credentials'}).click();
 await expect(page.locator('#hec-error')).toBeVisible();
 await expect(page.locator('#hec-error img')).toHaveAttribute('src','/error-pepe.png');
 await page.getByRole('button',{name:'Retry HEC setup'}).click();
 await expect.poll(()=>ids.length).toBe(2);
 expect(ids[0]).toBe(ids[1]);
 await expect(page.getByRole('dialog')).not.toBeVisible();
});

});
