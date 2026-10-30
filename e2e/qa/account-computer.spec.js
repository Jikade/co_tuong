import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { getLegalMoves } from '../../src/shared/game/xiangqi.js';
import {expectMoveHints} from '../helpers/move-hints.js';
const proof=(ids,actual)=>appendFileSync('artifacts/qa/evidence.jsonl',JSON.stringify({ids,status:'PASS',actual,evidence:'e2e/qa/account-computer.spec.js; artifacts/qa/account-computer.log',at:new Date().toISOString()})+'\n');
async function user(browser,baseURL,label,options={}){
  const context=await browser.newContext({baseURL,...options}),username=`qa_${label}_${randomUUID().slice(0,6)}`;
  const data={username,displayName:label,email:`${username}@example.test`,password:'QAChess123',confirmPassword:'QAChess123'};
  expect((await context.request.post('/api/auth/register',{data})).status()).toBe(201);expect((await context.request.post('/api/auth/login',{data})).status()).toBe(200);
  const page=await context.newPage(),messages=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>ws.on('framereceived',e=>{try{messages.push(JSON.parse(e.payload))}catch{}}));await page.goto('/');await expect(page.locator('#connection-label')).toHaveText('Đã kết nối');return{context,page,data,messages,errors};
}
test('QA reset UI validates actual outbox token, forged/reused links and old password rejection',async({browser,baseURL})=>{
  const U=await user(browser,baseURL,'reset'),page=U.page;try{
    await page.locator('#logout-button').click();await page.locator('[data-mode=forgot]').click();await expect(page.locator('#auth-email')).toBeVisible();
    await page.locator('#auth-email').fill(U.data.email);await page.locator('#auth-submit').click();await expect(page.locator('#auth-message')).toContainText('Nếu email');const message=await page.locator('#auth-message').innerText();
    await page.locator('#auth-email').fill('unknown-qa@example.test');await page.locator('#auth-submit').click();await expect(page.locator('#auth-message')).toHaveText(message);
    const delivery=readdirSync('artifacts/qa/browser-outbox').map(n=>JSON.parse(readFileSync(`artifacts/qa/browser-outbox/${n}`,'utf8'))).find(d=>d.email===U.data.email);expect(delivery).toBeTruthy();
    await page.goto('/?reset=forged-token');await expect(page.locator('#auth-message')).toContainText('không còn hiệu lực');await expect(page.locator('#auth-submit')).toHaveText('Đăng nhập');
    await page.goto(`/?reset=${encodeURIComponent(delivery.token)}`);await expect(page.locator('#auth-submit')).toHaveText('Đặt lại mật khẩu');await expect(page.locator('#auth-confirmPassword')).toBeVisible();await page.locator('#auth-password').fill('ResetQA123');await page.locator('#auth-confirmPassword').fill('ResetQA123');await page.locator('#auth-submit').click();await expect(page.locator('#auth-message')).toContainText('Đặt lại mật khẩu thành công');
    expect((await U.context.request.post('/api/auth/login',{data:U.data})).status()).toBe(401);await page.locator('#auth-username').fill(U.data.username);await page.locator('#auth-password').fill('ResetQA123');await page.locator('#auth-submit').click();await expect(page.locator('#lobby')).toBeVisible();await page.goto(`/?reset=${encodeURIComponent(delivery.token)}`);await expect(page.locator('#auth-message')).toContainText('không còn hiệu lực');expect(U.errors).toEqual([]);
    proof(['P1-003','P1-015','P1-016','P1-017','P1-019','P1-020','P1-023','P1-024','P1-031','P1-032'],'Actual local outbox -> valid reset form; forged/reused links rejected; generic known/unknown reply; old password 401, new login succeeds. SMTP delivery is not established.');
  }finally{await U.context.close()}
});
test('QA mobile plays both AI colors through reload, surrender, separate histories and replay',async({browser,baseURL})=>{
  const U=await user(browser,baseURL,'computer',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=U.page;
  const names={rook:'Xe',horse:'Mã',elephant:'Tượng',advisor:'Sĩ',king:'Tướng',cannon:'Pháo',pawn:'Tốt'};
  try{
    for(const side of ['red','black']){
      await page.locator('#computer-play-button').click();await page.locator(`[data-computer-side="${side}"]`).click();await expect(page.locator('#room-view')).toHaveAttribute('data-phase','playing');if(side==='black')await expect(page.locator('#move-history li')).toHaveCount(1);
      const initial=U.messages.filter(m=>m.type==='computer-state'&&m.match.currentSide===side).at(-1).match,legal=getLegalMoves(initial.pieces,side)[0],piece=initial.pieces.find(p=>p.id===legal.pieceId);expect(initial.humanSide).toBe(side);
      await page.getByRole('button',{name:`${names[piece.type]} ${side==='red'?'Đỏ':'Đen'}, cột ${piece.x+1}, hàng ${piece.y+1}`,exact:true}).click();await expectMoveHints(page);
      const canvas=page.locator('#board-canvas'),box=await canvas.boundingBox(),size=await canvas.evaluate(e=>({width:e.width,height:e.height})),x=side==='black'?8-legal.to.x:legal.to.x,y=side==='black'?9-legal.to.y:legal.to.y;
      await page.mouse.click(box.x+(20+x*49)/size.width*box.width,box.y+(20+y*49)/size.height*box.height);await expect(page.locator('#move-history li')).toHaveCount(initial.history.length+2);
      const before=U.messages.filter(m=>m.type==='computer-state').at(-1).match;await page.reload();await expect(page.locator('#room-view')).toHaveAttribute('data-phase','playing');await expect(page.locator('#move-history li')).toHaveCount(before.history.length);expect(U.messages.filter(m=>m.type==='computer-state').at(-1).match.id).toBe(before.id);
      await page.locator('#room-settings-toggle').click();page.once('dialog',d=>d.accept());await page.locator('#resign-button').click();await expect(page.locator('#room-view')).toHaveAttribute('data-phase','finished');await page.locator('#history-button').click();await expect(page.locator('#history-list li')).toHaveCount(side==='red'?1:2);await page.locator('#history-list button').first().click();await expect(page.locator('#replay-bar')).toBeVisible();await page.locator('#replay-last').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`artifacts/qa/mobile-computer-${side}.png`,fullPage:true});
      await page.locator('#replay-exit').click();await page.locator('#computer-exit-button').click();await expect(page.locator('#lobby')).toBeVisible();
    }
    expect(U.errors).toEqual([]);proof(['P4-037','P4-038','P4-039','P4-049','P4-052'],'Actual mobile UI: both human colors, automatic AI opening/reply, reload retains ID/history, confirmed surrender, two saved matches and replay.');
  }finally{await U.context.close()}
});
