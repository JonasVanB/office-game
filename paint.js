// Paintball: capture the flag in the west hall of the 2e verdiep (x 0–28). Two teams, 🔴 Red (west end) and 🔵 Blue (by the door).
// Grab the other team's flag and bring it to your own flag (while yours is at home) to score. First to 3 captures, or the most after 8 minutes.
// One paintball hit splats you: 3 seconds out, then you respawn at your base (1.5 s of spawn protection). A splatted flag carrier drops the flag;
// a teammate touching a dropped flag sends it home (it also goes home by itself after 20 s).
//
// Like The Mole: enter through the closed double door from the 2e lift lobby (E). Before a game you join as a player (max 12), during a game
// you watch as an (invisible) spectator. The player who has been inside longest hosts: their browser runs the game and shares it as presence
// (pg). Everybody shoots their own paintballs and decides their own hits (pf = recent shots so others can see them fly, ph = recent hits for the host).
// Controls: hold the left mouse button to shoot, R reloads, C crouches behind cover, Space jumps, Enter (host) starts. Phones: the 🎯 button shoots.
import {sound, play, spatial} from './sound.js';
import {buildAvatar, animateAvatar, defaultAvatar} from './avatar.js';

const LO2 = -6.12, CEIL = LO2 + 2.6, MIN = 2, MAX = 12, WIN = 3, DUR = 8*60*1000, DEAD = 3000, SAFE = 1500, DROPBACK = 20000;
const DOOR = {x: 28, z: 6.5}, IN = [27.0, 6.5], OUT = [29.2, 6.5];
const TEAM = {r: {name: 'Red', icon: '🔴', col: '#e0453a', hex: 0xe0453a, home: [2.8, 6.5], spawn: [[1.2, 3.2], [1.2, 9.8], [1.2, 6.5], [2.2, 1.6], [2.2, 11.4], [1.2, 5.0]], yaw: -Math.PI/2},
              b: {name: 'Blue', icon: '🔵', col: '#2f7be8', hex: 0x2f7be8, home: [25.2, 6.5], spawn: [[26.8, 9.8], [26.8, 3.2], [26.8, 6.5], [25.8, 11.4], [25.8, 1.6], [26.8, 8.0]], yaw: Math.PI/2}};
const other = t => t === 'r' ? 'b' : 'r';
const SPEED = 30, GRAV = 3.5, RATE = 0.2, HOPPER = 25, RELOAD = 1.6, SPREAD = 0.012;
const isTouch = () => !!window.__isTouch;
const now = () => window.__serverNow ? window.__serverNow() : Date.now();
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.random()*(i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the arena: cover pieces (point-symmetric around the centre, so both teams get the same field) ----------
// [x0, x1, z0, z1, height, kind]; kinds: 'brick' tall inflatable, 'snake' low inflatable, 'desk' a flipped desk, 'boxes' a stack of moving boxes, 'can' round
const HALF = [
  [4.3, 4.7, 4.6, 8.4, 1.0, 'snake'],      // low wall in front of the flag
  [6.4, 7.4, 1.6, 2.6, 1.8, 'brick'], [6.4, 7.4, 10.4, 11.4, 1.8, 'boxes'],
  [8.4, 9.2, 6.1, 6.9, 1.4, 'can'],
  [9.6, 12.4, 3.6, 4.05, 0.95, 'desk'], [10.0, 11.0, 8.6, 9.8, 1.8, 'brick'],
  [12.2, 12.9, 0.9, 1.9, 1.25, 'boxes'], [3.0, 3.6, 0.9, 2.2, 1.8, 'brick'], [2.6, 3.4, 10.6, 11.6, 1.25, 'boxes'],
];
const OBST = [...HALF, ...HALF.map(([x0, x1, z0, z1, h, k]) => [28 - x1, 28 - x0, 13 - z1, 13 - z0, h, k]), [13.3, 14.7, 5.8, 7.2, 1.9, 'can']];   // + the big can in the middle
// things the balls hit besides the cover: the pillars along both long walls
const SOLID = [...OBST.map(o => ({x0: o[0], x1: o[1], z0: o[2], z1: o[3], y1: LO2 + o[4]})),
  ...[0, 7, 14, 21].flatMap(x => [{x0: x - 0.35, x1: x + 0.35, z0: 0, z1: 0.4, y1: CEIL}, {x0: x - 0.35, x1: x + 0.35, z0: 12.6, z1: 13, y1: CEIL}])];
const ROOM = {x0: 0, x1: 27.95, z0: 0, z1: 13, y0: LO2, y1: CEIL};

let G, THREE, me = null, joinedAt = 0, host = null, hitSeen = {}, bots = [], gameSeen = '', logSeen = 0;
let hud, crosshair, ammoEl, flash, splatEl, card, fireBtn, doorSign, lastSign = '', gun, flags = {}, decals = [], balls = [], sprites = {};
let firing = false, cool = 0, ammo = HOPPER, reloadT = 0, shotSeq = 0, hitSeq = 0, myShots = [], myHits = [], shotSeen = {}, crouchSent = -1;
let deadUntil = 0, deadLock = null, lastDeadKey = '', stats = {splats: 0, caps: 0};
const send = d => { if (window.__mpSend) window.__mpSend(d); };
const myKey = () => window.__myKey ? window.__myKey() : 'me';
const myName = () => { try { return (window.__myAvatar && document.getElementById('meName').textContent) || 'You'; } catch (e){ return 'You'; } };
const el = (tag, css, parent) => { const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; };
const inArena = (x, z) => x > 0 && x < 28 && z > 0 && z < 13;
const inRoom = s => s.lv === 5 && inArena(s.x, s.z);

// ---------- who is inside ----------
function people(){
  const out = [], t = performance.now();
  for (const r of (window.__mpRemotes ? window.__mpRemotes() : [])) if (r.pr && t - r.seen < 20000 && r.l === 5 && inArena(r.x, r.z))
    out.push({key: r.key, name: r.name, pr: r.pr, pj: r.pj, pf: r.pf, ph: r.ph, pg: r.pg, pc: r.pc, x: r.x, y: r.y, z: r.z, yaw: r.r || 0});
  if (me){ const s = G.state; out.push({key: myKey(), name: myName(), pr: me, pj: joinedAt, self: true, pg: host, pc: s.crouch ? 1 : 0, x: s.x, y: s.y, z: s.z, yaw: s.yaw}); }
  for (const b of bots) out.push(b);
  return out;
}
function currentHost(ps){
  const withGame = ps.filter(p => p.pg && p.pg.ph === 'play'); if (withGame.length) return withGame.sort((a, b) => a.pj - b.pj)[0];
  const pl = ps.filter(p => p.pr === 'p' && !p.bot).sort((a, b) => a.pj - b.pj); return pl[0] || null;
}
// the game as the host shares it; Firebase drops empty objects, so give them back
let frameNo = 0, gFrame = -1, gMemo = null, psFrame = null;
function game(){
  if (gFrame === frameNo) return gMemo; gFrame = frameNo; gMemo = gameNow(); return gMemo;
}
function gameNow(){
  const h = currentHost(psFrame || people()), g = h && h.pg && h.pg.ph ? h.pg : null; if (!g) return null;
  for (const k of ['tm', 'nm', 'dead', 'st', 'sc']) g[k] = g[k] || {}; g.sc.r = g.sc.r || 0; g.sc.b = g.sc.b || 0; g.log = g.log || [];
  g.fl = g.fl || {}; for (const t of ['r', 'b']) g.fl[t] = g.fl[t] || {s: 'h'};
  return g;
}

// ---------- the host runs the game ----------
let pubT = 0, dirty = false;
function publish(){ pubT = performance.now(); dirty = false; send({pg: host}); }
function startGame(ps){
  const players = shuffle(ps.filter(p => p.pr === 'p')).slice(0, MAX); if (players.length < MIN) return;
  const tm = {}, nm = {}, st = {}; players.forEach((p, i) => { tm[p.key] = i % 2 ? 'b' : 'r'; nm[p.key] = p.name; st[p.key] = [0, 0, 0]; });
  host = {id: Math.floor(Math.random()*1e9).toString(36), ph: 'play', t0: now(), end: now() + DUR, tm, nm, st, dead: {}, sc: {r: 0, b: 0},
    fl: {r: {s: 'h'}, b: {s: 'h'}}, log: [], n: 0, win: null, why: ''};
  hitSeen = {}; event('start', '🎨 Paintball! Capture the flag: first to ' + WIN);
  for (const b of bots){ const t = tm[b.key]; if (t) respawnBot(b, t); }
  publish();
}
function event(k, text, extra){ dirty = true; host.n = (host.n || 0) + 1; host.log = [Object.assign({n: host.n, k, t: text}, extra || {}), ...(host.log || [])].slice(0, 6); }
function finish(win, why){ const g = host; g.ph = 'over'; g.win = win; g.why = why; event('over', win ? `${TEAM[win].icon} Team ${TEAM[win].name} wins! ${why}` : `🤝 Draw! ${why}`); }
function applyHit(from, victim){
  const g = host, t = now(); if (!g || g.ph !== 'play') return;
  const ft = g.tm[from], vt = g.tm[victim]; if (!ft || !vt || ft === vt) return;
  if ((g.dead[from] || 0) > t) return;                                   // the shooter was already splatted
  const d = g.dead[victim] || 0; if (d > t || t < d + SAFE) return;      // already down, or spawn protection
  g.dead[victim] = t + DEAD; g.st[from] = g.st[from] || [0, 0, 0]; g.st[victim] = g.st[victim] || [0, 0, 0]; g.st[from][0]++; g.st[victim][1]++;
  event('splat', `${TEAM[ft].icon} ${g.nm[from]} 🎨 ${TEAM[vt].icon} ${g.nm[victim]}`, {by: from, who: victim});
  const f = g.fl[ft]; if (f.s === 'c' && f.by === victim){ const p = posOf(victim); g.fl[ft] = {s: 'd', x: p ? p.x : TEAM[ft].home[0], z: p ? p.z : TEAM[ft].home[1], t}; event('drop', `🏳️ ${g.nm[victim]} dropped the ${TEAM[ft].name} flag!`); }
}
let posCache = {};
const posOf = k => posCache[k];
function hostStep(ps){
  const g = host, t = now();
  posCache = {}; for (const p of ps) posCache[p.key] = p;
  if (g && g.ph === 'play'){
    // hits reported by the players (and the bots)
    for (const p of ps){ if (p.self || p.bot || !p.ph) continue; for (const [s, v, gid] of p.ph){ if (gid !== g.id || s <= (hitSeen[p.key] || 0)) continue; hitSeen[p.key] = s; applyHit(p.key, v); } }
    for (const b of bots) botStep(b, ps, g);
    // a team without anybody left inside: game over
    const present = new Set(ps.filter(p => p.pr === 'p').map(p => p.key));
    for (const tm of ['r', 'b']) if (!Object.keys(g.tm).some(k => g.tm[k] === tm && present.has(k))){ finish(other(tm), `Team ${TEAM[tm].name} left the arena.`); break; }
    // the flags
    if (g.ph === 'play') for (const ft of ['r', 'b']){
      const f = g.fl[ft], home = TEAM[ft].home;
      if (f.s === 'c'){
        const c = posCache[f.by];
        if (!c || !present.has(f.by) || (g.dead[f.by] || 0) > t){ g.fl[ft] = {s: 'd', x: c ? c.x : home[0], z: c ? c.z : home[1], t}; event('drop', `🏳️ The ${TEAM[ft].name} flag was dropped!`); continue; }
        const mine = g.tm[f.by], myHome = TEAM[mine].home;
        if (g.fl[mine].s === 'h' && Math.hypot(c.x - myHome[0], c.z - myHome[1]) < 1.3){
          g.sc[mine]++; g.fl[ft] = {s: 'h'}; g.st[f.by] = g.st[f.by] || [0, 0, 0]; g.st[f.by][2]++;
          event('cap', `🚩 ${g.nm[f.by]} captured the ${TEAM[ft].name} flag! ${TEAM.r.icon} ${g.sc.r} – ${g.sc.b} ${TEAM.b.icon}`, {by: f.by});
          if (g.sc[mine] >= WIN){ finish(mine, `${WIN} flags captured.`); break; }
        }
        continue;
      }
      const fx = f.s === 'h' ? home[0] : f.x, fz = f.s === 'h' ? home[1] : f.z;
      if (f.s === 'd' && t - f.t > DROPBACK){ g.fl[ft] = {s: 'h'}; event('back', `↩️ The ${TEAM[ft].name} flag went home.`); continue; }
      for (const p of ps){
        const pt = g.tm[p.key]; if (!pt || !present.has(p.key) || (g.dead[p.key] || 0) > t || Math.hypot(p.x - fx, p.z - fz) > 0.9) continue;
        if (pt !== ft){ g.fl[ft] = {s: 'c', by: p.key}; event('take', `🏃 ${g.nm[p.key]} grabbed the ${TEAM[ft].name} flag!`, {by: p.key}); break; }
        if (f.s === 'd'){ g.fl[ft] = {s: 'h'}; event('back', `↩️ ${g.nm[p.key]} brought the ${TEAM[ft].name} flag home.`); break; }
      }
    }
    if (g.ph === 'play' && t > g.end) finish(g.sc.r === g.sc.b ? null : g.sc.r > g.sc.b ? 'r' : 'b', 'Time is up.');
  }
  if ((dirty && performance.now() - pubT > 100) || performance.now() - pubT > 900) publish();
}

// ---------- test bots (PAINT.bots(3) in the console, local only: only the host sees them) ----------
function respawnBot(b, t){ const sp = TEAM[t].spawn[(+b.key.slice(3)) % 6]; b.x = sp[0]; b.z = sp[1]; b.y = LO2; b.yaw = TEAM[t].yaw; }
function blockedAt(x, z){ if (!inArena(x, z) || x < 0.3 || x > 27.7 || z < 0.45 || z > 12.55) return true; for (const o of SOLID) if (x > o.x0 - 0.3 && x < o.x1 + 0.3 && z > o.z0 - 0.3 && z < o.z1 + 0.3) return true; return false; }
function botStep(b, ps, g){
  const t = now(), team = g.tm[b.key]; if (!team){ return; }
  if ((g.dead[b.key] || 0) > t){ b.down = true; return; }
  if (b.down){ b.down = false; respawnBot(b, team); }
  const dt = Math.min(0.05, (performance.now() - (b.last || performance.now()))/1000); b.last = performance.now();
  // where to: the enemy flag, or home when carrying it
  const ef = g.fl[other(team)], carrying = ef.s === 'c' && ef.by === b.key;
  let tx, tz; if (carrying) [tx, tz] = TEAM[team].home; else if (ef.s === 'c'){ const c = posCache[ef.by]; [tx, tz] = c ? [c.x, c.z] : TEAM[other(team)].home; } else if (ef.s === 'd'){ tx = ef.x; tz = ef.z; } else [tx, tz] = TEAM[other(team)].home;
  if (b.wander == null || performance.now() > b.wanderT){ b.wander = (Math.random() - 0.5)*1.6; b.wanderT = performance.now() + 1500 + Math.random()*2000; }
  let want = Math.atan2(tz - b.z, tx - b.x) + b.wander*0.5, moved = false;
  for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4]){ const a = want + off, nx = b.x + Math.cos(a)*2.0*dt, nz = b.z + Math.sin(a)*2.0*dt; if (!blockedAt(nx, nz)){ b.x = nx; b.z = nz; b.dir = a; moved = true; break; } }
  b.walk = moved ? 1 : 0;
  // shoot at the nearest enemy it can see
  if (performance.now() > (b.shotT || 0)){
    let best = null, bd = 16;
    for (const p of ps){ if (g.tm[p.key] && g.tm[p.key] !== team && !((g.dead[p.key] || 0) > t)){ const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd && clearLine(b.x, LO2 + 1.5, b.z, p.x, (p.y || LO2) + 1.2, p.z)){ bd = d; best = p; } } }
    if (best){ b.shotT = performance.now() + 450 + Math.random()*500; const o = new THREE.Vector3(b.x, LO2 + 1.45, b.z), d = new THREE.Vector3(best.x - b.x, ((best.y || LO2) + 1.1) - (LO2 + 1.45), best.z - b.z).normalize();
      d.x += (Math.random() - 0.5)*0.08; d.y += (Math.random() - 0.5)*0.05; d.z += (Math.random() - 0.5)*0.08; d.normalize(); b.yaw = Math.atan2(-d.x, -d.z);
      spawnBall(o, d, TEAM[team].hex, b.key, true); const s = spatial(b.x, b.z, 5, 22); if (s.g > 0.03) play('pfft', s.g*0.8, s.p); }
    else b.yaw = Math.atan2(-Math.cos(b.dir || 0), -Math.sin(b.dir || 0));
  }
}
function clearLine(x0, y0, z0, x1, y1, z1){ const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1); return !hitSolid(a, b); }

// ---------- paintballs ----------
const BALLGEO = () => new THREE.SphereGeometry(0.035, 8, 6);
let ballGeo, ballMats = {};
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();   // colours are picked as sRGB, the renderer works in linear
const ballMat = hex => ballMats[hex] || (ballMats[hex] = new THREE.MeshBasicMaterial({color: lin(hex)}));
function spawnBall(o, d, hex, owner, check){
  let b = balls.find(x => !x.on);
  if (!b){ if (balls.length > 120) b = balls[0]; else { b = {m: new THREE.Mesh(ballGeo, ballMat(hex))}; G.scene.add(b.m); balls.push(b); } }
  b.on = true; b.p = o.clone(); b.v = d.clone().multiplyScalar(SPEED); b.hex = hex; b.owner = owner; b.check = check; b.life = 1.6; b.m.material = ballMat(hex); b.m.visible = true; b.m.position.copy(b.p);
}
// segment p0 → p1 against an axis-aligned box: entry fraction and the face normal, or null
function segBox(p0, p1, x0, x1, y0, y1, z0, z1){
  let tmin = 0, tmax = 1, n = null; const d = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z], o = [p0.x, p0.y, p0.z], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let i = 0; i < 3; i++){
    if (Math.abs(d[i]) < 1e-9){ if (o[i] < lo[i] || o[i] > hi[i]) return null; continue; }
    let ta = (lo[i] - o[i])/d[i], tb = (hi[i] - o[i])/d[i], s = -1; if (ta > tb){ [ta, tb] = [tb, ta]; s = 1; }
    if (ta > tmin){ tmin = ta; n = [0, 0, 0]; n[i] = s; } if (tb < tmax) tmax = tb; if (tmin > tmax) return null;
  }
  return n ? {t: tmin, n} : null;
}
function hitSolid(p0, p1){
  let best = null;
  for (const o of SOLID){ const h = segBox(p0, p1, o.x0, o.x1, LO2 - 1, o.y1, o.z0, o.z1); if (h && (!best || h.t < best.t)) best = h; }
  // the room: floor, ceiling and walls (from the inside)
  const d = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z], o = [p0.x, p0.y, p0.z], lo = [ROOM.x0, ROOM.y0, ROOM.z0], hi = [ROOM.x1, ROOM.y1, ROOM.z1];
  for (let i = 0; i < 3; i++){
    if (d[i] > 0 && o[i] + d[i] > hi[i]){ const t = (hi[i] - o[i])/d[i], n = [0, 0, 0]; n[i] = -1; if (t >= 0 && (!best || t < best.t)) best = {t, n}; }
    if (d[i] < 0 && o[i] + d[i] < lo[i]){ const t = (lo[i] - o[i])/d[i], n = [0, 0, 0]; n[i] = 1; if (t >= 0 && (!best || t < best.t)) best = {t, n}; }
  }
  return best;
}
// players a ball can hit: [{key, x, y, z, h}]
function targets(owner){
  const g = game(); if (!g || g.ph !== 'play') return [];
  const ot = g.tm[owner], t = now(), out = []; if (!ot) return out;
  for (const p of (psFrame || people())){ if (p.key === owner || !g.tm[p.key] || g.tm[p.key] === ot) continue; const d = g.dead[p.key] || 0; if (d > t || t < d + SAFE) continue;
    out.push({key: p.key, x: p.x, y: p.y || LO2, z: p.z, h: p.pc ? 1.25 : 1.85}); }
  return out;
}
function hitPlayer(p0, p1, list){
  let best = null; const dx = p1.x - p0.x, dz = p1.z - p0.z, L2 = dx*dx + dz*dz;
  for (const q of list){
    let u = L2 > 0 ? ((q.x - p0.x)*dx + (q.z - p0.z)*dz)/L2 : 0; u = Math.max(0, Math.min(1, u));
    const cx = p0.x + dx*u - q.x, cz = p0.z + dz*u - q.z; if (cx*cx + cz*cz > 0.32*0.32) continue;
    const y = p0.y + (p1.y - p0.y)*u; if (y < q.y + 0.05 || y > q.y + q.h) continue;
    if (!best || u < best.t) best = {t: u, q};
  }
  return best;
}
const tmpA = () => new THREE.Vector3();
let P1;
function stepBalls(dt){
  for (const b of balls){
    if (!b.on) continue; b.life -= dt; if (b.life <= 0){ b.on = false; b.m.visible = false; continue; }
    b.v.y -= GRAV*dt; P1.copy(b.p).addScaledVector(b.v, dt);
    const w = hitSolid(b.p, P1), list = b.check ? targets(b.owner) : null, h = list && list.length ? hitPlayer(b.p, P1, list) : null;
    if (h && (!w || h.t <= w.t)){
      const at = b.p.clone().lerp(P1, h.t); burst(at, b.hex); const s = spatial(at.x, at.z, 5, 18); play('splat', Math.max(0.2, s.g), s.p);
      reportHit(b.owner, h.q.key); b.on = false; b.m.visible = false; continue;
    }
    if (w){ const at = b.p.clone().lerp(P1, w.t); splatDecal(at, w.n, b.hex); const s = spatial(at.x, at.z, 5, 14); if (s.g > 0.05) play('splat', s.g*0.6, s.p); b.on = false; b.m.visible = false; continue; }
    b.p.copy(P1); b.m.position.copy(b.p);
  }
}
function reportHit(owner, victim){
  const g = game(); if (!g) return;
  if (owner === myKey()){ stats.splats++; if (window.__ach){ window.__ach('p_splat'); if (stats.splats >= 10) window.__ach('p_ten'); } hitmarker(); }
  if (host && (owner === myKey() || bots.some(b => b.key === owner))){ applyHit(owner, victim); return; }
  if (owner !== myKey()) return;
  hitSeq++; myHits = [...myHits, [hitSeq, victim, g.id]].slice(-6); send({ph: myHits});
}
// a paint splat stuck on a surface (pool of 220, oldest reused)
let splatTex, decalMats = {};
function splatTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#fff';
  const blob = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  blob(64, 64, 26); for (let i = 0; i < 14; i++){ const a = Math.random()*7, d = 22 + Math.random()*30; blob(64 + Math.cos(a)*d, 64 + Math.sin(a)*d, 3 + Math.random()*9); g.lineWidth = 4 + Math.random()*5; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a)*d, 64 + Math.sin(a)*d); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
const decalMat = hex => decalMats[hex] || (decalMats[hex] = new THREE.MeshBasicMaterial({map: splatTex, color: lin(hex), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4}));
let decalI = 0;
function splatDecal(at, n, hex){
  let m = decals[decalI % 220]; if (!m){ m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), decalMat(hex)); m.renderOrder = 1; G.scene.add(m); decals[decalI % 220] = m; }
  decalI++; m.material = decalMat(hex); const s = 0.22 + Math.random()*0.16; m.scale.set(s, s, 1);
  m.position.set(at.x + n[0]*0.006, at.y + n[1]*0.006, at.z + n[2]*0.006); m.lookAt(at.x + n[0], at.y + n[1], at.z + n[2]); m.rotateZ(Math.random()*6.28); m.visible = true;
}
function clearDecals(){ for (const m of decals) if (m) m.visible = false; }
// a little cloud of paint drops where a player got hit
const drops = [];
function burst(at, hex){
  for (let i = 0; i < 10; i++){ let d = drops.find(x => !x.on); if (!d){ d = {m: new THREE.Mesh(ballGeo, ballMat(hex))}; G.scene.add(d.m); drops.push(d); }
    d.on = true; d.m.material = ballMat(hex); d.p = at.clone(); d.v = new THREE.Vector3((Math.random() - 0.5)*3, Math.random()*2.5, (Math.random() - 0.5)*3); d.life = 0.6; d.m.visible = true; d.m.scale.setScalar(0.6 + Math.random()*0.8); }
}
function stepDrops(dt){ for (const d of drops){ if (!d.on) continue; d.life -= dt; d.v.y -= 9.8*dt; d.p.addScaledVector(d.v, dt); d.m.position.copy(d.p); if (d.life <= 0 || d.p.y < LO2){ d.on = false; d.m.visible = false; } } }

// ---------- your marker ----------
function shoot(){
  const g = game(), k = myKey(); if (!me || me !== 'p') return;
  if (g && g.ph === 'play' && (g.dead[k] || 0) > now()) return;
  if (reloadT > 0) return; if (ammo <= 0){ reload(); return; }
  ammo--; cool = RATE;
  const cam = G.camera, o = new THREE.Vector3(), d = new THREE.Vector3(); cam.getWorldPosition(o); cam.getWorldDirection(d);
  d.x += (Math.random() - 0.5)*SPREAD*2; d.y += (Math.random() - 0.5)*SPREAD*2; d.z += (Math.random() - 0.5)*SPREAD*2; d.normalize();
  o.addScaledVector(d, 0.3);
  const team = g && g.ph === 'play' ? g.tm[k] : null, hex = team ? TEAM[team].hex : warmHex(k);
  spawnBall(o, d, hex, k, !!team); play('pfft', 0.7, 0); gun.userData.kick = 1;
  shotSeq++; const r2 = n => Math.round(n*100)/100; myShots = [...myShots, [shotSeq, r2(o.x), r2(o.y), r2(o.z), r2(d.x*100)/100, r2(d.y*100)/100, r2(d.z*100)/100]].slice(-4);
  send({pf: myShots});
  if (ammo <= 0) reload();
}
function reload(){ if (reloadT > 0 || ammo >= HOPPER) return; reloadT = RELOAD; play('mouse', 0.8, 0); }
const warmHex = k => { let h = 0; for (const c of String(k)) h = (h*31 + c.charCodeAt(0)) >>> 0; return new THREE.Color().setHSL((h % 360)/360, 0.75, 0.55).getHex(); };
// the other players' shots: draw them flying (their own browser decides what they hit)
function remoteShots(ps){
  const g = game();
  for (const p of ps){ if (p.self || p.bot || !p.pf) continue; const last = shotSeen[p.key];
    for (const [s, x, y, z, dx, dy, dz] of p.pf){ if (last != null && s <= last) continue; shotSeen[p.key] = Math.max(shotSeen[p.key] || 0, s); if (last == null) continue;   // the first look only remembers where they are
      const team = g && g.ph === 'play' ? g.tm[p.key] : null; spawnBall(new THREE.Vector3(x, y, z), new THREE.Vector3(dx, dy, dz).normalize(), team ? TEAM[team].hex : warmHex(p.key), p.key, false);
      const sp = spatial(x, z, 5, 22); if (sp.g > 0.03) play('pfft', sp.g*0.7, sp.p); }
    if (shotSeen[p.key] == null) shotSeen[p.key] = 0;
  }
}

// ---------- the room: door sign, bases, flags, cover ----------
function tex(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return {c, g: c.getContext('2d'), t}; }
function buildRoom(){
  const S = G.scene, M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.6}, o || {}));
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); S.add(m); return m; };
  const KIND = {brick: [M(0xf2c230), M(0x1d2229)], snake: [M(0x2f3a48), M(0xf2c230)], desk: [M(0xb48a5a, {roughness: 0.7}), M(0x8e9196, {metalness: 0.4, roughness: 0.4})], boxes: [M(0xc49a6c, {roughness: 0.9}), M(0xa47b4f, {roughness: 0.9})], can: [M(0xe8e6df), M(0x2f7be8)]};
  for (const [x0, x1, z0, z1, h, k] of OBST){
    const [a, b] = KIND[k], cx = (x0 + x1)/2, cz = (z0 + z1)/2, w = x1 - x0, d = z1 - z0;
    if (k === 'can'){ const r = Math.min(w, d)/2; add(new THREE.CylinderGeometry(r, r, h, 24), a, cx, LO2 + h/2, cz); add(new THREE.CylinderGeometry(r*1.01, r*1.01, h*0.18, 24), b, cx, LO2 + h*0.6, cz); }
    else if (k === 'boxes'){ const n = Math.round(h/0.42); for (let i = 0; i < n; i++){ const j = (i % 2)*0.04; add(new THREE.BoxGeometry(w - 0.04 - j, h/n - 0.01, d - 0.04 + j*0.5), i % 2 ? a : b, cx + j, LO2 + (i + 0.5)*h/n, cz); } }
    else if (k === 'desk'){ add(new THREE.BoxGeometry(w, h, d*0.35), a, cx, LO2 + h/2, z0 + d*0.2); for (const lx of [x0 + 0.1, x1 - 0.1]) add(new THREE.BoxGeometry(0.05, 0.05, d*0.7), b, lx, LO2 + h - 0.1, z0 + d*0.55); }
    else { add(new THREE.BoxGeometry(w, h, d), a, cx, LO2 + h/2, cz); add(new THREE.BoxGeometry(w + 0.01, 0.12, d + 0.01), b, cx, LO2 + h - 0.25, cz); }
    G.colliders.push([x0, x1, z0, z1, 5]);
  }
  // the bases: a coloured patch on the floor at each end and a ring around each flag's home
  for (const t of ['r', 'b']){
    const T = TEAM[t], x0 = t === 'r' ? 0.3 : 25.8, pad = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 12.2), new THREE.MeshBasicMaterial({color: lin(T.hex), transparent: true, opacity: 0.22, depthWrite: false}));
    pad.rotation.x = -Math.PI/2; pad.position.set(x0 + 0.95, LO2 + 0.01, 6.5); S.add(pad);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.3, 40), new THREE.MeshBasicMaterial({color: lin(T.hex), transparent: true, opacity: 0.8, depthWrite: false}));
    ring.rotation.x = -Math.PI/2; ring.position.set(T.home[0], LO2 + 0.012, T.home[1]); S.add(ring);
    // the flag: a pole and a waving cloth (moved around with the game state)
    const f = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), M(0xdddddd, {metalness: 0.6, roughness: 0.3})); pole.position.y = 0.8; f.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4, 8, 1), new THREE.MeshStandardMaterial({color: lin(T.hex), side: THREE.DoubleSide, roughness: 0.8})); cloth.position.set(0.32, 1.38, 0); f.add(cloth);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 20), M(0x2d3036)); base.position.y = 0.03; f.add(base);
    S.add(f); flags[t] = {g: f, cloth, base, x0: cloth.geometry.attributes.position.array.slice()};
  }
  // the door sign (lobby side) and the title on the far end wall
  doorSign = tex(512, 320);
  for (const [x, ry] of [[28.075, Math.PI/2], [27.925, -Math.PI/2]]){ const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5625), new THREE.MeshBasicMaterial({map: doorSign.t})); m.position.set(x, LO2 + 1.55, 6.5); m.rotation.y = ry; S.add(m); }
  const title = tex(1024, 256), g = title.g; g.fillStyle = '#1d2229'; g.fillRect(0, 0, 1024, 256); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 110px system-ui,sans-serif'; g.fillStyle = TEAM.r.col; g.fillText('PAINT', 330, 110); g.fillStyle = TEAM.b.col; g.fillText('BALL', 690, 110);
  g.fillStyle = '#cfd6df'; g.font = '500 38px system-ui,sans-serif'; g.fillText('Capture the flag · first to 3 · 2–12 players', 512, 205); title.t.needsUpdate = true;
  const tm = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({map: title.t})); tm.position.set(0.06, LO2 + 1.95, 6.5); tm.rotation.y = Math.PI/2; S.add(tm);
  // your marker (first person): body, barrel, hopper on top
  gun = new THREE.Group(); const GM = M(0x2d3036, {roughness: 0.4}), GA = M(0xf2c230);
  const part = (w, h, d, x, y, z, m) => { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); p.position.set(x, y, z); gun.add(p); return p; };
  part(0.07, 0.09, 0.3, 0, 0, 0, GM); part(0.035, 0.035, 0.32, 0, 0.015, -0.28, GM); part(0.05, 0.12, 0.05, 0, -0.09, 0.07, GM);
  const hop = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshStandardMaterial({color: 0x3a3f46, roughness: 0.5})); hop.position.set(0, 0.1, -0.02); hop.scale.set(1, 0.8, 1.3); gun.add(hop); gun.userData.hop = hop;
  part(0.072, 0.02, 0.1, 0, 0.05, 0.08, GA);
  gun.visible = false; gun.renderOrder = 5; S.add(gun);
}
function drawSign(ps){
  const g = game(), players = ps.filter(p => p.pr === 'p').length, spect = ps.filter(p => p.pr === 's').length, live = g && g.ph === 'play';
  const status = live ? `🎮 ${TEAM.r.icon} ${g.sc.r} – ${g.sc.b} ${TEAM.b.icon} · ${clock(g.end - now())}` : players >= MIN ? '✅ Ready to start' : `⏳ Waiting for players (min ${MIN})`;
  const key = players + '|' + spect + '|' + status; if (key === lastSign) return; lastSign = key;
  const c = doorSign.g; c.fillStyle = '#1d2229'; c.fillRect(0, 0, 512, 320); c.fillStyle = TEAM.r.col; c.fillRect(0, 0, 256, 10); c.fillStyle = TEAM.b.col; c.fillRect(256, 0, 256, 10);
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '800 54px system-ui,sans-serif'; c.fillText('🎯 PAINTBALL', 256, 78);
  c.font = '600 40px system-ui,sans-serif'; c.fillStyle = '#9fe0b0'; c.fillText(`👥 ${live ? Object.keys(g.tm).length : players} / ${MAX} players`, 256, 150);
  c.fillStyle = '#cfd6df'; c.font = '500 30px system-ui,sans-serif'; c.fillText(`👀 ${spect} watching`, 256, 196); c.fillText(status, 256, 240);
  c.fillStyle = '#f2c230'; c.font = '600 28px system-ui,sans-serif'; c.fillText(isTouch() ? 'Tap to enter' : 'Press E to enter', 256, 292); doorSign.t.needsUpdate = true;
}
const clock = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms/1000); return `${Math.floor(s/60)}:${String(s % 60).padStart(2, '0')}`; };
function drawFlags(g, ps, t){
  for (const ft of ['r', 'b']){
    const F = flags[ft], f = g && g.ph === 'play' ? g.fl[ft] : {s: 'h'}, home = TEAM[ft].home; let x = home[0], y = LO2, z = home[1], vis = true;
    if (f.s === 'd'){ x = f.x; z = f.z; }
    else if (f.s === 'c'){ const c = ps.find(p => p.key === f.by); if (c){ if (c.self){ vis = false; } else { const yw = c.yaw || 0; x = c.x + Math.sin(yw)*0.25; z = c.z + Math.cos(yw)*0.25; y = (c.y || LO2) + 0.7; } } }
    F.g.visible = vis; F.g.position.set(x, y, z); F.base.visible = f.s !== 'c';
    const pa = F.cloth.geometry.attributes.position, a = pa.array; for (let i = 0; i < pa.count; i++){ const px = F.x0[i*3]; a[i*3 + 2] = Math.sin(t*6 + px*9)*0.06*(px + 0.3); } pa.needsUpdate = true;
  }
}

// ---------- the other players: vest in the team colour, goggles and a marker; crouching; lying splatted on the floor ----------
const kit = {};
function gear(obj, team){
  let k = obj.userData.paint; const hex = team ? TEAM[team].hex : 0x5a6472;
  if (!k){
    k = obj.userData.paint = {g: new THREE.Group(), vest: null};
    const body = obj.children[0], M = c => new THREE.MeshStandardMaterial({color: c, roughness: 0.7});
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.5, 0.3), M(hex)); vest.position.set(0, 1.22, 0); k.g.add(vest); k.vest = vest;
    const gog = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.1, 0.06), new THREE.MeshStandardMaterial({color: 0x15181c, roughness: 0.2, metalness: 0.4})); gog.position.set(0, 1.75, -0.15); k.g.add(gog);
    body.add(k.g);
    const L = obj.userData.limbs, mk = new THREE.Group(), gm = M(0x2d3036);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.09), gm); a.position.set(-0.02, -0.62, -0.02); mk.add(a);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({color: 0xffffff, transparent: true, opacity: 0.6})); h.position.set(-0.02, -0.55, -0.12); mk.add(h);
    L.armR.add(mk); k.mk = mk;
  }
  if (k.hex !== hex){ k.vest.material.color.setHex(hex).convertSRGBToLinear(); k.hex = hex; }
  k.g.visible = k.mk.visible = true;
}
function ungear(obj){ const k = obj.userData.paint; if (k){ k.g.visible = k.mk.visible = false; } if (obj.userData.paintPose){ obj.scale.y = 1; obj.rotation.x = 0; obj.userData.limbs.armL.rotation.z = 0; obj.userData.paintPose = false; } }
function posePaint(obj, r){
  if (!(r.pr && r.l === 5 && inArena(r.x, r.z))){ ungear(obj); return; }
  const g = game(), team = g && g.ph === 'play' ? g.tm[r.key] : null;
  if (r.pr === 's' && me){ obj.visible = false; return; }             // spectators are invisible ghosts for the people inside
  gear(obj, team); const L = obj.userData.limbs; L.armR.rotation.x = Math.PI/2*0.92; L.armL.rotation.x = Math.PI/2*0.7; L.armL.rotation.z = -0.5;
  obj.userData.paintPose = true;
  const dead = g && g.ph === 'play' && (g.dead[r.key] || 0) > now();
  obj.rotation.x = dead ? -Math.PI/2 : 0; if (dead) obj.position.y = (r.y || LO2) + 0.16;
  obj.scale.y = r.pc && !dead ? 0.7 : 1;
}

// ---------- bots look like players (host only) ----------
function drawBots(g, dt){
  for (const b of bots){
    if (!b.obj){ const av = defaultAvatar(); av.shirt = ['#c0392b', '#2f7be8', '#27ae60', '#8e44ad', '#f39c12', '#16a085'][(+b.key.slice(3)) % 6]; b.obj = buildAvatar(THREE, av); G.scene.add(b.obj); }
    b.obj.position.set(b.x, b.y || LO2, b.z); b.obj.rotation.y = b.yaw || 0; animateAvatar(b.obj, (b.walk ? 0.18 : 0), b.walk || 0);
    posePaint(b.obj, {key: b.key, pr: 'p', l: 5, x: b.x, y: b.y || LO2, z: b.z, pc: 0});
  }
}

// ---------- effects and HUD ----------
function bigText(text, col){ flash.innerHTML = `<div style="font:800 42px system-ui,sans-serif;color:${col};text-shadow:0 4px 18px rgba(0,0,0,.6)">${esc(text)}</div>`; flash.style.opacity = 1; clearTimeout(flash.t); flash.t = setTimeout(() => flash.style.opacity = 0, 2200); }
function hitmarker(){ crosshair.style.transform = 'translate(-50%,-50%) scale(1.8) rotate(45deg)'; crosshair.style.color = '#ff5a3c'; clearTimeout(crosshair.t); crosshair.t = setTimeout(() => { crosshair.style.transform = 'translate(-50%,-50%)'; crosshair.style.color = '#fff'; }, 180); }
function confetti(){ for (let i = 0; i < 70; i++){ const d = el('div', `position:fixed;left:${Math.random()*100}vw;top:-20px;width:9px;height:14px;background:hsl(${Math.random()*360},85%,60%);z-index:4;pointer-events:none;transform:rotate(${Math.random()*360}deg);transition:transform 2.2s linear,top 2.2s cubic-bezier(.2,.6,.4,1)`);
  requestAnimationFrame(() => { d.style.top = (60 + Math.random()*45) + 'vh'; d.style.transform = `rotate(${Math.random()*900}deg)`; }); setTimeout(() => d.remove(), 2600); } }
function events(g){
  const k = myKey(), mine = g.tm[k], fresh = g.log.filter(e => e.n > logSeen).reverse(); if (!fresh.length) return; logSeen = Math.max(...g.log.map(e => e.n));
  for (const e of fresh){
    if (window.__chatSys) window.__chatSys(e.t);
    if (e.k === 'cap'){ const us = g.tm[e.by] === mine; bigText(e.by === k ? '🚩 YOU SCORED!' : us ? '🚩 Your team scored!' : '🚩 They scored…', us ? '#9fe0b0' : '#ff8a7a'); play(us ? 'cheer' : 'trombone', 0.9, 0);
      if (e.by === k){ stats.caps++; if (window.__ach){ window.__ach('p_flag'); if (stats.caps >= 3) window.__ach('p_hat'); } if (window.__xp) window.__xp(20, 'Flag captured'); } }
    else if (e.k === 'take'){ const us = g.tm[e.by] === mine; bigText(e.by === k ? '🏃 You have the flag! Run home!' : us ? '🏃 We have their flag!' : '⚠️ They took our flag!', us ? '#f2c230' : '#ff8a7a'); play('chime', 0.6, 0); }
    else if (e.k === 'drop' || e.k === 'back'){ play('ding', 0.5, 0); }
    else if (e.k === 'start'){ play('chime', 0.8, 0); }
    else if (e.k === 'over'){ results(g); }
  }
}
function results(g){
  const k = myKey(), mine = g.tm[k], won = mine && g.win === mine;
  if (mine){ bigText(g.win ? (won ? '🏆 YOU WIN!' : '😵 YOU LOSE') : '🤝 DRAW', won ? '#9fe0b0' : '#fff'); play(won ? 'cheer' : 'trombone', 1, 0); if (won) confetti();
    if (window.__xp) window.__xp(won ? 40 : 15, won ? 'Won paintball' : 'Played paintball'); if (won && window.__ach) window.__ach('p_win'); }
  const rows = Object.keys(g.tm).sort((a, b) => (g.tm[a] > g.tm[b] ? 1 : -1) || ((g.st[b] || [0])[0] - (g.st[a] || [0])[0])).map(x => { const s = g.st[x] || [0, 0, 0]; return `<tr><td>${TEAM[g.tm[x]].icon} ${esc(g.nm[x])}</td><td>🎨 ${s[0]}</td><td>💀 ${s[1]}</td><td>🚩 ${s[2]}</td></tr>`; }).join('');
  card.innerHTML = `<div style="font:800 24px system-ui,sans-serif">${g.win ? `${TEAM[g.win].icon} Team ${TEAM[g.win].name} wins!` : '🤝 Draw!'}</div><div style="color:#454b55;margin:4px 0 8px">${esc(g.why)} · ${TEAM.r.icon} ${g.sc.r} – ${g.sc.b} ${TEAM.b.icon}</div>`
    + `<table style="width:100%;font-size:14px;text-align:left;border-collapse:collapse">${rows}</table><div style="font-size:12px;color:#5a6472;margin-top:8px">The host starts a new game with Enter · click to close</div>`;
  card.style.display = 'block'; clearTimeout(card.t); card.t = setTimeout(() => card.style.display = 'none', 15000);
}
function hudUpdate(g, ps){
  hud.style.display = 'block'; const k = myKey(), players = ps.filter(p => p.pr === 'p');
  if (!g || g.ph !== 'play'){
    const h = currentHost(ps), iHost = h && h.self && me === 'p';
    hud.innerHTML = `<b>🎯 Paintball · lobby</b> · ${players.length}/${MAX} players · ${ps.filter(p => p.pr === 's').length} watching<div style="font-size:12px;opacity:.85;margin-top:3px">${players.map(p => esc(p.name)).join(', ')}</div>`
      + `<div style="margin-top:4px">${players.length < MIN ? `Waiting for ${MIN - players.length} more… warm up by painting the walls!` : iHost ? '<b>Press Enter to start the game</b>' : `Waiting for ${esc(h ? h.name : 'the host')} to start`}</div>`
      + `<div style="font-size:11px;opacity:.7;margin-top:3px">${me === 's' ? 'You are watching · ' : 'Hold the mouse button: shoot · R: reload · C: crouch · '}E at the door: leave · Enter: chat</div>`;
    return;
  }
  const mine = g.tm[k], f = mine && g.fl[other(mine)], carry = f && f.s === 'c' && f.by === k;
  const flagTxt = t => { const x = g.fl[t]; return x.s === 'h' ? 'home' : x.s === 'd' ? 'dropped' : `taken by ${esc(g.nm[x.by] || '?')}`; };
  hud.innerHTML = `<div style="font:800 22px system-ui,sans-serif"><span style="color:${TEAM.r.col}">${TEAM.r.icon} ${g.sc.r}</span> <span style="opacity:.6">–</span> <span style="color:${TEAM.b.col}">${g.sc.b} ${TEAM.b.icon}</span> <span style="font-size:15px;opacity:.8;margin-left:8px">⏱ ${clock(g.end - now())}</span></div>`
    + `<div style="font-size:12px;opacity:.85">${mine ? `You: ${TEAM[mine].icon} Team ${TEAM[mine].name}` : '👀 Spectating'} · 🔴 flag ${flagTxt('r')} · 🔵 flag ${flagTxt('b')}</div>`
    + (carry ? '<div style="font-weight:700;color:#f2c230;margin-top:2px">🚩 You have the flag! Bring it to your own flag!</div>' : '')
    + `<div style="font-size:12px;opacity:.8;margin-top:2px">${g.log.slice(0, 3).map(e => esc(e.t)).join('<br>')}</div>`;
}

// ---------- the room flow ----------
function enter(){
  const g = game(), players = people().filter(p => p.pr === 'p').length;
  me = g && g.ph === 'play' ? 's' : players >= MAX ? 's' : 'p'; joinedAt = now(); ammo = HOPPER; reloadT = 0; shotSeen = {}; stats = {splats: 0, caps: 0};
  G.setView(IN[0], IN[1], Math.PI/2, 0); send({pr: me, pj: joinedAt, pc: 0}); G.state.pb = 1;
  window.__progToast && window.__progToast(me === 'p' ? '🎯 You joined Paintball' : '👀 You are watching Paintball', me === 'p' ? `${MIN}–${MAX} players. The first one in starts the game with Enter.` : 'Spectators are invisible. You play in the next game.');
  if (window.__ach) window.__ach('p_enter');
}
function leave(silent){
  me = null; host = null; bots.forEach(b => b.obj && G.scene.remove(b.obj)); bots = []; send({pr: null, pj: 0, pg: null, pf: null, ph: null, pc: 0}); G.state.pb = 0;
  hud.style.display = crosshair.style.display = ammoEl.style.display = 'none'; if (fireBtn) fireBtn.style.display = 'none'; gun.visible = false; firing = false; releaseDead();
  if (!silent) G.setView(OUT[0], OUT[1], -Math.PI/2, 0);
}
function releaseDead(){ if (deadLock && G.controlLock === deadLock) G.controlLock = null; deadLock = null; splatEl.style.opacity = 0; }
function tick(dt){
  if (!G || !doorSign) return '';
  const s = G.state, inside = inRoom(s), t = performance.now()/1000; frameNo++; psFrame = null;
  if (me && !inside && !deadLock) leave(true);
  if (!me && inside && s.started) enter();
  const ps = people(); psFrame = ps; drawSign(ps);
  const h = currentHost(ps), iAmHost = me === 'p' && h && h.self;
  if (iAmHost) hostStep(ps); else if (host && h && !h.self) host = null;
  gFrame = -1; const g = game();
  if (s.lv === 5) drawFlags(g, ps, t);
  stepBalls(dt); stepDrops(dt);
  if (iAmHost) drawBots(g, dt);
  if (!me) return s.lv === 5 && Math.hypot(s.x - 28.6, s.z - DOOR.z) < 1.3 && s.started && !G.controlLock ? (isTouch() ? 'Tap' : 'Press E') + ' to enter Paintball 🎯' : '';
  remoteShots(ps);
  // between games, spectators become players again
  if (me === 's' && (!g || g.ph !== 'play') && ps.filter(p => p.pr === 'p').length < MAX){ me = 'p'; joinedAt = now(); send({pr: 'p', pj: joinedAt}); }
  const k = myKey();
  if (g){
    // a new game: go to your base with a full hopper
    if (g.id !== gameSeen){ gameSeen = g.id; logSeen = g.ph === 'play' && now() - g.t0 < 6000 ? 0 : Math.max(0, ...g.log.map(e => e.n)); stats = {splats: 0, caps: 0}; clearDecals();
      const team = g.tm[k]; if (team && g.ph === 'play'){ const T = TEAM[team], i = Object.keys(g.tm).filter(x => g.tm[x] === team).indexOf(k), sp = T.spawn[Math.max(0, i) % 6];
        G.setView(sp[0], sp[1], T.yaw, 0); ammo = HOPPER; reloadT = 0; bigText(`${T.icon} You are Team ${T.name}`, T.col); } }
    events(g);
    // splatted: frozen for a moment, then back to your base
    const until = g.ph === 'play' ? (g.dead[k] || 0) : 0, dk = g.id + ':' + until;
    if (until > now() && dk !== lastDeadKey){ lastDeadKey = dk; deadUntil = until; deadLock = {noPause: true, aim(){}, press(){}}; G.controlLock = deadLock; firing = false;
      const killer = (g.log.find(e => e.k === 'splat' && e.who === k) || {}).by; splatEl.innerHTML = `<div>🎨 SPLAT!</div><div style="font-size:18px;font-weight:600;margin-top:6px">${killer ? 'by ' + esc(g.nm[killer]) : ''} · back in <span id="pbCount">3</span></div>`;
      splatEl.style.background = `radial-gradient(circle at 50% 45%, transparent 10%, ${TEAM[g.tm[killer] || other(g.tm[k] || 'r')].col}cc 60%)`; splatEl.style.opacity = 1; play('ouch', 1, 0); }
    if (deadLock){ const left = deadUntil - now(), c = document.getElementById('pbCount'); if (c) c.textContent = Math.max(1, Math.ceil(left/1000));
      if (left <= 0 || g.ph !== 'play'){ releaseDead(); const team = g.tm[k]; if (team){ const T = TEAM[team], sp = T.spawn[(Math.random()*6) | 0]; G.setView(sp[0], sp[1], T.yaw, 0); } ammo = HOPPER; reloadT = 0; } }
  }
  // your marker
  const playing = me === 'p' && !deadLock;
  gun.visible = playing; crosshair.style.display = playing ? 'block' : 'none'; ammoEl.style.display = playing ? 'block' : 'none'; if (fireBtn) fireBtn.style.display = playing ? 'flex' : 'none';
  if (playing){
    cool -= dt; if (reloadT > 0){ reloadT -= dt; if (reloadT <= 0){ reloadT = 0; ammo = HOPPER; play('pop', 0.5, 0); } }
    if (firing && cool <= 0 && !G.controlLock && s.started) shoot();
    const cam = G.camera, kick = gun.userData.kick || 0; gun.userData.kick = Math.max(0, kick - dt*8);
    gun.position.copy(cam.position); gun.quaternion.copy(cam.quaternion); gun.translateX(0.12); gun.translateY(-0.12 + (reloadT > 0 ? -0.06 : 0)); gun.translateZ(-0.36 + kick*0.02); gun.scale.setScalar(0.32);
    gun.userData.hop.scale.y = 0.3 + 0.5*(ammo/HOPPER);
    ammoEl.textContent = reloadT > 0 ? '🎨 reloading…' : `🎨 ${ammo}/${HOPPER}`;
    const c = s.crouch ? 1 : 0; if (c !== crouchSent){ crouchSent = c; send({pc: c}); }
  }
  hudUpdate(g, ps);
  if (Math.hypot(s.x - IN[0], s.z - IN[1]) < 1.4 && !deadLock) return (isTouch() ? 'Tap' : 'Press E') + ' to leave the arena';
  return '';
}
function use(){
  const s = G.state;
  if (me && Math.hypot(s.x - IN[0], s.z - IN[1]) < 1.4 && !deadLock){ leave(); return true; }
  if (!me && s.lv === 5 && Math.hypot(s.x - 28.6, s.z - DOOR.z) < 1.3 && s.started && !G.controlLock){ try { sound.unlock(); } catch (e) {} enter(); return true; }
  return false;
}

function init(){
  G = window.GAME; THREE = G.THREE; ballGeo = BALLGEO(); splatTex = splatTexture(); P1 = new THREE.Vector3(); buildRoom(); G.posePaint = posePaint;
  hud = el('div', 'position:fixed;top:72px;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(20,24,30,.8);color:#fff;border-radius:12px;padding:8px 16px 9px;font-size:14px;text-align:center;pointer-events:none;max-width:min(560px,92vw)');
  crosshair = el('div', 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);display:none;z-index:3;color:#fff;font:300 26px system-ui,sans-serif;text-shadow:0 0 3px #000;pointer-events:none;transition:transform .08s');
  crosshair.textContent = '+';
  ammoEl = el('div', 'position:fixed;right:18px;bottom:18px;display:none;z-index:3;background:rgba(20,24,30,.75);color:#fff;border-radius:10px;padding:7px 12px;font:700 16px system-ui,sans-serif;pointer-events:none');
  flash = el('div', 'position:fixed;left:50%;top:36%;transform:translate(-50%,-50%);z-index:5;pointer-events:none;opacity:0;transition:opacity .3s;text-align:center');
  splatEl = el('div', 'position:fixed;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity .35s;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:800 56px system-ui,sans-serif;text-shadow:0 4px 18px rgba(0,0,0,.6)');
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:5;background:#fff;color:#1d2229;border-radius:16px;padding:18px 22px;width:min(380px,90vw);text-align:center;line-height:1.5;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35)');
  card.addEventListener('click', () => card.style.display = 'none'); card.addEventListener('touchend', () => card.style.display = 'none');
  if (isTouch()){ fireBtn = el('div', 'position:fixed;right:90px;bottom:110px;width:76px;height:76px;border-radius:50%;background:rgba(224,69,58,.55);border:2px solid rgba(255,255,255,.7);color:#fff;font-size:32px;display:none;align-items:center;justify-content:center;z-index:3;touch-action:none;user-select:none');
    fireBtn.textContent = '🎯'; fireBtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); firing = true; }); fireBtn.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); firing = false; }); }
  document.addEventListener('mousedown', e => { if (me === 'p' && e.button === 0 && !G.controlLock && (e.target === G.renderer?.domElement || document.pointerLockElement || e.target.tagName === 'CANVAS')) firing = true; });
  document.addEventListener('mouseup', e => { if (e.button === 0) firing = false; });
  addEventListener('blur', () => { firing = false; });
  addEventListener('keydown', e => {
    const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || e.repeat || !me) return;
    if (e.code === 'KeyR' && me === 'p'){ reload(); return; }
    if (e.code === 'Enter' && me === 'p'){ const ps = people(), h = currentHost(ps), g = game(); if (h && h.self && (!g || g.ph !== 'play') && ps.filter(p => p.pr === 'p').length >= MIN){ e.preventDefault(); e.stopImmediatePropagation(); card.style.display = 'none'; startGame(ps); } }
  }, true);
  G.uses.unshift({tick, use});
}

window.PAINT = {get host(){ return host; }, people: () => people(), game: () => game(), OBST,
  bots(n = 3){ const t = now(); for (let i = 0; i < n; i++){ const k = 'bot' + (bots.length + 1); bots.push({key: k, name: ['Robo-Anna', 'Bot Bram', 'Cyber-Sofie', 'Tin Tim', 'Ruben 2.0', 'Arne.exe', 'Wolfbot', 'Pixel Pieter', 'Data Dirk'][bots.length % 9], pr: 'p', pj: t + 1000 + i, bot: true, x: 6 + i*2, y: LO2, z: 3, yaw: 0}); } return bots.length; }};
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
