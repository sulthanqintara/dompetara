import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const screenshots = process.env.RECEIPT_PICKER_SCREENSHOTS;
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const account = randomUUID(), token = randomUUID();
const errors = [];
const fixture = await readFile("tests/fixtures/receipt.png");
const filename = "Struk pembayaran dengan nama panjang ".repeat(5) + "2026.png";
let browser;
async function check(page, name, width, height) {
  await page.evaluate(() => document.fonts.ready);
  const dialog = page.getByRole("dialog");
  await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} page overflow`);
  const box = await dialog.boundingBox();
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${name} fits viewport`);
  assert.ok(await dialog.evaluate((el) => {
    const expected = getComputedStyle(el.querySelector(".panel-heading")).backgroundColor;
    return [el, el.querySelector(".editor-body"), el.querySelector(".form-actions")].every((part) => getComputedStyle(part).backgroundColor === expected);
  }), `${name} has one background throughout`);
  if (screenshots) await page.screenshot({ path: `${screenshots}/${name}-${width}x${height}.png`, caret: "initial" });
}
try {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const codec = createSessionTokenCodec(process.env.BETTER_AUTH_SECRET);
  await sql`insert into public."user" (id, name, email) values (${account}, 'Receipt picker test', ${account + '@example.invalid'})`;
  await sql`insert into public.session (id,user_id,token,token_hash,expires_at,updated_at) values (${randomUUID()},${account},${await codec.encrypt(token)},${codec.hash(token)},${new Date(Date.now()+3600000)},${new Date()})`;
  await sql`insert into public.ledger (user_id,data) values (${account},${sql.json({ wallets: [{id:'bank',name:'BCA',currencies:['IDR','USD']}], categories: [], entries: [] })})`;
  await sql`insert into public.user_preferences (user_id,language_prompt_shown_at) values (${account},${new Date()})`;
  const signature = createHmac('sha256',process.env.BETTER_AUTH_SECRET).update(token).digest('base64');
  for (const language of ['en','id']) {
    for (const theme of ['light','dark']) {
      const context = await browser.newContext({colorScheme:theme,locale:language==='id'?'id-ID':'en-US'});
      await context.addCookies([
        {name:'locale',value:language,url:origin},
        {name:'better-auth.session_token',value:encodeURIComponent(`${token}.${signature}`),url:origin,httpOnly:true,sameSite:'Lax'},
      ]);
      const page = await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      await page.goto(`${origin}/transactions`);
      await page.waitForFunction(dark=>document.documentElement.classList.contains('dark')===dark,theme==='dark');
      for (const [width,height] of [[320,568],[390,844],[568,320],[768,1024],[1440,900]]) {
        await page.setViewportSize({width,height});
        for (const kind of ['income','expense','transfer','receipt']) {
          await page.getByRole('button',{name:language==='id'?'Tambah transaksi':'Add transaction',exact:true}).click();
          const names = language==='id' ? {income:'Pemasukan',expense:'Pengeluaran',transfer:'Transfer',receipt:'Impor struk'} : {income:'Income',expense:'Expense',transfer:'Transfer',receipt:'Import receipt'};
          await page.getByRole('menuitem',{name:names[kind],exact:true}).click();
          const dialog=page.getByRole('dialog');
          await dialog.waitFor();
          await check(page,`${language}-${theme}-${kind}`,width,height);
          if(kind==='receipt') {
            const button=dialog.getByRole('button',{name:language==='id'?'Pilih berkas':'Choose file',exact:true});
            assert.equal(await dialog.locator('#receipt-file-name').innerText(),language==='id'?'Belum ada berkas dipilih':'No file selected');
            const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44,'Picker touch target');
            await dialog.getByRole('button',{name:language==='id'?'Baca struk':'Read receipt',exact:true}).click();
            await dialog.getByRole('alert').waitFor();
            assert.equal(await button.evaluate(el=>el===document.activeElement),true,'Invalid file field focuses visible button');
            const picker=page.waitForEvent('filechooser');
            await button.press('Enter');
            await (await picker).setFiles({name:filename,mimeType:'image/png',buffer:fixture});
            await dialog.getByRole('alert').waitFor({state:'detached'});
            assert.equal(await dialog.locator('#receipt-file-name').innerText(),filename);
            assert.equal(await dialog.locator('.receipt-file-picker').evaluate(el=>el.scrollWidth>el.clientWidth),false,'Long filename fits');
            await check(page,`${language}-${theme}-receipt-long-file`,width,height);
            const replacement=page.waitForEvent('filechooser');await button.press('Space');
            await (await replacement).setFiles('tests/fixtures/receipt.png');
            assert.equal(await dialog.locator('#receipt-file-name').innerText(),'receipt.png');
            await page.route('**/api/receipts/extract',route=>route.fulfill({json:{importId:randomUUID(),fingerprint:'a'.repeat(64),method:'ocr',draft:{documentKind:'receipt',merchant:'Demo',date:'2026-10-12',time:'11:44',currency:'IDR',receiptNumber:null,total:'1000',items:[],adjustments:[],warnings:[]}}}));
            await dialog.getByRole('button',{name:language==='id'?'Baca struk':'Read receipt',exact:true}).click();
            await dialog.getByRole('heading',{name:language==='id'?'Periksa struk':'Review receipt',exact:true}).waitFor();
            await check(page,`${language}-${theme}-receipt-review`,width,height);
            await page.unroute('**/api/receipts/extract');
          }
          await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
          assert.equal(await page.getByRole('button',{name:language==='id'?'Tambah transaksi':'Add transaction',exact:true}).evaluate(el=>el===document.activeElement),true,'Modal restores focus');
        }
        await page.goto(`${origin}/wallet`);
        await page.getByRole('button',{name:language==='id'?'Tambah dompet':'Add wallet',exact:true}).first().click();
        await check(page,`${language}-${theme}-wallet`,width,height);
        await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
        await page.goto(`${origin}/transactions`);
      }
      await context.close();
    }
  }
  assert.deepEqual(errors,[],'No browser errors');
  console.log('Receipt picker and modal checks passed: both languages/themes at five sizes, keyboard selection/replacement, required validation, long filenames, extraction, matching backgrounds and focus restoration.');
} finally {
  await browser?.close();
  await sql`delete from public."user" where id=${account}`;
  await sql.end({timeout:1});
}
