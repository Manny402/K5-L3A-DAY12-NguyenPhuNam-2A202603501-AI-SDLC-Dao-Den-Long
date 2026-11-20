import * as THREE from '/node_modules/three/build/three.module.js';
import {Game} from '/src/core.mjs';
const scene=new THREE.Scene();scene.background=new THREE.Color('#0E1430');scene.fog=new THREE.Fog('#1B2350',50,115);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,200);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight('#FFE9B0','#12384A',1.3));
const light=new THREE.DirectionalLight('#FFB347',1.2);light.position.set(10,20,5);scene.add(light);
function mesh(geo,color,x=0,y=0,z=0){const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.85}));m.position.set(x,y,z);scene.add(m);return m;}
mesh(new THREE.CylinderGeometry(40,40,2,64),'#2F5D50',0,-1,0);
const pmesh=mesh(new THREE.CapsuleGeometry(.45,1.2,6,10),'#E8E2D0');
const hat=mesh(new THREE.ConeGeometry(.8,.45,12),'#C9B48A');
const lanternMeshes=[],moteMeshes=new Map(),shadeMeshes=new Map();
let game=null,playing=false,last=0,acc=0;const keys=new Set();
document.addEventListener('keydown',e=>{keys.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
document.addEventListener('keyup',e=>keys.delete(e.code));
document.getElementById('start').onclick=()=>{game=new Game({seed:42});playing=true;document.getElementById('center').style.display='none';};
function sync(){const p=game.player;pmesh.position.set(...p.pos);pmesh.position.y+=1;hat.position.set(p.pos[0],p.pos[1]+2.1,p.pos[2]);
  game.lanterns.forEach((l,i)=>{if(!lanternMeshes[i]){const pole=mesh(new THREE.CylinderGeometry(.12,.16,3,8),'#6B4A2F',...l.pos);pole.position.y+=1.5;lanternMeshes[i]=mesh(new THREE.SphereGeometry(.8,12,8),'#5B5F6E',l.pos[0],3.1,l.pos[2]);}lanternMeshes[i].material.color.set(l.lit?'#FFB347':'#5B5F6E');});
  const ids=new Set(game.motes.map(m=>m.id));for(const [id,m] of moteMeshes)if(!ids.has(id)){scene.remove(m);moteMeshes.delete(id);}for(const mote of game.motes)if(!moteMeshes.has(mote.id))moteMeshes.set(mote.id,mesh(new THREE.SphereGeometry(.22,8,8),'#FFF6C2',mote.pos[0],.5,mote.pos[2]));
  for(const s of game.shades){if(!shadeMeshes.has(s.id))shadeMeshes.set(s.id,mesh(new THREE.SphereGeometry(.8,12,10),'#120A1A'));const m=shadeMeshes.get(s.id);m.position.set(s.pos[0],1,s.pos[2]);m.material.color.set(s.state==='stunned'?'#3A3450':'#120A1A');}
  camera.position.set(p.pos[0],p.pos[1]+8,p.pos[2]+15);camera.lookAt(p.pos[0],p.pos[1]+1,p.pos[2]);
  document.getElementById('life').textContent=`🔥 ${p.flames}`;document.getElementById('timer').textContent=`${Math.floor(game.time_left_s/60)}:${String(Math.ceil(game.time_left_s%60)).padStart(2,'0')}`;document.getElementById('lights').textContent=`🏮 ${game.lanterns.filter(l=>l.lit).length}/5  ★ ${game.score}`;document.getElementById('bottom').textContent=`Đom đóm ${p.carried}/10 · Tỏa sáng ${p.pulse_cd?Math.ceil(p.pulse_cd/60)+'s':'sẵn sàng'}`;
  if(game.state!=='playing'){playing=false;document.getElementById('center').style.display='grid';document.querySelector('#panel h1').textContent=game.state==='won'?'Bình minh!':'Đêm đã tàn';document.querySelector('#panel p').textContent=`Điểm: ${game.score}`;document.getElementById('start').textContent='Chơi lại';}
}
function loop(t){requestAnimationFrame(loop);const delta=Math.min((t-last)/1000,.1);last=t;if(playing){acc+=delta;while(acc>=1/60){game.step({move:[Number(keys.has('KeyD'))-Number(keys.has('KeyA')),Number(keys.has('KeyW'))-Number(keys.has('KeyS'))],jump:keys.has('Space'),interact:keys.has('KeyE'),pulse:keys.has('KeyQ')});acc-=1/60;}sync();}renderer.render(scene,camera);}requestAnimationFrame(loop);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
