// Whiteboards everyone can draw on. Walk up to a whiteboard, face it and press E (or tap the prompt): the view moves in front
// of the board and you draw by holding the mouse button (or with a finger). 1–4 pick a marker colour, 5 the eraser,
// C twice wipes the board, E (or walking) steps back. Strokes are shared through mp.js (boards/<board>/<stroke> in the
// database), so everyone sees the drawings live, and they are still there next time. Without multiplayer, drawings stay local.

const COLORS = ['#1b1b1b', '#2342be', '#cf1430', '#2e8b3e', '#fbfbf8'], WIDTH = [5, 5, 5, 5, 48], ERASER = 4, Q = 1000;
let G, THREE, ray, net = null, state = null, cursor, bar, help, dirty = new Set(), redraws = new Set();
const isTouch = () => !!window.__isTouch;

function el(tag, css, parent){ const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; }

function init(){
  G = window.GAME; THREE = G.THREE; ray = new THREE.Raycaster();
  for (const b of G.boards) b.strokes = new Map();
  cursor = el('div', 'position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.5);pointer-events:none;display:none;z-index:3');
  bar = el('div', 'position:fixed;left:50%;bottom:54px;transform:translateX(-50%);display:none;gap:8px;align-items:center;z-index:3;background:rgba(20,24,30,.72);border-radius:14px;padding:8px 10px');
  const btn = (label, title, fn, css) => { const b = el('button', 'min-width:38px;height:38px;border-radius:10px;border:2px solid transparent;font-size:15px;font-weight:600;cursor:pointer;color:#fff;background:rgba(255,255,255,.12);' + (css || ''), bar);
    b.textContent = label; b.title = title; const go = e => { e.preventDefault(); e.stopPropagation(); fn(); }; b.addEventListener('click', go); b.addEventListener('touchstart', go); return b; };
  bar.pens = COLORS.map((c, i) => btn(i === ERASER ? '⌫' : '', i === ERASER ? 'Eraser (5)' : `Marker (${i + 1})`, () => pick(i), i === ERASER ? '' : `background:${c};`));
  btn('🗑', 'Wipe the board (C twice)', () => wipe(true));
  btn(isTouch() ? 'Done' : 'Done (E)', 'Step back', () => stop(), 'padding:0 10px;background:#2f5d9e');
  help = el('div', 'position:fixed;left:50%;bottom:104px;transform:translateX(-50%);display:none;z-index:3;color:#fff;font-size:12px;background:rgba(20,24,30,.55);border-radius:8px;padding:4px 10px;pointer-events:none;white-space:nowrap');
  help.textContent = isTouch() ? 'Draw with your finger' : 'Hold the mouse button to draw · 1–4 colour · 5 eraser · C C wipe · E done';
  addEventListener('keydown', e => {
    if (!state || e.repeat) return; const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
    const n = {Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, KeyX: 4}[e.code]; if (n !== undefined) pick(n);
    if (e.code === 'KeyC') wipe(false);
  });
  G.uses.unshift({tick, use});
  if (window.__boardNet) connect(); else addEventListener('board-net', connect, {once: true});
}

// ---------- shared strokes ----------
function connect(){
  net = window.__boardNet; if (!net) return;
  for (const b of G.boards) net.listen(b.id, (id, d) => { if (!d || b.strokes.has(id)) return; b.strokes.set(id, d); paint(b, d); },
    id => { if (b.strokes.delete(id)) redraws.add(b); });
}
// "u,v u,v …" with u, v in 0..1000 (left → right, bottom → top as you face the board)
function decode(p){ const out = []; for (const pt of String(p).split(' ')){ const [u, v] = pt.split(','); if (u !== undefined && v !== undefined) out.push([+u, +v]); } return out; }
function paint(b, d){ const pts = decode(d.p); if (!pts.length) return; line(b, pts, d.c | 0, d.w | 0); }
function line(b, pts, c, w){
  const g = b.ctx, W = b.canvas.width, H = b.canvas.height, X = u => u/Q*W, Y = v => (1 - v/Q)*H;
  g.strokeStyle = g.fillStyle = COLORS[c] || COLORS[0]; g.lineWidth = WIDTH[w] || WIDTH[0]; g.lineCap = 'round'; g.lineJoin = 'round';
  if (pts.length === 1){ g.beginPath(); g.arc(X(pts[0][0]), Y(pts[0][1]), g.lineWidth/2, 0, 7); g.fill(); }
  else { g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1])); for (let i=1;i<pts.length;i++) g.lineTo(X(pts[i][0]), Y(pts[i][1])); g.stroke(); }
  dirty.add(b);
}
function redraw(b){ const g = b.ctx; g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, b.canvas.width, b.canvas.height); for (const d of b.strokes.values()) paint(b, d); dirty.add(b); }

// ---------- drawing ----------
function nearBoard(){
  if (G.state.si) return null;                                            // not while sitting
  const v = G.getView(), fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
  let best = null, bd = 2.2;
  for (const b of G.boards){
    if (b.mode !== v.mode) continue;
    const d = (v.x - b.x)*b.dir, zc = (b.z0 + b.z1)/2; if (d < 0.2 || d > bd || v.z < b.z0 - 0.5 || v.z > b.z1 + 0.5) continue;
    if (-(fx*b.dir) < 0.55) continue;                                     // you have to look at it
    bd = d; best = b;
  }
  return best;
}
function use(){
  if (state){ stop(); return true; }
  if (!G.state.started || G.controlLock) return false;
  const b = nearBoard(); if (!b) return false;
  start(b); return true;
}
function start(b){
  const back = G.getView(), cam = G.camera, zc = (b.z0 + b.z1)/2, yc = (b.y0 + b.y1)/2, w = b.z1 - b.z0;
  const vf = cam.fov*Math.PI/360, hf = Math.atan(Math.tan(vf)*cam.aspect);
  const d = Math.max(0.7, (w/2 + 0.12)/Math.tan(hf), ((b.y1 - b.y0)/2 + 0.12)/Math.tan(vf));
  G.setView(b.x + b.dir*d, zc, b.dir > 0 ? Math.PI/2 : -Math.PI/2, Math.atan2(yc - (b.base + 1.65), d));
  state = {b, back, pen: state ? state.pen : 0, down: false, cx: innerWidth/2, cy: innerHeight/2, pts: [], sentAt: 0, wipeAt: 0};
  G.controlLock = {aim, press};
  bar.style.display = 'flex'; help.style.display = 'block'; cursor.style.display = 'block'; pick(state.pen);
}
function stop(){
  if (!state) return; flush(true);
  const v = state.back; state = null; G.controlLock = null; G.setView(v.x, v.z, v.yaw, v.pitch);
  bar.style.display = 'none'; help.style.display = 'none'; cursor.style.display = 'none';
}
function pick(i){ if (!state) return; flush(true); state.pen = i; bar.pens.forEach((p, j) => p.style.borderColor = j === i ? '#f2c230' : 'transparent');
  cursor.style.background = i === ERASER ? 'rgba(255,255,255,.4)' : COLORS[i]; const s = i === ERASER ? 30 : 14; cursor.style.width = cursor.style.height = s + 'px'; cursor.style.margin = `-${s/2}px 0 0 -${s/2}px`; }
function wipe(now){
  if (!state) return; const t = performance.now();
  if (!now && t - state.wipeAt > 2000){ state.wipeAt = t; help.textContent = 'Press C again to wipe the whole board'; setTimeout(() => { if (state) help.textContent = isTouch() ? 'Draw with your finger' : 'Hold the mouse button to draw · 1–4 colour · 5 eraser · C C wipe · E done'; }, 2000); return; }
  const b = state.b; state.pts = []; b.strokes.clear(); redraw(b); if (net) net.clear(b.id);
}
// where the cursor touches the board, in 0..1000 board units (null when off the board)
function boardPoint(x, y){
  const b = state.b; ray.setFromCamera({x: x/innerWidth*2 - 1, y: -(y/innerHeight)*2 + 1}, G.camera);
  const o = ray.ray.origin, dr = ray.ray.direction; if (Math.abs(dr.x) < 1e-4) return null;
  const t = (b.x - o.x)/dr.x; if (t <= 0) return null;
  const z = o.z + dr.z*t, yy = o.y + dr.y*t, u = b.dir > 0 ? (b.z1 - z)/(b.z1 - b.z0) : (z - b.z0)/(b.z1 - b.z0), v = (yy - b.y0)/(b.y1 - b.y0);
  if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) return null;
  return [Math.round(Math.max(0, Math.min(1, u))*Q), Math.round(Math.max(0, Math.min(1, v))*Q)];
}
function aim(dx, dy, k, x, y, absolute){
  if (!state) return;
  if (absolute){ state.cx = x; state.cy = y; } else { state.cx = Math.max(0, Math.min(innerWidth, state.cx + dx)); state.cy = Math.max(0, Math.min(innerHeight, state.cy + dy)); }
  if (state.down) addPoint();
}
function press(down, x, y, absolute){
  if (!state) return;
  if (absolute && x !== undefined){ state.cx = x; state.cy = y; }
  if (down && !state.down){ state.down = true; state.pts = []; addPoint(); }
  else if (!down && state.down){ state.down = false; flush(true); }
}
function addPoint(){
  const p = boardPoint(state.cx, state.cy); if (!p){ flush(true); return; }
  const pts = state.pts, last = pts[pts.length - 1];
  if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
  pts.push(p); line(state.b, last ? [last, p] : [p], state.pen, state.pen === ERASER ? 4 : 0);
}
// send the stroke so far (a long stroke goes out in pieces that join up)
function flush(end){
  if (!state) return; const pts = state.pts; if (!pts.length) return;
  const d = {c: state.pen, w: state.pen === ERASER ? 4 : 0, p: pts.map(p => p[0] + ',' + p[1]).join(' ')};
  const id = 'own' + Math.random().toString(36).slice(2);
  if (net) net.add(state.b.id, d); else state.b.strokes.set(id, d);
  if (window.__stat) window.__stat('boardStrokes');
  state.pts = end ? [] : [pts[pts.length - 1]]; state.sentAt = performance.now();
}

function tick(dt, keys){
  if (!G) return '';
  for (const b of redraws) redraw(b); redraws.clear();
  for (const b of dirty) b.tex.needsUpdate = true; dirty.clear();
  if (state){
    cursor.style.transform = `translate(${state.cx}px,${state.cy}px)`;
    if (state.down && state.pts.length > 1 && (performance.now() - state.sentAt > 300 || state.pts.length > 150)) flush(false);
    if (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight) stop();
    return '';
  }
  if (!G.state.started || G.controlLock) return '';
  return nearBoard() ? (isTouch() ? 'Tap to draw on the whiteboard' : 'Press E to draw on the whiteboard') : '';
}

window.BOARDS = {get state(){ return state; }};   // for testing in the console
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
