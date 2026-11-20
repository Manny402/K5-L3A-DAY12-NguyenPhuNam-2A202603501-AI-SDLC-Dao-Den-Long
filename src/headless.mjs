import {readFileSync, writeFileSync} from 'node:fs';
import {Game} from './core.mjs';

function arg(name, fallback) { const i=process.argv.indexOf(name); return i<0 ? fallback : process.argv[i+1]; }
function readJson(path) {try {return JSON.parse(readFileSync(path,'utf8'));} catch(e) {throw new Error(`Invalid JSON file ${path}: ${e.message}`);} }
function validate(data, kind) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${kind} must be an object`);
  if(kind==='inputs') {
    if(!Array.isArray(data.frames)) throw new Error('inputs.frames must be an array');
    let last=-1;
    for(const f of data.frames) {
      if(!Number.isInteger(f.tick)||f.tick<=last) throw new Error('frame ticks must increase strictly');
      if(f.move && (!Array.isArray(f.move)||f.move.length!==2||f.move.some(x=>typeof x!=='number'||x< -1||x>1))) throw new Error('invalid move');
      for(const key of ['jump','interact','pulse']) if(key in f && typeof f[key]!=='boolean') throw new Error(`invalid ${key}`);
      last=f.tick;
    }
  }
  if(kind==='scenario') {
    for(const key of ['motes','shades','lanterns']) if(key in data && !Array.isArray(data[key])) throw new Error(`invalid ${key}`);
  }
}
try {
  const seed=Number(arg('--seed',1)), night=Number(arg('--night',1)), ticks=Number(arg('--ticks',0)), every=Number(arg('--snapshot-every',10)), out=arg('--out',null);
  if(!Number.isInteger(seed)||night!==1||!Number.isInteger(ticks)||ticks<0||!Number.isInteger(every)||every<1||!out) throw new Error('invalid arguments');
  const scenario=arg('--scenario',null)?readJson(arg('--scenario')):{};
  const inputs=arg('--inputs',null)?readJson(arg('--inputs')):{frames:[]};
  validate(scenario,'scenario');validate(inputs,'inputs');
  const game=new Game({seed,scenario});
  const lines=[JSON.stringify(game.snapshot())];
  let fi=0;
  for(let k=0;k<ticks&&game.state==='playing';k++) {
    let frame={};
    if(fi<inputs.frames.length&&inputs.frames[fi].tick===k) {frame={...inputs.frames[fi]};delete frame.tick;fi++;}
    for(const event of game.step(frame)) lines.push(JSON.stringify(event));
    if(game.tick%every===0) lines.push(JSON.stringify(game.snapshot()));
  }
  lines.push(JSON.stringify({type:'end',ticks:game.tick,state:game.state,score:game.score}));
  writeFileSync(out,lines.join('\n')+'\n');
} catch(e) { console.error(e.message); process.exit(2); }
