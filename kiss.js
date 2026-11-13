// Stiekem kussen (secret kissing) on the beanbags in the Boekentoren.
// Two colleagues in love sit on the beanbags. Hold Space / the mouse button / a finger to let them kiss: the love meter fills.
// But the colleague at the desk gets suspicious now and then and turns around, and from level 3 the boss peeks through the door.
// Kissing while someone looks = caught: a life and some love gone. Read the warnings (typing stops, "?", a cough, footsteps,
// the door handle) and watch out for fake-outs. Fill the meter before the time runs out; 5 levels, 3 lives.
import {sound, play} from './sound.js';
import {buildAvatar, animateAvatar, OPTIONS} from './avatar.js';

const BAG_A = [36.2, 12.2], BAG_B = [37.9, 12.2];
const STAND = [38.62, 12.55];                       // where you watch from (beside the orange beanbag)
const DESK = [36.05, 9.3];                          // the suspicious colleague's chair (faces the desk, +x)
const DOORSPOT = [35.56, 7.35];                     // the boss in the Boekentoren doorway
const LEVELS = [
  {time: 30, warn: 0.95, gap: [3.2, 6], look: [1.2, 1.8], feint: 0.0, boss: false},
  {time: 30, warn: 0.8, gap: [2.6, 5], look: [1.2, 2.0], feint: 0.2, boss: false},
  {time: 32, warn: 0.7, gap: [2.4, 4.6], look: [1.3, 2.1], feint: 0.25, boss: true},
  {time: 34, warn: 0.58, gap: [2.0, 4.2], look: [1.4, 2.3], feint: 0.35, boss: true},
  {time: 36, warn: 0.45, gap: [1.7, 3.6], look: [1.5, 2.5], feint: 0.4, boss: true},
];
const FILL = 0.16, DRAIN = 0.02;                    // love per second while kissing / slowly fading when not
const isTouch = () => !!window.__isTouch;
const rand = (a, b) => a + Math.random()*(b - a);
const face = (dx, dz) => Math.atan2(-dx, -dz);
let G, THREE, hud, card, help, game = null, cast = null, best = 0, holding = false;
try { best = +localStorage.getItem('office.kissBest') || 0; } catch (e) {}

function el(tag, css){ const e = document.createElement(tag); e.style.cssText = css; document.body.appendChild(e); return e; }

function init(){
  G = window.GAME; THREE = G.THREE;
  hud = el('div', 'position:fixed;top:72px;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(40,16,30,.8);color:#fff;border-radius:12px;padding:8px 16px 9px;font-size:14px;text-align:center;pointer-events:none;min-width:280px');
  help = el('div', 'position:fixed;bottom:22%;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(20,24,30,.7);color:#fff;border-radius:10px;padding:6px 12px;font-size:13px;pointer-events:none;text-align:center');
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:20px 22px 16px;width:min(340px,88vw);line-height:1.5;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35)');
  addEventListener('keydown', e => onKey(e, true), true); addEventListener('keyup', e => onKey(e, false), true);
  G.uses.unshift({tick, use});
}
function onKey(e, down){
  if (!game) return; const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
  if (e.code === 'Space'){ e.preventDefault(); e.stopPropagation(); holding = down && game.ph === 'play'; }
  if (down && e.code === 'Enter' && game.ph === 'over'){ e.preventDefault(); e.stopPropagation(); start(); }
}

// ---------- the cast: the couple, the colleague at the desk, the boss ----------
function makeCast(){
  const sit = (a, x, z, toX) => {
    const m = buildAvatar(THREE, a); const L = m.userData.limbs;
    L.legL.rotation.x = L.legR.rotation.x = 1.15;   // legs forward, sitting low in the beanbag
    m.position.set(x, -0.42, z); m.rotation.y = face(toX - x, 0); G.scene.add(m); return m;
  };
  const sk = OPTIONS.skin;
  const a = sit({skin: sk[1], shirt: '#c0392b', pants: '#2c3e50', hair: 'curly', hairColor: '#4a2f1f', facial: 'none', facialColor: '#4a2f1f'}, 36.62, 12.12, 37.5);
  const b = sit({skin: sk[3], shirt: '#2f5d9e', pants: '#3b3f45', hair: 'short', hairColor: '#1f1a17', facial: 'stubble', facialColor: '#1f1a17'}, 37.48, 12.28, 36.6);
  const desk = buildAvatar(THREE, {skin: sk[2], shirt: '#7f8c8d', pants: '#22242a', hair: 'bald', hairColor: '#222222', facial: 'fullbeard', facialColor: '#5a4632'});
  const DL = desk.userData.limbs; DL.legL.rotation.x = DL.legR.rotation.x = 1.45; DL.armL.rotation.x = DL.armR.rotation.x = 1.1;
  desk.position.set(DESK[0], -0.4, DESK[1]); desk.rotation.y = face(1, 0); G.scene.add(desk);
  const boss = buildAvatar(THREE, {skin: sk[1], shirt: '#1d2229', pants: '#1d2229', hair: 'short', hairColor: '#8a8a8a', facial: 'moustache', facialColor: '#8a8a8a'});
  { const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.01), new THREE.MeshStandardMaterial({color: 0xb3262a})); tie.position.set(0, 1.28, -0.135); boss.add(tie); }
  boss.position.set(DOORSPOT[0], 0, DOORSPOT[1] - 1.4); boss.rotation.y = face(0, 1); boss.visible = false; G.scene.add(boss);
  // floating bits: hearts while kissing, "?" and "!" over a watcher
  const tex = (draw, w = 128, h = 128) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
  const heartTex = tex(g => { g.fillStyle = '#ff3b6b'; g.font = '100px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('❤', 64, 70); });
  const mark = ch => tex(g => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill(); g.fillStyle = ch === '!' ? '#c0392b' : '#2f5d9e'; g.font = '700 90px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70); });
  const sprite = (t, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: false, depthTest: false})); sp.scale.set(s, s, 1); sp.visible = false; sp.renderOrder = 5; G.scene.add(sp); return sp; };
  const hearts = Array.from({length: 10}, () => ({s: sprite(heartTex, 0.16), age: 9}));
  const q = mark('?'), x = mark('!');
  const deskMark = sprite(q, 0.32), bossMark = sprite(q, 0.32);
  const blush = [a, b].map(m => { const s = sprite(tex(g => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 60); gr.addColorStop(0, 'rgba(255,60,90,.75)'); gr.addColorStop(1, 'rgba(255,60,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }), 0.45); return s; });
  return {a, b, desk, boss, hearts, deskMark, bossMark, blush, q, x, lean: 0, all: [a, b, desk]};
}
function showCast(on){ if (!cast) cast = makeCast(); for (const m of cast.all) m.visible = on; if (!on){ cast.boss.visible = false; for (const h of cast.hearts) h.s.visible = false; cast.deskMark.visible = cast.bossMark.visible = false; for (const b of cast.blush) b.visible = false; } }

// ---------- flow ----------
const near = () => { const s = G.state; return s.started && s.lv === 0 && s.y < 1 && s.x > 35 && s.x < 39.03 && s.z > 10.9 && s.z < 13; };
function use(){
  if (game){ if (game.ph === 'over') close(); else if (isTouch() && game.ph === 'menu') start(); else close(); return true; }
  if (!near() || G.controlLock) return false;
  try { sound.unlock(); } catch (e) {}
  G.setView(STAND[0], STAND[1], face(36.2 - STAND[0], 10.4 - STAND[1]), -0.32);
  G.controlLock = {aim(){}, press(down){ if (game) holding = down && game.ph === 'play'; }};
  showCast(true); game = {ph: 'menu', level: 0, score: 0, lives: 3, caughtTotal: 0};
  card.innerHTML = `<div style="font-size:30px;line-height:1">💋</div><h1 style="font-size:20px;margin:6px 0 6px;font-weight:600">Stiekem kussen</h1>`
    + `<div style="color:#454b55">These two are madly in love. ${isTouch() ? '<b>Hold your finger</b> on the screen' : '<b>Hold Space</b> (or the mouse button)'} to let them kiss and fill the love meter before the time runs out.<br><br>`
    + `But don't get caught! The colleague at the desk gets suspicious: the typing stops, a <b>?</b> appears, a cough… and then they turn around. From level 3 the boss peeks through the door too (you'll hear footsteps). Sometimes it's a fake-out.</div>`;
  card.appendChild(btn(isTouch() ? 'Start' : 'Start (Enter)', start, true)); card.appendChild(btn(isTouch() ? 'Close' : 'Close (E)', close));
  card.style.display = 'block';
  return true;
}
function btn(label, f, primary){ const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
  b.style.cssText = `display:block;width:100%;margin-top:10px;font-size:16px;padding:11px;border:0;border-radius:10px;font-weight:600;cursor:pointer;background:${primary ? '#c0392b' : '#e6eaf0'};color:${primary ? '#fff' : '#1d2229'}`;
  const go = e => { e.preventDefault(); e.stopPropagation(); f(); }; b.addEventListener('click', go); b.addEventListener('touchend', go); return b; }
addEventListener('keydown', e => { if (game && game.ph === 'menu' && e.code === 'Enter'){ e.preventDefault(); e.stopPropagation(); start(); } }, true);
function start(){
  game = {ph: 'play', level: 0, score: 0, lives: 3, caughtTotal: 0}; newLevel(0);
  card.style.display = 'none'; hud.style.display = 'block'; help.style.display = 'block';
  help.textContent = isTouch() ? 'Hold your finger to kiss · let go when someone looks!' : 'Hold Space to kiss · let go when someone looks! · E: stop';
}
function newLevel(i){
  const L = LEVELS[i]; Object.assign(game, {level: i, L, love: 0, t: L.time, caughtLvl: 0, cooldown: 0,
    desk: {st: 'work', until: rand(...L.gap)}, boss: {st: 'away', until: L.boss ? rand(5, 9) : 1e9}});
  window.__ach && i >= 2 && window.__ach('k_l3'); window.__ach && i >= 4 && window.__ach('k_l5');
}
function close(){ game = null; holding = false; showCast(false); G.camera.fov = innerWidth < innerHeight ? 80 : 70; G.camera.updateProjectionMatrix(); G.controlLock = null; hud.style.display = help.style.display = card.style.display = 'none'; closeDoor(); }
const bossDoor = () => (G.doors || []).find(d => d.name === 'Boekentoren');
function closeDoor(){ const d = bossDoor(); if (d && d.target > 0) d.target = 0; }

// a watcher's moods: work → warn ("?", typing stops, cough) → look (caught if kissing) → back to work. A feint: warn, then back.
function stepWatcher(w, dt, L, isBoss){
  w.until -= dt;
  if (w.until > 0) return;
  if (w.st === 'work' || w.st === 'away'){
    w.st = 'warn'; w.feint = Math.random() < L.feint; w.until = L.warn*(isBoss ? 1.3 : 1);
    if (isBoss){ play('steps', 0.7, -0.6); } else { play('chair', 1, -0.3); setTimeout(() => game && play('cough', 0.9, -0.3), 150); }
  } else if (w.st === 'warn'){
    if (w.feint){ w.st = isBoss ? 'away' : 'work'; w.until = rand(...L.gap); if (!isBoss) w.stretch = 0.8; }
    else { w.st = 'look'; w.until = rand(...L.look); if (isBoss){ const d = bossDoor(); if (d) d.target = G.DOOR_OPEN; play('creak', 0.8, -0.6); } }
  } else if (w.st === 'look'){
    w.st = isBoss ? 'away' : 'work'; w.until = isBoss ? rand(6, 10) : rand(...L.gap); if (isBoss) closeDoor();
  }
}
function caught(who){
  const g = game; g.lives--; g.caughtLvl++; g.caughtTotal++; g.love = Math.max(0, g.love - 0.3); g.cooldown = 1.6; holding = false;
  g.flash = {text: who === 'boss' ? 'The BOSS saw you! 😳' : 'Caught! 😳', until: performance.now() + 1500};
  play('buzz', 0.9, 0); window.__ach && window.__ach('k_caught');
  if (g.lives <= 0) setTimeout(() => game && over(false), 900);
}
function over(won){
  const g = game; g.ph = 'over'; holding = false; hud.style.display = help.style.display = 'none';
  const lvl = won ? 5 : g.level, score = Math.round(g.score);
  const isBest = score > best; if (isBest){ best = score; try { localStorage.setItem('office.kissBest', String(best)); } catch (e) {} }
  if (window.__xp) window.__xp(Math.max(5, Math.round(score/20)), 'Stiekem kussen');
  if (won){ window.__ach && window.__ach('k_all'); play('cheer', 1, 0); window.__mpSay && window.__mpSay(`💋 got through all 5 levels of Stiekem kussen (${score} points)`); }
  const head = won ? ['💍', 'True love wins!'] : lvl >= 3 ? ['💔', 'Busted… but it was worth it'] : ['😳', 'Office romance over'];
  card.innerHTML = `<div style="font-size:30px;line-height:1">${head[0]}</div><h1 style="font-size:20px;margin:6px 0 8px;font-weight:600">${head[1]}</h1>`
    + `<div style="display:grid;grid-template-columns:auto auto;gap:2px 18px;color:#454b55"><span>Score</span><b style="color:#1d2229">${score}${isBest ? ' · new best!' : ''}</b>`
    + `<span>Levels cleared</span><b style="color:#1d2229">${lvl} of 5</b><span>Caught</span><b style="color:#1d2229">${g.caughtTotal}×</b><span>Your best</span><b style="color:#1d2229">${best}</b></div>`;
  card.appendChild(btn(isTouch() ? 'Again' : 'Again (Enter)', start, true)); card.appendChild(btn(isTouch() ? 'Done' : 'Done (E)', close));
  card.style.display = 'block';
}

// ---------- every frame ----------
function tick(dt, keys){
  if (!G) return '';
  if (!game) return near() && !G.controlLock ? (isTouch() ? 'Tap to play Stiekem kussen 💋' : 'Press E to play Stiekem kussen 💋') : '';
  const s = G.state;
  if (Math.hypot(s.x - STAND[0], s.z - STAND[1]) > 0.4 || (keys && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD))){ close(); return ''; }
  const g = game, now = performance.now();
  if (g.ph === 'play'){
    const L = g.L; g.t -= dt; g.cooldown = Math.max(0, g.cooldown - dt);
    stepWatcher(g.desk, dt, L, false); stepWatcher(g.boss, dt, L, true);
    const want = holding && g.cooldown === 0 ? 1 : 0;
    cast.lean += (want - cast.lean)*Math.min(1, dt*(want ? 6 : 9));
    const kissing = cast.lean > 0.55;
    if (kissing){ g.love = Math.min(1, g.love + FILL*dt); g.score += 10*dt*(1 + g.level*0.5); if (Math.random() < dt*2.5) play('smooch', 0.6, 0.3); window.__ach && window.__ach('k_first'); }
    else g.love = Math.max(0, g.love - DRAIN*dt);
    if (kissing && g.cooldown === 0){ if (g.desk.st === 'look') caught('desk'); else if (g.boss.st === 'look') caught('boss'); }
    if (g.ph === 'play' && g.love >= 1){
      g.score += 100 + Math.max(0, g.t)*8 + (g.caughtLvl === 0 ? 150 : 0); if (g.caughtLvl === 0 && window.__ach) window.__ach('k_clean');
      play('cheer', 0.7, 0); g.flash = {text: g.level === 4 ? '💍 True love!' : `Level ${g.level + 1} cleared! 💕`, until: now + 1600};
      if (g.level === 4) over(true); else newLevel(g.level + 1);
    } else if (g.ph === 'play' && g.t <= 0){ g.flash = {text: 'Time is up… 💔', until: now + 1500}; g.ph = 'ending'; setTimeout(() => game && over(false), 1200); }
  } else cast.lean += (0 - cast.lean)*Math.min(1, dt*6);
  animate(dt, now); updateHud(now);
  // a high corner camera for the scene: the couple below, the desk and the door further away (overrides your view while playing)
  G.camera.fov = 64; G.camera.updateProjectionMatrix(); G.camera.position.set(38.85, 2.45, 12.85); G.camera.lookAt(36.55, 0.75, 10.4);
  return g.ph === 'play' && isTouch() ? '' : '';
}
function animate(dt, now){
  const c = cast, l = c.lean, g = game, jump = g.cooldown > 0 ? Math.sin(Math.min(1, (1.6 - g.cooldown)*3)*Math.PI)*0.12 : 0;
  // the couple lean towards each other from the hips (pitch the body forward); caught: they jump apart and blush
  for (const [m, dir] of [[c.a, 1], [c.b, -1]]){ const body = m.children[0]; body.rotation.x = -0.27*l; m.position.y = -0.42 + jump; }
  c.blush.forEach((b, i) => { const m = i ? c.b : c.a; b.visible = g.cooldown > 0; if (b.visible){ b.position.set(m.position.x, 1.25 + jump, m.position.z); b.material.opacity = Math.min(1, g.cooldown); } });
  // hearts float up from the kiss
  const mid = new THREE.Vector3((c.a.position.x + c.b.position.x)/2, 1.25, (c.a.position.z + c.b.position.z)/2);
  for (const h of c.hearts){
    h.age += dt;
    if (h.age > 1.4 && l > 0.6 && Math.random() < dt*4){ h.age = 0; h.ox = rand(-0.15, 0.15); h.oz = rand(-0.15, 0.15); }
    h.s.visible = h.age < 1.4; if (h.s.visible){ h.s.position.set(mid.x + h.ox, mid.y + h.age*0.45, mid.z + h.oz); h.s.material.opacity = 1 - h.age/1.4; const sc = 0.12 + h.age*0.08; h.s.scale.set(sc, sc, 1); }
  }
  // the colleague at the desk: types, stops ("?"), turns round to look ("!"), or stretches (a fake-out)
  const d = g.desk || {st: 'work'}, dm = c.desk, DL = dm.userData.limbs;
  const look = d.st === 'look' ? 1 : 0; dm.userData.turn = (dm.userData.turn || 0) + (look - (dm.userData.turn || 0))*Math.min(1, dt*9);
  dm.rotation.y = face(1, 0) + dm.userData.turn*(Math.PI/2)*-1;
  const typing = d.st === 'work' && g.ph === 'play';
  DL.armL.rotation.x = DL.armR.rotation.x = typing ? 1.1 + Math.sin(now/60)*0.08 : d.stretch > 0 ? -2.6 : 0.9;
  if (d.stretch > 0) d.stretch -= dt;
  if (typing && Math.random() < dt*3) play('keys', 0.35, -0.3);
  c.deskMark.visible = d.st === 'warn' || d.st === 'look'; c.deskMark.material.map = d.st === 'look' ? c.x : c.q; c.deskMark.position.set(dm.position.x, 1.75, dm.position.z);
  // the boss: walks up outside the door, the door opens, he leans in to look
  const b = g.boss || {st: 'away'}, bm = c.boss;
  const bt = b.st === 'warn' ? 0.5 : b.st === 'look' ? 1 : 0; bm.userData.k = (bm.userData.k || 0) + (bt - (bm.userData.k || 0))*Math.min(1, dt*4);
  bm.visible = bm.userData.k > 0.03; bm.position.set(DOORSPOT[0], 0, DOORSPOT[1] - 1.4 + bm.userData.k*1.4); animateAvatar(bm, dt*6, b.st === 'warn' ? 0.6 : 0);
  c.bossMark.visible = bm.visible && (b.st === 'warn' || b.st === 'look'); c.bossMark.material.map = b.st === 'look' ? c.x : c.q; c.bossMark.position.set(bm.position.x, 2.15, bm.position.z);
}
function updateHud(now){
  const g = game; if (g.ph !== 'play' && g.ph !== 'ending'){ return; }
  const hearts = '❤️'.repeat(Math.max(0, g.lives)) + '🤍'.repeat(Math.max(0, 3 - g.lives));
  const warn = (g.desk.st === 'warn' || g.boss.st === 'warn') ? '<div style="color:#ffd27a;font-weight:600">⚠️ Someone is getting suspicious…</div>' : (g.desk.st === 'look' || g.boss.st === 'look') ? '<div style="color:#ff6a6a;font-weight:700">👀 STOP! Someone is looking!</div>' : '<div style="opacity:.6">…the coast is clear</div>';
  const fl = g.flash && now < g.flash.until ? `<div style="font-size:20px;font-weight:700;margin-top:3px">${g.flash.text}</div>` : '';
  hud.innerHTML = `<div style="font-size:12px;opacity:.8">💋 Stiekem kussen · level ${g.level + 1} of 5 · ${hearts} · ⏱ ${Math.max(0, Math.ceil(g.t))} s · ${Math.round(g.score)} pts</div>`
    + `<div style="height:12px;border-radius:6px;background:rgba(255,255,255,.18);overflow:hidden;margin:6px 0 4px"><b style="display:block;height:100%;width:${(g.love*100).toFixed(1)}%;background:linear-gradient(90deg,#ff7aa2,#ff2d6b)"></b></div>${warn}${fl}`;
}

window.KISS = {get game(){ return game; }};   // for testing in the console
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
