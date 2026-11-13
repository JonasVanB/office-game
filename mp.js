// Multiplayer: Microsoft sign-in (MSAL), a character per login, and live free roam.
//
// Modes, picked from config.js:
// - Microsoft login + Firebase Realtime Database: the real thing.
// - Local test mode (only on localhost, when config.js is still empty, or with ?local):
//   "sign in" with a test name, and players in other tabs of this browser see each other.
// - On the live site with an empty config.js: multiplayer is off and you walk alone.
import {cleanAvatar, defaultAvatar, buildAvatar, animateAvatar, makeNameTag} from './avatar.js';
import {openCreator, avatarPicture} from './creator.js';
import {play, spatial} from './sound.js';
import {initPostits} from './postit.js';

const CFG = window.OFFICE_CONFIG || {};
const MSAL_URL = 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@3.27.0/+esm';
const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const hasMsal = !!(CFG.msal && CFG.msal.clientId && CFG.msal.tenantId);
const hasFirebase = !!(CFG.firebase && CFG.firebase.databaseURL && CFG.firebase.apiKey);
const LOCAL = isLocalHost && (new URLSearchParams(location.search).has('local') || !hasMsal || !hasFirebase);

const $ = id => document.getElementById(id);
const ui = {mp: $('mp'), status: $('mpStatus'), login: $('msLogin'), me: $('me'), img: $('meImg'), name: $('meName'), edit: $('meEdit'), out: $('meOut'), go: $('go'), online: $('online')};
const status = t => { ui.status.textContent = t; ui.status.style.display = t ? '' : 'none'; };
const whenThree = () => new Promise(r => { if (window.THREE) return r(window.THREE); const t = setInterval(() => { if (window.THREE){ clearInterval(t); r(window.THREE); } }, 50); });
const whenGame = () => new Promise(r => window.GAME ? r(window.GAME) : addEventListener('game-ready', () => r(window.GAME), {once: true}));
const rid = () => Math.random().toString(36).slice(2, 10);

// ---------- sign-in ----------
async function msalAuth(){
  const {PublicClientApplication} = await import(MSAL_URL);
  const here = location.origin + location.pathname;
  const pca = new PublicClientApplication({
    auth: {clientId: CFG.msal.clientId, authority: 'https://login.microsoftonline.com/' + CFG.msal.tenantId, redirectUri: here, postLogoutRedirectUri: here},
    cache: {cacheLocation: 'localStorage'},
  });
  await pca.initialize();
  const res = await pca.handleRedirectPromise().catch(e => { console.warn('MSAL redirect', e); return null; });
  let account = (res && res.account) || pca.getAllAccounts()[0] || null;
  const toUser = a => a && {id: (a.idTokenClaims && a.idTokenClaims.oid) || a.localAccountId, name: (a.name || a.username || '').split(' ')[0], email: a.username};
  const req = {scopes: ['openid', 'profile'], prompt: 'select_account'};
  return {
    user: toUser(account),
    async login(){
      try { const r = await pca.loginPopup(req); account = r.account; return toUser(account); }
      catch (e){ if (/popup_window_error|empty_window_error|block/i.test(e.errorCode || e.message || '')){ await pca.loginRedirect(req); return null; } throw e; }
    },
    async logout(){ try { await pca.logoutPopup({account}); } catch (e){ await pca.logoutRedirect({account}); } },
  };
}

function localAuth(){
  // one test player per tab, so two tabs are two players
  let id = sessionStorage.getItem('office.localId');
  return {
    user: id ? {id, name: ''} : null,
    async login(){ id = 'local-' + rid(); sessionStorage.setItem('office.localId', id); return {id, name: ''}; },
    async logout(){ sessionStorage.removeItem('office.localId'); location.reload(); },
  };
}

// ---------- shared data: profiles + presence ----------
async function firebaseNet(){
  // No Firebase Authentication: the database rules only allow the two game paths, in the expected shape.
  const [{initializeApp}, D] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-database.js')]);
  const app = initializeApp(CFG.firebase), db = D.getDatabase(app);
  let offset = 0; D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  const myKey = 'p' + Date.now().toString(36) + rid(), me = D.ref(db, 'presence/' + myKey);
  let joined = null;
  return {
    myKey, now: () => Date.now() + offset,
    async loadProfile(id){ return (await D.get(D.ref(db, 'profiles/' + id))).val(); },
    async saveProfile(id, p){ await D.set(D.ref(db, 'profiles/' + id), Object.assign({}, p, {updated: D.serverTimestamp()})); },
    async join(data){
      joined = data;
      // (re)announce ourselves on every (re)connect; Firebase removes us when the connection drops
      D.onValue(D.ref(db, '.info/connected'), async s => { if (!s.val() || !joined) return; await D.onDisconnect(me).remove(); await D.set(me, Object.assign({}, joined, {t: D.serverTimestamp()})); });
    },
    send(d){ if (!joined) return; Object.assign(joined, d); D.update(me, Object.assign({}, d, {t: D.serverTimestamp()})); },
    leave(){ joined = null; D.set(me, null); },
    subscribe(cb){ const p = D.ref(db, 'presence'); D.onChildAdded(p, s => cb('add', s.key, s.val())); D.onChildChanged(p, s => cb('change', s.key, s.val())); D.onChildRemoved(p, s => cb('remove', s.key)); },
    // doors/<index> = {o: open?}: shared, so a door someone opens is open for everyone
    setDoor(i, o){ D.set(D.ref(db, 'doors/' + i), {o, t: D.serverTimestamp()}).catch(e => console.warn('door not shared:', e.message)); },
    onDoors(cb){ const p = D.ref(db, 'doors'), f = s => { const v = s.val(); if (v) cb(+s.key, !!v.o); };
      D.onChildAdded(p, f, e => console.warn('doors not shared:', e.message)); D.onChildChanged(p, f); },
    // postits/<user id> = {n, h, z, c, t}: everyone's best post-it on the high-jump wall
    setPostit(id, d){ D.set(D.ref(db, 'postits/' + id), d).catch(e => console.warn('post-it not saved:', e.message)); },
    removePostit(id){ D.remove(D.ref(db, 'postits/' + id)).catch(() => {}); },
    onPostits(cb){ const p = D.ref(db, 'postits');
      D.onChildAdded(p, s => cb(s.key, s.val()), e => console.warn('post-its not loaded:', e.message)); D.onChildChanged(p, s => cb(s.key, s.val())); D.onChildRemoved(p, s => cb(s.key, null)); },
  };
}

function localNet(){
  const bc = new BroadcastChannel('office-mp'), myKey = 'tab_' + rid(); let cb = () => {}, doorCb = () => {}, postitCb = () => {}, mine = null;
  const localPostits = () => { try { return JSON.parse(localStorage.getItem('office.localPostits')) || {}; } catch (e){ return {}; } };
  const savePostits = all => { try { localStorage.setItem('office.localPostits', JSON.stringify(all)); } catch (e){} };
  bc.onmessage = e => { const {type, key, data} = e.data || {}; if (!key || key === myKey) return;
    if (type === 'door') return doorCb(e.data.i, e.data.o);
    if (type === 'postit') return postitCb(e.data.id, e.data.d);
    if (type === 'hello'){ if (mine) bc.postMessage({type: 'state', key: myKey, data: mine}); return; }
    if (type === 'bye') return cb('remove', key);
    if (type === 'state') cb('change', key, data); };
  addEventListener('pagehide', () => bc.postMessage({type: 'bye', key: myKey}));
  return {
    myKey, now: () => Date.now(),
    async loadProfile(id){ try { return JSON.parse(localStorage.getItem('office.localProfile.' + id)); } catch (e){ return null; } },
    async saveProfile(id, p){ try { localStorage.setItem('office.localProfile.' + id, JSON.stringify(p)); } catch (e){} },
    async join(d){ mine = Object.assign({}, d, {t: Date.now()}); bc.postMessage({type: 'state', key: myKey, data: mine}); bc.postMessage({type: 'hello', key: myKey}); },
    send(d){ if (!mine) return; Object.assign(mine, d, {t: Date.now()}); bc.postMessage({type: 'state', key: myKey, data: mine}); },
    leave(){ mine = null; bc.postMessage({type: 'bye', key: myKey}); },
    subscribe(f){ cb = f; },
    setDoor(i, o){ bc.postMessage({type: 'door', key: myKey, i, o}); },
    onDoors(f){ doorCb = f; },
    // post-its: kept in this browser's localStorage, shared with the other tabs
    setPostit(id, d){ const all = localPostits(); all[id] = d; savePostits(all); bc.postMessage({type: 'postit', key: myKey, id, d}); },
    removePostit(id){ const all = localPostits(); delete all[id]; savePostits(all); bc.postMessage({type: 'postit', key: myKey, id, d: null}); },
    onPostits(f){ postitCb = f; const all = localPostits(); for (const id in all) f(id, all[id]); },
  };
}

// ---------- other players in the 3D scene ----------
const remotes = new Map();
let G = null, net = null, postits = null;

function dropRemote(key){
  const r = remotes.get(key); if (!r) return;
  G.scene.remove(r.obj); r.obj.traverse(o => { if (o.material){ if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  remotes.delete(key);
}

let subscribedAt = 0;
function onPresence(type, key, v){
  if (!G || key === net.myKey) return;
  if (type === 'remove' || !v){ const r = remotes.get(key); if (r && joined) logLine('', `${r.name} left`); dropRemote(key); return refreshOnline(); }
  if (typeof v.x !== 'number' || typeof v.z !== 'number') return;
  if (v.t && net.now() - v.t > 120000) return;                         // left without saying goodbye
  const name = String(v.n || 'Colleague').slice(0, 20), av = cleanAvatar(v.a), look = JSON.stringify(av) + '|' + name;
  let r = remotes.get(key);
  if (!r && joined && performance.now() - subscribedAt > 3000){
    // someone new arrived: they step out of the lift next to the entrance
    const s = spatial(30.98, 5.0, v.l || 0, 16); play('lift', s.g, s.p); logLine('', `${name} arrived`);
  }
  if (!r || r.look !== look){
    const keep = r; if (r) dropRemote(key);
    const obj = buildAvatar(G.THREE, av); obj.add(makeNameTag(G.THREE, name)); G.scene.add(obj);
    r = {obj, look, x: keep ? keep.x : v.x, y: keep ? keep.y : (v.y || 0), z: keep ? keep.z : v.z, r: keep ? keep.r : (v.r || 0), ct: keep && keep.ct};
    remotes.set(key, r);
  }
  r.tx = v.x; r.ty = v.y || 0; r.tz = v.z; r.tr = v.r || 0; r.l = v.l || 0; r.name = name; r.color = av.shirt; r.seen = performance.now();
  // a new chat message (c = text, ct = when): bubble above their head and a line in the chat log
  if (v.c && v.ct && v.ct !== r.ct){ r.ct = v.ct; if (net.now() - v.ct < 15000) showChat(r, name, String(v.c).slice(0, MAXCHAT)); }
  refreshOnline();
}

// ---------- chat ----------
const MAXCHAT = 120;
const CHAT_CSS = `
#chatLog{position:fixed;left:10px;bottom:50px;max-width:min(420px,72vw);display:flex;flex-direction:column;align-items:flex-start;gap:4px;pointer-events:none;z-index:2}
#chatLog div{background:rgba(20,24,30,.62);color:#fff;border-radius:10px;padding:5px 10px;font-size:13px;line-height:1.35;transition:opacity .8s;word-break:break-word}
#chatLog div.sys{background:rgba(20,24,30,.4);font-style:italic}
#chatLog b{font-weight:600}
#chatBar{position:fixed;left:50%;bottom:50px;transform:translateX(-50%);width:min(520px,calc(100vw - 32px));display:none;z-index:6}
#chatBar input{width:100%;box-sizing:border-box;font-size:16px;padding:10px 12px;border-radius:10px;border:2px solid #2f5d9e;background:rgba(255,255,255,.96);color:#1d2229;outline:none}
.tbtn{position:fixed;right:18px;width:56px;height:56px;border-radius:50%;background:rgba(20,24,30,.45);border:2px solid rgba(255,255,255,.6);color:#fff;font-size:22px;display:none;align-items:center;justify-content:center;z-index:2;-webkit-user-select:none;user-select:none;touch-action:none}
`;
let chatLog, chatBar, chatIn, lastChat = 0;
function chatUI(){
  const st = document.createElement('style'); st.textContent = CHAT_CSS; document.head.appendChild(st);
  chatLog = document.createElement('div'); chatLog.id = 'chatLog'; document.body.appendChild(chatLog);
  chatBar = document.createElement('div'); chatBar.id = 'chatBar';
  chatBar.innerHTML = `<input type="text" maxlength="${MAXCHAT}" placeholder="Say something… (Enter to send, Esc to cancel)" autocomplete="off" enterkeyhint="send" aria-label="Chat message">`;
  document.body.appendChild(chatBar); chatIn = chatBar.querySelector('input');
  chatIn.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter'){ e.preventDefault(); sendChat(chatIn.value); closeChat(); }
    else if (e.key === 'Escape'){ e.preventDefault(); closeChat(); }
  });
  chatIn.addEventListener('blur', () => setTimeout(closeChat, 0));
  addEventListener('keydown', e => {
    const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyT') && !e.repeat && joined && G.state.started){ e.preventDefault(); openChat(); }
  });
  // touch screens: round buttons for chat and jumping
  if (window.__isTouch){
    for (const [id, label, bottom, fn] of [['jumpBtn', '⤒', 96, () => G.jump && G.jump()], ['chatBtn', '💬', 162, () => joined && openChat()]]){
      const b = document.createElement('div'); b.id = id; b.className = 'tbtn'; b.textContent = label; b.style.bottom = bottom + 'px';
      b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }); document.body.appendChild(b);
    }
  }
}
function openChat(){ if (chatBar.style.display === 'block') return; chatBar.style.display = 'block'; chatIn.value = ''; chatIn.focus(); }
function closeChat(){ if (chatBar.style.display !== 'block') return; chatBar.style.display = 'none'; chatIn.blur(); }
function sendChat(text){
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAXCHAT); const now = performance.now();
  if (!text || !joined || now - lastChat < 700) return; lastChat = now;
  net.send({c: text, ct: net.now()}); logLine(profile.name, text); play('pop', 0.4);
}
function logLine(name, text){
  if (!chatLog) return;
  const d = document.createElement('div');
  if (name){ const b = document.createElement('b'); b.textContent = name + ': '; d.append(b, text); } else { d.className = 'sys'; d.textContent = text; }
  chatLog.appendChild(d); while (chatLog.children.length > 6) chatLog.firstChild.remove();
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 900); }, 20000);
}
function showChat(r, name, text){
  logLine(name, text);
  if (r.bubble){ r.obj.remove(r.bubble); r.bubble.material.map.dispose(); r.bubble.material.dispose(); }
  r.bubble = makeBubble(G.THREE, text); r.obj.add(r.bubble); r.bubbleUntil = performance.now() + 6000 + text.length*60;
  const s = spatial(r.x, r.z, r.l || 0, 20); play('pop', Math.max(0.15, s.g)*0.6, s.p);
}
// speech bubble sprite above an avatar's name tag
function makeBubble(THREE, text){
  const c = document.createElement('canvas'), g = c.getContext('2d'), W = 512, F = 30, PAD = 18, MAXW = W - PAD*2, font = `500 ${F}px system-ui,Segoe UI,sans-serif`;
  g.font = font; const fit = s => { while (s.length > 1 && g.measureText(s).width > MAXW) s = s.slice(0, -1); return s; };
  const lines = []; let line = '';
  for (const w of text.split(' ')){ const t = line ? line + ' ' + w : w; if (g.measureText(t).width > MAXW && line){ lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  for (let i = 0; i < lines.length; i++) lines[i] = fit(lines[i]);
  if (lines.length > 4){ lines.length = 4; lines[3] = fit(lines[3] + '…'); }
  const tw = Math.max(...lines.map(l => g.measureText(l).width)), bw = Math.min(W - 4, tw + PAD*2), lh = F*1.25, bh = lines.length*lh + PAD*1.2;
  c.width = W; c.height = Math.ceil(bh + 24); g.font = font;
  const x0 = (W - bw)/2, r = 18;
  g.fillStyle = 'rgba(255,255,255,0.96)'; g.beginPath();
  g.moveTo(x0 + r, 2); g.arcTo(x0 + bw, 2, x0 + bw, bh, r); g.arcTo(x0 + bw, bh, x0, bh, r); g.arcTo(x0, bh, x0, 2, r); g.arcTo(x0, 2, x0 + bw, 2, r); g.fill();
  g.beginPath(); g.moveTo(W/2 - 14, bh - 1); g.lineTo(W/2, bh + 20); g.lineTo(W/2 + 14, bh - 1); g.fill();
  g.fillStyle = '#1d2229'; g.textBaseline = 'top'; lines.forEach((l, i) => g.fillText(l, x0 + PAD, PAD*0.6 + i*lh));
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: t, depthWrite: false, transparent: true}));
  const k = 1.7/W; sp.scale.set(W*k, c.height*k, 1); sp.center.set(0.5, 0); sp.position.y = 2.24; sp.renderOrder = 2;
  return sp;
}

// ---------- shared doors ----------
const pendingClose = new Set();
function insideDoor(d){ const c = d.rect, s = G.state, R = 0.3; return s.x > c[0]-R && s.x < c[1]+R && s.z > c[2]-R && s.z < c[3]+R; }
function applyDoor(i, open){
  const d = G && G.doors && G.doors[i]; if (!d) return;
  if (open){ pendingClose.delete(i); d.target = G.DOOR_OPEN; }
  else if (insideDoor(d)) pendingClose.add(i);   // you stand in the doorway: it closes once you step out
  else d.target = 0;
}

function refreshOnline(){
  const names = [...remotes.values()].map(r => r.name);
  ui.online.style.display = joined ? 'block' : 'none';
  ui.online.textContent = names.length ? `${names.length + 1} online` : 'Only you online';
  ui.online.title = names.join(', ');
}

let joined = false, lastSent = 0, lastBeat = 0, sent = null;
function tick(dt){
  const now = performance.now(), k = 1 - Math.exp(-dt*12);
  for (const [key, r] of remotes){
    if (now - r.seen > 45000){ dropRemote(key); refreshOnline(); continue; }
    const ox = r.x, oz = r.z;
    r.x += (r.tx - r.x)*k; r.y += (r.ty - r.y)*k; r.z += (r.tz - r.z)*k;
    let d = r.tr - r.r; d = Math.atan2(Math.sin(d), Math.cos(d)); r.r += d*k;
    const moved = Math.hypot(r.x - ox, r.z - oz), sp = dt > 0 ? moved/dt : 0;
    r.walk = (r.walk || 0) + ((sp > 0.3 ? 1 : 0) - (r.walk || 0))*Math.min(1, dt*8);
    r.obj.position.set(r.x, r.y, r.z); r.obj.rotation.y = r.r;
    // someone standing right where you stand (e.g. both just spawned) would fill your whole view: hide them until you step apart
    r.obj.visible = !(Math.hypot(r.x - G.state.x, r.z - G.state.z) < 0.7 && Math.abs(r.y - G.state.y) < 1);
    animateAvatar(r.obj, moved*5.5, r.walk);
    if (r.bubble && now > r.bubbleUntil){ r.obj.remove(r.bubble); r.bubble.material.map.dispose(); r.bubble.material.dispose(); r.bubble = null; }
  }
  if (postits) postits.update();
  for (const i of pendingClose){ const d = G.doors[i]; if (!d || !insideDoor(d)){ if (d) d.target = 0; pendingClose.delete(i); } }
  if (!joined) return;
  const s = G.state, round = n => Math.round(n*100)/100;
  const cur = {x: round(s.x), y: round(s.y), z: round(s.z), r: round(s.yaw), l: s.lv};
  const changed = !sent || Math.abs(cur.x - sent.x) > 0.02 || Math.abs(cur.z - sent.z) > 0.02 || Math.abs(cur.y - sent.y) > 0.02 || Math.abs(cur.r - sent.r) > 0.03 || cur.l !== sent.l;
  if ((changed && now - lastSent > 110) || now - lastBeat > 15000){ net.send(cur); sent = cur; lastSent = lastBeat = now; }
}

function drawMapExtra(ctx, PAD, MS, level){
  for (const r of remotes.values()){
    if ((r.l || 0) !== level) continue;
    ctx.fillStyle = r.color || '#2f5d9e'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(PAD + r.x*MS, PAD + r.z*MS, 3.6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  }
}

// ---------- start card flow ----------
let auth = null, user = null, profile = null;

async function showProfile(){
  const THREE = await whenThree();
  ui.login.style.display = 'none';
  ui.me.style.display = 'flex'; ui.name.textContent = profile.name; ui.img.src = avatarPicture(THREE, profile.avatar);
  status(LOCAL ? 'Local test mode: open a second tab to see another player.' : '');
  ui.go.style.display = ''; ui.go.textContent = 'Start walking';
}

async function editCharacter(first){
  const THREE = await whenThree();
  const res = await openCreator(THREE, {name: profile ? profile.name : (user.name || ''), avatar: profile ? profile.avatar : defaultAvatar(), title: first ? 'Create your character' : 'Edit your character', canCancel: !first});
  if (!res) return;
  profile = res;
  try { localStorage.setItem('office.profile.' + user.id, JSON.stringify(profile)); } catch (e){}
  status('Saving…');
  try { await net.saveProfile(user.id, profile); } catch (e){ console.warn(e); status('Could not save your character online; it is kept on this device.'); }
  await showProfile();
  if (joined) net.send({n: profile.name, a: profile.avatar});
}

async function afterLogin(){
  status('Loading your character…');
  let p = null;
  try { p = await net.loadProfile(user.id); } catch (e){ console.warn(e); }
  if (!p){ try { p = JSON.parse(localStorage.getItem('office.profile.' + user.id)); } catch (e){} }
  if (p && p.name){ profile = {name: String(p.name).slice(0, 20), avatar: cleanAvatar(p.avatar)}; await showProfile(); }
  else { status(''); await editCharacter(true); }
}

async function main(){
  ui.mp.style.display = '';
  if (!LOCAL && !(hasMsal && hasFirebase)){ status('Multiplayer is not set up yet. You can walk around on your own.'); return; }
  ui.go.style.display = 'none';
  status('Connecting…');
  try { [auth, net] = await Promise.all([LOCAL ? localAuth() : msalAuth(), LOCAL ? localNet() : firebaseNet()]); window.__serverNow = net.now; }   // clock.js: same game time for everyone
  catch (e){ console.error(e); status('Could not connect to multiplayer. You can walk around on your own.'); ui.go.style.display = ''; return; }

  G = await whenGame();
  chatUI();
  subscribedAt = performance.now(); net.subscribe(onPresence);
  net.onDoors(applyDoor);
  window.__onDoor = (i, open) => { if (i >= 0) net.setDoor(i, open); };
  postits = initPostits({G, net, me: () => joined && user && profile ? {id: user.id, name: profile.name} : null});
  window.__onFrame = tick; window.__drawMapExtra = drawMapExtra;

  ui.login.querySelector('span').textContent = LOCAL ? 'Sign in (local test)' : 'Sign in with Microsoft';
  ui.login.onclick = async () => {
    ui.login.disabled = true; status(LOCAL ? '' : 'Signing in…');
    try { const u = await auth.login(); if (u){ user = u; await afterLogin(); } }
    catch (e){ console.warn(e); status('Sign-in did not work. Please try again.'); }
    ui.login.disabled = false;
  };
  ui.edit.onclick = e => { e.preventDefault(); editCharacter(false); };
  ui.out.onclick = async e => { e.preventDefault(); if (joined) net.leave(); await auth.logout(); };

  user = auth.user;
  if (user) await afterLogin();
  else { status(''); ui.login.style.display = ''; }
}

addEventListener('office-start', () => {
  if (!net || !profile || joined) return;
  joined = true;
  const s = G.state;
  net.join({n: profile.name, a: profile.avatar, x: s.x, y: s.y, z: s.z, r: s.yaw, l: s.lv});
  refreshOnline();
  for (const b of document.querySelectorAll('.tbtn')) b.style.display = 'flex';
});
addEventListener('pagehide', () => { if (net && joined) net.leave(); });

main();
