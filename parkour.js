// Rooftop parkour: a time-trial course around and on top of the building (see parkour.md for the route and the numbers).
// The east emergency exit (x = 50, 4e verdiep) leads onto a fire-escape balcony with the start line. The route goes over the
// neighbour's roof, west along the side A facade (gantries + wall runs), up onto our flat roof, over the lift motor room onto
// the west curved roof and along its ridge, slides down the roof and drops onto a scaffold deck on side B, runs east along the
// side B scaffolding, climbs back onto the flat roof, crosses to the east curved roof, runs its ridge and takes a zipline back
// over the start to a finish pad on the neighbour's roof.
//
// While you are outside this module owns the controls (GAME.controlLock) and runs its own 3D movement: momentum running,
// jump with coyote time and a jump buffer, vaults, ledge grabs + mantles, wall runs, wall climbs (+ turn and kick off), slides,
// rolls and the zipline. Everything on the route you can touch is yellow.
//
// Keys: WASD move · Space jump (hold for higher) · C slide / crouch / roll on landing · Shift walk · R back to the last checkpoint ·
// hold R or Backspace: restart at the start · E (on the balcony) back inside. Touch: left half = move stick, Jump, Slide and ↺ buttons.
//
// Leaderboard: G.mp.parkour (mp.js) stores your best time per account in parkour2/<id> (Firebase) or localStorage (local test).
// Your best run is kept as a ghost in this browser (localStorage 'office.parkour2'). (v1 of the course, shorter, used parkour/.)
import {sound, play, loop} from './sound.js';

let G, THREE;
const SOL = [];                                    // solids: {x0, x1, y0, y1, z0, z1, hf?(z) top height, rail?, metal?}
const R = 0.3, H_STAND = 1.8, H_LOW = 0.9, EYE_STAND = 1.62, EYE_LOW = 0.78, HAND = 1.95;
const RUN0 = 7.0, RUN_MAX = 9.4, WALK = 2.4, CROUCH = 2.2, JUMP_V = 5.7, G_UP = 16, G_CUT = 34, G_DOWN = 23, AIR = 6;
const COYOTE = 0.12, BUFFER = 0.15, KILL_Y = -4.5;
const FAST = 45000, FLOW = 30000;                  // achievement times (progress.js says the same)
const DOOR_Z = 6.5;
const START = {x: 51.0, y: 0, z: 6.5, yaw: -Math.PI/2}, LINE_X = 52.0;
// checkpoints in order: a box you have to pass through, and where you come back after a fall
const CPS = [
  {name: 'Facade', x0: 37.5, x1: 42.0, z0: -1.4, z1: -0.2, y0: -1.2, y1: 1.5, at: {x: 41.6, y: -0.4, z: -0.64, yaw: Math.PI/2}, post: [40.9, -0.4, -1.05]},
  {name: 'Roof', x0: 19.0, x1: 22.3, z0: -0.4, z1: 13.4, y0: 2.9, y1: 4.6, at: {x: 21.6, y: 3.2, z: 5.6, yaw: Math.PI/2}, post: [21.0, 3.2, 3.2]},
  {name: 'Ridge', x0: 8.5, x1: 14.0, z0: 4.8, z1: 8.2, y0: 5.8, y1: 8.0, at: {x: 13.0, y: 6.38, z: 6.5, yaw: Math.PI/2}, post: [12.4, 6.38, 7.25]},
  {name: 'Drop', x0: 1.0, x1: 10.0, z0: 13.3, z1: 19.5, y0: -0.6, y1: 2.0, at: {x: 7.9, y: 0.3, z: 14.2, yaw: -Math.PI/2}, post: [9.7, 0.3, 19.2]},
  {name: 'Scaffold', x0: 20.6, x1: 23.4, z0: 13.2, z1: 15.0, y0: -0.6, y1: 2.0, at: {x: 21.0, y: 0.3, z: 13.85, yaw: -Math.PI/2}, post: [21.6, 0.3, 14.56]},
  {name: 'East ridge', x0: 36.5, x1: 40.0, z0: 4.8, z1: 8.2, y0: 5.8, y1: 8.5, at: {x: 37.2, y: 6.38, z: 6.5, yaw: -Math.PI/2}, post: [38.4, 6.38, 7.25]},
];
const FINISH = {x0: 57.2, x1: 61.5, z0: 8.8, z1: 10.6};             // on the neighbour's roof (y −0.8), at the end of the zipline
const ZIP = {a: [49.8, 8.3, 6.6], b: [59.3, 2.35, 9.7]}, ZIP_BRAKE = 3.6;   // the last 3.6 m of cable brake you down to ~3 m/s
const LB = new Map();                              // leaderboard: account id → {t, n, s}

let pk = null;                                     // you, while you are outside (null = inside / not playing)
let saved = {best: null, splits: null, ghost: null};
try { saved = Object.assign(saved, JSON.parse(localStorage.getItem('office.parkour2') || '{}')); localStorage.removeItem('office.parkour'); } catch (e) {}   // v1 (shorter course) times and ghost are gone
const store = () => { try { localStorage.setItem('office.parkour2', JSON.stringify(saved)); } catch (e) {} };
const inp = {f: 0, s: 0, jumpHeld: false, crouch: false, walk: false};
const touch = {id: null, x0: 0, y0: 0, x: 0, y: 0, jump: false, crouch: false};
let rDown = 0, hintEl, cv, g2, card, toast, pads, stick, boards = [], cpLamps = [], ghostMesh, cableMesh, failed = {};
const isTouch = () => !!window.__isTouch;
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fmt = ms => { if (ms == null) return '–'; const s = ms/1000, m = Math.floor(s/60); return m + ':' + (s - m*60).toFixed(2).padStart(5, '0'); };
const fmtD = ms => (ms < 0 ? '−' : '+') + (Math.abs(ms)/1000).toFixed(2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = u => u*u*(3 - 2*u);
function el(tag, css, parent){ const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; }

// ======================================================= the course =======================================================
// the curved roofs: outer skin over x −0.25…14 and 35…50.25 (the inside underside is 3.1 + 2.9·(1 − ((z − 6.5)/6.5)²))
const roofF = z => { const c = clamp(z, -0.32, 13.32); return 3.4 + 2.9*(1 - ((c - 6.5)/6.82)**2); };
const roofU = z => 3.1 + 2.9*(1 - ((z - 6.5)/6.5)**2);
const topAt = (s, x, z) => s.hf ? s.hf(z) : s.y1;
function solid(x0, x1, y0, y1, z0, z1, o){ const s = Object.assign({x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0, y1, z0: Math.min(z0, z1), z1: Math.max(z0, z1)}, o || {}); SOL.push(s); return s; }
function tex(w, h, draw, rx = 1, ry = 1){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; }
const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.85}, o || {}));
function box(x0, x1, y0, y1, z0, z1, m){ const b = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), m); b.position.set((x0 + x1)/2, (y0 + y1)/2, (z0 + z1)/2); G.scene.add(b); return b; }
function blk(x0, x1, y0, y1, z0, z1, m, o){ solid(x0, x1, y0, y1, z0, z1, o); return m ? box(x0, x1, y0, y1, z0, z1, m) : null; }
function rod(a, b, r, m){ const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(), c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), m);
  c.position.set((a[0] + b[0])/2, (a[1] + b[1])/2, (a[2] + b[2])/2); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); G.scene.add(c); return c; }
// a flat decal lying on a surface, its texture's "up" pointing along (dx, dz)
function decal(x, y, z, w, l, dx, dz, m){ const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), m); p.rotation.order = 'YXZ'; p.rotation.y = Math.atan2(-dx, -dz); p.rotation.x = -Math.PI/2; p.position.set(x, y + 0.012, z); G.scene.add(p); return p; }
// a vertical sign with a canvas texture, facing along (nx, nz)
function sign(x, y, z, w, h, nx, nz, map){ const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map, toneMapped: false})); p.rotation.y = Math.atan2(nx, nz); p.position.set(x, y, z); G.scene.add(p); return p; }

let YEL, CHEV, climbTex, wallPanelB;
function buildCourse(){
  YEL = mat(0xffc400, {emissive: 0x7a5200, roughness: 0.5});
  CHEV = new THREE.MeshBasicMaterial({transparent: true, depthWrite: false, toneMapped: false, map: tex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffcc1a';
    for (const y of [18, 62]){ g.beginPath(); g.moveTo(14, y + 40); g.lineTo(64, y); g.lineTo(114, y + 40); g.lineTo(114, y + 58); g.lineTo(64, y + 20); g.lineTo(14, y + 58); g.closePath(); g.fill(); } })});
  const grate = tex(64, 64, (g, s) => { g.fillStyle = '#5c636b'; g.fillRect(0, 0, s, s); g.strokeStyle = '#2f343a'; g.lineWidth = 3; for (let i = 0; i <= s; i += 16){ g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); } }, 1, 1);
  const grateM = w => { const t = grate.clone(); t.needsUpdate = true; t.repeat.set(w, 1); return new THREE.MeshStandardMaterial({map: t, metalness: 0.5, roughness: 0.5}); };
  const steel = mat(0x4d545c, {metalness: 0.55, roughness: 0.45}), concrete = mat(0xb9b6ae), darkMetal = mat(0x6d737a, {metalness: 0.4, roughness: 0.5}), white = mat(0xe4e2dc);
  const gravel = tex(128, 128, (g, s) => { g.fillStyle = '#8b8984'; g.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++){ const v = 105 + Math.random()*70 | 0; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(Math.random()*s, Math.random()*s, 2, 2); } }, 10, 6);
  const roofMat = new THREE.MeshStandardMaterial({map: gravel, roughness: 1});
  const facadeTex = tex(128, 128, (g, s) => { g.fillStyle = '#a6a39b'; g.fillRect(0, 0, s, s); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++){ g.fillStyle = (r*5 + k*3) % 7 === 0 ? '#e1e7ea' : '#4f5c67'; g.fillRect(k*32 + 6, r*32 + 8, 20, 17); } }, 5, 4);

  // ---------- our building as one solid block, the flat roof and the two curved roofs ----------
  solid(-0.25, 50.25, -13, 3.1, -0.25, 13.25);
  box(14, 35, 2.64, 3.2, -0.32, 13.32, roofMat); solid(14, 35, 2.64, 3.2, -0.32, 13.25);   // flat roof over x 14–35 (gravel on top); solid flush with the side B facade (wall runs there pass under the overhang)
  for (const [xa, xb] of [[14, 29.2], [30.8, 35]]) box(xa, xb, 3.2, 3.32, -0.34, -0.22, concrete);   // low upstand along side A (open at the climb)
  for (const [xa, xb] of [[14, 23.5], [25.1, 35]]) box(xa, xb, 3.2, 3.32, 13.22, 13.34, concrete);   // low upstand along side B (open at the side B climb)
  for (const x of [21, 28]) for (const [z0, z1] of [[0, 0.4], [12.6, 13]]) solid(x - 0.35, x + 0.35, 3.2, 3.65, z0, z1);   // the concrete pillars stick out of the roof a little (index.html draws them)
  const roofSkin = mat(0x8a9097, {metalness: 0.45, roughness: 0.5}), rib = mat(0x6f757c, {metalness: 0.5, roughness: 0.45});
  function curvedRoof(xa, xb){
    const sh = new THREE.Shape(); const N = 40;
    for (let i = 0; i <= N; i++){ const z = -0.32 + 13.64*i/N; i ? sh.lineTo(-z, roofF(z)) : sh.moveTo(-z, roofF(z)); }
    sh.lineTo(-13.32, 3.08); sh.lineTo(-13, 3.08);
    for (let i = N; i >= 0; i--){ const z = 13*i/N; sh.lineTo(-z, roofU(z) + 0.03); }
    sh.lineTo(0.32, 3.08);
    const geo = new THREE.ExtrudeGeometry(sh, {depth: xb - xa, bevelEnabled: false, steps: 1, curveSegments: 1});
    const m = new THREE.Mesh(geo, roofSkin); m.rotation.y = Math.PI/2; m.position.set(xa, 0, 0); G.scene.add(m);
    for (let z = 0.3; z < 13; z += 0.62) box(xa, xb, roofF(z) - 0.01, roofF(z) + 0.035, z - 0.025, z + 0.025, rib);   // standing seams
    solid(xa, xb, 3.1, 6.3, -0.32, 13.32, {hf: roofF, metal: true});
  }
  curvedRoof(-0.32, 14); curvedRoof(35, 50.32);

  // ---------- 0: the start balcony outside the east door ----------
  blk(50.25, 53.5, -0.15, 0, 4.5, 8.5, grateM(3), {metal: true});
  for (const z of [4.5, 8.5]){ blk(50.25, 53.5, 0, 1.05, z - 0.03, z + 0.03, null, {rail: true}); box(50.25, 53.5, 1.0, 1.05, z - 0.03, z + 0.03, steel); box(50.25, 53.5, 0.5, 0.53, z - 0.015, z + 0.015, steel);
    for (let x = 50.4; x < 53.5; x += 0.78) box(x - 0.025, x + 0.025, 0, 1.0, z - 0.025, z + 0.025, steel); }
  for (const z of [4.6, 8.4]) rod([53.4, -0.15, z], [50.4, -2.4, z], 0.05, steel);                       // struts under the balcony
  box(53.3, 53.5, 0.001, 0.012, 4.55, 8.45, YEL);                                                       // take-off edge
  decal(LINE_X, 0, 6.5, 3.9, 0.3, 1, 0, new THREE.MeshBasicMaterial({map: tex(256, 16, (g, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++){ g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i*16, j*8, 16, 8); } })}));
  const banner = (text, sub) => tex(512, 96, (g, w, h) => { g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffc400'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8);
    g.fillStyle = '#fff'; g.font = '900 48px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w/2, sub ? 40 : h/2); if (sub){ g.font = '600 20px system-ui, sans-serif'; g.fillStyle = '#ffd54f'; g.fillText(sub, w/2, 74); } });
  for (const z of [4.62, 8.38]) box(LINE_X - 0.05, LINE_X + 0.05, 0, 2.75, z - 0.05, z + 0.05, steel);
  sign(LINE_X, 2.52, 6.5, 3.76, 0.5, -1, 0, banner('ROOFTOP RUN', 'cross the line to start'));
  sign(LINE_X + 0.01, 2.52, 6.5, 3.76, 0.5, 1, 0, banner('ROOFTOP RUN'));

  // ---------- 1–2: the neighbour's roof (a lower building east of ours) ----------
  const nb = new THREE.MeshStandardMaterial({map: facadeTex, roughness: 0.85});
  blk(56, 70, -13, -0.8, -10, 11, null); box(56, 70, -13, -0.95, -10, 11, nb); box(56, 70, -0.95, -0.8, -10, 11, roofMat);
  for (const [x0, x1, z0, z1] of [[69.7, 70, -10, 11], [56, 70, 10.7, 11], [56, 70, -10, -9.7]]) blk(x0, x1, -0.8, -0.3, z0, z1, concrete);
  blk(65, 70, -0.8, 2.4, -1.5, 10.7, mat(0xc3bfb5));                                  // plant room: forces the turn south
  box(64.99, 65, -0.8, 1.3, 3.5, 4.5, darkMetal); for (let y = 0.2; y < 2.3; y += 0.25) box(64.95, 65, y, y + 0.06, 6, 9, darkMetal);   // door, louvres
  box(56, 56.25, -0.79, -0.78, 3.4, 9.5, YEL);                                        // landing edge (from the balcony)
  const ac = (x0, x1, z0, z1) => { blk(x0, x1, -0.8, 0.2, z0, z1, mat(0xaeb3b9, {metalness: 0.3, roughness: 0.6})); box(x0 - 0.01, x1 + 0.01, 0.12, 0.21, z0 - 0.01, z1 + 0.01, YEL);
    for (let z = z0 + 0.3; z < z1 - 0.2; z += 0.5) box(x0 - 0.02, x0, -0.6, 0, z, z + 0.3, darkMetal); };
  ac(60.5, 61.5, 4.5, 8.5);                                                            // vault
  blk(59.5, 65, 0.15, 0.7, 0.6, 1.2, mat(0x9aa1a8, {metalness: 0.5, roughness: 0.4}));  // duct: slide under
  box(59.5, 65, 0.13, 0.16, 0.58, 1.22, YEL);
  blk(59.5, 59.7, -0.8, 0.15, 0.7, 1.1, steel);
  ac(59.5, 60.5, -5.5, -1.5);                                                          // vault
  box(56, 56.25, -0.79, -0.78, -4.2, -0.6, YEL);                                       // take-off to the gantry
  decal(58.4, -0.8, 6.5, 1.1, 1.1, 1, 0, CHEV); decal(63.3, -0.8, 5.6, 1.1, 1.1, 0, -1, CHEV); decal(63.3, -0.8, -2.8, 1.1, 1.1, -1, 0, CHEV); decal(57.6, -0.8, -2.6, 1.1, 1.1, -1, 0, CHEV);
  G.scene.updateMatrixWorld(); for (const o of G.scene.children) if (o.isMesh && o.geometry && o.geometry.type !== 'BoxGeometry' && o.position.y < -2 && o.position.y > -12.9 && o.position.x > 52 && o.position.x < 74 && o.position.z > -20 && o.position.z < -3) o.visible = false;   // street trees that would grow through it
  box(62, 64, -0.8, 0.4, -8.4, -6.6, mat(0x9b968c)); solid(62, 64, -0.8, 0.4, -8.4, -6.6);   // a water tank base (scenery)
  rod([63, 0.4, -7.5], [63, 2.2, -7.5], 0.9, mat(0x7c8288, {metalness: 0.4}));

  // ---------- 3: the side A facade: a landing platform, three window-cleaning gantries, two wall-run panels ----------
  const gantry = (x0, x1, z0 = -1.0) => { blk(x0, x1, -0.55, -0.4, z0, -0.25, grateM(Math.round((x1 - x0)/1.2)), {metal: true});
    box(x0, x1, -0.62, -0.55, z0, z0 + 0.06, steel); for (let x = x0 + 0.3; x < x1; x += 1.6) rod([x, -0.55, z0 + 0.05], [x, -1.5, -0.26], 0.03, steel); };
  gantry(50.25, 53.5, -4.0); box(50.25, 53.5, -0.4, -0.39, -4.0, -3.85, YEL);            // landing platform round the corner
  decal(51.4, -0.4, -2.0, 1.0, 1.0, -1, 0, CHEV);
  gantry(47.8, 50.25, -2.2); gantry(46, 47.8); box(46, 46.18, -0.4, -0.39, -1.0, -0.25, YEL);   // wide round the corner, then narrow
  gantry(37.5, 42); box(41.82, 42, -0.4, -0.39, -1.0, -0.25, YEL); box(37.5, 37.68, -0.4, -0.39, -1.0, -0.25, YEL);
  blk(38.9, 39.4, -0.4, 0.3, -0.9, -0.42, mat(0x37474f)); box(38.88, 39.42, 0.22, 0.31, -0.92, -0.4, YEL);   // a cleaning cart: vault it
  gantry(28, 33); box(32.82, 33, -0.4, -0.39, -1.0, -0.25, YEL);
  const panelTex = () => tex(256, 128, (g, w, h) => { g.fillStyle = '#ffc400'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1c1f';
      for (const y of [0, h - 14]) for (let i = -14; i < w + 14; i += 22){ g.beginPath(); g.moveTo(i, y); g.lineTo(i + 11, y); g.lineTo(i + 25, y + 14); g.lineTo(i + 14, y + 14); g.closePath(); g.fill(); }
      g.globalAlpha = 0.85; for (const x of [70, 128, 186]){ g.beginPath(); g.moveTo(x + 22, 64); g.lineTo(x - 8, 40); g.lineTo(x - 8, 52); g.lineTo(x + 6, 64); g.lineTo(x - 8, 76); g.lineTo(x - 8, 88); g.closePath(); g.fill(); } });
  const wallPanel = (x0, x1) => { box(x0, x1, -0.4, 2.95, -0.29, -0.25, new THREE.MeshStandardMaterial({map: panelTex(), roughness: 0.6, emissive: 0x3a2800}));   // visual only: you run on the facade behind it
    for (const x of [x0, x1]) box(x - 0.05, x + 0.05, -0.45, 3.0, -0.35, -0.25, steel); };
  wallPanelB = (x0, x1) => { box(x0, x1, 0.3, 2.95, 13.25, 13.29, new THREE.MeshStandardMaterial({map: panelTex(), roughness: 0.6, emissive: 0x3a2800}));   // side B: arrows point east
    for (const x of [x0, x1]) box(x - 0.05, x + 0.05, 0.25, 3.0, 13.25, 13.35, steel); };
  wallPanel(41.3, 46.6); wallPanel(32.6, 38.1);
  // ---------- 4: the climb: a yellow strip up the facade to the yellow roof edge ----------
  climbTex = tex(128, 320, (g, w, h) => { g.fillStyle = '#ffc400'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1c1f';
    for (const x of [0, w - 14]) for (let y = -14; y < h + 14; y += 22){ g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y - 14); g.lineTo(x + 14, y - 3); g.lineTo(x, y + 11); g.closePath(); g.fill(); }
    for (let y = 40; y < h - 20; y += 70){ g.beginPath(); g.moveTo(w/2, y); g.lineTo(w/2 + 34, y + 34); g.lineTo(w/2 + 20, y + 34); g.lineTo(w/2, y + 14); g.lineTo(w/2 - 20, y + 34); g.lineTo(w/2 - 34, y + 34); g.closePath(); g.fill(); } });
  sign(30, 1.34, -0.27, 1.4, 3.48, 0, -1, climbTex); box(29.3, 30.7, 2.98, 3.2, -0.37, -0.32, YEL); box(29.3, 30.7, 3.2, 3.215, -0.32, 0.25, YEL);
  decal(31.6, -0.4, -0.62, 0.7, 0.7, -1, 0, CHEV);

  // ---------- 5: rooftop flow on the flat roof ----------
  blk(26, 27, 3.2, 4.2, -0.15, 3.0, mat(0xaeb3b9, {metalness: 0.3, roughness: 0.6})); box(25.99, 27.01, 4.12, 4.21, -0.16, 3.01, YEL);   // HVAC unit: vault
  for (let z = 0.2; z < 2.8; z += 0.45) box(26.99, 27.01, 3.4, 4.0, z, z + 0.25, darkMetal);
  blk(22.4, 22.9, 4.15, 4.6, -0.3, 13.3, mat(0x9aa1a8, {metalness: 0.5, roughness: 0.4})); box(22.38, 22.92, 4.13, 4.16, -0.3, 13.3, YEL);   // pipe bridge: slide under
  for (const z of [-0.3, 13.1]) blk(22.4, 22.9, 3.2, 4.15, z, z + 0.2, steel);
  decal(28.4, 3.2, 1.3, 0.9, 0.9, -1, 0, CHEV); decal(24.2, 3.2, 3.2, 0.9, 0.9, -1, 0.6, CHEV);
  // scenery on the roof (solid, off the route)
  for (const [x0, x1, z0, z1, h] of [[31, 34, 8.5, 11.8, 1.3], [15.2, 17.4, 10.2, 12.4, 0.5], [18.2, 20.4, 10.2, 12.4, 0.5]]){
    blk(x0, x1, 3.2, 3.2 + h, z0, z1, h < 0.6 ? mat(0x9fb6c4, {metalness: 0.2, roughness: 0.2}) : mat(0xaeb3b9, {metalness: 0.3, roughness: 0.6})); }
  // ---------- 6: the chimney: the lift motor room, then up onto the west curved roof ----------
  blk(16.2, 19, 3.2, 5.0, 4, 9, mat(0xc9c5bb)); box(16.18, 19.02, 4.95, 5.05, 3.98, 9.02, concrete);
  box(18.88, 19.04, 4.86, 5.06, 4.4, 8.6, YEL);                                         // grab here
  box(16.16, 16.32, 4.86, 5.06, 5.2, 7.8, YEL);                                         // and jump from here
  box(17.0, 18.2, 3.2, 5.3 - 0.4, 3.98, 4.0, darkMetal);                                // a steel door on the south side
  rod([17.4, 5.05, 8.4], [17.4, 7.2, 8.4], 0.035, steel); solid(17.3, 17.5, 5.0, 7.2, 8.3, 8.5);   // antenna
  box(13.9, 14.06, 6.0, 6.32, 5.0, 8.0, YEL);                                           // the gable top: grab here
  decal(20.2, 3.2, 6.5, 0.9, 0.9, -1, 0, CHEV);
  // ---------- 7: the ridge run (west) ----------
  const ridge = (x0, x1) => { blk(x0, x1, 6.22, 6.38, 5.9, 7.1, grateM(Math.round(x1 - x0)), {metal: true});
    for (let x = x0 + 0.7; x < x1; x += 2.2) for (const z of [5.95, 7.05]) box(x - 0.04, x + 0.04, 6.0, 6.22, z - 0.04, z + 0.04, steel); };
  ridge(-0.25, 13.8);
  blk(6.6, 7.4, 6.38, 7.18, 5.75, 7.25, mat(0x8d949b, {metalness: 0.4, roughness: 0.5})); box(6.58, 7.42, 7.1, 7.19, 5.73, 7.27, YEL);   // ridge vent: vault
  blk(-0.25, -0.1, 6.38, 7.45, 5.9, 7.1, steel, {rail: true});                         // end stop at the gable
  decal(10.5, 6.38, 6.5, 0.8, 0.8, -1, 0, CHEV); decal(4.2, 6.38, 6.85, 0.8, 0.8, 0, 1, CHEV);
  // ---------- 8: the roof slide: off the walkway and down the side B slope (yellow seams), off the eave ----------
  const lane = (xa, xb, za, zb) => { for (let z = 0.3; z < 13; z += 0.62) if (z > za && z < zb) box(xa, xb, roofF(z) - 0.005, roofF(z) + 0.045, z - 0.035, z + 0.035, YEL); };
  lane(2.6, 5.8, 7.1, 13.4);
  box(0.6, 9.6, 3.3, 3.44, 13.24, 13.42, YEL);                                          // the eave: launch here
  // ---------- 9: the drop: a scaffold deck on side B (roll on landing!) ----------
  blk(1, 10, 0.15, 0.3, 13.25, 19.5, grateM(8), {metal: true});
  box(9.82, 10, 0.3, 0.31, 13.25, 15.2, YEL);                                           // take-off to the first side B gantry
  blk(1, 10, 0.3, 3.0, 19.44, 19.52, null, {rail: true}); blk(0.95, 1.02, 0.3, 3.0, 13.25, 19.5, null, {rail: true});   // safety nets
  const net = new THREE.MeshBasicMaterial({color: 0x2f343a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false});
  box(1, 10, 0.3, 3.0, 19.47, 19.49, net); box(0.97, 0.99, 0.3, 3.0, 13.25, 19.5, net);
  for (const x of [1, 4, 7, 10]) box(x - 0.04, x + 0.04, 0.3, 3.0, 19.44, 19.52, steel);
  for (const z of [16.4, 19.5]) box(0.95, 1.03, 0.3, 3.0, z - 0.04, z + 0.04, steel);
  box(1, 10, 2.96, 3.02, 19.44, 19.52, steel); box(0.95, 1.03, 2.96, 3.02, 13.25, 19.5, steel);
  for (const x of [1.6, 5.5, 9.4]){ rod([x, 0.15, 19.3], [x, -3.6, 13.3], 0.05, steel); rod([x, 0.15, 16.3], [x, -1.8, 13.3], 0.04, steel); }
  blk(5.0, 5.8, 0.3, 1.15, 13.25, 19.44, mat(0xa0784a, {roughness: 0.9})); box(4.98, 5.82, 1.08, 1.16, 13.25, 19.44, YEL);   // a stack of scaffold planks: vault
  for (let y = 0.45; y < 1.1; y += 0.22) box(4.99, 5.81, y, y + 0.025, 13.25, 19.44, mat(0x6e5232));
  blk(8.3, 8.5, 1.25, 1.42, 13.25, 19.44, YEL);                                          // a scaffold tube across the deck: slide under, then jump
  for (const z of [16.4, 19.4]) box(8.35, 8.45, 0.3, 1.42, z - 0.05, z + 0.05, steel);
  decal(3.4, 0.3, 16.0, 1.1, 1.1, 1, -0.4, CHEV); decal(7.1, 0.3, 14.4, 0.9, 0.9, 1, 0, CHEV);
  // ---------- 10: the side B scaffolding: slide bar, wall run, then climb back up ----------
  const gantryB = (x0, x1) => { blk(x0, x1, 0.15, 0.3, 13.25, 14.5, grateM(Math.round((x1 - x0)/1.2)), {metal: true});
    box(x0, x1, 0.08, 0.15, 14.44, 14.5, steel); for (let x = x0 + 0.3; x < x1; x += 1.6) rod([x, 0.15, 14.45], [x, -1.0, 13.26], 0.03, steel); };
  gantryB(12, 16.2); box(12, 12.18, 0.3, 0.31, 13.25, 14.5, YEL); box(16.02, 16.2, 0.3, 0.31, 13.25, 14.5, YEL);
  blk(14.3, 14.8, 0.3, 1.0, 13.42, 13.9, mat(0x37474f)); box(14.28, 14.82, 0.92, 1.01, 13.4, 13.92, YEL);   // a cleaning cart: vault it (or wall run into it: up and over)
  wallPanelB(16.0, 20.8);
  gantryB(20.6, 25.2); box(20.6, 20.78, 0.3, 0.31, 13.25, 14.5, YEL);
  sign(24.3, 1.75, 13.27, 1.4, 2.9, 0, 1, climbTex); box(23.6, 25.0, 2.98, 3.2, 13.32, 13.37, YEL); box(23.6, 25.0, 3.2, 3.215, 12.75, 13.32, YEL);
  decal(22.9, 0.3, 13.9, 0.7, 0.7, 1, 0, CHEV);
  // ---------- 11: back across the flat roof to the east curved roof ----------
  blk(26.5, 27.3, 3.2, 4.1, 9.0, 13.2, mat(0xaeb3b9, {metalness: 0.3, roughness: 0.6})); box(26.48, 27.32, 4.02, 4.11, 8.98, 13.22, YEL);   // AC unit: vault
  for (let z = 9.2; z < 13; z += 0.45) box(26.49, 26.51, 3.4, 3.9, z, z + 0.25, darkMetal);
  decal(25.6, 3.2, 12.0, 0.8, 0.8, 1, 0, CHEV); decal(33.4, 3.2, 12.5, 0.8, 0.8, 1, 0, CHEV);
  for (let z = 11.4; z < 13.3; z += 0.19) box(34.95, 35.06, roofF(z + 0.1) - 0.1, roofF(z + 0.1) + 0.03, z, z + 0.2, YEL);   // the gable edge: hop on here
  lane(35.4, 37.4, 7.1, 11.6);
  // ---------- 12: the ridge run (east) ----------
  ridge(35.2, 50.25);
  blk(41.6, 42.4, 6.38, 7.18, 5.75, 7.25, mat(0x8d949b, {metalness: 0.4, roughness: 0.5})); box(41.58, 42.42, 7.1, 7.19, 5.73, 7.27, YEL);   // ridge vent: vault
  blk(45.5, 45.7, 7.33, 7.5, 5.5, 7.5, YEL);                                            // a cable tray: slide under
  for (const z of [5.5, 7.4]) blk(45.5, 45.7, roofF(z) - 0.05, 7.5, z - 0.1, z, steel, {rail: true});
  decal(36.0, 6.38, 6.5, 0.8, 0.8, 1, 0, CHEV); decal(44.0, 6.38, 6.5, 0.8, 0.8, 1, 0, CHEV); decal(48.6, 6.38, 6.5, 0.8, 0.8, 1, 0, CHEV);
  // ---------- 13: the zipline back over the start, to the finish on the neighbour's roof ----------
  box(49.7, 49.85, 6.2, 8.55, 7.2, 7.35, steel); solid(49.7, 49.85, 6.2, 8.55, 7.2, 7.35, {rail: true});
  box(49.7, 49.85, 8.42, 8.52, 6.5, 7.35, steel);
  box(59.35, 59.6, -0.8, 2.65, 9.85, 10.1, steel); box(59.2, 59.6, 2.5, 2.6, 9.6, 10.1, steel);
  cableMesh = rod(ZIP.a, ZIP.b, 0.025, YEL);
  box(ZIP.b[0] - ZIP_BRAKE*0.82 - 0.05, ZIP.b[0] - ZIP_BRAKE*0.82 + 0.05, ZIP.b[1] + ZIP_BRAKE*0.51 - 0.06, ZIP.b[1] + ZIP_BRAKE*0.51 + 0.06, ZIP.b[2] - ZIP_BRAKE*0.27 - 0.06, ZIP.b[2] - ZIP_BRAKE*0.27 + 0.06, mat(0xd32f2f));   // the brake starts here
  // ---------- 14: the finish pad ----------
  decal((FINISH.x0 + FINISH.x1)/2, -0.8, (FINISH.z0 + FINISH.z1)/2, FINISH.z1 - FINISH.z0, FINISH.x1 - FINISH.x0, 1, 0, new THREE.MeshBasicMaterial({map: tex(256, 128, (g, w, h) => {
    g.fillStyle = '#ffc400'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1c1f'; for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) g.fillRect(i*16, j*10, 16, 10);
    g.font = '900 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FINISH', w/2, 76); })}));
  for (const z of [8.85, 10.55]) box(61.65, 61.8, -0.8, 2.75, z - 0.07, z + 0.07, steel);
  sign(61.64, 2.45, 9.7, 2.0, 0.5, -1, 0, banner('FINISH'));
  // ---------- checkpoint lamps ----------
  for (const c of CPS){ const [x, y, z] = c.post; box(x - 0.05, x + 0.05, y, y + 1.6, z - 0.05, z + 0.05, steel);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshBasicMaterial({color: 0xffc400, toneMapped: false})); l.position.set(x, y + 1.72, z); G.scene.add(l); cpLamps.push(l); }
  // ---------- leaderboards: on the east wall next to the balcony, and at the finish ----------
  const bt = boardTex(); boards.push(bt);
  sign(50.31, 1.45, 10.7, 3.2, 3.2, 1, 0, bt.t); box(50.25, 50.3, -0.2, 3.1, 9.0, 12.4, steel);
  sign(64.97, 0.85, 9.7, 2.7, 2.7, -1, 0, bt.t); box(64.94, 64.99, -0.55, 2.25, 8.3, 11.1, steel);   // on the plant room, facing the finish pad
  // ---------- the ghost of your best run ----------
  ghostMesh = new THREE.Group(); const gm = new THREE.MeshBasicMaterial({color: 0xfff3b0, transparent: true, opacity: 0.32, depthWrite: false});
  const gb = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 1.2, 10), gm); gb.position.y = 0.9; ghostMesh.add(gb);
  const gh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), gm); gh.position.y = 1.68; ghostMesh.add(gh);
  ghostMesh.visible = false; G.scene.add(ghostMesh);
}

// ---------- the leaderboard as a canvas texture ----------
function boardTex(){ const c = document.createElement('canvas'); c.width = 512; c.height = 512; const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; const b = {c, t}; drawBoard(b); return b; }
function ranking(){ return [...LB.entries()].filter(([, v]) => v && v.t).sort((a, b) => a[1].t - b[1].t); }
function drawBoard(b){
  const g = b.c.getContext('2d'), W = 512, myId = G.mp && G.mp.parkour ? G.mp.parkour.id() : null;
  g.fillStyle = '#16181d'; g.fillRect(0, 0, W, W); g.fillStyle = '#ffc400'; g.fillRect(0, 0, W, 12); g.fillRect(0, W - 12, W, 12);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 40px system-ui, sans-serif'; g.fillText('ROOFTOP RUN', W/2, 52);
  g.font = '600 20px system-ui, sans-serif'; g.fillStyle = '#ffd54f'; g.fillText('best times', W/2, 88);
  const rows = ranking().slice(0, 10);
  if (!rows.length){ g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 24px system-ui, sans-serif'; g.fillText('No times yet.', W/2, 230); g.fillText('Be the first!', W/2, 266); }
  rows.forEach(([id, v], i) => { const y = 132 + i*36, mine = id === myId;
    if (mine){ g.fillStyle = 'rgba(255,196,0,.22)'; g.fillRect(24, y - 17, W - 48, 34); }
    g.textAlign = 'left'; g.font = '800 24px system-ui, sans-serif'; g.fillStyle = i === 0 ? '#ffc400' : '#fff'; g.fillText(String(i + 1), 40, y);
    g.font = (mine ? '800 ' : '600 ') + '24px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(String(v.n || '?').slice(0, 16), 84, y);
    g.textAlign = 'right'; g.font = '700 24px ui-monospace, Consolas, monospace'; g.fillText(fmt(v.t), W - 40, y); });
  b.t.needsUpdate = true;
}
let boardDirty = false;
function onLB(id, v){ if (v && typeof v.t === 'number') LB.set(id, v); else LB.delete(id); boardDirty = true; }

// ======================================================= movement =======================================================
const inXZ = (s, x, z, r) => x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r;
// a solid you would walk into at (x, z): its top is more than a step above your feet and it overlaps your body
function blocking(x, z, y, h, step, skip){
  for (const s of SOL){ if (!inXZ(s, x, z, R) || (skip && skip.includes(s))) continue; const top = topAt(s, x, z);
    if (y + (s.hf ? Math.max(step, 0.6) : step) < top && y + h > s.y0 + 0.01) return s; }
  return null;
}
// everything you already overlap (rounding, a mantle that ended close to a wall): you may move out of those freely
function overlapping(x, z, y, h, step){ const out = []; for (const s of SOL){ if (!inXZ(s, x, z, R - 0.002)) continue; const top = topAt(s, x, z); if (y + (s.hf ? Math.max(step, 0.6) : step) < top && y + h > s.y0 + 0.01) out.push(s); } return out; }
// the highest surface under you that is not above `limit`
function support(x, z, limit){ let best = -1e9, bs = null; for (const s of SOL){ if (!inXZ(s, x, z, R*0.7)) continue; const top = topAt(s, x, z); if (top <= limit && top > best){ best = top; bs = s; } } return {top: best, s: bs}; }
function ceiling(x, z, from, to){ let c = null; for (const s of SOL){ if (s.hf || !inXZ(s, x, z, R*0.9)) continue; if (s.y0 >= from - 0.02 && s.y0 < to && (c === null || s.y0 < c)) c = s.y0; } return c; }
const pointIn = (x, y, z) => { for (const s of SOL) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && y > s.y0 && y < topAt(s, x, z)) return s; return null; };
// the outward normal of the face of s you are next to
function faceNormal(s, x, z){
  const d = [[s.x0 - x, -1, 0], [x - s.x1, 1, 0], [s.z0 - z, 0, -1], [z - s.z1, 0, 1]];
  let b = d[0]; for (const e of d) if (e[0] > b[0]) b = e; return [b[1], b[2]];
}
const fwd = () => [-Math.sin(pk.yaw), -Math.cos(pk.yaw)];
const right = () => [Math.cos(pk.yaw), -Math.sin(pk.yaw)];
const hsp = () => Math.hypot(pk.vx, pk.vz);

function newPlayer(at){
  return {x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, yaw: at.yaw, pitch: -0.05, h: H_STAND, eye: EYE_STAND, camY: at.y,
    ground: true, st: 'run', top: RUN0, coy: 0, buf: 0, crouchAt: -9, wallCool: 0, lastWall: null, climbs: 1, zipCool: 0,
    anim: null, wr: null, cl: null, zip: null, roll: 0, stagger: 0, slideT: 0, dip: 0, dipV: 0, roll3: 0, camRoll: 0, fovK: 70, bob: 0, stepSide: 0,
    turn: null, fade: 0, dead: 0, airT: 0,
    run: {phase: 'ready', t: 0, cp: 0, splits: [], falls: 0, rec: [], recT: 0}, result: null, flash: null};
}

function pressJump(){ if (!pk || pk.result) return; pk.buf = BUFFER; inp.jumpHeld = true; }
function pressCrouch(){ if (!pk) return; pk.crouchAt = performance.now(); }
function startMantle(tx, tz, top, kind){
  const P = pk, from = {x: P.x, y: P.y, z: P.z}, d = top - P.y;
  P.anim = {kind, from, to: {x: tx, y: top, z: tz}, t: 0, dur: kind === 'vault' ? clamp(Math.hypot(tx - P.x, tz - P.z)/Math.max(4.5, hsp()), 0.26, 0.48) : 0.2 + 0.1*Math.max(0, d), keep: hsp(), peak: 0, dir: [P.vx, P.vz]};
  P.st = 'anim'; P.wr = null; P.cl = null; P.vy = 0;
  play(kind === 'vault' ? 'whoosh' : 'pkGrab', 0.6, 0);
}
// a ledge in front of you that you can reach with your hands and pull yourself onto
function findLedge(relaxed){
  const P = pk, f = fwd();
  for (const dd of [R + 0.18, R + 0.36]){
    const px = P.x + f[0]*dd, pz = P.z + f[1]*dd; let best = null, bt = -1e9;
    for (const s of SOL){ if (s.rail || !(px > s.x0 && px < s.x1 && pz > s.z0 && pz < s.z1)) continue; const top = topAt(s, px, pz);
      if (top - P.y < (relaxed ? 0.25 : 0.5) || top - P.y > 2.35 || s.y0 > P.y + 1.9) continue; if (top > bt){ bt = top; best = s; } }
    if (!best) continue;
    // stand on it: a bit further in, with room for at least a crouch
    const tx = P.x + f[0]*(dd + 0.32), tz = P.z + f[1]*(dd + 0.32), sup = support(tx, tz, bt + 0.45);
    if (sup.top < bt - 0.3) continue;
    if (blocking(tx, tz, sup.top, H_LOW, 0.05)) continue;
    return {tx, tz, top: sup.top};
  }
  return null;
}
// something low in front of you while running: vault over it, or hop onto it if it is deep
function tryVault(){
  const P = pk, f = fwd(); let sp = hsp(), dx, dz;
  if (sp >= 2.5){ dx = P.vx/sp; dz = P.vz/sp; if (dx*f[0] + dz*f[1] < 0.5) return false; }
  else if (inp.f > 0.5 && P.hit){ dx = f[0]; dz = f[1]; sp = 0; }   // standing against it, pushing forward
  else return false;
  const px = P.x + dx*(R + 0.3), pz = P.z + dz*(R + 0.3); let ob = null, ot = -1e9;
  for (const s of SOL){ if (!(px > s.x0 - 0.05 && px < s.x1 + 0.05 && pz > s.z0 - 0.05 && pz < s.z1 + 0.05)) continue; const top = topAt(s, px, pz);
    if (top - P.y > 0.42 && top - P.y <= 1.3 && s.y0 <= P.y + 0.45 && top > ot){ ot = top; ob = s; } }
  if (!ob) return false;
  if (blocking(P.x + dx*0.1, P.z + dz*0.1, ot, H_LOW, 0.05)) return false;   // no room above it
  // how deep is it along your run?
  let d = 0, inside = false; while (d < 2.2){ const s = pointIn(px + dx*d, ot - 0.05, pz + dz*d); if (s) inside = true; else if (inside) break; d += 0.06; }
  if (inside && d < 1.9){
    const lx = px + dx*(d + R + 0.15), lz = pz + dz*(d + R + 0.15), sup = support(lx, lz, ot + 0.3);
    if (!blocking(lx, lz, Math.max(sup.top, P.y - 6), H_STAND, 0.45) && sup.top > ot - 20){
      startMantle(lx, lz, sup.top > -1e8 ? sup.top : P.y, 'vault'); P.anim.keep = Math.max(P.anim.keep, RUN0 - 1.0); if (!sp) P.anim.dir = [dx, dz]; P.anim.peak = ot + 0.22; P.anim.toAir = sup.top < P.y - 0.5; return true; }
  }
  const tx = px + dx*0.35, tz = pz + dz*0.35, sup = support(tx, tz, ot + 0.05);
  if (sup.top > ot - 0.2 && !blocking(tx, tz, sup.top, H_STAND, 0.05)){ startMantle(tx, tz, sup.top, 'step'); P.anim.dur = 0.2; return true; }
  return false;
}
// the wall right in front of you (for a wall climb)
function wallAhead(minAbove){
  const P = pk, f = fwd(), px = P.x + f[0]*(R + 0.35), pz = P.z + f[1]*(R + 0.35), s = pointIn(px, P.y + 1.0, pz);
  if (!s || s.rail || topAt(s, px, pz) < P.y + minAbove) return null;
  const n = faceNormal(s, P.x, P.z); if (-(n[0]*f[0] + n[1]*f[1]) < 0.8) return null;   // within ~35°
  return {s, n};
}
// a wall beside you (for a wall run): side = +1 right, −1 left
function wallBeside(){
  const P = pk, r = right(), sp = hsp(); if (sp < 3.8) return null;
  for (const side of [1, -1]){
    const px = P.x + r[0]*side*(R + 0.38), pz = P.z + r[1]*side*(R + 0.38), s = pointIn(px, P.y + 1.0, pz);
    if (!s || s.rail || topAt(s, px, pz) < P.y + 1.5) continue;
    if (s === P.lastWall && P.wallCool > -0.25) continue;
    const n = faceNormal(s, P.x, P.z); let t = [-n[1], n[0]]; if (t[0]*P.vx + t[1]*P.vz < 0) t = [-t[0], -t[1]];
    const along = t[0]*P.vx + t[1]*P.vz; if (along < 3.5 || along/sp < 0.55) continue;
    return {s, n, t, side, along};
  }
  return null;
}

// one physics step of h seconds
function step(h){
  const P = pk;
  P.buf -= h; P.coy -= h; P.wallCool -= h; P.zipCool -= h; P.stagger = Math.max(0, P.stagger - h); P.roll = Math.max(0, P.roll - h);
  const f = fwd(), r = right(); let wx = f[0]*inp.f + r[0]*inp.s, wz = f[1]*inp.f + r[1]*inp.s; const wl = Math.hypot(wx, wz); if (wl > 1){ wx /= wl; wz /= wl; }
  if (P.st === 'anim') return animStep(h);
  if (P.st === 'zip') return zipStep(h);
  if (P.st === 'wall') return wallStep(h);
  if (P.st === 'climb') return climbStep(h);
  const crouchWanted = inp.crouch || touch.crouch;
  // ---- jump (buffered) ----
  if (P.buf > 0 && (P.ground || P.coy > 0)){
    const w = wallAhead(2.0);
    if (w && P.climbs > 0 && hsp() > 0.5){ startClimb(w); return; }
    if (P.ground && tryVault()) { P.buf = 0; return; }
    if (!blocking(P.x, P.z, P.y, H_STAND, 0.05)){
      P.buf = 0; P.coy = 0; P.ground = false; P.vy = JUMP_V; P.h = H_STAND; if (P.st === 'slide'){ P.st = 'run'; const sp = hsp(); if (sp > 1){ const k = Math.min(1.1, (sp + 0.4)/sp); P.vx *= k; P.vz *= k; } }
      play('pkStep', 0.7, 0, P.ground && P.groundS && P.groundS.metal); if (window.__stat) window.__stat('jumps');
    }
  } else if (P.buf > 0 && !P.ground){
    const w = wallAhead(1.2);
    if (w && P.climbs > 0){ P.buf = 0; startClimb(w); return; }
    if (P.y + HAND > 0 && zipTry(true)){ P.buf = 0; return; }
  }
  // ---- ground movement ----
  if (P.ground){
    const sp = hsp();
    if (P.st === 'slide'){
      P.slideT += h;
      const k = Math.max(0, sp - 2.0*h), sl = slope(); let vx = sp > 0.01 ? P.vx/sp*k : 0, vz = sp > 0.01 ? P.vz/sp*k : 0;
      vx += sl[0]*9.8*h; vz += sl[1]*9.8*h;
      if (wl > 0.05){ const ns = Math.hypot(vx, vz); vx += wx*2.5*h; vz += wz*2.5*h; const n2 = Math.hypot(vx, vz); if (n2 > ns){ vx *= ns/n2; vz *= ns/n2; } }
      P.vx = vx; P.vz = vz;
      if ((P.slideT > 0.55 && !crouchWanted) || hsp() < 2.2 || P.slideT > 2.5){ P.st = blocking(P.x, P.z, P.y, H_STAND, 0.05) ? 'crouch' : 'run'; }
    } else {
      if (crouchWanted && sp > 3.6 && P.st === 'run'){ P.st = 'slide'; P.slideT = 0; P.h = H_LOW; const k = Math.min(sp + 1.2, 11.0)/sp; P.vx *= k; P.vz *= k; play('pkSlide', 0.8, 0); }
      else {
        if (crouchWanted && P.st === 'run') P.st = 'crouch';
        if (P.st === 'crouch' && !crouchWanted && !blocking(P.x, P.z, P.y, H_STAND, 0.05)) P.st = 'run';
        P.h = P.st === 'crouch' ? H_LOW : H_STAND;
        if (inp.f > 0.5 && sp > RUN0 - 1.0 && !inp.walk) P.top = Math.min(RUN_MAX, P.top + 1.35*h); else if (sp < RUN0 - 1.6) P.top = Math.max(RUN0, P.top - 6*h);
        let target = inp.walk ? WALK : P.st === 'crouch' ? CROUCH : P.top*(inp.f < -0.1 ? 0.62 : 1);
        if (P.stagger > 0) target = Math.min(target, 1.6);
        if (wl > 0.05){ const k = 1 - Math.exp(-(sp < 4 ? 12 : 8.5)*h); P.vx += (wx*target - P.vx)*k; P.vz += (wz*target - P.vz)*k; }
        else { const k = Math.exp(-(P.roll > 0 ? 3 : 11)*h); P.vx *= k; P.vz *= k; }
      }
    }
    if (P.st !== 'slide' && P.st !== 'crouch' && inp.f > 0.5 && (hsp() > 3 || P.hit)) tryVaultAuto();
    if (P.st === 'anim') return;
  } else {
    P.airT += h;
    if (wl > 0.05){ const before = hsp(); P.vx += wx*AIR*h; P.vz += wz*AIR*h; const after = hsp(), cap = Math.max(before, 4.5); if (after > cap){ P.vx *= cap/after; P.vz *= cap/after; } }
    const g = P.vy > 0 ? (inp.jumpHeld || touch.jump ? G_UP : G_CUT) : G_DOWN; P.vy = Math.max(-32, P.vy - g*h);
    // wall run, ledge grab, zipline
    if (P.vy < 3.2){ const L = findLedge(false); if (L){ startMantle(L.tx, L.tz, L.top, 'mantle'); return; } }
    if (inp.f > 0.3 && P.vy < 4.5 && P.airT > 0.05){ const w = wallBeside(); if (w){ startWallRun(w); return; } }
    if (zipTry(false)) return;
  }
  move(h);
}
function tryVaultAuto(){ if (pk.ground && pk.stagger <= 0) tryVault(); }
// the slope of a curved roof under you: the downhill direction scaled by steepness (0 on flat ground)
function slope(){ const P = pk, s = P.groundS; if (!s || !s.hf) return [0, 0]; const d = (s.hf(P.z + 0.05) - s.hf(P.z - 0.05))/0.1; return [0, -d*0.5]; }

function move(h){
  const P = pk, stepH = P.ground ? 0.45 : 0.12;
  P.hit = null; P.hits = [];
  const skip = overlapping(P.x, P.z, P.y, P.h, stepH);
  // move along x, then z; on a hit stop flush against the face
  let nx = P.x + P.vx*h, s = blocking(nx, P.z, P.y, P.h, stepH, skip);
  if (s){ P.hit = {s, n: faceNormal(s, P.x, P.z)}; P.hits.push(s); const face = P.vx > 0 ? s.x0 - R - 0.002 : s.x1 + R + 0.002; nx = P.vx > 0 ? clamp(face, P.x, nx) : clamp(face, nx, P.x); P.vx = 0; if (blocking(nx, P.z, P.y, P.h, stepH, skip)) nx = P.x; }
  P.x = nx;
  let nz = P.z + P.vz*h; s = blocking(P.x, nz, P.y, P.h, stepH, skip);
  if (s){ P.hit = {s, n: faceNormal(s, P.x, P.z)}; P.hits.push(s); const face = P.vz > 0 ? s.z0 - R - 0.002 : s.z1 + R + 0.002; nz = P.vz > 0 ? clamp(face, P.z, nz) : clamp(face, nz, P.z); P.vz = 0; if (blocking(P.x, nz, P.y, P.h, stepH, skip)) nz = P.z; }
  P.z = nz;
  // vertical
  let ny = P.y + P.vy*h;
  if (P.vy > 0){ const c = ceiling(P.x, P.z, P.y + P.h, ny + P.h); if (c !== null){ ny = c - P.h; P.vy = 0; } }
  const sup = support(P.x, P.z, P.y + (P.ground ? stepH : 0.06));
  if (P.vy <= 0 && ny <= sup.top){
    const impact = -P.vy; P.y = sup.top; P.vy = 0; P.groundS = sup.s;
    if (!P.ground) land(impact);
    P.ground = true; P.climbs = 1;
  } else if (P.ground && P.vy <= 0 && sup.top > P.y - 0.45 && sup.top > -1e8){ P.y = sup.top; P.groundS = sup.s; }
  else { if (P.ground){ P.coy = COYOTE; P.airT = 0; } P.ground = false; P.y = ny; }
  // a wall climb also starts when you run into a tall wall in the air while holding forward
  if (!P.ground && P.hit && inp.f > 0.5 && P.climbs > 0 && P.vy > -4 && P.st !== 'anim'){ const w = wallAhead(1.4); if (w && P.hit.s === w.s) startClimb(w); }
}
function land(impact){
  const P = pk, rollAsk = performance.now() - P.crouchAt < 450 || inp.crouch || touch.crouch;
  if (P.st === 'slide' || P.st === 'crouch'){} else P.st = 'run';
  if (impact > 9.5 && rollAsk){ P.roll = 0.55; P.roll3 = 0.55; const sp = hsp(); if (sp < RUN0 && sp > 0.3){ P.vx *= RUN0/sp; P.vz *= RUN0/sp; } play('pkLand', 0.5, 0); P.dipV -= 1.2; flash('Roll!', '#ffd54f'); }
  else if (impact > 12.5){ P.stagger = 0.45; P.vx *= 0.25; P.vz *= 0.25; P.top = RUN0; P.dipV -= 4.2; play('pkLand', 1, 0); }
  else { P.dipV -= Math.min(3.2, impact*0.24); play('pkLand', clamp(impact/12, 0.15, 0.8), 0); if (impact > 3) play('pkStep', 0.6, 0, P.groundS && P.groundS.metal); }
}
function animStep(h){
  const P = pk, A = P.anim; A.t += h; const u = Math.min(1, A.t/A.dur);
  if (A.kind === 'vault'){
    const e = u; P.x = A.from.x + (A.to.x - A.from.x)*e; P.z = A.from.z + (A.to.z - A.from.z)*e;
    const base = A.from.y + (Math.max(A.to.y, A.from.y - 0.4) - A.from.y)*e; P.y = base + Math.max(0, A.peak - A.from.y)*Math.sin(Math.PI*e);
  } else {
    const up = ease(Math.min(1, u/0.62)), fw = ease(clamp((u - 0.35)/0.65, 0, 1));
    P.y = A.from.y + (A.to.y - A.from.y)*up; P.x = A.from.x + (A.to.x - A.from.x)*fw; P.z = A.from.z + (A.to.z - A.from.z)*fw;
  }
  if (u >= 1){
    const f = fwd(), keep = A.kind === 'vault' ? A.keep*0.97 : A.kind === 'step' ? A.keep*0.88 : Math.max(inp.f > 0.3 ? RUN0 - 2.0 : 0, A.keep*0.55);
    const dl = Math.hypot(A.dir[0], A.dir[1]), dx = A.kind === 'vault' && dl > 0.1 ? A.dir[0]/dl : f[0], dz = A.kind === 'vault' && dl > 0.1 ? A.dir[1]/dl : f[1];
    P.vx = dx*keep; P.vz = dz*keep; P.vy = 0; P.st = 'run'; P.h = H_STAND; P.anim = null;
    if (blocking(P.x, P.z, P.y, H_STAND, 0.05)){ P.st = 'crouch'; P.h = H_LOW; }
    const sup = support(P.x, P.z, P.y + 0.1); P.ground = sup.top > P.y - 0.05; if (P.ground){ P.y = sup.top; P.groundS = sup.s; P.climbs = 1; } else P.airT = 0;
    if (A.kind !== 'vault') P.dipV -= 0.9;
  }
}
function startWallRun(w){
  const P = pk; P.st = 'wall'; P.wr = {s: w.s, n: w.n, t: w.t, side: w.side, sp: Math.max(w.along, RUN0 + 0.5), time: 0}; P.vy = clamp(P.vy, 1.6, 3.0); P.climbs = 1; P.top = Math.max(P.top, RUN0 + 0.5);
  play('pkStep', 0.7, 0, false); if (window.__stat) window.__stat('wallRuns');
}
function wallStep(h){
  const P = pk, W = P.wr; W.time += h;
  if (P.buf > 0){ // kick off the wall
    P.buf = 0; P.st = 'run'; P.ground = false; P.vx = W.t[0]*W.sp*0.92 + W.n[0]*4.6; P.vz = W.t[1]*W.sp*0.92 + W.n[1]*4.6; P.vy = JUMP_V; P.lastWall = W.s; P.wallCool = 0.3; P.wr = null; P.airT = 0;
    play('pkStep', 0.8, 0, false); return move(h);
  }
  W.sp = Math.max(RUN0 - 1.0, W.sp - 0.45*h);
  P.vx = W.t[0]*W.sp - W.n[0]*0.6; P.vz = W.t[1]*W.sp - W.n[1]*0.6;     // pressed lightly against the wall
  P.vy -= 9*h; P.vy = Math.max(P.vy, -6);
  move(h);
  if (P.hits.some(s => s !== W.s)){ const L = findLedge(true); if (L){ P.wr = null; startMantle(L.tx, L.tz, L.top, 'step'); P.anim.dur = 0.22; P.anim.keep = Math.max(W.sp*0.85, RUN0 - 1.0); return; }   // something low ahead: up and over
    P.st = 'run'; P.lastWall = W.s; P.wallCool = 0.15; P.wr = null; P.vx += W.n[0]*0.8; P.vz += W.n[1]*0.8; P.airT = 0.2; return; }   // something in the way: drop off the wall
  const px = P.x - W.n[0]*(R + 0.38), pz = P.z - W.n[1]*(R + 0.38), still = pointIn(px, P.y + 1.0, pz);
  if (P.ground || !still || W.time > 1.3 || inp.f < -0.3 || (still && topAt(still, px, pz) < P.y + 1.2)){
    P.st = P.ground ? 'run' : 'run'; P.lastWall = W.s; P.wallCool = 0.15; P.wr = null; if (!P.ground){ P.vx += W.n[0]*0.8; P.vz += W.n[1]*0.8; P.airT = 0.2; }
  } else if (Math.floor(W.time/0.21) !== Math.floor((W.time - h)/0.21)) play('pkStep', 0.45, 0, false);
}
function startClimb(w){
  const P = pk; P.st = 'climb'; P.cl = {s: w.s, n: w.n, time: 0}; P.climbs = 0; P.vy = 5.9; P.vx = P.vz = 0; P.ground = false; P.buf = 0; play('pkStep', 0.7, 0, false);
}
function climbStep(h){
  const P = pk, C = P.cl; C.time += h;
  if (P.buf > 0 && C.time > 0.06){ // turn around and kick off
    P.buf = 0; const n = C.n; P.turn = {from: P.yaw, to: Math.atan2(-n[0], -n[1]), t: 0};
    let d = P.turn.to - P.turn.from; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; P.turn.to = P.turn.from + d;
    P.st = 'run'; P.cl = null; P.vx = n[0]*5.4; P.vz = n[1]*5.4; P.vy = 5.4; P.lastWall = C.s; P.wallCool = 0.3; P.airT = 0; P.climbs = 0; play('pkStep', 0.8, 0, false); return move(h);
  }
  P.vy -= 9*h; P.vx = -C.n[0]*0.3; P.vz = -C.n[1]*0.3;
  const L = findLedge(true); if (L){ startMantle(L.tx, L.tz, L.top, 'mantle'); return; }
  move(h);
  if (Math.floor(C.time/0.17) !== Math.floor((C.time - h)/0.17)) play('pkStep', 0.5, 0, false);
  if (C.time > 0.62 || P.vy < -1.5 || P.ground){ P.st = 'run'; P.cl = null; if (!P.ground){ P.vx = C.n[0]*1.2; P.vz = C.n[1]*1.2; P.airT = 0.2; } }
}
function zipTry(pressed){
  const P = pk; if (P.zipCool > 0 || P.ground && !pressed) return false;
  const a = ZIP.a, b = ZIP.b, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), u = d.map(v => v/L);
  const hx = P.x - a[0], hy = P.y + HAND - a[1], hz = P.z - a[2], s = clamp(hx*u[0] + hy*u[1] + hz*u[2], 0, L);
  const dist = Math.hypot(a[0] + u[0]*s - P.x, a[1] + u[1]*s - P.y - HAND, a[2] + u[2]*s - P.z);
  if (dist > (pressed ? 1.2 : 0.95) || s > L - ZIP_BRAKE - 0.5) return false;
  const v0 = Math.max(4, P.vx*u[0] + P.vz*u[2] + Math.max(0, -P.vy)*0.3);
  P.zip = {s, v: v0, L, u}; P.st = 'zip'; P.ground = false; P.climbs = 1; play('pkGrab', 0.8, 0); return true;
}
function zipStep(h){
  const P = pk, Z = P.zip, a = ZIP.a;
  const braking = Z.s > Z.L - ZIP_BRAKE;
  if (braking){ if (!Z.braked){ Z.braked = 1; play('pkSlide', 0.9, 0); } Z.v = Math.max(3, Z.v - 16*h); }
  else Z.v = Math.min(14, Z.v + (-Z.u[1]*9.8 - 0.012*Z.v*Z.v)*h);
  Z.s += Z.v*h;
  P.x = a[0] + Z.u[0]*Z.s; P.y = a[1] + Z.u[1]*Z.s - HAND; P.z = a[2] + Z.u[2]*Z.s;
  if (P.buf > 0 || Z.s >= Z.L - 0.6){
    const end = Z.s >= Z.L - 0.6; P.buf = 0; P.st = 'run'; P.vx = Z.u[0]*Z.v; P.vz = Z.u[2]*Z.v; P.vy = end ? 0 : Math.max(Z.u[1]*Z.v*0.35, -3) + 2.5; P.zip = null; P.zipCool = 0.8; P.airT = 0;
  }
}

// ======================================================= the run =======================================================
function teleport(at){ const P = pk; Object.assign(P, {x: at.x, y: at.y, z: at.z, yaw: at.yaw, pitch: -0.05, vx: 0, vy: 0, vz: 0, st: 'run', anim: null, wr: null, cl: null, zip: null, ground: true, h: H_STAND, top: RUN0, camY: at.y, stagger: 0, roll: 0, roll3: 0, turn: null}); }
function respawn(){ const P = pk, run = P.run;
  if (run.phase === 'run'){ run.falls++; const c = run.cp > 0 ? CPS[run.cp - 1].at : START; teleport(c); }
  else teleport(START);
}
function restart(){ const P = pk; P.run = {phase: 'ready', t: 0, cp: 0, splits: [], falls: 0, rec: [], recT: 0}; P.result = null; card.style.display = 'none'; teleport(START); P.fade = 0.5; lamps(); }
function lamps(){ cpLamps.forEach((l, i) => l.material.color.setHex(pk && pk.run.phase !== 'ready' && pk.run.cp > i ? 0x3dff7a : 0xffc400)); }
function flash(text, color, sub){ if (pk) pk.flash = {text, color: color || '#fff', sub, at: performance.now()}; }
function runLogic(dt){
  const P = pk, run = P.run;
  if (run.phase === 'ready'){
    if (P.x > LINE_X && P.z > 4.4 && P.z < 8.6 && P.y > -0.3){ run.phase = 'run'; run.t = 0; run.rec = []; run.recT = 0; flash('GO!', '#69f0ae'); lamps(); }
    return;
  }
  if (run.phase !== 'run') return;
  run.t += dt*1000; run.recT += dt;
  if (run.recT >= 0.1){ run.recT -= 0.1; run.rec.push([+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2), +P.yaw.toFixed(2)]); }
  const c = CPS[run.cp];
  if (c && P.x > c.x0 && P.x < c.x1 && P.z > c.z0 && P.z < c.z1 && P.y > c.y0 && P.y < c.y1){
    run.splits.push(Math.round(run.t)); run.cp++; lamps(); play('pkCheck', 0.7, 0);
    const pb = saved.splits && saved.splits[run.cp - 1]; flash('Checkpoint ' + run.cp + ' · ' + c.name, '#ffd54f', pb != null ? {d: run.t - pb} : null);
  }
  if (run.cp === CPS.length && P.st !== 'zip' && P.x > FINISH.x0 && P.x < FINISH.x1 && P.z > FINISH.z0 && P.z < FINISH.z1 && P.y < -0.2) finish();
}
function finish(){
  const P = pk, run = P.run, t = Math.round(run.t), prev = saved.best, pb = prev == null || t < prev;
  run.phase = 'done'; play('pkFinish', 0.9, 0);
  if (pb){ saved.best = t; saved.splits = run.splits.slice(); saved.ghost = run.rec; store(); }
  const myId = G.mp && G.mp.parkour ? G.mp.parkour.id() : null, remote = myId && LB.get(myId);
  if (myId && (!remote || t < remote.t)) G.mp.parkour.save({t, s: run.splits.slice(), d: Date.now()});
  if (myId && (!remote || t < remote.t)) LB.set(myId, Object.assign({}, remote || {}, {t, n: (G.mp.myName && G.mp.myName()) || 'You'}));
  boardDirty = true;
  const rank = myId ? ranking().findIndex(([id]) => id === myId) + 1 : 0;
  P.result = {t, prev, pb, rank, splits: run.splits.slice(), falls: run.falls};
  const A = window.__ach; if (A){ A('pk_first'); if (t < FAST) A('pk_fast'); if (t < FLOW) A('pk_flow'); if (!run.falls) A('pk_clean'); if (pb && prev != null) A('pk_pb'); if (rank === 1) A('pk_top'); }
  renderResults();
}
function renderResults(){
  const r = pk.result, t = isTouch(), rows = ranking().slice(0, 5), myId = G.mp && G.mp.parkour ? G.mp.parkour.id() : null;
  card.innerHTML = `<div style="font-size:30px;line-height:1">🏁</div><h1 style="font-size:21px;margin:6px 0 2px;font-weight:600">${fmt(r.t)}</h1>`
    + `<div style="font-size:13px;color:#454b55">${r.pb ? (r.prev != null ? `New personal best! (${fmtD(r.t - r.prev)} s)` : 'Your first finish!') : `Your best: <b style="color:#1d2229">${fmt(r.prev)}</b> (${fmtD(r.t - r.prev)} s)`}${r.rank ? ` · #${r.rank} on the board` : ''}</div>`
    + `<div style="display:grid;grid-template-columns:auto auto;gap:2px 18px;color:#454b55;font-size:13px;margin-top:8px">`
    + r.splits.map((s, i) => `<span>Checkpoint ${i + 1} · ${CPS[i].name}</span><b style="color:#1d2229">${fmt(s)}</b>`).join('') + `<span>Falls</span><b style="color:#1d2229">${r.falls}</b></div>`
    + (rows.length ? `<div style="margin-top:10px;border-top:1px solid #e3e6ea;padding-top:8px">${rows.map(([id, v], i) => `<div style="display:flex;gap:8px;font-size:13px;${id === myId ? 'font-weight:700' : ''}"><span style="width:16px">${i + 1}</span><span style="flex:1">${esc(v.n || '?')}</span><span>${fmt(v.t)}</span></div>`).join('')}</div>` : '')
    + `<button type="button" data-again style="margin-top:12px;width:100%;font-size:16px;padding:10px;border:0;border-radius:10px;background:#2f5d9e;color:#fff;font-weight:600">Run again${t ? '' : ' (Enter)'}</button>`
    + `<button type="button" data-leave style="width:100%;margin-top:6px;font-size:14px;padding:8px;border:0;border-radius:10px;background:#e8ebef;color:#1d2229">Back inside${t ? '' : ' (E)'}</button>`;
  card.style.display = 'block';
  const on = (sel, fn) => card.querySelectorAll(sel).forEach(b => { const go = e => { e.preventDefault(); e.stopPropagation(); fn(); }; b.addEventListener('click', go); b.addEventListener('touchend', go); });
  on('[data-again]', restart); on('[data-leave]', () => leave());
}

// ======================================================= entering and leaving =======================================================
let baseFov = 70;
function enter(){
  try { sound.unlock(); } catch (e) {}
  pk = newPlayer(START); pk.fade = 0.5; inp.f = inp.s = 0; inp.jumpHeld = inp.crouch = false;
  G.controlLock = {aim, press(){}};
  G.zoneOverride = 'Rooftop parkour'; lamps();
  if (pads) pads.style.display = 'block';
  play('thud', 0.5, 0, true); if (window.__ach) window.__ach('pk_out');
  if (!saved.seenHelp){ saved.seenHelp = 1; store(); pk.help = 14; } else pk.help = 5;
}
function leave(){
  if (!pk) return; const P = pk; pk = null;
  G.controlLock = null; G.feetY = null; G.zoneOverride = null; card.style.display = 'none'; ghostMesh.visible = false;
  if (pads) pads.style.display = 'none'; touch.id = null; touch.jump = touch.crouch = false;
  G.camera.fov = baseFov; G.camera.updateProjectionMatrix(); G.camera.rotation.z = 0;
  g2.clearRect(0, 0, cv.width, cv.height); loop('wind', 0); loop('zip', 0);
  G.setView(49.0, DOOR_Z, Math.PI/2, 0); play('thud', 0.5, 0, true);
}
function aim(dx, dy, s){ if (!pk) return; const k = s >= 2.4 ? 0.0065 : 0.0022*s; pk.yaw -= dx*k; pk.pitch = clamp(pk.pitch - dy*k, -1.45, 1.45); if (pk.turn){ pk.turn.from -= dx*k; pk.turn.to -= dx*k; } }
const nearEastDoorInside = () => { const s = G.state; return s.lv === 0 && Math.abs(s.y || 0) < 0.6 && Math.abs(s.z - DOOR_Z) < 0.85 && s.x > 48.3 && s.x < 50.1; };
const nearEastDoorOutside = () => pk && pk.x < 51.3 && Math.abs(pk.z - DOOR_Z) < 0.9 && Math.abs(pk.y) < 0.3;

function use(){
  if (pk){
    if (pk.result){ leave(); return true; }
    if (nearEastDoorOutside()){ leave(); return true; }
    return true;
  }
  if (!G.state.started || G.controlLock) return false;
  if (nearEastDoorInside()){ enter(); return true; }
  return false;
}

// ======================================================= every frame =======================================================
function camera(dt){
  const P = pk, cam = G.camera, sp = hsp();
  // eye height: crouch / slide low, smooth step-ups
  const eyeT = P.h < 1.5 ? EYE_LOW : EYE_STAND; P.eye += (eyeT - P.eye)*Math.min(1, dt*14);
  if (P.ground && Math.abs(P.y - P.camY) < 0.5 && P.st !== 'anim') P.camY += (P.y - P.camY)*Math.min(1, dt*22); else P.camY = P.y;
  // landing dip (a spring)
  P.dipV += (-P.dip*140 - P.dipV*15)*dt; P.dip += P.dipV*dt; P.dip = clamp(P.dip, -0.55, 0.2);
  // head bob and footsteps
  let bob = 0;
  if (P.ground && (P.st === 'run' || P.st === 'crouch') && sp > 0.8){
    const prev = P.bob; P.bob += dt*sp*(P.st === 'crouch' ? 2.6 : 3.3); bob = Math.abs(Math.sin(P.bob))*0.045*Math.min(1, sp/5) - 0.02;
    if (Math.floor(prev/Math.PI) !== Math.floor(P.bob/Math.PI)) play('pkStep', clamp(sp/9, 0.15, 0.7), 0, P.groundS && P.groundS.metal);
  }
  if (P.turn){ P.turn.t += dt/0.2; const u = ease(Math.min(1, P.turn.t)); P.yaw = P.turn.from + (P.turn.to - P.turn.from)*u; if (P.turn.t >= 1) P.turn = null; }
  // roll: a forward roll on landing
  let pitchAdd = 0; if (P.roll3 > 0){ P.roll3 = Math.max(0, P.roll3 - dt); const u = 1 - P.roll3/0.55; pitchAdd = -Math.PI*2*ease(u); }
  // mantle / vault: a little dip of the view
  if (P.st === 'anim'){ const u = Math.min(1, P.anim.t/P.anim.dur); pitchAdd += (P.anim.kind === 'vault' ? -0.12 : -0.22)*Math.sin(Math.PI*u); }
  // roll the camera on a wall run, away from the wall
  const rollT = P.st === 'wall' ? -0.17*P.wr.side : 0; P.camRoll += (rollT - P.camRoll)*Math.min(1, dt*9);
  const rollEye = P.roll3 > 0 ? -0.7*Math.sin(Math.PI*(1 - P.roll3/0.55)) : 0;
  cam.position.set(P.x, P.camY + P.eye + bob + P.dip + rollEye, P.z);
  cam.rotation.set(P.pitch + pitchAdd, P.yaw, P.camRoll);
  // field of view widens with speed
  baseFov = innerWidth < innerHeight ? 80 : 70;
  const speed3 = P.st === 'zip' ? P.zip.v : Math.hypot(sp, P.ground ? 0 : P.vy*0.5);
  const fovT = baseFov + clamp((speed3 - 5.5)*2.2, 0, 15) + (P.st === 'zip' ? 3 : 0); P.fovK += (fovT - P.fovK)*Math.min(1, dt*5);
  cam.fov = P.fovK; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  // wind and the zipline trolley
  loop('wind', clamp((speed3 - 5)/12, 0, 0.42)); loop('zip', P.st === 'zip' ? clamp(P.zip.v/14, 0.15, 0.5) : 0);
  P.speed3 = speed3;
}
function drawGhost(){
  const P = pk, g = saved.ghost; if (!P || P.run.phase !== 'run' || !g || !g.length){ ghostMesh.visible = false; return; }
  const k = P.run.t/100, i = Math.floor(k), a = g[i], b = g[i + 1] || a; if (!a){ ghostMesh.visible = false; return; }
  const u = k - i; ghostMesh.position.set(a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u, a[2] + (b[2] - a[2])*u); ghostMesh.rotation.y = a[3];
  ghostMesh.visible = Math.hypot(ghostMesh.position.x - P.x, ghostMesh.position.z - P.z) > 1.0;
}
function hud(dt){
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W*dpr) || cv.height !== Math.round(H*dpr)){ cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, W, H); const P = pk; if (!P) return;
  const small = W < 560, run = P.run;
  // speed lines
  const sp = P.speed3 || 0;
  if (sp > 8.8){ const a = clamp((sp - 8.8)/5, 0, 0.5); g2.strokeStyle = `rgba(255,255,255,${a})`; g2.lineWidth = 1.5; for (let i = 0; i < 18; i++){ const ang = Math.random()*Math.PI*2, r0 = Math.max(W, H)*(0.42 + Math.random()*0.15), r1 = r0 + 40 + Math.random()*80; g2.beginPath(); g2.moveTo(W/2 + Math.cos(ang)*r0, H/2 + Math.sin(ang)*r0); g2.lineTo(W/2 + Math.cos(ang)*r1, H/2 + Math.sin(ang)*r1); g2.stroke(); } }
  // crosshair dot
  g2.fillStyle = 'rgba(255,255,255,.75)'; g2.beginPath(); g2.arc(W/2, H/2, 2.2, 0, 7); g2.fill();
  // timer
  const bw = small ? 230 : 280, bx = W/2 - bw/2, by = small ? 196 : 64;
  g2.fillStyle = 'rgba(20,24,30,.7)'; g2.fillRect(bx, by, bw, 46); g2.fillStyle = '#ffc400'; g2.fillRect(bx, by, 4, 46);
  g2.textBaseline = 'middle'; g2.textAlign = 'left'; g2.fillStyle = '#fff';
  if (run.phase === 'ready'){ g2.font = '800 16px system-ui, sans-serif'; g2.fillText('Rooftop run', bx + 14, by + 15); g2.font = '600 12px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,255,255,.8)'; g2.fillText('cross the line to start the clock', bx + 14, by + 34); }
  else { g2.font = '800 22px ui-monospace, Consolas, monospace'; g2.fillText(fmt(run.phase === 'done' && P.result ? P.result.t : run.t), bx + 14, by + 17); g2.font = '600 12px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,255,255,.8)'; g2.fillText(`checkpoint ${run.cp}/${CPS.length}${run.falls ? ' · falls ' + run.falls : ''}`, bx + 14, by + 36); }
  g2.textAlign = 'right'; g2.font = '600 12px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,255,255,.8)'; g2.fillText('best ' + fmt(saved.best), bx + bw - 12, by + 15);
  g2.font = '700 13px system-ui, sans-serif'; g2.fillStyle = '#fff'; g2.fillText(Math.round(sp*3.6) + ' km/h', bx + bw - 12, by + 34);
  if (!isTouch()){ g2.textAlign = 'center'; g2.font = '600 11px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,255,255,.7)'; g2.fillText('R checkpoint · Backspace full reset', W/2, by + 58); }
  // messages
  g2.textAlign = 'center';
  if (P.flash){ const a = (performance.now() - P.flash.at)/1000, dur = 1.8; if (a > dur) P.flash = null; else {
    g2.globalAlpha = Math.min(1, (dur - a)*3); g2.font = '900 26px system-ui, sans-serif'; g2.lineWidth = 6; g2.strokeStyle = 'rgba(20,24,30,.8)'; g2.fillStyle = P.flash.color;
    g2.strokeText(P.flash.text, W/2, H*0.3); g2.fillText(P.flash.text, W/2, H*0.3);
    if (P.flash.sub){ const d = P.flash.sub.d, txt = fmtD(d) + ' s'; g2.font = '800 22px ui-monospace, Consolas, monospace'; g2.fillStyle = d <= 0 ? '#69f0ae' : '#ff6e6e'; g2.strokeText(txt, W/2, H*0.3 + 30); g2.fillText(txt, W/2, H*0.3 + 30); }
    g2.globalAlpha = 1; } }
  if (rDown && performance.now() - rDown > 200){ const u = Math.min(1, (performance.now() - rDown)/700); g2.fillStyle = 'rgba(20,24,30,.7)'; g2.fillRect(W/2 - 90, H*0.62, 180, 10); g2.fillStyle = '#ffc400'; g2.fillRect(W/2 - 90, H*0.62, 180*u, 10); g2.font = '700 13px system-ui, sans-serif'; g2.fillStyle = '#fff'; g2.fillText('restart', W/2, H*0.62 - 12); }
  if (P.help > 0){ P.help -= dt; g2.globalAlpha = Math.min(1, P.help); g2.font = '600 13px system-ui, sans-serif'; const y = isTouch() ? H - 200 : H - 34;
    const lines = isTouch() ? ['Left: move · right: look · Jump / Slide buttons · ↺ full reset', 'Run along a wall in the air: wall run · run at a wall + Jump: climb · yellow = grab / run here'] : ['W A S D run · Space jump (hold = higher) · C slide, or tap C just before a big landing to roll', 'Jump next to a wall: wall run · jump at a wall: climb (Space again: kick off) · yellow = grab / run here', 'R back to the last checkpoint · Backspace full reset (back to the start)'];
    g2.lineWidth = 4; g2.strokeStyle = 'rgba(20,24,30,.8)'; g2.fillStyle = '#fff'; lines.forEach((l, i) => { g2.strokeText(l, W/2, y - (lines.length - 1 - i)*20); g2.fillText(l, W/2, y - (lines.length - 1 - i)*20); }); g2.globalAlpha = 1; }
  // fade (respawn)
  if (P.fade > 0){ g2.fillStyle = `rgba(10,12,16,${Math.min(1, P.fade*2.2)})`; g2.fillRect(0, 0, W, H); }
}
function tick(dt, keys){
  if (!G) return '';
  if (boardDirty){ boardDirty = false; boards.forEach(drawBoard); }
  if (!pk){
    if (hintEl.style.visibility) hintEl.style.visibility = '';
    if (!G.state.started || G.controlLock) return '';
    if (nearEastDoorInside()) return (isTouch() ? 'Tap to ' : 'Press E to ') + 'go out to the rooftop parkour course 🏃';
    return '';
  }
  const P = pk, live = G.state.started;
  if (live && !P.result){
    inp.f = ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0); inp.s = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
    inp.walk = !!(keys.ShiftLeft || keys.ShiftRight);
    if (touch.id !== null){ const dx = (touch.x - touch.x0)/55, dy = (touch.y - touch.y0)/55; inp.s = clamp(dx, -1, 1); inp.f = clamp(-dy, -1, 1); }
    if (P.stagger > 0 || P.fade > 0.25){ inp.f *= 0.3; inp.s *= 0.3; }
    if (rDown && performance.now() - rDown > 700){ rDown = 0; restart(); }
    // physics in small steps
    const n = Math.ceil(dt/0.008), h = dt/n; for (let i = 0; i < n && pk; i++) step(h);
    if (P.y < KILL_Y && P.dead <= 0){ P.dead = 0.55; play('whoosh', 0.6, 0); }
    if (P.dead > 0){ P.dead -= dt; P.fade = Math.min(1, P.fade + dt*3); if (P.dead <= 0){ respawn(); P.fade = 0.5; } }
    else P.fade = Math.max(0, P.fade - dt*1.6);
    safe('run', () => runLogic(dt));
  } else if (P.result){ inp.f = inp.s = 0; P.fade = Math.max(0, P.fade - dt*1.6); }
  if (!pk) return '';
  camera(dt);
  G.feetY = P.y; G.setView(P.x, P.z, P.yaw, P.pitch);
  safe('ghost', drawGhost); safe('hud', () => hud(dt));
  const hint = P.result ? '' : nearEastDoorOutside() ? (isTouch() ? 'Tap to ' : 'Press E to ') + 'go back inside' : '';
  hintEl.style.visibility = hint ? '' : 'hidden';   // other modules' prompts (post-its, doors…) make no sense out here
  return hint;
}
function safe(what, fn){ try { fn(); } catch (e){ if (!failed[what]){ failed[what] = 1; console.error('parkour.js ' + what + ':', e); } } }

function onKey(e){
  if (!pk) return; const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
  const down = e.type === 'keydown', eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (e.code === 'Space'){ eat(); if (down && !e.repeat) pressJump(); else if (!down) inp.jumpHeld = false; return; }
  if (e.code === 'KeyC'){ eat(); inp.crouch = down; if (down && !e.repeat) pressCrouch(); return; }
  if (e.code === 'KeyR'){ eat(); if (pk.result) return; if (down && !e.repeat) rDown = performance.now(); else if (!down && rDown){ if (performance.now() - rDown < 600){ pk.dead = 0.3; } rDown = 0; } return; }
  if (e.code === 'Backspace'){ eat(); if (down && !e.repeat){ rDown = 0; restart(); } return; }   // full reset: back to the start, clock cleared
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && pk.result){ eat(); if (down && !e.repeat) restart(); }
}

function buildTouch(){
  pads = el('div', 'position:fixed;inset:0;display:none;z-index:3;pointer-events:none');
  stick = el('div', 'position:absolute;left:0;bottom:0;width:45%;height:60%;pointer-events:auto', pads);
  const knob = el('div', 'position:absolute;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;background:rgba(255,255,255,.55);display:none;pointer-events:none', pads);
  stick.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; if (touch.id !== null) return; touch.id = t.identifier; touch.x0 = touch.x = t.clientX; touch.y0 = touch.y = t.clientY; knob.style.display = 'block'; knob.style.left = t.clientX + 'px'; knob.style.top = t.clientY + 'px'; }, {passive: false});
  stick.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === touch.id){ touch.x = t.clientX; touch.y = t.clientY; knob.style.left = clamp(t.clientX, touch.x0 - 55, touch.x0 + 55) + 'px'; knob.style.top = clamp(t.clientY, touch.y0 - 55, touch.y0 + 55) + 'px'; } }, {passive: false});
  const end = e => { for (const t of e.changedTouches) if (t.identifier === touch.id){ touch.id = null; knob.style.display = 'none'; } };
  stick.addEventListener('touchend', end); stick.addEventListener('touchcancel', end);
  const btn = (label, right, bottom, size, on, off) => { const b = el('div', `position:absolute;right:${right}px;bottom:${bottom}px;width:${size}px;height:${size}px;border-radius:50%;background:rgba(20,24,30,.5);border:2px solid #ffc400;color:#fff;font:700 15px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:auto;user-select:none`, pads); b.textContent = label;
    b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); b.style.background = 'rgba(255,196,0,.6)'; on(); }, {passive: false});
    const up = e => { e.preventDefault(); b.style.background = 'rgba(20,24,30,.5)'; off(); }; b.addEventListener('touchend', up); b.addEventListener('touchcancel', up); };
  btn('Jump', 24, 120, 92, () => { touch.jump = true; pressJump(); }, () => { touch.jump = false; inp.jumpHeld = false; });
  btn('Slide', 128, 70, 70, () => { touch.crouch = true; pressCrouch(); }, () => { touch.crouch = false; });
  btn('↺', 24, 230, 48, () => { if (pk && !pk.result) restart(); }, () => {});
}

function init(){
  G = window.GAME; THREE = G.THREE; if (!G.scene) return;
  buildCourse(); hintEl = document.getElementById('doorHint');
  cv = el('canvas', 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2'); g2 = cv.getContext('2d');
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:16px 18px 14px;width:min(380px,calc(100vw - 32px));box-sizing:border-box;line-height:1.4;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35);max-height:calc(100vh - 32px);overflow:auto');
  if (isTouch()) buildTouch();
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  addEventListener('blur', () => { inp.jumpHeld = inp.crouch = false; rDown = 0; });
  G.uses.unshift({tick, use});
  // the leaderboard (mp.js loads after us: wait for it)
  const hook = () => { if (G.mp && G.mp.parkour){ G.mp.parkour.listen(onLB); return true; } return false; };
  if (!hook()){ const iv = setInterval(() => { if (hook()) clearInterval(iv); }, 1000); }
}

window.PARKOUR = {get me(){ return pk; }, SOL, enter, leave, restart, saved, LB,   // for testing in the console
  go(i){ if (!pk) enter(); const c = i ? CPS[i - 1].at : START; teleport(c); if (pk.run.phase === 'ready' && i){ pk.run.phase = 'run'; pk.run.cp = i; } lamps(); }};
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
