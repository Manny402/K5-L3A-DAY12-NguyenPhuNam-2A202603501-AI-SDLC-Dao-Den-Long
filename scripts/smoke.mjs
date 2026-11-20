import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';

const paths=process.platform==='win32'
  ? ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  : ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath=paths.find(existsSync);
if(!executablePath)throw new Error('Chrome or Edge required');
const server=spawn(process.execPath,['src/server.mjs','--port','8089'],{stdio:'ignore'});
let browser;

async function startPage(page){
  await page.goto('http://localhost:8089');
  await page.getByRole('button',{name:'Bắt đầu'}).click();
  await page.getByRole('button',{name:'Bắt đầu'}).click();
  await page.waitForTimeout(300);
}
async function modifiedPage(sourceChange){
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>{throw e;});
  await page.route('**/public/game.mjs',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:sourceChange(await response.text())});
  });
  await startPage(page);
  return page;
}

try{
  await new Promise(r=>setTimeout(r,500));
  browser=await chromium.launch({executablePath,headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await startPage(page);
  if(!(await page.locator('#lights').textContent()).includes('/5'))throw new Error('Night 1 HUD did not start');
  if(await page.locator('#moteSlots .moteSlot').count()!==10)throw new Error('Expected ten mote slots');
  if(!(await page.locator('#dashStatus').textContent()).includes('Lướt'))throw new Error('Dash cooldown missing');
  if(!(await page.locator('#pulseStatus').textContent()).includes('Tỏa sáng'))throw new Error('Pulse cooldown missing');
  if(errors.length)throw new Error(errors.join('\n'));

  const night3=await modifiedPage(source=>source.replace('night=1,totalScore=0','night=3,totalScore=0'));
  if(!(await night3.locator('#lights').textContent()).includes('/7'))throw new Error('Night 3 scene did not start');
  const screenshotIndex=process.argv.indexOf('--screenshot-night3');
  if(screenshotIndex>=0)await night3.screenshot({path:process.argv[screenshotIndex+1]});

  const arrowPage=await modifiedPage(source=>source.replace('game=new Game({seed:42+night,night});','game=new Game({seed:42+night,night,scenario:{player:{pos:[0,0,39.9]},random_shades:false,random_motes:false}});'));
  if(!(await arrowPage.locator('#offscreenArrow').isVisible()))throw new Error('Off-screen lantern arrow did not appear');
  const arrowScreenshotIndex=process.argv.indexOf('--screenshot-arrow');
  if(arrowScreenshotIndex>=0)await arrowPage.screenshot({path:process.argv[arrowScreenshotIndex+1]});
  console.log('UI smoke passed: Night 1 HUD, Night 3 scene and lantern arrow');
}finally{
  if(browser)await browser.close();
  server.kill();
}
