import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLegalMove, getLegalDestinations, getTurnStatus, isInCheck, toDisplayCoordinate, toLogicCoordinate } from '../src/shared/game/xiangqi.js';
import { proof, range } from './helpers/qa.js';

const p = (id,type,color,x,y) => ({id,type,color,x,y});
const kings = () => [p('rk','king','red',4,9),p('bk','king','black',3,0)];
const scenarios = [
  ['rook', [0,6], [0,2], true], ['rook',[0,6],[5,6],true], ['rook',[0,6],[1,5],false],
  ['rook',[0,6],[0,2],false,[p('block','pawn','red',0,4)]],
  ['horse',[1,7],[2,5],true],['horse',[1,7],[3,6],true],['horse',[1,7],[2,6],false],
  ['horse',[1,7],[2,5],false,[p('leg','pawn','black',1,6)]],
  ['elephant',[2,9],[0,7],true],['elephant',[2,9],[0,7],false,[p('eye','pawn','black',1,8)]],
  ['elephant',[2,5],[4,3],false],['elephant',[2,9],[1,8],false],
  ['advisor',[3,9],[4,8],true],['advisor',[3,9],[2,8],false],['advisor',[3,9],[3,8],false],
  ['king',[4,9],[5,9],true],['king',[4,9],[4,8],true],['king',[3,8],[2,8],false],['king',[4,9],[5,8],false],
  ['king',[4,9],[4,8],false,[p('attacker','rook','black',0,8)]],
  ['cannon',[0,6],[0,2],true],['cannon',[0,6],[5,6],true],['cannon',[0,6],[1,5],false],
  ['cannon',[0,6],[0,2],false,[p('block','pawn','red',0,4)]],
  ['pawn',[0,6],[0,5],true],['pawn',[0,6],[1,6],false],['pawn',[0,6],[0,7],false],
  ['pawn',[0,4],[1,4],true],['pawn',[1,4],[0,4],true],['pawn',[0,4],[0,5],false],['pawn',[0,4],[0,2],false],
];
for(const color of ['red','black']) {
  const flip = (piece) => color==='red' ? {...piece} : {...piece,color:piece.color==='red'?'black':'red',x:8-piece.x,y:9-piece.y};
  for(const [type,from,to,valid,extras=[]] of scenarios) {
    test(`QA rules ${color} ${type} ${from}->${to} ${valid?'legal':'reject'} ${extras.map(x=>x.id)}`,()=>{
      let board=kings(); if(type==='king')board=board.filter(x=>x.id!=='rk');
      board.push(p('moving',type,'red',...from),...extras);
      board=board.map(flip);const target=color==='red'?{x:to[0],y:to[1]}:{x:8-to[0],y:9-to[1]};
      const before=structuredClone(board);assert.equal(Boolean(applyLegalMove(board,'moving',target)),valid);
      assert.equal(getLegalDestinations(board,'moving').some(to=>to.x===target.x&&to.y===target.y),valid,'hint destinations obey the same rule for both colors');
      assert.deepEqual(board,before);
    });
  }
  for(const [type,from,to] of [['rook',[0,6],[0,2]],['horse',[1,7],[2,5]],['elephant',[2,9],[0,7]],['advisor',[3,9],[4,8]],['king',[4,9],[5,9]],['cannon',[0,6],[0,2]],['pawn',[0,6],[0,5]]]) {
    test(`QA rules ${color} ${type} capture, friendly target and self-check`,()=>{
      let base=kings();if(type==='king')base=base.filter(x=>x.id!=='rk');
      base.push(p('moving',type,'red',...from)); if(type==='cannon')base.push(p('screen','pawn','red',0,4));
      const target=p('target','pawn','black',...to);const destination=color==='red'?{x:to[0],y:to[1]}:{x:8-to[0],y:9-to[1]};
      const captured=applyLegalMove([...base,target].map(flip),'moving',destination);
      assert.equal(captured?.capturedPiece.id,'target');assert.ok(!captured.pieces.some(x=>x.id==='target'));
      const suggested=board=>getLegalDestinations(board.map(flip),'moving').some(to=>to.x===destination.x&&to.y===destination.y);
      assert.equal(suggested([...base,target]),true,'capture is suggested');
      assert.equal(suggested([...base,{...target,color:'red'}]),false,'friendly capture is not suggested');
      assert.equal(applyLegalMove([...base,{...target,color:'red'}].map(flip),'moving',destination),null);
      const checked=[...base,target,p('checking','rook','black',5,9)].filter(x=>x.id!=='bk');
      checked.push(p('bk','king','black',3,0));
      // For the king, place the attacking rook on its destination file.
      if(type==='king') { checked.find(x=>x.id==='checking').x=to[0]; checked.find(x=>x.id==='checking').y=0; }
      assert.equal(applyLegalMove(checked.map(flip),'moving',destination),null);
      assert.equal(suggested(checked),false,'self-check is not suggested');
    });
  }
}
test('QA rules cannon screens, flying generals, mandatory escape and stalemate/checkmate',()=>{
  const board=[...kings(),p('c','cannon','red',0,6),p('target','pawn','black',0,1)];
  assert.equal(applyLegalMove(board,'c',{x:0,y:1}),null);
  const hintsTarget=pieces=>getLegalDestinations(pieces,'c').some(to=>to.x===0&&to.y===1);
  assert.equal(hintsTarget(board),false);
  for(const color of ['red','black']) assert.equal(applyLegalMove([...board,p('screen','pawn',color,0,4)],'c',{x:0,y:1}).capturedPiece.id,'target');
  for(const color of ['red','black']) assert.equal(hintsTarget([...board,p('screen','pawn',color,0,4)]),true);
  assert.equal(applyLegalMove([...board,p('s1','pawn','red',0,4),p('s2','pawn','black',0,3)],'c',{x:0,y:1}),null);
  assert.equal(hintsTarget([...board,p('s1','pawn','red',0,4),p('s2','pawn','black',0,3)]),false);
  const facing=[p('rk','king','red',4,9),p('bk','king','black',4,0),p('screen','rook','red',4,5)];
  assert.equal(applyLegalMove(facing,'screen',{x:3,y:5}),null);
  assert.equal(getLegalDestinations(facing,'screen').some(to=>to.x===3&&to.y===5),false);
  const checked=[...kings(),p('attacker','rook','black',4,5),p('pawn','pawn','red',0,6)];
  assert.equal(isInCheck(checked,'red'),true); assert.equal(applyLegalMove(checked,'pawn',{x:0,y:5}),null);
  assert.deepEqual(getLegalDestinations(checked,'pawn'),[]);
  assert.ok(getLegalDestinations(checked,'rk').some(to=>to.x===5&&to.y===9));
  assert.ok(applyLegalMove(checked,'rk',{x:5,y:9}));assert.equal(getTurnStatus(checked,'red').hasLegalMove,true);
  const mate=[...kings(),p('r1','rook','black',4,8),p('r2','rook','black',3,8),p('r3','rook','black',5,8)];
  assert.deepEqual(getTurnStatus(mate,'red'),{inCheck:true,hasLegalMove:false,winner:'black',reason:'checkmate'});
  const stalemate=[p('rk','king','red',4,9),p('bk','king','black',3,0),p('r1','rook','black',3,7),p('r2','rook','black',5,7),p('r3','rook','black',0,8)];
  assert.deepEqual(getTurnStatus(stalemate,'red'),{inCheck:false,hasLegalMove:false,winner:'black',reason:'no-legal-moves'});
  for(const xy of [{x:0,y:5},{x:0,y:4},{x:8,y:3}]) assert.deepEqual(toLogicCoordinate(toDisplayCoordinate(xy,true),true),xy);
});
// This suite is recorded only after every generated assertion has succeeded by the QA runner.
