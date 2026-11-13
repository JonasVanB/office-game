// Progression: XP, levels, achievements and level-locked doors, saved per player (progress/<user id>).
// Every game feeds it through three global hooks, so a new game only needs to call them:
//   window.__xp(amount, reason)     XP for something repeatable (a ticket, a finished darts game)
//   window.__ach(id)                unlock an achievement once (gives its XP)
//   window.__stat(key, add = 1)     count something; achievements with {stat, n} unlock at that count
// Q opens the panel: level, today's tickets, all achievements per game, and the leaderboard.
import {play} from './sound.js';

export const LEVELS = [
  {lv: 1, name: 'Visitor', xp: 0}, {lv: 2, name: 'Intern', xp: 100}, {lv: 3, name: 'Colleague', xp: 300}, {lv: 4, name: 'Trusted', xp: 700},
  {lv: 5, name: 'Senior', xp: 1400}, {lv: 6, name: 'Lead', xp: 2500}, {lv: 7, name: 'Office legend', xp: 4000},
];
// doors that need a level (the rooms.md access idea): you can always leave, and a door someone else opened stays open
const LOCKS = {'Utility': 2, 'Admin storage': 3, 'Drinks storage': 3, 'Server room': 4, 'CEO': 4};

// ---------- achievements, per game ----------
// [id, icon, name, how, xp, extra] — extra {stat, n}: unlocks when that counter reaches n; {secret: true}: hidden until unlocked
const A = (cat, list) => list.map(([id, icon, name, how, xp, x]) => Object.assign({id, icon, name, how, xp, cat}, x || {}));
export const ACHIEVEMENTS = [
  ...A('Office', [
    ['welcome', '👋', 'Welcome to Orbid', 'Start walking for the first time', 10],
    ['early', '🌅', 'Early bird', 'Be in the office before 7:30', 15],
    ['coffee', '☕', 'Caffeine first', 'Be in the 3e kitchen during the 9:00 coffee', 15],
    ['coffee5', '☕', 'Coffee addict', 'Be at the 9:00 coffee on 5 days', 40, {stat: 'coffee', n: 5}],
    ['lunch', '🥪', 'Lunch break', 'Be in the 4e kitchen during lunch', 10],
    ['fries', '🍟', 'Friday fries', 'Be in the 4e kitchen for the Friday fries', 20],
    ['meeting', '📊', 'Present!', 'Be in Portus Ganda for the Friday team meeting', 20],
    ['afterwork', '🎲', 'After work', 'Be in the Stille ruimte for the Friday after work', 20],
    ['nightowl', '🦉', 'Night owl', 'Be in the office after 23:00', 15],
    ['upstairs', '🪜', 'Upstairs', 'Visit Graslei or Korenlei on the mezzanine', 10],
    ['downstairs', '⬇️', 'One floor down', 'Visit the 3e verdiep', 10],
    ['explorer', '🧭', 'Explorer', 'Visit 20 different rooms', 30, {stat: 'rooms', n: 20}],
    ['explorer2', '🗺️', 'Knows every corner', 'Visit 35 different rooms', 60, {stat: 'rooms', n: 35}],
    ['doors', '🚪', 'Door opener', 'Open 50 doors', 15, {stat: 'doors', n: 50}],
    ['jumps', '🐸', 'Hop hop', 'Jump 100 times', 15, {stat: 'jumps', n: 100}],
    ['jumps2', '🦘', 'Kangaroo', 'Jump 1000 times', 40, {stat: 'jumps', n: 1000}],
    ['locked', '🔒', 'Access denied', 'Try a door you have no access to yet', 5],
    ['server_in', '🖥️', 'Into the server room', 'Enter the server room', 30],
    ['ceo_in', '👔', 'Corner office', 'Enter the CEO office', 30],
  ]),
  ...A('Social', [
    ['chat', '💬', 'Say hi', 'Send a chat message', 10],
    ['chat50', '🗣️', 'Chatterbox', 'Send 50 chat messages', 30, {stat: 'chat', n: 50}],
    ['company', '🤝', 'Not alone', 'Be online together with a colleague', 15],
    ['party', '🎉', 'Office party', 'Be online with 5 or more players', 40],
  ]),
  ...A('Tickets', [
    ['ticket1', '🎫', 'First ticket', 'Solve a ticket', 15, {stat: 'tickets', n: 1}],
    ['ticket10', '🦸', 'Helpdesk hero', 'Solve 10 tickets', 50, {stat: 'tickets', n: 10}],
    ['ticket50', '🏅', 'IT legend', 'Solve 50 tickets', 150, {stat: 'tickets', n: 50}],
    ['p1', '🚒', 'Firefighter', 'Solve a P1 ticket within its SLA', 30],
    ['inbox0', '📭', 'Inbox zero', 'Solve every ticket of one day', 60],
    ['late', '🐌', 'SLA breached', 'Solve a ticket after its deadline', 5],
  ]),
  ...A('Darts', [
    ['d_first', '🎯', 'First dart', 'Throw a dart', 5],
    ['d_miss', '🧱', 'Wall art', 'Miss the board completely', 5],
    ['d_t20', '3️⃣', 'Treble twenty', 'Hit T20', 15],
    ['d_bull', '🐂', 'Bullseye', 'Hit the bull', 20],
    ['d_100', '💯', 'Ton', 'Score 100 or more in one turn', 20],
    ['d_140', '🔥', 'Ton-forty', 'Score 140 or more in one turn', 30],
    ['d_180', '🤯', 'ONE HUNDRED AND EIGHTY', 'Score 180 in one turn', 100],
    ['d_bust', '💥', 'Bust!', 'Bust in 501', 5],
    ['d_501', '🏆', 'Game shot', 'Finish a game of 501', 40],
    ['d_501pro', '⚡', 'Pro leg', 'Finish 501 in 21 darts or fewer', 80],
    ['d_bullout', '🎯', 'Bull finish', 'Check out on the bull', 60],
    ['d_atc', '🕐', 'Around the Clock', 'Finish Around the Clock', 30],
    ['d_atc30', '⏱️', 'Clockwork', 'Around the Clock in 30 darts or fewer', 60],
    ['d_hs300', '🔥', 'Heavy scorer', 'Score 300+ in the 9-dart high score', 50],
    ['d_games', '🍻', 'Pub regular', 'Finish 10 darts games', 40, {stat: 'dartsGames', n: 10}],
  ]),
  ...A('Post-it jump', [
    ['p_first', '📝', 'Sticky', 'Stick a post-it on the wall', 15],
    ['p_270', '🦅', 'High flyer', 'Stick a post-it at 2.70 m or higher', 25],
    ['p_290', '🚀', 'Sky high', 'Stick a post-it at 2.90 m or higher', 50],
    ['p_300', '🌟', 'Touch the ceiling', 'Stick a post-it at 3.00 m or higher', 100],
    ['p_top', '👑', 'King of the wall', 'Have the highest post-it on the wall', 60],
    ['p_perfect', '✨', 'Perfect run', 'Take-off 90%+ and wall kick 85%+ in one jump', 40],
    ['p_foul', '🚩', 'Foul!', 'Step over the take-off line', 5],
  ]),
  ...A('Tile wall', [
    ['t_first', '🟦', 'Tegeltjeswijsheid', 'Put a quote on a tile at desk 6', 15],
    ['t_five', '🧱', 'Wall of wisdom', 'Have 5 tiles on the wall', 30],
  ]),
  ...A('Toilet', [
    ['wc_first', '🚽', 'Nature calls', 'Use a toilet or urinal', 5],
    ['wc_sniper', '🎯', 'Sniper', 'Get the Sniper rating', 40],
    ['wc_mop', '🧽', 'Get the mop', 'Leave a big puddle', 10],
    ['wc_10', '💧', 'Well hydrated', 'Go 10 times', 20, {stat: 'toilet', n: 10}],
    ['wc_duel', '🤺', 'Urinal duel', 'Play a urinal duel against a colleague', 15],
    ['wc_duelwin', '🏆', 'Duel champion', 'Win a urinal duel', 30],
  ]),
  ...A('Stiekem kussen', [
    ['k_first', '💋', 'First kiss', 'Kiss a colleague on the Boekentoren beanbags (2 players)', 10],
    ['k_caught', '😳', 'Caught red-lipped', 'Get caught kissing', 5],
    ['k_clean', '🤫', 'Not a soul saw it', 'Clear a level without getting caught', 25],
    ['k_l3', '🚪', 'Getting bold', 'Reach level 3 (the boss peeks in)', 20],
    ['k_l5', '🔥', 'Office romance', 'Reach level 5', 40],
    ['k_all', '💍', 'True love', 'Clear all 5 levels', 80],
  ]),
  ...A('Boxing', [
    ['b_secret', '🕹️', 'Secret lever', 'Find the lever that raises the boxing ring', 25, {secret: true}],
    ['b_first', '🥊', 'Gloves on', 'Box a fight in the ring', 10],
    ['b_win', '🏆', 'Champion', 'Win a fight', 30],
    ['b_ko', '💥', 'Knockout', 'Win by knockout', 40],
    ['b_counter', '⚡', 'Counter puncher', 'Land a counter during a wind-up', 20],
    ['b_slip', '🦋', 'Float like a butterfly', 'Slip 5 punches in one fight', 30],
    ['b_flawless', '🛡️', 'Flawless', 'Win without taking any damage', 80],
    ['b_wins', '🥇', 'Undisputed', 'Win 10 fights', 60, {stat: 'boxWins', n: 10}],
  ]),
  ...A('Secrets', [
    ['sweater_found', '🧥', 'The Orbid sweater', 'Find the hidden Orbid sweater', 100, {secret: true}],
    ['sweater_lv', '👔', 'Dressed for success', 'Reach level 6 (Lead): unlocks the Orbid sweater', 50],
  ]),
  ...A('Night', [
    ['n_boo', '👻', 'Boo!', 'Get scared by a ghost', 20],
    ['n_boo5', '😱', 'Scaredy-cat', 'Get scared by ghosts 5 times', 30, {stat: 'boo', n: 5}],
    ['n_fire', '🧯', 'Fire drill', 'Be in the stairwell during a fire alarm', 30],
    ['n_hot', '🥵', 'Too hot to handle', 'Get close to a fire', 10],
    ['n_burglar', '🚓', 'Caught red-handed', 'Scare off the burglar', 40],
    ['n_server', '📟', 'On call', 'Be by the server room during a server alert', 20],
    ['n_cleaner', '🧹', 'Clean desk policy', 'Meet the cleaner', 10],
    ['n_update', '💻', 'Patch night', 'Be online during the night-time Windows Update', 10],
    ['n_power', '⚡', 'Lights out', 'Be in the office during a power failure', 20],
    ['n_torch', '🔦', 'Who turned off the lights?', 'Switch on your flashlight (F)', 5],
  ]),
];
const BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
export const levelOf = xp => LEVELS.filter(l => xp >= l.xp).pop();

const CSS = `
#lvPill{position:fixed;top:78px;left:10px;background:rgba(20,24,30,.62);color:#fff;border-radius:10px;padding:5px 10px 7px;font-size:13px;cursor:pointer;z-index:2;min-width:150px}
#lvPill b{font-weight:600}
#lvPill .bar{height:4px;border-radius:2px;background:rgba(255,255,255,.2);margin-top:4px;overflow:hidden}
#lvPill .bar i{display:block;height:100%;background:#f2c230;border-radius:2px}
#achToasts{position:fixed;right:10px;bottom:56px;display:flex;flex-direction:column;gap:6px;align-items:flex-end;z-index:4;pointer-events:none}
#achToasts div{background:rgba(20,24,30,.88);color:#fff;border-radius:12px;padding:8px 14px;font-size:14px;max-width:300px;transition:opacity .5s,transform .5s;transform:translateX(0)}
#achToasts div.ach{border:2px solid #f2c230}
#achToasts small{display:block;opacity:.8;font-size:12px}
#progPanel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:6;background:#fff;color:#1d2229;border-radius:16px;width:min(620px,94vw);max-height:84vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.35);font-size:14px;line-height:1.4}
#progPanel .hd{position:sticky;top:0;background:#fff;padding:16px 20px 10px;border-bottom:1px solid #e6eaf0;z-index:1}
#progPanel h1{font-size:20px;margin:0;font-weight:600}
#progPanel h2{font-size:15px;margin:16px 0 6px;font-weight:600}
#progPanel .bd{padding:4px 20px 18px}
#progPanel .big{height:10px;border-radius:5px;background:#e6eaf0;overflow:hidden;margin-top:6px}
#progPanel .big i{display:block;height:100%;background:linear-gradient(90deg,#f2c230,#ff8a2a)}
#progPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px}
#progPanel .a{display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:10px;background:#f6f8fb;font-size:12px;line-height:1.25}
#progPanel .a b{display:block;font-size:13px}
#progPanel .a span.i{font-size:22px;flex:none;width:28px;text-align:center}
#progPanel .a.off{opacity:.45;filter:grayscale(1)}
#progPanel table{width:100%;border-collapse:collapse;font-size:13px}
#progPanel td{padding:4px 6px;border-bottom:1px solid #eef1f5}
#progPanel .tk{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border-radius:10px;background:#f6f8fb;margin-bottom:6px}
#progPanel .tk.done{opacity:.55}
#progPanel .pr{font-weight:700;font-size:11px;border-radius:6px;padding:1px 6px;color:#fff;flex:none;margin-top:1px}
#progPanel .note{font-size:12px;color:#5a6472}
`;

export function initProgress({G, net, me}){
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  let P = {xp: 0, a: {}, s: {}, d: {}}, loadedFor = null, saveT = 0;
  const others = new Map();   // leaderboard: id → {n, xp}
  const sections = [];        // other modules (tickets) add a section to the panel

  // ---------- storage ----------
  async function load(){
    const who = me(); if (!who || loadedFor === who.id) return;
    loadedFor = who.id;
    let v = null; try { v = await net.loadProgress(who.id); } catch (e) {}
    if (!v){ try { v = JSON.parse(localStorage.getItem('office.progress.' + who.id)); } catch (e) {} }
    P = Object.assign({xp: 0, a: {}, s: {}, d: {}, r: {}}, v || {}); P.a = P.a || {}; P.s = P.s || {}; P.d = P.d || {}; P.r = P.r || {};
    refresh(); ach('welcome');
  }
  function save(){
    const who = me(); if (!who || loadedFor !== who.id) return;
    clearTimeout(saveT); saveT = setTimeout(() => {
      const d = {xp: P.xp, a: P.a, s: P.s, d: P.d, r: P.r || {}, tk: P.tk || null, n: who.name, t: Date.now()};
      try { localStorage.setItem('office.progress.' + who.id, JSON.stringify(d)); } catch (e) {}
      net.saveProgress(who.id, d);
    }, 1200);
  }
  net.onProgress((id, v) => { if (v && typeof v.xp === 'number') others.set(id, {n: String(v.n || '?').slice(0, 20), xp: v.xp, a: v.a ? Object.keys(v.a).length : 0}); else others.delete(id); if (panelOpen) renderPanel(); });

  // ---------- the hooks every game uses ----------
  function xp(n, reason){
    if (!me() || loadedFor !== me().id || !(n > 0)) return;
    const before = levelOf(P.xp); P.xp = Math.round(P.xp + n); const after = levelOf(P.xp);
    toast(`+${Math.round(n)} XP`, reason || '');
    if (after.lv >= 6) setTimeout(() => ach('sweater_lv'), 1500);
    if (after.lv > before.lv){ toast(`⭐ Level ${after.lv}: ${after.name}!`, unlockText(after.lv), true); play('cheer', 0.5, 0); if (window.__mpSay) window.__mpSay(`⭐ reached level ${after.lv}: ${after.name}`); }
    refresh(); save();
  }
  function ach(id){
    const a = BY_ID[id]; if (!a || !me() || loadedFor !== me().id || P.a[id]) return false;
    P.a[id] = Date.now(); play('ding', 0.7, 0);
    toast(`${a.icon} ${a.name}`, `Achievement unlocked · ${a.how}`, true);
    if (a.xp >= 60 && window.__mpSay) window.__mpSay(`🏆 unlocked "${a.name}"`);
    xp(a.xp, a.name); save(); return true;
  }
  function stat(key, add = 1){
    if (!me() || loadedFor !== me().id) return 0;
    P.s[key] = (P.s[key] || 0) + add;
    for (const a of ACHIEVEMENTS) if (a.stat === key && P.s[key] >= a.n) ach(a.id);
    save(); return P.s[key];
  }
  // once per game day (coffee, lunch, …): returns true the first time today
  function daily(key, dayN){ if (P.d[key] === dayN) return false; P.d[key] = dayN; save(); return true; }
  window.__xp = xp; window.__ach = ach; window.__stat = stat; window.__progToast = (a, b) => toast(a, b);

  // ---------- HUD: level pill and toasts ----------
  const pill = document.createElement('div'); pill.id = 'lvPill'; pill.title = 'Progress, tickets and achievements (Q)'; document.body.appendChild(pill);
  pill.addEventListener('click', () => togglePanel());
  const toasts = document.createElement('div'); toasts.id = 'achToasts'; document.body.appendChild(toasts);
  function toast(title, sub, big){
    const d = document.createElement('div'); if (big) d.className = 'ach'; d.append(title); if (sub){ const s = document.createElement('small'); s.textContent = sub; d.append(s); }
    toasts.appendChild(d); while (toasts.children.length > 5) toasts.firstChild.remove();
    setTimeout(() => { d.style.opacity = 0; d.style.transform = 'translateX(30px)'; setTimeout(() => d.remove(), 600); }, big ? 5000 : 2200);
  }
  function refresh(){
    const l = levelOf(P.xp), next = LEVELS.find(x => x.xp > P.xp), pct = next ? (P.xp - l.xp)/(next.xp - l.xp)*100 : 100;
    const n = Object.keys(P.a).length;
    pill.innerHTML = `<b>⭐ ${l.lv} · ${l.name}</b> <span style="opacity:.75">${P.xp} XP · 🏆 ${n}/${ACHIEVEMENTS.length}</span><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>`;
    pill.style.display = me() ? 'block' : 'none';
    const go = document.getElementById('goto'); if (go) pill.style.top = (go.offsetTop + go.offsetHeight + 6) + 'px';
    if (panelOpen) renderPanel();
  }
  function unlockText(lv){ const doors = Object.entries(LOCKS).filter(([, l]) => l === lv).map(([d]) => d); return doors.length ? 'Unlocked: ' + doors.join(', ') : 'Keep going!'; }

  // ---------- level-locked doors ----------
  const level = () => levelOf(P.xp).lv;
  G.canOpen = d => { const need = LOCKS[d.name]; return !need || level() >= need; };
  G.lockText = d => { const need = LOCKS[d.name]; return need && level() < need ? `🔒 ${d.name}: level ${need} (${LEVELS[need - 1].name}) needed · you are level ${level()}` : ''; };
  G.onLocked = () => ach('locked');

  // ---------- the Orbid sweater: found in a secret spot, or unlocked at level 6 ----------
  const hasSweater = () => !!(P.a.sweater_found || P.a.sweater_lv || level() >= 6);
  window.__hasSweater = hasSweater;
  // folded on top of the white closets in the far corner of the Stille ruimte (2.1 m up): you only see it from a distance
  // or while jumping next to the closets; jump and press E to grab it
  const SW = {x: 49.72, y: 2.135, z: 0.95};
  const folded = new G.THREE.Group(); folded.position.set(SW.x, SW.y, SW.z); folded.rotation.y = 0.35; G.scene.add(folded);
  { const T = G.THREE, wool = new T.MeshStandardMaterial({color: 0x9a9da2, roughness: 1});
    const b = new T.Mesh(new T.BoxGeometry(0.34, 0.07, 0.28), wool); folded.add(b);
    const fold = new T.Mesh(new T.BoxGeometry(0.34, 0.025, 0.12), new T.MeshStandardMaterial({color: 0x7b7e83, roughness: 1})); fold.position.set(0, 0.045, 0.06); folded.add(fold);
    import('./avatar.js').then(({logoTexture}) => { const l = new T.Mesh(new T.PlaneGeometry(0.15, 0.05), new T.MeshStandardMaterial({map: logoTexture(T), transparent: true})); l.rotation.x = -Math.PI/2; l.position.set(0, 0.0365, -0.05); folded.add(l); }); }
  const canGrab = () => { const s = G.state; return !P.a.sweater_found && s.lv === 0 && s.hop > 0.22 && Math.hypot(s.x - SW.x, s.z - SW.z) < 1.4; };
  (window.__useHooks = window.__useHooks || []).push(() => {
    if (!me() || !canGrab()) return false;
    ach('sweater_found'); play('cheer', 0.8, 0);
    toast('🧥 You found the Orbid sweater!', 'Press O to put it on (or Edit character). Everyone will see you wear it', true);
    if (window.__mpSay) window.__mpSay('🧥 found the secret Orbid sweater!');
    return true;
  });
  (window.__hintHooks = window.__hintHooks || []).push(() => me() && canGrab() ? (window.__isTouch ? 'Tap to grab the sweater!' : 'Press E to grab the sweater!') : '');
  addEventListener('keydown', e => {
    const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || !me() || e.repeat || e.code !== 'KeyO') return;
    if (!hasSweater()){ toast('🧥 The Orbid sweater is still locked', 'Reach level 6 (Lead)… or find where it is hidden'); return; }
    if (window.__setSweater){ const on = window.__setSweater(); toast(on ? '🧥 Orbid sweater on' : 'Sweater off', on ? 'Looking sharp' : ''); }
  });

  // ---------- the menu (Q, the level pill, or the button in the pause menu): overview, achievements, leaderboard ----------
  const panel = document.createElement('div'); panel.id = 'progPanel'; document.body.appendChild(panel);
  let panelOpen = false, tab = 'ach', filter = 'all';
  function togglePanel(open = !panelOpen){
    panelOpen = open; panel.style.display = open ? 'block' : 'none';
    // free the mouse so the menu can be clicked (the game shows its pause screen behind it; Resume continues)
    if (open){ if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); renderPanel(); }
  }
  window.__openProgress = (t) => { if (t) tab = t; togglePanel(true); };
  addEventListener('keydown', e => {
    const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
    if (e.code === 'KeyQ' && !e.repeat && me()){ togglePanel(); e.preventDefault(); return; }
    if (!panelOpen) return;
    if (e.code === 'Escape'){ togglePanel(false); return; }
    const k = {Digit1: 'home', Digit2: 'ach', Digit3: 'board'}[e.code]; if (k){ tab = k; renderPanel(); e.preventDefault(); e.stopPropagation(); }
  }, true);
  addEventListener('wheel', e => { if (panelOpen) panel.scrollTop += e.deltaY; }, {passive: true});
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-tab],[data-filter],[data-act]'); if (!b) return;
    if (b.dataset.tab) tab = b.dataset.tab; if (b.dataset.filter) filter = b.dataset.filter;
    if (b.dataset.act === 'close') return togglePanel(false);
    if (b.dataset.act === 'sweater' && window.__setSweater) window.__setSweater();
    renderPanel();
  });
  // a button in the game's pause menu (Esc), where the mouse is free
  { const c2 = document.getElementById('card2'); if (c2){ const b = document.createElement('button'); b.type = 'button'; b.textContent = '🏆 Achievements & progress (Q)';
    b.style.cssText = 'margin-top:8px;width:100%;font-size:15px;padding:10px;border:0;border-radius:10px;background:#f2c230;color:#1d2229;font-weight:600;cursor:pointer';
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (me()) window.__openProgress('ach'); }); c2.appendChild(b); } }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  function renderPanel(){
    const l = levelOf(P.xp), next = LEVELS.find(x => x.xp > P.xp), pct = next ? (P.xp - l.xp)/(next.xp - l.xp)*100 : 100;
    const got = Object.keys(P.a).filter(id => BY_ID[id]).length;
    const tabBtn = (id, label) => `<button data-tab="${id}" style="border:0;border-radius:9px;padding:7px 12px;font-size:14px;font-weight:600;cursor:pointer;background:${tab === id ? '#2f5d9e' : '#eef1f5'};color:${tab === id ? '#fff' : '#1d2229'}">${label}</button>`;
    let h = `<div class="hd"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h1>⭐ Level ${l.lv} · ${l.name}</h1><button data-act="close" style="border:0;background:#eef1f5;border-radius:9px;padding:6px 11px;font-size:15px;cursor:pointer">✕</button></div>`
      + `<div class="note">${P.xp} XP${next ? ` · ${next.xp - P.xp} XP to level ${next.lv} (${next.name})` : ' · max level'} · 🏆 ${got}/${ACHIEVEMENTS.length}</div><div class="big"><i style="width:${pct}%"></i></div>`
      + `<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${tabBtn('home', '1 · Overview')}${tabBtn('ach', '2 · Achievements')}${tabBtn('board', '3 · Leaderboard')}</div></div><div class="bd">`;
    if (tab === 'home'){
      for (const s of sections) h += s();
      h += `<h2>🔒 Access</h2><div class="note">` + Object.entries(LOCKS).map(([d, need]) => `${level() >= need ? '✅' : '🔒'} ${esc(d)} (level ${need})`).join(' · ') + `</div>`;
      const wearing = window.__wearingSweater && window.__wearingSweater();
      h += `<h2>🧥 Orbid sweater</h2>` + (hasSweater()
        ? `<div class="note">Unlocked! <button data-act="sweater" style="border:0;border-radius:8px;padding:5px 10px;margin-left:6px;cursor:pointer;background:#2f5d9e;color:#fff;font-weight:600">${wearing ? 'Take it off' : 'Put it on'} (O)</button></div>`
        : `<div class="note">Locked. Reach level 6 (Lead), or find where it is hidden somewhere in the office…</div>`);
      h += `<h2>⌨️ Keys</h2><div class="note">E: use / open · Space: jump · F: flashlight · Q: this menu · O: Orbid sweater · Enter: chat · M: sound · Esc: pause</div>`;
    } else if (tab === 'ach'){
      const fBtn = (id, label) => `<button data-filter="${id}" style="border:1px solid ${filter === id ? '#2f5d9e' : '#d5dbe3'};border-radius:16px;padding:4px 11px;font-size:13px;cursor:pointer;background:${filter === id ? '#e8eef8' : '#fff'};color:#1d2229">${label}</button>`;
      h += `<div style="display:flex;gap:6px;margin:10px 0 2px;flex-wrap:wrap">${fBtn('all', 'All')}${fBtn('todo', 'To do')}${fBtn('done', 'Unlocked')}</div>`;
      for (const c of [...new Set(ACHIEVEMENTS.map(a => a.cat))]){
        const list = ACHIEVEMENTS.filter(a => a.cat === c), n = list.filter(a => P.a[a.id]).length;
        const show = list.filter(a => filter === 'all' || (filter === 'done') === !!P.a[a.id]); if (!show.length) continue;
        h += `<div style="display:flex;align-items:center;gap:8px;margin:14px 0 6px"><b style="font-size:14px">${esc(c)}</b><span class="note">${n}/${list.length}</span>`
          + `<span style="flex:1;height:5px;border-radius:3px;background:#e6eaf0;overflow:hidden"><i style="display:block;height:100%;width:${n/list.length*100}%;background:#f2c230"></i></span></div><div class="grid">`;
        for (const a of show){
          const on = !!P.a[a.id], hidden = a.secret && !on;
          const bar = a.stat && !on ? `<span style="display:block;height:4px;border-radius:2px;background:#e6eaf0;margin-top:4px;overflow:hidden"><i style="display:block;height:100%;width:${Math.min(1, (P.s[a.stat] || 0)/a.n)*100}%;background:#2f5d9e"></i></span><span style="font-size:11px">${Math.min(P.s[a.stat] || 0, a.n)} / ${a.n}</span>` : '';
          const when = on && P.a[a.id] > 1e12 ? ` · ${new Date(P.a[a.id]).toLocaleDateString('nl-BE')}` : '';
          h += `<div class="a${on ? '' : ' off'}"><span class="i">${hidden ? '❓' : a.icon}</span><div><b>${hidden ? 'Secret achievement' : esc(a.name)}</b>${hidden ? 'Keep exploring the office…' : esc(a.how)}${bar}<div style="font-size:11px;opacity:.8;margin-top:2px">${on ? '✅ ' : ''}${a.xp} XP${when}</div></div></div>`;
        }
        h += `</div>`;
      }
    } else {
      const who = me(), board = [...others.entries()].sort((a, b) => b[1].xp - a[1].xp).slice(0, 20);
      h += `<h2>👥 Leaderboard</h2><table>` + board.map(([id, o], i) => `<tr${who && id === who.id ? ' style="font-weight:600;background:#fff8e1"' : ''}><td>${i + 1}</td><td>${esc(o.n)}</td><td>⭐ ${levelOf(o.xp).lv} ${levelOf(o.xp).name}</td><td style="text-align:right">${o.xp} XP</td><td style="text-align:right">🏆 ${o.a}</td></tr>`).join('') + `</table>`;
    }
    panel.innerHTML = h + `<div class="note" style="margin-top:12px">Q or Esc closes · 1 2 3 switch tabs${window.__isTouch ? '' : ' · the mouse wheel scrolls'}</div></div>`;
  }

  // ---------- achievements that come from where you are and when ----------
  const seenRooms = new Set(); let lastZone = '', tickT = 0;
  function tick(){
    const who = me(); if (!who){ pill.style.display = 'none'; return; }
    if (loadedFor !== who.id){ load(); return; }
    folded.visible = !P.a.sweater_found;   // once found, the folded sweater is gone (for you)
    const now = performance.now(); if (now - tickT < 500) return; tickT = now;
    const s = G.state, z = s.zone || '', C = window.CLOCK, g = C && C.game ? C.game() : null, act = C && C.active ? C.active() : [];
    if (!s.started) return;
    if (z && z !== lastZone){ lastZone = z;
      if (!(P.r || (P.r = {}))[z]){ P.r[z] = 1; stat('rooms', 1); }   // P.r: rooms you've been in (kept with the progress)
      if (/upstairs/.test(z)) ach('upstairs'); if (s.lv === 2) ach('downstairs');
      if (z === 'Server room') ach('server_in'); if (z === 'CEO') ach('ceo_in');
    }
    if (g){
      const m = g.min, fri = g.wd === 4;
      if (m >= 420 && m < 450) ach('early');
      if (m >= 1380 || m < 300) ach('nightowl');
      if (z === 'Kitchen (3e)' && m >= 540 && m < 570 && daily('coffee', g.dayN)){ ach('coffee'); stat('coffee'); xp(5, 'Coffee at 9:00'); }
      if (z === 'Kitchen' && !fri && m >= 720 && m < 780 && daily('lunch', g.dayN)){ ach('lunch'); xp(5, 'Lunch'); }
      if (z === 'Kitchen' && fri && m >= 690 && m < 750 && daily('fries', g.dayN)){ ach('fries'); xp(10, 'Friday fries'); }
      if (z === 'Portus Ganda' && fri && m >= 900 && m < 960 && daily('meeting', g.dayN)){ ach('meeting'); xp(10, 'Friday team meeting'); }
      if (z === 'Stille ruimte' && fri && m >= 960 && m < 1140 && daily('afterwork', g.dayN)){ ach('afterwork'); xp(10, 'After work'); }
    }
    if (act.includes('fire') && /Stair/.test(z)) ach('n_fire');
    if (act.includes('server') && (z === 'Server room' || (s.lv === 0 && Math.hypot(s.x - 27.47, s.z - 7.6) < 3))) ach('n_server');
    if (act.includes('winupdate')) ach('n_update');
    const online = window.__onlineCount ? window.__onlineCount() : 1;
    if (online >= 2) ach('company'); if (online >= 5) ach('party');
  }

  refresh();
  return {tick, xp, ach, stat, daily, level, save, addSection: f => sections.push(f), refresh, get P(){ return P; }};
}
