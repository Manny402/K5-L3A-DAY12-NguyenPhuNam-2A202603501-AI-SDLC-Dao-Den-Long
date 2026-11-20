import contract from '../game.contract.json' with { type: 'json' };

export const T = contract.tuning;
const DT = 1 / 60;
const lanternPositions = [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]];
const clone = x => JSON.parse(JSON.stringify(x));
const round = (x, d = 3) => Number(x.toFixed(d));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const norm = (x, z) => { const l = Math.hypot(x, z); return l > 1 ? [x / l, z / l] : [x, z]; };
const polar = (r, deg) => [round(r * Math.cos(deg * Math.PI / 180)), 0, round(r * Math.sin(deg * Math.PI / 180))];
function rng(seed) { let n = seed >>> 0; return () => ((n = (1664525 * n + 1013904223) >>> 0) / 4294967296); }

export class Game {
  constructor({seed = 1, scenario = {}} = {}) {
    this.seed = seed;
    this.random = rng(seed);
    this.tick = 0;
    this.sim_tick = 0;
    this.state = 'playing';
    this.score = 0;
    this.time_left_s = scenario.time_left_s ?? T.night1_duration_s;
    this.player = {pos: clone(scenario.player?.pos ?? [0, 0, 0]), vel: [0, 0, 0], grounded: true, carried: scenario.player?.carried ?? 0, flames: scenario.player?.flames ?? T.flames, invuln: 0, pulse_cd: 0, facing: [0, 1]};
    this.lanterns = lanternPositions.map((pos, i) => ({id: `L${i + 1}`, pos: clone(pos), lit: false, deposited: 0}));
    for (const item of scenario.lanterns ?? []) {
      const lantern = this.lanterns.find(l => l.id === item.id);
      if (!lantern) throw new Error(`Unknown lantern ${item.id}`);
      Object.assign(lantern, clone(item));
    }
    this.motes = [];
    this.nextMote = 1;
    this.motePoints = [...Array.from({length: 8}, (_, i) => polar(12, i * 45)), ...Array.from({length: 16}, (_, i) => polar(33, i * 22.5))];
    this.random_motes = scenario.random_motes ?? true;
    if (scenario.motes) for (const pos of scenario.motes) this.addMote(pos);
    else if (this.random_motes) for (const pos of this.motePoints.slice(0, 20)) this.addMote(pos);
    this.shades = [];
    this.nextShade = 1;
    this.random_shades = scenario.random_shades ?? true;
    for (const shade of scenario.shades ?? []) this.addShade(shade.pos, shade.id);
    this.events = [];
    this.held = {move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false};
  }
  addMote(pos) { this.motes.push({id: `M${this.nextMote++}`, pos: clone(pos)}); }
  addShade(pos, id) { this.shades.push({id: id ?? `S${this.nextShade++}`, pos: clone(pos), state: 'wander', stun: 0, recoil: 0}); }
  event(name, data = {}) { this.events.push({type: 'event', tick: this.tick, name, data}); }
  step(input = {}) {
    if (this.state !== 'playing') return [];
    const prev = {...this.held};
    Object.assign(this.held, input);
    this.tick++;
    this.sim_tick++;
    this.events = [];
    this.time_left_s = Math.max(0, this.time_left_s - DT);
    const p = this.player;
    p.invuln = Math.max(0, p.invuln - 1);
    p.pulse_cd = Math.max(0, p.pulse_cd - 1);
    for (const s of this.shades) s.stun = Math.max(0, s.stun - 1);
    let [mx, mz] = norm(...this.held.move);
    const a = this.held.cam_yaw_deg * Math.PI / 180;
    [mx, mz] = [mx * Math.cos(a) + mz * Math.sin(a), -mx * Math.sin(a) + mz * Math.cos(a)];
    if (Math.hypot(mx, mz) > 0) p.facing = [mx, mz];
    p.vel[0] = mx * T.player_speed;
    p.vel[2] = mz * T.player_speed;
    if (this.held.jump && !prev.jump && p.grounded) { p.vel[1] = 7; p.grounded = false; }
    if (!p.grounded) p.vel[1] -= 20 * DT;
    for (let i = 0; i < 3; i++) p.pos[i] += p.vel[i] * DT;
    if (p.pos[1] <= 0 && distance(p.pos, [0, 0, 0]) <= 40) { p.pos[1] = 0; p.vel[1] = 0; p.grounded = true; }
    else if (distance(p.pos, [0, 0, 0]) > 40 && p.pos[1] === 0) p.grounded = false;
    if (p.pos[1] < -10) this.hit('fall');
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (p.carried < T.carry_capacity && distance(p.pos, m.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= 1.5) {
        this.motes.splice(i, 1); p.carried++; this.event('mote_picked', {carried: p.carried});
      }
    }
    if (this.held.interact && !prev.interact) {
      const l = this.lanterns.filter(l => !l.lit && distance(p.pos, l.pos) <= T.interact_radius).sort((a,b) => distance(p.pos,a.pos)-distance(p.pos,b.pos) || a.id.localeCompare(b.id))[0];
      if (l && p.carried) {
        const amount = Math.min(p.carried, T.lantern_cost - l.deposited);
        p.carried -= amount; l.deposited += amount;
        this.event('deposit', {lantern_id:l.id, amount, deposited:l.deposited});
        if (l.deposited >= T.lantern_cost) { l.lit = true; this.score += T.score.per_lantern; this.event('lantern_lit',{lantern_id:l.id}); }
      }
    }
    if (this.held.pulse && !prev.pulse && p.carried >= T.pulse_cost && p.pulse_cd === 0) {
      p.carried -= T.pulse_cost; p.pulse_cd = Math.round(T.pulse_cooldown_s * 60);
      const ids = [];
      for (const s of this.shades) if (Math.hypot(p.pos[0]-s.pos[0], p.pos[1]+0.8-s.pos[1], p.pos[2]-s.pos[2]) <= T.pulse_radius) {
        s.state = 'stunned'; s.stun = Math.round(T.pulse_stun_s * 60); ids.push(s.id); this.score += T.score.per_stun;
        const dx = s.pos[0]-p.pos[0], dz = s.pos[2]-p.pos[2], d = Math.hypot(dx,dz) || 1;
        s.pos[0] += (d === 1 && dx === 0 && dz === 0 ? 1 : dx/d) * T.pulse_push_m;
        s.pos[2] += dz/d * T.pulse_push_m;
      }
      this.event('pulse',{stunned_ids:ids});
    }
    for (const s of this.shades) {
      if (s.stun) continue;
      const d = distance(s.pos,p.pos);
      s.state = d <= 12 ? 'chase' : 'wander';
      if (s.state === 'chase' && d > 0) {
        const step = Math.min(T.shade_speed * DT, d);
        s.pos[0] += (p.pos[0]-s.pos[0])/d*step; s.pos[2] += (p.pos[2]-s.pos[2])/d*step;
      }
      if (!p.invuln && distance(s.pos,p.pos) <= T.shade_hit_radius && Math.abs(s.pos[1]-p.pos[1]) <= 1.5) {this.hit('shade'); break;}
    }
    if (this.random_motes && this.tick % 240 === 0 && this.motes.length < 30) {
      const vacant = this.motePoints.filter(pt => !this.motes.some(m => distance(m.pos,pt)<0.01));
      if (vacant.length) this.addMote(vacant[Math.floor(this.random()*vacant.length)]);
    }
    if (this.random_shades && this.tick >= 300 && (this.tick === 300 || (this.tick-300)%480===0) && this.shades.length < 6) {
      for (let i=0; i<(this.tick===300?2:1); i++) {
        const pos = polar(37, 15 + Math.floor(this.random()*12)*30);
        if (distance(pos,p.pos)>=15) {this.addShade(pos); this.event('shade_spawned',{id:this.shades.at(-1).id});}
      }
    }
    if (p.flames <= 0) this.finish('lost','no_flames');
    else if (this.lanterns.every(l=>l.lit)) { this.score += Math.floor(this.time_left_s)*T.score.per_second_left + p.flames*T.score.per_flame_left; this.finish('won','all_lit'); }
    else if (this.time_left_s <= 0) this.finish('lost','dawn');
    return this.events;
  }
  hit(by) {
    const p=this.player;
    if (by==='shade' && p.invuln) return;
    p.flames--;
    const dropped=by==='fall'?p.carried:Math.floor(p.carried*T.hit_drop_ratio);
    p.carried-=dropped;
    for(let i=0;i<dropped;i++) this.addMote([p.pos[0]+1.5*Math.cos(i*2.4),0,p.pos[2]+1.5*Math.sin(i*2.4)]);
    p.invuln=Math.round(T.invuln_s*60);
    if(by==='fall') {p.pos=[0,0,0];p.vel=[0,0,0];p.grounded=true;}
    this.event('player_hit',{by,flames:p.flames,dropped});
  }
  finish(state,reason) {this.state=state;this.event('game_over',{result:state,reason});}
  snapshot() {
    const p=this.player;
    return {type:'snapshot',tick:this.tick,sim_tick:this.sim_tick,state:this.state,time_left_s:round(this.time_left_s),score:this.score,
      player:{pos:p.pos.map(x=>round(x)),flames:p.flames,carried:p.carried},
      lanterns:this.lanterns.map(l=>({id:l.id,pos:l.pos.map(x=>round(x)),lit:l.lit,deposited:l.deposited})),
      shades:this.shades.map(s=>({id:s.id,pos:s.pos.map(x=>round(x)),state:s.state})),motes_active:this.motes.length};
  }
}
