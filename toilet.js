// Toilet minigame: walk up to a urinal or toilet and press E (or tap the prompt). The view locks onto the bowl and the
// mouse (or a finger) aims the stream. Keep it on the fly that wanders around the bowl: hits score points and build a combo,
// the bowl scores a little, missing makes a puddle on the floor. The bladder empties in a few seconds and the pressure
// drops at the end, so the stream sags. E or a step away stops early; E again (or the button) flushes and lets you go.
//
// Duel: when a colleague stands at the urinal right next to yours, E challenges them; they press E to accept and you both
// start after a 3-2-1 on the shared clock. Scores go through multiplayer (GAME.state.pe → presence), the higher one wins.
// Everyone near a urinal or toilet also sees the streams of the people using them.
import {sound, play, loop} from './sound.js';

const DUR = 9, HIT = 0.035, EYE = 1.65, COUNT = 3, WAIT = 20;
let G, THREE, cv, g2, hud, hudBar, hudScore, hudCombo, hudVs, hudHelp, card, state = null, dpr = 1, best = 0, tmp, tmp2;
try { best = +localStorage.getItem('office.peeBest') || 0; } catch (e) {}
const isTouch = () => !!window.__isTouch;
const now = () => window.__serverNow ? window.__serverNow() : Date.now();
const players = () => (G.mp && G.mp.players) ? G.mp.players() : [];
const myKey = () => G.mp ? G.mp.myKey : '';
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

function el(tag, css, parent){ const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; }

function init(){
  G = window.GAME; THREE = G.THREE; tmp = new THREE.Vector3(); tmp2 = new THREE.Vector3();
  cv = el('canvas', 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2'); g2 = cv.getContext('2d');
  hud = el('div', 'position:fixed;top:72px;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(20,24,30,.72);color:#fff;border-radius:12px;padding:8px 14px;font-size:14px;text-align:center;pointer-events:none;min-width:260px');
  hud.innerHTML = '<div style="display:flex;align-items:center;gap:10px;justify-content:center"><span>Bladder</span><span style="flex:1;height:10px;background:rgba(255,255,255,.2);border-radius:5px;overflow:hidden;min-width:120px"><b style="display:block;height:100%;width:100%;background:#f2c230;border-radius:5px"></b></span></div>'
    + '<div style="margin-top:4px;font-weight:600"><span></span> <span style="color:#f2c230"></span></div><div style="margin-top:2px;color:#9cc3e6;font-weight:600"></div><div style="font-size:12px;opacity:.75;margin-top:2px"></div>';
  hudBar = hud.querySelector('b'); [hudScore, hudCombo] = hud.children[1].querySelectorAll('span'); hudVs = hud.children[2]; hudHelp = hud.children[3];
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:20px 22px 16px;min-width:260px;max-width:86vw;line-height:1.5;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35)');
  G.uses.unshift({tick: frame, use});
}

// ---------- where people are ----------
function fixtureIndex(f){ return G.fixtures.indexOf(f); }
function nearFixture(){
  const st = G.state; let bestF = null, bd = 0.75; if (st.si) return null;
  for (const f of G.fixtures){ if (f.lv !== st.lv || Math.abs(st.y - f.base) > 0.4) continue; const d = Math.hypot(st.x - f.stand[0], st.z - f.stand[1]); if (d < bd){ bd = d; bestF = f; } }
  return bestF;
}
// the urinals right next to this one (same room, same floor)
function neighbours(f){ const i = fixtureIndex(f); return f.kind !== 'urinal' ? [] : G.fixtures.filter((o, j) => o.kind === 'urinal' && o.lv === f.lv && Math.abs(j - i) === 1); }
// a colleague standing at fixture o (or using it)
function playerAt(o){ return players().find(p => (p.l || 0) === o.lv && Math.abs((p.y || 0) - o.base) < 0.5 && Math.hypot(p.x - o.stand[0], p.z - o.stand[1]) < 0.45) || null; }
const idle = p => !p.pe || p.pe.ph === 'res';
// someone at a neighbouring urinal who challenged you
function challengeFor(f){
  for (const o of neighbours(f)){ const p = playerAt(o); if (p && p.pe && p.pe.ph === 'wait' && p.pe.vs === myKey() && p.pe.f === fixtureIndex(o)) return p; }
  return null;
}

function use(){
  if (state){
    if (state.phase === 'wait'){ beginRound(now(), ''); return true; }          // nobody accepted (yet): go solo
    if (state.phase === 'count') return true;
    if (state.phase === 'go'){ finish(); return true; }
    close(); return true;
  }
  if (!G.state.started || G.controlLock) return false;
  const f = nearFixture(); if (!f) return false;
  const ch = challengeFor(f);
  if (ch){ start(f); state.vs = ch.key; state.vsName = ch.name; beginRound(now() + COUNT*1000, ch.key, Math.floor(Math.random()*1e6)); return true; }
  start(f);
  const rival = neighbours(f).map(playerAt).find(p => p && idle(p));
  if (rival){ state.phase = 'wait'; state.vs = rival.key; state.vsName = rival.name; state.waitUntil = performance.now() + WAIT*1000; }
  else beginRound(now(), '');
  return true;
}

// ---------- a round ----------
function start(f){
  try { sound.unlock(); } catch (e) {}
  const dx = f.c[0] - f.stand[0], dz = f.c[2] - f.stand[1], dy = f.c[1] - (f.base + EYE);
  G.setView(f.stand[0], f.stand[1], f.yaw, Math.atan2(dy, Math.hypot(dx, dz)) + 0.08);
  G.controlLock = {aim};
  state = {f, fi: fixtureIndex(f), phase: 'wait', t: 0, bladder: 1, aim: {u: (Math.random() - 0.5)*f.hu, v: -f.hv*0.6}, drift: {u: 0, v: 0},
    fly: {u: (Math.random() - 0.5)*f.hu, v: (Math.random() - 0.5)*f.hv*0.6, vu: 0, vv: 0, hop: 1.5}, onT: 0, inT: 0, missT: 0, score: 0, combo: 1, streak: 0, drops: [],
    vs: '', vsName: '', oppScore: 0, oppDone: false};
  hud.style.display = 'block';
}
// t0 = shared clock time the stream starts; vs = opponent key ('' = solo); seed puts the fly in the same spot for both
function beginRound(t0, vs, seed){
  const s = state; s.t0 = t0; s.vs = vs; s.seed = seed || 0; s.phase = t0 > now() ? 'count' : 'go';
  if (vs && seed){ const r = ((seed*9301 + 49297) % 233280)/233280; s.fly.u = (r - 0.5)*s.f.hu; s.fly.v = (((seed*7) % 100)/100 - 0.5)*s.f.hv*0.6; }
}
function aim(dx, dy, k){ if (!state || state.phase !== 'go' || !G.state.started) return; state.aim.u += dx*0.00055*k; state.aim.v -= dy*0.00055*k; }

function finish(){
  const s = state; s.phase = 'results'; loop('stream', 0); loop('splash', 0); hud.style.display = 'none';
  const T = Math.max(0.01, s.t); s.final = Math.round(s.score);
  s.res = {on: s.onT/T, inb: (s.onT + s.inT)/T, early: s.t < 2};
  if (s.final > best){ best = s.final; s.isBest = true; try { localStorage.setItem('office.peeBest', String(best)); } catch (e) {} }
  renderCard(); card.style.display = 'block';
}
function renderCard(){
  const s = state, r = s.res, score = s.final, on = r.on, T = Math.max(0.01, s.t);
  let rating = r.early ? ['🫣', 'Stage fright'] : on > 0.55 ? ['🎯', 'Sniper'] : on > 0.3 ? ['👌', 'Steady hand'] : s.missT > T*0.4 ? ['🧽', 'Get the mop'] : on > 0.12 ? ['🙂', 'Could be worse'] : ['🌀', 'Free spirit'];
  let duel = '';
  if (s.vs){
    const opp = Math.round(s.oppScore), who = esc(s.vsName || 'your colleague');
    if (!s.oppDone) duel = `<div style="margin:2px 0 8px;color:#454b55">Waiting for ${who} to finish… (${opp} so far)</div>`;
    else { const res = score > opp ? ['🏆', 'You win!'] : score < opp ? ['🥈', `${who} wins`] : ['🤝', 'A draw'];
      rating = [res[0], res[1]]; duel = `<div style="margin:2px 0 8px;color:#454b55">You ${score} · ${who} ${opp}</div>`; }
  }
  card.innerHTML = `<div style="font-size:30px;line-height:1">${rating[0]}</div><h1 style="font-size:20px;margin:6px 0 6px;font-weight:600">${rating[1]}</h1>${duel}`
    + `<div style="display:grid;grid-template-columns:auto auto;gap:2px 18px;color:#454b55"><span>Score</span><b style="color:#1d2229">${score}${s.isBest ? ' · new best!' : ''}</b>`
    + `<span>On the fly</span><b style="color:#1d2229">${Math.round(on*100)}%</b><span>In the bowl</span><b style="color:#1d2229">${Math.round(r.inb*100)}%</b>`
    + `<span>Missed</span><b style="color:#1d2229">${s.missT.toFixed(1)} s</b><span>Your best</span><b style="color:#1d2229">${best}</b></div>`
    + `<button type="button" style="margin-top:14px;width:100%;font-size:16px;padding:11px;border:0;border-radius:10px;background:#2f5d9e;color:#fff;font-weight:600">Flush${isTouch() ? '' : ' (E)'}</button>`;
  const b = card.querySelector('button');
  b.addEventListener('click', e => { e.preventDefault(); close(); });
  b.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); close(); });
  s.cardKey = s.oppDone + '|' + Math.round(s.oppScore);
}

function close(){
  if (!state) return;
  play('flush', state.f.kind === 'toilet' ? 1 : 0.55, 0);
  abort();
}
function abort(){ loop('stream', 0); loop('splash', 0); hud.style.display = 'none'; card.style.display = 'none'; G.controlLock = null; G.state.pe = null; state = null; }

// a point on the aim plane of fixture f, in world space
function at(f, u, v, out){ return out.set(f.c[0] + f.u[0]*u + f.v[0]*v, f.c[1] + f.u[1]*u + f.v[1]*v, f.c[2] + f.u[2]*u + f.v[2]*v); }
function toScreen(p){ p.project(G.camera); return p.z < 1 ? [(p.x + 1)/2*innerWidth, (1 - p.y)/2*innerHeight] : null; }

function step(dt){
  const s = state, f = s.f;
  s.t = s.vs ? Math.max(0, (now() - s.t0)/1000) : s.t + dt;   // duels run on the shared clock so both end together
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

// ---------- drawing (2D overlay on top of the 3D view) ----------
function drawStream(O, E, pressure, t){
  const pts = [], sag = 0.12*pressure;
  for (let i=0;i<=20;i++){ const k = i/20, w = Math.sin(t*31 + i*1.7)*0.002*k;
    tmp.set(O[0] + (E.x - O[0])*k + w, O[1] + (E.y - O[1])*k + sag*4*k*(1 - k), O[2] + (E.z - O[2])*k + w); const p = toScreen(tmp); if (p) pts.push(p); }
  if (pts.length < 2) return null;
  g2.lineCap = 'round'; g2.lineJoin = 'round';
  for (const [col, k] of [['rgba(236,196,48,.85)', 1], ['rgba(255,246,190,.65)', 0.35]]){ g2.strokeStyle = col;
    for (let i=1;i<pts.length;i++){ g2.lineWidth = Math.max(1.2, (7 - i*0.25)*k*(0.6 + 0.4*pressure)); g2.beginPath(); g2.moveTo(pts[i-1][0], pts[i-1][1]); g2.lineTo(pts[i][0], pts[i][1]); g2.stroke(); } }
  return pts[pts.length - 1];
}
function drawFly(f, fly, t, hit){
  const fp = toScreen(at(f, fly.u, fly.v, tmp)), fq = toScreen(at(f, fly.u + 0.018, fly.v, tmp2)); if (!fp || !fq) return;
  const r = Math.max(3, Math.hypot(fq[0] - fp[0], fq[1] - fp[1])), hd = toScreen(at(f, fly.u + fly.vu*0.1, fly.v + fly.vv*0.1, tmp2)), a = hd ? Math.atan2(hd[1] - fp[1], hd[0] - fp[0]) : 0;
  g2.save(); g2.translate(fp[0], fp[1]); g2.rotate(a);
  const flap = 0.6 + 0.4*Math.abs(Math.sin(t*40));
  g2.fillStyle = 'rgba(210,225,240,.7)'; for (const sy of [-1, 1]){ g2.beginPath(); g2.ellipse(-r*0.2, sy*r*0.7, r*0.75*flap, r*0.38, sy*0.5, 0, 7); g2.fill(); }
  g2.fillStyle = '#1b1c1f'; g2.beginPath(); g2.ellipse(0, 0, r*0.95, r*0.5, 0, 0, 7); g2.fill(); g2.beginPath(); g2.arc(r*0.9, 0, r*0.38, 0, 7); g2.fill();
  g2.fillStyle = '#b3262a'; for (const sy of [-1, 1]){ g2.beginPath(); g2.arc(r*1.05, sy*r*0.22, r*0.17, 0, 7); g2.fill(); }
  g2.restore();
  if (hit){ g2.strokeStyle = 'rgba(242,194,48,.9)'; g2.lineWidth = 2; g2.beginPath(); g2.arc(fp[0], fp[1], r*2.4 + Math.sin(t*12)*2, 0, 7); g2.stroke(); }
}
// colleagues using a urinal or toilet on your floor: their stream from the hip to where they aim
function drawOthers(t){
  const st = G.state;
  for (const p of players()){
    const pe = p.pe; if (!pe || pe.ph !== 'go') continue;
    const f = G.fixtures[pe.f]; if (!f || f.lv !== st.lv || Math.hypot(f.stand[0] - st.x, f.stand[1] - st.z) > 12) continue;
    const fw = [-Math.sin(f.yaw), -Math.cos(f.yaw)], O = [p.x + fw[0]*0.2, f.base + 0.95, p.z + fw[1]*0.2];
    drawStream(O, at(f, pe.u || 0, pe.v || 0, tmp2).clone(), 1, t);
  }
}

function draw(dt){
  const W = innerWidth, H = innerHeight, d = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W*d) || cv.height !== Math.round(H*d)){ cv.width = Math.round(W*d); cv.height = Math.round(H*d); dpr = d; }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, W, H);
  const t = performance.now()/1000;
  drawOthers(t);
  const s = state; if (!s) return;
  const f = s.f;
  if (s.phase === 'go' || s.phase === 'count' || s.phase === 'results') drawFly(f, s.fly, t, s.phase === 'go' && s.hit);
  if (s.phase === 'go'){
    const Ov = G.camera.localToWorld(tmp.set(0, -0.6, -0.32)), O = [Ov.x, Ov.y, Ov.z];   // starts just below the bottom of the screen
    const end = drawStream(O, at(f, s.aim.u, s.aim.v, tmp2).clone(), s.pressure || 1, t);
    if (end) for (let k=0;k<(s.inBowl ? 2 : 4);k++) s.drops.push({x: end[0], y: end[1], vx: (Math.random() - 0.5)*160, vy: -40 - Math.random()*120, life: 0.35 + Math.random()*0.25, miss: !s.inBowl});
  }
  for (const p of s.drops){ p.life -= dt; p.vy += 600*dt; p.x += p.vx*dt; p.y += p.vy*dt; }
  s.drops = s.drops.filter(p => p.life > 0).slice(-160);
  for (const p of s.drops){ g2.fillStyle = p.miss ? `rgba(236,196,48,${Math.min(1, p.life*2.5)})` : `rgba(225,240,250,${Math.min(1, p.life*2.5)})`; g2.beginPath(); g2.arc(p.x, p.y, 1.8, 0, 7); g2.fill(); }
  if (s.phase === 'count'){ const n = Math.ceil((s.t0 - now())/1000); g2.fillStyle = 'rgba(255,255,255,.95)'; g2.strokeStyle = 'rgba(20,24,30,.7)'; g2.lineWidth = 6;
    g2.font = '700 96px system-ui, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.strokeText(String(Math.max(1, n)), W/2, H*0.45); g2.fillText(String(Math.max(1, n)), W/2, H*0.45); }
}

// ---------- every frame ----------
function frame(dt, keys){
  if (!G) return '';
  let hint = '';
  const st = G.state;
  if (!state){
    const f = st.started && !G.controlLock ? nearFixture() : null;
    if (f){ const ch = challengeFor(f), rival = !ch && neighbours(f).map(playerAt).find(p => p && idle(p)), tap = isTouch() ? 'Tap to ' : 'Press E to ';
      hint = ch ? `${tap}accept ${ch.name}'s duel 🚽` : rival ? `${tap}challenge ${rival.name} to a duel` : tap + 'use the ' + f.kind; }
    draw(dt); return hint;
  }
  const s = state, f = s.f;
  if (Math.hypot(st.x - f.stand[0], st.z - f.stand[1]) > 0.3 || Math.abs(st.y - f.base) > 0.4){ abort(); draw(dt); return ''; }   // moved away (Jump to…)
  const walking = keys && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);
  const opp = s.vs ? players().find(p => p.key === s.vs) : null;
  if (s.vs && opp && opp.pe && opp.pe.vs === myKey()){ s.oppScore = opp.pe.s || 0; if (opp.pe.ph === 'res') s.oppDone = true; }
  if (s.vs && !opp && s.phase !== 'wait'){ s.oppDone = true; }                 // they left: their last score stands
  if (s.phase === 'wait'){
    // the one you challenged accepts by starting a round against you: join it at the same moment
    if (opp && opp.pe && opp.pe.vs === myKey() && (opp.pe.ph === 'count' || opp.pe.ph === 'go') && opp.pe.t0) beginRound(opp.pe.t0, s.vs, opp.pe.sd);
    else if (!opp || performance.now() > s.waitUntil) beginRound(now(), '');
    hudBar.style.width = '100%'; hudScore.textContent = s.phase === 'wait' ? `Waiting for ${s.vsName}…` : ''; hudCombo.textContent = ''; hudVs.textContent = '';
    hudHelp.textContent = isTouch() ? 'Tap the prompt to go solo' : 'They press E to accept · E: go solo';
    if (walking) abort();
  }
  if (state && s.phase === 'count'){ if (now() >= s.t0) s.phase = 'go'; hudScore.textContent = 'Get ready'; hudVs.textContent = s.vs ? 'Duel vs ' + s.vsName : ''; if (walking) abort(); }
  if (state && s.phase === 'go'){
    if (st.started || s.vs) step(dt); else { loop('stream', 0); loop('splash', 0); }
    if (s.phase === 'go'){
      hudBar.style.width = (s.bladder*100).toFixed(1) + '%'; hudScore.textContent = 'Score ' + Math.round(s.score); hudCombo.textContent = s.combo > 1.05 ? '×' + s.combo.toFixed(1) : '';
      hudVs.textContent = s.vs ? `${s.vsName}: ${Math.round(s.oppScore)}` : '';
      hudHelp.textContent = isTouch() ? 'Drag to aim at the fly · tap the prompt to stop' : 'Mouse: aim at the fly · E: stop';
      if (walking) finish();
    }
  }
  if (state && s.phase === 'results'){
    if (s.vs && s.cardKey !== s.oppDone + '|' + Math.round(s.oppScore)) renderCard();
    if (walking) close();
  }
  // what the others see: your fixture, phase, score and aim (sent with your position by mp.js)
  if (state) st.pe = {f: s.fi, ph: s.phase === 'results' ? 'res' : s.phase, s: Math.round(s.phase === 'results' ? s.final : s.score), u: Math.round(s.aim.u*1000)/1000, v: Math.round(s.aim.v*1000)/1000,
    t0: s.t0 || 0, vs: s.vs || '', sd: s.seed || 0};
  draw(dt);
  if (!state) return '';
  if (s.phase === 'wait') return isTouch() ? 'Tap to go solo' : '';
  if (s.phase === 'go') return isTouch() ? 'Tap to stop' : '';
  if (s.phase === 'results') return isTouch() ? 'Tap to flush' : 'Press E to flush';
  return '';
}

window.TOILET = {get state(){ return state; }};   // for testing in the console
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
