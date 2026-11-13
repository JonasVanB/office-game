// Post-it high jump: on the wall above the emergency door in the Stille ruimte (x = 50).
// A skill jump: sprint along the lane, take off at the yellow line, kick off the wall, and press Space at the very top:
// your post-it sticks where your hand reaches. Every player keeps their best post-it; only the 25 highest stay on the wall.
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


  // ---------- the skill jump ----------
  // 1. Run-up: sprint (Shift + W) along the lane towards the wall; the momentum bar fills.
  // 2. Take-off: jump as close as possible to the yellow line (x = LINE). Too early loses height, over the line is a foul.
  // 3. Wall kick: you hit the wall while still rising; press Space right then to push off the wall for extra height.
  // 4. Stick: press Space at the very top. Only a perfect run gets close to the top of the wall (~3.0 m).
  const LINE = 49.0, LANE = {x0: 43, z0: 5.6, z1: 7.4};
  const floorMat = c => new THREE.MeshBasicMaterial({color: c, polygonOffset: true, polygonOffsetFactor: -2});
  { const line = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.9), floorMat(0xf2c230)); line.rotation.x = -Math.PI/2; line.position.set(LINE, 0.015, 6.5); wall.add(line);
    for (let x = LANE.x0 + 1; x < LINE - 0.5; x += 1){ const t = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.25), floorMat(0xd9d7d1)); t.rotation.x = -Math.PI/2; t.position.set(x, 0.014, 6.5); wall.add(t); } }
  const meter = document.createElement('div'); meter.style.cssText = 'position:fixed;left:50%;bottom:calc(22% + 64px);transform:translateX(-50%);width:220px;display:none;z-index:2;pointer-events:none;color:#fff;font-size:12px;text-align:center';
  meter.innerHTML = '<div style="margin-bottom:3px;text-shadow:0 1px 2px #000">Run-up</div><div style="height:10px;border-radius:5px;background:rgba(20,24,30,.6);overflow:hidden"><b style="display:block;height:100%;width:0;background:linear-gradient(90deg,#f2c230,#ff6a2a);border-radius:5px"></b></div>';
  document.body.appendChild(meter); const meterBar = meter.querySelector('b');
  const flash = document.createElement('div'); flash.style.cssText = 'position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);font:800 34px system-ui,Segoe UI,sans-serif;color:#ffe866;text-shadow:0 2px 6px rgba(0,0,0,.7);opacity:0;transition:opacity .15s;pointer-events:none;z-index:3;white-space:nowrap';
  document.body.appendChild(flash); let flashT = 0;
  const say = (t, col) => { flash.textContent = t; flash.style.color = col || '#ffe866'; flash.style.opacity = 1; clearTimeout(flashT); flashT = setTimeout(() => flash.style.opacity = 0, 900); };

  const inLane = () => { const s = G.state; return s.lv === 0 && s.y < 1.3 && s.x > LANE.x0 && s.z > LANE.z0 && s.z < LANE.z1; };
  const inZone = () => { const s = G.state; return s.lv === 0 && s.y < 1.3 && s.x > 48.4 && s.z > Z0 - 0.6 && s.z < Z1 + 0.1; };
  let momentum = 0, prevX = null, prevT = 0, jump = null, lastStick = 0;

  G.onTakeoff = v => {
    if (!inLane()) return null;
    const d = G.state.x - LINE;   // < 0: before the line
    const q = d > 0.1 ? 0 : d > 0 ? 1 - d/0.1*0.4 : Math.max(0, 1 + d/0.5);
    if (d > 0.1){ say('Foul! Over the line', '#ff6a5a'); window.__ach && window.__ach('p_foul'); } else if (q > 0.9) say('Perfect take-off!'); else if (q > 0.6) say('Good take-off'); else if (momentum > 0.2) say('Too early', '#ffffff');
    jump = {m: momentum, q, x0: G.state.x, contactAt: 0, kick: null, stuck: false, t0: performance.now()/1000};
    return 3.3 + 0.6*momentum*q;
  };
  G.onAirJump = (hopY) => {
    const now = performance.now()/1000;
    // wall kick: the first press just after you hit the wall
    if (jump && jump.contactAt && jump.kick === null && now - jump.contactAt < 0.35){
      const k = Math.max(0, 1 - Math.abs(now - jump.contactAt - 0.05)/0.25); jump.kick = k; G.boostHop(0.6*k);
      play('thud', 0.6, 0, true); say(k > 0.85 ? 'Perfect wall kick!' : k > 0.4 ? 'Wall kick!' : 'Late kick', k > 0.4 ? '#ffe866' : '#ffffff'); return;
    }
    if (!inZone() || (jump && jump.stuck) || performance.now() - lastStick < 800) return;
    if (jump) jump.stuck = true; lastStick = performance.now();
    stick(Math.round((REACH + hopY)*100)/100);
  };
  function stick(h){
    const who = me(), how = jump ? `Run-up ${Math.round(jump.m*100)}% · take-off ${Math.round(jump.q*100)}% · wall kick ${jump.kick === null ? '–' : Math.round(jump.kick*100) + '%'}` : '';
    if (!who){ toast('Sign in to stick a post-it'); return; }
    if (h < MINH){ toast(`${fmt(h)}: too low`, how || 'Sprint at the wall, jump at the yellow line, kick off the wall, stick at the top'); play('pop', 0.3); return; }
    const prev = entries.get(who.id);
    if (prev && prev.h >= h){ toast(`${fmt(h)}`, `Not higher than your best (${fmt(prev.h)}). ${how}`); play('pop', 0.3); return; }
    const e = {n: who.name, h: Math.min(MAXH, h), z: Math.max(Z0 + 0.1, Math.min(Z1 - 0.1, G.state.z)), c: COLORS[hash(who.id) % COLORS.length], t: Date.now()};
    entries.set(who.id, e); net.setPostit(who.id, e); render(); play('pop', 0.8);
    if (window.__ach){ const A = window.__ach; A('p_first'); if (e.h >= 2.7) A('p_270'); if (e.h >= 2.9) A('p_290'); if (e.h >= 3.0) A('p_300'); if (rankOf(who.id) === 0) A('p_top');
      if (jump && jump.q >= 0.9 && jump.kick >= 0.85) A('p_perfect'); window.__xp(10 + Math.round((e.h - MINH)*60), 'New personal best on the post-it wall'); }
    const rank = rankOf(who.id);
    toast(`📝 ${fmt(e.h)}!` + (rank === 0 ? ' 🏆' : ` · #${rank + 1}`), how);
    if (rank === 0 && window.__mpSay) window.__mpSay(`📝 stuck a post-it at ${fmt(e.h)}, the highest on the wall!`);
    ranked().slice(TOP).forEach(([id]) => { entries.delete(id); net.removePostit(id); });   // only the 25 highest stay
  }

  let hintKey = '';
  return {update(){
    const s = G.state, now = performance.now()/1000, dt = prevT ? Math.min(0.1, now - prevT) : 0; prevT = now;
    // momentum builds while you sprint towards the wall in the lane, and fades when you slow down
    const vx = prevX !== null && dt > 0 ? (s.x - prevX)/dt : 0; prevX = s.x;
    if (s.hop > 0){ /* keep it in the air */ } else if (inLane() && vx > 3.4) momentum = Math.min(1, momentum + dt/1.1); else momentum = Math.max(0, momentum - dt*2.5);
    if (s.hop === 0 && jump && now - jump.t0 > 0.15) jump = null;   // landed
    // hitting the wall while rising: the moment to kick
    if (jump && !jump.contactAt && s.hop > 0 && jump.x0 < 49.45 && s.x > 49.55){ jump.contactAt = now; say('KICK!', '#ffffff'); }
    const lane = inLane() && s.x < 49.9;
    meter.style.display = lane && (momentum > 0.02 || s.x > 46) ? 'block' : 'none'; meterBar.style.width = (momentum*100).toFixed(0) + '%';
    const z = inZone() || (inLane() && s.x > 46), who = me(), best = who && entries.get(who.id);
    const key = z ? (best ? best.h + '|' + rankOf(who.id) : '-') : '';
    if (key === hintKey) return; hintKey = key;
    if (!z){ hint.style.display = 'none'; return; }
    hint.innerHTML = window.__isTouch
      ? '📝 <b>Post-it high jump</b>: run at the wall, tap ⤒ at the yellow line, tap again when you hit the wall, and again at the top to stick'
      : '📝 <b>Post-it high jump</b>: sprint at the wall (Shift + W), jump at the yellow line (Space), Space when you hit the wall to kick off it, Space at the top to stick';
    if (best){ const d = document.createElement('div'); d.textContent = `Your best: ${fmt(best.h)} (#${rankOf(who.id) + 1})`; hint.append(d); }
    hint.style.display = 'block';
  }};
}
