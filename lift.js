// The lifts: E at a lift door (4e, 3e or 2e) opens a small panel; pick a floor (number keys 4 / 3 / 2, or tap) and you step out
// of the same lift on that floor. The only way down to the 2e verdiep (the stairs stop at the 3e).
import {play} from './sound.js';

const LIFTS = [[29.23, 30.46], [31.5, 32.73]], DOORZ = 5.32;
const FLOORS = [{n: 4, name: '4e verdiep', mode: 0, lv: 0, y: 0}, {n: 3, name: '3e verdiep', mode: 2, lv: 2, y: -3.06}, {n: 2, name: '2e verdiep', mode: 5, lv: 5, y: -6.12}];
let G, panel = null, open = false, busy = false, which = 0;

const nearLift = s => { if (!FLOORS.some(f => f.lv === s.lv) || s.z < DOORZ || s.z > DOORZ + 1.3) return -1;
  return LIFTS.findIndex(([a, b]) => s.x > a - 0.2 && s.x < b + 0.2); };
const here = () => FLOORS.find(f => f.lv === G.state.lv);

function show(){
  const cur = here(); open = true;
  panel.innerHTML = '<div style="font:700 17px system-ui,sans-serif;margin-bottom:8px">🛗 Lift</div>';
  for (const f of FLOORS){
    const b = document.createElement('button'), mine = f === cur;
    b.textContent = `${window.__isTouch ? '' : f.n + ' · '}${f.name}${mine ? ' (you are here)' : ''}${f.lv === 5 ? ' · 🎯 Paintball' : f.lv === 2 ? ' · 🕵️ The Mole' : ''}`;
    b.disabled = mine; b.style.cssText = `display:block;width:100%;margin-top:6px;padding:10px 12px;border:0;border-radius:10px;font:600 15px system-ui,sans-serif;text-align:left;cursor:${mine ? 'default' : 'pointer'};background:${mine ? '#e6e8ec' : '#eef3fb'};color:${mine ? '#8a9099' : '#1d2229'}`;
    const go = e => { e.preventDefault(); e.stopPropagation(); ride(f); }; b.addEventListener('click', go); b.addEventListener('touchend', go);
    panel.appendChild(b);
  }
  const hint = document.createElement('div'); hint.style.cssText = 'font-size:12px;color:#5a6472;margin-top:8px'; hint.textContent = window.__isTouch ? 'Tap a floor' : 'Number key or click · Esc / E: close'; panel.appendChild(hint);
  panel.style.display = 'block';
  G.controlLock = {noPause: true, aim(){}, press(){}};
  play('ding', 0.6, 0);
}
function close(){ if (!open) return; open = false; panel.style.display = 'none'; if (G.controlLock && G.controlLock.noPause && !busy) G.controlLock = null; }
function ride(f){
  if (busy || f === here()) return;
  busy = true; open = false; panel.style.display = 'none';
  const fade = document.createElement('div'); fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .35s;z-index:7;pointer-events:none'; document.body.appendChild(fade);
  requestAnimationFrame(() => fade.style.opacity = 0.92);
  play('lift', 0.8, 0);
  setTimeout(() => {
    const [a, b] = LIFTS[which]; G.setMode(f.mode); G.setView((a + b)/2, DOORZ + 0.55, Math.PI, 0);
    G.controlLock = null; busy = false; fade.style.opacity = 0; setTimeout(() => fade.remove(), 450);
    if (window.__progToast) window.__progToast(`🛗 ${f.name}`, f.lv === 5 ? 'The paintball arena is through the door on your left' : '');
  }, 700);
}
function init(){
  G = window.GAME;
  panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);display:none;z-index:6;background:#fff;color:#1d2229;border-radius:16px;padding:16px 18px 14px;width:min(320px,86vw);box-shadow:0 10px 40px rgba(0,0,0,.35)';
  document.body.appendChild(panel);
  addEventListener('keydown', e => {
    if (!open) return; const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
    const m = /^(?:Digit|Numpad)([2-4])$/.exec(e.code);
    if (m){ e.preventDefault(); e.stopImmediatePropagation(); const f = FLOORS.find(x => x.n === +m[1]); if (f) ride(f); }
    else if (e.code === 'Escape' || e.code === 'KeyE'){ e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  G.uses.unshift({
    tick(){ const s = G.state; if (open || busy || !s.started || G.controlLock) return ''; return nearLift(s) >= 0 ? (window.__isTouch ? 'Tap' : 'Press E') + ' to call the lift 🛗' : ''; },
    use(){ const s = G.state; if (busy) return true; if (open){ close(); return true; } if (!s.started || G.controlLock) return false; const i = nearLift(s); if (i < 0) return false; which = i; show(); return true; },
  });
}
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
