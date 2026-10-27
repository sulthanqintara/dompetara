import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const {chromium}=require('playwright');
const dictionaries={en:require(root+'/messages/en.json'),id:require(root+'/messages/id.json')};
const outputDirectory=process.env.LEDGER_COVERAGE_DIR ?? await mkdtemp(join(tmpdir(),'dompetara-editors-'));
await mkdir(outputDirectory,{recursive:true});
const bundlePath=join(outputDirectory,'editor-fixture.js');
await build({entryPoints:[join(root,'tests/fixtures/ledger-editor.tsx')],outfile:bundlePath,bundle:true,
  sourcemap:'linked',platform:'browser',format:'iife',jsx:'automatic',alias:{'@':join(root,'src')},
  define:{'process.env.NODE_ENV':'"test"'}});
const code=await readFile(bundlePath,'utf8');
const bundleUrl=pathToFileURL(bundlePath).href;
const css=`body{font-family:Arial,sans-serif;margin:16px}button,input{font:inherit;min-height:44px}input{max-width:100%;box-sizing:border-box}
[role=dialog],[role=alertdialog]{position:fixed;inset:16px;overflow:auto;background:white;padding:16px;box-shadow:0 0 0 100vmax #0003}
[role=alertdialog]{inset:25% 16px}[data-slot=select-content]{background:white}.form-field{display:flex;flex-direction:column;gap:8px;margin:12px 0}
.form-actions{display:flex;gap:8px;margin-top:16px}.currency-input{display:flex;gap:8px}.currency-input input{min-width:0;flex:1}
[role=dialog] form{max-width:600px;margin:auto}.panel-heading{display:flex;justify-content:space-between}.transfer-summary p{display:flex;gap:12px}`;
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const errors=[];
try {
 for(const locale of ['en','id'])for(const [width,height] of [[320,568],[768,1024],[1440,900],[568,320]]){
  const t=dictionaries[locale].UI;
  const context=await browser.newContext({viewport:{width,height},timezoneId:'Asia/Jakarta'});
  context.setDefaultTimeout(15000);const page=await context.newPage();
  const cdp=await context.newCDPSession(page);
  await cdp.send('Profiler.enable');await cdp.send('Profiler.startPreciseCoverage',{callCount:true,detailed:true});page.on('pageerror',e=>{errors.push(e.message);console.error('Fixture page error:',e.message)});
  await page.route('http://localhost:49001/**',async r=>{
   if(r.request().url().endsWith('/api/receipts/extract')){
    assert.ok(r.request().postDataBuffer().includes(Buffer.from(locale)));
    await r.fulfill({json:{importId:'00000000-0000-4000-8000-000000000111',fingerprint:'a'.repeat(64),method:'ai',draft:{documentKind:'receipt',merchant:'Fixture Store',date:'2026-10-01',time:'12:34',currency:'IDR',receiptNumber:null,total:'12.34',items:[],adjustments:[],warnings:[],paymentSource:null,suggestedWallet:{walletId:'bank',reason:'Test match'},suggestedCategory:{name:'Food & drink',reason:'Test match'}}}});
   }else await r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>Editor regression fixture</title></head><body><div id="root"></div></body></html>'});
  });
  await page.goto('http://localhost:49001/');await page.addStyleTag({content:css});await page.addScriptTag({content:"window.process={env:{NODE_ENV:'test'}};"});await page.addScriptTag({content:code+'\n//# sourceURL='+bundleUrl});
  await page.evaluate(locale=>window.mount(locale),locale);await page.locator('#opener').waitFor();
  const dialog=page.getByRole('dialog');
  const open=async(config)=>{await page.evaluate(config=>window.nextConfig=config,config);await page.locator('#opener').click();await dialog.waitFor();await dialog.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));};
  const close=async()=>{await dialog.getByRole('button',{name:t.cancel,exact:true}).click();await dialog.waitFor({state:'detached'});await page.waitForFunction(()=>document.activeElement?.id==='opener');};
  const choose=async(label,value)=>{await dialog.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();};
  const input=(name)=>dialog.locator('.currency-input:has(input[type="hidden"][name="'+name+'"]) input:not([type="hidden"])');
  const money=async(name,value)=>{await input(name).fill(value);await input(name).blur();};
  const save=async()=>{await dialog.getByRole('button',{name:t.save,exact:true}).click();await Promise.race([dialog.waitFor({state:'detached'}),dialog.getByRole('alert').waitFor().then(async()=>{throw new Error('Editor save error: '+await dialog.getByRole('alert').textContent())})]);return page.evaluate(()=>window.saved.at(-1));};
  await open({type:'entry',kind:'expense',id:'expense'});
  assert.equal(await dialog.locator('input[name="title"]').inputValue(),'Existing lunch');
  assert.ok((await dialog.getByRole('combobox',{name:t.category,exact:true}).textContent()).includes('Archived dining'));
  await dialog.locator('input[name="title"]').fill('Updated lunch');
  await page.evaluate(()=>window.setFlags({pending:true,conflict:false}));
  await page.waitForFunction(label=>Array.from(document.querySelectorAll('button[type=submit]')).some(button=>button.disabled&&button.textContent.includes(label)),t.saving);
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);
  assert.equal(await dialog.locator('form:visible button[type=submit]').isDisabled(),true);
  await page.evaluate(()=>window.setFlags({pending:false,conflict:true}));
  await dialog.getByRole('button',{name:t.save,exact:true}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:t.save,exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.setFlags({pending:false,conflict:false}));
  const edited=await save();assert.equal(edited.date,'2026-10-01T00:00:56.123Z');assert.equal(edited.title,'Updated lunch');
  await open({type:'wallet'});await dialog.locator('input[name="name"]').fill('New fixture wallet');await money('amount','100,25');
  const wallet=await save();assert.equal(wallet.action,'wallet');assert.equal(wallet.amount,'100.25');
  await open({type:'entry',kind:'income'});await dialog.locator('input[name="title"]').fill('Fixture income');await money('amount','25,50');
  await dialog.getByRole('button',{name:t.addCategory,exact:true}).click();await dialog.getByRole('textbox',{name:t.newCategoryName,exact:true}).fill('Custom income');
  const income=await save();assert.equal(income.newCategory,true);assert.equal(income.amount,'25.50');assert.equal(income.kind,'income');
  await open({type:'entry',kind:'transfer',id:'transfer'});
  assert.equal(await dialog.locator('input[name="exchangeRate"]').inputValue(),'10');
  assert.equal(await dialog.locator('input[name="received"][type="hidden"]').inputValue(),'100.00');
  await dialog.locator('input[name="exchangeRate"]').fill('2');
  await page.waitForFunction(()=>document.querySelector('input[type="hidden"][name="received"]')?.value==='20.00');
  await money('received','25');assert.equal(await dialog.locator('input[name="exchangeRate"]').inputValue(),'2.5');
  await money('amount','20');assert.equal(await dialog.locator('input[name="exchangeRate"]').inputValue(),'1.25');
  await dialog.getByRole('button',{name:t.useSuggestedRate,exact:true}).click();
  assert.equal(await dialog.locator('input[name="received"][type="hidden"]').inputValue(),'40.00');
  await choose(t.feeChargedTo,t.sourceOption.replace('{name}','Fixture Bank').replace('{currency}','USD'));
  assert.equal(await dialog.locator('input[name="feeAmount"][type="hidden"]').inputValue(),'');
  await money('feeAmount','0.50');
  const converted=await save();assert.equal(converted.rateSource,'ecb');assert.equal(converted.exchangeRate,'2');assert.equal(converted.received,'40.00');assert.equal(converted.feeChargedTo,'source');
  await open({type:'entry',kind:'transfer'});await money('amount','10');await choose(t.toWallet,'Fixture Cash');
  assert.equal(await dialog.locator('input[name="exchangeRate"]').count(),0);assert.equal(await input('received').getAttribute('readonly'),'');
  const same=await save();assert.equal(same.received,'10.00');assert.equal(same.exchangeRate,undefined);
  await open({type:'entry',kind:'transfer'});await choose(t.destinationCurrency,'USD');await choose(t.toWallet,'Fixture Bank');
  await choose(t.sourceCurrency,'USD');await page.waitForFunction(()=>{const form=document.querySelector('[role=dialog] form');const value=form&&new FormData(form).get('toWallet');return value===null||value===''});await close();
  await open({type:'entry',kind:'expense'});await dialog.getByRole('button',{name:t.importReceipt,exact:true}).click();
  await page.waitForFunction(()=>document.activeElement?.id==='receipt-file-button');
  await dialog.getByRole('button',{name:t.enterManually,exact:true}).click();
  await page.waitForFunction(label=>document.activeElement?.textContent?.includes(label),t.importReceipt);
  await dialog.getByRole('button',{name:t.importReceipt,exact:true}).click();
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,80,80);return c.toDataURL('image/png').split(',')[1]});
  await dialog.locator('input[type="file"]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await dialog.getByRole('button',{name:t.readReceipt,exact:true}).click();
  try {await page.waitForFunction(()=>document.activeElement?.getAttribute('name')==='title');}catch(error){console.error('Receipt focus diagnostics:',locale,width,await page.evaluate(()=>({active:document.activeElement?.outerHTML,alerts:Array.from(document.querySelectorAll('[role=alert]')).map(e=>e.textContent),forms:Array.from(document.querySelectorAll('form')).map(f=>({display:getComputedStyle(f).display,busy:f.getAttribute('aria-busy')})),title:document.querySelector('input[name=title]')?.value})));throw error;}
  assert.equal(await dialog.locator('input[name="title"]').inputValue(),'Fixture Store');
  const imported=await save();assert.equal(imported.action,'receipt');assert.equal(imported.receipt.merchant,'Fixture Store');assert.equal(imported.details,undefined);
  await open({type:'entry',kind:'expense',id:'expense'});await page.evaluate(()=>window.failSave=true);
  await dialog.getByRole('button',{name:t.save,exact:true}).click();await dialog.getByRole('alert').waitFor();
  assert.ok((await dialog.getByRole('alert').textContent()).trim());
  await dialog.locator('input[name="title"]').fill('Recovered');assert.equal(await dialog.getByRole('alert').count(),0);await page.evaluate(()=>window.failSave=false);await save();
  await open({type:'entry',kind:'expense',id:'expense'});await dialog.getByRole('button',{name:t.delete,exact:true}).click();
  const confirmation=page.getByRole('alertdialog');await confirmation.waitFor();await confirmation.getByRole('button',{name:t.cancel,exact:true}).click();await confirmation.waitFor({state:'detached'});
  await dialog.getByRole('button',{name:t.delete,exact:true}).click();await confirmation.getByRole('button',{name:t.deleteTransaction,exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.equal((await page.evaluate(()=>window.saved.at(-1))).action,'deleteEntry');
  const result=(await cdp.send('Profiler.takePreciseCoverage')).result.filter(script=>script.url===bundleUrl);
  await writeFile(join(outputDirectory,`browser-${locale}-${width}.json`),JSON.stringify({result}));
  await context.close();console.log('Editor browser checks passed:',locale,width+'x'+height);
 }
 assert.deepEqual(errors,[]);
 console.log('All editor flows passed with real components/domain mutations and synthetic receipt/rate boundaries. No database or provider access.');
}finally{await browser.close();if(!process.env.LEDGER_COVERAGE_DIR)await rm(outputDirectory,{recursive:true,force:true})}
