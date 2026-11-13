// Daily quests: three small goals every real day (the same three for everyone, picked from the date), counted from the
// stats every game already reports (window.__stat). Each quest gives XP; finishing all three gives a bonus and keeps
// your streak going. Saved with your progress (P.q), so they follow you to another device.
import {play} from './sound.js';

// kind: what the quest counts. stat = a progress counter (window.__stat); zones = different rooms visited today
const POOL = {
  move: [
    {id: 'rooms', icon: '🗺️', text: 'Visit 8 different rooms', zones: 8, xp: 25},
    {id: 'doors', icon: '🚪', text: 'Open 15 doors', stat: 'doors', n: 15, xp: 20},
    {id: 'jumps', icon: '🦘', text: 'Jump 30 times', stat: 'jumps', n: 30, xp: 20},
    {id: 'sits', icon: '🪑', text: 'Sit down on 3 different chairs', stat: 'sits', n: 3, xp: 20},
    {id: 'coffee', icon: '☕', text: 'Drink 2 coffees', stat: 'coffee', n: 2, xp: 25},
    {id: 'toilet', icon: '🚽', text: 'Go to the toilet', stat: 'toilet', n: 1, xp: 20},
  ],
  social: [
    {id: 'emotes', icon: '👋', text: 'Use 5 emotes (G)', stat: 'emotes', n: 5, xp: 20},
    {id: 'highfive', icon: '✋', text: 'High-five a colleague', stat: 'highFives', n: 1, xp: 35},
    {id: 'chat', icon: '💬', text: 'Say something in the chat 3 times', stat: 'chat', n: 3, xp: 20},
    {id: 'draw', icon: '🖊️', text: 'Draw on a whiteboard', stat: 'boardStrokes', n: 10, xp: 20},
    {id: 'tickets', icon: '🎫', text: 'Solve 2 IT tickets', stat: 'tickets', n: 2, xp: 30},
  ],
  game: [
    {id: 'race', icon: '🏁', text: 'Finish a chair race on the rooftop', stat: 'races', n: 1, xp: 35},
    {id: 'laps', icon: '🪑', text: 'Drive 5 laps on the rooftop track', stat: 'raceLaps', n: 5, xp: 35},
    {id: 'dance', icon: '🕺', text: 'Dance 2 songs in Portus Ganda', stat: 'danceSongs', n: 2, xp: 35},
    {id: 'box', icon: '🥊', text: 'Box a fight in Gravensteen', stat: 'boxFights', n: 1, xp: 35},
    {id: 'darts', icon: '🎯', text: 'Play a game of darts', stat: 'dartsGames', n: 1, xp: 30},
  ],
};
const ALL_BONUS = 50;
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
// today's date in Belgium (quests change at midnight there, for everyone at once)
function today(){
  const now = window.__serverNow ? window.__serverNow() : Date.now();
  try { return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now); }
  catch (e) { return new Date(now).toISOString().slice(0, 10); }
}
const dayNum = d => Math.round(Date.parse(d + 'T12:00:00Z')/86400000);
export function questsFor(d){
  const R = rng(dayNum(d)*7349 + 11), pick = list => list[(R()*list.length)|0];
  return [pick(POOL.move), pick(POOL.social), pick(POOL.game)];
}

export function initQuests({G, prog, me}){
  let list = [], day = '', lastZone = '', lastKey = '';
  // P.q = {day, base: {stat: count at the start of the day}, zones: [..], done: {id: 1}, all: 0|1, streak, last: 'yyyy-mm-dd'}
  const state = () => { const P = prog.P; if (!P.q || P.q.day !== day) newDay(); return P.q; };
  function newDay(){
    const P = prog.P, old = P.q || {};
    P.q = {day, base: Object.assign({}, P.s), zones: [], done: {}, all: 0, streak: old.streak || 0, last: old.last || ''};
    prog.save();
  }
  const count = (q, s) => q.zones ? s.zones.length : Math.max(0, (prog.P.s[q.stat] || 0) - (s.base[q.stat] || 0));
  const goal = q => q.zones || q.n;

  function check(){
    const s = state(); let changed = false;
    for (const q of list){
      if (s.done[q.id] || count(q, s) < goal(q)) continue;
      s.done[q.id] = 1; changed = true;
      play('ding', 0.7, 0); window.__progToast && window.__progToast(`📅 Daily quest done: ${q.icon} ${q.text}`, `+${q.xp} XP`);
      prog.xp(q.xp, 'Daily quest'); prog.stat('quests'); prog.ach('q_first');
    }
    if (!s.all && list.length && list.every(q => s.done[q.id])){
      s.all = 1; changed = true;
      const yesterday = new Date(Date.parse(day + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
      s.streak = s.last === yesterday ? (s.streak || 0) + 1 : 1; s.last = day;
      prog.xp(ALL_BONUS + Math.min(5, s.streak - 1)*10, `All daily quests done${s.streak > 1 ? ` · ${s.streak}-day streak 🔥` : ''}`);
      prog.ach('q_all'); if (s.streak >= 3) prog.ach('q_streak');
      play('cheer', 0.6, 0);
    }
    if (changed){ prog.save(); prog.refresh(); }
  }

  // the panel (Q): today's quests with progress bars
  prog.addSection(() => {
    if (!me() || !list.length) return '';
    const s = state(), n = list.filter(q => s.done[q.id]).length;
    let h = `<h2>📅 Daily quests · ${n} of ${list.length} done${s.streak > 0 && (s.last === day || n < list.length) ? ` · 🔥 ${s.streak}-day streak` : ''}</h2>`;
    for (const q of list){
      const c = Math.min(goal(q), count(q, s)), d = !!s.done[q.id];
      h += `<div class="tk${d ? ' done' : ''}"><span style="font-size:20px;width:26px;text-align:center;flex:none">${d ? '✅' : q.icon}</span><div style="flex:1"><b>${esc(q.text)}</b>`
        + `<div class="note">${c} / ${goal(q)} · ${q.xp} XP</div><span style="display:block;height:4px;border-radius:2px;background:#e6eaf0;margin-top:4px;overflow:hidden"><i style="display:block;height:100%;width:${c/goal(q)*100}%;background:${d ? '#2f9e5b' : '#2f5d9e'}"></i></span></div></div>`;
    }
    h += `<div class="note">All three: +${ALL_BONUS} XP bonus (more with a streak). New quests every day at midnight.</div>`;
    return h;
  });
  // a small counter in the level pill
  window.__questPill = () => { if (!me() || !list.length) return ''; const s = state(), n = list.filter(q => s.done[q.id]).length; return ` · 📅 ${n}/${list.length}`; };

  let acc = 0;
  return {update(){
    if (!me() || !prog.P || !prog.P.s) return;
    const d = today(); if (d !== day){ day = d; list = questsFor(d); state(); prog.refresh(); }
    const z = G.state.zone; if (z && z !== lastZone){ lastZone = z; const s = state(); if (!s.zones.includes(z)){ s.zones.push(z); prog.save(); } }
    acc++; if (acc % 15) return;   // a few times a second is plenty
    check();
    const s = state(), key = list.map(q => s.done[q.id] ? 1 : 0).join('') + s.zones.length;
    if (key !== lastKey){ lastKey = key; prog.refresh(); }
  }, list: () => list, day: () => day};
}
