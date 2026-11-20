import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'dao-board-'));process.env.DAO_LANTERN_DATA_DIR=dir;
const {save,entries}=await import('../src/leaderboard.mjs');
test('leaderboard rejects invalid names without writing',()=>{assert.throws(()=>save({name:'bad!',score:1,nights_won:1,seed:1}));});
test('leaderboard keeps top ten ordered by score',()=>{for(let i=0;i<12;i++)save({name:`Player${i}`,score:i,nights_won:1,seed:7});const list=entries();assert.equal(list.length,10);assert.equal(list[0].score,11);assert.equal(list.at(-1).score,2);rmSync(dir,{recursive:true,force:true});});
