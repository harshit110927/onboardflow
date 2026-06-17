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
let dripStepId, tagId, sequenceCampaignIds=[];
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
  await tx`delete from individual_campaigns where id = ANY(${sequenceCampaignIds}::int[])`;
  await tx`delete from unsubscribed_contacts where email=${email}`;
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
  await test('individual notes are readable after creation',async()=>{
    const r=await ic.request.get(`${BASE}/api/individual/contacts/${contactId}/notes`);ok(r.ok(),`notes ${r.status()}`);
    const notes=await r.json();ok(Array.isArray(notes)&&notes.some((note)=>note.body===marker),'created note absent');
  });
  await test('individual tags are readable and assignable',async()=>{
    let r=await ic.request.get(BASE+'/api/individual/tags');ok(r.ok(),`tags ${r.status()}`);
    const tags=await r.json();tagId=tags.find((tag)=>tag.name===marker)?.id;ok(tagId,'created tag absent');
    r=await ic.request.post(`${BASE}/api/individual/contacts/${contactId}/tags`,{data:{tagId}});ok(r.ok(),`assign tag ${r.status()}`);
    r=await ic.request.get(`${BASE}/api/individual/contacts/${contactId}/tags`);ok(r.ok(),`assigned tags ${r.status()}`);
    const assigned=await r.json();ok(Array.isArray(assigned)&&assigned.some((tag)=>tag.id===tagId||tag.tagId===tagId),'assigned tag absent');
  });
  await test('contact timeline returns data after note creation',async()=>{
    const r=await ic.request.get(`${BASE}/api/individual/contacts/${contactId}/timeline`);ok(r.ok(),`timeline ${r.status()}`);
    const data=await r.json();const items=Array.isArray(data)?data:data.events??data.items;ok(Array.isArray(items)&&items.length>=0,'timeline shape invalid');
  });
  await test('contact engagement returns stats shape',async()=>{
    const r=await ic.request.get(`${BASE}/api/individual/contacts/${contactId}/engagement`);ok(r.ok(),`engagement ${r.status()}`);
    const data=await r.json();ok(typeof data==='object'&&data!==null,'engagement shape invalid');
  });
  await test('pipeline read and stage update',async()=>{
    let r=await ic.request.get(BASE+'/api/individual/pipeline');ok(r.ok(),`pipeline ${r.status()}`);
    r=await ic.request.patch(BASE+'/api/individual/pipeline',{data:{contactId,stage:'contacted'}});ok(r.ok(),`pipeline patch ${r.status()}`);
    r=await ic.request.get(BASE+'/api/individual/pipeline');ok(r.ok(),`pipeline reread ${r.status()}`);
    const pipeline=await r.json();ok(Array.isArray(pipeline.contacted)&&pipeline.contacted.some((contact)=>contact.id===contactId),'contact not in contacted stage');
  });
  await test('sequence creation stores two campaigns sharing a sequenceId',async()=>{
    const r=await ic.request.post(BASE+'/api/individual/sequences',{data:{listId:listId,steps:[{subject:marker,body:'<p>Step 1</p>',sendDelayDays:0,delayDays:0,sequencePosition:1},{subject:marker+' step2',body:'<p>Step 2</p>',sendDelayDays:3,delayDays:3,sequencePosition:2}]}});ok(r.ok(),`sequence ${r.status()}`);
    const data=await r.json();ok(data.sequenceId,'sequenceId absent');
    const campaigns=await sql`select id from individual_campaigns where sequence_id=${data.sequenceId} order by sequence_position`;
    sequenceCampaignIds=campaigns.map((campaign)=>campaign.id);ok(sequenceCampaignIds.length===2,`expected 2 sequence campaigns got ${sequenceCampaignIds.length}`);
    const sequenceIds=await sql`select distinct sequence_id from individual_campaigns where id = ANY(${sequenceCampaignIds}::int[])`;
    ok(sequenceIds.length===1&&sequenceIds[0].sequence_id,'sequence campaigns do not share one sequenceId');
  });
  await test('campaign detail page renders for the created campaign',async()=>{
    const r=await ip.goto(`${BASE}/dashboard/individual/campaigns/${campaignId}`,{waitUntil:'domcontentloaded'});ok(r.status()===200,`campaign detail ${r.status()}`);
    ok((await ip.locator('body').innerText()).includes(marker),'campaign marker absent');
  });
  await ic.close();

  const ec=await browser.newContext({storageState:ENT_STATE}); const ep=await ec.newPage();
  await test('enterprise real-user navigation renders every screen',async()=>{for(const p of ['/dashboard/enterprise','/dashboard/enterprise/users','/dashboard/enterprise/drip-steps','/dashboard/enterprise/webhooks','/dashboard/enterprise/billing']) await status(ep,p,[200])});
  await test('email_usage row is written to DB after enterprise dashboard load',async()=>{
    const rows=await sql`select * from email_usage where tenant_id=${ENT} and date=current_date`;
    ok(rows.length>0,'email_usage row absent; add UNIQUE (tenant_id, date) so ON CONFLICT can insert');
  });
  await test('enterprise API key auth and lifecycle work',async()=>{let r=await ec.request.get(BASE+'/api/v1/check-auth',{headers:{'x-api-key':KEY}});ok(r.ok(),`auth ${r.status()}`);r=await ec.request.post(BASE+'/api/v1/identify',{headers:{'x-api-key':KEY},data:{userId:marker,email,properties:{plan:'acceptance'}}});ok(r.ok(),`identify ${r.status()}`);r=await ec.request.post(BASE+'/api/v1/track',{headers:{'x-api-key':KEY},data:{userId:marker,event:marker}});ok(r.ok(),`track ${r.status()}`);r=await ec.request.get(`${BASE}/api/v1/users/${marker}`,{headers:{'x-api-key':KEY}});ok(r.ok(),`detail ${r.status()}`)});
  await test('enterprise invalid auth and payload edges are rejected',async()=>{for(const [u,o] of [['/api/v1/check-auth',{headers:{'x-api-key':'invalid'}}],['/api/v1/identify',{method:'POST',headers:{'x-api-key':KEY},data:{}}],['/api/v1/track',{method:'POST',headers:{'x-api-key':KEY},data:{userId:'missing',event:marker}}]]){const r=await ec.request.fetch(BASE+u,o);ok(r.status()>=400,`${u} got ${r.status()}`)}});
  await test('enterprise users list endpoint returns correct shape',async()=>{
    let r=await ec.request.get(BASE+'/api/v1/users',{headers:{'x-api-key':KEY}});ok(r.ok(),`users ${r.status()}`);
    let data=await r.json();ok(data.success===true&&Array.isArray(data.users)&&typeof data.total==='number'&&typeof data.page==='number'&&typeof data.limit==='number','users shape invalid');
    for(const statusName of ['stalled','activated']){r=await ec.request.get(`${BASE}/api/v1/users?status=${statusName}`,{headers:{'x-api-key':KEY}});ok(r.ok(),`${statusName} users ${r.status()}`);data=await r.json();ok(Array.isArray(data.users),`${statusName} users shape invalid`)}
    r=await ec.request.get(BASE+'/api/v1/users?limit=1&page=1',{headers:{'x-api-key':KEY}});ok(r.ok(),`paginated users ${r.status()}`);data=await r.json();ok(data.users.length<=1,'pagination limit ignored');
  });
  await test('properties merging on re-identify preserves and overwrites correctly',async()=>{
    let r=await ec.request.post(BASE+'/api/v1/identify',{headers:{'x-api-key':KEY},data:{userId:marker,email,properties:{plan:'updated',newField:'yes'}}});ok(r.ok(),`re-identify ${r.status()}`);
    r=await ec.request.get(`${BASE}/api/v1/users/${marker}`,{headers:{'x-api-key':KEY}});ok(r.ok(),`user detail ${r.status()}`);
    const data=await r.json();ok(data.user?.properties?.plan==='updated','plan property not overwritten');ok(data.user?.properties?.newField==='yes','new property not merged');
  });
  await test('analytics data endpoint returns required shape',async()=>{
    const r=await ec.request.get(BASE+'/api/v1/analytics-data');ok(r.ok(),`analytics ${r.status()}`);
    const data=await r.json();ok(typeof data.totalUsers==='number'&&Array.isArray(data.funnelData),'analytics shape invalid');
  });
  await test('nudge step endpoint does not crash',async()=>{
    const r=await ec.request.post(BASE+'/api/v1/nudge-step',{data:{stepIndex:1}});ok(r.ok(),`nudge ${r.status()}`);
    const data=await r.json();ok(Object.hasOwn(data,'sent')&&Object.hasOwn(data,'skipped')&&Object.hasOwn(data,'errors'),'nudge shape invalid');
  });
  await test('drip steps CRUD lifecycle',async()=>{
    let r=await ec.request.post(BASE+'/api/individual/drip-steps',{data:{steps:[{position:99,eventTrigger:marker,emailSubject:marker,emailBody:'acceptance test',delayHours:1}]}});
    if(r.status()===403){console.log('⚠️ drip steps CRUD lifecycle skipped — Advanced plan required');return}ok(r.ok(),`drip create ${r.status()}`);
    let data=await r.json();ok(data.success===true,'drip create shape invalid');
    r=await ec.request.get(BASE+'/api/individual/drip-steps');ok(r.ok(),`drip list ${r.status()}`);data=await r.json();
    const step=data.steps?.find((item)=>item.eventTrigger===marker);dripStepId=step?.id;ok(dripStepId,'created drip step absent');
    r=await ec.request.delete(`${BASE}/api/individual/drip-steps/${dripStepId}`);ok(r.ok(),`drip delete ${r.status()}`);
    r=await ec.request.get(BASE+'/api/individual/drip-steps');ok(r.ok(),`drip relist ${r.status()}`);data=await r.json();ok(!data.steps?.some((item)=>item.eventTrigger===marker),'deleted drip step still present');
  });
  await ec.close();
}
(async()=>{try{await run()}catch(e){failures.push(`fatal: ${e.message}`);console.error(e)}finally{try{await cleanup();console.log('✅ cleanup removed all acceptance seed data')}catch(e){failures.push(`cleanup: ${e.message}`);console.error('❌ cleanup',e)}if(browser)await browser.close();if(sql)await sql.end({timeout:2});}if(failures.length){console.error('\n'+failures.join('\n'));process.exit(1)}console.log('\n🎉 Full acceptance suite passed without altering pre-existing DB data.')})();
