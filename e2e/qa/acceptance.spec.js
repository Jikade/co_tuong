import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {appendFileSync} from 'node:fs';
const evidence=(ids,actual)=>appendFileSync('artifacts/qa/evidence.jsonl',JSON.stringify({ids,status:'PASS',actual,evidence:'e2e/qa/acceptance.spec.js; artifacts/qa/browser-results.json',at:new Date().toISOString()})+'\n');
async function user(browser,baseURL,label,options={}) {
  const context=await browser.newContext({baseURL,viewport:{width:1694,height:1000},permissions:['camera','microphone'],...options});
  const username=`qat_${label}_${randomUUID().slice(0,6)}`;
  const data={username,displayName:`QA ${label}`,email:`${username}@example.test`,password:'QAChess123',confirmPassword:'QAChess123'};
  expect((await context.request.post('/api/auth/register',{data})).status()).toBe(201);
  const login=await context.request.post('/api/auth/login',{data});expect(login.status()).toBe(200);const account=(await login.json()).user;
  const page=await context.newPage(),messages=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>ws.on('framereceived',e=>{try{messages.push(JSON.parse(e.payload))}catch{}}));
  await page.goto('/');await expect(page.locator('#connection-label')).toHaveText('Đã kết nối');
  return {context,page,messages,errors,data,account};
}
async function create(page) {await page.locator('#room-name').fill('Nghiệm thu');await page.locator('#create-room-form button').click();await expect(page.locator('#room-view')).toBeVisible();return await page.locator('#room-code').innerText();}
async function join(page,code) {await page.locator('#room-code-input').fill(code);await page.locator('#join-room-form button').click();await expect(page.locator('#room-view')).toBeVisible();}
async function clickMove(page,piece,x,y,black=false) {
  await page.getByRole('button',{name:piece,exact:true}).click();
  await expect(page.locator('.piece.selected')).toHaveCount(1);await expect(page.locator('.legal-move')).toHaveCount(0);
  const canvas=page.locator('#board-canvas'),box=await canvas.boundingBox(),size=await canvas.evaluate(e=>({width:e.width,height:e.height}));
  await page.mouse.click(box.x+(20+(black?8-x:x)*49)/size.width*box.width,box.y+(20+(black?9-y:y)*49)/size.height*box.height);
}
test('QA browser registration validates each field locally and requires an unfriend confirmation',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL});const page=await context.newPage();
  try{
    await page.goto('/');await page.locator('[data-mode=register]').click();
    for (const field of ['username','displayName','email','password','confirmPassword']) expect(await page.locator(`#auth-${field}`).evaluate(e=>e.checkValidity())).toBe(false);
    await page.locator('#auth-email').fill('invalid-email');expect(await page.locator('#auth-email').evaluate(e=>e.checkValidity())).toBe(false);
    const username=`qa_form_${randomUUID().slice(0,6)}`;
    await page.locator('#auth-username').fill(username);await page.locator('#auth-displayName').fill('QA Form');await page.locator('#auth-email').fill(`${username}@example.test`);
    for(const value of ['short1','abcdefgh','12345678']){
      await page.locator('#auth-password').fill(value);await page.locator('#auth-confirmPassword').fill(value);
      expect(await page.locator('#auth-password').evaluate(e=>e.checkValidity())).toBe(false);
    }
    await page.locator('#auth-password').fill('QAChess123');await page.locator('#auth-confirmPassword').fill('Mismatch123');
    expect(await page.locator('#auth-confirmPassword').evaluate(e=>e.checkValidity())).toBe(false);
    await page.locator('#auth-confirmPassword').fill('QAChess123');await page.locator('#auth-submit').click();await expect(page.locator('#auth-message')).toContainText('Đăng ký thành công');
    await page.locator('#auth-password').fill('QAChess123');await page.locator('#auth-submit').click();await expect(page.locator('#lobby')).toBeVisible();
    evidence(['P1-001','P1-005','P1-006','P1-007','P1-009','P1-010','ENV-006'],'UI field validity and registration -> login verified in Edge; invalid passwords/confirm blocked before submit.');
  }finally{await context.close();}
});

test('QA four independent browsers: friends, invite, three moves/capture, spectator/outsider isolation, offline reconnect, rematch, replay and logout',async({browser,baseURL})=>{
  const people=[];
  try{
    for(const name of ['A','B','C','D'])people.push(await user(browser,baseURL,name,name==='C'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{}));
    const [A,B,C,D]=people,a=A.page,b=B.page,c=C.page,d=D.page;
    expect(new Set((await Promise.all(people.map(async u=>(await u.context.cookies()).find(c=>c.name==='cotuong_session')?.value)))).size).toBe(4);
    await a.locator('#account-toggle').click();await a.locator('#friend-query').fill(B.data.username);await a.locator('#friend-search-form button').click();
    await a.locator('#friend-search-results button').click();
    await b.locator('#account-toggle').click();await expect(b.locator('#friend-requests')).toContainText('QA A');await b.locator('#friend-requests button').filter({hasText:'Chấp nhận'}).click();
    await expect(b.locator('#friend-list')).toContainText('QA A');await a.locator('#account-close').click();await b.locator('#account-close').click();
    const code=await create(a);
    await a.locator('#account-toggle').click();await expect(a.locator('#friend-list')).toContainText('Online');await a.locator('#friend-filter').fill('no-match-here');await expect(a.locator('#friend-list .account-row:visible')).toHaveCount(0);await a.locator('#friend-filter').fill(B.data.username);await expect(a.locator('#friend-list .account-row:visible')).toHaveCount(1);await a.locator('#friend-filter').fill('');await a.locator('#friend-list button').filter({hasText:'Mời vào phòng'}).click();
    await expect(a.locator('#room-invites')).toContainText('s');
    await b.locator('#account-toggle').click();await expect(b.locator('#room-invites')).toContainText(code);await expect(b.locator('#room-invites')).toContainText('QA A');await expect(b.locator('#room-invites')).toContainText('Nghiệm thu');await b.locator('#room-invites button').filter({hasText:'Vào phòng'}).click();
    await a.locator('#account-close').click();await expect(b.locator('#room-view')).toBeVisible();
    await a.locator('#ready-button').click();await b.locator('#ready-button').click();await expect(a.locator('#start-button')).toBeEnabled();await a.locator('#start-button').click();
    await expect(a.locator('#room-view')).toHaveAttribute('data-phase','countdown');await expect(a.locator('.piece').first()).toBeDisabled();
    await expect(a.locator('#room-view')).toHaveAttribute('data-phase','playing');await expect(b.locator('#room-view')).toHaveAttribute('data-phase','playing');
    const red=(await a.locator('#host-slot').getAttribute('data-side'))==='red'?a:b,black=red===a?b:a;
    await clickMove(red,'Tốt Đỏ, cột 1, hàng 7',0,5);await expect(black.locator('#move-history li')).toHaveCount(1);
    await clickMove(black,'Tốt Đen, cột 1, hàng 4',0,4,true);await expect(red.locator('#move-history li')).toHaveCount(2);
    await clickMove(red,'Tốt Đỏ, cột 1, hàng 6',0,4);await expect(a.locator('#move-history li')).toHaveCount(3);await expect(b.locator('#pieces .piece')).toHaveCount(31);
    await join(c,code);await expect(c.locator('#move-history li')).toHaveCount(3);await expect(c.locator('#pieces .piece')).toHaveCount(31);await expect(c.locator('#ready-button')).toBeHidden();
    await a.locator('#chat-toggle').click();await b.locator('#chat-toggle').click();const secret=`private_${randomUUID()}`;
    await a.locator('#chat-input').fill(secret);await a.locator('#chat-send').click();await expect(b.locator('#chat-messages')).toContainText(secret);
    expect(JSON.stringify(C.messages)).not.toContain(secret);expect(JSON.stringify(D.messages)).not.toContain(secret);
    await expect(c.locator('#chat-input')).toBeHidden();
    // Unfriend must ask, cancellation preserves both lists, accepting preserves running match/history.
    await a.locator('#account-toggle').click();a.once('dialog',d=>d.dismiss());await a.locator('#friend-list button').filter({hasText:'Hủy kết bạn'}).click();await expect(a.locator('#friend-list')).toContainText('QA B');
    a.once('dialog',d=>d.accept());await a.locator('#friend-list button').filter({hasText:'Hủy kết bạn'}).click();await expect(a.locator('#friend-list')).not.toContainText('QA B');await a.locator('#account-close').click();await expect(a.locator('#room-view')).toHaveAttribute('data-phase','playing');
    await B.context.setOffline(true);await expect(a.locator('#room-view')).toHaveAttribute('data-phase','paused');await expect(a.locator('#reconnect-label')).toContainText('mất kết nối');
    await B.context.setOffline(false);await expect(b.locator('#room-view')).toHaveAttribute('data-phase','playing',{timeout:15000});await expect(b.locator('#move-history li')).toHaveCount(3);
    await a.screenshot({path:'artifacts/qa/desktop-playing.png',fullPage:true});await c.screenshot({path:'artifacts/qa/mobile-spectator.png',fullPage:true});
    await b.locator('#room-settings-toggle').click();b.once('dialog',d=>d.accept());await b.locator('#resign-button').click();await expect(a.locator('#room-view')).toHaveAttribute('data-phase','finished');
    const old=A.messages.filter(m=>m.type==='room-state'&&m.room.match).at(-1).room.match.id;
    await a.locator('#ready-button').click();await b.locator('#ready-button').click();await a.locator('#start-button').click();await expect(a.locator('#room-view')).toHaveAttribute('data-phase','playing');
    expect(A.messages.filter(m=>m.type==='room-state'&&m.room.match).at(-1).room.match.id).not.toBe(old);await expect(a.locator('#move-history li')).toHaveCount(0);await expect(c.locator('#my-role')).toHaveText('Khán giả');
    // Leave confirmation cancel, then confirm => immediate result; no reconnect window.
    a.once('dialog',d=>d.dismiss());await a.locator('#leave-button').click();await expect(a.locator('#room-view')).toHaveAttribute('data-phase','playing');
    a.once('dialog',d=>d.accept());await a.locator('#leave-button').click();await expect(a.locator('#lobby')).toBeVisible();await expect(b.locator('#room-view')).toHaveAttribute('data-phase','finished');
    await b.locator('#history-button').click();await expect(b.locator('#history-list li')).toHaveCount(2);await b.locator('#history-list button').last().click();
    await expect(b.locator('#replay-bar')).toBeVisible();await b.locator('#replay-last').click();await expect(b.locator('#pieces .piece')).toHaveCount(31);await b.locator('#replay-prev').click();await expect(b.locator('#pieces .piece')).toHaveCount(32);await b.locator('#replay-first').click();await b.locator('#replay-next').click();await expect(b.locator('.piece').first()).toBeDisabled();
    await b.goto('/?qa=logout-check');await expect(b.locator('#account-toggle')).toBeVisible();
    await b.locator('#logout-button').click();await expect(b.locator('#auth-view')).toBeVisible();await b.goBack();await expect(b.locator('#auth-view')).toBeVisible();await b.reload();await expect(b.locator('#auth-view')).toBeVisible();
    for(const u of people)expect(u.errors).toEqual([]);
    expect(await c.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    evidence(['ENV-005','P1-035','P1-036','P1-037','P1-038','P1-040','P1-046','P1-047','P1-048','P1-049','P1-050','P1-060','P1-061','P1-062','P1-064','P1-065','P1-078','P1-079','P1-086','P1-093','P1-094','P1-099','P1-103','P1-158','P1-159','P1-163','P1-182','P1-183','P1-184','P2-014','P2-016','P2-017','P2-019','P2-020','P2-024','P2-025','P2-028','P3-007','P3-008','P3-009','P3-012','P3-015','P3-016','P3-017','P3-018','P3-025','P3-038','P3-039','P3-040','P3-041','P3-042','P4-001','P4-002','P4-005','P4-006','P4-007'],'4 isolated contexts/cookies, real UI social/invite -> 3 moves/capture -> mobile spectator -> offline/reconnect -> resign/rematch -> confirmed leave -> 2 historical matches/replay -> logout/back; no pageerrors.');
  }finally{await Promise.all(people.map(u=>u.context.close()));}
});

test('QA media permission failure keeps game alive; audio-only fallback connects and can call again',async({browser,baseURL})=>{
  test.setTimeout(105000);
  const people=[];try{
    const A=await user(browser,baseURL,'mediaA'),B=await user(browser,baseURL,'mediaB');people.push(A,B);const a=A.page,b=B.page;
    const code=await create(a);await join(b,code);
    await a.locator('#video-toggle').click();await a.locator('#call-start').click();await expect(b.locator('#incoming-call')).toBeVisible();
    await expect(a.locator('#notice')).toContainText('Không có phản hồi trong 60 giây',{timeout:65000});await expect(b.locator('#incoming-call')).toBeHidden();
    evidence(['P4-019'],'Edge UI unanswered call expires after real production 60 seconds, incoming prompt closes and caller is notified.');
    await a.locator('#ready-button').click();await b.locator('#ready-button').click();await a.locator('#start-button').click();await expect(a.locator('#room-view')).toHaveAttribute('data-phase','playing');
    await b.evaluate(()=>{window.__getMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied by QA device simulation','NotAllowedError')}});
    await a.locator('#call-start').click();await b.locator('#incoming-call-accept').click();await expect(b.locator('#notice')).toContainText('từ chối quyền');await expect(a.locator('#room-view')).toHaveAttribute('data-phase','playing');
    await b.evaluate(()=>{navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.video)throw new DOMException('No QA camera','NotFoundError');return window.__getMedia(constraints)}});
    await a.locator('#call-start').click();await b.locator('#incoming-call-accept').click();await expect(a.locator('#call-status')).toHaveText('Đã kết nối',{timeout:15000});await expect(b.locator('#call-status')).toHaveText('Đã kết nối');
    expect(await b.locator('#local-video').evaluate(e=>e.srcObject.getVideoTracks().length)).toBe(0);
    await b.locator('#toggle-audio').click();await expect(b.locator('#toggle-audio')).toHaveText('Bật micro');await b.locator('#toggle-audio').click();
    await a.locator('#toggle-video').click();await expect(a.locator('#toggle-video')).toHaveText('Bật camera');
    await a.screenshot({path:'artifacts/qa/audio-fallback.png',fullPage:true});await a.locator('#call-end').click();await expect(b.locator('#call-status')).toHaveText('Đang chờ cuộc gọi');
    await a.locator('#call-start').click();await expect(b.locator('#incoming-call')).toBeVisible();await b.locator('#incoming-call-reject').click();await expect(a.locator('#room-view')).toHaveAttribute('data-phase','playing');
    evidence(['P4-014','P4-016','P4-018','P4-020','P4-021','P4-023','P4-024','P4-025','P4-026','P4-027','P4-028','P4-029','P4-030','P4-031','P4-032','P4-034'],'Edge fake media: denied permission rejected with game still playing; missing camera retried audio only, peer connected; mic/camera toggle, hangup and recall/reject. Physical devices not tested.');
  }finally{await Promise.all(people.map(u=>u.context.close()));}
});
