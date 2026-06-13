#!/usr/bin/env node
/**
 * Destructive-safe, real-user acceptance suite for every Dripmetric product area.
 *
 * Required: DATABASE_URL, TEST_ENTERPRISE_API_KEY, INDIVIDUAL_STATE and ENTERPRISE_STATE.
 * The authenticated state files must belong to TEST_INDIVIDUAL_TENANT_ID and
 * TEST_ENTERPRISE_TENANT_ID. Every seeded row contains a unique run marker and is
 * removed in finally; pre-existing rows are never updated or deleted.
 *
 * Run: npm run test:acceptance
 */
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local','utf8').split('\n') : []) {
  const i=line.indexOf('='); if(i>0 && !line.trim().startsWith('#') && !process.env[line.slice(0,i)]) process.env[line.slice(0,i)]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');
}
const BASE=process.env.BASE_URL||'http://localhost:3000';
const IND_STATE=process.env.INDIVIDUAL_STATE||'.auth/individual.json';
const ENT_STATE=process.env.ENTERPRISE_STATE||'.auth/enterprise.json';
const IND=process.env.TEST_INDIVIDUAL_TENANT_ID;
const ENT=process.env.TEST_ENTERPRISE_TENANT_ID;
const KEY=process.env.TEST_ENTERPRISE_API_KEY;
const marker=`acceptance_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const email=`${marker}@example.test`;
let sql, browser, listId, contactId, campaignId, endUserId;
const failures=[];
function ok(v,m){if(!v)throw Error(m)}
async function test(name,fn){try{await fn();console.log(`✅ ${name}`)}catch(e){failures.push(`${name}: ${e.message}`);console.error(`❌ ${name}: ${e.message}`)}}
async function status(page,path,expected){const r=await page.goto(BASE+path,{waitUntil:'domcontentloaded'});ok(expected.includes(r.status()),`${path}: got ${r.status()}`)}
async function cleanup(){if(!sql)return; await sql.begin(async tx=>{
  await tx`delete from campaign_events where contact_email=${email}`;
  await tx`delete from contact_tag_assignments where contact_id in (select id from individual_contacts where email=${email})`;
  await tx`delete from contact_notes where contact_id in (select id from individual_contacts where email=${email})`;
  await tx`delete from individual_campaigns where list_id in (select id from individual_lists where name=${marker})`;
  await tx`delete from individual_contacts where email=${email}`;
  await tx`delete from individual_lists where name=${marker}`;
  await tx`delete from contact_tags where name=${marker}`;
  await tx`delete from webhook_deliveries where webhook_id in (select id from webhooks where url like ${'%'+marker+'%'})`;
  await tx`delete from webhooks where url like ${'%'+marker+'%'}`;
  await tx`delete from drip_steps where event_trigger=${marker}`;
  await tx`delete from suppressed_emails where end_user_id in (select id from end_users where external_id=${marker})`;
  await tx`delete from end_users where external_id=${marker} or email=${email}`;
  await tx`delete from waitlist_entries where email=${email}`;
  await tx`delete from processed_webhook_events where stripe_event_id like ${marker+'%'}`;
 });}
async function run(){
  for(const [n,v] of Object.entries({DATABASE_URL:process.env.DATABASE_URL,TEST_INDIVIDUAL_TENANT_ID:IND,TEST_ENTERPRISE_TENANT_ID:ENT,TEST_ENTERPRISE_API_KEY:KEY})) ok(v,`Missing ${n}`);
  ok(fs.existsSync(IND_STATE),`Missing ${IND_STATE}`); ok(fs.existsSync(ENT_STATE),`Missing ${ENT_STATE}`);
  sql=(await import('postgres')).default(process.env.DATABASE_URL,{max:1});
  const pw=require('playwright'); browser=await pw.chromium.launch({headless:process.env.HEADED!=='1'});
  const anon=await browser.newContext(); const page=await anon.newPage();
  await test('public pages, SEO, and legal pages render',async()=>{for(const p of ['/','/login','/pricing','/docs','/privacy','/terms','/sitemap.xml','/robots.txt']) await status(page,p,[200])});
  await test('security headers are present',async()=>{const r=await page.goto(BASE);ok(r.headers()['x-frame-options']==='DENY','X-Frame-Options');ok(r.headers()['x-content-type-options']==='nosniff','X-Content-Type-Options')});
  await test('all protected pages reject an anonymous real browser',async()=>{for(const p of ['/dashboard','/dashboard/individual','/dashboard/enterprise','/tier-selection']){const r=await page.goto(BASE+p);ok(r.url().includes('/login'),`${p} did not redirect`)}});
  await test('waitlist validates malformed input',async()=>{const r=await anon.request.post(BASE+'/api/waitlist',{data:{email:'bad'}});ok(r.status()===400,`got ${r.status()}`)});
  await anon.close();

  const ic=await browser.newContext({storageState:IND_STATE}); const ip=await ic.newPage();
  await test('individual real-user navigation renders every screen',async()=>{for(const p of ['/dashboard/individual','/dashboard/individual/lists','/dashboard/individual/campaigns','/dashboard/individual/campaigns/create','/dashboard/individual/pipeline','/dashboard/individual/settings','/dashboard/individual/billing']) await status(ip,p,[200])});
  await test('individual API creates list, contact, campaign, notes, tag and reminder',async()=>{
    let r=await ic.request.post(BASE+'/api/individual/lists',{data:{name:marker,description:'acceptance cleanup marker'}});ok(r.ok(),`list ${r.status()}`);listId=(await r.json()).list.id;
    r=await ic.request.post(`${BASE}/api/individual/lists/${listId}/contacts`,{data:{name:marker,email,phone:'+15555550100'}});ok(r.ok(),`contact ${r.status()}`);contactId=(await r.json()).contact.id;
    r=await ic.request.post(`${BASE}/api/individual/lists/${listId}/campaigns`,{data:{subject:marker,body:'<p>Acceptance</p>'}});ok(r.ok(),`campaign ${r.status()}`);campaignId=(await r.json()).campaign.id;
    r=await ic.request.post(`${BASE}/api/individual/contacts/${contactId}/notes`,{data:{body:marker}});ok(r.ok(),`note ${r.status()}`);
    r=await ic.request.post(BASE+'/api/individual/tags',{data:{name:marker,color:'#123456'}});ok(r.ok(),`tag ${r.status()}`);
    r=await ic.request.post(`${BASE}/api/individual/contacts/${contactId}/reminder`,{data:{followUpAt:new Date(Date.now()+86400000).toISOString(),followUpNote:marker}});ok(r.ok(),`reminder ${r.status()}`);
  });
  await test('individual ownership and malformed-input edges are rejected',async()=>{for(const [u,d] of [[`/api/individual/lists/${listId}/contacts`,{name:'x',email:'bad'}],['/api/individual/lists/999999999/campaigns',{subject:'x',body:'x'}]]){const r=await ic.request.post(BASE+u,{data:d});ok(r.status()>=400,`${u} got ${r.status()}`)}});
  await test('seeded individual data is visible like a user sees it',async()=>{await ip.goto(`${BASE}/dashboard/individual/lists/${listId}`);ok((await ip.locator('body').innerText()).includes(marker),'contact/list marker absent')});
  await ic.close();

  const ec=await browser.newContext({storageState:ENT_STATE}); const ep=await ec.newPage();
  await test('enterprise real-user navigation renders every screen',async()=>{for(const p of ['/dashboard/enterprise','/dashboard/enterprise/users','/dashboard/enterprise/drip-steps','/dashboard/enterprise/webhooks','/dashboard/enterprise/billing']) await status(ep,p,[200])});
  await test('enterprise API key auth and lifecycle work',async()=>{let r=await ec.request.get(BASE+'/api/v1/check-auth',{headers:{'x-api-key':KEY}});ok(r.ok(),`auth ${r.status()}`);r=await ec.request.post(BASE+'/api/v1/identify',{headers:{'x-api-key':KEY},data:{userId:marker,email,properties:{plan:'acceptance'}}});ok(r.ok(),`identify ${r.status()}`);r=await ec.request.post(BASE+'/api/v1/track',{headers:{'x-api-key':KEY},data:{userId:marker,event:marker}});ok(r.ok(),`track ${r.status()}`);r=await ec.request.get(`${BASE}/api/v1/users/${marker}`,{headers:{'x-api-key':KEY}});ok(r.ok(),`detail ${r.status()}`)});
  await test('enterprise invalid auth and payload edges are rejected',async()=>{for(const [u,o] of [['/api/v1/check-auth',{headers:{'x-api-key':'invalid'}}],['/api/v1/identify',{method:'POST',headers:{'x-api-key':KEY},data:{}}],['/api/v1/track',{method:'POST',headers:{'x-api-key':KEY},data:{userId:'missing',event:marker}}]]){const r=await ec.request.fetch(BASE+u,o);ok(r.status()>=400,`${u} got ${r.status()}`)}});
  await ec.close();
}
(async()=>{try{await run()}catch(e){failures.push(`fatal: ${e.message}`);console.error(e)}finally{try{await cleanup();console.log('✅ cleanup removed all acceptance seed data')}catch(e){failures.push(`cleanup: ${e.message}`);console.error('❌ cleanup',e)}if(browser)await browser.close();if(sql)await sql.end({timeout:2});}if(failures.length){console.error('\n'+failures.join('\n'));process.exit(1)}console.log('\n🎉 Full acceptance suite passed without altering pre-existing DB data.')})();
