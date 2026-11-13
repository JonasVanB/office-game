// Toilet minigame: walk up to a urinal or toilet and press E (or tap the prompt). The view locks onto the bowl and the
// mouse (or a finger) aims the stream. Keep it on the fly that wanders around the bowl: hits score points and build a combo,
// the bowl scores a little, missing makes a puddle on the floor. The bladder empties in a few seconds and the pressure
// drops at the end, so the stream sags. E or a step away stops early; E again (or the button) flushes and lets you go.
import {sound, play, loop} from './sound.js';

const DUR = 9, HIT = 0.035, EYE = 1.65;
let G, THREE, cv, g2, hud, hudBar, hudScore, hudCombo, card, state = null, dpr = 1, best = 0, tmp, tmp2;
try { best = +localStorage.getItem('office.peeBest') || 0; } catch (e) {}
const isTouch = () => !!window.__isTouch;

function el(tag, css, parent){ const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; }

function init(){
  G = window.GAME; THREE = G.THREE; tmp = new THREE.Vector3(); tmp2 = new THREE.Vector3();
  cv = el('canvas', 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2'); g2 = cv.getContext('2d');
  hud = el('div', 'position:fixed;top:72px;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(20,24,30,.72);color:#fff;border-radius:12px;padding:8px 14px;font-size:14px;text-align:center;pointer-events:none;min-width:260px');
  hud.innerHTML = '<div style="display:flex;align-items:center;gap:10px;justify-content:center"><span>Bladder</span><span style="flex:1;height:10px;background:rgba(255,255,255,.2);border-radius:5px;overflow:hidden;min-width:120px"><b style="display:block;height:100%;width:100%;background:#f2c230;border-radius:5px"></b></span></div>'
    + '<div style="margin-top:4px;font-weight:600"><span></span> <span style="color:#f2c230"></span></div><div style="font-size:12px;opacity:.75;margin-top:2px"></div>';
  hudBar = hud.querySelector('b'); [hudScore, hudCombo] = hud.querySelectorAll('div:nth-child(2) span');
  hud.lastChild.textContent = isTouch() ? 'Drag to aim at the fly · tap the prompt to stop' : 'Mouse: aim at the fly · E: stop';
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:20px 22px 16px;min-width:260px;max-width:86vw;line-height:1.5;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35)');
  G.onAim = (dx, dy, k) => { if (!state || state.phase !== 'go' || !G.state.started) return; state.aim.u += dx*0.00055*k; state.aim.v -= dy*0.00055*k; };
  window.__onUse = use;
  window.__onFrameToilet = frame;
}

function nearFixture(){
  const st = G.state; let bestF = null, bd = 0.75;
  for (const f of G.fixtures){ if (f.lv !== st.lv || Math.abs(st.y - f.base) > 0.4) continue; const d = Math.hypot(st.x - f.stand[0], st.z - f.stand[1]); if (d < bd){ bd = d; bestF = f; } }
  return bestF;
}
function use(){
  if (state){ if (state.phase === 'go') finish(); else close(); return true; }
  const f = G.state.started ? nearFixture() : null; if (!f) return false;
  start(f); return true;
}

function start(f){
  try { sound.unlock(); } catch (e) {}
  const dx = f.c[0] - f.stand[0], dz = f.c[2] - f.stand[1], dy = f.c[1] - (f.base + EYE);
  G.setView(f.stand[0], f.stand[1], f.yaw, Math.atan2(dy, Math.hypot(dx, dz)) + 0.08);
  G.controlLock = true;
  state = {f, phase: 'go', t: 0, bladder: 1, aim: {u: (Math.random() - 0.5)*f.hu, v: -f.hv*0.6}, drift: {u: 0, v: 0},
    fly: {u: (Math.random() - 0.5)*f.hu, v: (Math.random() - 0.5)*f.hv*0.6, vu: 0, vv: 0, hop: 1.5}, onT: 0, inT: 0, missT: 0, score: 0, combo: 1, streak: 0, drops: []};
  hud.style.display = 'block';
}

function finish(){
  const s = state; s.phase = 'results'; loop('stream', 0); loop('splash', 0); hud.style.display = 'none';
  const T = Math.max(0.01, s.t), on = s.onT/T, inb = (s.onT + s.inT)/T, score = Math.round(s.score), isBest = score > best;
  if (isBest){ best = score; try { localStorage.setItem('office.peeBest', String(best)); } catch (e) {} }
  const rating = s.t < 2 ? ['🫣', 'Stage fright'] : on > 0.55 ? ['🎯', 'Sniper'] : on > 0.3 ? ['👌', 'Steady hand'] : s.missT > T*0.4 ? ['🧽', 'Get the mop'] : on > 0.12 ? ['🙂', 'Could be worse'] : ['🌀', 'Free spirit'];
  if (window.__ach){ window.__ach('wc_first'); window.__stat('toilet'); if (rating[1] === 'Sniper') window.__ach('wc_sniper'); if (rating[1] === 'Get the mop') window.__ach('wc_mop'); window.__xp(Math.min(30, Math.round(score/40)), 'Toilet visit'); }   // progress.js
  card.innerHTML = `<div style="font-size:30px;line-height:1">${rating[0]}</div><h1 style="font-size:20px;margin:6px 0 8px;font-weight:600">${rating[1]}</h1>`
    + `<div style="display:grid;grid-template-columns:auto auto;gap:2px 18px;color:#454b55"><span>Score</span><b style="color:#1d2229">${score}${isBest ? ' · new best!' : ''}</b>`
    + `<span>On the fly</span><b style="color:#1d2229">${Math.round(on*100)}%</b><span>In the bowl</span><b style="color:#1d2229">${Math.round(inb*100)}%</b>`
    + `<span>Missed</span><b style="color:#1d2229">${s.missT.toFixed(1)} s</b><span>Your best</span><b style="color:#1d2229">${best}</b></div>`
    + `<button type="button" style="margin-top:14px;width:100%;font-size:16px;padding:11px;border:0;border-radius:10px;background:#2f5d9e;color:#fff;font-weight:600">Flush${isTouch() ? '' : ' (E)'}</button>`;
  card.querySelector('button').addEventListener('click', e => { e.preventDefault(); close(); });
  card.querySelector('button').addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); close(); });
  card.style.display = 'block';
}

function close(){
  if (!state) return;
  play('flush', state.f.kind === 'toilet' ? 1 : 0.55, 0);
  card.style.display = 'none'; G.controlLock = false; state = null; g2.clearRect(0, 0, cv.width, cv.height);
}

function abort(){ loop('stream', 0); loop('splash', 0); hud.style.display = 'none'; card.style.display = 'none'; G.controlLock = false; state = null; g2.clearRect(0, 0, cv.width, cv.height); }

// a point on the aim plane of fixture f, in world space
function at(f, u, v, out){ return out.set(f.c[0] + f.u[0]*u + f.v[0]*v, f.c[1] + f.u[1]*u + f.v[1]*v, f.c[2] + f.u[2]*u + f.v[2]*v); }
function toScreen(p){ p.project(G.camera); return p.z < 1 ? [(p.x + 1)/2*innerWidth, (1 - p.y)/2*innerHeight] : null; }

function step(dt){
  const s = state, f = s.f; s.t += dt;
  s.bladder = Math.max(0, 1 - s.t/DUR);
  const pressure = s.bladder > 0.22 ? 1 : s.bladder/0.22;
  // shaky aim, and the stream sags as the pressure drops
  s.drift.u = s.drift.u*0.97 + (Math.random() - 0.5)*dt*1.4; s.drift.v = s.drift.v*0.97 + (Math.random() - 0.5)*dt*1.4;
  s.aim.u += s.drift.u*dt; s.aim.v += s.drift.v*dt - (1 - pressure)*0.5*dt;
  s.aim.u = Math.max(-f.hu*2.6, Math.min(f.hu*2.6, s.aim.u)); s.aim.v = Math.max(-f.hv*2.2, Math.min(f.hv*2.2, s.aim.v));
  // the fly wanders, speeds up over time and now and then darts off somewhere else
  const fl = s.fly, speed = 0.05 + 0.2*Math.min(1, s.t/(DUR*0.8));
  fl.hop -= dt;
  if (fl.hop <= 0){ fl.hop = 1 + Math.random()*2; const a = Math.random()*Math.PI*2; fl.vu = Math.cos(a)*speed*2.6; fl.vv = Math.sin(a)*speed*2.6; }
  fl.vu += (Math.random() - 0.5)*speed*8*dt; fl.vv += (Math.random() - 0.5)*speed*8*dt;
  const sp = Math.hypot(fl.vu, fl.vv), lim = fl.hop > 0.8 ? speed*2.6 : speed; if (sp > lim){ fl.vu *= 1 - Math.min(1, dt*3); fl.vv *= 1 - Math.min(1, dt*3); }
  fl.u += fl.vu*dt; fl.v += fl.vv*dt;
  const e = Math.hypot(fl.u/(f.hu*0.75), fl.v/(f.hv*0.75)); if (e > 1){ fl.u /= e; fl.v /= e; fl.vu = -fl.vu*0.8 + (Math.random() - 0.5)*speed; fl.vv = -fl.vv*0.8 + (Math.random() - 0.5)*speed; }
  // scoring
  const d = Math.hypot(s.aim.u - fl.u, s.aim.v - fl.v), inBowl = Math.hypot(s.aim.u/f.hu, s.aim.v/f.hv) <= 1;
  if (d < HIT){ if (s.streak === 0) play('ding', 0.8, 0); s.onT += dt; s.streak += dt; s.combo = Math.min(5, 1 + s.streak*0.9); s.score += 100*s.combo*dt; }
  else { s.streak = 0; s.combo = 1; if (inBowl){ s.inT += dt; s.score += 12*dt; } else { s.missT += dt; f.missed = (f.missed || 0) + dt; puddle(f); } }
  s.hit = d < HIT; s.inBowl = inBowl; s.pressure = pressure;
  loop('stream', inBowl ? 0.4*pressure : 0); loop('splash', inBowl ? 0 : 0.35*pressure);
  if (s.bladder <= 0) finish();
}

// misses collect in a puddle on the floor in front of the fixture (stays until the page is reloaded)
function puddle(f){
  if (!f.puddle){ const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({color: 0xe3cc5c, transparent: true, opacity: 0.55, roughness: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3}));
    m.rotation.x = -Math.PI/2; m.position.set(f.floor[0], f.base + 0.016, f.floor[1]); G.scene.add(m); f.puddle = m; }
  const r = Math.min(0.35, 0.04 + Math.sqrt(f.missed)*0.07); f.puddle.scale.set(r, r*0.8, 1);
}

function draw(dt){
  const W = innerWidth, H = innerHeight, d = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W*d) || cv.height !== Math.round(H*d)){ cv.width = Math.round(W*d); cv.height = Math.round(H*d); dpr = d; }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, W, H);
  const s = state, f = s.f, now = performance.now()/1000;
  // the fly, sized by its distance
  const fp = toScreen(at(f, s.fly.u, s.fly.v, tmp)), fq = toScreen(at(f, s.fly.u + 0.018, s.fly.v, tmp2));
  if (fp && fq){ const r = Math.max(3, Math.hypot(fq[0] - fp[0], fq[1] - fp[1])), hd = toScreen(at(f, s.fly.u + s.fly.vu*0.1, s.fly.v + s.fly.vv*0.1, tmp2)), a = hd ? Math.atan2(hd[1] - fp[1], hd[0] - fp[0]) : 0;
    g2.save(); g2.translate(fp[0], fp[1]); g2.rotate(a);
    const flap = 0.6 + 0.4*Math.abs(Math.sin(now*40));
    g2.fillStyle = 'rgba(210,225,240,.7)'; for (const sy of [-1, 1]){ g2.beginPath(); g2.ellipse(-r*0.2, sy*r*0.7, r*0.75*flap, r*0.38, sy*0.5, 0, 7); g2.fill(); }
    g2.fillStyle = '#1b1c1f'; g2.beginPath(); g2.ellipse(0, 0, r*0.95, r*0.5, 0, 0, 7); g2.fill(); g2.beginPath(); g2.arc(r*0.9, 0, r*0.38, 0, 7); g2.fill();
    g2.fillStyle = '#b3262a'; for (const sy of [-1, 1]){ g2.beginPath(); g2.arc(r*1.05, sy*r*0.22, r*0.17, 0, 7); g2.fill(); }
    g2.restore();
    if (s.hit){ g2.strokeStyle = 'rgba(242,194,48,.9)'; g2.lineWidth = 2; g2.beginPath(); g2.arc(fp[0], fp[1], r*2.4 + Math.sin(now*12)*2, 0, 7); g2.stroke(); }
  }
  // the stream: an arc from the hip to the aim point
  if (s.phase === 'go'){
    const Ov = G.camera.localToWorld(tmp.set(0, -0.6, -0.32)), O = [Ov.x, Ov.y, Ov.z], E = at(f, s.aim.u, s.aim.v, tmp2).clone();   // starts just below the bottom of the screen
    const pts = [], sag = 0.12*(s.pressure || 1);
    for (let i=0;i<=20;i++){ const t = i/20, w = Math.sin(now*31 + i*1.7)*0.002*t;
      tmp.set(O[0] + (E.x - O[0])*t + w, O[1] + (E.y - O[1])*t + sag*4*t*(1 - t), O[2] + (E.z - O[2])*t + w); const p = toScreen(tmp); if (p) pts.push(p); }
    if (pts.length > 1){ g2.lineCap = 'round'; g2.lineJoin = 'round';
      for (const [col, k] of [['rgba(236,196,48,.85)', 1], ['rgba(255,246,190,.65)', 0.35]]){ g2.strokeStyle = col;
        for (let i=1;i<pts.length;i++){ g2.lineWidth = Math.max(1.2, (7 - i*0.25)*k*(0.6 + 0.4*(s.pressure || 1))); g2.beginPath(); g2.moveTo(pts[i-1][0], pts[i-1][1]); g2.lineTo(pts[i][0], pts[i][1]); g2.stroke(); } }
      // splashes where it lands
      const end = pts[pts.length - 1], n = s.inBowl ? 2 : 4;
      for (let k=0;k<n;k++) s.drops.push({x: end[0], y: end[1], vx: (Math.random() - 0.5)*160, vy: -40 - Math.random()*120, life: 0.35 + Math.random()*0.25, miss: !s.inBowl});
    }
  }
  for (const p of s.drops){ p.life -= dt; p.vy += 600*dt; p.x += p.vx*dt; p.y += p.vy*dt; }
  s.drops = s.drops.filter(p => p.life > 0).slice(-160);
  for (const p of s.drops){ g2.fillStyle = p.miss ? `rgba(236,196,48,${Math.min(1, p.life*2.5)})` : `rgba(225,240,250,${Math.min(1, p.life*2.5)})`; g2.beginPath(); g2.arc(p.x, p.y, 1.8, 0, 7); g2.fill(); }
}

function frame(dt, keys){
  if (!G) return '';
  if (!state){ const f = G.state.started ? nearFixture() : null; return f ? (isTouch() ? 'Tap to use the ' : 'Press E to use the ') + f.kind : ''; }
  const st = G.state, f = state.f;
  if (Math.hypot(st.x - f.stand[0], st.z - f.stand[1]) > 0.3 || Math.abs(st.y - f.base) > 0.4){ abort(); return ''; }   // moved away (Jump to…, multiplayer reset)
  const walking = keys &&(keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);
  if (state.phase === 'go'){
    if (G.state.started) step(dt); else { loop('stream', 0); loop('splash', 0); }
    if (state.phase === 'go'){
      hudBar.style.width = (state.bladder*100).toFixed(1) + '%'; hudScore.textContent = 'Score ' + Math.round(state.score); hudCombo.textContent = state.combo > 1.05 ? '×' + state.combo.toFixed(1) : '';
      if (walking) finish();
    }
    draw(dt);
    return state && state.phase === 'go' ? (isTouch() ? 'Tap to stop' : '') : '';
  }
  draw(dt);
  if (walking) close();
  return state ? (isTouch() ? 'Tap to flush' : 'Press E to flush') : '';
}

window.TOILET = {get state(){ return state; }};   // for testing in the console
if (window.GAME && window.GAME.fixtures) init(); else addEventListener('game-ready', init, {once: true});
