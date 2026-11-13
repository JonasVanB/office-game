// Secret boxing ring in Gravensteen (3e). A small lever on the end wall sinks the meeting table into the floor and raises a ring
// (shared with everyone through mp.js, stored with the doors). Two players in the ring: one presses E to challenge, the other E to
// accept, a 3-2-1 on the shared clock, then one round of 90 seconds. KO or the most health left wins.
//
// Controls (mouse / keys):  left click or J = jab (fast, light) · right click or K = hook (slow, heavy) · hold Space or L = block
//   WASD = move (you always face your opponent) · Shift + direction = dodge (a quick step that slips punches) · E = give up
// Touch: drag to move, buttons for jab / hook / block / dodge.
//
// The skill: stamina limits how much you can throw, block and dodge. A hook is slow enough to see coming: block it, dodge it, or
// beat it with a jab (a hit during someone's wind-up is a counter: extra damage, and their punch is cancelled). A blocked hook
// still drains stamina; with an empty tank the guard breaks.
//
// Fairness over the network: the one who gets hit decides. A punch is announced when it starts (presence bx.pn with its impact
// time); at that moment the defender checks range, the attacker's facing, and their own block / dodge / wind-up, applies the
// damage to themself and reports it back (bx.hit).
import {sound, play} from './sound.js';

const ROUND = 90, HP = 100, ST = 100, COUNT = 3.5, WAIT = 25, SPEED = 1.7, MIN_GAP = 1.0;
const MOVES = {
  j: {wind: 0.12, hold: 0.1, rec: 0.16, cost: 7, dmg: 5, reach: 1.4, stun: 0.12, blockCost: 5, chip: 0},
  h: {wind: 0.34, hold: 0.12, rec: 0.3, cost: 16, dmg: 13, reach: 1.25, stun: 0.38, blockCost: 16, chip: 3},
};
const DODGE = {dist: 0.65, time: 0.18, inv: 0.24, cd: 0.7, cost: 14};
const CONE = 0.62;   // a punch only lands within ~35° of where the attacker faces

let G, THREE, R, cv, g2, hud, help, card, toast, pad, fight = null, rot = 0, fx = {flash: 0, shake: 0, popups: []}, stick = {x: 0, y: 0}, keysDown = {}, wins = 0;
try { wins = +localStorage.getItem('office.boxWins') || 0; } catch (e) {}
const isTouch = () => !!window.__isTouch;
const now = () => window.__serverNow ? window.__serverNow() : Date.now();
const players = () => (G.mp && G.mp.players) ? G.mp.players() : [];
const myKey = () => G.mp ? G.mp.myKey : '';
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
function el(tag, css, parent){ const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; }

function init(){
  G = window.GAME; THREE = G.THREE; R = G.ring; if (!R) return;
  cv = el('canvas', 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2'); g2 = cv.getContext('2d');
  hud = el('div', 'position:fixed;top:64px;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(20,24,30,.78);color:#fff;border-radius:12px;padding:8px 12px;font-size:13px;pointer-events:none;width:min(560px,calc(100vw - 32px));box-sizing:border-box');
  help = el('div', 'position:fixed;left:50%;bottom:44px;transform:translateX(-50%);display:none;z-index:3;color:#fff;font-size:12px;background:rgba(20,24,30,.55);border-radius:8px;padding:4px 10px;pointer-events:none;white-space:nowrap;max-width:calc(100vw - 24px);overflow:hidden;text-overflow:ellipsis');
  toast = el('div', 'position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);display:none;z-index:3;background:rgba(20,24,30,.8);color:#fff;border-radius:12px;padding:10px 16px;font-size:15px;pointer-events:none');
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:20px 22px 16px;min-width:270px;max-width:86vw;line-height:1.5;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35)');
  if (isTouch()){
    pad = el('div', 'position:fixed;right:12px;bottom:70px;display:none;z-index:3;gap:8px;flex-wrap:wrap;width:190px;justify-content:flex-end');
    const btn = (label, down, up) => { const b = el('div', 'width:56px;height:56px;border-radius:50%;background:rgba(198,40,40,.75);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.7);user-select:none', pad);
      b.textContent = label; b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); down(); }); if (up) b.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); up(); }); return b; };
    btn('Jab', () => punch('j')); btn('Hook', () => punch('h')); btn('Block', () => { keysDown.block = true; }, () => { keysDown.block = false; });
    btn('◀', () => dodge(-1, 0)); btn('Back', () => dodge(0, -1)); btn('▶', () => dodge(1, 0));
  }
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  addEventListener('contextmenu', e => { if (fight) e.preventDefault(); });
  window.__onRing = up => setRing(up, false);
  if (window.__ringUp){ setRing(true, false, true); ringT = 1; }   // the ring was already up when this loaded
  G.poseBoxer = poseBoxer;
  G.uses.unshift({tick, use});
}

// ---------- the ring and the lever ----------
let ringUp = false, ringT = 0, ringTarget = 0;
function setRing(up, mine, quiet){
  if (up === ringUp) return; ringUp = up; ringTarget = up ? 1 : 0;
  if (up) R.setTable(false); else R.setTable(true);
  const s = G.state; if (!quiet && s.lv === R.lv && Math.hypot(s.x - 46, s.z - 2.4) < 14){ play('rumble', 1, 0); if (up) setTimeout(() => play('bell', 0.7, 0, 2), 2600); }
  if (mine && G.mp && G.mp.setRing) G.mp.setRing(up);
}
function animateRing(dt){
  const k = ringTarget; ringT += Math.sign(k - ringT)*Math.min(Math.abs(k - ringT), dt/2.6);
  const e = ringT*ringT*(3 - 2*ringT);
  // the table and chairs sink first, then the ring rises
  const sink = Math.min(1, e*2), rise = Math.max(0, e*2 - 1);
  R.furn.position.y = -1.3*sink; R.furn.visible = sink < 0.999;
  R.ring.position.y = -1.6*(1 - rise); R.ring.visible = rise > 0.001;
  R.handle.rotation.z += ((ringUp ? 2.55 : 0.55) - R.handle.rotation.z)*Math.min(1, dt*10);
}
const inRing = (x, z, lv, y) => ringUp && ringT > 0.98 && lv === R.lv && Math.abs((y || 0) - R.base) < 0.5 && x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1;
function nearLever(){
  const s = G.state, v = G.getView(), L = R.lever; if (s.lv !== R.lv || G.controlLock || s.si) return false;
  if (Math.hypot(s.x - L.x, s.z - L.z) > 1.1) return false;
  return -Math.sin(v.yaw) > 0.5;   // facing the end wall (+x)
}
const busy = () => !!fight || players().some(p => p.bx && p.bx.ph !== 'end');

// ---------- challenge / accept ----------
const meInRing = () => { const s = G.state; return inRing(s.x, s.z, s.lv, s.y); };
const pInRing = p => inRing(p.x, p.z, p.l || 0, p.y);
const idleP = p => !p.bx || p.bx.ph === 'end';
function challenger(){ return players().find(p => pInRing(p) && p.bx && p.bx.ph === 'wait' && p.bx.vs === myKey()) || null; }
function rival(){ return players().find(p => pInRing(p) && idleP(p)) || null; }

function use(){
  if (fight){
    if (fight.ph === 'wait'){ endFight(); return true; }
    if (fight.ph === 'end'){ endFight(); return true; }
    if (fight.ph === 'fight'){ finish('quit'); return true; }
    return true;
  }
  if (!G.state.started || G.controlLock) return false;
  if (nearLever()){ if (busy()){ say('Not now: there is a fight going on!'); return true; } play('thud', 0.6, 0, true); setRing(!ringUp, true); return true; }
  if (!meInRing()) return false;
  const ch = challenger();
  if (ch){ begin(ch, false); fight.t0 = now() + COUNT*1000; fight.ph = 'count'; placeInCorner(); return true; }
  const rv = rival(); if (!rv){ say('Wait for a colleague to step into the ring'); return true; }
  begin(rv, true); fight.ph = 'wait'; fight.waitUntil = performance.now() + WAIT*1000; return true;
}
function begin(p, iChallenged){
  try { sound.unlock(); } catch (e) {}
  fight = {ph: 'wait', vs: p.key, vsName: p.name, red: iChallenged, t0: 0, hp: HP, st: ST, act: null, stunUntil: 0, iUntil: 0, dodge: null, dodgeCd: 0,
    seen: new Set(), pending: [], myPunches: new Map(), acked: new Set(), oppHp: HP, oppSt: ST, result: null,
    stats: {thrown: 0, landed: 0, blocked: 0, dodged: 0, dealt: 0, taken: 0}};
  G.controlLock = {aim, press, rightClick: true};
  hud.style.display = 'block'; help.style.display = 'block'; if (pad) pad.style.display = 'flex';
}
function placeInCorner(){
  const zc = (R.z0 + R.z1)/2, x = fight.red ? R.x0 + 0.9 : R.x1 - 0.9;
  G.setView(x, zc, fight.red ? -Math.PI/2 : Math.PI/2, -0.04);
}
function endFight(){
  fight = null; G.controlLock = null; G.state.bx = null; hud.style.display = 'none'; help.style.display = 'none'; card.style.display = 'none'; if (pad) pad.style.display = 'none';
  g2.clearRect(0, 0, cv.width, cv.height);
}
function say(t){ toast.textContent = t; toast.style.display = 'block'; clearTimeout(say.t); say.t = setTimeout(() => { toast.style.display = 'none'; }, 2200); }

// ---------- input ----------
function onKey(e){
  if (!fight || fight.ph === 'wait') return;
  const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
  const down = e.type === 'keydown';
  if (e.code === 'Space' || e.code === 'KeyL'){ keysDown.block = down; e.preventDefault(); e.stopPropagation(); return; }
  if (!down || e.repeat) return;
  if (e.code === 'KeyJ') punch('j'); else if (e.code === 'KeyK') punch('h');
  else if (e.shiftKey && (e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'KeyS' || e.code === 'KeyW')) dodge(e.code === 'KeyA' ? -1 : e.code === 'KeyD' ? 1 : 0, e.code === 'KeyS' ? -1 : e.code === 'KeyW' ? 1 : 0);
}
function aim(dx, dy, k, x, y, absolute){ if (!isTouch()) return; stick.x = Math.max(-1, Math.min(1, stick.x + dx/45)); stick.y = Math.max(-1, Math.min(1, stick.y + dy/45)); }
function press(down, x, y, abs, button){
  if (!down){ if (isTouch()){ stick.x = stick.y = 0; } return; }
  if (isTouch()) return;
  punch(button === 2 ? 'h' : 'j');
}

// ---------- my actions ----------
function canAct(t){ const f = fight; return f && f.ph === 'fight' && t >= f.stunUntil && !f.act && !(f.dodge && t < f.dodge.end); }
function punch(k){
  const t = now(), f = fight; if (!canAct(t) || keysDown.block) return;
  const m = MOVES[k], tired = f.st < 25; if (f.st < m.cost*0.6) { say('Out of breath!'); return; }
  const wind = m.wind*(tired ? 1.25 : 1);
  f.st = Math.max(0, f.st - m.cost); f.stats.thrown++;
  f.act = {k, t0: t, id: Math.random().toString(36).slice(2, 9), at: t + wind*1000, end: t + (wind + m.hold + m.rec)*1000*(tired ? 1.15 : 1), c: false};
  f.myPunches.set(f.act.id, k); f.lastPn = {id: f.act.id, k, at: f.act.at, c: 0};
  play('whoosh', k === 'h' ? 0.9 : 0.6, 0);
}
function dodge(dx, dz){
  const t = now(), f = fight; if (!canAct(t) || t < f.dodgeCd || f.st < DODGE.cost*0.6) return;
  if (!dx && !dz) dx = Math.random() < 0.5 ? -1 : 1;
  f.st = Math.max(0, f.st - DODGE.cost); f.dodge = {dx, dz, start: t, end: t + DODGE.time*1000}; f.iUntil = t + DODGE.inv*1000; f.dodgeCd = t + DODGE.cd*1000;
  play('whoosh', 0.4, dx*0.5);
}

// ---------- incoming punches: the defender decides ----------
function judge(p, pn){
  const f = fight, t = now(), m = MOVES[pn.k]; if (!m) return null;
  const s = G.state, ox = p.tx !== undefined ? p.tx : p.x, oz = p.tz !== undefined ? p.tz : p.z, d = Math.hypot(s.x - ox, s.z - oz);
  const fwd = [-Math.sin(p.r || 0), -Math.cos(p.r || 0)], to = [(s.x - ox)/(d || 1), (s.z - oz)/(d || 1)], ang = Math.acos(Math.max(-1, Math.min(1, fwd[0]*to[0] + fwd[1]*to[1])));
  if (d > m.reach + 0.1 || ang > CONE){ if (t < f.iUntil){ f.stats.dodged++; popup('Slipped it!', '#9cc3e6'); return {r: 'dodge', d: 0}; } return {r: 'miss', d: 0}; }
  if (t < f.iUntil){ f.stats.dodged++; popup('Slipped it!', '#9cc3e6'); return {r: 'dodge', d: 0}; }
  const tiredAtt = p.bx && p.bx.st < 25 ? 0.75 : 1;
  if (keysDown.block && !f.act && t >= f.stunUntil){
    if (f.st >= m.blockCost){ f.st -= m.blockCost; f.stats.blocked++; hurt(m.chip, 0); play('block', 1, 0); fx.shake = 0.15; return {r: 'block', d: m.chip}; }
    const dmg = Math.round(m.dmg*0.8*tiredAtt); hurt(dmg, m.stun); popup('Guard broken!', '#ff8a80'); play('punch', 1, 0, true); return {r: 'break', d: dmg};
  }
  let dmg = m.dmg*tiredAtt, r = 'hit';
  if (f.act && t < f.act.at){ dmg *= 1.5; r = 'counter'; f.act.c = true; f.lastPn = Object.assign({}, f.lastPn, {c: 1}); popup('Countered!', '#ff8a80'); f.act = null; }
  dmg = Math.round(dmg); hurt(dmg, m.stun); play('punch', 1, 0, pn.k === 'h');
  return {r, d: dmg};
}
function hurt(dmg, stun){
  const f = fight, t = now(); f.hp = Math.max(0, f.hp - dmg); f.stats.taken += dmg;
  if (stun){ f.stunUntil = Math.max(f.stunUntil, t + stun*1000); if (f.act && t < f.act.at){ f.act.c = true; f.lastPn = Object.assign({}, f.lastPn, {c: 1}); f.act = null; } }
  if (dmg > 0){ fx.flash = Math.min(1, fx.flash + dmg/14); fx.shake = Math.max(fx.shake, 0.12 + dmg/40); }
  if (f.hp <= 0) finish('ko');
}
function popup(text, color){ fx.popups.push({text, color, t: 1}); }

// ---------- each frame ----------
function step(dt, keys){
  const f = fight, t = now(), opp = players().find(p => p.key === f.vs);
  if (!opp){ if (f.ph === 'fight' || f.ph === 'count'){ f.oppLeft = true; finish('left'); } else endFight(); return; }
  const ob = opp.bx;
  if (f.ph === 'wait'){
    if (ob && ob.vs === myKey() && (ob.ph === 'count' || ob.ph === 'fight') && ob.t0){ f.t0 = ob.t0; f.ph = 'count'; placeInCorner(); }
    else if (performance.now() > f.waitUntil || !pInRing(opp)){ say(`${f.vsName} did not accept`); endFight(); }
    return;
  }
  if (ob){ f.oppHp = ob.hp !== undefined ? ob.hp : f.oppHp; f.oppSt = ob.st !== undefined ? ob.st : f.oppSt; }
  if (f.ph === 'count'){ if (t >= f.t0){ f.ph = 'fight'; play('bell', 1, 0, 1); } }
  if (f.ph === 'fight'){
    // facing: turn toward the opponent at a limited rate (side steps can slip a punch)
    const v = G.getView(), want = Math.atan2(-(opp.x - v.x), -(opp.z - v.z)); let dy = want - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const yaw = v.yaw + Math.sign(dy)*Math.min(Math.abs(dy), 7*dt);
    // moving: relative to the opponent; slower while blocking or punching
    let fwd = 0, side = 0;
    if (keys.KeyW || keys.ArrowUp) fwd += 1; if (keys.KeyS || keys.ArrowDown) fwd -= 1; if (keys.KeyD || keys.ArrowRight) side += 1; if (keys.KeyA || keys.ArrowLeft) side -= 1;
    fwd -= stick.y; side += stick.x;
    const blocking = keysDown.block && t >= f.stunUntil && !f.act, sp = (t < f.stunUntil ? 0.4 : blocking ? 0.6 : f.act ? 0.5 : 1)*SPEED;
    const l = Math.hypot(fwd, side) || 1; if (l > 1){ fwd /= l; side /= l; }
    const fx2 = -Math.sin(yaw), fz2 = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let x = v.x + (fwd*fx2 + side*rx)*sp*dt, z = v.z + (fwd*fz2 + side*rz)*sp*dt;
    if (f.dodge && t < f.dodge.end){ const k = DODGE.dist/DODGE.time*dt; x += (f.dodge.dz*fx2 + f.dodge.dx*rx)*k; z += (f.dodge.dz*fz2 + f.dodge.dx*rz)*k; }
    x = Math.max(R.x0 + 0.32, Math.min(R.x1 - 0.32, x)); z = Math.max(R.z0 + 0.32, Math.min(R.z1 - 0.32, z));
    const gx = x - opp.x, gz = z - opp.z, gd = Math.hypot(gx, gz); if (gd < MIN_GAP && gd > 0.001){ x = opp.x + gx/gd*MIN_GAP; z = opp.z + gz/gd*MIN_GAP; }
    G.setView(x, z, yaw, 0.02);
    // stamina
    if (!f.act && !(f.dodge && t < f.dodge.end)) f.st = Math.min(ST, f.st + (blocking ? 6 : 20)*dt);
    if (f.act && t >= f.act.end) f.act = null;
    // their punches: note new ones, judge each at its impact time (or now, if it arrived late)
    if (ob && ob.pn && ob.pn.id && !f.seen.has(ob.pn.id)){ f.seen.add(ob.pn.id); f.pending.push(ob.pn); }
    for (const pn of f.pending.slice()){
      const cur = ob && ob.pn && ob.pn.id === pn.id ? ob.pn : pn;
      if (cur.c){ f.pending.splice(f.pending.indexOf(pn), 1); continue; }
      if (t >= pn.at){ f.pending.splice(f.pending.indexOf(pn), 1); const res = judge(opp, pn); if (res) f.lastHit = {id: pn.id, r: res.r, d: res.d}; if (!fight || fight.ph !== 'fight') return; }
    }
    // what happened to my punches (their report)
    if (ob && ob.hit && f.myPunches.has(ob.hit.id) && !f.acked.has(ob.hit.id)){
      f.acked.add(ob.hit.id); const h = ob.hit;
      if (h.r === 'hit' || h.r === 'counter' || h.r === 'break'){ f.stats.landed++; f.stats.dealt += h.d; popup(h.r === 'counter' ? 'COUNTER!' : h.r === 'break' ? 'Guard broken!' : 'Hit!', '#f2c230'); play('punch', 0.8, 0, f.myPunches.get(h.id) === 'h'); }
      else if (h.r === 'block'){ popup('Blocked', '#cfd6de'); play('block', 0.6, 0); }
      else if (h.r === 'dodge') popup('Dodged', '#9cc3e6');
      else if (h.r === 'miss') popup('Missed', 'rgba(255,255,255,.8)');
    }
    // the end
    if (ob && ob.ph === 'end' && (ob.end === 'ko' || ob.end === 'quit')){ finish('win'); return; }
    if (ob && ob.ph === 'end' && ob.end === 'time'){ finish('time'); return; }
    if (t >= f.t0 + ROUND*1000) finish('time');
  }
}
function finish(why){
  const f = fight; if (!f || f.ph === 'end') return;
  f.ph = 'end'; f.end = why === 'win' || why === 'left' ? 'won' : why;
  let res;
  if (why === 'ko') res = ['😵', 'Knocked out!', `${esc(f.vsName)} wins`];
  else if (why === 'quit') res = ['🏳️', 'You threw in the towel', `${esc(f.vsName)} wins`];
  else if (why === 'win') res = ['🏆', 'You win!', `${esc(f.vsName)} is down`];
  else if (why === 'left') res = ['🏆', 'You win!', `${esc(f.vsName)} left the ring`];
  else { const a = Math.round(f.hp), b = Math.round(f.oppHp); res = a > b ? ['🏆', 'You win on points!', `${a} – ${b}`] : a < b ? ['🥈', `${esc(f.vsName)} wins on points`, `${a} – ${b}`] : ['🤝', 'A draw', `${a} – ${b}`]; }
  const won = res[0] === '🏆'; if (won){ wins++; try { localStorage.setItem('office.boxWins', String(wins)); } catch (e) {} }
  play('bell', 1, 0, 3); if (won) setTimeout(() => play('cheer', 0.8, 0), 500);
  const st = f.stats, acc = st.thrown ? Math.round(st.landed/st.thrown*100) : 0;
  card.innerHTML = `<div style="font-size:30px;line-height:1">${res[0]}</div><h1 style="font-size:20px;margin:6px 0 2px;font-weight:600">${res[1]}</h1><div style="color:#454b55;margin-bottom:8px">${res[2]}</div>`
    + `<div style="display:grid;grid-template-columns:auto auto;gap:2px 18px;color:#454b55">`
    + `<span>Punches landed</span><b style="color:#1d2229">${st.landed} of ${st.thrown} (${acc}%)</b><span>Damage dealt</span><b style="color:#1d2229">${st.dealt}</b>`
    + `<span>Blocked</span><b style="color:#1d2229">${st.blocked}</b><span>Slipped</span><b style="color:#1d2229">${st.dodged}</b><span>Your wins</span><b style="color:#1d2229">${wins}</b></div>`
    + `<button type="button" style="margin-top:14px;width:100%;font-size:16px;padding:11px;border:0;border-radius:10px;background:#2f5d9e;color:#fff;font-weight:600">Leave the ring${isTouch() ? '' : ' (E)'}</button>`;
  const b = card.querySelector('button'), go = e => { e.preventDefault(); e.stopPropagation(); endFight(); };
  b.addEventListener('click', go); b.addEventListener('touchend', go);
  card.style.display = 'block'; help.style.display = 'none'; if (pad) pad.style.display = 'none';
}

// what the others see of me (sent with my position by mp.js)
function broadcast(){
  const f = fight, t = now(); if (!f){ G.state.bx = null; return; }
  let a = 'g', as = 0;
  if (f.ph === 'end') a = f.hp <= 0 || f.end === 'quit' ? 'k' : f.end === 'won' || f.end === 'win' ? 'w' : 'g';
  else if (t < f.stunUntil) a = 's';
  else if (f.act){ a = f.act.k; as = f.act.t0; }
  else if (f.dodge && t < f.dodge.end){ a = 'd'; as = f.dodge.start; }
  else if (keysDown.block) a = 'b';
  G.state.bx = {ph: f.ph, vs: f.vs, t0: f.t0, hp: Math.round(f.hp), st: Math.round(f.st/5)*5, a, as, dd: f.dodge ? f.dodge.dx : 0,
    pn: f.lastPn || null, hit: f.lastHit || null, end: f.ph === 'end' ? f.end : ''};
}

// ---------- other boxers: gloves and poses on their avatar (called by mp.js every frame) ----------
const GLOVE = {};
function poseBoxer(obj, bx, t){
  const L = obj.userData.limbs; if (!L) return;
  const on = bx && (bx.ph === 'count' || bx.ph === 'fight' || bx.ph === 'end');
  if (!on){ if (obj.userData.gloves){ for (const g of obj.userData.gloves) g.visible = false; L.armL.rotation.z = L.armR.rotation.z = 0; obj.rotation.x = obj.rotation.z = 0; obj.userData.gloves = null; } return; }
  if (!obj.userData.gloves){
    if (!GLOVE.geo){ GLOVE.geo = new THREE.BoxGeometry(0.16, 0.16, 0.18); GLOVE.red = new THREE.MeshStandardMaterial({color: 0xc62828, roughness: 0.4}); }
    obj.userData.gloves = [L.armL, L.armR].map(a => { let g = a.userData.glove; if (!g){ g = new THREE.Mesh(GLOVE.geo, GLOVE.red); g.position.set(0, -0.58, -0.02); a.add(g); a.userData.glove = g; } g.visible = true; return g; });
  }
  let lx = 2.1, rx = 2.1, lz = 0.35, rz = -0.35, bodyX = 0, bodyZ = 0;
  const p = bx.as ? (t - bx.as)/1000 : 0, bump = (m) => { const w = m.wind, h = m.hold, r = m.rec; return p < 0 ? 0 : p < w ? p/w : p < w + h ? 1 : Math.max(0, 1 - (p - w - h)/r); };
  if (bx.a === 'j'){ const e = bump(MOVES.j); lx = 2.1 + (1.57 - 2.1)*e; lz = 0.35 - 0.3*e; }
  else if (bx.a === 'h'){ const m = MOVES.h, e = bump(m), back = p < m.wind ? p/m.wind : 0; rx = 2.1 + (1.6 - 2.1)*e; rz = -0.35 - 0.6*back*(1 - e) + 0.95*e; }
  else if (bx.a === 'b'){ lx = rx = 2.75; lz = 0.55; rz = -0.55; }
  else if (bx.a === 'd'){ bodyZ = -(bx.dd || 0)*0.3*Math.max(0, 1 - p/0.3); }
  else if (bx.a === 's'){ bodyX = 0.18; lx = rx = 1.7; }
  else if (bx.a === 'k'){ bodyX = 1.35; lx = rx = 0.3; lz = rz = 0; }
  else if (bx.a === 'w'){ lx = rx = Math.PI; lz = 0.25; rz = -0.25; }
  L.armL.rotation.x = lx; L.armR.rotation.x = rx; L.armL.rotation.z = lz; L.armR.rotation.z = rz;
  obj.rotation.x = bodyX; obj.rotation.z = bodyZ;
}

// ---------- my view: gloves, health bars, effects ----------
function drawGlove(x, y, s, flip){
  g2.save(); g2.translate(x, y); g2.scale(flip ? -s : s, s);
  g2.fillStyle = '#f2f2ee'; g2.fillRect(-0.42, 0.55, 0.84, 0.5);                                   // cuff
  const grd = g2.createRadialGradient(-0.2, -0.3, 0.1, 0, 0, 1); grd.addColorStop(0, '#ef5350'); grd.addColorStop(1, '#8e1414');
  g2.fillStyle = grd; g2.beginPath(); g2.ellipse(0, 0, 0.55, 0.7, 0, 0, 7); g2.fill();
  g2.beginPath(); g2.ellipse(0.42, 0.12, 0.2, 0.32, -0.3, 0, 7); g2.fill();                             // thumb
  g2.strokeStyle = 'rgba(0,0,0,.25)'; g2.lineWidth = 0.03; g2.beginPath(); g2.moveTo(-0.35, -0.1); g2.quadraticCurveTo(0, 0.05, 0.3, -0.1); g2.stroke();
  g2.restore();
}
function draw(dt){
  const W = innerWidth, H = innerHeight, d = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W*d) || cv.height !== Math.round(H*d)){ cv.width = Math.round(W*d); cv.height = Math.round(H*d); }
  g2.setTransform(d, 0, 0, d, 0, 0); g2.clearRect(0, 0, W, H);
  const f = fight; if (!f || f.ph === 'wait') return;
  const t = now(), s = Math.min(W, H)*0.2;
  fx.shake = Math.max(0, fx.shake - dt); const sh = fx.shake > 0 ? (Math.random() - 0.5)*fx.shake*40 : 0;
  // gloves
  let L = {x: W*0.33, y: H*0.86, s}, Rg = {x: W*0.67, y: H*0.86, s};
  const blocking = keysDown.block && t >= f.stunUntil && !f.act;
  if (blocking){ L = {x: W*0.43, y: H*0.62, s: s*1.25}; Rg = {x: W*0.57, y: H*0.62, s: s*1.25}; }
  if (f.act){ const m = MOVES[f.act.k], p = (t - f.act.t0)/1000, e = p < m.wind ? p/m.wind : p < m.wind + m.hold ? 1 : Math.max(0, 1 - (p - m.wind - m.hold)/m.rec);
    if (f.act.k === 'j'){ L = {x: W*(0.33 + 0.15*e), y: H*(0.86 - 0.36*e), s: s*(1 - 0.45*e)}; }
    else { const back = p < m.wind ? p/m.wind : 0; Rg = {x: W*(0.67 + 0.06*back - 0.2*e), y: H*(0.86 - 0.32*e + 0.04*back), s: s*(1 - 0.4*e)}; } }
  if (f.ph === 'end' && f.end === 'won'){ L.y = H*0.55; Rg.y = H*0.55; }
  drawGlove(L.x + sh, L.y + sh, L.s, false); drawGlove(Rg.x + sh, Rg.y + sh, Rg.s, true);
  // hit flash
  fx.flash = Math.max(0, fx.flash - dt*1.8);
  if (fx.flash > 0){ const gr = g2.createRadialGradient(W/2, H/2, Math.min(W, H)*0.25, W/2, H/2, Math.max(W, H)*0.7); gr.addColorStop(0, 'rgba(200,0,0,0)'); gr.addColorStop(1, `rgba(200,0,0,${0.55*fx.flash})`); g2.fillStyle = gr; g2.fillRect(0, 0, W, H); }
  if (t < f.stunUntil){ g2.fillStyle = 'rgba(255,255,255,.12)'; g2.fillRect(0, 0, W, H); }
  // popups
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  fx.popups = fx.popups.filter(p => (p.t -= dt*0.9) > 0);
  fx.popups.forEach((p, i) => { g2.globalAlpha = Math.min(1, p.t*2); g2.font = '800 34px system-ui, sans-serif'; g2.lineWidth = 6; g2.strokeStyle = 'rgba(20,24,30,.7)';
    const y = H*0.38 - (1 - p.t)*40 - i*36; g2.strokeText(p.text, W/2, y); g2.fillStyle = p.color; g2.fillText(p.text, W/2, y); });
  g2.globalAlpha = 1;
  if (f.ph === 'count'){ const n = Math.max(1, Math.ceil((f.t0 - t)/1000)); g2.font = '800 110px system-ui, sans-serif'; g2.lineWidth = 8; g2.strokeStyle = 'rgba(20,24,30,.75)'; g2.fillStyle = '#fff';
    g2.strokeText(n > 3 ? 'Fight!' : String(n), W/2, H*0.42); g2.fillText(n > 3 ? 'Fight!' : String(n), W/2, H*0.42); }
}
function renderHud(){
  const f = fight; if (!f) return;
  if (f.ph === 'wait'){ hud.innerHTML = `<div style="text-align:center;font-weight:600">Waiting for ${esc(f.vsName)} to accept…</div><div style="text-align:center;font-size:12px;opacity:.75;margin-top:2px">${isTouch() ? 'Tap the prompt to cancel' : 'E: cancel'}</div>`; help.textContent = ''; return; }
  const t = now(), left = Math.max(0, Math.ceil(f.ph === 'count' ? ROUND : (f.t0 + ROUND*1000 - t)/1000));
  const bar = (v, col, flip) => `<span style="flex:1;height:12px;background:rgba(255,255,255,.18);border-radius:6px;overflow:hidden;display:flex;justify-content:${flip ? 'flex-end' : 'flex-start'}"><b style="display:block;height:100%;width:${Math.max(0, v)}%;background:${col}"></b></span>`;
  hud.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><b style="min-width:40px">You</b>${bar(f.hp, f.hp > 30 ? '#4caf50' : '#e53935')}<b style="font-size:16px;min-width:34px;text-align:center">${left}</b>${bar(f.oppHp, f.oppHp > 30 ? '#4caf50' : '#e53935', true)}<b style="min-width:40px;text-align:right">${esc(f.vsName).slice(0, 10)}</b></div>`
    + `<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><span style="min-width:40px;font-size:11px;opacity:.8">Stamina</span><span style="width:40%;height:6px;background:rgba(255,255,255,.18);border-radius:3px;overflow:hidden"><b style="display:block;height:100%;width:${f.st}%;background:${f.st < 25 ? '#ff9800' : '#f2c230'}"></b></span></div>`;
  help.textContent = isTouch() ? 'Drag to move · Jab · Hook · hold Block · ◀ Back ▶ to dodge' : 'Click / J jab · Right click / K hook · hold Space block · WASD move · Shift + direction dodge · E give up';
}

function tick(dt, keys){
  if (!G || !R) return '';
  animateRing(dt);
  if (fight){
    if (fight.ph !== 'end') step(dt, keys);
    if (fight){ broadcast(); renderHud(); }
    draw(dt);
    if (!fight) return '';
    if (fight.ph === 'end') return isTouch() ? 'Tap to leave the ring' : 'Press E to leave the ring';
    if (fight.ph === 'wait') return isTouch() ? 'Tap to cancel' : '';
    return '';
  }
  G.state.bx = null; draw(dt);
  if (!G.state.started || G.controlLock) return '';
  const tap = isTouch() ? 'Tap to ' : 'Press E to ';
  if (nearLever()) return tap + 'pull the lever';
  if (meInRing()){ const ch = challenger(); if (ch) return `${tap}accept ${ch.name}'s fight 🥊`; const rv = rival(); return rv ? `${tap}challenge ${rv.name} to a fight 🥊` : 'Waiting for an opponent to step into the ring'; }
  return '';
}

window.BOXING = {get fight(){ return fight; }, get ringUp(){ return ringUp; }, punch, dodge, block: on => { keysDown.block = on; }};   // for testing in the console
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
