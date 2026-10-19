import {test,expect} from '@playwright/test';
const catalog={version:1,provenance:'Test choices',workerGroups:[{key:'default',label:'Default'}]};
test.beforeEach(async({page})=>{await page.route('**/catalog.json',r=>r.fulfill({json:catalog}));await page.route('**/api/summary',r=>r.fulfill({json:{status:'sent'}}));});
async function complete(page:import('@playwright/test').Page,method='hec') {
 await page.locator('#requester-email').fill('requester@example.com');
 await page.locator('#barometer-id').fill('BAR-12345');
 await page.locator('#worker-group').selectOption('default');
 await page.locator('#collection-method').selectOption(method);
 await page.locator('#daily-volume').fill('1');
}
test('required fields are marked and sample step is hidden',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.question:visible')).toHaveCount(5);
 await expect(page.locator('#sample')).toBeHidden();
 await expect(page.locator('#create-hec')).toHaveCount(0);
 for(const id of ['requester-email','barometer-id','worker-group','collection-method','daily-volume','volume-unit'])await expect(page.locator('#'+id)).toHaveAttribute('required','');
 await expect(page.locator('.required-label:visible')).toHaveCount(6);
});
test('invalid submissions do not create tokens',async({page})=>{
 let calls=0;await page.route('**/api/hec',r=>{calls++;return r.fulfill({json:{}});});
 await page.goto('/');await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#group-error')).not.toBeEmpty();
 await expect(page.locator('#method-error')).not.toBeEmpty();
 await expect(page.locator('#volume-error')).not.toBeEmpty();
 await complete(page);await page.locator('#daily-volume').fill('0.5');
 await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#volume-error')).toContainText('at least 1 GB');
 expect(calls).toBe(0);
});
test('HEC submit opens credentials popup without a sample; repeated submit reuses credentials',async({page})=>{
 let calls=0;await page.route('**/api/hec',async r=>{calls++;expect(r.request().postDataJSON().group).toBe('default');await r.fulfill({json:{endpoint:'http://example:8088/services/collector',token:'test-only-token'}});});
 await page.goto('/');await complete(page);
 expect(calls).toBe(0);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#hec-token')).toHaveText('test-only-token');
 await expect(page.locator('#preview-result')).toBeVisible();await expect(page.locator('#review-sample')).toBeHidden();
 await page.getByRole('button',{name:'Close credentials'}).click();await expect(page.locator('#hec-token')).toHaveText('');
 await page.getByRole('button',{name:'Submit request'}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(calls).toBe(1);
});
for(const method of ['api','other'])test(`${method} submit remains a read-only preview`,async({page})=>{
 const posts:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&!r.url().endsWith('/api/summary'))posts.push(r.url());});
 await page.goto('/');await complete(page,method);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#preview-result')).toBeVisible();await expect(page.getByRole('dialog')).not.toBeVisible();expect(posts).toEqual([]);
 await page.locator('#daily-volume').fill('2');await expect(page.locator('#preview-result')).toBeHidden();
});
test('failed submission shows error illustration and retry keeps request ID',async({page})=>{
 const ids:string[]=[];await page.route('**/api/hec',async r=>{ids.push(r.request().postDataJSON().requestId);await r.fulfill({status:503,json:{}});});
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#hec-error')).toBeVisible();await expect(page.locator('#hec-error img')).toHaveAttribute('src','/error-pepe.png');
 await page.getByRole('button',{name:'Submit request'}).click();await expect.poll(()=>ids.length).toBe(2);expect(ids[0]).toBe(ids[1]);
});
test('pending submission locks fields and reset to prevent duplicate creation',async({page})=>{
 let finish:()=>void=()=>{};let calls=0;
 await page.route('**/api/hec',async r=>{calls++;await new Promise<void>(resolve=>finish=resolve);await r.fulfill({json:{endpoint:'http://example:8088/services/collector',token:'test-only-token'}});});
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#preview-button')).toBeDisabled();await expect(page.getByRole('button',{name:'Clear request'})).toBeDisabled();
 finish();await expect(page.getByRole('dialog')).toBeVisible();expect(calls).toBe(1);
});
test('reset clears credentials and required field errors',async({page})=>{
 await page.route('**/api/hec',r=>r.fulfill({json:{endpoint:'http://example:8088/services/collector',token:'test-only-token'}}));
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Clear request'}).click();await expect(page.locator('#daily-volume')).toHaveValue('');await expect(page.locator('#hec-token')).toHaveText('');
 await expect(page.locator('#preview-result')).toBeHidden();
});
test('empty and failed catalogs block submission',async({page})=>{
 await page.route('**/catalog.json',r=>r.fulfill({json:{...catalog,workerGroups:[]}}));await page.goto('/');await expect(page.locator('#preview-button')).toBeDisabled();
 await page.route('**/catalog.json',r=>r.fulfill({status:500,body:'failed'}));await page.reload();await expect(page.locator('#service-error')).toBeVisible();await expect(page.locator('#preview-button')).toBeDisabled();
});
test('five-question form and popup fit small screens',async({page})=>{
 await page.setViewportSize({width:320,height:800});await page.route('**/api/hec',r=>r.fulfill({json:{endpoint:'http://example:8088/services/collector',token:'test-only-token'}}));
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('slow deployment automatically rechecks the same request and shows credentials',async({page})=>{
 const ids:string[]=[];
 await page.route('**/api/hec',async r=>{
  ids.push(r.request().postDataJSON().requestId);
  await r.fulfill(ids.length===1?{status:202,json:{status:'pending'}}:{json:{endpoint:'http://example:8088/services/collector',token:'test-only-token'}});
 });
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.getByRole('dialog')).toBeVisible({timeout:15000});
 expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
 await expect(page.locator('#hec-token')).toHaveText('test-only-token');
});

test('email is the first required question and summary contains the requester',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.question:visible').first()).toContainText('Your email address');
 await complete(page,'api');await page.locator('#requester-email').fill('invalid');
 await page.getByRole('button',{name:'Submit request'}).click();await expect(page.locator('#email-error')).not.toBeEmpty();
 await page.locator('#requester-email').fill('requester@example.com');await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#review-email')).toHaveText('requester@example.com');
 await expect(page.locator('#email-status')).toContainText('Summary emailed');
});
test('email failure leaves HEC credentials available and retries the same summary',async({page})=>{
 let hecCalls=0;const ids:string[]=[];
 await page.route('**/api/hec',r=>{hecCalls++;return r.fulfill({json:{endpoint:'http://example:8088/services/collector',token:'test-only-token'}});});
 await page.route('**/api/summary',r=>{ids.push(r.request().postDataJSON().requestId);expect(r.request().postDataJSON().email).toBe('requester@example.com');expect(r.request().postDataJSON().token).toBeUndefined();return r.fulfill(ids.length===1?{status:503,json:{}}:{json:{status:'sent'}});});
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#email-status')).toContainText('could not');
 await page.getByRole('button',{name:'Close credentials'}).click();await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#email-status')).toContainText('Summary emailed');expect(hecCalls).toBe(1);expect(ids[0]).toBe(ids[1]);
});

test('missing mail configuration is reported without claiming delivery',async({page})=>{
 await page.route('**/api/summary',r=>r.fulfill({status:503,json:{code:'EMAIL_UNAVAILABLE'}}));
 await page.goto('/');await complete(page,'api');await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#email-status')).toContainText('not configured yet');
 await expect(page.locator('#email-status')).not.toContainText('Summary emailed');
});
test('shows a newly created token while deployment is pending and updates readiness',async({page})=>{
 let calls=0;let finish:()=>void=()=>{};
 await page.route('**/api/hec',async r=>{
  calls++;
  if(calls===1)return r.fulfill({status:202,json:{status:'pending',endpoint:'http://example:8088/services/collector',token:'test-only-token'}});
  await new Promise<void>(resolve=>finish=resolve);
  await r.fulfill({json:{endpoint:'http://example:8088/services/collector',token:'test-only-token'}});
 });
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#hec-token')).toHaveText('test-only-token');
 await expect(page.locator('#hec-dialog-status')).toContainText('Deployment is pending');
 await expect.poll(()=>calls,{timeout:10000}).toBe(2);finish();
 await expect(page.locator('#hec-dialog-status')).toContainText('ready to use');
});
test('BarometerID is required, included in the summary, and cleared on reset',async({page})=>{
 let posts=0;await page.route('**/api/summary',r=>{posts++;expect(r.request().postDataJSON().barometerId).toBe('BAR-12345');return r.fulfill({json:{status:'sent'}});});
 await page.goto('/');await complete(page,'api');await page.locator('#barometer-id').fill('   ');
 await page.getByRole('button',{name:'Submit request'}).click();await expect(page.locator('#barometerId-error')).not.toBeEmpty();expect(posts).toBe(0);
 await page.locator('#barometer-id').fill('BAR-12345');await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#review-barometer-id')).toHaveText('BAR-12345');await expect.poll(()=>posts).toBe(1);
 await page.locator('#barometer-id').fill('BAR-54321');await expect(page.locator('#preview-result')).toBeHidden();
 await page.getByRole('button',{name:'Clear request'}).click();await expect(page.locator('#barometer-id')).toHaveValue('');
});
