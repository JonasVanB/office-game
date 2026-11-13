// Stiekem kussen (secret kissing) for two players, on the two beanbags in the Boekentoren.
// Each player sits on a beanbag (E). When both are taken the game starts. Kissing only happens while BOTH hold
// Space / the mouse button / a finger: the love meter fills. Meanwhile the colleague at the desk gets suspicious now and then,
// and from level 3 the boss peeks through the door. If either of you leans in while someone looks: caught (a life and some love).
// Warnings: typing stops, "?", a cough, footsteps, the door handle; sometimes a fake-out. 5 levels, 3 lives.
//
// Shared through presence: kb = beanbag 'A' | 'B', kh = holding, ks = start time (the host's), kg = game state (the host's).
// The player on beanbag A is the host and keeps the score; the watchers follow a schedule both players compute from the same seed.
import {sound, play} from './sound.js';
import {buildAvatar, animateAvatar, OPTIONS} from './avatar.js';

const BAGS = {A: {x: 36.62, z: 12.12, toX: 37.5, bag: [36.2, 12.2], stand: [36.2, 11.45]}, B: {x: 37.48, z: 12.28, toX: 36.6, bag: [37.9, 12.2], stand: [37.9, 11.45]}};
const DESK = [36.05, 9.3], DOORSPOT = [35.56, 7.35];
const LEVELS = [
  {time: 32, warn: 0.95, gap: [3.2, 6], look: [1.2, 1.8], feint: 0.0, boss: false},
  {time: 32, warn: 0.8, gap: [2.6, 5], look: [1.2, 2.0], feint: 0.2, boss: false},
  {time: 34, warn: 0.7, gap: [2.4, 4.6], look: [1.3, 2.1], feint: 0.25, boss: true},
  {time: 36, warn: 0.58, gap: [2.0, 4.2], look: [1.4, 2.3], feint: 0.35, boss: true},
  {time: 38, warn: 0.45, gap: [1.7, 3.6], look: [1.5, 2.5], feint: 0.4, boss: true},
];
const FILL = 0.15, DRAIN = 0.02, COUNT = 3000, BREAK = 1800;
const isTouch = () => !!window.__isTouch;
const face = (dx, dz) => Math.atan2(-dx, -dz);
const now = () => window.__serverNow ? window.__serverNow() : Date.now();
const rngOf = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

let G, THREE, hud, card, help, seat = null, holding = false, host = null, seen = {}, scene = null, best = 0, prevW = {desk: '', boss: ''}, pubAt = 0;
try { best = +localStorage.getItem('office.kissBest') || 0; } catch (e) {}
const el = (tag, css) => { const e = document.createElement(tag); e.style.cssText = css; document.body.appendChild(e); return e; };

function init(){
  G = window.GAME; THREE = G.THREE;
  hud = el('div', 'position:fixed;top:72px;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(40,16,30,.82);color:#fff;border-radius:12px;padding:8px 16px 9px;font-size:14px;text-align:center;pointer-events:none;min-width:290px;max-width:92vw'); hud.className = 'gameHud';
  help = el('div', 'position:fixed;bottom:22%;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(20,24,30,.7);color:#fff;border-radius:10px;padding:6px 12px;font-size:13px;pointer-events:none;text-align:center');
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:20px 22px 16px;width:min(340px,88vw);line-height:1.5;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35)');
  addEventListener('keydown', e => onKey(e, true), true); addEventListener('keyup', e => onKey(e, false), true);
  G.uses.unshift({tick, use});
}
function onKey(e, down){
  if (!seat) return; const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
  if (e.code === 'Space'){ e.preventDefault(); e.stopPropagation(); setHold(down); }
  if (down && e.code === 'Enter' && seat === 'A' && host && host.ph === 'over'){ e.preventDefault(); e.stopPropagation(); again(); }
}
function setHold(h){ h = !!h; if (h === holding) return; holding = h; if (window.__mpSend) window.__mpSend({kh: h ? 1 : 0}); }

// ---------- who sits where (you or another player) ----------
function occupants(){
  const o = {A: null, B: null}, t = performance.now();
  for (const r of (window.__mpRemotes ? window.__mpRemotes() : [])) if ((r.kb === 'A' || r.kb === 'B') && t - r.seen < 20000 && !o[r.kb]) o[r.kb] = r;
  if (seat) o[seat] = {key: 'me', me: true, name: 'You', av: window.__myAvatar && window.__myAvatar(), kh: holding ? 1 : 0, ks: host ? host.ks : 0, kg: host};
  return o;
}
function freeBag(){
  const s = G.state; if (!s.started || s.lv !== 0 || s.y > 1 || G.controlLock || seat) return null;
  if (!(s.x > 35 && s.x < 39.03 && s.z > 10.9 && s.z < 13)) return null;
  const o = occupants(); let pick = null, bd = 1.6;
  for (const k of ['A', 'B']){ if (o[k]) continue; const b = BAGS[k], d = Math.hypot(s.x - b.bag[0], s.z - b.bag[1]); if (d < bd){ bd = d; pick = k; } }
  return pick;
}
function use(){
  if (seat){ standUp(); return true; }
  const k = freeBag(); if (!k) return false;
  try { sound.unlock(); } catch (e) {}
  seat = k; holding = false; host = null; seen = {};
  const b = BAGS[k]; G.setView(b.stand[0], b.stand[1], face(36.5 - b.stand[0], 9 - b.stand[1]), -0.2);
  G.controlLock = {aim(){}, press(down){ setHold(down); }};
  if (window.__mpSend) window.__mpSend({kb: k, kh: 0, ks: 0, kg: null});
  help.style.display = 'block';
  help.textContent = (isTouch() ? 'Hold your finger to kiss' : 'Hold Space (or the mouse button) to kiss') + ' · both of you at the same time · ' + (isTouch() ? 'tap the prompt to stand up' : 'E: stand up');
  return true;
}
function standUp(){
  seat = null; holding = false; host = null; G.controlLock = null;
  if (window.__mpSend) window.__mpSend({kb: null, kh: 0, ks: 0, kg: null});
  hud.style.display = help.style.display = card.style.display = 'none';
  G.camera.fov = innerWidth < innerHeight ? 80 : 70; G.camera.updateProjectionMatrix();
  const d = (G.doors || []).find(x => x.name === 'Boekentoren'); if (d && d.target > 0) d.target = 0;
}

// ---------- the watchers follow a schedule both players compute from the same seed ----------
function watcher(seed, ls, L, t, isBoss){
  if (isBoss && !L.boss) return {st: 'away'};
  const R = rngOf(seed + (isBoss ? 101 : 7)), r = (a, b) => a + R()*(b - a);
  let time = ls + (isBoss ? r(5, 9) : r(...L.gap))*1000;
  for (let i = 0; i < 60 && time <= t; i++){
    const warnEnd = time + L.warn*1000*(isBoss ? 1.3 : 1), feint = R() < L.feint;
    if (t < warnEnd) return {st: 'warn', feint};
    if (feint){ time = warnEnd + r(...L.gap)*1000; continue; }
    const lookEnd = warnEnd + r(...L.look)*1000; if (t < lookEnd) return {st: 'look'};
    time = lookEnd + (isBoss ? r(6, 10) : r(...L.gap))*1000;
  }
  return {st: isBoss ? 'away' : 'work'};
}
const watchersAt = (g, t) => g.ph !== 'play' || t < g.ls ? {desk: {st: 'work'}, boss: {st: 'away'}}
  : {desk: watcher(g.ks + g.lv*7919, g.ls, LEVELS[g.lv], t, false), boss: watcher(g.ks + g.lv*7919, g.ls, LEVELS[g.lv], t, true)};

// ---------- the host (beanbag A) runs the game and publishes it ----------
function hostStep(o, dt){
  const t = now(), partner = o.B;
  if (!partner){ if (host){ host = null; publish(true); } return; }
  if (!host){ host = {ks: t + COUNT, ls: t + COUNT, lv: 0, love: 0, lives: 3, ph: 'count', ca: 0, cl: 0, sc: 0, won: 0, cu: 0, kiss: 0, cLvl: 0}; publish(true); return; }
  const g = host;
  if (g.ph === 'count' && t >= g.ks){ g.ph = 'play'; publish(true); }
  if (g.ph !== 'play') return;
  if (t < g.ls){ g.kiss = 0; publish(); return; }   // short break between levels
  const L = LEVELS[g.lv], w = watchersAt(g, t), aHold = holding, bHold = !!partner.kh, kiss = aHold && bHold;
  g.kiss = kiss ? 1 : 0;
  if ((aHold || bHold) && t > g.cu && (w.desk.st === 'look' || w.boss.st === 'look')){
    g.lives--; g.ca++; g.cLvl++; g.love = Math.max(0, g.love - 0.3); g.cu = t + 1600; g.by = w.boss.st === 'look' ? 'boss' : 'desk';
    if (g.lives <= 0){ g.ph = 'over'; g.won = 0; } publish(true); return;
  }
  if (kiss && t > g.cu){ g.love = Math.min(1, g.love + FILL*dt); g.sc += 10*dt*(1 + g.lv*0.5); } else g.love = Math.max(0, g.love - DRAIN*dt);
  if (g.love >= 1){
    g.sc += 100 + Math.max(0, L.time*1000 - (t - g.ls))/1000*8 + (g.cLvl === 0 ? 150 : 0); g.cl = g.cLvl === 0 ? g.lv + 1 : 0;
    if (g.lv === 4){ g.ph = 'over'; g.won = 1; } else { g.lv++; g.ls = t + BREAK; g.love = 0; g.cLvl = 0; }
    publish(true); return;
  }
  if (t - g.ls > L.time*1000){ g.ph = 'over'; g.won = 0; g.timeup = 1; publish(true); return; }
  publish();
}
function publish(force){
  const t = performance.now(); if (!force && t - pubAt < 180) return; pubAt = t;
  if (!window.__mpSend) return;
  window.__mpSend({ks: host ? host.ks : 0, kg: host ? {ks: host.ks, ls: host.ls, lv: host.lv, love: Math.round(host.love*1000)/1000, lives: host.lives, ph: host.ph, ca: host.ca, cl: host.cl,
    sc: Math.round(host.sc), won: host.won, cu: host.cu, by: host.by || '', kiss: host.kiss, timeup: host.timeup || 0} : null});
}

// ---------- every frame: everyone (players and onlookers) draws the scene; the host also runs the game ----------
function tick(dt, keys){
  if (!G) return '';
  const o = occupants();
  if (seat){
    const s = G.state, b = BAGS[seat];
    if (Math.hypot(s.x - b.stand[0], s.z - b.stand[1]) > 0.4 || (keys && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD))){ standUp(); return ''; }
    if (seat === 'A') hostStep(o, dt);
    else host = o.A && o.A.kg ? o.A.kg : null;   // B mirrors the host's game
  }
  draw(occupants(), dt);
  if (seat){
    G.camera.fov = 64; G.camera.updateProjectionMatrix(); G.camera.position.set(38.85, 2.45, 12.85); G.camera.lookAt(36.55, 0.75, 10.4);
    updateHud(occupants());
    return isTouch() ? 'Stand up' : '';
  }
  const k = freeBag(); if (!k) return '';
  const other = o[k === 'A' ? 'B' : 'A'];
  return (isTouch() ? 'Tap' : 'Press E') + ' to sit on the beanbag 💋' + (other ? ` · ${other.name} is waiting for you!` : ' · Stiekem kussen needs 2 players');
}

// ---------- drawing: the seated players, the colleague at the desk, the boss ----------
function makeScene(){
  const sk = OPTIONS.skin;
  const desk = buildAvatar(THREE, {skin: sk[2], shirt: '#7f8c8d', pants: '#22242a', hair: 'bald', hairColor: '#222222', facial: 'fullbeard', facialColor: '#5a4632'});
  const DL = desk.userData.limbs; DL.legL.rotation.x = DL.legR.rotation.x = 1.45; DL.armL.rotation.x = DL.armR.rotation.x = 1.1;
  desk.position.set(DESK[0], -0.4, DESK[1]); desk.rotation.y = face(1, 0); desk.visible = false; G.scene.add(desk);
  const boss = buildAvatar(THREE, {skin: sk[1], shirt: '#1d2229', pants: '#1d2229', hair: 'short', hairColor: '#8a8a8a', facial: 'moustache', facialColor: '#8a8a8a'});
  { const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.01), new THREE.MeshStandardMaterial({color: 0xb3262a})); tie.position.set(0, 1.28, -0.135); boss.add(tie); }
  boss.rotation.y = face(0, 1); boss.visible = false; G.scene.add(boss);
  const tex = drawFn => { const c = document.createElement('canvas'); c.width = c.height = 128; drawFn(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
  const heartTex = tex(g => { g.fillStyle = '#ff3b6b'; g.font = '100px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('❤', 64, 70); });
  const mark = ch => tex(g => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill(); g.fillStyle = ch === '!' ? '#c0392b' : '#2f5d9e'; g.font = '700 90px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70); });
  const sprite = (t, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: false, depthTest: false})); sp.scale.set(s, s, 1); sp.visible = false; sp.renderOrder = 5; G.scene.add(sp); return sp; };
  return {desk, boss, q: mark('?'), x: mark('!'), deskMark: sprite(mark('?'), 0.32), bossMark: sprite(mark('?'), 0.32), hearts: Array.from({length: 10}, () => ({s: sprite(heartTex, 0.16), age: 9})), seated: {}};
}
function seatedMesh(k, who){
  const S = scene.seated, id = who.key + '|' + JSON.stringify(who.av);
  if (S[k] && S[k].id !== id){ G.scene.remove(S[k].m); S[k] = null; }
  if (!S[k]){ const m = buildAvatar(THREE, who.av || {}); const L = m.userData.limbs; L.legL.rotation.x = L.legR.rotation.x = 1.15;
    const b = BAGS[k]; m.position.set(b.x, -0.42, b.z); m.rotation.y = face(b.toX - b.x, 0); G.scene.add(m); S[k] = {m, id, lean: 0}; }
  return S[k];
}
function draw(o, dt){
  if (!scene) scene = makeScene();
  const g = (o.A && o.A.kg) || null, live = !!(o.A && o.B && g && g.ph), t = now();
  // seated players lean in while they hold; a caught couple bounces apart
  for (const k of ['A', 'B']){
    const who = o[k];
    if (!who){ if (scene.seated[k]){ G.scene.remove(scene.seated[k].m); scene.seated[k] = null; } continue; }
    const S = seatedMesh(k, who), caught = live && t < g.cu, want = who.kh && !caught ? 1 : 0;
    S.lean += (want - S.lean)*Math.min(1, dt*(want ? 6 : 9)); S.m.children[0].rotation.x = -0.27*S.lean;
    S.m.position.y = -0.42 + (caught ? Math.max(0, Math.sin((1600 - (g.cu - t))/1600*Math.PI*3))*0.1 : 0);
  }
  const w = live ? watchersAt(g, t) : {desk: {st: 'work'}, boss: {st: 'away'}};
  const dm = scene.desk, DL = dm.userData.limbs; dm.visible = !!(o.A || o.B);
  // the colleague at the desk: types, stops ("?"), turns round ("!"), or stretches (a fake-out)
  const look = w.desk.st === 'look' ? 1 : 0;
  dm.userData.turn = (dm.userData.turn || 0) + (look - (dm.userData.turn || 0))*Math.min(1, dt*9); dm.rotation.y = face(1, 0) - dm.userData.turn*Math.PI/2;
  const typing = w.desk.st === 'work';
  DL.armL.rotation.x = DL.armR.rotation.x = typing ? 1.1 + Math.sin(performance.now()/60)*0.08 : (w.desk.st === 'warn' && w.desk.feint ? -2.6 : 0.9);
  scene.deskMark.visible = dm.visible && (w.desk.st === 'warn' || w.desk.st === 'look'); scene.deskMark.material.map = w.desk.st === 'look' ? scene.x : scene.q; scene.deskMark.position.set(dm.position.x, 1.75, dm.position.z);
  // the boss: walks up outside, the door opens, he leans in
  const bm = scene.boss, bt = w.boss.st === 'warn' ? 0.5 : w.boss.st === 'look' ? 1 : 0;
  bm.userData.k = (bm.userData.k || 0) + (bt - (bm.userData.k || 0))*Math.min(1, dt*4);
  bm.visible = live && bm.userData.k > 0.03; bm.position.set(DOORSPOT[0], 0, DOORSPOT[1] - 1.4 + bm.userData.k*1.4); animateAvatar(bm, dt*6, w.boss.st === 'warn' ? 0.6 : 0);
  scene.bossMark.visible = bm.visible && (w.boss.st === 'warn' || w.boss.st === 'look'); scene.bossMark.material.map = w.boss.st === 'look' ? scene.x : scene.q; scene.bossMark.position.set(bm.position.x, 2.15, bm.position.z);
  const door = (G.doors || []).find(x => x.name === 'Boekentoren');   // opened locally only, for the peek
  if (door && live){ if (w.boss.st === 'look' && door.target <= 0) door.target = G.DOOR_OPEN; else if (w.boss.st !== 'look' && prevW.boss === 'look') door.target = 0; }
  // sounds when a watcher changes mood (only for the players and people nearby)
  const near = seat || (G.state.lv === 0 && Math.hypot(G.state.x - 37, G.state.z - 10.5) < 8);
  if (near && live){
    if (w.desk.st === 'warn' && prevW.desk !== 'warn'){ play('chair', 1, -0.3); setTimeout(() => play('cough', 0.9, -0.3), 150); }
    if (w.boss.st === 'warn' && prevW.boss !== 'warn') play('steps', 0.7, -0.6);
    if (w.boss.st === 'look' && prevW.boss !== 'look') play('creak', 0.8, -0.6);
    if (typing && Math.random() < dt*3) play('keys', 0.3, -0.3);
    if (g.kiss && Math.random() < dt*2.5) play('smooch', 0.6, 0.3);
  }
  prevW = {desk: w.desk.st, boss: w.boss.st};
  // hearts float up while both kiss
  const A = scene.seated.A, B = scene.seated.B, kissing = live && g.kiss && A && B;
  for (const h of scene.hearts){
    h.age += dt;
    if (h.age > 1.4 && kissing && Math.random() < dt*4){ h.age = 0; h.ox = (Math.random() - 0.5)*0.3; h.oz = (Math.random() - 0.5)*0.3; }
    h.s.visible = h.age < 1.4 && !!(A && B);
    if (h.s.visible){ h.s.position.set((A.m.position.x + B.m.position.x)/2 + h.ox, 1.25 + h.age*0.45, (A.m.position.z + B.m.position.z)/2 + h.oz); h.s.material.opacity = 1 - h.age/1.4; const sc = 0.12 + h.age*0.08; h.s.scale.set(sc, sc, 1); }
  }
}

// ---------- the HUD, results and achievements for the two players ----------
function updateHud(o){
  const g = host, partner = o[seat === 'A' ? 'B' : 'A'], t = now();
  hud.style.display = 'block';
  if (!partner){ hud.innerHTML = `💋 <b>Stiekem kussen</b><div style="margin-top:4px">Waiting for a colleague on the other beanbag…</div><div style="font-size:12px;opacity:.75;margin-top:2px">It takes two. Ask someone in the chat (Enter)!</div>`; card.style.display = 'none'; return; }
  if (!g){ hud.innerHTML = `💋 Stiekem kussen with <b>${esc(partner.name)}</b><div>Getting ready…</div>`; card.style.display = 'none'; return; }
  achievements(g);
  if (g.ph === 'over'){ results(g, partner); return; }
  card.style.display = 'none';
  if (g.ph === 'count' || t < g.ks){ hud.innerHTML = `💋 Stiekem kussen with <b>${esc(partner.name)}</b><div style="font-size:28px;font-weight:700">${Math.max(1, Math.ceil((g.ks - t)/1000))}</div><div style="font-size:12px;opacity:.8">Hold together to kiss. Let go when someone looks!</div>`; return; }
  const w = watchersAt(g, t), hearts = '❤️'.repeat(Math.max(0, g.lives)) + '🤍'.repeat(Math.max(0, 3 - g.lives)), left = Math.max(0, Math.ceil((LEVELS[g.lv].time*1000 - (t - g.ls))/1000));
  const status = t < g.ls ? `<div style="font-weight:700">Level ${g.lv + 1}… get ready 💕</div>`
    : t < g.cu ? `<div style="font-size:18px;font-weight:700">${g.by === 'boss' ? 'The BOSS saw you! 😳' : 'Caught! 😳'}</div>`
    : (w.desk.st === 'look' || w.boss.st === 'look') ? '<div style="color:#ff6a6a;font-weight:700">👀 STOP! Someone is looking!</div>'
    : (w.desk.st === 'warn' || w.boss.st === 'warn') ? '<div style="color:#ffd27a;font-weight:600">⚠️ Someone is getting suspicious…</div>'
    : holding && !partner.kh ? `<div style="color:#ffb3c7">Waiting for ${esc(partner.name)} to lean in too…</div>`
    : !holding && partner.kh ? `<div style="color:#ffb3c7">${esc(partner.name)} is leaning in… hold!</div>` : '<div style="opacity:.6">…the coast is clear</div>';
  hud.innerHTML = `<div style="font-size:12px;opacity:.85">💋 with <b>${esc(partner.name)}</b> · level ${g.lv + 1}/5 · ${hearts} · ⏱ ${left} s · ${g.sc} pts</div>`
    + `<div style="height:12px;border-radius:6px;background:rgba(255,255,255,.18);overflow:hidden;margin:6px 0 4px"><b style="display:block;height:100%;width:${(g.love*100).toFixed(1)}%;background:linear-gradient(90deg,#ff7aa2,#ff2d6b)"></b></div>${status}`;
}
function achievements(g){
  const A = window.__ach || (() => {});
  if (seen.key !== g.ks) seen = {key: g.ks, ca: 0, lv: 0, over: false};
  if (g.kiss) A('k_first');
  if (g.ca > seen.ca){ A('k_caught'); play('buzz', 0.9, 0); seen.ca = g.ca; }
  if (g.lv > seen.lv){ if (g.cl) A('k_clean'); if (g.lv >= 2) A('k_l3'); if (g.lv >= 4) A('k_l5'); play('cheer', 0.6, 0); seen.lv = g.lv; }
}
function results(g, partner){
  hud.style.display = 'none';
  if (seen.over) return;
  seen.over = true; const sc = g.sc, isBest = sc > best; if (isBest){ best = sc; try { localStorage.setItem('office.kissBest', String(best)); } catch (e) {} }
  if (window.__xp) window.__xp(Math.max(5, Math.round(sc/20)), 'Stiekem kussen with ' + partner.name);
  if (g.won){ if (window.__ach) window.__ach('k_all'); play('cheer', 1, 0); if (seat === 'A' && window.__mpSay) window.__mpSay(`💋 cleared all 5 levels of Stiekem kussen with ${partner.name} (${sc} points)`); }
  else play('buzz', 0.6, 0);
  const lvl = g.won ? 5 : g.lv;
  const head = g.won ? ['💍', 'True love wins!'] : g.timeup ? ['⏱️', 'Time is up…'] : lvl >= 2 ? ['💔', 'Busted… but it was worth it'] : ['😳', 'Office romance over'];
  card.innerHTML = `<div style="font-size:30px;line-height:1">${head[0]}</div><h1 style="font-size:20px;margin:6px 0 8px;font-weight:600">${head[1]}</h1>`
    + `<div style="display:grid;grid-template-columns:auto auto;gap:2px 18px;color:#454b55"><span>Together with</span><b style="color:#1d2229">${esc(partner.name)}</b><span>Score</span><b style="color:#1d2229">${sc}${isBest ? ' · new best!' : ''}</b>`
    + `<span>Levels cleared</span><b style="color:#1d2229">${lvl} of 5</b><span>Caught</span><b style="color:#1d2229">${g.ca}×</b><span>Your best</span><b style="color:#1d2229">${best}</b></div>`
    + `<div style="margin-top:10px;color:#5a6472;font-size:13px">${seat === 'A' ? (isTouch() ? 'Tap Again to play again' : 'Press Enter to play again') : 'Waiting for your partner to start again'} · ${isTouch() ? 'tap the prompt to stand up' : 'E to stand up'}</div>`;
  if (seat === 'A'){ const b = document.createElement('button'); b.type = 'button'; b.textContent = isTouch() ? 'Again' : 'Again (Enter)';
    b.style.cssText = 'display:block;width:100%;margin-top:10px;font-size:16px;padding:11px;border:0;border-radius:10px;font-weight:600;cursor:pointer;background:#c0392b;color:#fff';
    const go = e => { e.preventDefault(); e.stopPropagation(); again(); }; b.addEventListener('click', go); b.addEventListener('touchend', go); card.appendChild(b); }
  card.style.display = 'block';
}
function again(){ if (seat !== 'A') return; host = null; seen = {}; card.style.display = 'none'; }

window.KISS = {get seat(){ return seat; }, get game(){ return host; }, occupants: () => occupants()};   // for testing in the console
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
