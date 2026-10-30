import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createGameServer} from '../server.js';
import {createFilePersistence} from '../src/server/persistence/file-persistence.js';
import {fixture,client,api,proof} from './helpers/qa.js';
test('QA file storage keeps computer board, login, deadline, result and replay across a fresh process instance',async(t)=>{
  const file=`artifacts/qa/ai-state-${randomUUID()}.json`,f=await fixture(t,{persistence:createFilePersistence(file),computerMoveDelayMs:1},1),c=f.clients[0];
  c.send({action:'computer-start',side:'black'});const before=(await c.next(m=>m.type==='computer-state'&&m.match.history.length===1)).match;await c.close();await f.server.close();
  const server=createGameServer({host:'127.0.0.1',port:0,persistence:createFilePersistence(file)});t.after(()=>server.close());const url=await server.listen(),base=url.replace(/^ws/,'http').replace(/\/ws$/,'');const back=await client(url,f.users[0].cookie);t.after(()=>back.close());
  back.send({action:'computer-resume',matchId:before.id});const restored=(await back.next(m=>m.type==='computer-state')).match;for(const key of ['id','pieces','capturedPieces','currentSide','history','turnDeadline'])assert.deepEqual(restored[key],before[key],key);
  back.send({action:'computer-resign',matchId:before.id});await back.next(m=>m.type==='computer-state'&&m.match.status==='finished');const replay=await api(base,`/api/matches/${before.id}`,{cookie:f.users[0].cookie});assert.equal(replay.status,200);assert.equal(replay.body.mode,'computer');assert.equal(replay.body.moves.length,1);assert.equal(replay.body.result.reason,'surrender');
  proof(['DB-007','P4-049','P4-052'],'Fresh FilePersistence instance reloads Black-human AI match/login/identical board/history/deadline; resignation persists and replay has one bot opening. Test-only file in artifacts, no user data touched.', 'test/acceptance-file-ai.test.js; artifacts/qa/final-node.log');
});
