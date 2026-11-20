import contract from '../game.contract.json' with { type: 'json' };

export const T = contract.tuning;
const DT = 1 / 60;
const lanternPositions = {
  1: [[0,0,25],[23.8,0,7.7],[14.7,0,-20.2],[-14.7,0,-20.2],[-23.8,0,7.7]],
  2: [[0,0,20],[17,0,-10],[-17,0,-10],[70,0,20],[87,0,-10],[53,0,-10]],
  3: [[0,6,6],[18,3,10],[-18,3,10],[35,0,-10],[-35,0,-10],[20,0,-35],[-20,0,-35]]
};
const clone = x => JSON.parse(JSON.stringify(x));
const round = (x, d = 3) => Number(x.toFixed(d));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const norm = (x, z) => { const l = Math.hypot(x, z); return l > 1 ? [x / l, z / l] : [x, z]; };
const polar = (r, deg) => [round(r * Math.cos(deg * Math.PI / 180)), 0, round(r * Math.sin(deg * Math.PI / 180))];
function rng(seed) { let n = seed >>> 0; return () => ((n = (1664525 * n + 1013904223) >>> 0) / 4294967296); }

export class Game {
  constructor({seed = 1, night = 1, scenario = {}} = {}) {
    if (![1,2,3].includes(night)) throw new Error('night must be 1, 2 or 3');
    this.night = night;
    this.seed = seed;
    this.random = rng(seed);
    this.tick = 0;
    this.sim_tick = 0;
    this.state = 'playing';
    this.score = 0;
    this.time_left_s = scenario.time_left_s ?? T[`night${night}_duration_s`];
    this.player = {pos: clone(scenario.player?.pos ?? [0, 0, 0]), vel: [0, 0, 0], grounded: true, carried: scenario.player?.carried ?? 0, flames: scenario.player?.flames ?? T.flames, invuln: scenario.player?.invuln_ticks ?? 0, pulse_cd: scenario.player?.pulse_cd_ticks ?? 0, dash_cd: scenario.player?.dash_cd_ticks ?? 0, dash_left: 0, charm: scenario.player?.charm_ticks ?? 0, facing: [0, 1], launch: null, respawn: 0,successful_lights:scenario.player?.successful_lights??0};
    this.lanterns = lanternPositions[night].map((pos, i) => ({id: `L${i + 1}`, pos: clone(pos), lit: false, deposited: 0,fuelUnits:0,ever_lit:false,relit_count:0}));
    for (const item of scenario.lanterns ?? []) {
      const lantern = this.lanterns.find(l => l.id === item.id);
      if (!lantern) throw new Error(`Unknown lantern ${item.id}`);
      Object.assign(lantern, clone(item));
      lantern.fuelUnits=lantern.lit?Math.round((item.fuel??100)*60):0;
      lantern.ever_lit=item.ever_lit??lantern.lit;
      delete lantern.fuel;
    }
    this.motes = [];
    this.nextMote = 1;
    this.motePoints = night===1 ? [...Array.from({length: 8}, (_, i) => polar(12, i * 45)), ...Array.from({length: 16}, (_, i) => polar(33, i * 22.5))] : night===2 ? [0,70].flatMap(cx=>[...Array.from({length:4},(_,i)=>polar(10,i*90)),...Array.from({length:8},(_,i)=>polar(22,i*45))].map(p=>[p[0]+cx,0,p[2]])) : [...Array.from({length:18},(_,i)=>polar(34,i*20)),...Array.from({length:8},(_,i)=>{const p=polar(18,20+i*20);return [p[0],3,p[2]];}),...Array.from({length:4},(_,i)=>{const p=polar(5,45+i*90);return [p[0],6,p[2]];})];
    this.random_motes = scenario.random_motes ?? true;
    if (scenario.motes) for (const pos of scenario.motes) this.addMote(pos);
    else if (this.random_motes) for (const pos of this.motePoints.slice(0, 20)) this.addMote(pos);
    this.shades = [];
    this.nextShade = 1;
    this.random_shades = scenario.random_shades ?? true;
    for (const shade of scenario.shades ?? []) this.addShade(shade.pos, shade.id);
    for (const shade of scenario.shades ?? []) {const s=this.shades.find(x=>x.id===(shade.id??this.shades[scenario.shades.indexOf(shade)].id));if(s){s.state=shade.state??'wander';s.stun=shade.state==='stunned'?(shade.state_ticks_left??120):0;s.target_lantern_id=shade.target_lantern_id??null;}}
    this.drifters=[];this.nextDrifter=1;this.random_drifters=scenario.random_drifters??true;
    for(const d of scenario.drifters??[]) this.drifters.push({id:d.id??`D${this.nextDrifter++}`,pos:clone(d.pos),state:d.state??'idle',stolen:d.stolen??0,timer:d.state_ticks_left??0});
    this.charms=(scenario.charms??(night===2?[{id:'C1',pos:[35,0,0]}]:night===3?[{id:'C1',pos:[30,0,25]},{id:'C2',pos:[-30,0,25]}]:[])).map(c=>({id:c.id,pos:clone(c.pos),available:c.available??true,respawn:c.respawn_ticks??0}));
    this.wind_enabled=scenario.wind_enabled??true;this.wind={active:false,dir_deg:0};
    this.events = [];
    this.held = {move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false,dash:false,pause:false};
  }
  addMote(pos,kind='random',ttl=0) { this.motes.push({id: `M${this.nextMote++}`, pos: clone(pos),kind,ttl,pickable:this.sim_tick+1}); }
  addShade(pos, id) { this.shades.push({id: id ?? `S${this.nextShade++}`, pos: clone(pos), state: 'wander', stun: 0, recoil: 0, safe:0}); }
  event(name, data = {}) { this.events.push({type: 'event', tick: this.tick, name, data}); }
  groundY(pos){const [x,,z]=pos;const d=Math.hypot(x,z);
    if(this.night===1)return d<=40?0:-Infinity;
    if(this.night===2)return Math.hypot(x,z)<=28||Math.hypot(x-70,z)<=28||(x>=26&&x<=44&&Math.abs(z)<=2)?0:-Infinity;
    if(d>45)return -Infinity;
    if(d<=8)return 6;
    if(d>=12&&d<=24&&z>0)return 3;
    return 0;
  }
  step(input = {}) {
    if (!['playing','paused'].includes(this.state)) return [];
    const prev = {...this.held};
    Object.assign(this.held, input);
    this.tick++;
    this.events = [];
    if(this.held.pause && !prev.pause) {this.state=this.state==='paused'?'playing':'paused';this.event(this.state==='paused'?'paused':'resumed');return this.events;}
    if(this.state==='paused') return this.events;
    this.sim_tick++;
    this.time_left_s = Math.max(0, this.time_left_s - DT);
    const p = this.player;
    p.invuln = Math.max(0, p.invuln - 1);
    p.pulse_cd = Math.max(0, p.pulse_cd - 1);
    p.dash_cd=Math.max(0,p.dash_cd-1);p.charm=Math.max(0,p.charm-1);p.respawn=Math.max(0,p.respawn-1);
    for(const c of this.charms) if(!c.available && c.respawn>0) {c.respawn--;if(c.respawn===0)c.available=true;}
    for(let i=this.motes.length-1;i>=0;i--)if(this.motes[i].kind==='dropped'&&--this.motes[i].ttl<=0)this.motes.splice(i,1);
    for (const s of this.shades) s.stun = Math.max(0, s.stun - 1);
    for(const l of this.lanterns)if(l.lit){l.fuelUnits-=1;for(const s of this.shades)if(s.state==='drain'&&s.target_lantern_id===l.id){l.fuelUnits-=5;if(this.sim_tick%60===0)this.event('fuel_drain',{lantern_id:l.id,shade_id:s.id,fuel:round(Math.max(0,l.fuelUnits)/60,1)});}if(l.fuelUnits<=0){l.fuelUnits=0;l.lit=false;l.deposited=0;this.event('lantern_out',{lantern_id:l.id});}}
    let [mx, mz] = norm(...this.held.move);
    const a = this.held.cam_yaw_deg * Math.PI / 180;
    [mx, mz] = [mx * Math.cos(a) + mz * Math.sin(a), -mx * Math.sin(a) + mz * Math.cos(a)];
    if (Math.hypot(mx, mz) > 0) p.facing = [mx, mz];
    if(!p.respawn&&this.held.dash&&!prev.dash&&p.dash_left===0&&(p.dash_cd===0||p.charm>0)) {p.dash_left=12;p.dash_cd=p.charm>0?0:90;p.dash_dir=[mx,mz];if(Math.hypot(mx,mz)===0)p.dash_dir=p.facing;this.event('dash',{});}
    if(p.dash_left>0){p.vel[0]=p.dash_dir[0]*14;p.vel[2]=p.dash_dir[1]*14;p.dash_left--;}
    else if(!p.launch){p.vel[0]=p.respawn?0:mx*(p.charm>0?7.2:T.player_speed);p.vel[2]=p.respawn?0:mz*(p.charm>0?7.2:T.player_speed);}
    if (this.held.jump && !prev.jump && p.grounded) { p.vel[1] = 7; p.grounded = false; }
    if (!p.grounded && p.dash_left===0) p.vel[1] -= 20 * DT;
    for (let i = 0; i < 3; i++) p.pos[i] += p.vel[i] * DT;
    const ground=this.groundY(p.pos);
    if(p.pos[1]<=ground && p.vel[1]<=0 && ground>-Infinity) {p.pos[1]=ground;p.vel[1]=0;p.grounded=true;p.launch=null;}
    else p.grounded=false;
    if(p.grounded&&this.night===2){for(const [pad,target] of [[[20,0,18],[70,0,0]],[[50,0,-18],[0,0,0]]])if(distance(p.pos,pad)<=1){const d=distance(pad,target);p.vel=[(target[0]-pad[0])/d*24,14,(target[2]-pad[2])/d*24];p.launch=true;p.grounded=false;break;}}
    if(p.grounded&&this.night===3&&distance(p.pos,[0,3,13])<=1&&p.pos[1]>=3){p.vel=[0,12,-8];p.launch=true;p.grounded=false;}
    if(this.night===3&&this.wind_enabled){const cycle=this.sim_tick%1800;this.wind.active=cycle>=120&&cycle<420;if(cycle===120)this.wind.dir_deg=Math.floor(this.random()*360);if(this.wind.active){p.pos[0]+=Math.cos(this.wind.dir_deg*Math.PI/180)*2*DT;p.pos[2]+=Math.sin(this.wind.dir_deg*Math.PI/180)*2*DT;}}
    if (p.pos[1] < -10) this.hit('fall');
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (!p.respawn&&p.carried < Math.min(20,10+2*p.successful_lights) && this.sim_tick>=m.pickable && distance(p.pos, m.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= 1.5) {
        this.motes.splice(i, 1); p.carried++; this.event('mote_picked', {carried: p.carried});
      }
    }
    for(const c of this.charms)if(!p.respawn&&c.available&&distance(p.pos,c.pos)<=1&&Math.abs(p.pos[1]-c.pos[1])<=1.5){c.available=false;c.respawn=2700;p.charm=600;this.event('charm_picked',{charm_id:c.id,charm_ticks:600});}
    if (!p.respawn&&this.held.interact && !prev.interact) {
      const l = this.lanterns.filter(l => (!l.lit||l.fuelUnits<6000) && distance(p.pos, l.pos) <= T.interact_radius).sort((a,b) => distance(p.pos,a.pos)-distance(p.pos,b.pos) || a.id.localeCompare(b.id))[0];
      if (l && p.carried) {
        if(l.lit){const amount=Math.min(p.carried,Math.ceil((6000-l.fuelUnits)/600));if(amount>0){p.carried-=amount;l.fuelUnits=Math.min(6000,l.fuelUnits+amount*600);this.score+=amount*5;this.event('refuel',{lantern_id:l.id,amount,fuel:round(l.fuelUnits/60,1)});if(l.fuelUnits>=1800)this.ejectShades(l);}}
        else {const amount=Math.min(p.carried,(l.ever_lit?T.relight_cost:T.lantern_cost)-l.deposited);p.carried-=amount;l.deposited+=amount;this.score+=amount*5;this.event('deposit',{lantern_id:l.id,amount,deposited:l.deposited});if(l.deposited>=(l.ever_lit?T.relight_cost:T.lantern_cost)){const relight=l.ever_lit;l.lit=true;l.ever_lit=true;l.fuelUnits=6000;p.successful_lights++;if(relight)l.relit_count++;this.score+=relight?40:100;this.event('lantern_lit',{lantern_id:l.id,relight});this.ejectShades(l);}}
      }
    }
    if (!p.respawn&&this.held.pulse && !prev.pulse && p.carried >= T.pulse_cost && p.pulse_cd === 0) {
      p.carried -= T.pulse_cost; p.pulse_cd = Math.round(T.pulse_cooldown_s * 60);
      const ids = [];
      for (const s of this.shades) if (Math.hypot(p.pos[0]-s.pos[0], p.pos[1]+0.8-s.pos[1], p.pos[2]-s.pos[2]) <= T.pulse_radius) {
        this.score += s.state==='drain'?15:5;s.state = 'stunned'; s.stun = Math.round(T.pulse_stun_s * 60); ids.push(s.id);
        const dx = s.pos[0]-p.pos[0], dz = s.pos[2]-p.pos[2], d = Math.hypot(dx,dz) || 1;
        s.push=[dx===0&&dz===0?1:dx/d,dz===0&&dx===0?0:dz/d];s.push_left=15;
      }
      for(const d of this.drifters){if(distance(d.pos,p.pos)<=5&&d.state==='chase'){d.state='flee';d.timer=240;}else if(distance(d.pos,p.pos)<=5&&d.state==='flee'&&d.stolen>0){this.event('drifter_drop',{drifter_id:d.id,amount:d.stolen});for(let i=0;i<d.stolen;i++)this.addMote([d.pos[0]+i*.2,0,d.pos[2]],'dropped',480);d.stolen=0;d.timer=120;}}
      this.event('pulse',{stunned_ids:ids});
    }
    for (const s of this.shades) {
      if(s.safe>0)s.safe--;
      if (s.stun){if(s.push_left>0){s.pos[0]+=s.push[0]*4/15;s.pos[2]+=s.push[1]*4/15;s.push_left--;}if(s.stun===0)s.state='wander';continue;}
      if(s.recoil>0){s.recoil--;s.state='recoil';continue;}
      if(s.state==='drain'){const target=this.lanterns.find(l=>l.id===s.target_lantern_id);if(!target?.lit||target.fuelUnits>=1800||distance(s.pos,target.pos)>2)s.state='wander';else if(distance(s.pos,p.pos)<=6)s.state='chase';else continue;}
      const d = distance(s.pos,p.pos);
      s.state = d <= 12 || (s.state==='chase'&&d<=18) ? 'chase' : 'wander';
      if (s.state === 'chase' && d > 0) {
        const step = Math.min(T.shade_speed * DT, d);
        s.pos[0] += (p.pos[0]-s.pos[0])/d*step; s.pos[2] += (p.pos[2]-s.pos[2])/d*step;
      }
      if(s.state==='wander') {const targets=this.lanterns.filter(l=>l.lit&&l.fuelUnits<1800);const options=targets.length?targets:this.lanterns.filter(l=>!l.lit);const target=options.sort((a,b)=>distance(s.pos,a.pos)-distance(s.pos,b.pos)||a.id.localeCompare(b.id))[0];if(target){s.target_lantern_id=target.id;const dd=distance(s.pos,target.pos);if(target.lit&&dd<=2){s.state='drain';}else if(dd>0){s.pos[0]+=(target.pos[0]-s.pos[0])/dd*4*DT;s.pos[2]+=(target.pos[2]-s.pos[2])/dd*4*DT;}}}
      for(const l of this.lanterns)if(l.lit&&l.fuelUnits>=1800&&distance(s.pos,l.pos)<6){const dx=s.pos[0]-l.pos[0],dz=s.pos[2]-l.pos[2],dd=Math.hypot(dx,dz)||1;s.pos[0]=l.pos[0]+(dx||1)/dd*6;s.pos[2]=l.pos[2]+dz/dd*6;s.safe=30;}
    }
    for(const d of this.drifters){if(d.state==='removed')continue;const dist=distance(d.pos,p.pos);if(d.state!=='flee')d.state=p.carried>=5&&dist<=15?'chase':'idle';const speed=d.state==='idle'?2:7;const sign=d.state==='flee'?-1:1;if(dist>0){d.pos[0]+=(p.pos[0]-d.pos[0])/dist*speed*DT*sign;d.pos[2]+=(p.pos[2]-d.pos[2])/dist*speed*DT*sign;}if(d.state==='flee'&&--d.timer<=0)d.state='removed';}
    for(const d of this.drifters)if(!p.respawn&&d.state==='chase'&&distance(d.pos,p.pos)<=1.2){const amount=Math.min(3,p.carried);p.carried-=amount;d.stolen=amount;d.state='flee';d.timer=240;this.event('drifter_steal',{drifter_id:d.id,amount,carried:p.carried});}
    for (const s of this.shades) {
      if(!p.respawn&&!s.stun&&!s.safe&&!p.invuln&&distance(s.pos,p.pos)<=T.shade_hit_radius&&Math.abs(s.pos[1]-p.pos[1])<=1.5){this.hit('shade');s.recoil=60;break;}
    }
    if (this.random_motes && this.sim_tick % 240 === 0 && this.motes.length < 30) {
      const vacant = this.motePoints.filter(pt => !this.motes.some(m => distance(m.pos,pt)<0.01));
      if (vacant.length) this.addMote(vacant[Math.floor(this.random()*vacant.length)]);
    }
    const interval=this.night===1?480:this.night===2?420:360, maxShades=this.night===1?6:this.night===2?8:10;
    if (this.random_shades && this.sim_tick >= 300 && (this.sim_tick === 300 || (this.sim_tick-300)%interval===0) && this.shades.length < maxShades) {
      for (let i=0; i<(this.sim_tick===300?2:1); i++) {
        const pos = this.night===2?polar(26,22.5+Math.floor(this.random()*8)*45):polar(this.night===1?37:43, this.night===1?15+Math.floor(this.random()*12)*30:Math.floor(this.random()*16)*22.5);
        if(this.night===2&&this.random()<.5)pos[0]+=70;
        if (distance(pos,p.pos)>=15) {this.addShade(pos); this.event('shade_spawned',{id:this.shades.at(-1).id});}
      }
    }
    if(this.night>=2&&this.random_drifters&&this.sim_tick%1200===0&&this.drifters.filter(d=>d.state!=='removed').length<2){const pos=clone(this.motePoints[Math.floor(this.random()*this.motePoints.length)]);const id=`D${this.nextDrifter++}`;this.drifters.push({id,pos,state:'idle',stolen:0,timer:0});}
    if (p.flames <= 0) this.finish('lost','no_flames');
    else if (this.time_left_s <= 0){if(this.lanterns.filter(l=>l.lit).length>=Math.ceil(this.lanterns.length*T.win_ratio)){this.score+=this.lanterns.filter(l=>l.lit).reduce((sum,l)=>sum+50+Math.floor(l.fuelUnits/60),0)+p.flames*50;this.finish('won','dawn_survived');}else this.finish('lost','dawn');}
    return this.events;
  }
  ejectShades(l){for(const s of this.shades)if(distance(s.pos,l.pos)<6){const dx=s.pos[0]-l.pos[0],dz=s.pos[2]-l.pos[2],d=Math.hypot(dx,dz)||1;s.pos[0]=l.pos[0]+(dx||1)/d*6;s.pos[2]=l.pos[2]+dz/d*6;s.safe=30;if(s.state==='drain')s.state='wander';}}
  hit(by) {
    const p=this.player;
    if (by==='shade' && p.invuln) return;
    p.flames--;
    const dropped=by==='fall'?p.carried:Math.floor(p.carried*T.hit_drop_ratio);
    p.carried-=dropped;
    if(by==='shade')for(let i=0;i<dropped;i++) this.addMote([p.pos[0]+1.5*Math.cos(i*2.4),0,p.pos[2]+1.5*Math.sin(i*2.4)],'dropped',480);
    p.invuln=Math.round(T.invuln_s*60);
    if(by==='fall') {p.pos=[0,0,0];p.vel=[0,0,0];p.grounded=true;p.respawn=60;}
    this.event('player_hit',{by,flames:p.flames,dropped,...(by==='fall'?{lost:dropped}:{})});
  }
  finish(state,reason) {this.state=state;this.event('game_over',{result:state,reason});}
  snapshot() {
    const p=this.player;
    return {type:'snapshot',tick:this.tick,sim_tick:this.sim_tick,night:this.night,state:this.state,time_left_s:round(this.time_left_s),score:this.score,wind:this.wind,
      player:{pos:p.pos.map(x=>round(x)),vel:p.vel.map(x=>round(x)),grounded:p.grounded,invuln:p.invuln>0,dash_cd_s:round(p.dash_cd/60),pulse_cd_s:round(p.pulse_cd/60),charm_s:round(p.charm/60),flames:p.flames,carried:p.carried,capacity:Math.min(20,10+2*p.successful_lights)},
      lanterns:this.lanterns.map(l=>({id:l.id,pos:l.pos.map(x=>round(x)),lit:l.lit,deposited:l.deposited,fuel:round(l.fuelUnits/60,1),ever_lit:l.ever_lit,relit_count:l.relit_count})),
      shades:this.shades.map(s=>({id:s.id,pos:s.pos.map(x=>round(x)),state:s.state})),motes_active:this.motes.length,
      motes:this.motes.map(m=>({id:m.id,pos:m.pos.map(x=>round(x)),kind:m.kind,ttl_s:round(m.ttl/60)})),
      drifters:this.drifters.filter(d=>d.state!=='removed').map(d=>({id:d.id,pos:d.pos.map(x=>round(x)),state:d.state,stolen:d.stolen})),
      charms:this.charms.map(c=>({id:c.id,available:c.available,respawn_s:round(c.respawn/60)}))};
  }
}
