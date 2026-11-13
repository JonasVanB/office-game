// Office chair Grand Prix on the roof next door. The emergency exit at the Landscape end (x = 0) leads over a steel bridge to a
// rooftop with a 110 m circuit. Four racing chairs stand on the grid: sit on one (E), Enter starts a 3-lap race for everyone on
// the grid (alone = a time trial against the ghost of your best lap), P is free practice.
//
// Driving: W / ↑ push off · S / ↓ brake · A D / ← → steer · hold Shift or Space while steering = drift: the chair slides and
// spins further into the corner, and letting go gives a boost that grows with how long you held it. Orange arrows on the
// track boost too. The gravel beside the track is slow. Touch: the chair rolls by itself; ◀ ▶ steer, plus Drift and Brake.
//
// Network: everyone drives their own chair (positions travel with presence as usual). rc = {g: grid slot, ph, go: shared start
// time, lap, pr: progress, ft: finish time, bl: best lap, sp: chair spin}. Chairs that touch push each other away.
import {sound, play} from './sound.js';

const DECK = {x0: -50, x1: -5, z0: -10, z1: 32}, BRIDGE = {x0: -5, x1: -0.25, z0: 5.6, z1: 7.4}, DOOR = {z: 6.5};
const PTS = [[-15, -3], [-28, -4], [-39, -5], [-45, 0], [-44, 7], [-38, 11], [-33, 15], [-32, 21], [-28, 27], [-21, 27], [-17, 21], [-14, 13], [-10, 6], [-10, 0]];
const HW = 2.2, N = 440, LAPS = 3, COUNT = 4.5, SEAT = 0.48, EYE = 1.2;
const VMAX = 8.4, VGRAVEL = 3.4, VBOOST = 3.2;
const COLORS = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047], CSS_COL = ['#e53935', '#1e88e5', '#fdd835', '#43a047'];
const PADS = [0.27, 0.52, 0.8];   // boost pads, as a fraction of the lap

let G, THREE, S = [], LEN = 0, GRID = [], chairs = [], ghostChair, cv, g2, card, toast, pads, mapPath = null;
let me = null, keysDown = {}, touch = {l: false, r: false, drift: false, brake: false}, best = null, ghost = null, quitArm = 0, baseFov = 0, roll = null;
try { const o = JSON.parse(localStorage.getItem('office.race') || '{}'); best = o.best || null; ghost = o.ghost || null; } catch (e) {}
const save = () => { try { localStorage.setItem('office.race', JSON.stringify({best, ghost})); } catch (e) {} };
const isTouch = () => !!window.__isTouch;
const now = () => window.__serverNow ? window.__serverNow() : Date.now();
const players = () => (G.mp && G.mp.players) ? G.mp.players() : [];
const myKey = () => G.mp ? G.mp.myKey : '';
const myName = () => G.mp && G.mp.myName ? G.mp.myName() : 'You';
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fmt = ms => ms == null ? '–' : (ms/1000).toFixed(2) + ' s';
function el(tag, css, parent){ const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; }

// ---------- the track: a closed curve through PTS, sampled into N points ----------
function buildSpline(){
  const cr = (a, b, c, d, t) => 0.5*((2*b) + (-a + c)*t + (2*a - 5*b + 4*c - d)*t*t + (-a + 3*b - 3*c + d)*t*t*t), n = PTS.length, raw = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < 60; k++){ const t = k/60, a = PTS[(i + n - 1) % n], b = PTS[i], c = PTS[(i + 1) % n], d = PTS[(i + 2) % n]; raw.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)]); }
  const cum = [0]; for (let i = 1; i <= raw.length; i++){ const a = raw[i - 1], b = raw[i % raw.length]; cum.push(cum[i - 1] + Math.hypot(a[0] - b[0], a[1] - b[1])); }
  LEN = cum[raw.length];
  // resample evenly; index 0 = the start / finish line
  const at = d => { d = ((d % LEN) + LEN) % LEN; let lo = 0, hi = raw.length; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
    const a = raw[lo], b = raw[(lo + 1) % raw.length], f = (d - cum[lo])/((cum[lo + 1] - cum[lo]) || 1); return [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f]; };
  const LINE = 9;   // metres after the first control point
  for (let i = 0; i < N; i++){ const p = at(LINE + i/N*LEN), q = at(LINE + (i + 0.5)/N*LEN), r = at(LINE + (i - 0.5)/N*LEN), l = Math.hypot(q[0] - r[0], q[1] - r[1]) || 1;
    S.push({x: p[0], z: p[1], tx: (q[0] - r[0])/l, tz: (q[1] - r[1])/l}); }
  // grid: two rows of two, behind the line
  for (let k = 0; k < 4; k++){ const i = ((N - Math.round((2.6 + Math.floor(k/2)*2.4)/LEN*N)) % N + N) % N, s = S[i], side = k % 2 ? 1 : -1;
    GRID.push({x: s.x - s.tz*side*1.0, z: s.z + s.tx*side*1.0, yaw: Math.atan2(-s.tx, -s.tz), i}); }
}
function nearest(x, z){ let bi = 0, bd = 1e9; for (let i = 0; i < N; i++){ const s = S[i], d = (s.x - x)*(s.x - x) + (s.z - z)*(s.z - z); if (d < bd){ bd = d; bi = i; } } return {i: bi, d: Math.sqrt(bd)}; }

// ---------- building the rooftop ----------
function tex(w, h, draw, rx = 1, ry = 1){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; }
function boxMesh(x0, x1, y0, y1, z0, z1, m){ const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); b.position.set((x0 + x1)/2, (y0 + y1)/2, (z0 + z1)/2); G.scene.add(b); return b; }
function ribbon(off0, off1, y, m, vScale){
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++){ const s = S[i % N], nx = -s.tz, nz = s.tx;
    pos.push(s.x + nx*off0, y, s.z + nz*off0, s.x + nx*off1, y, s.z + nz*off1); uv.push(0, i/N*vScale, 1, i/N*vScale);
    if (i < N){ const a = i*2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const me2 = new THREE.Mesh(g, m); G.scene.add(me2); return me2;
}
function chairModel(color){
  const g = new THREE.Group(), M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.6}, o || {}));
  const dark = M(0x23262b), col = M(color, {roughness: 0.75}), metal = M(0xb9bec6, {metalness: 0.6, roughness: 0.35});
  const add = (geo, m, x, y, z, ry) => { const b = new THREE.Mesh(geo, m); b.position.set(x, y, z); if (ry) b.rotation.y = ry; g.add(b); return b; };
  for (let k = 0; k < 5; k++){ const a = k/5*Math.PI*2; add(new THREE.BoxGeometry(0.05, 0.035, 0.3), dark, Math.sin(a)*0.15, 0.075, Math.cos(a)*0.15, a); add(new THREE.SphereGeometry(0.035, 8, 6), dark, Math.sin(a)*0.3, 0.035, Math.cos(a)*0.3); }
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.33, 8), metal, 0, 0.25, 0);
  add(new THREE.BoxGeometry(0.48, 0.07, 0.46), col, 0, SEAT - 0.035, 0);
  add(new THREE.BoxGeometry(0.46, 0.56, 0.06), col, 0, SEAT + 0.36, 0.235);             // backrest (behind you: forward is −z)
  add(new THREE.BoxGeometry(0.05, 0.3, 0.05), dark, 0, SEAT + 0.08, 0.24);
  for (const sx of [-1, 1]){ add(new THREE.BoxGeometry(0.045, 0.2, 0.045), dark, sx*0.27, SEAT + 0.1, 0.08); add(new THREE.BoxGeometry(0.06, 0.035, 0.3), dark, sx*0.27, SEAT + 0.21, -0.02); }
  return g;
}
function buildWorld(){
  const D = DECK, mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.9}, o || {}));
  // the building under the track, and its roof
  const facade = tex(128, 128, (g, s) => { g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, s, s); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++){ g.fillStyle = (r*7 + k*3) % 5 === 0 ? '#dfe6ea' : '#4d5a65'; g.fillRect(k*32 + 6, r*32 + 8, 20, 17); } }, 9, 3);
  boxMesh(D.x0, D.x1, -13, -0.06, D.z0, D.z1, new THREE.MeshStandardMaterial({map: facade, roughness: 0.85}));
  const gravel = tex(128, 128, (g, s) => { g.fillStyle = '#8d8a84'; g.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++){ const v = 110 + Math.random()*70 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(Math.random()*s, Math.random()*s, 2, 2); } }, 22, 21);
  boxMesh(D.x0, D.x1, -0.06, 0, D.z0, D.z1, new THREE.MeshStandardMaterial({map: gravel, roughness: 1}));
  // parapet with a rail all around (open where the bridge lands)
  const wall = mat(0xc9ccd0, {roughness: 0.7}), rail = mat(0x5f6670, {metalness: 0.5, roughness: 0.4}), C = G.colliders;
  const edge = (x0, x1, z0, z1) => { boxMesh(x0, x1, 0, 0.55, z0, z1, wall); boxMesh(x0, x1, 0.95, 1.0, z0, z1, rail); C.push([x0, x1, z0, z1, 0]); };
  edge(D.x0, D.x1, D.z0, D.z0 + 0.2); edge(D.x0, D.x1, D.z1 - 0.2, D.z1); edge(D.x0, D.x0 + 0.2, D.z0, D.z1);
  edge(D.x1 - 0.2, D.x1, D.z0, BRIDGE.z0); edge(D.x1 - 0.2, D.x1, BRIDGE.z1, D.z1);
  for (let x = D.x0 + 0.1; x <= D.x1; x += 2.5) for (const z of [D.z0 + 0.1, D.z1 - 0.1]) boxMesh(x - 0.03, x + 0.03, 0.55, 0.95, z - 0.03, z + 0.03, rail);
  for (let z = D.z0 + 0.1; z <= D.z1; z += 2.5) for (const x of [D.x0 + 0.1, D.x1 - 0.1]){ if (x > D.x1 - 1 && z > BRIDGE.z0 - 0.2 && z < BRIDGE.z1 + 0.2) continue; boxMesh(x - 0.03, x + 0.03, 0.55, 0.95, z - 0.03, z + 0.03, rail); }
  // the fire-escape bridge from the emergency door
  const B = BRIDGE, grate = tex(64, 64, (g, s) => { g.fillStyle = '#5c636b'; g.fillRect(0, 0, s, s); g.strokeStyle = '#2f343a'; g.lineWidth = 3; for (let i = 0; i <= s; i += 16){ g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); } }, 10, 4);
  boxMesh(B.x0, B.x1, -0.1, 0, B.z0, B.z1, new THREE.MeshStandardMaterial({map: grate, metalness: 0.5, roughness: 0.5}));
  for (const z of [B.z0, B.z1]){ boxMesh(B.x0, B.x1, 1.0, 1.05, z - 0.025, z + 0.025, rail); boxMesh(B.x0, B.x1, 0.5, 0.53, z - 0.015, z + 0.015, rail); boxMesh(B.x0, B.x1, -0.35, -0.1, z - 0.06, z + 0.06, rail);
    for (let x = B.x0; x <= B.x1 + 0.01; x += (B.x1 - B.x0)/4) boxMesh(x - 0.025, x + 0.025, 0, 1.0, z - 0.025, z + 0.025, rail); }
  C.push([B.x0 - 0.3, B.x1 + 0.3, B.z0 - 0.2, B.z0, 0], [B.x0 - 0.3, B.x1 + 0.3, B.z1, B.z1 + 0.2, 0]);
  // green "exit" light above the door on the outside, and a sign pointing at the track
  boxMesh(-0.33, -0.27, 2.2, 2.4, 6.2, 6.8, new THREE.MeshBasicMaterial({color: 0x2fbf6a}));
  // asphalt, kerbs, the line
  const asphalt = tex(64, 256, (g, w, h) => { g.fillStyle = '#34373c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++){ const v = 45 + Math.random()*30 | 0; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(Math.random()*w, Math.random()*h, 2, 2); }
    g.fillStyle = '#e9e7df'; g.fillRect(w/2 - 1, 0, 2, h*0.5); g.fillRect(1, 0, 2, h); g.fillRect(w - 3, 0, 2, h); }, 1, 1);
  ribbon(-HW, HW, 0.012, new THREE.MeshStandardMaterial({map: asphalt, roughness: 0.95}), 44);
  const kerb = tex(16, 64, (g, w, h) => { g.fillStyle = '#d32f2f'; g.fillRect(0, 0, w, h/2); g.fillStyle = '#f4f4f0'; g.fillRect(0, h/2, w, h/2); }, 1, 1), km = new THREE.MeshStandardMaterial({map: kerb, roughness: 0.8});
  ribbon(-HW - 0.35, -HW, 0.02, km, 90); ribbon(HW, HW + 0.35, 0.02, km, 90);
  const s0 = S[0], lineT = tex(64, 16, (g, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++){ g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i*8, j*8, 8, 8); } }, 1, 1);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(HW*2, 0.7), new THREE.MeshBasicMaterial({map: lineT})); line.rotation.order = 'YXZ'; line.rotation.y = Math.atan2(-s0.tx, -s0.tz); line.rotation.x = -Math.PI/2; line.position.set(s0.x, 0.022, s0.z); G.scene.add(line);
  // the start gantry
  const post = mat(0x2b2f36, {metalness: 0.4, roughness: 0.5}), banner = tex(512, 64, (g, w, h) => { g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OFFICE CHAIR GRAND PRIX', w/2, h/2 + 2); }, 1, 1);
  const gy = Math.atan2(-s0.tx, -s0.tz), gan = new THREE.Group(); gan.position.set(s0.x, 0, s0.z); gan.rotation.y = gy; G.scene.add(gan);
  for (const sx of [-1, 1]){ const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.3, 0.14), post); p.position.set(sx*(HW + 0.6), 1.65, 0); gan.add(p); }
  const bm = new THREE.Mesh(new THREE.BoxGeometry(HW*2 + 1.4, 0.7, 0.1), new THREE.MeshBasicMaterial({map: banner})); bm.position.set(0, 3.0, 0); gan.add(bm);
  lights = [-1.2, -0.6, 0, 0.6, 1.2].map(x => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({color: 0x331111})); l.position.set(x, 2.45, 0.1); gan.add(l); return l; });
  // boost pads
  const chev = tex(64, 64, (g, w, h) => { g.fillStyle = '#ff9800'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff3'; g.fillStyle = '#fff'; for (const y of [8, 34]){ g.beginPath(); g.moveTo(6, y + 22); g.lineTo(32, y); g.lineTo(58, y + 22); g.lineTo(58, y + 12); g.lineTo(32, y - 10 + 2); g.lineTo(6, y + 12); g.closePath(); g.fill(); } }, 1, 1);
  for (const f of PADS){ const s = S[Math.round(f*N) % N], p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({map: chev})); p.rotation.order = 'YXZ'; p.rotation.y = Math.atan2(-s.tx, -s.tz); p.rotation.x = -Math.PI/2; p.position.set(s.x, 0.024, s.z); G.scene.add(p); }
  // tyre stacks on the outside of the corners, cones on the inside (instanced: two draw calls)
  const tyres = [], cones = [];
  for (let i = 0; i < N; i += 4){ const a = S[(i + N - 6) % N], b = S[(i + 6) % N], s = S[i], turn = a.tx*b.tz - a.tz*b.tx; if (Math.abs(turn) < 0.2) continue;
    const out = turn > 0 ? -1 : 1, nx = -s.tz, nz = s.tx; tyres.push([s.x + nx*out*(HW + 1.0), s.z + nz*out*(HW + 1.0)]); if (i % 8 === 0) cones.push([s.x - nx*out*(HW + 0.6), s.z - nz*out*(HW + 0.6)]); }
  const tg = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), tm = new THREE.InstancedMesh(tg, mat(0x1c1d20, {roughness: 0.95}), tyres.length*3), M4 = new THREE.Matrix4();
  tyres.forEach((t, i) => { for (let k = 0; k < 3; k++){ M4.makeTranslation(t[0], 0.1 + k*0.2, t[1]); tm.setMatrixAt(i*3 + k, M4); } }); G.scene.add(tm);
  const cm = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.42, 10), mat(0xff6d00, {roughness: 0.6}), cones.length); cones.forEach((c, i) => { M4.makeTranslation(c[0], 0.21, c[1]); cm.setMatrixAt(i, M4); }); G.scene.add(cm);
  // a few rooftop things in the infield
  for (const [x, z, w, h] of [[-25, 10, 3, 1.4], [-38, 22, 2.4, 1.1], [-22, 2.5, 2, 0.9]]){ boxMesh(x - w/2, x + w/2, 0, h, z - w/3, z + w/3, mat(0xaeb3b9, {metalness: 0.3, roughness: 0.6})); C.push([x - w/2, x + w/2, z - w/3, z + w/3, 0]); OBST.push([x - w/2, x + w/2, z - w/3, z + w/3]); }
  // the four racing chairs on the grid
  GRID.forEach((gp, k) => { const c = chairModel(COLORS[k]); c.position.set(gp.x, 0, gp.z); c.rotation.y = gp.yaw; G.scene.add(c); chairs.push(c); });
  ghostChair = chairModel(0xffffff); ghostChair.traverse(o => { if (o.material){ o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.3; o.material.depthWrite = false; } }); ghostChair.visible = false; G.scene.add(ghostChair);
}
let lights = [], OBST = [];

// ---------- who is racing ----------
function everyone(){
  const list = players().filter(p => p.rc && (p.l || 0) === 0).map(p => ({key: p.key, name: p.name, rc: p.rc, x: p.x, z: p.z}));
  if (me) list.push({key: myKey() || 'me', name: myName(), rc: G.state.rc || {g: me.slot, ph: me.ph}, mine: true, x: G.state.x, z: G.state.z});
  return list;
}
const slotTaken = k => players().some(p => p.rc && p.rc.g === k);
const outside = () => { const s = G.state; return s.lv === 0 && s.x < -0.2 && Math.abs(s.y || 0) < 0.6; };
function nearSlot(){ if (!outside()) return -1; const s = G.state; let b = -1, bd = 1.1; GRID.forEach((gp, k) => { const d = Math.hypot(s.x - gp.x, s.z - gp.z); if (d < bd){ bd = d; b = k; } }); return b; }
const busy = () => players().some(p => p.rc && (p.rc.ph === 'count' || p.rc.ph === 'race') && p.rc.go && !p.rc.pm);
const field = () => me && me.go ? everyone().filter(e => e.rc.go === me.go && !e.rc.pm) : [];

// ---------- sitting down, starting, leaving ----------
function sit(k){
  try { sound.unlock(); } catch (e) {}
  me = {slot: k, ph: 'lobby'}; quitArm = 0; reset();
  G.controlLock = {aim(){}, press(){}, noPause: true}; G.eyeY = EYE;
  if (!baseFov) baseFov = G.camera.fov;
  renderLobby(); if (pads) pads.style.display = 'none';
}
function reset(){
  const gp = GRID[me.slot]; Object.assign(me, {x: gp.x, z: gp.z, h: gp.yaw, vx: 0, vz: 0, spin: 0, drift: false, driftT: 0, boost: 0, lap: 0, sector: 0, lapStart: 0, laps: [], rec: [], recT: 0, wrong: 0,
    hits: 0, driftBoosts: 0, padT: 0, result: null, go: 0, practice: false, bestLap: null, flash: null, endAt: 0, winDone: false});
  G.setView(gp.x, gp.z, gp.yaw, -0.06);
}
function leave(){
  if (!me) return; const k = me.slot; me = null; G.controlLock = null; G.eyeY = null; G.state.rc = null;
  card.style.display = 'none'; if (pads) pads.style.display = 'none'; g2.clearRect(0, 0, cv.width, cv.height);
  if (baseFov){ G.camera.fov = baseFov; G.camera.updateProjectionMatrix(); }
  const gp = GRID[k]; chairs[k].position.set(gp.x, 0, gp.z); chairs[k].rotation.y = gp.yaw; ghostChair.visible = false;
  // stand next to the chair
  const v = G.getView(); G.setView(Math.max(DECK.x0 + 1, Math.min(DECK.x1 - 1, gp.x + Math.cos(gp.yaw)*0.9)), Math.max(DECK.z0 + 1, Math.min(DECK.z1 - 1, gp.z - Math.sin(gp.yaw)*0.9)), v.yaw, 0);
  rollVol(0, 0);
}
function start(practice){
  if (!me || me.ph !== 'lobby') return;
  if (!practice && busy()){ say('A race is on: wait for the finish, or press P to practise'); return; }
  begin(practice ? now() : now() + COUNT*1000, practice);
}
function begin(go, practice){
  reset(); Object.assign(me, {ph: practice ? 'race' : 'count', go, practice: !!practice, lapStart: go});
  card.style.display = 'none'; if (pads) pads.style.display = 'flex';
  try { sound.unlock(); } catch (e) {}
}
function toLobby(){ if (!me) return; me.ph = 'lobby'; reset(); if (pads) pads.style.display = 'none'; renderLobby(); }
function say(t){ toast.textContent = t; toast.style.display = 'block'; clearTimeout(say.t); say.t = setTimeout(() => { toast.style.display = 'none'; }, 2400); }

// ---------- driving ----------
function drive(dt, keys){
  const f = me, t = now(), racing = f.ph === 'race';
  let steer = 0, gas = 0, brake = 0;
  if (racing){
    if (keys.KeyA || keys.ArrowLeft || touch.l) steer += 1; if (keys.KeyD || keys.ArrowRight || touch.r) steer -= 1;
    if (keys.KeyW || keys.ArrowUp || (isTouch() && !touch.brake)) gas = 1;
    if (keys.KeyS || keys.ArrowDown || touch.brake) brake = 1;
  }
  const wantDrift = racing && (keys.ShiftLeft || keys.ShiftRight || keysDown.Space || touch.drift);
  const fx = -Math.sin(f.h), fz = -Math.cos(f.h), rx = Math.cos(f.h), rz = -Math.sin(f.h);
  let vF = f.vx*fx + f.vz*fz, vS = f.vx*rx + f.vz*rz; const speed = Math.hypot(f.vx, f.vz);
  // drift: starts while steering at speed, ends when you let go (boost) or stop
  if (!f.drift && wantDrift && steer && speed > 3){ f.drift = true; f.driftT = 0; }
  if (f.drift){
    f.driftT += dt*(steer ? 1 : 0.4);
    if (!wantDrift || speed < 1.8){ f.drift = false; if (f.driftT > 0.45 && speed >= 1.8){ f.boost = Math.max(f.boost, Math.min(1.5, 0.35 + f.driftT*0.55)); f.driftBoosts++; f.flash = {text: f.driftT > 1.4 ? 'SUPER BOOST!' : 'Boost!', at: performance.now()}; play('whoosh', 0.8, 0); if (f.driftBoosts >= 4 && window.__ach) window.__ach('r_drift'); } f.driftT = 0; }
  }
  // steering: a chair turns on the spot, a bit heavier at speed, sharper while drifting
  f.h += steer*(f.drift ? 2.9 : 2.1)*Math.max(0.72, Math.min(1.15, 1.25 - speed/15))*dt;
  const near = nearest(f.x, f.z), onTrack = near.d < HW + 0.4, vmax = (onTrack ? VMAX : VGRAVEL) + (f.boost > 0 ? VBOOST : 0);
  if (gas) vF += (f.boost > 0 ? 11 : 6.2)*Math.max(0, 1 - vF/vmax)*dt;
  if (brake) vF -= (vF > 0 ? 10 : 3.5)*dt, vF = Math.max(vF, -2.4);
  vF *= 1 - (gas ? 0.12 : 0.55)*dt; if (vF > vmax) vF -= Math.min(vF - vmax, (onTrack ? 5 : 11)*dt);
  vS *= Math.exp(-(f.drift ? 1.3 : 7.5)*dt);
  f.boost = Math.max(0, f.boost - dt);
  const fx2 = -Math.sin(f.h), fz2 = -Math.cos(f.h), rx2 = Math.cos(f.h), rz2 = -Math.sin(f.h);
  f.vx = fx2*vF + rx2*vS; f.vz = fz2*vF + rz2*vS;
  let x = f.x + f.vx*dt, z = f.z + f.vz*dt;
  // the parapet and the rooftop boxes: bounce off
  const R = 0.36, bump = (nx, nz) => { const d = f.vx*nx + f.vz*nz; if (d < 0){ f.vx -= 1.5*d*nx; f.vz -= 1.5*d*nz; if (d < -1.5){ play('thud', Math.min(1, -d/6), 0, true); f.hits++; } } };
  if (x < DECK.x0 + 0.2 + R){ x = DECK.x0 + 0.2 + R; bump(1, 0); } if (x > DECK.x1 - 0.2 - R){ x = DECK.x1 - 0.2 - R; bump(-1, 0); }
  if (z < DECK.z0 + 0.2 + R){ z = DECK.z0 + 0.2 + R; bump(0, 1); } if (z > DECK.z1 - 0.2 - R){ z = DECK.z1 - 0.2 - R; bump(0, -1); }
  for (const o of OBST) if (x > o[0] - R && x < o[1] + R && z > o[2] - R && z < o[3] + R){
    const dl = x - (o[0] - R), dr = (o[1] + R) - x, dn = z - (o[2] - R), df = (o[3] + R) - z, m = Math.min(dl, dr, dn, df);
    if (m === dl){ x = o[0] - R; bump(-1, 0); } else if (m === dr){ x = o[1] + R; bump(1, 0); } else if (m === dn){ z = o[2] - R; bump(0, -1); } else { z = o[3] + R; bump(0, 1); } }
  // other chairs in the same race
  if (racing) for (const e of field()){ if (e.mine || e.rc.ph === 'lobby') continue; const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
    if (d < 0.78 && d > 0.01){ const nx = dx/d, nz = dz/d; x = e.x + nx*0.78; z = e.z + nz*0.78; const into = f.vx*nx + f.vz*nz; if (into < 0){ f.vx -= 1.3*into*nx; f.vz -= 1.3*into*nz; } f.vx += nx*0.8; f.vz += nz*0.8; if (!f.bumpT || t - f.bumpT > 400){ f.bumpT = t; play('thud', 0.5, 0); } } }
  f.x = x; f.z = z;
  f.spin += ((f.drift ? steer*0.75 : 0) - f.spin)*Math.min(1, dt*6);
  // boost pads
  if (racing && t > f.padT) for (const p of PADS){ const s = S[Math.round(p*N) % N]; if (Math.hypot(x - s.x, z - s.z) < 1.35 && Math.hypot(f.vx, f.vz) > 1.5){ f.boost = Math.max(f.boost, 1.0); f.padT = t + 1200; f.flash = {text: 'Boost!', at: performance.now()}; play('whoosh', 0.9, 0); } }
  // laps: eight sectors that must be passed in order
  if (racing){
    const n2 = nearest(x, z), sec = Math.floor(n2.i/N*8), s = S[n2.i], along = f.vx*s.tx + f.vz*s.tz;
    f.wrong = along < -1.2 ? f.wrong + dt : 0; f.idx = n2.i;
    if (n2.d < HW + 3){
      if (f.sector < 7 && sec === f.sector + 1 && along > 0) f.sector = sec;
      else if (f.sector === 7 && sec === 0 && along > 0) lapDone(t);
    }
    f.recT += dt; if (f.recT >= 0.1){ f.recT = 0; f.rec.push([Math.round(x*100)/100, Math.round(z*100)/100, Math.round((f.h + f.spin)*100)/100]); }
  }
  const sp = Math.hypot(f.vx, f.vz);
  G.setView(f.x, f.z, f.h, -0.07 - Math.min(0.03, sp*0.003));
  G.eyeY = EYE + Math.sin(performance.now()/90)*0.004*sp;
  const want = baseFov + (f.boost > 0 ? 11 : 0) + sp*0.8; if (Math.abs(G.camera.fov - want) > 0.05){ G.camera.fov += (want - G.camera.fov)*Math.min(1, dt*5); G.camera.updateProjectionMatrix(); }
  const c = chairs[f.slot]; c.position.set(f.x, 0, f.z); c.rotation.y = f.h + f.spin;
  rollVol(Math.min(1, sp/VMAX)*(onTrack ? 0.5 : 0.8), f.drift ? 0.5 : 0);
}
function lapDone(t){
  const f = me, ms = t - f.lapStart; f.lapStart = t; f.sector = 0; f.lap++; f.laps.push(ms); f.driftBoosts = 0;
  const pb = !best || ms < best; f.bestLap = f.bestLap == null ? ms : Math.min(f.bestLap, ms);
  if (pb){ if (best && window.__ach) window.__ach('r_pb'); best = ms; ghost = f.rec.slice(0, 900); save(); }
  f.flash = {text: `${fmt(ms)}${pb ? ' · best!' : ''}`, at: performance.now(), big: true}; play('ding', 0.6, 0);
  f.rec = []; f.recT = 0;
  if (window.__ach){ window.__stat('raceLaps'); if (ms < 13000) window.__ach('r_fast'); }
  if (!f.practice && f.lap >= LAPS) finish(t);
}
function finish(t){
  const f = me; f.ph = 'end'; f.endAt = performance.now(); f.result = {ft: t - f.go, bl: f.bestLap};
  if (pads) pads.style.display = 'none';
  play('cheer', 0.7, 0);
  if (window.__ach){ window.__ach('r_first'); window.__stat('races'); if (f.hits === 0) window.__ach('r_clean'); window.__xp(15, 'Finished a chair race'); }
  renderResults();
}
function checkWin(){
  const f = me; if (!f || f.ph !== 'end' || f.winDone) return;
  const all = field(), done = all.every(e => e.rc.ph === 'end' || e.rc.ph === 'lobby' || e.rc.go !== f.go);
  if (!done && performance.now() - f.endAt < 20000){ if (Math.floor(performance.now()/700) !== f.rr){ f.rr = Math.floor(performance.now()/700); renderResults(); } return; }
  f.winDone = true; renderResults();
  if (all.length < 2) return;
  const others = all.filter(e => !e.mine).map(e => e.rc.ft || 1e12);
  if (f.result.ft < Math.min(...others)){ say('🏆 You won the Grand Prix!'); if (window.__ach){ window.__ach('r_win'); window.__xp(20, 'Won a chair race'); } }
}

// ---------- per frame ----------
function step(dt, keys){
  const f = me, t = now();
  if (f.ph === 'lobby'){
    const c = players().filter(p => p.rc && p.rc.ph === 'count' && !p.rc.pm && p.rc.go > t + 300 && (p.l || 0) === 0).sort((a, b) => a.rc.go - b.rc.go)[0];
    if (c) begin(c.rc.go, false);
    const ch = chairs[f.slot], gp = GRID[f.slot]; ch.position.set(gp.x, 0, gp.z); ch.rotation.y = gp.yaw;
    return;
  }
  if (f.ph === 'count'){
    const c = players().filter(p => p.rc && p.rc.ph === 'count' && !p.rc.pm && p.rc.go !== f.go && p.rc.go > t + 300 && (p.rc.go < f.go || (p.rc.go === f.go && p.key < myKey())))[0];
    if (c){ begin(c.rc.go, false); return; }
    if (t >= f.go){ f.ph = 'race'; f.lapStart = f.go; play('ding', 0.9, 0); }
    else { const n = Math.ceil((f.go - t)/1000); if (n !== f.beep && n <= 3){ f.beep = n; play('mouse', 1, 0); } }
  }
  drive(dt, keys);
}
function broadcast(){
  const f = me; if (!f){ G.state.rc = null; return; }
  if (f.ph === 'lobby'){ G.state.rc = {g: f.slot, ph: 'lobby', bl: best || 0}; return; }
  G.state.rc = {g: f.slot, ph: f.ph, go: f.go, pm: f.practice ? 1 : 0, lap: f.lap, pr: Math.round((f.lap + (f.sector === 0 && (f.idx || 0) > N/2 ? (f.idx || 0)/N - 1 : (f.idx || 0)/N))*100)/100, ft: f.result ? f.result.ft : 0,
    bl: f.bestLap || 0, sp: Math.round(f.spin*10)/10, bo: f.boost > 0 ? 1 : 0};
}
// rolling noise: one filtered noise loop, louder with speed (and a squeal while drifting)
function rollVol(v, squeal){
  const c = sound.ctx, out = sound.out; if (!c || !out) return;
  if (!roll){ if (v < 0.01) return;
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
    const mk = (type, freq, q) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(out); s.start(); return {g, fl}; };
    roll = {a: mk('lowpass', 260, 0.7), b: mk('bandpass', 2600, 6)}; }
  roll.a.g.gain.setTargetAtTime(v*0.5, c.currentTime, 0.08); roll.a.fl.frequency.setTargetAtTime(160 + v*500, c.currentTime, 0.1); roll.b.g.gain.setTargetAtTime(squeal*0.12, c.currentTime, 0.06);
}

// ---------- other racers (mp.js calls this for every avatar, every frame) ----------
function poseRacer(obj, rc, t){
  const U = obj.userData, L = U.limbs; if (!L) return;
  if (!rc){ if (U.raceChair){ obj.remove(U.raceChair); U.raceChair = null; } return; }
  if (!U.raceChair || U.raceSlot !== rc.g){ if (U.raceChair) obj.remove(U.raceChair); U.raceChair = chairModel(COLORS[rc.g | 0] || 0x888888); U.raceSlot = rc.g; obj.add(U.raceChair); }
  L.legL.rotation.x = L.legR.rotation.x = Math.PI/2*0.9; L.armL.rotation.x = L.armR.rotation.x = 0.75;
  const lift = SEAT + 0.06 - 0.9; obj.position.y += lift; U.raceChair.position.y = -lift; U.raceChair.rotation.y = 0;
  obj.rotation.y += +rc.sp || 0;
}

// ---------- my screen ----------
function draw(dt){
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W*dpr) || cv.height !== Math.round(H*dpr)){ cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, W, H);
  const f = me; if (!f || f.ph === 'lobby') return;
  const t = now(), sp = Math.hypot(f.vx, f.vz), small = W < 560;
  g2.textBaseline = 'middle';
  // boost: speed lines from the edges
  if (f.boost > 0){ g2.strokeStyle = 'rgba(255,255,255,.35)'; g2.lineWidth = 2; for (let i = 0; i < 26; i++){ const a = Math.random()*Math.PI*2, r0 = Math.max(W, H)*(0.42 + Math.random()*0.2), r1 = r0 + 60 + Math.random()*90; g2.beginPath(); g2.moveTo(W/2 + Math.cos(a)*r0, H/2 + Math.sin(a)*r0); g2.lineTo(W/2 + Math.cos(a)*r1, H/2 + Math.sin(a)*r1); g2.stroke(); } }
  // top: lap, time, place
  const all = field().sort((a, b) => (b.rc.ft ? 1e6 - b.rc.ft/1000 : b.rc.pr || 0) - (a.rc.ft ? 1e6 - a.rc.ft/1000 : a.rc.pr || 0)), place = all.findIndex(e => e.mine) + 1;
  const lapMs = f.ph === 'race' ? t - f.lapStart : 0, total = f.ph === 'race' ? t - f.go : f.result ? f.result.ft : 0;
  const bw = small ? 250 : 330, bx = W/2 - bw/2, by = small ? 196 : 64;   // under the clock, the level pill and the ticket tracker
  g2.fillStyle = 'rgba(20,24,30,.7)'; g2.fillRect(bx, by, bw, 46); g2.fillStyle = CSS_COL[f.slot]; g2.fillRect(bx, by, 4, 46);
  g2.fillStyle = '#fff'; g2.textAlign = 'left'; g2.font = '800 17px system-ui, sans-serif'; g2.fillText(f.practice ? `Practice · lap ${f.lap + 1}` : `Lap ${Math.min(LAPS, f.lap + 1)} / ${LAPS}`, bx + 14, by + 15);
  g2.font = '600 12px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,255,255,.8)'; g2.fillText(`best ${fmt(best)}`, bx + 14, by + 34);
  g2.textAlign = 'right'; g2.font = '800 17px system-ui, sans-serif'; g2.fillStyle = '#fff'; g2.fillText((lapMs/1000).toFixed(1) + ' s', bx + bw - 12, by + 15);
  g2.font = '600 12px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,255,255,.8)'; g2.fillText(f.practice ? '' : `total ${(total/1000).toFixed(1)} s`, bx + bw - 12, by + 34);
  if (!f.practice && all.length > 1){ g2.textAlign = 'center'; g2.font = '900 22px system-ui, sans-serif'; g2.fillStyle = place === 1 ? '#ffe066' : '#fff'; g2.fillText(`${place}${['st', 'nd', 'rd'][place - 1] || 'th'}`, W/2, by + 15); g2.font = '600 11px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,255,255,.7)'; g2.fillText(`of ${all.length}`, W/2, by + 34); }
  // speed and drift charge
  const bot = isTouch() ? H - 170 : H - 60;
  g2.textAlign = 'right'; g2.font = '900 30px system-ui, sans-serif'; g2.lineWidth = 5; g2.strokeStyle = 'rgba(20,24,30,.7)'; g2.fillStyle = f.boost > 0 ? '#ffb74d' : '#fff';
  const kmh = String(Math.round(sp*3.6)); g2.strokeText(kmh, W - 64, bot); g2.fillText(kmh, W - 64, bot); g2.font = '700 12px system-ui, sans-serif'; g2.textAlign = 'left'; g2.strokeText('km/h', W - 58, bot + 5); g2.fillText('km/h', W - 58, bot + 5);
  if (f.drift){ const c = Math.min(1, f.driftT/1.6), w = 180; g2.fillStyle = 'rgba(20,24,30,.6)'; g2.fillRect(W/2 - w/2, bot - 6, w, 12); g2.fillStyle = c > 0.85 ? '#ff7043' : c > 0.28 ? '#4fc3f7' : '#cfd6de'; g2.fillRect(W/2 - w/2, bot - 6, w*c, 12);
    g2.textAlign = 'center'; g2.font = '800 12px system-ui, sans-serif'; g2.fillStyle = '#fff'; g2.fillText('DRIFT', W/2, bot - 18); }
  // messages
  g2.textAlign = 'center';
  if (f.flash){ const a = (performance.now() - f.flash.at)/1000, dur = f.flash.big ? 2.2 : 1; if (a > dur) f.flash = null; else { g2.globalAlpha = Math.min(1, (dur - a)*3); g2.font = `900 ${f.flash.big ? 34 : 26}px system-ui, sans-serif`; g2.lineWidth = 6; g2.strokeStyle = 'rgba(20,24,30,.8)'; g2.strokeText(f.flash.text, W/2, H*0.3 - a*20); g2.fillStyle = f.flash.big ? '#ffe066' : '#ffb74d'; g2.fillText(f.flash.text, W/2, H*0.3 - a*20); g2.globalAlpha = 1; } }
  if (f.wrong > 1){ g2.font = '900 34px system-ui, sans-serif'; g2.fillStyle = Math.floor(performance.now()/300) % 2 ? '#ff5252' : '#fff'; g2.lineWidth = 6; g2.strokeStyle = 'rgba(20,24,30,.8)'; g2.strokeText('WRONG WAY', W/2, H*0.42); g2.fillText('WRONG WAY', W/2, H*0.42); }
  if (f.ph === 'count'){ const left = (f.go - t)/1000, n = Math.ceil(left);
    g2.font = '900 96px system-ui, sans-serif'; g2.lineWidth = 8; g2.strokeStyle = 'rgba(20,24,30,.8)'; g2.fillStyle = '#fff'; const txt = n > 3 ? 'Ready' : String(n); g2.font = `900 ${n > 3 ? 54 : 96}px system-ui, sans-serif`; g2.strokeText(txt, W/2, H*0.45); g2.fillText(txt, W/2, H*0.45); }
  else if (f.ph === 'race' && !f.practice && t - f.go < 900){ g2.font = '900 96px system-ui, sans-serif'; g2.lineWidth = 8; g2.strokeStyle = 'rgba(20,24,30,.8)'; g2.fillStyle = '#69f0ae'; g2.strokeText('GO!', W/2, H*0.45); g2.fillText('GO!', W/2, H*0.45); }
  // map of the track with everyone on it
  const ms = small ? 1.9 : 2.6, mx = 14, my = isTouch() ? H - 270 : H - 150 - (small ? 0 : 30), ox = mx - DECK.x0*ms, oz = my - DECK.z0*ms*0 ;
  const px = x => mx + (x - DECK.x0)*ms, pz = z => my + (z - DECK.z0)*ms*0.78;
  g2.fillStyle = 'rgba(20,24,30,.5)'; g2.fillRect(mx - 4, my - 4, (DECK.x1 - DECK.x0)*ms + 8, (DECK.z1 - DECK.z0)*ms*0.78 + 8);
  g2.strokeStyle = 'rgba(255,255,255,.75)'; g2.lineWidth = 3; g2.beginPath(); for (let i = 0; i <= N; i += 4){ const s = S[i % N]; if (i) g2.lineTo(px(s.x), pz(s.z)); else g2.moveTo(px(s.x), pz(s.z)); } g2.stroke();
  g2.fillStyle = '#fff'; g2.fillRect(px(S[0].x) - 1.5, pz(S[0].z) - 5, 3, 10);
  for (const e of everyone()){ if (!e.mine && e.rc.go !== f.go) continue; g2.fillStyle = CSS_COL[e.rc.g | 0] || '#fff'; g2.beginPath(); g2.arc(px(e.x), pz(e.z), e.mine ? 5 : 4, 0, 7); g2.fill(); if (e.mine){ g2.strokeStyle = '#fff'; g2.lineWidth = 1.5; g2.stroke(); } }
  // start lights on the gantry
  void ox; void oz;
}
function gantry(){
  const t = now(), live = everyone().filter(e => e.rc.go && !e.rc.pm && (e.rc.ph === 'count' || e.rc.ph === 'race')), go = live.length ? Math.max(...live.map(e => e.rc.go)) : 0, left = go ? (go - t)/1000 : 99;
  lights.forEach((l, i) => { const col = left > 0 && left < 3.6 ? (left < 3 - i*0.6 + 0.6 ? 0xff1a1a : 0x331111) : (left <= 0 && left > -2.5 ? 0x22ff66 : 0x331111); if (l.userData.c !== col){ l.userData.c = col; l.material.color.setHex(col); } });
}
function drawGhost(){
  const f = me; if (!f || f.ph !== 'race' || !ghost || !ghost.length){ ghostChair.visible = false; return; }
  const k = (now() - f.lapStart)/100, i = Math.floor(k), a = ghost[i], b = ghost[i + 1]; if (!a || !b){ ghostChair.visible = false; return; }
  const u = k - i; ghostChair.visible = Math.hypot(a[0] - f.x, a[1] - f.z) > 1.2; ghostChair.position.set(a[0] + (b[0] - a[0])*u, 0, a[1] + (b[1] - a[1])*u); ghostChair.rotation.y = a[2];
}

// ---------- menus ----------
function setCard(html, wire){ card.style.display = 'block'; if (html === card.__html) return; card.innerHTML = card.__html = html; wire(); }
const onBtn = (sel, fn) => card.querySelectorAll(sel).forEach(b => { const go = e => { e.preventDefault(); e.stopPropagation(); fn(b); }; b.addEventListener('click', go); b.addEventListener('touchend', go); });
function renderLobby(){
  if (!me || me.ph !== 'lobby') return;
  const on = everyone().filter(e => !e.mine), t = isTouch();
  const who = on.length ? on.map(e => `<span style="display:inline-block;margin:2px 6px 0 0;padding:1px 8px;border-radius:10px;background:${CSS_COL[e.rc.g | 0]};color:#fff;font-size:12px;font-weight:600">${esc(e.name)}${e.rc.ph !== 'lobby' ? ' · on track' : ''}</span>`).join('') : '<span style="opacity:.6">Nobody else yet: you race the ghost of your best lap</span>';
  setCard(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:14px;height:14px;border-radius:4px;background:${CSS_COL[me.slot]}"></span><b style="font-size:17px">Chair Grand Prix · chair ${me.slot + 1}</b></div>`
    + `<div style="font-size:13px;color:#454b55;margin-bottom:8px">${LAPS} laps around the roof. Your best lap: <b style="color:#1d2229">${fmt(best)}</b></div>`
    + `<div style="font-size:12px;color:#454b55;margin-bottom:10px">On the grid: ${who}</div>`
    + `<button type="button" data-go style="width:100%;font-size:16px;padding:10px;border:0;border-radius:10px;background:#2f5d9e;color:#fff;font-weight:600">${busy() ? 'Race in progress…' : 'Start the race' + (t ? '' : ' (Enter)')}</button>`
    + `<button type="button" data-pr style="width:100%;margin-top:6px;font-size:14px;padding:8px;border:0;border-radius:10px;background:#e8ebef;color:#1d2229">Free practice${t ? '' : ' (P)'}</button>`
    + (t ? `<button type="button" data-leave style="width:100%;margin-top:6px;font-size:14px;padding:8px;border:0;border-radius:10px;background:#e8ebef;color:#1d2229">Get up</button>` : '')
    + `<div style="font-size:11px;color:#69707a;margin-top:8px;text-align:center">${t ? 'The chair rolls by itself · ◀ ▶ steer · hold Drift in a corner, let go for a boost' : 'W push · S brake · A D steer · hold Shift or Space in a corner to drift, let go for a boost · E get up'}</div>`,
    () => { onBtn('[data-go]', () => start(false)); onBtn('[data-pr]', () => start(true)); onBtn('[data-leave]', leave); });
}
function renderResults(){
  const f = me, r = f.result; if (!r) return;
  const all = field().sort((a, b) => (a.rc.ft || 1e12) - (b.rc.ft || 1e12) || (b.rc.pr || 0) - (a.rc.pr || 0)), t = isTouch();
  const rows = all.length > 1 ? `<div style="margin-top:10px;border-top:1px solid #e3e6ea;padding-top:8px">${all.map((e, i) => `<div style="display:flex;gap:8px;align-items:center;font-size:13px;${e.mine ? 'font-weight:700' : ''}"><span style="width:14px">${i + 1}</span><span style="width:10px;height:10px;border-radius:3px;background:${CSS_COL[e.rc.g | 0]}"></span><span style="flex:1">${esc(e.name)}</span><span>${e.rc.ft ? fmt(e.rc.ft) : 'still racing…'}</span></div>`).join('')}</div>` : '';
  setCard(`<div style="font-size:30px;line-height:1">🏁</div><h1 style="font-size:20px;margin:6px 0 2px;font-weight:600">Finished in ${fmt(r.ft)}</h1>`
    + `<div style="display:grid;grid-template-columns:auto auto;gap:2px 18px;color:#454b55;font-size:13px;margin-top:6px">`
    + f.laps.map((l, i) => `<span>Lap ${i + 1}</span><b style="color:#1d2229">${fmt(l)}${l === best ? ' · your best' : ''}</b>`).join('')
    + `<span>Railing hits</span><b style="color:#1d2229">${f.hits}</b></div>` + rows
    + `<button type="button" data-again style="margin-top:12px;width:100%;font-size:16px;padding:10px;border:0;border-radius:10px;background:#2f5d9e;color:#fff;font-weight:600">Back to the grid${t ? '' : ' (Enter)'}</button>`
    + `<button type="button" data-leave style="width:100%;margin-top:6px;font-size:14px;padding:8px;border:0;border-radius:10px;background:#e8ebef;color:#1d2229">Get up${t ? '' : ' (E)'}</button>`,
    () => { onBtn('[data-again]', toLobby); onBtn('[data-leave]', leave); });
}

// ---------- keys, E ----------
function onKey(e){
  if (!me) return;
  const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
  const down = e.type === 'keydown';
  if (e.code === 'Space'){ keysDown.Space = down; e.preventDefault(); e.stopImmediatePropagation(); if (down && !e.repeat && me.ph === 'lobby') start(false); return; }
  if (e.code === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); if (down && !e.repeat) use(); return; }
  if (!down || e.repeat) return;
  if (e.code === 'Enter' || e.code === 'NumpadEnter'){ e.preventDefault(); e.stopImmediatePropagation(); if (me.ph === 'lobby') start(false); else if (me.ph === 'end') toLobby(); return; }
  if (e.code === 'KeyP' && me.ph === 'lobby'){ e.preventDefault(); e.stopImmediatePropagation(); start(true); }
  if (e.code === 'KeyR' && me.ph === 'race' && me.practice){ toLobby(); }
}
function nearDoor(){
  const s = G.state; if (s.lv !== 0 || Math.abs(s.y || 0) > 0.6 || Math.abs(s.z - DOOR.z) > 0.75) return 0;
  if (s.x > 0 && s.x < 1.3) return 1; if (s.x < -0.2 && s.x > -1.6) return -1; return 0;
}
function use(){
  if (me){
    if (me.ph === 'lobby' || me.ph === 'end'){ leave(); return true; }
    if (performance.now() - quitArm < 2000){ leave(); return true; }
    quitArm = performance.now(); say(`Press ${isTouch() ? 'the prompt' : 'E or Esc'} again to get off the chair`); return true;
  }
  if (!G.state.started || G.controlLock) return false;
  const d = nearDoor();
  if (d === 1){ G.setView(-1.0, DOOR.z, Math.PI/2, 0); play('thud', 0.5, 0, true); if (window.__ach) window.__ach('r_exit'); return true; }
  if (d === -1){ G.setView(0.9, DOOR.z, -Math.PI/2, 0); play('thud', 0.5, 0, true); return true; }
  const k = nearSlot(); if (k < 0) return false;
  if (slotTaken(k)){ say('Someone is already on this chair'); return true; }
  sit(k); return true;
}
const failed = {};
function safe(what, fn){ try { fn(); } catch (e){ if (!failed[what]){ failed[what] = 1; console.error('race.js ' + what + ':', e); } } }
let acc = 0;
function tick(dt, keys){
  if (!G) return '';
  const here = G.state.lv === 0 && G.state.x < 6;   // only near the roof
  if (me){
    safe('step', () => step(dt, keys));
    if (me) safe('send', broadcast);
    if (me && me.ph === 'lobby'){ acc += dt; if (acc > 0.6){ acc = 0; renderLobby(); } }
    if (me && me.ph === 'end') safe('win', checkWin);
  } else G.state.rc = null;
  if (pads) document.body.classList.toggle('race-pads', !!me && pads.style.display === 'flex');
  safe('draw', () => draw(dt));
  if (here){ safe('ghost', drawGhost); safe('lights', gantry); for (let k = 0; k < 4; k++) if (!me || me.slot !== k) chairs[k].visible = !slotTaken(k); if (me) chairs[me.slot].visible = true; }
  if (me) return isTouch() && (me.ph === 'race' || me.ph === 'count') ? 'Tap twice to get off' : '';
  if (!G.state.started || G.controlLock) return '';
  const tap = isTouch() ? 'Tap to ' : 'Press E to ', d = nearDoor();
  if (d === 1) return tap + 'take the emergency exit to the rooftop track 🏁';
  if (d === -1) return tap + 'go back inside';
  const k = nearSlot(); if (k >= 0) return slotTaken(k) ? 'This chair is taken' : tap + 'sit on the racing chair 🪑';
  return '';
}

function init(){
  G = window.GAME; THREE = G.THREE; if (!G.colliders) return;
  buildSpline(); buildWorld();
  cv = el('canvas', 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2'); g2 = cv.getContext('2d');
  toast = el('div', 'position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:rgba(20,24,30,.8);color:#fff;border-radius:12px;padding:10px 16px;font-size:15px;pointer-events:none;text-align:center;max-width:86vw');
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:16px 18px 14px;width:min(380px,calc(100vw - 32px));box-sizing:border-box;line-height:1.4;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35);max-height:calc(100vh - 32px);overflow:auto');
  if (isTouch()){
    pads = el('div', 'position:fixed;left:0;right:0;bottom:56px;height:84px;display:none;z-index:3;justify-content:space-between;padding:0 10px;box-sizing:border-box;pointer-events:none');
    const grp = () => el('div', 'display:flex;gap:8px;pointer-events:auto', pads), btn = (parent, label, key, w) => { const b = el('div', `width:${w || 78}px;height:78px;border-radius:18px;background:rgba(20,24,30,.55);border:2px solid rgba(255,255,255,.7);color:#fff;font-size:${label.length > 2 ? 15 : 30}px;font-weight:700;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none`, parent); b.textContent = label;
      const set = on => e => { e.preventDefault(); e.stopPropagation(); touch[key] = on; b.style.background = on ? 'rgba(47,93,158,.9)' : 'rgba(20,24,30,.55)'; };
      b.addEventListener('touchstart', set(true), {passive: false}); b.addEventListener('touchend', set(false)); b.addEventListener('touchcancel', set(false)); };
    const L = grp(), R = grp(); btn(L, '◀', 'l'); btn(L, '▶', 'r'); btn(R, 'Brake', 'brake', 70); btn(R, 'Drift', 'drift', 70);
  }
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  addEventListener('blur', () => { keysDown = {}; touch.l = touch.r = touch.drift = touch.brake = false; });
  G.poseRacer = poseRacer;
  G.uses.unshift({tick, use});
}

window.RACE = {get me(){ return me; }, get S(){ return S; }, get grid(){ return GRID; }, get len(){ return LEN; }, start, get best(){ return best; }};   // for testing in the console
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
