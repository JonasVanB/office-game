// Daily IT tickets: every game day 6 tickets come in through the day (the same ones for everyone), each with a
// priority and an SLA. Go to the room and press E to fix it (a few seconds), or fetch something and bring it.
// Solving gives XP (P1 40, P2 25, P3 15; half after the SLA). Your own progress per day is kept with your profile.
import {play} from './sound.js';

const LO = -3.06;
// kind 'fix': zone + seconds; kind 'fetch': from zone (pick up `item`) → to zone. pt = minimap marker [x, z, level]. lv = level needed
const POOL = [
  {id: 'printer', icon: '🖨️', title: 'Printer jammed in the Print room', zone: 'Print', pt: [16.6, 8.8, 0], secs: 3},
  {id: 'toner', icon: '🖨️', title: 'Print room is out of toner', from: 'Admin storage', fpt: [15.5, 11.5, 0], item: '🖨️ toner cartridge', zone: 'Print', pt: [16.6, 8.8, 0], lv: 3},
  {id: 'wifi', icon: '📶', title: 'Wi-Fi keeps dropping in Portus Ganda: reboot the access point', zone: 'Portus Ganda', pt: [21, 10.3, 0], secs: 4},
  {id: 'rabot', icon: '📺', title: 'Rabot: the TV says "No signal"', zone: 'Rabot', pt: [23.5, 2.2, 0], secs: 3},
  {id: 'prinsenhof', icon: '🎥', title: 'Prinsenhof: the Teams Room camera is frozen', zone: 'Prinsenhof', pt: [26.5, 2.2, 0], secs: 3},
  {id: 'hr', icon: '🔑', title: "HR laptop won't connect to the VPN", zone: 'Duivelsteen (HR)', pt: [37, 2.6, 0], secs: 4},
  {id: 'coffee3', icon: '☕', title: 'Coffee machine (3e) says "Descale now"', zone: 'Kitchen (3e)', pt: [35.6, 12, 2], secs: 5},
  {id: 'coffee4', icon: '☕', title: 'Coffee machine (4e): the grinder is stuck', zone: 'Kitchen', pt: [39.6, 11.2, 0], secs: 4},
  {id: 'disk', icon: '🖥️', title: 'Disk C: on SQL-PROD-01 is full: clean up the logs', zone: 'Server room', pt: [26.7, 10.3, 0], secs: 5, lv: 4},
  {id: 'backup', icon: '💾', title: "Last night's backup failed: restart the job", zone: 'Server room', pt: [26.7, 10.3, 0], secs: 4, lv: 4},
  {id: 'password', icon: '🔐', title: 'Reset a password at the Service Desk', zone: 'Service Desk', pt: [46, 8.5, 2], secs: 3},
  {id: 'demo', icon: '🖥️', title: 'Gravensteen: set up the screen for the client demo', zone: 'Gravensteen', pt: [46.5, 3, 2], secs: 4},
  {id: 'hdmi', icon: '🔌', title: 'Belfort has no HDMI cable', from: 'Utility', fpt: [31.5, 11.8, 0], item: '🔌 HDMI cable', zone: 'Belfort', pt: [40, 9.6, 2], lv: 2},
  {id: 'graslei', icon: '📡', title: 'Graslei (upstairs): the room display is offline', zone: 'Graslei (upstairs)', pt: [40.5, 4.2, 0], secs: 3},
  {id: 'drinks', icon: '🥤', title: 'The fridge in the 4e kitchen is empty', from: 'Drinks storage', fpt: [49.5, 10, 0], item: '🥤 crate of Cola Zero', zone: 'Kitchen', pt: [40.5, 10.5, 0], lv: 3},
  {id: 'dock', icon: '💻', title: "Boekentoren: a laptop won't dock", zone: 'Boekentoren', pt: [37, 10.3, 0], secs: 3},
  {id: 'driver', icon: '🖨️', title: 'Management: install the new printer driver', zone: 'Management', pt: [20, 3, 0], secs: 4},
  {id: 'mouse', icon: '🖱️', title: 'Landscape: a wireless mouse needs new batteries', zone: 'Landscape', pt: [7, 6.5, 0], secs: 2},
  {id: 'sound', icon: '🔊', title: 'Vlasmarkt: no sound in the Teams call', zone: 'Vlasmarkt', pt: [36.5, 3.8, 2], secs: 3},
  {id: 'outlook', icon: '👔', title: 'CEO: Outlook keeps crashing', zone: 'CEO', pt: [16, 3.6, 0], secs: 5, lv: 4},
  {id: 'router', icon: '🌐', title: 'Utility room: the router blinks red', zone: 'Utility', pt: [31.5, 11.8, 0], secs: 4, lv: 2},
  {id: 'meetcoffee', icon: '☕', title: 'Bring a coffee to Portus Ganda for the team meeting', from: 'Kitchen (3e)', fpt: [35.6, 12, 2], item: '☕ coffee', zone: 'Portus Ganda', pt: [21, 10.3, 0], friday: true},
];
const RELEASE = [500, 560, 640, 760, 840, 920];   // 8:20, 9:20, 10:40, 12:40, 14:00, 15:20
const PRIO = {1: {xp: 40, sla: 90, col: '#c0392b'}, 2: {xp: 25, sla: 180, col: '#e67e22'}, 3: {xp: 15, sla: 300, col: '#2f5d9e'}};
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
const hhmm = m => String(Math.floor(m/60) % 24).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

// the day's tickets: the same for everyone (seeded by the game day)
function ticketsFor(dayN, wd){
  const R = rng(dayN*977 + 31), pool = POOL.filter(t => !t.friday || wd === 4), out = [];
  if (wd === 4){ const c = pool.find(t => t.id === 'meetcoffee'); out.push(Object.assign({}, c, {at: 760, prio: 2})); pool.splice(pool.indexOf(c), 1); }
  while (out.length < RELEASE.length && pool.length){ const t = pool.splice(R()*pool.length | 0, 1)[0]; const r = R(); out.push(Object.assign({}, t, {prio: r < 0.2 ? 1 : r < 0.6 ? 2 : 3})); }
  const times = RELEASE.slice(); out.forEach(t => { if (t.at == null) t.at = times.shift(); else times.splice(times.indexOf(t.at), 1); });
  out.forEach(t => { t.due = t.id === 'meetcoffee' ? 900 : Math.min(1020, t.at + PRIO[t.prio].sla); });
  return out.sort((a, b) => a.at - b.at);
}

export function initTickets({G, prog, me}){
  const tracker = document.createElement('div');
  tracker.style.cssText = 'position:fixed;left:10px;background:rgba(20,24,30,.62);color:#fff;border-radius:10px;padding:5px 10px 6px;font-size:12px;z-index:2;max-width:min(330px,60vw);cursor:pointer;display:none;line-height:1.35';
  tracker.title = 'Tickets (Q)'; document.body.appendChild(tracker);
  tracker.addEventListener('click', () => window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyQ'})));
  let day = null, list = [], work = null, carrying = null, lastA = null, trackKey = '';

  const game = () => window.CLOCK && window.CLOCK.game ? window.CLOCK.game() : null;
  // today's ticket state. Firebase drops empty objects, so a saved {day, done: {}, got: {}} comes back as just {day}: fill the gaps
  const state = () => { const P = prog.P; const tk = P.tk && P.tk.day === day ? P.tk : (P.tk = {day}); tk.done = tk.done || {}; tk.got = tk.got || {}; return tk; };
  const open = g => list.filter(t => g.min >= t.at && !state().done[t.id]);
  const late = (t, g) => g.min > t.due;
  const canDo = t => !t.lv || prog.level() >= t.lv;

  function solve(t, g){
    const s = state(), isLate = late(t, g), xp = Math.round(PRIO[t.prio].xp*(isLate ? 0.5 : 1));
    s.done[t.id] = isLate ? 'late' : 'ok'; delete s.got[t.id]; prog.save(); if (carrying && carrying.id === t.id) carrying = null;
    prog.xp(xp, `Ticket solved: ${t.title}` + (isLate ? ' (after the SLA)' : ''));
    prog.stat('tickets'); if (t.prio === 1 && !isLate) prog.ach('p1'); if (isLate) prog.ach('late');
    if (list.every(x => s.done[x.id])) prog.ach('inbox0');
    play('ding', 0.6, 0); prog.refresh();
  }

  // E: start fixing, pick up or deliver
  (window.__useHooks = window.__useHooks || []).push(() => {
    const g = game(), z = G.state.zone; if (!g || !me() || !G.state.started || work) return false;
    const s = state();
    for (const t of open(g)){
      if (t.from && !s.got[t.id] && z === t.from && canDo(t)){ s.got[t.id] = 1; carrying = t; prog.save(); play('pop', 0.6, 0); prog.refresh(); return true; }
      if (t.from && s.got[t.id] && z === t.zone){ solve(t, g); return true; }
      if (!t.from && z === t.zone && canDo(t)){ work = {t, start: performance.now(), zone: z}; return true; }
    }
    return false;
  });
  // the prompt: what you can do here, or how far the fix is
  (window.__hintHooks = window.__hintHooks || []).push(() => {
    const g = game(), z = G.state.zone; if (!g || !me() || !G.state.started) return '';
    const act = window.__isTouch ? 'Tap' : 'Press E';
    if (work){
      if (z !== work.zone){ work = null; return 'Fix cancelled: you walked away'; }
      const p = (performance.now() - work.start)/1000/work.t.secs;
      if (p >= 1){ const t = work.t; work = null; solve(t, g); return ''; }
      return `🔧 Fixing: ${work.t.title} ${'▮'.repeat(Math.round(p*10))}${'▯'.repeat(10 - Math.round(p*10))}`;
    }
    const s = state();
    for (const t of open(g)){
      if (t.from && !s.got[t.id] && z === t.from) return canDo(t) ? `${act} to pick up the ${t.item} (ticket: ${t.title})` : '';
      if (t.from && s.got[t.id] && z === t.zone) return `${act} to deliver the ${t.item}`;
      if (!t.from && z === t.zone) return canDo(t) ? `🎫 ${act} to fix: ${t.title}` : `🎫 ${t.title} · needs level ${t.lv}`;
    }
    return '';
  });

  // the panel section (Q)
  prog.addSection(() => {
    const g = game(); if (!g) return '';
    const s = state(), shown = list.filter(t => g.min >= t.at);
    let h = `<h2>🎫 Tickets today · ${Object.keys(s.done).length} of ${list.length} solved</h2>`;
    if (!shown.length) h += `<div class="note">No tickets yet. The first one comes in at ${hhmm(list[0] ? list[0].at : 500)}.</div>`;
    for (const t of shown){
      const d = s.done[t.id], where = t.from ? `${t.item} from ${t.from} → ${t.zone}` : t.zone;
      const status = d ? (d === 'ok' ? '✅ solved' : '✅ solved late') : late(t, g) ? `⚠️ SLA breached (${hhmm(t.due)})` : `⏳ before ${hhmm(t.due)}`;
      h += `<div class="tk${d ? ' done' : ''}"><span class="pr" style="background:${PRIO[t.prio].col}">P${t.prio}</span><div style="flex:1"><b>${t.icon} ${esc(t.title)}</b><div class="note">${esc(where)} · ${status} · ${PRIO[t.prio].xp} XP${t.lv && !canDo(t) ? ` · 🔒 needs level ${t.lv}` : ''}${s.got[t.id] ? ' · carrying it' : ''}</div></div></div>`;
    }
    const next = list.find(t => g.min < t.at); if (next) h += `<div class="note">Next ticket at ${hhmm(next.at)}.</div>`;
    return h;
  });

  // minimap: a ring on the tracked ticket
  const prevMap = window.__drawMapExtra;
  window.__drawMapExtra = (ctx, PAD, MS, level) => {
    if (prevMap) prevMap(ctx, PAD, MS, level);
    const t = tracked; if (!t) return; const s = state(), p = t.from && !s.got[t.id] ? t.fpt : t.pt; if (!p || (p[2] === 2 ? 2 : 0) !== level) return;
    const r = 5 + 2*Math.sin(performance.now()/200); ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(PAD + p[0]*MS, PAD + p[1]*MS, r, 0, Math.PI*2); ctx.stroke();
  };

  let tracked = null;
  return {update(){
    const g = game(), who = me(); if (!g || !who){ tracker.style.display = 'none'; return; }
    if (g.dayN !== day){ day = g.dayN; list = ticketsFor(day, g.wd); carrying = null; work = null; }
    // new tickets coming in
    if (lastA !== null && lastA.day === day && g.min > lastA.min && g.min - lastA.min < 30) for (const t of list) if (t.at > lastA.min && t.at <= g.min){
      play('beep', 0.3, 0); window.__progToast && window.__progToast(`🎫 New ticket · P${t.prio}`, `${t.icon} ${t.title}`);
    }
    lastA = {day, min: g.min};
    const s = state(), op = open(g).sort((a, b) => a.prio - b.prio || a.due - b.due);
    tracked = op.find(t => canDo(t)) || op[0] || null;
    const go = document.getElementById('lvPill'); if (go && go.style.display !== 'none') tracker.style.top = (go.offsetTop + go.offsetHeight + 6) + 'px';
    const key = (tracked ? tracked.id + (s.got[tracked.id] ? 'g' : '') + late(tracked, g) : '-') + op.length + Math.floor(g.min/10);
    if (key === trackKey) return; trackKey = key;
    if (!tracked){ tracker.style.display = g.min >= 420 && g.min < 1020 ? 'block' : 'none'; tracker.innerHTML = `🎫 No open tickets` + (list.find(t => g.min < t.at) ? ' · more coming' : ' · inbox zero 🎉'); return; }
    const t = tracked, where = t.from && !s.got[t.id] ? `get ${t.item} in ${t.from}` : t.from ? `bring it to ${t.zone}` : t.zone;
    const left = t.due - g.min;
    tracker.innerHTML = `🎫 <b>${op.length} open</b> · <span style="background:${PRIO[t.prio].col};border-radius:5px;padding:0 5px;font-weight:700">P${t.prio}</span> ${esc(t.title)}<br><span style="opacity:.8">→ ${esc(where)} · ${left >= 0 ? `${Math.floor(left/60)}h${String(left % 60 | 0).padStart(2, '0')} left` : 'SLA breached'}${t.lv && !canDo(t) ? ` · 🔒 level ${t.lv}` : ''}</span>`;
    tracker.style.display = 'block';
  }};
}
