// Post-it high jump: on the wall above the emergency door in the Stille ruimte (x = 50).
// Jump (Space) and press Space again in the air: your post-it sticks as high as your hand reaches at that moment.
// A run-up (Shift + forward) gives a higher jump. Every player keeps their best post-it; only the 25 highest stay on the wall.
import {play} from './sound.js';

const WALLX = 49.955;               // just in front of the end wall
const Z0 = 4.15, Z1 = 6.95;          // wall part above the closets and the emergency door
const REACH = 2.1;                  // hand height standing (eye 1.65 + arm)
const MINH = 2.3, MAXH = 3.05;      // lower, the closets hide it; the wall ends at 3.1
const TOP = 25;
const COLORS = ['#ffe866', '#ffb3c7', '#b8f0a0', '#a8d8ff', '#ffc680'];
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const fmt = h => h.toFixed(2).replace('.', ',') + ' m';

const CSS = `
#ptHint{position:fixed;left:50%;bottom:22%;transform:translateX(-50%);background:rgba(20,24,30,.72);color:#fff;border-radius:10px;padding:8px 14px;font-size:14px;text-align:center;max-width:86vw;pointer-events:none;display:none;z-index:2}
#ptHint b{color:#ffe866}
#ptToast{position:fixed;left:50%;top:30%;transform:translate(-50%,-50%) scale(.9);background:rgba(20,24,30,.85);color:#fff;border-radius:14px;padding:12px 20px;font-size:20px;font-weight:600;text-align:center;max-width:86vw;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;z-index:3}
#ptToast.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
#ptToast small{display:block;font-size:13px;font-weight:400;opacity:.85;margin-top:3px}
`;

export function initPostits({G, net, me}){
  const THREE = G.THREE, entries = new Map(), meshes = new Map(), wall = new THREE.Group(); G.scene.add(wall);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const hint = document.createElement('div'); hint.id = 'ptHint'; document.body.appendChild(hint);
  const toastEl = document.createElement('div'); toastEl.id = 'ptToast'; document.body.appendChild(toastEl);
  let toastT = 0;
  function toast(title, sub){ toastEl.innerHTML = ''; toastEl.append(title); if (sub){ const s = document.createElement('small'); s.textContent = sub; toastEl.append(s); }
    toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 3200); }

  // ---------- the wall: a title and a measuring tape ----------
  function planeTex(w, h, draw, pw, ph){
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({map: t, roughness: 0.9, transparent: true}));
    m.rotation.y = -Math.PI/2; return m;
  }
  const title = planeTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#1d2229'; g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, h, 24) : g.rect(0, 0, w, h); g.fill();
    g.fillStyle = '#ffe866'; g.font = '700 58px system-ui,Segoe UI,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('📝 POST-IT HIGH JUMP · TOP 25', w/2, h/2 + 3);
  }, 1.3, 0.16);
  title.position.set(WALLX - 0.003, 3.0, 5.25); wall.add(title);
  // measuring tape from 2.10 to 3.05 m, every 5 cm
  const tape = planeTex(96, 1024, (g, w, h) => {
    g.fillStyle = '#f4d03f'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2229'; g.font = '700 22px system-ui,sans-serif'; g.textBaseline = 'middle';
    for (let cm = 210; cm <= 305; cm += 5){ const y = h - (cm - 210)/95*h; const big = cm % 10 === 0; g.fillRect(0, y - 1.5, big ? 40 : 22, 3); if (big && cm < 305 && cm > 210) g.fillText((cm/100).toFixed(1).replace('.', ',') + (cm % 50 === 0 ? '' : ''), 44, y); }
  }, 0.08, 0.95);
  tape.position.set(WALLX - 0.003, 2.1 + 0.95/2, Z0 - 0.08); wall.add(tape);

  // ---------- post-its ----------
  function makePostit(id, e, rank){
    const col = e.c || COLORS[hash(id) % COLORS.length];
    const m = planeTex(256, 256, (g, w, h) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, h*0.7, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 0, w, 34);                                   // sticky strip
      g.fillStyle = '#20232a'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = 64, font = s => `700 ${s}px "Segoe Print","Comic Sans MS","Bradley Hand",cursive`;
      g.font = font(size); while (size > 26 && g.measureText(e.n).width > w - 30){ size -= 4; g.font = font(size); }
      g.fillText(e.n, w/2, h*0.48);
      g.font = '600 34px system-ui,sans-serif'; g.fillStyle = '#4a4f57'; g.fillText((rank === 0 ? '🏆 ' : '#' + (rank + 1) + ' · ') + fmt(e.h), w/2, h*0.8);
    }, 0.2, 0.2);
    const r = (hash(id + 'r') % 1000)/1000;
    m.rotation.z = (r - 0.5)*0.25;
    m.position.set(WALLX - 0.004 - rank*0.0015, e.h - 0.1, Math.max(Z0 + 0.1, Math.min(Z1 - 0.1, e.z)));
    return m;
  }
  function ranked(){ return [...entries.entries()].sort((a, b) => b[1].h - a[1].h || (a[1].t || 0) - (b[1].t || 0)); }
  function render(){
    for (const m of meshes.values()){ wall.remove(m); m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); }
    meshes.clear();
    ranked().slice(0, TOP).forEach(([id, e], i) => { const m = makePostit(id, e, i); wall.add(m); meshes.set(id, m); });
  }
  const rankOf = id => ranked().findIndex(([k]) => k === id);

  // ---------- shared data ----------
  const since = performance.now(); let renderQueued = false;
  net.onPostits((id, v) => {
    const old = entries.get(id);
    if (!v || typeof v.h !== 'number' || typeof v.n !== 'string'){ entries.delete(id); }
    else {
      entries.set(id, {n: String(v.n).slice(0, 20), h: Math.max(MINH, Math.min(MAXH, v.h)), z: +v.z || 6, c: COLORS.includes(v.c) ? v.c : null, t: v.t || 0});
      const m = me();
      // someone else takes the lead: tell everyone
      if (performance.now() - since > 3000 && (!m || id !== m.id) && (!old || old.h < v.h) && rankOf(id) === 0)
        toast(`🏆 ${v.n} stuck a post-it at ${fmt(v.h)}!`, 'New record on the post-it wall in the Stille ruimte');
    }
    if (!renderQueued){ renderQueued = true; setTimeout(() => { renderQueued = false; render(); }, 50); }
  });

  // ---------- jumping and sticking ----------
  const inZone = () => { const s = G.state; return s.lv === 0 && s.y < 1.2 && s.x > 48.4 && s.z > Z0 - 0.6 && s.z < Z1 + 0.1; };
  let lastStick = 0, stuckThisJump = false;
  G.onAirJump = hopY => {
    if (!inZone() || stuckThisJump || performance.now() - lastStick < 800) return;
    stuckThisJump = true; lastStick = performance.now();
    const h = Math.round((REACH + hopY)*100)/100, who = me();
    if (!who){ toast('Sign in to stick a post-it'); return; }
    if (h < MINH){ toast(`${fmt(h)}: too low`, 'Press Space again right at the top of your jump. A run-up (Shift) helps'); play('pop', 0.3); return; }
    const prev = entries.get(who.id);
    if (prev && prev.h >= h){ toast(`${fmt(h)}`, `Not higher than your best (${fmt(prev.h)}). Try again!`); play('pop', 0.3); return; }
    const e = {n: who.name, h: Math.min(MAXH, h), z: Math.max(Z0 + 0.1, Math.min(Z1 - 0.1, G.state.z)), c: COLORS[hash(who.id) % COLORS.length], t: Date.now()};
    entries.set(who.id, e); net.setPostit(who.id, e); render(); play('pop', 0.8);
    const rank = rankOf(who.id);
    toast(`📝 ${fmt(e.h)}!`, rank === 0 ? 'The highest post-it on the wall! 🏆' : `You're #${rank + 1} on the wall` + (rank >= TOP ? ', not in the top 25 yet' : ''));
    // only the 25 highest stay
    ranked().slice(TOP).forEach(([id]) => { entries.delete(id); net.removePostit(id); });
  };

  let hintKey = '';
  return {update(){
    if (G.state.hop === 0) stuckThisJump = false;
    const z = inZone(), who = me(), best = who && entries.get(who.id);
    const key = z ? (best ? best.h + '|' + rankOf(who.id) : '-') : '';
    if (key === hintKey) return; hintKey = key;
    if (!z){ hint.style.display = 'none'; return; }
    hint.innerHTML = window.__isTouch ? '📝 <b>Post-it high jump</b>: tap ⤒ to jump, tap again at the top to stick your post-it'
                                      : '📝 <b>Post-it high jump</b>: Space to jump, Space again at the top to stick your post-it. Shift + W for a run-up';
    if (best){ const s = document.createElement('div'); s.textContent = `Your best: ${fmt(best.h)} (#${rankOf(who.id) + 1})`; hint.append(s); }
    hint.style.display = 'block';
  }};
}
