import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import {expectMoveHints} from '../helpers/move-hints.js';
const evidence=(ids,actual)=>appendFileSync('artifacts/qa/evidence.jsonl',JSON.stringify({ids,status:'PASS',actual,evidence:'e2e/qa/navigation.spec.js; artifacts/qa/browser-results.json',at:new Date().toISOString()})+'\n');
async function user(browser,baseURL,label){
  const context=await browser.newContext({baseURL,viewport:{width:1694,height:1000},permissions:['clipboard-read','clipboard-write']});
  const username=`nav_${label}_${randomUUID().slice(0,6)}`,data={username,displayName:`QA ${label}`,email:`${username}@example.test`,password:'QAChess123',confirmPassword:'QAChess123'};
  expect((await context.request.post('/api/auth/register',{data})).status()).toBe(201);expect((await context.request.post('/api/auth/login',{data})).status()).toBe(200);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('#connection-label')).toHaveText('Đã kết nối');
  return {context,page,data,errors};
}
async function create(page){await page.locator('#room-name').fill('Navigation QA');await page.locator('#create-room-form button').click();await expect(page.locator('#room-view')).toBeVisible();return await page.locator('#room-code').innerText()}
async function join(page,code){await page.locator('#room-code-input').fill(code);await page.locator('#join-room-form button').click();await expect(page.locator('#room-view')).toBeVisible()}
async function move(page,label,x,y,black=false){
  await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('.piece.selected')).toHaveCount(1);await expectMoveHints(page);
  const el=page.locator('#board-canvas'),box=await el.boundingBox(),size=await el.evaluate(e=>({width:e.width,height:e.height}));
  await page.mouse.click(box.x+(20+(black?8-x:x)*49)/size.width*box.width,box.y+(20+(black?9-y:y)*49)/size.height*box.height);
}
test('QA private link through login, actual clipboard, reload and closed link error',async({browser,baseURL})=>{
  const people=[];try{
    const A=await user(browser,baseURL,'linkA'),B=await user(browser,baseURL,'linkB');people.push(A,B);const a=A.page,b=B.page;
    await a.locator('#room-visibility').selectOption('private');const code=await create(a);
    expect((await(await B.context.request.get('/api/rooms/public')).json()).rooms.some(r=>r.code===code)).toBe(false);
    await a.locator('#copy-room-code').click();expect(await a.evaluate(()=>navigator.clipboard.readText())).toBe(code);
    await a.locator('#share-room').click();await expect(a.locator('#room-invite-link')).toHaveValue(`${baseURL}/?room=${code}`);await a.locator('#copy-room-link').click();expect(await a.evaluate(()=>navigator.clipboard.readText())).toContain(`room=${code}`);await a.locator('#close-room-share').click();evidence(['P1-072','P1-120','P1-121','P1-122'],'Actual Edge clipboard contains code and explicit copied room link; no native/external message sent.');
    await b.locator('#logout-button').click();await b.goto(`/?room=${code}`);await expect(b.locator('#auth-view')).toBeVisible();await b.locator('#auth-username').fill(B.data.username);await b.locator('#auth-password').fill(B.data.password);await b.locator('#auth-submit').click();await expect(b.locator('#room-view')).toBeVisible();await expect(b.locator('#room-code')).toHaveText(code);await expect(b.locator('#my-role')).toHaveText('Đối thủ');
    await b.reload();await expect(b.locator('#room-view')).toBeVisible();await expect(b.locator('#room-code')).toHaveText(code);
    await a.locator('#room-settings-toggle').click();a.once('dialog',d=>d.accept());await a.locator('#close-room-button').click();await expect(a.locator('#lobby')).toBeVisible();await b.reload();await expect(b.locator('#notice')).toContainText('Room không còn tồn tại');await expect(b.locator('#lobby')).toBeVisible();for(const u of people)expect(u.errors).toEqual([]);
    evidence(['P1-012','P1-014','P1-066','P1-069','P1-074','P1-075','P1-076','P1-123','P1-124','P1-125','P1-126'],'Private room hidden publicly; anonymous deep link returns through login to exact room; session/role survive reload; closing invalidates link with error.');
  }finally{await Promise.all(people.map(u=>u.context.close()))}
});
test('QA natural check sequence suggests only legal escapes and rejects failed escape',async({browser,baseURL})=>{
  const people=[];try{
    const A=await user(browser,baseURL,'checkA'),B=await user(browser,baseURL,'checkB');people.push(A,B);const a=A.page,b=B.page;
    const code=await create(a);await join(b,code);await a.locator('#ready-button').click();await b.locator('#ready-button').click();await a.locator('#start-button').click();await expect(a.locator('#room-view')).toHaveAttribute('data-phase','playing');
    const red=(await a.locator('#host-slot').getAttribute('data-side'))==='red'?a:b,black=red===a?b:a;await expect(black.locator('.piece').first()).toBeDisabled();
    const steps=[[red,'Pháo Đỏ, cột 2, hàng 8',4,7,false],[black,'Tốt Đen, cột 1, hàng 4',0,4,true],[red,'Tốt Đỏ, cột 5, hàng 7',4,5,false],[black,'Tốt Đen, cột 1, hàng 5',0,5,true],[red,'Tốt Đỏ, cột 5, hàng 6',4,4,false],[black,'Tốt Đen, cột 1, hàng 6',0,6,true],[red,'Tốt Đỏ, cột 5, hàng 5',3,4,false]];
    for(let i=0;i<steps.length;i++){await move(...steps[i]);await expect(a.locator('#move-history li')).toHaveCount(i+1);await expect(b.locator('#move-history li')).toHaveCount(i+1)}
    await expect(black.locator('#check-label')).toBeVisible();await move(black,'Tốt Đen, cột 1, hàng 7',0,7,true);await expect(black.locator('#notice')).toContainText('Nước đi không hợp lệ');await expect(black.locator('#move-history li')).toHaveCount(7);await expect(black.locator('#room-view')).toHaveAttribute('data-phase','playing');
    await move(black,'Pháo Đen, cột 2, hàng 3',4,2,true);await expect(black.locator('#move-history li')).toHaveCount(8);await expect(black.locator('#check-label')).toBeHidden();await black.screenshot({path:'artifacts/qa/check-escape.png',fullPage:true});for(const u of people)expect(u.errors).toEqual([]);
    evidence(['P2-018','P2-021','P2-080','P2-081','P2-082'],'Eight naturally played UI moves: cannon gives check; hints match shared legal destinations, checked unrelated pawn has none; illegal move rejected without losing/advancing turn; cannon blocks check and indicator clears. User change 2026-10-29 supersedes original no-hints requirement.');
  }finally{await Promise.all(people.map(u=>u.context.close()))}
});
