// Darts on the two boards (4e kitchen, by the drinks storage, and the 3e kitchen).
// Walk to the throw line and press E. Pick a game: 501 (double out), Around the Clock or 9-dart high score.
// Skill: the mouse (or a finger) aims, but your hand sways; the power bar sweeps up and down and you throw with
// Space / a click (or tap "Throw"). Throwing outside the green band sends the dart high or low.
// Scoring follows the real board: singles, doubles (outer ring), trebles (inner ring), 25 and the bull (50).
import {sound, play} from './sound.js';

const LO = -3.06, EYE = 1.65, R_BOARD = 0.27, PX = 256/R_BOARD;   // board texture: 256 px = 0.27 m
const NUMS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
// the boards: centre, the way it faces (towards the player), the player's right on the board, and where you stand at the line
const BOARDS = [
  {name: 'kitchen', lv: 0, base: 0, c: [48.985, 1.73, 10.4], n: [-1, 0, 0], r: [0, 0, 1], stand: [46.5, 10.4], yaw: -Math.PI/2},
  {name: '3e kitchen', lv: 2, base: LO, c: [35.065, LO + 1.73, 9.48], n: [1, 0, 0], r: [0, 0, -1], stand: [37.6, 9.48], yaw: Math.PI/2},
];
const GAMES = {
  '501': {title: '501', desc: 'From 501 to exactly 0, finish on a double (or the bull)', best: 'fewest darts'},
  atc: {title: 'Around the Clock', desc: 'Hit 1 to 20 in order, then the bull', best: 'fewest darts'},
  hs: {title: '9-dart high score', desc: 'Three turns, score as much as you can', best: 'highest score'},
};
const SWEET = 0.75, SWEET_W = 0.08;   // the green band on the power bar

let G, THREE, cv, g2, hud, card, state = null, near = null, dpr = 1, bests = {};
try { bests = JSON.parse(localStorage.getItem('office.dartsBest')) || {}; } catch (e) {}
const saveBests = () => { try { localStorage.setItem('office.dartsBest', JSON.stringify(bests)); } catch (e) {} };
const isTouch = () => !!window.__isTouch;
const el = (tag, css, parent) => { const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; };

// ---------- scoring ----------
// where a dart lands (u right, v up, metres from the bull) → {val, mult, num, label}
export function scoreAt(u, v){
  const x = u*PX, y = -v*PX, r = Math.hypot(x, y);
  if (r <= 7) return {val: 50, mult: 2, num: 25, label: 'Bullseye', bull: true};
  if (r <= 16) return {val: 25, mult: 1, num: 25, label: '25'};
  if (r > 215) return {val: 0, mult: 0, num: 0, label: r > 256 ? 'Missed the board' : 'Outside the doubles'};
  const i = ((Math.round((Math.atan2(y, x) + Math.PI/2)/(Math.PI/10)) % 20) + 20) % 20, num = NUMS[i];
  if (r >= 115 && r <= 130) return {val: num*3, mult: 3, num, label: 'T' + num};
  if (r >= 200) return {val: num*2, mult: 2, num, label: 'D' + num};
  return {val: num, mult: 1, num, label: String(num)};
}
// checkout suggestion for 501: up to `left` darts, last one a double (bull counts as a double)
const SINGLES = [...Array.from({length: 20}, (_, i) => ({v: i + 1, l: String(i + 1)})), {v: 25, l: '25'}];
const TREBLES = Array.from({length: 20}, (_, i) => ({v: (i + 1)*3, l: 'T' + (i + 1)}));
const DOUBLES = [...Array.from({length: 20}, (_, i) => ({v: (i + 1)*2, l: 'D' + (i + 1)})), {v: 50, l: 'Bull'}];
const ANY = [...TREBLES.slice().reverse(), ...SINGLES.slice().reverse(), ...DOUBLES.slice().reverse()];
function checkout(rest, left){
  if (rest > 170 || rest < 2) return null;
  const dbl = DOUBLES.slice().sort((a, b) => [32, 40, 16, 20, 50].indexOf(b.v) - [32, 40, 16, 20, 50].indexOf(a.v));
  for (const d of dbl) if (d.v === rest) return [d.l];
  if (left >= 2) for (const a of ANY) for (const d of dbl) if (a.v + d.v === rest) return [a.l, d.l];
  if (left >= 3) for (const a of ANY) for (const b of ANY) for (const d of dbl) if (a.v + b.v + d.v === rest) return [a.l, b.l, d.l];
  return null;
}

// ---------- setup ----------
function init(){
  G = window.GAME; THREE = G.THREE;
  for (const b of BOARDS){ b.C = new THREE.Vector3(...b.c); b.N = new THREE.Vector3(...b.n); b.R = new THREE.Vector3(...b.r); b.U = new THREE.Vector3(0, 1, 0); b.darts = []; }
  cv = el('canvas', 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2'); g2 = cv.getContext('2d');
  hud = el('div', 'position:fixed;top:72px;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(20,24,30,.78);color:#fff;border-radius:12px;padding:8px 16px 9px;font-size:14px;text-align:center;pointer-events:none;min-width:280px;max-width:90vw'); hud.className = 'gameHud';
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:20px 22px 16px;width:min(360px,88vw);line-height:1.45;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35)');
  // aiming: wrap the toilet game's handler so both minigames share the mouse
  const prevAim = G.onAim;
  G.onAim = (dx, dy, k) => { if (state && state.phase === 'aim'){ state.aim.u += dx*0.0003*k; state.aim.v -= dy*0.0003*k; state.aim.u = Math.max(-0.45, Math.min(0.45, state.aim.u)); state.aim.v = Math.max(-0.45, Math.min(0.45, state.aim.v)); } else if (prevAim) prevAim(dx, dy, k); };
  addEventListener('keydown', onKey, true);
  addEventListener('mousedown', e => { if (e.button === 0 && state && state.phase === 'aim' && !isTouch() && G.state.started) throwDart(); });
  window.__onUseDarts = use; window.__onFrameDarts = frame;
}
function onKey(e){
  if (!state) return; const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
  if (state.phase === 'menu' || state.phase === 'over'){
    const k = {Digit1: '501', Digit2: 'atc', Digit3: 'hs', Numpad1: '501', Numpad2: 'atc', Numpad3: 'hs'}[e.code];
    if (k){ e.preventDefault(); e.stopPropagation(); newGame(k); }
    else if (e.code === 'Enter' && state.phase === 'over'){ e.preventDefault(); e.stopPropagation(); newGame(state.game); }
    return;
  }
  if (e.code === 'Space' && state.phase === 'aim' && !e.repeat){ e.preventDefault(); e.stopPropagation(); throwDart(); }
}

function nearBoard(){
  const st = G.state; if (!st.started) return null;
  for (const b of BOARDS){ if (st.lv !== b.lv || Math.abs(st.y - b.base) > 0.4) continue; if (Math.hypot(st.x - b.stand[0], st.z - b.stand[1]) < 1.3) return b; }
  return null;
}
function use(){
  if (state){ if (state.phase === 'aim' && isTouch()) throwDart(); else quit(); return true; }
  const b = nearBoard(); if (!b) return false;
  try { sound.unlock(); } catch (e) {}
  const dy = b.c[1] - (b.base + EYE); G.setView(b.stand[0], b.stand[1], b.yaw, Math.atan2(dy, Math.hypot(b.c[0] - b.stand[0], b.c[2] - b.stand[1])));
  G.controlLock = true; state = {b, phase: 'menu', fov0: G.camera.fov}; zoom(24); showMenu(); return true;
}
function zoom(f){ G.camera.fov = f; G.camera.updateProjectionMatrix(); }   // focus on the board while playing
function quit(){ clearDarts(state.b); zoom(state.fov0 || 70); state = null; G.controlLock = false; hud.style.display = card.style.display = 'none'; g2.clearRect(0, 0, cv.width, cv.height); }

// ---------- cards ----------
function button(label, sub, onClick, primary){
  const b = document.createElement('button'); b.type = 'button';
  b.style.cssText = `display:block;width:100%;text-align:left;margin-top:8px;padding:10px 12px;border-radius:10px;border:1px solid ${primary ? '#2f5d9e' : '#d5dbe3'};background:${primary ? '#2f5d9e' : '#f6f8fb'};color:${primary ? '#fff' : '#1d2229'};font-size:15px;font-weight:600;cursor:pointer`;
  b.innerHTML = label + (sub ? `<span style="display:block;font-weight:400;font-size:12px;opacity:.75;margin-top:2px">${sub}</span>` : '');
  const go = e => { e.preventDefault(); e.stopPropagation(); onClick(); };
  b.addEventListener('click', go); b.addEventListener('touchend', go); return b;
}
const bestText = k => bests[k] == null ? 'no best yet' : k === 'hs' ? `best ${bests[k]}` : `best ${bests[k]} darts`;
function showMenu(){
  card.innerHTML = `<div style="font-size:28px;line-height:1">🎯</div><h1 style="font-size:20px;margin:6px 0 2px;font-weight:600">Darts</h1>`
    + `<div style="color:#5a6472;font-size:13px">${isTouch() ? 'Drag to aim, tap Throw when the power bar is in the green.' : 'Mouse to aim, Space or click to throw when the power bar is in the green. Your hand sways: wait for the right moment.'}</div>`;
  Object.entries(GAMES).forEach(([k, g], i) => card.appendChild(button(`${isTouch() ? '' : (i + 1) + ' · '}${g.title}`, `${g.desc} · ${bestText(k)}`, () => newGame(k), i === 0)));
  card.appendChild(button(isTouch() ? 'Close' : 'Close (E)', '', quit));
  card.style.display = 'block'; hud.style.display = 'none';
}

// ---------- a game ----------
function newGame(game){
  clearDarts(state.b);
  Object.assign(state, {game, phase: 'aim', aim: {u: 0, v: 0}, t0: performance.now()/1000, darts: 0, turn: [], turnNo: 1,
    score: game === '501' ? 501 : 0, turnStart: 501, target: 1, msg: null, flying: null, total: 0});
  card.style.display = 'none'; hud.style.display = 'block'; updateHud();
}
function say(text, kind){ state.msg = {text, kind, until: performance.now()/1000 + 1.6}; }

// sway (a slow figure-of-eight that wobbles more the longer you aim) and the power bar
function sway(t){ const a = 0.008 + Math.min(0.016, t*0.002); return {u: a*(Math.sin(t*1.3) + 0.45*Math.sin(t*3.1 + 1)), v: a*(Math.sin(t*1.7 + 2) + 0.4*Math.sin(t*2.6))}; }
function power(t){ return 0.5 - 0.5*Math.cos(t*Math.PI*2*0.85); }

function throwDart(){
  const s = state, now = performance.now()/1000, t = now - s.t0;
  if (s.flying || s.phase !== 'aim' || s.turn.length >= 3) return;
  const sw = sway(t), p = power(t), off = p - SWEET, miss = Math.abs(off) > SWEET_W ? (off - Math.sign(off)*SWEET_W) : 0;
  const u = s.aim.u + sw.u + (Math.random() - 0.5)*0.008, v = s.aim.v + sw.v + miss*0.55 + (Math.random() - 0.5)*0.008;
  const hit = scoreAt(u, v);
  s.flying = {u, v, hit, start: now, from: G.camera.localToWorld(new THREE.Vector3(0.12, -0.12, -0.25)), mesh: makeDart(s.b)};
  play('whoosh', 0.8, 0.2);
}
function land(){
  const s = state, f = s.flying, hit = f.hit, b = s.b; s.flying = null;
  placeDart(f.mesh, b, f.u, f.v, true); b.darts.push(f.mesh);
  play('thud', 0.9, 0.1, hit.mult === 0 && Math.hypot(f.u, f.v) > R_BOARD);
  s.darts++; s.turn.push(hit);
  if (hit.bull) play('ding', 0.9, 0); else if (hit.mult === 3) play('ding', 0.7, 0);
  const A = window.__ach || (() => {}); A('d_first'); if (hit.bull) A('d_bull'); if (hit.label === 'T20') A('d_t20'); if (hit.label === 'Missed the board') A('d_miss');
  if (s.game === '501') score501(hit);
  else if (s.game === 'atc'){
    const ok = s.target === 25 ? hit.num === 25 : hit.num === s.target && hit.mult > 0;
    if (ok){ say(s.target === 25 ? 'Bull! Done!' : `${hit.label} ✓`, 'good'); if (s.target === 25) return finish(); s.target = s.target === 20 ? 25 : s.target + 1; }
    else say(hit.mult ? hit.label : hit.label, 'meh');
  } else {
    s.score += hit.val; say(hit.val ? `${hit.label} · ${hit.val}` : hit.label, hit.val >= 50 ? 'good' : 'meh');
  }
  if (s.phase === 'aim' && s.turn.length >= 3) endTurn();
  updateHud();
}
function score501(hit){
  const s = state, rest = s.score - hit.val;
  if (rest < 0 || rest === 1 || (rest === 0 && hit.mult !== 2)){
    say(`Bust! (${hit.label})`, 'bad'); window.__ach && window.__ach('d_bust'); play('buzz', 0.8, 0); s.score = s.turnStart; s.bust = true; while (s.turn.length < 3) s.turn.push(null); return;
  }
  s.score = rest;
  if (rest === 0){ say(`Checkout on ${hit.label}! 🎉`, 'good'); finish(); return; }
  say(hit.val ? `${hit.label} · ${hit.val}` : hit.label, hit.mult === 3 || hit.bull ? 'good' : 'meh');
}
function endTurn(){
  const s = state, tot = s.turn.reduce((a, h) => a + (h ? h.val : 0), 0);
  if (!s.bust && s.game !== 'atc' && window.__ach){ if (tot >= 100) window.__ach('d_100'); if (tot >= 140) window.__ach('d_140'); if (tot === 180) window.__ach('d_180'); }
  if (!s.bust && tot === 180){ say('ONE HUNDRED AND EIGHTY! 🎯', 'good'); play('cheer', 1, 0); window.__mpSay && window.__mpSay('🎯 threw 180 at darts!'); }
  else if (!s.bust && s.game !== 'atc' && tot >= 100) say(`${tot}! Nice turn`, 'good');
  s.phase = 'collect'; s.collectAt = performance.now()/1000 + 1.4;
}
function nextTurn(){
  const s = state; clearDarts(s.b); s.turn = []; s.bust = false; s.turnNo++; s.turnStart = s.score; s.phase = 'aim'; s.t0 = performance.now()/1000;
  if (s.game === 'hs' && s.turnNo > 3) return finish();
  updateHud();
}
function finish(){
  const s = state; s.phase = 'over'; hud.style.display = 'none';
  const k = s.game, val = k === 'hs' ? s.score : s.darts, better = bests[k] == null || (k === 'hs' ? val > bests[k] : val < bests[k]);
  // progress.js: XP and achievements
  if (window.__ach){ const A = window.__ach, X = window.__xp; window.__stat('dartsGames');
    if (k === '501'){ A('d_501'); if (s.darts <= 21) A('d_501pro'); const last = s.turn[s.turn.length - 1]; if (last && last.bull) A('d_bullout'); X(30, 'Game of 501 finished'); }
    if (k === 'atc'){ A('d_atc'); if (s.darts <= 30) A('d_atc30'); X(20, 'Around the Clock finished'); }
    if (k === 'hs'){ if (s.score >= 300) A('d_hs300'); X(Math.max(5, Math.round(s.score/15)), '9-dart high score'); } }
  if (better){ bests[k] = val; saveBests(); }
  if (k === '501' || k === 'atc') play('cheer', 0.8, 0);
  const avg = k === '501' ? (501/s.darts*3).toFixed(1) : null;
  const head = k === '501' ? ['🏆', `Game shot! 501 in ${s.darts} darts`] : k === 'atc' ? ['⏱️', `Around the Clock in ${s.darts} darts`] : [s.score >= 300 ? '🔥' : s.score >= 180 ? '🎯' : '🙂', `${s.score} points in 9 darts`];
  card.innerHTML = `<div style="font-size:28px;line-height:1">${head[0]}</div><h1 style="font-size:20px;margin:6px 0 8px;font-weight:600">${head[1]}</h1>`
    + `<div style="display:grid;grid-template-columns:auto auto;gap:2px 18px;color:#454b55">`
    + (avg ? `<span>3-dart average</span><b style="color:#1d2229">${avg}</b>` : '')
    + `<span>Your best</span><b style="color:#1d2229">${k === 'hs' ? bests[k] : bests[k] + ' darts'}${better ? ' · new best!' : ''}</b></div>`;
  card.appendChild(button(`${isTouch() ? '' : 'Enter · '}Play again`, '', () => newGame(k), true));
  Object.entries(GAMES).filter(([g]) => g !== k).forEach(([g, d]) => card.appendChild(button(d.title, bestText(g), () => newGame(g))));
  card.appendChild(button(isTouch() ? 'Done' : 'Done (E)', '', quit));
  card.style.display = 'block';
  if (better && k !== 'hs' && window.__mpSay) window.__mpSay(k === '501' ? `🎯 finished 501 in ${s.darts} darts` : `🎯 went Around the Clock in ${s.darts} darts`);
  if (better && k === 'hs' && s.score >= 150 && window.__mpSay) window.__mpSay(`🎯 scored ${s.score} with 9 darts`);
}

function updateHud(){
  const s = state, dots = [0, 1, 2].map(i => i < s.turn.length ? (s.turn[i] ? '●' : '✕') : '○').join(' ');
  let main, sub = '';
  if (s.game === '501'){ main = `<b style="font-size:24px">${s.score}</b> left`; const co = checkout(s.score, 3 - s.turn.length); if (co && s.phase === 'aim') sub = 'Checkout: ' + co.join(' · '); }
  else if (s.game === 'atc') main = `Target: <b style="font-size:24px">${s.target === 25 ? 'Bull' : s.target}</b>`;
  else main = `<b style="font-size:24px">${s.score}</b> points · turn ${Math.min(3, s.turnNo)} of 3`;
  hud.innerHTML = `<div style="font-size:12px;opacity:.75">${GAMES[s.game].title} · darts thrown ${s.darts}</div><div>${main}</div>`
    + `<div style="letter-spacing:3px;margin-top:2px">${dots}</div>` + (sub ? `<div style="font-size:12px;color:#f2c230;margin-top:2px">${sub}</div>` : '')
    + `<div style="font-size:11px;opacity:.65;margin-top:3px">${isTouch() ? 'Drag to aim · tap Throw · walk away to stop' : 'Mouse: aim · Space/click: throw · E: stop'}</div>`;
}

// ---------- darts in 3D ----------
const MAT = {};
function makeDart(b){
  if (!MAT.barrel){ MAT.barrel = new THREE.MeshStandardMaterial({color: 0xb8bcc2, metalness: 0.8, roughness: 0.3}); MAT.shaft = new THREE.MeshStandardMaterial({color: 0x1d2229, roughness: 0.5});
    MAT.flight = new THREE.MeshStandardMaterial({color: 0x2f5d9e, roughness: 0.6, side: THREE.DoubleSide}); }
  const g = new THREE.Group();   // built along +z (tip at z = 0, flights at z ≈ 0.15)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0025, 0.03, 8), MAT.barrel); tip.rotation.x = -Math.PI/2; tip.position.z = 0.015; g.add(tip);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.05, 10), MAT.barrel); barrel.rotation.x = Math.PI/2; barrel.position.z = 0.055; g.add(barrel);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.05, 6), MAT.shaft); shaft.rotation.x = Math.PI/2; shaft.position.z = 0.105; g.add(shaft);
  for (const a of [0, Math.PI/2]){ const f = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.035), MAT.flight); f.rotation.z = a; f.rotation.y = Math.PI/2; f.position.z = 0.135; const w = new THREE.Group(); w.rotation.z = a; w.add(f); f.rotation.z = 0; g.add(w); }
  G.scene.add(g); return g;
}
const tmpV = () => new THREE.Vector3();
function boardPoint(b, u, v, out){ return out.copy(b.C).addScaledVector(b.R, u).addScaledVector(b.U, v); }
function placeDart(m, b, u, v, stuck){
  const p = boardPoint(b, u, v, tmpV()); m.position.copy(p).addScaledVector(b.N, stuck ? -0.012 : 0);
  m.lookAt(tmpV().copy(m.position).addScaledVector(b.N, 1)); m.rotateX(-0.12);   // tail points back at the player, slightly up
}
function clearDarts(b){ for (const m of b.darts){ G.scene.remove(m); m.traverse(o => o.geometry && o.geometry.dispose()); } b.darts = []; if (state && state.flying){ G.scene.remove(state.flying.mesh); state.flying = null; } }

// ---------- per frame ----------
function toScreen(p){ p.project(G.camera); return p.z < 1 ? [(p.x + 1)/2*innerWidth, (1 - p.y)/2*innerHeight] : null; }
function frame(dt, keys){
  if (!G) return '';
  if (!state){ near = nearBoard(); return near && !G.controlLock ? (isTouch() ? 'Tap to play darts' : 'Press E to play darts') : ''; }
  const st = G.state, b = state.b, now = performance.now()/1000;
  if (Math.hypot(st.x - b.stand[0], st.z - b.stand[1]) > 0.3 || st.lv !== b.lv){ quit(); return ''; }   // moved away (Jump to…)
  const walking = keys && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);
  if (walking){ quit(); return ''; }   // walking away stops the game
  if (state.flying){ const f = state.flying, k = Math.min(1, (now - f.start)/0.26), to = boardPoint(b, f.u, f.v, tmpV());
    const p = tmpV().lerpVectors(f.from, to, k); p.y += Math.sin(k*Math.PI)*0.07; f.mesh.position.copy(p); f.mesh.lookAt(tmpV().copy(p).addScaledVector(b.N, 1)); f.mesh.rotateX(0.5*(1 - k));
    if (k >= 1) land(); }
  if (state.phase === 'collect' && now > state.collectAt) nextTurn();
  draw(now);
  if (state.phase === 'aim' && state.turn.length < 3 && isTouch()) return 'Throw 🎯';
  return '';
}
function draw(now){
  const W = innerWidth, H = innerHeight, d = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W*d) || cv.height !== Math.round(H*d)){ cv.width = Math.round(W*d); cv.height = Math.round(H*d); dpr = d; }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, W, H);
  const s = state; if (!s || s.phase === 'menu' || s.phase === 'over') return;
  if (s.phase === 'aim' && !s.flying && s.turn.length < 3){
    const t = now - s.t0, sw = sway(t), p = boardPoint(s.b, s.aim.u + sw.u, s.aim.v + sw.v, tmpV()), q = toScreen(p);
    if (q){
      // crosshair
      g2.strokeStyle = 'rgba(255,255,255,.95)'; g2.lineWidth = 2; g2.shadowColor = 'rgba(0,0,0,.6)'; g2.shadowBlur = 3;
      g2.beginPath(); g2.arc(q[0], q[1], 9, 0, 7); g2.stroke();
      for (const [a, b] of [[[-16, 0], [-5, 0]], [[5, 0], [16, 0]], [[0, -16], [0, -5]], [[0, 5], [0, 16]]]){ g2.beginPath(); g2.moveTo(q[0] + a[0], q[1] + a[1]); g2.lineTo(q[0] + b[0], q[1] + b[1]); g2.stroke(); }
      g2.fillStyle = '#ff3b30'; g2.beginPath(); g2.arc(q[0], q[1], 2, 0, 7); g2.fill(); g2.shadowBlur = 0;
      // power bar to the right of the crosshair, green band = good throw
      const edge = toScreen(boardPoint(s.b, R_BOARD + 0.04, 0, tmpV())), pw = power(t), bh = 120, bx = edge ? edge[0] : q[0] + 34, by = (toScreen(boardPoint(s.b, 0, 0, tmpV())) || q)[1] - bh/2;
      g2.fillStyle = 'rgba(20,24,30,.7)'; g2.fillRect(bx - 3, by - 3, 14, bh + 6);
      g2.fillStyle = 'rgba(80,200,120,.85)'; g2.fillRect(bx, by + bh*(1 - SWEET - SWEET_W), 8, bh*SWEET_W*2);
      g2.fillStyle = '#fff'; g2.fillRect(bx - 4, by + bh*(1 - pw) - 1.5, 16, 3);
    }
  }
  if (s.msg && now < s.msg.until){
    const a = Math.min(1, (s.msg.until - now)*2), col = s.msg.kind === 'good' ? '242,194,48' : s.msg.kind === 'bad' ? '255,90,80' : '255,255,255';
    g2.font = '700 30px system-ui,Segoe UI,sans-serif'; g2.textAlign = 'center'; g2.lineWidth = 5; g2.strokeStyle = `rgba(0,0,0,${0.55*a})`; g2.fillStyle = `rgba(${col},${a})`;
    g2.strokeText(s.msg.text, W/2, H*0.86); g2.fillText(s.msg.text, W/2, H*0.86);
  }
}

window.DARTS = {get state(){ return state; }, scoreAt, checkout};   // for testing in the console
if (window.GAME && window.GAME.setView) init(); else addEventListener('game-ready', init, {once: true});
