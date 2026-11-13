// Shared game clock: one compressed office week (Mon–Fri, weekends skipped) that is the same for every player,
// because it is computed from the (server) time. Drives the HUD clock, announcements, daylight, ceiling lights,
// the week schedule on the TVs, office sounds and the after-hours events. Settings come from clock.md.
import {sound, play, loop, spatial} from './sound.js';
import {createFX} from './fx.js';

// ---------- time ----------
// day 07:00–17:00: 5 real minutes per game hour; night 17:00–07:00: 1 real minute per game hour → 64 real minutes per game day
const DAY_MS = 64*60000, EPOCH = Date.UTC(2026, 0, 5);
const DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr'], DAYS_FULL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];
const realToGame = r => r < 7 ? r*60 : r < 57 ? 420 + (r - 7)*12 : 1020 + (r - 57)*60;   // real minutes into the day → game minutes
const gameToReal = m => m < 420 ? m/60 : m < 1020 ? 7 + (m - 420)/12 : 57 + (m - 1020)/60;
let offset = 0, speed = 1, speedBase = 0;   // test only: ?t=vr-08:55 and ?speed=20 (local to this browser)
function nowMs(){ let n = window.__serverNow ? window.__serverNow() : Date.now(); if (speed !== 1) n = speedBase + (n - speedBase)*speed; return n + offset; }
function gameTime(ms = nowMs()){
  const t = ms - EPOCH, dayN = Math.floor(t/DAY_MS), min = realToGame((t - dayN*DAY_MS)/60000);
  return {dayN, wd: ((dayN % 5) + 5) % 5, min, A: dayN*1440 + min};   // A = absolute game minute (for comparing across days)
}
const hhmm = m => { m = ((Math.floor(m) % 1440) + 1440) % 1440; return String(m/60 | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
function setTime(str){
  const m = /^(ma|di|wo|do|vr)?[- ]?(\d{1,2}):(\d{2})$/i.exec(String(str).trim()); if (!m) return false;
  const g = gameTime(), wd = m[1] ? DAYS.findIndex(d => d.toLowerCase() === m[1].toLowerCase()) : g.wd;
  const target = EPOCH + (g.dayN - g.wd + wd)*DAY_MS + gameToReal(+m[2]*60 + +m[3])*60000;
  offset += target - nowMs(); lastA = null; queue = []; return true;
}

// ---------- places ----------
const P = {
  kitchen3: {x: 35.3, z: 12.15, lv: 2}, kitchen4: {x: 39.4, z: 11.2, lv: 0}, portus: {x: 21, z: 10.3, lv: 0}, stille: {x: 43, z: 6.5, lv: 0},
  server: {x: 26.7, z: 10.3, lv: 0}, printer: {x: 16.6, z: 8.8, lv: 0},
};
const DESKS = [[0, 14, 0, 13, 0], [14, 28, 0, 5.3, 0], [39, 50, 0, 5.3, 0], [42, 50, 4.8, 13, 2]];   // x0 x1 z0 z1 level: where people type
const CLEAN_SPOTS = [{x: 7, z: 7, lv: 0, xa: 4, za: 2.5}, {x: 44, z: 2.8, lv: 0, xa: 3.5, za: 1.2}, {x: 21, z: 6.5, lv: 0, xa: 5, za: 0.5}, {x: 46, z: 9.5, lv: 2, xa: 3, za: 1.5}];   // xa/za: how far the cleaner walks around
const SERVER_ALERTS = [
  'Disk C: on SQL-PROD-01 is 96% full', 'Backup job "Nightly full" failed on SQL-PROD-02', 'Azure DevOps: 0 of 3 build agents online',
  'CPU at 99% on APP-02 for 10 minutes', 'The API gateway certificate expires in 3 days', 'UPS switched to battery power',
  'IIS app pool "Portal" keeps recycling', 'Azure SQL: DTU usage at 100%', '4,000 failed sign-ins on the VPN in 5 minutes',
  'Server room at 29 °C: is the airco failing?', 'Hyper-V host 2 stopped responding', 'Exchange queue: 1,200 mails stuck',
];

// ---------- schedule (clock.md) ----------
function rng(seed){ return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dayEvents(dayN){
  const wd = ((dayN % 5) + 5) % 5, fri = wd === 4, B = dayN*1440, R = rng(dayN*31 + 5);
  const ev = [
    {kind: 'open', from: 420, icon: '🏢', title: wd === 0 ? 'Monday again. The office is open' : 'Good morning! The office is open'},
    {kind: 'coffee', from: 540, to: 570, icon: '☕', title: 'Coffee', where: 'Kitchen (3e)', pos: P.kitchen3, bell: true},
    fri ? {kind: 'fries', from: 690, to: 750, icon: '🍟', title: 'Friday fries', where: 'Kitchen (4e)', pos: P.kitchen4, bell: true}
        : {kind: 'lunch', from: 720, to: 780, icon: '🥪', title: 'Lunch', where: 'Kitchen (4e)', pos: P.kitchen4, bell: true},
    fri ? {kind: 'meeting', from: 900, to: 960, icon: '📊', title: 'Team meeting', where: 'Portus Ganda', pos: P.portus, bell: true}
        : {kind: 'coffee', from: 900, to: 920, icon: '☕', title: 'Second coffee', where: 'Kitchen (3e)', pos: P.kitchen3, bell: true},
    {kind: 'end', from: 1020, icon: '🏠', title: fri ? 'Office hours are over. After work continues in the Stille ruimte' : 'Office hours are over'},
    {kind: 'close', from: 1140, icon: '🔒', title: 'Alarm armed · lights off'},
  ];
  if (fri) ev.push({kind: 'afterwork', from: 960, to: 1140, icon: '🎲', title: 'After work + games', where: 'Stille ruimte', pos: P.stille, bell: true});
  if (fri && R() < 0.15) ev.push({kind: 'deploy', from: 990, icon: '🚀', title: 'Someone just deployed to production. On a Friday. At 16:30.', quiet: true});
  if (wd === 0) ev.push({kind: 'monday', from: 545, icon: '😴', title: 'The coffee machine is working overtime today', quiet: true});
  return ev.map(e => Object.assign(e, {A: B + e.from, dur: e.to ? e.to - e.from : 0}));
}
// the night after day dayN (17:00 → 07:00 next morning); the same random events for everyone
// the big night events: what they look like is in fx.js
const FIRE_SPOTS = [
  {x: 16.6, z: 8.8, lv: 0, y: 1.08, name: 'the Print room', cause: 'The printer caught fire'},
  {x: 39.4, z: 11.2, lv: 0, y: 0.94, name: 'the kitchen', cause: 'Someone left the toaster on'},
  {x: 35.3, z: 12.15, lv: 2, y: 0.94, name: 'the 3e kitchen', cause: 'The coffee machine overheated'},
];
const serverEvent = (A, msg) => ({kind: 'server', A, dur: 90, icon: '🖥️', title: 'Server room alert: ' + msg, sub: 'Red light above the server room door', alert: true, msg,
  endIcon: '✅', endTitle: 'Server alert resolved. Someone from on-call fixed it remotely'});
const fireEvent = (A, spot) => ({kind: 'fire', A, dur: 120, icon: '🔥', title: `Fire in ${spot.name}! Leave the building via the stairs`, sub: `${spot.cause}. Do not use the lifts`, alert: true, spot,
  endIcon: '🚒', endTitle: 'The fire brigade put out the fire', endSub: 'Everyone is safe. Somebody will have to explain this tomorrow'});
const burglarEvent = A => ({kind: 'burglar', A, dur: 120, icon: '🚨', title: 'Burglar alarm! There is a burglar on the 4e', sub: 'Find him and he runs. Security is on the way', alert: true,
  endIcon: '🚓', endTitle: 'The police caught the burglar', endSub: 'Nothing was stolen, except the Friday fries money'});
const spookyEvent = A => ({kind: 'spooky', A, dur: 210, icon: '👻', title: 'The office is haunted tonight!', sub: 'Ghosts roam the 4e and the 3e. Don\'t get too close…',
  endIcon: '🌅', endTitle: 'The ghosts are gone… for now'});
const powerEvent = A => ({kind: 'power', A, dur: 75, icon: '⚡', title: 'Power failure! The whole office is dark', sub: 'Press F for your flashlight. The emergency lights and the UPS keep the servers running', alert: true,
  endIcon: '💡', endTitle: 'Power is back', endSub: 'The UPS held out. Someone should check the servers tomorrow'});
function nightEvents(dayN){
  const R = rng(dayN*7919 + 13), B = dayN*1440 + 1020, ev = [];   // B = 17:00; +120 = 19:00, +420 = 00:00, +840 = 07:00
  const at = (a, b) => a + Math.floor(R()*(b - a));
  // at night 1 game minute = 1 real second, so dur 120 ≈ 2 real minutes
  if (R() < 0.7){ const s = at(20, 40); ev.push({kind: 'cleaners', A: B + s, dur: 100, icon: '🧹', title: 'The cleaners are in', pos: CLEAN_SPOTS[R()*CLEAN_SPOTS.length | 0], quiet: true}); }
  if (R() < 0.4) ev.push({kind: 'phone', A: B + at(60, 360), dur: 1, desk: DESKS[R()*DESKS.length | 0], u: R(), v: R()});
  if (R() < 0.35) ev.push(serverEvent(B + at(180, 700), SERVER_ALERTS[R()*SERVER_ALERTS.length | 0]));
  const big = R();
  if (big < 0.07) ev.push(fireEvent(B + at(240, 640), FIRE_SPOTS[R()*FIRE_SPOTS.length | 0]));
  else if (big < 0.15) ev.push(burglarEvent(B + at(300, 640)));
  else if (big < 0.30) ev.push(spookyEvent(B + at(330, 450)));
  const build = 1000 + dayN % 9000;
  ev.push({kind: 'build', A: B + 540, dur: 25, icon: '🌙', title: `Nightly build #${build} started`, quiet: true});
  ev.push(R() < 0.8 ? {kind: 'buildok', A: B + 565, icon: '✅', title: `Nightly build #${build} succeeded`, quiet: true}
                    : {kind: 'buildfail', A: B + 565, icon: '❌', title: `Nightly build #${build} failed: ${2 + (R()*5 | 0)} tests red. Fun stand-up tomorrow`, quiet: true});
  if (R() < 0.12) ev.push(powerEvent(B + at(200, 660)));   // last, so the other events of a night stay the same
  if (R() < 0.25) ev.push({kind: 'winupdate', A: B + 600, dur: 30, icon: '💻', title: 'Windows Update is restarting every PC (1 of 37)', quiet: true});
  return ev.map(e => Object.assign({dur: 0}, e));
}
let evCache = {dayN: null, list: []}; const extra = [];
function events(dayN){
  if (evCache.dayN !== dayN) evCache = {dayN, list: [...nightEvents(dayN - 1), ...dayEvents(dayN), ...nightEvents(dayN)]};
  return extra.length ? evCache.list.concat(extra) : evCache.list;
}
const activeOf = (list, A, kind) => list.find(e => e.kind === kind && e.A <= A && A < e.A + e.dur);

// ---------- sun (real season, Ghent) ----------
const RAD = Math.PI/180, LAT = 51.05, LON = 3.72;
let tzCache = {h: -1, v: 1};
function brusselsOffset(d){
  const h = Math.floor(d.getTime()/3.6e6); if (tzCache.h === h) return tzCache.v;
  let v = 1; try { const s = new Intl.DateTimeFormat('en-US', {timeZone: 'Europe/Brussels', timeZoneName: 'shortOffset'}).formatToParts(d).find(p => p.type === 'timeZoneName').value; const m = /GMT([+-]\d+)/.exec(s); if (m) v = +m[1]; } catch (e) {}
  tzCache = {h, v}; return v;
}
function sunAt(gameMin){
  const d = new Date(), doy = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0))/864e5);
  const decl = 23.44*Math.sin(2*Math.PI*(284 + doy)/365)*RAD, B = 2*Math.PI*(doy - 81)/364;
  const eot = 9.87*Math.sin(2*B) - 7.53*Math.cos(B) - 1.5*Math.sin(B);
  const H = ((gameMin/60 + (4*LON + eot)/60 - brusselsOffset(d)) - 12)*15*RAD, lat = LAT*RAD;
  const el = Math.asin(Math.sin(lat)*Math.sin(decl) + Math.cos(lat)*Math.cos(decl)*Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(lat) - Math.tan(decl)*Math.cos(lat)) + Math.PI;
  return {el: el/RAD, az};
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a)/(b - a))); return t*t*(3 - 2*t); };

// ---------- HUD: clock, announcements ----------
const CSS = `
#clock{position:fixed;top:10px;right:10px;background:rgba(20,24,30,.62);color:#fff;border-radius:10px;padding:5px 10px 6px;text-align:right;cursor:pointer;z-index:2;min-width:96px}
#clock .t{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.5px}
#clock .t i{font-style:normal;font-size:13px;opacity:.8;margin-left:6px}
#clock .s{font-size:12px;opacity:.85;max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#clock.alert{background:rgba(170,30,25,.85)}
#clock.spooky{background:rgba(70,30,110,.85)}
#clock.power{background:rgba(25,30,40,.92);box-shadow:0 0 0 2px #f2c230}
#banner{position:fixed;top:64px;left:50%;transform:translate(-50%,-8px);background:rgba(20,24,30,.8);color:#fff;border-radius:12px;padding:10px 16px;font-size:15px;max-width:min(560px,86vw);text-align:center;opacity:0;transition:opacity .35s,transform .35s;pointer-events:none;z-index:3}
#banner.on{opacity:1;transform:translate(-50%,0)}
#banner.alert{background:rgba(170,30,25,.92);font-weight:600}
#banner small{display:block;opacity:.8;font-size:12px;margin-top:2px}
`;
let clockEl, tEl, sEl, bannerEl, queue = [], bannerUntil = 0;
function hud(){
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  clockEl = document.createElement('div'); clockEl.id = 'clock'; clockEl.title = 'Game time. Click or press M to turn the sound on/off';
  clockEl.innerHTML = '<div class="t"></div><div class="s"></div>'; document.body.appendChild(clockEl);
  tEl = clockEl.querySelector('.t'); sEl = clockEl.querySelector('.s');
  bannerEl = document.createElement('div'); bannerEl.id = 'banner'; document.body.appendChild(bannerEl);
  clockEl.addEventListener('click', () => { sound.unlock(); sound.toggleMute(); lastClock = ''; });
  addEventListener('keydown', e => { const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    sound.unlock(); if (e.code === 'KeyM' && !e.repeat){ sound.toggleMute(); lastClock = ''; } });
  addEventListener('pointerdown', () => sound.unlock());
  addEventListener('office-start', () => sound.unlock());
  addEventListener('resize', place); place();
}
// next to the minimap on wide screens, under it on narrow ones
function place(){
  const mini = document.getElementById('mini'); if (!mini || !clockEl) return;
  const w = mini.offsetWidth, h = mini.offsetHeight;
  if (innerWidth - w < 330){ clockEl.style.right = '10px'; clockEl.style.top = (h + 18) + 'px'; bannerEl.style.top = (h + 80) + 'px'; }
  else { clockEl.style.right = (w + 18) + 'px'; clockEl.style.top = '10px'; bannerEl.style.top = '64px'; }
}
function announce(icon, title, sub, alert){ queue.push({icon, title, sub, alert}); }
function showBanners(nowS){
  if (nowS < bannerUntil) return;
  if (!queue.length){ if (bannerEl.classList.contains('on')) bannerEl.classList.remove('on'); return; }
  const b = queue.shift(); bannerEl.className = 'on' + (b.alert ? ' alert' : '');
  bannerEl.innerHTML = ''; bannerEl.append(b.icon + ' ' + b.title); if (b.sub){ const s = document.createElement('small'); s.textContent = b.sub; bannerEl.append(s); }
  bannerUntil = nowS + (b.alert ? 8 : 6);
}

// ---------- TV screens: the week schedule ----------
let tvCanvas, tvCtx, tvTex, lastTV = '';
function drawTV(g, list, mode, server){
  const c = tvCtx, W = 1024, H = 576; c.save();
  const big = (bg, lines) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.textAlign = 'center';
    lines.forEach(([t, f, y]) => { c.font = f + ' system-ui,Segoe UI,Segoe UI Emoji,sans-serif'; c.fillText(t, W/2, y); }); c.restore(); tvTex.needsUpdate = true; };
  if (mode === 'fire') return big('#b3201b', [['🔥 FIRE ALARM', '700 92px', 240], ['Leave the building via the stairs', '500 40px', 330], ['Do not use the lifts', '500 40px', 390]]);
  if (mode === 'server') return big('#3a0d0d', [['🖥️ SERVER ALERT', '700 80px', 200], [server ? server.msg : '', '500 36px', 300], ['Monitoring · ' + DAYS_FULL[g.wd] + ' ' + hhmm(g.min), '400 28px', 420]]);
  if (mode === 'spooky'){
    // TV static, and every few seconds a ghost face
    const img = c.createImageData(256, 144), d = img.data; for (let i = 0; i < d.length; i += 4){ const v = Math.random()*200 | 0; d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255; }
    const tmp = document.createElement('canvas'); tmp.width = 256; tmp.height = 144; tmp.getContext('2d').putImageData(img, 0, 0);
    c.imageSmoothingEnabled = false; c.drawImage(tmp, 0, 0, W, H);
    if (Math.random() < 0.2){ c.fillStyle = 'rgba(230,240,255,.85)'; c.beginPath(); c.ellipse(W/2, H/2, 150, 190, 0, 0, Math.PI*2); c.fill();
      c.fillStyle = '#000'; for (const dx of [-55, 55]){ c.beginPath(); c.ellipse(W/2 + dx, H/2 - 40, 26, 40, 0, 0, Math.PI*2); c.fill(); }
      c.beginPath(); c.ellipse(W/2, H/2 + 70, 34, 50, 0, 0, Math.PI*2); c.fill(); }
    c.restore(); tvTex.needsUpdate = true; return;
  }
  const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#16294a'); gr.addColorStop(1, '#0c1628'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
  c.fillStyle = '#f2b84b'; c.fillRect(0, 0, W, 8);
  c.fillStyle = '#9fb3d1'; c.font = '600 26px system-ui,Segoe UI,sans-serif'; c.fillText('ORBID · THIS WEEK', 48, 62);
  c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = '700 54px system-ui,Segoe UI,sans-serif'; c.fillText(hhmm(g.min), W - 48, 72);
  c.font = '500 26px system-ui,Segoe UI,sans-serif'; c.fillStyle = '#9fb3d1'; c.fillText(DAYS_FULL[g.wd], W - 48, 106); c.textAlign = 'left';
  // today
  c.fillStyle = '#fff'; c.font = '600 30px system-ui,Segoe UI,sans-serif'; c.fillText('Today', 48, 150);
  const today = list.filter(e => e.where && e.A >= g.dayN*1440 && e.A < g.dayN*1440 + 1440).sort((a, b) => a.A - b.A);
  let y = 200;
  for (const e of today){
    const now = e.A <= g.A && g.A < e.A + e.dur, past = g.A >= e.A + e.dur;
    if (now){ c.fillStyle = 'rgba(242,184,75,.16)'; c.fillRect(36, y - 36, 470, 66); c.fillStyle = '#f2b84b'; c.fillRect(36, y - 36, 6, 66); }
    c.globalAlpha = past ? 0.4 : 1;
    c.font = '30px system-ui,Segoe UI Emoji,sans-serif'; c.fillText(e.icon, 54, y + 2);
    c.fillStyle = '#fff'; c.font = '600 27px system-ui,Segoe UI,sans-serif'; c.fillText(e.title, 104, y - 4);
    c.fillStyle = '#9fb3d1'; c.font = '22px system-ui,Segoe UI,sans-serif'; c.fillText(hhmm(e.A) + (e.dur ? '–' + hhmm(e.A + e.dur) : '') + ' · ' + e.where, 104, y + 24);
    c.globalAlpha = 1; y += 80;
  }
  if (g.min >= 1020){ c.fillStyle = '#9fb3d1'; c.font = 'italic 24px system-ui,Segoe UI,sans-serif'; c.fillText('Office hours are over. See you tomorrow!', 48, Math.min(y + 10, 540)); }
  // week
  const X0 = 560, CW = 84; c.fillStyle = '#fff'; c.font = '600 30px system-ui,Segoe UI,sans-serif'; c.fillText('Week', X0, 150);
  for (let i = 0; i < 5; i++){
    const x = X0 + i*CW, on = i === g.wd;
    c.fillStyle = on ? 'rgba(242,184,75,.22)' : 'rgba(255,255,255,.06)'; c.fillRect(x, 170, CW - 8, 230);
    c.fillStyle = on ? '#f2b84b' : '#cfdbee'; c.font = '700 26px system-ui,Segoe UI,sans-serif'; c.textAlign = 'center'; c.fillText(DAYS[i], x + (CW - 8)/2, 204);
    c.font = '26px system-ui,Segoe UI Emoji,sans-serif';
    const icons = i === 4 ? ['☕', '🍟', '📊', '🎲'] : ['☕', '🥪', '☕']; icons.forEach((ic, k) => c.fillText(ic, x + (CW - 8)/2, 250 + k*40));
    c.textAlign = 'left';
  }
  c.fillStyle = '#9fb3d1'; c.font = '21px system-ui,Segoe UI,sans-serif';
  ['Every day: ☕ 09:00 · 🥪 12:00 · ☕ 15:00', 'Friday: 🍟 11:30 fries · 📊 15:00 team meeting', '            🎲 16:00 after work in the Stille ruimte'].forEach((l, k) => c.fillText(l, X0, 440 + k*32));
  c.restore(); tvTex.needsUpdate = true;
}

// ---------- the frame loop ----------
let G = null, THREE = null, lastA = null, lastClock = '', sunCache = {t: -1}, Lcur = 1, flickerUntil = 0, wasLit = null, offSince = -99;
let prev = {x: 0, z: 0, zone: ''}, lastMove = 0, fx = null, spookNext = 0, spookSaid = null, phoneDone = new Set();
const C = (h) => new THREE.Color(h);
let COL;

function tick(dt){
  const st = G.state, nowS = performance.now()/1000, g = gameTime(), list = events(g.dayN), A = g.A, min = g.min, lv = st.lv;
  sound.setListener(st.x, st.z, st.yaw, lv);

  // announcements: everything that started since the last frame (skipped after a big jump)
  if (lastA !== null && A > lastA && A - lastA < 30){
    for (const e of list){
      if (e.where && e.A - 5 > lastA && e.A - 5 <= A) announce(e.icon, `${e.title} in 5 minutes`, e.where);
      if (e.title && e.A > lastA && e.A <= A){
        announce(e.icon, e.title, e.sub || e.where || '', e.alert);
        if (e.bell && sound.ready) play('chime', 0.8);
      }
      if (e.endTitle && e.A + e.dur > lastA && e.A + e.dur <= A) announce(e.endIcon, e.endTitle, e.endSub || '', false);
      if (e.kind === 'phone' && e.A > lastA && e.A <= A){ const d = e.desk, s = spatial(d[0] + (d[1] - d[0])*e.u, d[2] + (d[3] - d[2])*e.v, d[4], 22); play('phone', s.g, s.p); }
    }
  }
  lastA = A;

  const fire = activeOf(list, A, 'fire'), burglar = activeOf(list, A, 'burglar'), spooky = activeOf(list, A, 'spooky');
  const server = activeOf(list, A, 'server'), clean = activeOf(list, A, 'cleaners'), winupd = activeOf(list, A, 'winupdate'), build = activeOf(list, A, 'build');
  const power = activeOf(list, A, 'power');
  const current = list.find(e => e.where && e.A <= A && A < e.A + e.dur);

  // ceiling lights: on 07:00 (4e) / 07:10 (3e) until 19:00. After that a motion sensor: they stay on while you move around
  // and fade out after 60 s standing still. Always on during a fire or burglar alarm, off during a power failure.
  const moved = Math.hypot(st.x - prev.x, st.z - prev.z) > 0.002; if (moved) lastMove = nowS; prev.x = st.x; prev.z = st.z;
  const building = min >= (lv === 2 ? 430 : 420) && min < 1140, sensorOn = nowS - lastMove < 60;
  const lit = !power && (building || !!fire || !!burglar || sensorOn);

  // HUD clock: the line under the time always says what is going on, most important first
  let sub;
  const until = e => ' until ' + hhmm(e.A + e.dur);
  if (fire) sub = `🔥 Fire in ${fire.spot.name}`; else if (burglar) sub = '🚨 Burglar on the 4e' + until(burglar);
  else if (power) sub = '⚡ Power failure' + until(power) + ' · F: flashlight';
  else if (spooky) sub = '👻 Haunted' + until(spooky) + ' · lights failing';
  else if (server) sub = '🖥️ Server alert' + until(server);
  else if (current) sub = `${current.icon} ${current.title} · ${current.where}`;
  else if (winupd) sub = '💻 Windows Update is running';
  else if (clean) sub = '🧹 Cleaners in' + until(clean);
  else if (build) sub = '🌙 Nightly build running';
  else if (min < 420 || min >= 1140) sub = lit ? '🌙 Closed · 💡 motion-sensor lights' : '🌙 Closed · 💡 lights off: walk to turn them on';
  else { const nx = list.filter(e => e.where && e.A > A && e.A < g.dayN*1440 + 1440).sort((a, b) => a.A - b.A)[0]; sub = nx ? `Next: ${nx.icon} ${nx.title} ${hhmm(nx.A)}` : (min >= 1020 ? '🏠 After hours' : ''); }
  const clockTxt = DAYS[g.wd] + ' ' + hhmm(min) + '|' + sub + '|' + (sound.muted ? 1 : 0) + '|' + !!(fire || burglar);
  if (clockTxt !== lastClock){ lastClock = clockTxt; tEl.innerHTML = ''; tEl.append(DAYS[g.wd] + ' ' + hhmm(min)); const i = document.createElement('i'); i.textContent = sound.muted ? '🔇' : '🔈'; tEl.append(i); sEl.textContent = sub; clockEl.classList.toggle('alert', !!(fire || burglar)); clockEl.classList.toggle('spooky', !!spooky); clockEl.classList.toggle('power', !!power && !fire && !burglar); }
  showBanners(nowS);

  // ---------- light ----------
  if (nowS - sunCache.t > 1){ sunCache = Object.assign({t: nowS}, sunAt(min)); }
  const el = sunCache.el, day = smooth(-6, 6, el), glow = Math.exp(-Math.pow((el - 1)/6, 2)), warm = el > -6 ? Math.exp(-Math.max(el, 0)/10) : 0;
  const sky = COL.night.clone().lerp(COL.day, smooth(-8, 10, el)).lerp(COL.dusk, 0.5*glow);
  G.scene.background.copy(sky); if (G.scene.fog) G.scene.fog.color.copy(sky);
  G.sun.intensity = 0.5*day; G.sun.color.copy(COL.sun).lerp(COL.sunLow, warm);
  G.sun.position.set(Math.sin(sunCache.az)*Math.cos(el*RAD)*30, Math.max(0.5, Math.sin(el*RAD)*30), -Math.cos(sunCache.az)*Math.cos(el*RAD)*30);

  // switching on after being off for a while: one short fluorescent-tube flicker (only then, so walking around never flickers)
  if (lit && wasLit === false && nowS - offSince > 2) flickerUntil = nowS + 0.4;
  if (!lit && wasLit !== false) offSince = nowS; wasLit = lit;
  // haunted: the lights barely work and keep failing (the clock says so)
  if (spooky && lit && Math.random() < dt*0.6) flickerUntil = nowS + 0.25 + Math.random()*0.6;
  const L = lit ? (spooky ? 0.2 : 1) : 0;
  if (nowS < flickerUntil) Lcur = Math.random() < 0.5 ? 1 : 0.1; else Lcur += (L - Lcur)*Math.min(1, dt*(L > Lcur ? 10 : 1.5));   // fade out slowly
  let hi = 0.07 + 0.35*day + 0.34*Lcur, ai = 0.035 + 0.135*day + 0.15*Lcur;
  G.hemi.color.copy(COL.moon).lerp(COL.white, Math.max(day, Lcur)); G.amb.color.copy(COL.white);
  if (fire){ const p = 0.5 + 0.5*Math.sin(nowS*7); G.amb.color.copy(COL.red); ai += 0.3*p; G.hemi.color.lerp(COL.red, 0.35*p); }
  else if (burglar){ const blue = Math.floor(nowS*3) % 2; G.amb.color.copy(blue ? COL.blue : COL.red); ai += 0.25; }
  G.hemi.intensity = hi; G.amb.intensity = ai;
  G.LIGHT.color.copy(COL.lampOff).lerp(COL.lampOn, Lcur);
  // PC screens: on during the working day, blue during the night-time Windows Update
  const pcs = power ? COL.black : winupd ? COL.update : (min >= 470 && min < 1050) ? COL.pcOn : COL.black;
  if (!G.SCREEN.emissive.equals(pcs)) G.SCREEN.emissive.copy(pcs);
  // the desk monitors show a work view while on, a blue update screen during Windows Update, and go dark otherwise
  const pcView = winupd ? COL.pcUpdate : pcs === COL.pcOn ? COL.pcView : COL.pcDark;
  for (const m of G.PCSCREENS || []) if (!m.color.equals(pcView)){ m.color.copy(pcView); }
  // reflections fade with the light in the room
  const envK = 0.15 + 0.85*Math.max(day, Lcur);
  for (const m of G.ENVMATS || []) m.envMapIntensity = m.userData.envBase*envK;
  // TVs: schedule while the building is open, red during a fire alarm, off otherwise
  // (fire: evacuation screen; server alert: the alert; spooky: static with a face now and then)
  const tvMode = fire ? 'fire' : power ? '' : server ? 'server' : spooky ? 'spooky' : '';
  const tvOn = !!tvMode || (!power && min >= 420 && min < 1140);   // a power failure turns the TVs off
  const tvKey = tvMode === 'spooky' ? 'spooky' + Math.floor(nowS*8) : tvMode ? tvMode : tvOn ? hhmm(min) + g.wd : 'off';
  if (tvKey !== lastTV){ lastTV = tvKey; if (tvOn) drawTV(g, list, tvMode, server); G.TVSCREEN.color.copy(tvOn ? COL.white : COL.tvOff); }

  // the night events made visible: ghosts, fire and smoke, the burglar, the cleaner, the server beacon
  fx.update(dt, {fire, burglar, spooky, server, clean, power, lit: Lcur, A, nowS, t: nowMs()/1000});

  // ---------- sound ----------
  if (!sound.ready) return;
  const occ = min < 420 ? 0 : min < 540 ? 0.1 + 0.9*(min - 420)/120 : min < 1020 ? 1 : min < 1140 ? 0.15 : 0;
  const near = (p, r) => spatial(p.x, p.z, p.lv, r);
  // the work area closest to you; office sounds come from random spots in it, a few metres around you
  let desk = {g: 0, d: null};
  for (const d of DESKS){ const x = Math.max(d[0], Math.min(d[1], st.x)), z = Math.max(d[2], Math.min(d[3], st.z)), s = spatial(x, z, d[4], 14); if (s.g > desk.g) desk = {g: s.g, d}; }
  const deskSpot = () => { const d = desk.d; if (!d) return {g: 0, p: 0};
    return spatial(Math.max(d[0], Math.min(d[1], st.x + (Math.random() - 0.5)*14)), Math.max(d[2], Math.min(d[3], st.z + (Math.random() - 0.5)*10)), d[4], 14); };
  const at = (fx, vol, p) => { const s = p ? near(p, 14) : deskSpot(); if (s.g > 0.01) play(fx, s.g*vol, s.p); };
  { const s = near(P.server, 7); loop('server', s.g*(build ? 0.3 : 0.16), s.p); }
  // (the cleaner's vacuum sound comes from fx.js, where the cleaner walks)
  loop('fire', fire ? (lv === 0 ? 0.45 : 0.32) : 0); loop('siren', burglar ? 0.35 : 0);
  const chance = rate => Math.random() < dt*rate;
  // working: typing, clicking, chairs, mugs, colleagues talking and the odd laugh
  if (desk.g > 0.02){
    if (chance(occ*1.6)) at('keys', 0.7); if (chance(occ*0.9)) at('mouse', 0.8);
    if (chance(occ*0.45)) at('voices', 0.9); if (chance(occ*0.05)) at('laugh', 0.8);
    if (chance(occ*0.12)) at('chair', 1); if (chance(occ*0.1)) at('mug', 1);
  }
  // gatherings (coffee, lunch, meeting, after work): chatter, laughter, mugs and the coffee machine where it happens
  if (current && current.pos){
    if (chance(2.2)) at('voices', 1, current.pos); if (chance(0.3)) at('laugh', 1, current.pos); if (chance(0.5)) at('mug', 1, current.pos);
    if ((current.kind === 'coffee' || current.kind === 'lunch' || current.kind === 'fries') && chance(1/12)) at('coffee', 1, current.pos);
  }
  else if (occ > 0.5 && chance(1/90)) at('coffee', 1, Math.random() < 0.5 ? P.kitchen3 : P.kitchen4);
  if (occ > 0.5 && chance(1/80)) at('printer', 1, P.printer);
  if (occ > 0.5 && chance(1/120)) at('phone', 0.5);
  if (server && chance(1/3)){ const s = near(P.server, 16); play('beep', s.g, s.p); }
  if (occ === 0 && !spooky && chance(1/40)) play('creak', 0.5, Math.random()*2 - 1);
  if (spooky && nowS > spookNext){
    spookNext = nowS + 4 + Math.random()*6; const r = Math.random(), pan = Math.random()*2 - 1;
    if (r < 0.3) play('whisper', 0.8, pan); else if (r < 0.5) play('steps', 0.8, pan); else if (r < 0.65) play('creak', 0.8, pan);
    else if (r < 0.8){ const s = near(P.printer, 18); if (s.g > 0.05) play('printer', s.g, s.p, 1); else play('whisper', 0.6, pan); }
    else spookDoor(st);
  }
}
// a door near you opens or slams shut by itself
function spookDoor(st){
  const lvl = st.lv === 2 ? 2 : (st.y > 1 ? 1 : 0);
  const ds = (G.doors || []).filter(d => d.level === lvl && Math.hypot(d.ctr[0] - st.x, d.ctr[1] - st.z) > 3 && Math.hypot(d.ctr[0] - st.x, d.ctr[1] - st.z) < 16);
  if (!ds.length){ play('steps', 0.8, Math.random()*2 - 1); return; }
  const d = ds[Math.random()*ds.length | 0], s = spatial(d.ctr[0], d.ctr[1], st.lv, 18);
  if (d.target > 0){ d.target = 0; play('slam', Math.max(0.3, s.g), s.p); } else { d.target = G.DOOR_OPEN; play('creak', Math.max(0.3, s.g), s.p); }
  if (window.__onDoor) window.__onDoor(G.doors.indexOf(d), d.target > 0);   // everyone sees the ghost
}

function init(){
  G = window.GAME; THREE = G.THREE;
  COL = {night: C(0x0b1322), day: C(0xc9dcec), dusk: C(0xe9a27a), sun: C(0xfff3df), sunLow: C(0xffb27a), moon: C(0x7f93bd), white: C(0xffffff),
    red: C(0xff2a1a), blue: C(0x2a5bff), lampOn: C(0xfffcf2), lampOff: C(0x0e0f12), pcOn: C(0x0f1b2c), update: C(0x1d4fb0), black: C(0x000000), tvOff: C(0x16181c),
    pcView: C(0xd8d8d8), pcDark: C(0x0d0e11), pcUpdate: C(0x3a6fd8)};
  tvCanvas = document.createElement('canvas'); tvCanvas.width = 1024; tvCanvas.height = 576; tvCtx = tvCanvas.getContext('2d');
  tvTex = new THREE.CanvasTexture(tvCanvas); tvTex.encoding = THREE.sRGBEncoding; tvTex.anisotropy = 4;
  G.TVSCREEN.map = tvTex; G.TVSCREEN.needsUpdate = true;
  G.SCREEN.emissive = G.SCREEN.emissive || C(0);
  // red alert lamp above the server room door
  fx = createFX(G, announce);
  hud(); window.__onFrameClock = dt => { try { tick(dt); } catch (e) { console.error(e); window.__onFrameClock = null; } };
}

// test helpers (only change this browser): ?t=vr-08:55 jumps to that game time, ?speed=20 runs the clock 20× faster,
// CLOCK.trigger('fire' | 'burglar' | 'spooky' | 'server' | 'cleaners' | 'winupdate') starts an after-hours event now (best at night: ?t=ma-22:00)
window.CLOCK = {
  now(){ const g = gameTime(); return DAYS[g.wd] + ' ' + hhmm(g.min); }, set: setTime,
  game: () => gameTime(),   // {dayN, wd (0 = Monday), min (minutes since midnight), A}
  active(){ const g = gameTime(); return events(g.dayN).filter(e => e.A <= g.A && g.A < e.A + e.dur).map(e => e.kind); },   // kinds of events happening now
  play(name){ sound.unlock(); play(name, 1, 0); },
  speed(n){ const real = window.__serverNow ? window.__serverNow() : Date.now(); offset += (speedBase + (real - speedBase)*speed) - real; speedBase = real; speed = +n || 1; },
  // CLOCK.trigger('fire', 120, 1) → fire in the 4e kitchen; the third value picks the fire spot (0 Print room, 1 kitchen, 2 3e kitchen)
  trigger(kind, dur, spot = 0){ const g = gameTime(), A = g.A + 0.01;
    const e = {fire: () => fireEvent(A, FIRE_SPOTS[spot] || FIRE_SPOTS[0]), burglar: () => burglarEvent(A), spooky: () => spookyEvent(A), server: () => serverEvent(A, SERVER_ALERTS[0]),
      cleaners: () => ({kind, A, dur: 100, icon: '🧹', title: 'The cleaners are in', pos: CLEAN_SPOTS[spot] || CLEAN_SPOTS[0]}),
      winupdate: () => ({kind, A, dur: 30, icon: '💻', title: 'Windows Update is restarting every PC (1 of 37)'}), power: () => powerEvent(A)}[kind];
    if (!e) return 'unknown event'; const ev = e(); if (dur) ev.dur = dur; extra.push(ev); return `${kind} until ${hhmm(ev.A + ev.dur)}`; },
  events(){ const g = gameTime(); return events(g.dayN).map(e => `${DAYS[((Math.floor(e.A/1440) % 5) + 5) % 5]} ${hhmm(e.A)} ${e.kind}${e.dur ? ' (' + e.dur + ' min)' : ''}`); },
};
{ const q = new URLSearchParams(location.search); if (q.get('t')) setTime(q.get('t')); if (q.get('speed')) window.CLOCK.speed(q.get('speed')); }

if (window.GAME && window.GAME.hemi) init(); else addEventListener('game-ready', init, {once: true});
