import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {existsSync,writeFileSync} from 'node:fs';
import {platform,release} from 'node:os';

const arg=(key,defaultValue)=>{const i=process.argv.indexOf(key);return i<0?defaultValue:process.argv[i+1];};
const duration=Number(arg('--duration',30)),seed=Number(arg('--seed',42)),out=arg('--out','bench.json');
if(!Number.isFinite(duration)||duration<=0||!Number.isInteger(seed)){console.error('Invalid benchmark arguments');process.exit(2);}
const candidates=platform()==='win32'?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath=candidates.find(existsSync);
if(!executablePath){console.error('Chrome or Edge is required for the graphical benchmark');process.exit(1);}
const start=Date.now();const port=8088;const server=spawn(process.execPath,['src/server.mjs','--port',String(port)],{stdio:'ignore'});
let browser;
try{
  await new Promise(r=>setTimeout(r,500));
  browser=await chromium.launch({executablePath,headless:false,args:['--disable-gpu-vsync','--disable-frame-rate-limit','--window-size=1280,720']});
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto(`http://localhost:${port}/?bench=1&duration=${duration}&seed=${seed}`);
  await page.waitForFunction(()=>window.__BENCH_READY__===true,null,{timeout:15000});
  const load_ms=Date.now()-start;
  await page.waitForFunction(()=>Array.isArray(window.__BENCH_RESULT__),null,{timeout:(duration+15)*1000});
  const samples=await page.evaluate(()=>window.__BENCH_RESULT__);
  const screenshot=arg('--screenshot',null);if(screenshot)await page.screenshot({path:screenshot});
  if(!samples.length)throw new Error('No measured frames');
  const sorted=[...samples].sort((a,b)=>a-b),worst=[...samples].sort((a,b)=>b-a),k=Math.max(1,Math.ceil(samples.length*.01));
  const output={contract_version:'1.3',avg_fps:1000*samples.length/samples.reduce((a,b)=>a+b,0),p1_low_fps:1000/(worst.slice(0,k).reduce((a,b)=>a+b,0)/k),frame_ms_p95:sorted[Math.ceil(.95*sorted.length)-1],frames:samples.length,load_ms,peak_mem_mb:null,vsync_off:true,renderer:'Three.js WebGLRenderer 0.181.2 / Chromium',os:`${platform()} ${release()}`};
  writeFileSync(out,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(browser)await browser.close();server.kill();}
