import {test,expect} from '@playwright/test';
const catalog={version:1,provenance:'Test choices',workerGroups:[{key:'default',label:'Default'}]};
test.beforeEach(async({page})=>{await page.route('**/api/json-setup',r=>r.fulfill({json:{status:'created',pipeline:'pl_Akamai_Audit',route:'Akamai Audit',deployed:false}}));await page.route('**/source-catalog.json?*',r=>r.fulfill({json:{collectionMethods:[{key:'hec',label:'HEC',provisioning:'hec'},{key:'api',label:'API',provisioning:'summary'},{key:'other',label:'Other',disabled:true,provisioning:'summary'}]}}));await page.route('**/catalog.json',r=>r.fulfill({json:catalog}));await page.route('**/api/summary',r=>r.fulfill({json:{status:'sent'}}));});
async function complete(page:import('@playwright/test').Page,method='hec') {
 await page.locator('#requester-email').fill('requester@example.com');
 await page.locator('#application-name').fill('Akamai Audit');await page.locator('#barometer-id').fill('BAR-12345');
 await page.locator('#worker-group').selectOption('default');
 await expect(page.locator('#collection-method')).toBeEnabled();
 await page.locator('#collection-method').selectOption(method);
 await page.locator('#daily-volume').fill('1');
}
test('required fields are marked and sample step is hidden',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.question:visible')).toHaveCount(6);
 await expect(page.locator('#sample')).toBeHidden();
 await expect(page.locator('#create-hec')).toHaveCount(0);
 for(const id of ['requester-email','application-name','barometer-id','worker-group','collection-method','daily-volume','volume-unit'])await expect(page.locator('#'+id)).toHaveAttribute('required','');
 await expect(page.locator('.required-label:visible')).toHaveCount(7);
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
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
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
test('BarometerIT is required, included in the summary, and cleared on reset',async({page})=>{
 let posts=0;await page.route('**/api/summary',r=>{posts++;expect(r.request().postDataJSON().barometerId).toBe('BAR-12345');return r.fulfill({json:{status:'sent'}});});
 await page.goto('/');await complete(page,'api');await page.locator('#application-name').fill('Akamai Audit');await page.locator('#barometer-id').fill('   ');
 await page.getByRole('button',{name:'Submit request'}).click();await expect(page.locator('#barometerId-error')).not.toBeEmpty();expect(posts).toBe(0);
 await page.locator('#application-name').fill('Akamai Audit');await page.locator('#barometer-id').fill('BAR-12345');await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#review-barometer-id')).toHaveText('BAR-12345');await expect.poll(()=>posts).toBe(1);
 await page.locator('#application-name').fill('Akamai Audit');await page.locator('#barometer-id').fill('BAR-54321');await expect(page.locator('#preview-result')).toBeHidden();
 await page.getByRole('button',{name:'Clear request'}).click();await expect(page.locator('#barometer-id')).toHaveValue('');
});
test('includes disabled configured sources and keeps the existing question label',async({page})=>{
 const writes:string[]=[];
 await page.route('**/api/hec',r=>{writes.push('hec');return r.fulfill({status:500});});
 await page.route('**/source-catalog.json?*',r=>r.fulfill({json:{collectionMethods:[{key:'disabled-hec',label:'Splunk HEC',disabled:true,provisioning:'summary'},{key:'syslog-listener',label:'Syslog',disabled:false,provisioning:'summary'}]}}));
 await page.goto('/');await page.locator('#requester-email').fill('requester@example.com');await page.locator('#application-name').fill('Akamai Audit');await page.locator('#barometer-id').fill('BAR-1');await page.locator('#worker-group').selectOption('default');
 await expect(page.locator('label[for=collection-method]')).toContainText('What methods are available to collect your logs?');
 await expect(page.locator('#collection-method option')).toHaveCount(3);await page.locator('#collection-method').selectOption('disabled-hec');await page.locator('#daily-volume').fill('1');
 await page.getByRole('button',{name:'Submit request'}).click();await expect(page.locator('#review-method')).toHaveText('Splunk HEC');expect(writes).toEqual([]);
});
test('source lookup failure shows the error image and retry keeps the selected location',async({page})=>{
 let calls=0;await page.route('**/source-catalog.json?*',r=>{calls++;return r.fulfill(calls===1?{status:503}:{json:{collectionMethods:[{key:'syslog',label:'Syslog',provisioning:'summary'}]}});});
 await page.goto('/');await page.locator('#worker-group').selectOption('default');await expect(page.locator('#service-error')).toBeVisible();await expect(page.locator('#service-error img')).toHaveAttribute('src','/error-pepe.png');
 await page.getByRole('button',{name:'Try again'}).click();await expect(page.locator('#collection-method')).toBeEnabled();await expect(page.locator('#worker-group')).toHaveValue('default');
});
test('a slower old location response cannot replace current source choices',async({page})=>{
 await page.route('**/catalog.json',r=>r.fulfill({json:{...catalog,workerGroups:[{key:'default',label:'Default'},{key:'east',label:'East'}]}}));
 let finishOld:()=>void=()=>{};
 await page.route('**/source-catalog.json?*',async r=>{
  const old=r.request().url().endsWith('group=default');
  if(old)await new Promise<void>(resolve=>finishOld=resolve);
  await r.fulfill({json:{collectionMethods:[{key:old?'old':'new',label:old?'Old source':'East source',provisioning:'summary'}]}});
 });
 await page.goto('/');await page.locator('#worker-group').selectOption('default');await page.locator('#worker-group').selectOption('east');await expect(page.locator('#collection-method option[value=new]')).toHaveCount(1);finishOld();
 await expect(page.locator('#collection-method option[value=old]')).toHaveCount(0);
});

test('source descriptions appear as tooltips and accessible selected help',async({page})=>{
 await page.route('**/source-catalog.json?*',r=>r.fulfill({json:{collectionMethods:[{key:'type:kafka',label:'Kafka',description:'Read events from Kafka topics.',disabled:false,provisioning:'summary'}]}}));
 await page.goto('/');await page.locator('#worker-group').selectOption('default');
 await expect(page.locator('#collection-method option[value="type:kafka"]')).toHaveAttribute('title','Read events from Kafka topics.');
 await page.locator('#collection-method').selectOption('type:kafka');
 await expect(page.locator('#source-description')).toHaveText('Read events from Kafka topics.');
 await page.locator('#worker-group').selectOption('');
 await expect(page.locator('#source-description')).toBeEmpty();
});
test('application name is required and appears in the request summary',async({page})=>{
 await page.goto('/');await complete(page,'api');await page.locator('#application-name').fill(' ');
 await page.getByRole('button',{name:'Submit request'}).click();await expect(page.locator('#applicationName-error')).toContainText('Enter an application');
 await page.locator('#application-name').fill('Akamai Audit');await page.getByRole('button',{name:'Submit request'}).click();await expect(page.locator('#review-application-name')).toHaveText('Akamai Audit');
});

test('HEC completion creates processing drafts and reports uncommitted state',async({page})=>{
 const requests:any[]=[];
 await page.route('**/api/hec',r=>r.fulfill({json:{endpoint:'http://example.com',token:'test-token'}}));
 await page.route('**/api/json-setup',r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:{status:'created',deployed:false}});});
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#processing-status')).toContainText('not committed or deployed');
 expect(requests[0].applicationName).toBe('Akamai Audit');expect(requests[0].barometerId).toBe('BAR-12345');
});
test('processing failure shows image and retry reuses its request ID',async({page})=>{
 const requests:any[]=[];
 await page.route('**/api/hec',r=>r.fulfill({json:{endpoint:'http://example.com',token:'test-token'}}));
 await page.route('**/api/json-setup',r=>{requests.push(r.request().postDataJSON());return r.fulfill({status:503,json:{message:'failed'}});});
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#processing-error img')).toBeVisible();await page.locator('#close-hec').click();
 await page.getByRole('button',{name:'Submit request'}).click();await expect.poll(()=>requests.length).toBe(2);
 expect(requests[0].requestId).toBe(requests[1].requestId);
});

test('paused mail is informational and diagnostic details are copyable without secrets',async({page})=>{
 await page.route('**/api/summary',r=>r.fulfill({status:202,headers:{'X-Portal-Diagnostic':'EMAIL_PAUSED'},json:{status:'paused'}}));
 await page.goto('/');await complete(page,'api');await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#email-status')).toContainText('Email delivery is paused');await expect(page.locator('#summary-email-error')).toBeHidden();
 await page.locator('#diagnostic-panel summary').click();
 await expect(page.locator('#diagnostic-output')).toHaveValue(/SOURCE_SUMMARY_ONLY/);await expect(page.locator('#diagnostic-output')).toHaveValue(/EMAIL_PAUSED/);
 expect(await page.locator('#diagnostic-output').inputValue()).not.toContain('requester@example.com');
 await page.locator('#copy-diagnostics').click();await expect(page.locator('#diagnostic-copy-status')).toContainText(/copied|Ctrl\+C/);
});
test('HEC diagnostics omit credentials and report a safe upstream error code',async({page})=>{
 await page.route('**/api/hec',r=>r.fulfill({status:503,headers:{'X-Portal-Diagnostic':'CRIBL_PENDING_CHANGES'},json:{token:'never-log-secret',password:'never-log-password',message:'unsafe diagnostic text'}}));
 await page.goto('/');await complete(page);await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.locator('#diagnostic-output')).toHaveValue(/CRIBL_PENDING_CHANGES/);
 const output=await page.locator('#diagnostic-output').inputValue();expect(output).not.toMatch(/never-log|unsafe diagnostic/);await expect(page.locator('#diagnostic-panel')).toHaveAttribute('open','');
});
test('disabled mapped HEC runs setup only on Submit',async({page})=>{
 let posts=0;
 await page.route('**/source-catalog.json?*',r=>r.fulfill({json:{collectionMethods:[{key:'hec',label:'Splunk HEC',disabled:true,provisioning:'hec'}]}}));
 await page.route('**/api/hec',r=>{posts++;return r.fulfill({json:{endpoint:'http://example.com',token:'test-only'}});});
 await page.goto('/');await complete(page);expect(posts).toBe(0);
 await page.getByRole('button',{name:'Submit request'}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(posts).toBe(1);
});
