// Emotes: G opens a wheel (move the mouse toward one and click, or press its number); on touch screens the 😀 button.
// Also from the chat: /wave, /cheer, /dance, … Everyone sees your avatar do it, with the emoji above your head.
// High five: two people facing each other who both do ✋ within a couple of seconds get a real one.
// Sent with your position (presence em = {k, t}); mp.js calls poseEmote for every avatar each frame.
import {play} from './sound.js';

const EMOTES = [
  {k: 'wave', icon: '👋', name: 'Wave', dur: 2.4},
  {k: 'hf', icon: '✋', name: 'High five', dur: 2.6},
  {k: 'cheer', icon: '🙌', name: 'Cheer', dur: 2.4},
  {k: 'clap', icon: '👏', name: 'Clap', dur: 2.6},
  {k: 'dance', icon: '💃', name: 'Dance', dur: 5},
  {k: 'thumb', icon: '👍', name: 'Thumbs up', dur: 2.2},
  {k: 'facepalm', icon: '🤦', name: 'Facepalm', dur: 2.6},
  {k: 'shrug', icon: '🤷', name: 'Shrug', dur: 2.2},
  {k: 'bow', icon: '🙇', name: 'Bow', dur: 2.2},
];
const BY = Object.fromEntries(EMOTES.map(e => [e.k, e]));
const HF_WINDOW = 2600, HF_DIST = 1.9;

let G, THREE, wheel, pop, mine = null, open = false, sel = -1, vec = {x: 0, y: 0}, prevLock = null, used = new Set(), hfDone = 0, partyDone = 0;
try { used = new Set(JSON.parse(localStorage.getItem('office.emotesUsed') || '[]')); } catch (e) {}
const isTouch = () => !!window.__isTouch;
const now = () => window.__serverNow ? window.__serverNow() : Date.now();
const players = () => (G.mp && G.mp.players) ? G.mp.players() : [];
function el(tag, css, parent){ const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; }

// ---------- doing one ----------
function emote(k){
  const E = BY[k]; if (!E || !G.mp || !G.state.started) return false;
  const t = now(); if (mine && t - mine.t < 600) return false;   // not faster than this
  mine = {k, t}; G.state.em = mine;
  pop.textContent = E.icon; pop.style.transition = 'none'; pop.style.opacity = '1'; pop.style.transform = 'translate(-50%,0) scale(1)';
  requestAnimationFrame(() => { pop.style.transition = 'opacity .6s 1s, transform 1.6s'; pop.style.opacity = '0'; pop.style.transform = 'translate(-50%,-60px) scale(1.25)'; });
  play(k === 'clap' ? 'block' : 'pop', k === 'clap' ? 0.25 : 0.4, 0);
  if (window.__ach){ window.__ach('e_first'); window.__stat('emotes'); if (!used.has(k)){ used.add(k); try { localStorage.setItem('office.emotesUsed', JSON.stringify([...used])); } catch (e) {} } if (used.size >= EMOTES.length) window.__ach('e_all'); }
  return true;
}
// "/wave" in the chat
window.__emoteCmd = text => { const w = String(text).slice(1).trim().toLowerCase(), E = EMOTES.find(e => e.k === w || e.name.toLowerCase().replace(/\s/g, '') === w.replace(/\s/g, '') || (w === 'highfive' && e.k === 'hf'));
  if (!E){ if (w === 'emotes' || w === 'help'){ window.__progToast && window.__progToast('Emotes', EMOTES.map(e => '/' + e.k).join(' ')); return true; } return false; } emote(E.k); return true; };

// ---------- the wheel ----------
function build(){
  wheel = el('div', 'position:fixed;left:50%;top:50%;width:300px;height:300px;margin:-150px 0 0 -150px;display:none;z-index:5;pointer-events:none');
  el('div', 'position:absolute;inset:60px;border-radius:50%;background:rgba(20,24,30,.55);display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;font-size:13px;line-height:1.35;padding:14px;box-sizing:border-box;pointer-events:auto', wheel).id = 'emoteMid';
  { const mid = wheel.querySelector('#emoteMid'), shut = e => { e.preventDefault(); e.stopPropagation(); closeWheel(); }; mid.addEventListener('touchend', shut); }   // touch: tap the middle to close
  EMOTES.forEach((E, i) => {
    const a = -Math.PI/2 + i/EMOTES.length*Math.PI*2, b = el('div', `position:absolute;left:${150 + Math.cos(a)*118 - 31}px;top:${150 + Math.sin(a)*118 - 31}px;width:62px;height:62px;border-radius:50%;background:rgba(20,24,30,.78);border:2px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;font-size:28px;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-select:none;transition:transform .08s`, wheel);
    b.textContent = E.icon; b.dataset.i = i;
    el('span', 'position:absolute;right:-2px;bottom:-2px;background:#fff;color:#1d2229;border-radius:8px;font-size:10px;font-weight:700;padding:0 4px;line-height:14px', b).textContent = i + 1;
    const go = e => { e.preventDefault(); e.stopPropagation(); choose(i); };
    b.addEventListener('click', go); b.addEventListener('touchend', go);
  });
  pop = el('div', 'position:fixed;left:50%;bottom:22%;transform:translate(-50%,0);font-size:64px;opacity:0;z-index:3;pointer-events:none;text-shadow:0 4px 14px rgba(0,0,0,.4)');
}
function paint(){
  [...wheel.querySelectorAll('[data-i]')].forEach((b, i) => { const on = i === sel; b.style.transform = on ? 'scale(1.18)' : 'scale(1)'; b.style.borderColor = on ? '#f2c230' : 'rgba(255,255,255,.35)'; b.style.background = on ? 'rgba(47,93,158,.95)' : 'rgba(20,24,30,.78)'; });
  wheel.querySelector('#emoteMid').innerHTML = sel >= 0 ? `<span><b style="font-size:15px">${EMOTES[sel].name}</b><br>${isTouch() ? 'tap it' : 'click or ' + (sel + 1)}</span>` : (isTouch() ? 'Tap an emote<br><span style="opacity:.7">or here to close</span>' : 'Move the mouse to pick<br>or press 1–9<br><span style="opacity:.7">G / Esc: close</span>');
}
function openWheel(){
  if (open) return closeWheel();
  if (!G.mp || !G.state.started || G.controlLock) return;
  open = true; sel = -1; vec = {x: 0, y: 0}; wheel.style.display = 'block'; paint();
  // while it is open the mouse picks an emote instead of turning your head
  G.controlLock = {emoteWheel: true, noPause: false,
    aim(dx, dy){ vec.x += dx; vec.y += dy; const l = Math.hypot(vec.x, vec.y); if (l > 90){ vec.x *= 90/l; vec.y *= 90/l; }
      const s = l < 24 ? -1 : ((Math.round((Math.atan2(vec.y, vec.x) + Math.PI/2)/(Math.PI*2)*EMOTES.length) % EMOTES.length) + EMOTES.length) % EMOTES.length; if (s !== sel){ sel = s; paint(); } },
    press(down){ if (down && !isTouch() && sel >= 0) choose(sel); }};
}
function closeWheel(){ if (!open) return; open = false; wheel.style.display = 'none'; if (G.controlLock && G.controlLock.emoteWheel) G.controlLock = null; }
function choose(i){ closeWheel(); emote(EMOTES[i].k); }
window.__openEmotes = openWheel;

function onKey(e){
  const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
  if (open){
    if (e.code === 'Escape' || e.code === 'KeyG'){ e.preventDefault(); e.stopImmediatePropagation(); closeWheel(); return; }
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code); if (m && +m[1] <= EMOTES.length){ e.preventDefault(); e.stopImmediatePropagation(); choose(+m[1] - 1); }
    return;
  }
  if (e.code === 'KeyG' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey){ openWheel(); }
}

// ---------- high fives and dance parties ----------
function social(){
  if (!mine) return; const t = now(), s = G.state;
  if (mine.k === 'hf' && t - mine.t < HF_WINDOW && hfDone !== mine.t){
    for (const p of players()){
      if (!p.em || p.em.k !== 'hf' || Math.abs(p.em.t - mine.t) > HF_WINDOW || (p.l || 0) !== s.lv) continue;
      const d = Math.hypot(p.x - s.x, p.z - s.z); if (d > HF_DIST) continue;
      hfDone = mine.t; play('block', 0.9, 0); setTimeout(() => play('pop', 0.6, 0), 60);
      window.__progToast && window.__progToast(`✋ High five with ${p.name}!`, '');
      if (window.__ach){ window.__stat('highFives'); window.__ach('e_hf'); }
      break;
    }
  }
  if (mine.k === 'dance' && t - mine.t < 5000 && partyDone !== mine.t){
    const n = players().filter(p => p.em && p.em.k === 'dance' && t - p.em.t < 5000 && (p.l || 0) === s.lv && Math.hypot(p.x - s.x, p.z - s.z) < 4).length;
    if (n >= 2){ partyDone = mine.t; if (window.__ach) window.__ach('e_party'); }
  }
}

// ---------- everyone else's avatars ----------
const texCache = {};
function emojiSprite(icon){
  let tex = texCache[icon];
  if (!tex){ const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.font = '96px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 64, 70);
    tex = texCache[icon] = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true, depthWrite: false})); sp.scale.set(0.42, 0.42, 1); return sp;
}
function poseEmote(obj, em, t){
  const U = obj.userData, L = U.limbs; if (!L) return;
  const E = em && BY[em.k], age = E ? (t - em.t)/1000 : 99;
  if (!E || age < -1 || age > E.dur){
    if (U.emote){ U.emote = null; L.armL.rotation.z = L.armR.rotation.z = 0; obj.rotation.x = 0; if (U.emoSprite){ obj.remove(U.emoSprite); U.emoSprite.material.dispose(); U.emoSprite = null; } }
    return;
  }
  if (U.emote !== em.t){
    U.emote = em.t; if (U.emoSprite){ obj.remove(U.emoSprite); U.emoSprite.material.dispose(); }
    U.emoSprite = emojiSprite(E.icon); obj.add(U.emoSprite);
    if (em.k === 'clap' || em.k === 'cheer'){ const s = G.state; if (Math.hypot(obj.position.x - s.x, obj.position.z - s.z) < 10) play(em.k === 'clap' ? 'block' : 'pop', 0.2, 0); }
  }
  const a = Math.max(0, age), inn = Math.min(1, a/0.2)*Math.min(1, (E.dur - a)/0.25), w = Math.sin(a*11), sp = U.emoSprite;
  sp.position.set(0, 2.32 + Math.min(0.25, a*0.5), 0); sp.material.opacity = Math.min(1, (E.dur - a)*2);
  let lx = null, rx = null, lz = 0, rz = 0, bx = 0, by = 0, yaw = 0;
  if (em.k === 'wave'){ rx = Math.PI*0.92; rz = 0.25 + 0.35*w; }
  else if (em.k === 'hf'){ rx = 2.45; rz = -0.15; }
  else if (em.k === 'cheer'){ lx = rx = Math.PI*0.95; lz = -0.3 - 0.12*w; rz = 0.3 + 0.12*w; by = Math.abs(Math.sin(a*7))*0.09; }
  else if (em.k === 'clap'){ lx = rx = 1.25; lz = 0.38 + 0.2*w; rz = -0.38 - 0.2*w; }
  else if (em.k === 'dance'){ const s2 = Math.sin(a*6.5); lx = 1.6 + 1.2*s2; rx = 1.6 - 1.2*s2; lz = -0.5; rz = 0.5; by = Math.abs(Math.sin(a*6.5))*0.07; yaw = 0.45*Math.sin(a*3.25); }
  else if (em.k === 'thumb'){ rx = 1.45; rz = -0.1; }
  else if (em.k === 'facepalm'){ rx = 2.75; rz = -0.55; bx = 0.08; }
  else if (em.k === 'shrug'){ lx = rx = 0.5; lz = -0.75; rz = 0.75; by = 0.03; }
  else if (em.k === 'bow'){ bx = 0.55*Math.sin(Math.min(1, a/E.dur)*Math.PI); lx = rx = 0.2; }
  if (lx !== null) L.armL.rotation.x += (lx - L.armL.rotation.x)*inn;
  if (rx !== null) L.armR.rotation.x += (rx - L.armR.rotation.x)*inn;
  L.armL.rotation.z = lz*inn; L.armR.rotation.z = rz*inn;
  obj.rotation.x = bx*inn; obj.rotation.y += yaw*inn; obj.position.y += by*inn;
}

function tick(){
  if (!G) return '';
  if (mine && now() - mine.t > 8000){ mine = null; G.state.em = null; }
  if (open && (!G.state.started || (G.controlLock && !G.controlLock.emoteWheel))) closeWheel();
  social();
  return '';
}
function init(){
  G = window.GAME; THREE = G.THREE; build();
  addEventListener('keydown', onKey, true);
  G.poseEmote = poseEmote;
  G.uses.push({tick, use: () => false});
}
window.EMOTES = {emote, list: EMOTES, get mine(){ return mine; }, get open(){ return open; }};   // for testing in the console
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
