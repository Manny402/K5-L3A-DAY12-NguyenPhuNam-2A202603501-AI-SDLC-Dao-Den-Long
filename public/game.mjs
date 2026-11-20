import * as THREE from '/node_modules/three/build/three.module.js';
import {Game} from '/src/core.mjs';
const scene=new THREE.Scene();scene.background=new THREE.Color('#0E1430');scene.fog=new THREE.Fog('#1B2350',50,115);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,200);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight('#FFE9B0','#12384A',1.3));
const light=new THREE.DirectionalLight('#FFB347',1.2);light.position.set(10,20,5);scene.add(light);
function mesh(geo,color,x=0,y=0,z=0){const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.85}));m.position.set(x,y,z);scene.add(m);return m;}
const islandMeshes=[];
function island(geo,color,x,y,z){const m=mesh(geo,color,x,y,z);islandMeshes.push(m);return m;}
function buildIsland(n){for(const m of islandMeshes)scene.remove(m);islandMeshes.length=0;
  if(n===1)island(new THREE.CylinderGeometry(40,40,2,64),'#2F5D50',0,-1,0);
  if(n===2){island(new THREE.CylinderGeometry(28,28,2,48),'#2F5D50',0,-1,0);island(new THREE.CylinderGeometry(28,28,2,48),'#2F5D50',70,-1,0);island(new THREE.BoxGeometry(18,.5,4),'#6B4A2F',35,-.25,0);for(const [x,z] of [[20,18],[50,-18]])island(new THREE.CylinderGeometry(1,1,.2,16),'#F2C14E',x,.1,z);}
  if(n===3){island(new THREE.CylinderGeometry(45,45,2,64),'#2F5D50',0,-1,0);island(new THREE.CylinderGeometry(24,24,3,48,1,false,0,Math.PI),'#6B4A2F',0,1.5,0);island(new THREE.CylinderGeometry(8,8,6,32),'#C9B48A',0,3,0);island(new THREE.CylinderGeometry(2,2,8,16),'#6B4A2F',0,10,0);}
}
const pmesh=mesh(new THREE.CapsuleGeometry(.45,1.2,6,10),'#E8E2D0');
const hat=mesh(new THREE.ConeGeometry(.8,.45,12),'#C9B48A');
const lanternMeshes=[],moteMeshes=new Map(),shadeMeshes=new Map();
let game=null,playing=false,last=0,acc=0,night=1,totalScore=0;const keys=new Set();
const saved=JSON.parse(localStorage.getItem('dao-settings')||'{}');const settings={volume:saved.volume??.25,sensitivity:saved.sensitivity??1};
function tone(hz){if(settings.volume<=0)return;const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=hz;gain.gain.value=settings.volume*.1;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.12);osc.onended=()=>ctx.close();}
const panel=document.getElementById('panel'),center=document.getElementById('center');
function screen(title,body,buttons){center.style.display='grid';panel.innerHTML=`<h1>${title}</h1><p>${body}</p>`;for(const [label,click] of buttons){const b=document.createElement('button');b.textContent=label;b.onclick=click;panel.append(b);}}
function intro(){const names=['Đảo Bến','Đảo Cau','Đảo Chuông'];screen(`Đêm ${night} — ${names[night-1]}`,'Ông Đăng: Mây ơi, hãy gom ánh sáng và giữ những ngọn đèn!',[['Bắt đầu',startNight]]);}
function startNight(){for(const m of lanternMeshes)scene.remove(m);lanternMeshes.length=0;for(const m of moteMeshes.values())scene.remove(m);moteMeshes.clear();for(const m of shadeMeshes.values())scene.remove(m);shadeMeshes.clear();buildIsland(night);game=new Game({seed:42+night,night});playing=true;center.style.display='none';}
function pauseScreen(){screen('Tạm dừng','Đêm đang đứng yên.',[['Tiếp tục',()=>{game.step({pause:false});game.step({pause:true});playing=true;center.style.display='none';}],['Chơi lại Đêm',startNight],['Cài đặt',showSettings],['Về menu',menu]]);}
function menu(){playing=false;night=1;totalScore=0;screen('Đảo Đèn Lồng','Ba hòn đảo đang chờ ánh sáng.',[['Chơi',intro],['Cài đặt',showSettings]]);}
function showSettings(){screen('Cài đặt',`Âm lượng <input id="volume" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><br>Độ nhạy chuột <input id="sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}">`,[['Lưu',()=>{settings.volume=Number(document.getElementById('volume').value);settings.sensitivity=Number(document.getElementById('sens').value);localStorage.setItem('dao-settings',JSON.stringify(settings));if(game?.state==='paused')pauseScreen();else menu();}]]);}
document.addEventListener('keydown',e=>{keys.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
document.addEventListener('keyup',e=>keys.delete(e.code));
document.getElementById('start').onclick=intro;document.getElementById('settings').onclick=showSettings;
function sync(){const p=game.player;pmesh.position.set(...p.pos);pmesh.position.y+=1;hat.position.set(p.pos[0],p.pos[1]+2.1,p.pos[2]);
  game.lanterns.forEach((l,i)=>{if(!lanternMeshes[i]){const pole=mesh(new THREE.CylinderGeometry(.12,.16,3,8),'#6B4A2F',...l.pos);pole.position.y+=1.5;lanternMeshes[i]=mesh(new THREE.SphereGeometry(.8,12,8),'#5B5F6E',l.pos[0],3.1,l.pos[2]);}lanternMeshes[i].material.color.set(l.lit?'#FFB347':'#5B5F6E');});
  const ids=new Set(game.motes.map(m=>m.id));for(const [id,m] of moteMeshes)if(!ids.has(id)){scene.remove(m);moteMeshes.delete(id);}for(const mote of game.motes)if(!moteMeshes.has(mote.id))moteMeshes.set(mote.id,mesh(new THREE.SphereGeometry(.22,8,8),'#FFF6C2',mote.pos[0],.5,mote.pos[2]));
  for(const s of game.shades){if(!shadeMeshes.has(s.id))shadeMeshes.set(s.id,mesh(new THREE.SphereGeometry(.8,12,10),'#120A1A'));const m=shadeMeshes.get(s.id);m.position.set(s.pos[0],1,s.pos[2]);m.material.color.set(s.state==='stunned'?'#3A3450':'#120A1A');}
  camera.position.set(p.pos[0],p.pos[1]+8,p.pos[2]+15);camera.lookAt(p.pos[0],p.pos[1]+1,p.pos[2]);
  document.getElementById('life').textContent=`🔥 ${p.flames}`;document.getElementById('timer').textContent=`${Math.floor(game.time_left_s/60)}:${String(Math.ceil(game.time_left_s%60)).padStart(2,'0')}`;document.getElementById('lights').textContent=`🏮 ${game.lanterns.filter(l=>l.lit).length}/${game.lanterns.length}  ★ ${game.score}`;document.getElementById('bottom').textContent=`Đom đóm ${p.carried}/10 · Lướt ${p.dash_cd?Math.ceil(p.dash_cd/60)+'s':'sẵn sàng'} · Tỏa sáng ${p.pulse_cd?Math.ceil(p.pulse_cd/60)+'s':'sẵn sàng'}`;
  const near=game.lanterns.find(l=>!l.lit&&Math.hypot(l.pos[0]-p.pos[0],l.pos[2]-p.pos[2])<=2);document.getElementById('hint').textContent=near?`E — Nạp ánh sáng (${near.deposited}/10)`:'';
  if(game.state==='paused'){playing=false;pauseScreen();}
  else if(game.state!=='playing'){playing=false;if(game.state==='won'){totalScore+=game.score;if(night<3){night++;screen('Đêm đã sáng',`Tổng điểm: ${totalScore}`,[['Đêm tiếp theo',intro],['Về menu',menu]]);}else screen('Bình Minh',`Tổng điểm: ${totalScore}`,[['Về menu',menu]]);}else screen('Đêm đã tàn',`Điểm: ${totalScore}`,[['Chơi lại Đêm',startNight],['Về menu',menu]]);}
}
function loop(t){requestAnimationFrame(loop);const delta=Math.min((t-last)/1000,.1);last=t;if(playing){acc+=delta;while(acc>=1/60){const events=game.step({move:[Number(keys.has('KeyD'))-Number(keys.has('KeyA')),Number(keys.has('KeyW'))-Number(keys.has('KeyS'))],jump:keys.has('Space'),interact:keys.has('KeyE'),pulse:keys.has('KeyQ'),dash:keys.has('ShiftLeft'),pause:keys.has('KeyP')||keys.has('Escape')});for(const e of events)if(['mote_picked','lantern_lit','pulse','player_hit','game_over','dash','shade_spawned'].includes(e.name))tone({mote_picked:660,lantern_lit:880,pulse:300,player_hit:150,game_over:200,dash:450,shade_spawned:180}[e.name]);acc-=1/60;if(game.state!=='playing')break;}sync();}renderer.render(scene,camera);}requestAnimationFrame(loop);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
