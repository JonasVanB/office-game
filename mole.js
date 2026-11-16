// The Mole: a social deduction game for 5–10 players in the west wing of the 3e verdiep (an original office version of the
// hidden-role genre). Most players are loyal Developers; a few are secret Saboteurs, and one of them is the Mole.
// Each round the Scrum Master nominates a Tech Lead and everybody votes. If the team is approved, the Scrum Master draws
// three cards (✅ Feature / 🐛 Bug), discards one, and the Tech Lead ships one of the other two.
// Developers win with 5 Features or by firing the Mole. Saboteurs win with 6 Bugs, or when the Mole is elected Tech Lead
// after 3 Bugs. Bugs unlock Scrum Master powers: code review (investigate), peek at the backlog, emergency stand-up
// (pick the next Scrum Master) and fire someone. Three failed votes in a row: a chaos deploy ships the top card.
//
// Enter through the closed double door from the 3e Entrance (E). Before a game you join as a player (max 10); during a game
// you watch as a spectator. The first player to enter hosts: their browser runs the game and shares it through presence
// (mg = public state, mk = private notes per player, lightly scrambled). Players send their choices as ma = {s, g, t, v}.
// Choose with the number keys (or tap on a phone). R shows your role again. V: a villain pose, for fun, anywhere.
import {sound, play, spatial} from './sound.js';

const LO = -3.06, ROOM = {x0: 0.3, x1: 27.7, z0: 0.3, z1: 12.7};
const DOOR = {x: 28, z: 6.5}, IN = [26.9, 6.5], OUT = [29.3, 6.5];
const MIN = 5, MAX = 10, BOARD = {x: 13, fz: 4.1, bz: 9.0, tz: 6.55};
const TEAMS = {5: 1, 6: 1, 7: 2, 8: 2, 9: 3, 10: 3};   // saboteurs besides the Mole
const POWERS = n => n <= 6 ? [null, null, 'peek', 'fire', 'fire'] : n <= 8 ? [null, 'review', 'standup', 'fire', 'fire'] : ['review', 'review', 'standup', 'fire', 'fire'];
const PNAME = {review: '🔍 Code review: look at one player’s loyalty', peek: '👀 Peek at the backlog: the next 3 cards', standup: '📣 Emergency stand-up: pick the next Scrum Master', fire: '💀 Fire a player'};
const ROLE = {dev: {icon: '👩‍💻', name: 'Developer', team: 'Developers', col: '#2f5d9e', goal: 'Ship 5 Features, or find and fire the Mole.'},
  sab: {icon: '🦹', name: 'Saboteur', team: 'Saboteurs', col: '#c0392b', goal: 'Ship 6 Bugs, or get the Mole elected Tech Lead after 3 Bugs. Protect the Mole.'},
  mole: {icon: '🕵️', name: 'The Mole', team: 'Saboteurs', col: '#6a1b9a', goal: 'Stay hidden. Get elected Tech Lead after 3 Bugs and the Saboteurs win.'}};
const isTouch = () => !!window.__isTouch;
const now = () => window.__serverNow ? window.__serverNow() : Date.now();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.random()*(i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
// private notes: lightly scrambled with the receiver's key (enough to stop peeking at a glance, not a real secret)
function enc(obj, key){ const s = unescape(encodeURIComponent(JSON.stringify(obj))); let o = ''; for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length)); return btoa(o); }
function dec(str, key){ try { const s = atob(str); let o = ''; for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length)); return JSON.parse(decodeURIComponent(escape(o))); } catch (e){ return null; } }

let G, THREE, me = null, joinedAt = 0, host = null, hostPriv = {}, seqOut = 0, seen = {}, effectsSeen = 0, myRoleShown = '', bots = [];
let hud, card, roleCard, flash, doorSign, boards, sprites = {}, lastSign = '', lastBoards = '', villainAt = 0;
const send = d => { if (window.__mpSend) window.__mpSend(d); };
const myKey = () => window.__myKey ? window.__myKey() : 'me';
const myName = () => { try { return (window.__myAvatar && document.getElementById('meName').textContent) || 'You'; } catch (e){ return 'You'; } };
const el = (tag, css, parent) => { const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; };

// ---------- who is in the room ----------
const inRoom = s => s.lv === 2 && s.x < 28 && s.x > 0 && s.z > 0 && s.z < 13;
function people(){
  const out = [], t = performance.now();
  for (const r of (window.__mpRemotes ? window.__mpRemotes() : [])) if (r.mr && t - r.seen < 20000 && r.l === 2 && r.x < 28) out.push({key: r.key, name: r.name, mr: r.mr, mj: r.mj, ma: r.ma, mg: r.mg, mk: r.mk, x: r.x, y: r.y, z: r.z});
  if (me) out.push({key: myKey(), name: myName(), mr: me, mj: joinedAt, self: true, mg: host, mk: hostPriv, x: G.state.x, y: G.state.y, z: G.state.z});
  for (const b of bots) out.push(b);
  return out;
}
function currentHost(ps){
  // a running game belongs to the host who started it; otherwise the player who has been in the room longest
  const withGame = ps.filter(p => p.mg && p.mg.ph && p.mg.ph !== 'none'); if (withGame.length) return withGame.sort((a, b) => a.mj - b.mj)[0];
  const pl = ps.filter(p => p.mr === 'p' && !p.bot).sort((a, b) => a.mj - b.mj); return pl[0] || null;
}

// ---------- the host runs the game ----------
function startGame(ps){
  const players = shuffle(ps.filter(p => p.mr === 'p')).slice(0, MAX), n = players.length; if (n < MIN) return;
  const roles = shuffle(['mole', ...Array(TEAMS[n]).fill('sab'), ...Array(n - 1 - TEAMS[n]).fill('dev')]);
  const id = Math.floor(Math.random()*1e9).toString(36);
  host = {id, ph: 'nominate', order: players.map(p => p.key), names: Object.fromEntries(players.map(p => [p.key, p.name])), pres: Math.random()*n | 0, chanc: null,
    lastP: null, lastC: null, votes: {}, voted: {}, fe: 0, bu: 0, tr: 0, alive: Object.fromEntries(players.map(p => [p.key, 1])), power: null, ev: {n: 1, k: 'start', text: '🕵️ The Mole begins! Check your role card'},
    special: null, resume: null, reviewed: {}, winner: null, why: '', roles: null, deckN: 17, log: []};
  hostPriv = {}; const R = {}; players.forEach((p, i) => { R[p.key] = roles[i]; });
  hostPriv._roles = R; hostPriv._deck = shuffle([...Array(6).fill('F'), ...Array(11).fill('B')]); hostPriv._disc = []; hostPriv._seq = {}; hostPriv._hand = null;
  const sabs = players.filter(p => R[p.key] !== 'dev').map(p => ({key: p.key, name: p.name, role: R[p.key]}));
  for (const p of players){
    const r = R[p.key], team = r === 'sab' || (r === 'mole' && n <= 6) ? sabs.filter(s => s.key !== p.key) : [];
    note(p.key, {role: r, team});
  }
  publish();
}
function note(key, data){ hostPriv[key] = Object.assign(hostPriv[key] ? (dec(hostPriv[key], key + host.id) || {}) : {}, data); hostPriv[key] = enc(hostPriv[key], key + host.id); }
function publishable(){ const mk = {}; for (const k in hostPriv) if (k[0] !== '_') mk[k] = hostPriv[k]; return mk; }
let pubT = 0, dirty = false;
function publish(){ pubT = performance.now(); dirty = false; send({mg: host, mk: publishable()}); }
const aliveKeys = () => host.order.filter(k => host.alive[k]);
const keyAt = i => host.order[i];
function nextAlive(i){ const n = host.order.length; for (let j = 1; j <= n; j++){ const k = (i + j) % n; if (host.alive[host.order[k]]) return k; } return i; }
function eligible(k){ const g = host; if (!g.alive[k] || k === keyAt(g.pres) || k === g.lastC) return false; if (k === g.lastP && aliveKeys().length > 5) return false; return true; }
function event(k, text, extra){ dirty = true; host.ev =Object.assign({n: (host.ev ? host.ev.n : 0) + 1, k, text}, extra || {}); host.log = [text, ...(host.log || [])].slice(0, 6); }
function draw3(){ const P = hostPriv; if (P._deck.length < 3){ P._deck = shuffle([...P._deck, ...P._disc]); P._disc = []; } const h = P._deck.splice(0, 3); host.deckN = P._deck.length; return h; }
function win(team, why){ const g = host; g.ph = 'over'; g.winner = team; g.why = why; g.roles = hostPriv._roles; event(team === 'dev' ? 'devwin' : 'sabwin', (team === 'dev' ? '👩‍💻 The Developers win! ' : '🦹 The Saboteurs win! ') + why); }
function enact(card, chaos){
  const g = host;
  if (card === 'F'){ g.fe++; event('feature', `✅ Feature shipped! (${g.fe}/5)`); if (g.fe >= 5) return win('dev', 'Five Features shipped.'); }
  else { g.bu++; event('bug', `🐛 Bug shipped! (${g.bu}/6)`); if (g.bu >= 6) return win('sab', 'Six Bugs shipped.');
    const pw = !chaos && POWERS(g.order.length)[g.bu - 1]; if (pw){ g.power = pw; g.ph = 'power';
      if (pw === 'peek'){ const P = hostPriv; if (P._deck.length < 3){ P._deck = shuffle([...P._deck, ...P._disc]); P._disc = []; } note(keyAt(g.pres), {peek: P._deck.slice(0, 3)}); }
      return; } }
  nextRound();
}
function nextRound(){
  const g = host; g.power = null; g.chanc = null; g.votes = {}; g.voted = {};
  if (g.special != null){ g.resume = g.pres; g.pres = g.special; g.special = null; }
  else if (g.resume != null){ g.pres = nextAlive(g.resume); g.resume = null; }
  else g.pres = nextAlive(g.pres);
  g.ph = 'nominate';
}
function act(from, t, v){
  const g = host; if (!g || g.ph === 'over' || !g.alive[from]) return;
  dirty = true; const pres = keyAt(g.pres);
  if (g.ph === 'nominate' && t === 'nom' && from === pres && eligible(v)){ g.chanc = v; g.ph = 'vote'; g.votes = {}; g.voted = {}; event('nominate', `👑 ${g.names[pres]} nominates ${g.names[v]} as Tech Lead. Vote!`); }
  else if (g.ph === 'vote' && t === 'vote' && !(from in g.voted)){
    g.voted[from] = 1; hostPriv._v = hostPriv._v || {}; hostPriv._v[from] = v ? 1 : 0;
    if (aliveKeys().every(k => k in g.voted)){
      g.votes = Object.assign({}, hostPriv._v); hostPriv._v = {}; const yes = Object.values(g.votes).filter(x => x).length, pass = yes > aliveKeys().length/2;
      if (pass){
        g.tr = 0; g.lastP = pres; g.lastC = g.chanc;
        if (g.bu >= 3 && hostPriv._roles[g.chanc] === 'mole') return win('sab', `The Mole (${g.names[g.chanc]}) was elected Tech Lead after 3 Bugs.`);
        event('elected', `🗳️ Approved ${yes}–${aliveKeys().length - yes}. ${g.names[pres]} reviews the backlog…`, {votes: g.votes});
        hostPriv._hand = draw3(); note(pres, {hand: hostPriv._hand, handFor: g.ev.n}); g.ph = 'pres';
      } else {
        g.tr++; event('rejected', `❌ Rejected ${yes}–${aliveKeys().length - yes}. Failed sprints: ${g.tr}/3`, {votes: g.votes});
        if (g.tr >= 3){ g.tr = 0; g.lastP = g.lastC = null; const c = draw3(); const top = c.shift(); hostPriv._deck.unshift(...c); host.deckN = hostPriv._deck.length; event('chaos', '🌪️ Three failed sprints: CHAOS DEPLOY! The top card ships…'); return enact(top, true); }
        nextRound();
      }
    }
  }
  else if (g.ph === 'pres' && t === 'discard' && from === pres && hostPriv._hand && v >= 0 && v < 3){
    const h = hostPriv._hand; hostPriv._disc.push(h.splice(v, 1)[0]); note(g.chanc, {hand2: h, handFor: g.ev.n}); note(pres, {hand: null});
    g.ph = 'chanc'; event('passed', `📤 ${g.names[pres]} passes two cards to ${g.names[g.chanc]}…`);
  }
  else if (g.ph === 'chanc' && t === 'ship' && from === g.chanc && hostPriv._hand && v >= 0 && v < 2){
    const h = hostPriv._hand; const card = h.splice(v, 1)[0]; hostPriv._disc.push(...h); hostPriv._hand = null; note(g.chanc, {hand2: null}); enact(card, false);
  }
  else if (g.ph === 'power' && from === pres){
    if (g.power === 'peek' && t === 'ok'){ nextRound(); }
    else if (g.power === 'review' && t === 'pick' && v !== pres && g.alive[v] && !g.reviewed[v]){
      g.reviewed[v] = 1; note(pres, {review: {key: v, name: g.names[v], team: hostPriv._roles[v] === 'dev' ? 'dev' : 'sab', at: g.ev.n + 1}}); event('review', `🔍 ${g.names[pres]} did a code review on ${g.names[v]}.`); nextRound();
    }
    else if (g.power === 'standup' && t === 'pick' && v !== pres && g.alive[v]){ g.special = g.order.indexOf(v); event('standup', `📣 Emergency stand-up! ${g.names[v]} will be the next Scrum Master.`); nextRound(); }
    else if (g.power === 'fire' && t === 'pick' && v !== pres && g.alive[v]){
      g.alive[v] = 0; event('fired', `💀 ${g.names[pres]} fired ${g.names[v]}!`, {who: v});
      if (hostPriv._roles[v] === 'mole') return win('dev', `${g.names[v]} was the Mole and got fired.`);
      nextRound();
    }
  }
}
function hostStep(ps){
  const g = host;
  if (g && g.ph !== 'over'){
    // a player left the room: the game stops
    const present = new Set(ps.map(p => p.key)); const gone = g.order.find(k => g.alive[k] && !present.has(k));
    if (gone){ g.ph = 'over'; g.winner = null; g.why = `${g.names[gone]} left the room. Game over.`; g.roles = hostPriv._roles; event('abort', '🚪 ' + g.why); publish(); return; }
    // players' choices
    for (const p of ps){ if (!p.ma || p.self || p.bot) continue; const a = p.ma; if (a.g !== g.id) continue; if ((hostPriv._seq[p.key] || 0) >= a.s) continue; hostPriv._seq[p.key] = a.s; act(p.key, a.t, a.v); }
    for (const b of bots) botStep(b);
  }
  if ((dirty && performance.now() - pubT > 120) || performance.now() - pubT > 900) publish();
}
// ---------- test bots (MOLE.bots(4) in the console, local only) ----------
function botStep(b){
  const g = host; if (!g || g.ph === 'over' || !g.alive[b.key] || performance.now() < (b.next || 0)) return; b.next = performance.now() + 600 + Math.random()*900;
  const pres = keyAt(g.pres), opts = aliveKeys();
  if (g.ph === 'nominate' && pres === b.key) act(b.key, 'nom', opts.filter(eligible)[Math.random()*opts.filter(eligible).length | 0]);
  else if (g.ph === 'vote' && !(b.key in g.voted)) act(b.key, 'vote', Math.random() < 0.65 ? 1 : 0);
  else if (g.ph === 'pres' && pres === b.key) act(b.key, 'discard', Math.random()*3 | 0);
  else if (g.ph === 'chanc' && g.chanc === b.key) act(b.key, 'ship', Math.random()*2 | 0);
  else if (g.ph === 'power' && pres === b.key) act(b.key, g.power === 'peek' ? 'ok' : 'pick', opts.filter(k => k !== b.key)[Math.random()*(opts.length - 1) | 0]);
}

// ---------- your choices ----------
function choose(t, v){
  const g = game(); if (!g) return;
  if (host && g === host) act(myKey(), t, v); else { seqOut++; send({ma: {s: seqOut, g: g.id, t, v}}); }
  answered.add(decisionKey); card.style.display = 'none'; decisionKey = '';
}
let decisionKey = '', options = [], decisionT = '';
const answered = new Set();   // choices already sent: don't show them again while the host's update is on its way
function decision(g, priv){
  const k = myKey(), pres = g.order[g.pres]; if (!g.alive[k] || g.ph === 'over') return null;
  if (g.ph === 'nominate' && pres === k) return {key: 'nom' + g.ev.n, title: '👑 You are Scrum Master', text: 'Nominate a Tech Lead:', t: 'nom', opts: g.order.filter(x => g.alive[x] && x !== pres && x !== g.lastC && !(x === g.lastP && g.order.filter(y => g.alive[y]).length > 5)).map(x => [x, g.names[x]])};
  if (g.ph === 'vote' && !(k in g.voted) && !(k in (g.votes || {}))) return {key: 'vote' + g.ev.n, title: '🗳️ Vote', text: `Scrum Master <b>${esc(g.names[pres])}</b> + Tech Lead <b>${esc(g.names[g.chanc])}</b>?`, t: 'vote', opts: [[1, '👍 Ship it (yes)'], [0, '👎 Nope (no)']]};
  if (g.ph === 'pres' && pres === k && priv && priv.hand) return {key: 'pres' + g.ev.n, title: '🗂️ The backlog', text: 'You drew 3 cards. Choose one to <b>discard</b>; the Tech Lead gets the other two:', t: 'discard', opts: priv.hand.map((c, i) => [i, c === 'F' ? '✅ Feature' : '🐛 Bug'])};
  if (g.ph === 'chanc' && g.chanc === k && priv && priv.hand2) return {key: 'ch' + g.ev.n, title: '🛠️ You are Tech Lead', text: 'Choose the card to <b>ship</b>:', t: 'ship', opts: priv.hand2.map((c, i) => [i, c === 'F' ? '✅ Ship the Feature' : '🐛 Ship the Bug'])};
  if (g.ph === 'power' && pres === k){
    if (g.power === 'peek') return {key: 'pk' + g.ev.n, title: '👀 Peek at the backlog', text: 'The next 3 cards are on your screen. Tell the others… or lie.', t: 'ok', opts: [[1, 'OK']], peek: true};
    const others = g.order.filter(x => g.alive[x] && x !== k && !(g.power === 'review' && g.reviewed[x]));
    return {key: 'pw' + g.ev.n, title: PNAME[g.power], text: 'Choose a player:', t: 'pick', opts: others.map(x => [x, g.names[x]])};
  }
  return null;
}
function showDecision(d, peekCards){
  if (d){ const g = game(); d.key = (g ? g.id : '') + ':' + d.key; }   // unique per game, so a new game never looks "already answered"
  if (d && answered.has(d.key)) d = null;
  if (!d){ if (decisionKey){ card.style.display = 'none'; decisionKey = ''; } return; }
  if (d.key === decisionKey) return; decisionKey = d.key; options = d.opts; decisionT = d.t;
  card.innerHTML = `<div style="font-size:18px;font-weight:700;margin-bottom:4px">${d.title}</div><div style="color:#454b55;margin-bottom:6px">${d.text}</div>`
    + (d.peek && peekCards ? `<div style="font-size:24px;margin:6px 0">${peekCards.map(c => c === 'F' ? '✅' : '🐛').join(' ')}</div>` : '');
  d.opts.forEach(([v, label], i) => { const b = el('button', `display:block;width:100%;margin-top:6px;padding:10px;border:0;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;background:${label.includes('🐛') ? '#fbe3e1' : label.includes('✅') || label.includes('👍') ? '#e3f4e6' : '#eef1f5'};color:#1d2229;text-align:left`, card);
    b.textContent = `${isTouch() ? '' : (i + 1) + ' · '}${label}`; const go = e => { e.preventDefault(); e.stopPropagation(); choose(d.t, v); }; b.addEventListener('click', go); b.addEventListener('touchend', go); });
  card.style.display = 'block'; play('ding', 0.6, 0);
}

// ---------- the room: door sign, floor boards, effects ----------
function tex(w, h, drawFn){ const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return {c, g: c.getContext('2d'), t, redraw(){ drawFn(this.g, w, h); this.t.needsUpdate = true; }}; }
function buildRoom(){
  // the lobby sign on the door (Entrance side, facing +x) and a copy inside
  const sign = tex(512, 320, () => {});
  for (const [x, ry] of [[28.075, Math.PI/2], [27.925, -Math.PI/2]]){ const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5625), new THREE.MeshBasicMaterial({map: sign.t})); m.position.set(x, LO + 1.55, 6.5); m.rotation.y = ry; G.scene.add(m); }
  doorSign = sign;
  // the giant boards on the floor
  const mk = (w, d, z) => { const T = tex(Math.round(w*90), Math.round(d*90), () => {}); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({map: T.t, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2}));
    m.rotation.x = -Math.PI/2; m.position.set(BOARD.x, LO + 0.012, z); G.scene.add(m); return T; };
  boards = {fe: mk(11, 2.6, BOARD.fz), bu: mk(13, 2.6, BOARD.bz), tr: mk(5, 1.2, BOARD.tz)};
  // a big title on the end wall
  const title = tex(1024, 256, g => { g.fillStyle = '#1d2229'; g.fillRect(0, 0, 1024, 256); g.fillStyle = '#f2c230'; g.font = '800 120px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🕵️ THE MOLE', 512, 110); g.fillStyle = '#cfd6df'; g.font = '500 40px system-ui,sans-serif'; g.fillText('Developers vs Saboteurs · 5–10 players', 512, 205); });
  title.redraw(); const tm = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({map: title.t})); tm.position.set(0.05, LO + 1.9, 6.5); tm.rotation.y = Math.PI/2; G.scene.add(tm);
}
function drawSign(ps){
  const g = game(), players = ps.filter(p => p.mr === 'p').length, spect = ps.filter(p => p.mr === 's').length;
  const status = g && g.ph !== 'over' ? `🎮 Game in progress · ${g.order.length} players` : players >= MIN ? '✅ Ready to start' : `⏳ Waiting for players (min ${MIN})`;
  const key = players + '|' + spect + '|' + status; if (key === lastSign) return; lastSign = key;
  const s = doorSign, c = s.g; c.fillStyle = '#1d2229'; c.fillRect(0, 0, 512, 320); c.fillStyle = '#f2c230'; c.fillRect(0, 0, 512, 10);
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '800 54px system-ui,sans-serif'; c.fillText('🕵️ THE MOLE', 256, 78);
  c.font = '600 40px system-ui,sans-serif'; c.fillStyle = '#9fe0b0'; c.fillText(`👥 ${g && g.ph !== 'over' ? g.order.length : players} / ${MAX} players`, 256, 150);
  c.fillStyle = '#cfd6df'; c.font = '500 30px system-ui,sans-serif'; c.fillText(`👀 ${spect} watching`, 256, 196); c.fillText(status, 256, 240);
  c.fillStyle = '#f2c230'; c.font = '600 28px system-ui,sans-serif'; c.fillText(isTouch() ? 'Tap to enter' : 'Press E to enter', 256, 292); s.t.needsUpdate = true;
}
function drawBoards(g){
  const n = g ? g.order.length : 7, key = g ? [g.fe, g.bu, g.tr, n, g.ph].join('|') : 'none'; if (key === lastBoards) return; lastBoards = key;
  const slots = (b, count, filled, col, icon, label, sub, powers) => { const c = b.g, W = b.c.width, H = b.c.height;
    c.fillStyle = col; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(12, 12, W - 24, H - 24);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `800 ${H*0.13}px system-ui,sans-serif`; c.fillText(label, W/2, H*0.16); c.font = `500 ${H*0.07}px system-ui,sans-serif`; c.fillText(sub, W/2, H*0.95);
    const sw = (W - 80)/count; for (let i = 0; i < count; i++){ const x = 40 + i*sw + 10, y = H*0.24, w = sw - 20, h = H*0.58;
      c.fillStyle = i < filled ? '#fff' : 'rgba(0,0,0,.22)'; c.fillRect(x, y, w, h);
      c.font = `${h*0.5}px serif`; c.fillStyle = '#000'; if (i < filled) c.fillText(icon, x + w/2, y + h*0.62);
      else if (powers && powers[i]){ c.font = `600 ${h*0.12}px system-ui,sans-serif`; c.fillStyle = '#fff'; const p = PNAME[powers[i]].split(':')[0]; c.fillText(p, x + w/2, y + h*0.55); }
      else if (i === count - 1){ c.font = `700 ${h*0.14}px system-ui,sans-serif`; c.fillStyle = '#fff'; c.fillText('WIN', x + w/2, y + h*0.55); } }
    b.t.needsUpdate = true; };
  slots(boards.fe, 5, g ? g.fe : 0, '#2f5d9e', '✅', 'FEATURES SHIPPED', 'Developers win at 5', null);
  slots(boards.bu, 6, g ? g.bu : 0, '#a3261d', '🐛', 'BUGS SHIPPED', 'Saboteurs win at 6 · from 3 Bugs: Mole elected Tech Lead = Saboteurs win', [...POWERS(n), null]);
  const t = boards.tr, c = t.g, W = t.c.width, H = t.c.height; c.fillStyle = '#3b3f45'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `700 ${H*0.22}px system-ui,sans-serif`; c.fillText('FAILED SPRINTS', W/2, H*0.3);
  for (let i = 0; i < 3; i++){ c.beginPath(); c.arc(W/2 + (i - 1)*H*0.45, H*0.66, H*0.15, 0, 7); c.fillStyle = g && i < g.tr ? '#f2c230' : 'rgba(255,255,255,.25)'; c.fill(); }
  t.t.needsUpdate = true;
}
function effect(ev){
  const big = (text, col) => { flash.innerHTML = `<div style="font:800 46px system-ui,sans-serif;color:${col};text-shadow:0 4px 18px rgba(0,0,0,.6)">${esc(text)}</div>`; flash.style.opacity = 1; clearTimeout(flash.t); flash.t = setTimeout(() => flash.style.opacity = 0, 2400); };
  const tint = col => { const d = el('div', `position:fixed;inset:0;background:${col};pointer-events:none;z-index:3;transition:opacity 1.2s`); setTimeout(() => d.style.opacity = 0, 200); setTimeout(() => d.remove(), 1500); };
  if (ev.k === 'bug'){ big('🐛 BUILD FAILED', '#ff6a5a'); tint('rgba(220,30,20,.35)'); play('buzz', 1, 0); setTimeout(() => tint('rgba(220,30,20,.25)'), 350); }
  else if (ev.k === 'feature'){ big('✅ DEPLOYED!', '#9fe0b0'); confetti(); play('cheer', 0.8, 0); }
  else if (ev.k === 'fired'){ big('💀 FIRED', '#fff'); play('trombone', 1, 0); }
  else if (ev.k === 'chaos'){ big('🌪️ CHAOS DEPLOY', '#f2c230'); tint('rgba(242,194,48,.3)'); play('slam', 0.8, 0); }
  else if (ev.k === 'elected'){ play('chime', 0.7, 0); }
  else if (ev.k === 'rejected'){ play('buzz', 0.5, 0); }
  else if (ev.k === 'devwin' || ev.k === 'sabwin'){ big(ev.k === 'devwin' ? '👩‍💻 DEVELOPERS WIN' : '🦹 SABOTEURS WIN', ev.k === 'devwin' ? '#9cc3e6' : '#ff6a5a'); confetti(); play('cheer', 1, 0); }
  else if (ev.k === 'start'){ play('chime', 0.8, 0); }
}
function confetti(){ for (let i = 0; i < 70; i++){ const d = el('div', `position:fixed;left:${Math.random()*100}vw;top:-20px;width:9px;height:14px;background:hsl(${Math.random()*360},85%,60%);z-index:4;pointer-events:none;transform:rotate(${Math.random()*360}deg);transition:transform 2.2s linear,top 2.2s cubic-bezier(.2,.6,.4,1)`);
  requestAnimationFrame(() => { d.style.top = (60 + Math.random()*45) + 'vh'; d.style.transform = `rotate(${Math.random()*900}deg)`; }); setTimeout(() => d.remove(), 2600); } }

// ---------- floating badges over the players: 👑 Scrum Master, 🛠️ Tech Lead, ✔ voted, 👍/👎, 💀 fired, 😈 villain ----------
function badgeTex(text){ const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.font = '600 46px system-ui,"Segoe UI Emoji",sans-serif';
  const w = Math.min(250, g.measureText(text).width + 34); g.fillStyle = 'rgba(20,24,30,.82)'; g.beginPath(); g.roundRect ? g.roundRect((256 - w)/2, 10, w, 76, 30) : g.rect((256 - w)/2, 10, w, 76); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 50); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
const texCache = {}; const bt = t => texCache[t] || (texCache[t] = badgeTex(t));
function badges(ps, g){
  const want = {};
  for (const p of ps){
    if (p.self) continue; let t = '';
    if (g && g.order.includes(p.key)){
      if (!g.alive[p.key]) t = '💀'; else if (g.ph === 'vote') t = p.key in g.voted ? '✔ voted' : '…';
      else if (g.ev && (g.ev.k === 'elected' || g.ev.k === 'rejected') && g.ev.votes && p.key in g.ev.votes) t = g.ev.votes[p.key] ? '👍' : '👎';   // the revealed votes travel with the event
      else if (p.key === g.order[g.pres]) t = '👑 SM'; else if (p.key === g.chanc) t = '🛠️ TL';
      if (g.ph === 'over' && g.roles) t = ROLE[g.roles[p.key]].icon + ' ' + ROLE[g.roles[p.key]].name;
    } else if (p.mr === 's') t = '👀';
    if (t) want[p.key] = {t, p};
  }
  for (const k in sprites) if (!want[k]){ G.scene.remove(sprites[k].s); delete sprites[k]; }
  for (const k in want){ const {t, p} = want[k]; let s = sprites[k]; if (!s){ s = sprites[k] = {s: new THREE.Sprite(new THREE.SpriteMaterial({depthTest: false, transparent: true})), t: ''}; s.s.scale.set(0.9, 0.34, 1); s.s.renderOrder = 6; G.scene.add(s.s); }
    if (s.t !== t){ s.s.material.map = bt(t); s.s.material.needsUpdate = true; s.t = t; } s.s.position.set(p.x, (p.y || LO) + 2.45, p.z); }
}

// ---------- villain pose (V): a few seconds of evil moustache twirling, for everyone nearby to see ----------
const villainSprites = {};
function villains(){
  const t = now(), mine = t - villainAt < 3000;
  for (const r of (window.__mpRemotes ? window.__mpRemotes() : [])){
    let v = villainSprites[r.key]; const on = r.vl && t - r.vl < 3000;
    if (on && !v){ v = villainSprites[r.key] = new THREE.Sprite(new THREE.SpriteMaterial({map: bt('😈 mwahaha'), depthTest: false, transparent: true})); v.scale.set(1.1, 0.42, 1); v.renderOrder = 7; G.scene.add(v);
      const s = spatial(r.x, r.z, r.l || 0, 14); if (s.g > 0.05) play('cackle', s.g, s.p); }
    if (v){ v.visible = !!on; v.position.set(r.x, (r.y || 0) + 2.9 + Math.sin(t/120)*0.04, r.z); if (!on){ G.scene.remove(v); delete villainSprites[r.key]; } }
  }
  vignette.style.opacity = mine ? 1 : 0;
}
let vignette;

// ---------- the room flow ----------
// the game as the host shares it; Firebase drops empty objects, so give them back
function game(){ const ps = people(), h = currentHost(ps), g = h && h.mg && h.mg.ph && h.mg.ph !== 'none' ? h.mg : null; if (!g) return null;
  for (const k of ['voted', 'votes', 'alive', 'reviewed', 'names']) g[k] = g[k] || {}; g.log = g.log || []; g.order = g.order || []; return g; }
function enter(){
  const g = game(), players = people().filter(p => p.mr === 'p').length;
  me = g && g.ph !== 'over' ? 's' : players >= MAX ? 's' : 'p'; joinedAt = now();
  G.setView(IN[0], IN[1], Math.PI/2, 0); send({mr: me, mj: joinedAt});
  window.__progToast && window.__progToast(me === 'p' ? '🕵️ You joined The Mole' : '👀 You are watching The Mole', me === 'p' ? `${MIN}–${MAX} players. The first one in starts the game with Enter.` : 'Spectators see everything except the secret roles.');
  if (window.__ach) window.__ach('m_enter');
}
function leave(silent){
  me = null; host = null; hostPriv = {}; bots = []; send({mr: null, mj: 0, mg: null, mk: null, ma: null});
  card.style.display = roleCard.style.display = hud.style.display = 'none'; decisionKey = ''; myRoleShown = '';
  for (const k in sprites){ G.scene.remove(sprites[k].s); delete sprites[k]; }
  if (!silent) G.setView(OUT[0], OUT[1], -Math.PI/2, 0);
}
function tick(dt){
  if (!G || !doorSign) return '';
  const s = G.state, inside = inRoom(s);
  if (me && !inside) leave(true);                     // walked out some other way (Jump to…, stairs)
  if (!me && inside && s.started) enter();            // arrived inside without the door (Jump to…)
  const ps = people(); drawSign(ps); villains();
  const h = currentHost(ps), iAmHost = me === 'p' && h && h.self;
  if (iAmHost) hostStep(ps); else if (host && h && !h.self){ host = null; hostPriv = {}; }
  const g = game(); drawBoards(g);
  // between games, spectators become players again (while there is room)
  if (me === 's' && (!g || g.ph === 'over') && ps.filter(p => p.mr === 'p').length < MAX){ me = 'p'; joinedAt = now(); send({mr: 'p', mj: joinedAt}); }
  if (me){
    badges(ps, g);
    const priv = g && g.ph !== 'over' && h && h.mk && h.mk[myKey()] ? dec(h.mk[myKey()], myKey() + g.id) : null;
    // your role card at the start of a game
    if (g && priv && priv.role && myRoleShown !== g.id){ myRoleShown = g.id; showRole(g, priv); if (window.__ach) window.__ach('m_play'); }
    if (g && g.ev && g.ev.n !== effectsSeen){ effectsSeen = g.ev.n; effect(g.ev); if (g.ev.k === 'devwin' || g.ev.k === 'sabwin' || g.ev.k === 'abort') results(g); }
    showDecision(g && me === 'p' ? decision(g, priv) : null, priv && priv.peek);
    if (priv && priv.review && priv.review.at && priv.review.at !== seen.review){ seen.review = priv.review.at; window.__progToast && window.__progToast(`🔍 Code review: ${priv.review.name}`, priv.review.team === 'dev' ? 'is a loyal 👩‍💻 Developer' : 'is on the 🦹 Saboteur team!'); }
    hudUpdate(g, ps, priv);
    return '';
  }
  // outside: the door prompt
  if (s.lv === 2 && Math.hypot(s.x - 28.6, s.z - DOOR.z) < 1.3 && s.started && !G.controlLock) return (isTouch() ? 'Tap' : 'Press E') + ' to enter The Mole 🕵️';
  return '';
}
function use(){
  const s = G.state;
  if (me && Math.hypot(s.x - IN[0], s.z - IN[1]) < 1.4){ leave(); return true; }
  if (!me && s.lv === 2 && Math.hypot(s.x - 28.6, s.z - DOOR.z) < 1.3 && s.started && !G.controlLock){ try { sound.unlock(); } catch (e) {} enter(); return true; }
  return false;
}
function showRole(g, priv){
  const r = ROLE[priv.role], team = (priv.team || []).map(t => `${ROLE[t.role].icon} ${esc(t.name)}${t.role === 'mole' ? ' (the Mole)' : ''}`).join('<br>');
  roleCard.innerHTML = `<div style="font-size:13px;opacity:.8">🕵️ The Mole · your secret role</div><div style="font-size:54px;line-height:1.1;margin:6px 0">${r.icon}</div><div style="font:800 26px system-ui,sans-serif;color:${r.col}">${r.name}</div>`
    + `<div style="margin:6px 0 8px;color:#454b55">${r.goal}</div>` + (team ? `<div style="font-size:13px;background:#f6f8fb;border-radius:10px;padding:8px">Your team:<br>${team}</div>` : priv.role === 'mole' ? '<div style="font-size:13px;color:#5a6472">You don’t know who the Saboteurs are. They know you.</div>' : '')
    + `<div style="font-size:12px;color:#5a6472;margin-top:8px">${isTouch() ? 'Tap to hide' : 'R shows this again · it hides in 8 s'}</div>`;
  roleCard.style.display = 'block'; clearTimeout(roleCard.t); roleCard.t = setTimeout(() => roleCard.style.display = 'none', 8000);
}
function results(g){
  if (!g.roles) return; const k = myKey(), myRole = g.roles[k], won = myRole && ((g.winner === 'dev' && myRole === 'dev') || (g.winner === 'sab' && myRole !== 'dev'));
  if (window.__ach && me === 'p' && myRole){ if (won){ window.__ach(myRole === 'dev' ? 'm_windev' : 'm_winsab'); if (myRole === 'mole') window.__ach('m_mole'); if (window.__xp) window.__xp(40, 'Won The Mole'); } else if (window.__xp) window.__xp(15, 'Played The Mole'); }
  const list = g.order.map(x => `${ROLE[g.roles[x]].icon} ${esc(g.names[x])}${g.alive[x] ? '' : ' 💀'} · <b style="color:${ROLE[g.roles[x]].col}">${ROLE[g.roles[x]].name}</b>`).join('<br>');
  roleCard.innerHTML = `<div style="font:800 24px system-ui,sans-serif">${g.winner === 'dev' ? '👩‍💻 Developers win!' : g.winner === 'sab' ? '🦹 Saboteurs win!' : '🚪 Game stopped'}</div><div style="color:#454b55;margin:4px 0 8px">${esc(g.why)}${myRole ? (won ? '<br><b>You won!</b> 🎉' : '<br>You lost this one.') : ''}</div><div style="font-size:14px;text-align:left;background:#f6f8fb;border-radius:10px;padding:8px 10px">${list}</div>`
    + `<div style="font-size:12px;color:#5a6472;margin-top:8px">The host starts a new game with Enter</div>`;
  roleCard.style.display = 'block'; clearTimeout(roleCard.t); roleCard.t = setTimeout(() => roleCard.style.display = 'none', 15000);
}
function hudUpdate(g, ps, priv){
  hud.style.display = 'block'; const players = ps.filter(p => p.mr === 'p'), k = myKey();
  if (!g || g.ph === 'over'){
    const h = currentHost(ps), iHost = h && h.self && me === 'p';
    hud.innerHTML = `<b>🕵️ The Mole · lobby</b> · ${players.length}/${MAX} players · ${ps.filter(p => p.mr === 's').length} watching<div style="font-size:12px;opacity:.85;margin-top:3px">${players.map(p => esc(p.name)).join(', ')}</div>`
      + `<div style="margin-top:4px">${players.length < MIN ? `Waiting for ${MIN - players.length} more…` : iHost ? '<b>Press Enter to start the game</b>' : `Waiting for ${esc(h ? h.name : 'the host')} to start`}</div>`
      + `<div style="font-size:11px;opacity:.7;margin-top:3px">${me === 's' ? 'You are watching · ' : ''}E at the door: leave · V: villain pose · Enter: chat${g && g.ph === 'over' && g.why ? ' · last game: ' + esc(g.why) : ''}</div>`;
    return;
  }
  const pres = g.order[g.pres], phase = {nominate: `👑 ${esc(g.names[pres])} (Scrum Master) is choosing a Tech Lead`, vote: `🗳️ Vote on ${esc(g.names[pres])} + ${esc(g.names[g.chanc])} · ${Object.keys(g.voted).length}/${g.order.filter(x => g.alive[x]).length} voted`,
    pres: `🗂️ ${esc(g.names[pres])} is looking at the backlog…`, chanc: `🛠️ ${esc(g.names[g.chanc])} is choosing what to ship…`, power: `${PNAME[g.power] || ''} (${esc(g.names[pres])})`}[g.ph] || '';
  const role = priv && priv.role ? `${ROLE[priv.role].icon} You are <b>${ROLE[priv.role].name}</b>${g.alive[k] ? '' : ' · 💀 fired'}` : '👀 Spectating';
  hud.innerHTML = `<div style="font-size:12px;opacity:.85">${role} · ✅ ${g.fe}/5 · 🐛 ${g.bu}/6 · failed sprints ${g.tr}/3</div><div style="font-weight:600;margin-top:3px">${phase}</div>`
    + `<div style="font-size:12px;opacity:.85;margin-top:3px">${esc((g.log || [])[0] || '')}</div><div style="font-size:11px;opacity:.65;margin-top:2px">${me === 'p' ? 'Choices: number keys · R: role · ' : ''}V: villain pose · Enter: chat</div>`;
}

function init(){
  G = window.GAME; THREE = G.THREE; buildRoom();
  hud = el('div', 'position:fixed;top:72px;left:50%;transform:translateX(-50%);display:none;z-index:3;background:rgba(20,24,30,.8);color:#fff;border-radius:12px;padding:8px 16px 9px;font-size:14px;text-align:center;pointer-events:none;max-width:min(560px,92vw)');
  card = el('div', 'position:fixed;right:16px;top:50%;transform:translateY(-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:16px 18px 14px;width:min(300px,86vw);line-height:1.4;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35)');
  roleCard = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:5;background:#fff;color:#1d2229;border-radius:16px;padding:18px 22px;width:min(340px,88vw);text-align:center;line-height:1.45;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35)');
  roleCard.addEventListener('click', () => roleCard.style.display = 'none'); roleCard.addEventListener('touchend', () => roleCard.style.display = 'none');
  flash = el('div', 'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:5;pointer-events:none;opacity:0;transition:opacity .3s;text-align:center');
  vignette = el('div', 'position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0;transition:opacity .4s;box-shadow:inset 0 0 160px 40px rgba(110,30,160,.7)');
  addEventListener('keydown', e => {
    const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || e.repeat) return;
    if (e.code === 'KeyV' && G.state.started && window.__mpSend){ villainAt = now(); send({vl: villainAt}); play('cackle', 0.9, 0); window.__ach && window.__ach('m_villain'); return; }
    if (!me) return;
    if (e.code === 'KeyR'){ const ps = people(), h = currentHost(ps), g = game(), priv = g && h && h.mk && h.mk[myKey()] ? dec(h.mk[myKey()], myKey() + g.id) : null; if (priv && priv.role) showRole(g, priv); return; }
    if (e.code === 'Enter' && me === 'p'){ const ps = people(), h = currentHost(ps), g = game(); if (h && h.self && (!g || g.ph === 'over') && ps.filter(p => p.mr === 'p').length >= MIN){ e.preventDefault(); e.stopImmediatePropagation(); startGame(ps); } return; }
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code); if (m && card.style.display === 'block' && options[+m[1] - 1]){ e.preventDefault(); e.stopImmediatePropagation(); choose(decisionT, options[+m[1] - 1][0]); }
  }, true);
  G.uses.unshift({tick, use});
}
function currentT(){ const g = game(); if (!g) return ''; return {nominate: 'nom', vote: 'vote', pres: 'discard', chanc: 'ship', power: g.power === 'peek' ? 'ok' : 'pick'}[g.ph]; }

window.MOLE = {get host(){ return host; }, people: () => people(), game: () => game(),
  bots(n = 4){ const t = now(); for (let i = 0; i < n; i++) bots.push({key: 'bot' + (bots.length + 1), name: ['Robo-Anna', 'Bot Bram', 'Cyber-Sofie', 'Tin Tim', 'Ruben 2.0', 'Arne.exe', 'Wolfbot', 'Pixel Pieter', 'Data Dirk'][bots.length % 9], mr: 'p', mj: t + 1000 + i, bot: true, x: 8 + i*1.4, y: LO, z: 2.2}); return bots.length; }};
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
