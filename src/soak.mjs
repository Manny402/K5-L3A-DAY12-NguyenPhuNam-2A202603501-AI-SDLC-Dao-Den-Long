import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {Game} from './core.mjs';

const arg=(key,defaultValue)=>{const i=process.argv.indexOf(key);return i<0?defaultValue:process.argv[i+1];};
const seed=Number(arg('--seed',7)),nights=Number(arg('--nights',10)),out=arg('--out','soak.json');
if(!Number.isInteger(seed)||!Number.isInteger(nights)||nights<1){console.error('Invalid soak arguments');process.exit(2);}
function rng(seed){let n=seed>>>0;return()=>((n=(1664525*n+1013904223)>>>0)/4294967296);}
const start=performance.now(),results=[];let crashes=0,mem_start_mb=0;
for(let i=0;i<nights;i++){
  try{
    const random=rng(seed+i),game=new Game({seed:seed+i,night:i%3+1});
    if(i===0){global.gc?.();mem_start_mb=process.memoryUsage().rss/1048576;}
    let move=[0,0],held={jump:false,dash:false,pulse:false,interact:false};
    const duration=Math.ceil(game.time_left_s*60);
    for(let tick=0;tick<duration&&game.state==='playing';tick++){
      if(tick%30===0){const a=random()*Math.PI*2;move=[Math.cos(a),Math.sin(a)];}
      held={jump:random()<.05,dash:random()<.03,pulse:random()<.02,interact:random()<.1};
      game.step({move,...held});
    }
    results.push(game.state);
  }catch(e){crashes++;results.push('crashed');console.error(e);}
}
global.gc?.();const output={nights,crashes,results,mem_start_mb:Number(mem_start_mb.toFixed(2)),mem_end_mb:Number((process.memoryUsage().rss/1048576).toFixed(2)),duration_s:Number(((performance.now()-start)/1000).toFixed(2))};
writeFileSync(out,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
