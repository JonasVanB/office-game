// Multiplayer: Microsoft sign-in (MSAL), a character per login, and live free roam.
//
// Modes, picked from config.js:
// - Microsoft login + Firebase Realtime Database: the real thing.
// - Local test mode (only on localhost, when config.js is still empty, or with ?local):
//   "sign in" with a test name, and players in other tabs of this browser see each other.
// - On the live site with an empty config.js: multiplayer is off and you walk alone.
import {cleanAvatar, defaultAvatar, buildAvatar, animateAvatar, makeNameTag} from './avatar.js';
import {openCreator, avatarPicture} from './creator.js';

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
  };
}

function localNet(){
  const bc = new BroadcastChannel('office-mp'), myKey = 'tab_' + rid(); let cb = () => {}, mine = null;
  bc.onmessage = e => { const {type, key, data} = e.data || {}; if (!key || key === myKey) return;
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
  };
}

// ---------- other players in the 3D scene ----------
const remotes = new Map();
let G = null, net = null;

function dropRemote(key){
  const r = remotes.get(key); if (!r) return;
  G.scene.remove(r.obj); r.obj.traverse(o => { if (o.material){ if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  remotes.delete(key);
}

function onPresence(type, key, v){
  if (!G || key === net.myKey) return;
  if (type === 'remove' || !v){ dropRemote(key); return refreshOnline(); }
  if (typeof v.x !== 'number' || typeof v.z !== 'number') return;
  if (v.t && net.now() - v.t > 120000) return;                         // left without saying goodbye
  const name = String(v.n || 'Colleague').slice(0, 20), av = cleanAvatar(v.a), look = JSON.stringify(av) + '|' + name;
  let r = remotes.get(key);
  if (!r || r.look !== look){
    const keep = r; if (r) dropRemote(key);
    const obj = buildAvatar(G.THREE, av); obj.add(makeNameTag(G.THREE, name)); G.scene.add(obj);
    r = {obj, look, x: keep ? keep.x : v.x, y: keep ? keep.y : (v.y || 0), z: keep ? keep.z : v.z, r: keep ? keep.r : (v.r || 0)};
    remotes.set(key, r);
  }
  r.tx = v.x; r.ty = v.y || 0; r.tz = v.z; r.tr = v.r || 0; r.l = v.l || 0; r.name = name; r.color = av.shirt; r.seen = performance.now();
  refreshOnline();
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
  }
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
  try { [auth, net] = await Promise.all([LOCAL ? localAuth() : msalAuth(), LOCAL ? localNet() : firebaseNet()]); }
  catch (e){ console.error(e); status('Could not connect to multiplayer. You can walk around on your own.'); ui.go.style.display = ''; return; }

  G = await whenGame();
  net.subscribe(onPresence);
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
});
addEventListener('pagehide', () => { if (net && joined) net.leave(); });

main();
