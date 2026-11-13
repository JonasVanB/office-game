// Dance-off in Portus Ganda: four dance mats in front of the two big TVs. Step on a mat and press E, pick a song and a difficulty,
// Enter starts it for everyone standing on a mat (1 to 4 players). Arrows scroll up; hit the arrow keys (or WASD) when they reach
// the targets at the top. Long arrows (freezes) must be held until they end.
//
// Timing is judged against the music: Perfect ±45 ms, Great ±90 ms, Good ±135 ms. Misses and dropped freezes break your combo and
// drain your life bar; empty = failed. Score is out of 1,000,000, graded AAA / AA / A / B / C / D (E = failed).
//
// Multiplayer: whoever presses Enter picks the song and a start time on the shared clock; everyone else on a mat joins (with their own
// difficulty). The chart is generated from the song and difficulty, so every player and every spectator has the same arrows. Scores,
// combo and judgments travel in presence (dd); the TVs show every mat's lanes for people watching, and the music plays in the room.
import {sound, play} from './sound.js';

const MATS = [11.56, 10.69, 9.82, 8.95].map((z, i) => ({i, x: 17.78, z}));   // left → right as you face the TVs (−x)
const MAT_COL = ['#ff4fa3', '#33c7ff', '#ffc83d', '#5be37d'];
const KEYMAP = {ArrowLeft: 0, KeyA: 0, ArrowDown: 1, KeyS: 1, ArrowUp: 2, KeyW: 2, ArrowRight: 3, KeyD: 3};
const ROT = [0, -Math.PI/2, Math.PI/2, Math.PI];   // arrow pointing left, rotated for ← ↓ ↑ →
const WIN = {P: 0.045, G: 0.09, O: 0.135};
const PTS = {P: 10, G: 7, O: 3, M: 0};
const LIFE = {P: 2, G: 1, O: 0, M: -9, NG: -6};
const JNAME = {P: 'PERFECT', G: 'GREAT', O: 'GOOD', M: 'MISS', NG: 'N.G.', OK: 'O.K.'};
const JCOL = {P: '#ffe066', G: '#6ee7a0', O: '#7cc4ff', M: '#ff6b6b', NG: '#ff6b6b', OK: '#ffe066'};
const QCOL = ['#ff4b6e', '#4b8bff', '#ffd23f'];   // quarter, eighth, sixteenth notes
const COUNT = 4;       // seconds between Enter and the first beat
const SONGS = [
  {name: 'Coffee Break', bpm: 104, root: 45, minor: true, prog: [0, 8, 3, 10], lv: [2, 4, 7]},
  {name: 'Deadline Disco', bpm: 122, root: 41, minor: false, prog: [0, 7, 9, 5], lv: [3, 5, 8]},
  {name: 'Overtime Overdrive', bpm: 142, root: 38, minor: true, prog: [0, 10, 8, 7], lv: [4, 7, 10]},
];
const DIFF = ['Easy', 'Normal', 'Hard'], DIFF_COL = ['#5be37d', '#ffc83d', '#ff4fa3'];
const BARS = 36;   // 2 intro, A 8, B 8, A 8, drop 8, 2 outro
const section = bar => bar < 2 ? 'i' : bar < 10 ? 'a' : bar < 18 ? 'b' : bar < 26 ? 'a' : bar < 34 ? 'd' : 'o';
const stepDur = s => 60/SONGS[s].bpm/4;
const songLen = s => BARS*16*stepDur(s);

let G, THREE, cv, g2, card, help, toast, pads, tvs = [], mats = [];
let me = null, sel = {s: 0, d: 1}, speed = 1.25, off = 0, keyDown = [false, false, false, false], best = {}, quitArm = 0;
try { const o = JSON.parse(localStorage.getItem('office.dance') || '{}'); if (o.s !== undefined) sel = {s: o.s|0, d: o.d|0}; speed = o.sp || speed; off = o.off || 0; best = o.best || {}; } catch (e) {}
const saveCfg = () => { try { localStorage.setItem('office.dance', JSON.stringify({s: sel.s, d: sel.d, sp: speed, off, best})); } catch (e) {} };
const isTouch = () => !!window.__isTouch;
const now = () => window.__serverNow ? window.__serverNow() : Date.now();
const players = () => (G.mp && G.mp.players) ? G.mp.players() : [];
const myKey = () => G.mp ? G.mp.myKey : '';
const myName = () => G.mp && G.mp.myName ? G.mp.myName() : 'You';
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
function el(tag, css, parent){ const e = document.createElement(tag); e.style.cssText = css; (parent || document.body).appendChild(e); return e; }
function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; }

// ---------- charts: generated from (song, difficulty), identical for everyone ----------
const POOLS = [
  {a: [[0, 8], [0, 4, 8], [0, 8, 12], [0, 4, 8, 12]], b: [[0, 4, 8, 12], [0, 4, 8], [0, 6, 8, 12]], d: [[0, 4, 8, 12], [0, 4, 8, 10, 12], [0, 4, 6, 8, 12]]},
  {a: [[0, 4, 8, 12], [0, 4, 6, 8, 12], [0, 4, 8, 10, 12], [0, 8, 12]], b: [[0, 2, 4, 8, 12], [0, 4, 6, 8, 10, 12], [0, 4, 8, 10, 12, 14]], d: [[0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 6, 8, 12, 14], [0, 2, 4, 8, 10, 12]]},
  {a: [[0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 6, 8, 10, 12, 14], [0, 2, 4, 8, 10, 12, 14]], b: [[0, 2, 4, 6, 8, 10, 12, 13, 14], [0, 2, 3, 4, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 11, 12, 14]],
    d: [[0, 2, 4, 6, 8, 9, 10, 11, 12, 14], [0, 1, 2, 4, 6, 8, 10, 12, 13, 14], [0, 2, 4, 6, 8, 10, 12, 13, 14, 15]]},
];
const JUMPS = [[0, 3], [1, 2], [0, 3], [1, 2], [0, 2], [1, 3], [0, 1], [2, 3]];
const charts = {};
function chart(s, d){
  const key = s*3 + d; if (charts[key]) return charts[key];
  const rnd = rng(1000 + key*7919), st = stepDur(s), pool = POOLS[d], holdP = [0.14, 0.16, 0.12][d], jumpP = [0.04, 0.14, 0.24][d];
  const made = {}, notes = []; let last = -1;
  for (let bar = 2; bar < 34; bar++){
    const sec = section(bar), idx = (bar - 2) % 8, k = sec + idx;
    if (!made[k] && (idx === 3 || idx === 7) && (sec === 'b' || (sec === 'd' && idx === 7) || (sec === 'a' && idx === 7 && d > 0))){
      // a freeze bar: hold one arrow while tapping the others
      const L = (rnd()*4)|0, o = [0, 1, 2, 3].filter(x => x !== L), out = [];
      if (d === 0){ const L2 = o[(rnd()*3)|0]; out.push({p: 0, lane: L, len: 6}, {p: 8, lane: L2, len: 6}); }
      else { out.push({p: 0, lane: L, len: 12}); const taps = d === 1 ? [4, 8, 12] : [2, 4, 6, 8, 10, 12, 14]; let q = -1;
        for (const p of taps){ let lane; do { lane = o[(rnd()*3)|0]; } while (lane === q && rnd() < 0.8); out.push({p, lane, len: 0}); q = lane; } }
      made[k] = out; last = out[out.length - 1].lane;
    }
    if (!made[k]){
      const list = pool[sec], pat = list[(rnd()*list.length)|0], out = [];
      for (let i = 0; i < pat.length; i++){
        const p = pat[i], gap = (i + 1 < pat.length ? pat[i + 1] : 16) - p;
        if ((p === 0 || p === 8) && rnd() < jumpP && gap >= 2){ const j = JUMPS[(rnd()*JUMPS.length)|0]; out.push({p, lane: j[0], len: 0}, {p, lane: j[1], len: 0}); last = j[(rnd()*2)|0]; continue; }
        let lane; do { lane = (rnd()*4)|0; } while (lane === last && rnd() < 0.85);
        if (gap === 1){ const opp = last === 0 ? 3 : last === 3 ? 0 : (rnd() < 0.5 ? 0 : 3); lane = (rnd() < 0.7) ? opp : (last === 1 ? 2 : 1); }   // fast runs: alternate feet
        const hold = gap >= 6 && rnd() < holdP ? gap - 2 : 0;
        out.push({p, lane, len: hold}); last = lane;
      }
      // a freeze arrow reserves its lane until it ends
      for (const n of out) if (n.len) for (const m of out) if (m !== n && m.lane === n.lane && m.p > n.p && m.p <= n.p + n.len) m.lane = (m.lane + 2) % 4;
      made[k] = out;
    }
    for (const n of made[k]){ const step = bar*16 + n.p; notes.push({t: step*st, lane: n.lane, len: n.len*st, q: n.p % 4 === 0 ? 0 : n.p % 2 === 0 ? 1 : 2}); }
  }
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  // jumps share a time: drop exact duplicates
  const seen = new Set(), list = notes.filter(n => { const k2 = n.t.toFixed(4) + ':' + n.lane; if (seen.has(k2)) return false; seen.add(k2); return true; });
  return (charts[key] = list);
}

// ---------- music: synthesized and scheduled on the audio clock, in sync with the shared start time ----------
let listen = null, noiseBuf = null;
function noiseBuffer(c){ if (noiseBuf) return noiseBuf; noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1; return noiseBuf; }
function startListen(go, s){
  const c = sound.ctx, out = sound.out; if (!c || !out) return;
  stopListen();
  const gain = c.createGain(); gain.gain.value = 0; gain.connect(out);
  listen = {go, s, gain, start: c.currentTime + (go - now())/1000, next: 0, vol: 0};
  listen.next = Math.max(0, Math.ceil((c.currentTime - listen.start)/stepDur(s)));
}
function stopListen(){ if (!listen) return; const L = listen, c = sound.ctx; listen = null; try { L.gain.gain.setTargetAtTime(0, c.currentTime, 0.08); setTimeout(() => L.gain.disconnect(), 800); } catch (e) {} }
const midi = n => 440*Math.pow(2, (n - 69)/12);
function vOsc(c, dest, t, dur, f, type, v, a = 0.005, f2){
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur*0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02); return o;
}
function vNoise(c, dest, t, dur, type, f, v, q){
  const s = c.createBufferSource(); s.buffer = noiseBuffer(c); const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random()*0.5); s.stop(t + dur + 0.02);
}
function schedStep(c, dest, s, i, T){
  const S = SONGS[s], bar = i >> 4, p = i & 15, sec = section(bar), st = stepDur(s); if (bar >= BARS) return;
  const root = S.root + S.prog[bar % 4], third = S.minor && S.prog[bar % 4] !== 10 && S.prog[bar % 4] !== 3 && S.prog[bar % 4] !== 8 ? 3 : 4;
  const full = sec === 'a' || sec === 'b' || sec === 'd', end = sec === 'o';
  if (end){ if (bar === 34 && p === 0){ vOsc(c, dest, T, 0.5, 150, 'sine', 0.9, 0.002, 45); vNoise(c, dest, T, 2.2, 'highpass', 5000, 0.16);
      for (const n of [0, third, 7, 12]) vOsc(c, dest, T, 2.4, midi(root + 24 + n), 'triangle', 0.07, 0.01); vOsc(c, dest, T, 2.4, midi(root), 'sawtooth', 0.12, 0.01); } return; }
  // drums
  if (p % 4 === 0 && (full || p % 8 === 0)) vOsc(c, dest, T, 0.32, 150, 'sine', 0.95, 0.002, 42);
  if (full && (p === 4 || p === 12)){ vNoise(c, dest, T, 0.16, 'bandpass', 1900, 0.5, 0.7); vOsc(c, dest, T, 0.1, 210, 'triangle', 0.25, 0.002); }
  if (p % 4 === 2) vNoise(c, dest, T, sec === 'b' || sec === 'd' ? 0.12 : 0.05, 'highpass', 7500, 0.18);
  else if (sec === 'd' && p % 2 === 1) vNoise(c, dest, T, 0.03, 'highpass', 9000, 0.07);
  if ((sec === 'b' || sec === 'a') && bar % 8 === 1 && p >= 12) vNoise(c, dest, T, 0.08, 'bandpass', 1400 + p*120, 0.25, 1);   // fill
  if (p === 0 && (bar === 2 || bar === 18 || bar === 26)) vNoise(c, dest, T, 1.6, 'highpass', 4500, 0.16);   // crash at a new section
  // bass: eighths, octave on the off-beat (disco)
  if (p % 2 === 0 && (full || bar === 1)){
    const n = root + (p % 4 === 2 ? 12 : 0), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = sec === 'd' ? 900 : 600; f.Q.value = 5; f.connect(dest);
    vOsc(c, f, T, st*1.7, midi(n), 'sawtooth', 0.3, 0.004);
  }
  // chords: a held pad in A, off-beat stabs in B and the drop
  const chord = [0, third, 7].map(x => root + 24 + x);
  if (sec === 'a' && p === 0) for (const n of chord) vOsc(c, dest, T, st*15, midi(n), 'triangle', 0.045, 0.08);
  if ((sec === 'b' || sec === 'd') && (p === 2 || p === 6 || p === 10 || p === 14)) for (const n of chord) vOsc(c, dest, T, st*1.4, midi(n + 12), 'square', 0.022, 0.003);
  // lead: a seeded melody on the pentatonic scale, repeats every 4 bars
  if ((sec === 'd' && p % 2 === 0) || (sec === 'b' && p % 4 === 0)){
    const r = rng(s*977 + (bar % 4)*31 + p)(); if (r < (sec === 'd' ? 0.72 : 0.5)){
      const scale = S.minor ? [0, 3, 5, 7, 10, 12, 15] : [0, 2, 4, 7, 9, 12, 14], n = S.root + 36 + S.prog[bar % 4]%12 + scale[(r*997|0) % scale.length];
      vOsc(c, dest, T, st*(sec === 'd' ? 1.6 : 3), midi(n), 'square', 0.04, 0.006); vOsc(c, dest, T, st*(sec === 'd' ? 1.6 : 3), midi(n)*1.005, 'sawtooth', 0.025, 0.006);
    }
  }
}
function pumpMusic(){
  const L = listen, c = sound.ctx; if (!L || !c) return;
  const st = stepDur(L.s), ahead = c.currentTime - L.start + 0.18;
  while (L.next*st < ahead && L.next < BARS*16){ const T = L.start + L.next*st; if (T >= c.currentTime - 0.01) schedStep(c, L.gain, L.s, L.next, T); L.next++; }
}
// the song position as heard (output latency and the player's own offset taken off)
function songTime(go){
  const c = sound.ctx, L = listen;
  if (c && c.state === 'running' && L && L.go === go) return c.currentTime - (c.outputLatency || c.baseLatency || 0) - L.start - off/1000;
  return (now() - go)/1000 - off/1000;
}

// ---------- the mats and the TVs ----------
function buildRoom(){
  for (const m of MATS){
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.025, 0.84), new THREE.MeshStandardMaterial({color: 0x15171c, roughness: 0.6}));
    base.position.set(m.x, 0.0125, m.z); G.scene.add(base);
    const c = document.createElement('canvas'); c.width = c.height = 256; const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({map: tex}));
    top.rotation.order = 'YXZ'; top.rotation.y = Math.PI/2; top.rotation.x = -Math.PI/2; top.position.set(m.x, 0.0262, m.z); G.scene.add(top);
    mats.push({c, g: c.getContext('2d'), tex, lit: -1, who: null}); drawMat(m.i, 0, false);
  }
  for (const zc of [11.25, 9.45]){
    const c = document.createElement('canvas'); c.width = 640; c.height = 358; const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.95), new THREE.MeshBasicMaterial({map: tex}));
    mesh.rotation.y = Math.PI/2; mesh.position.set(17.143, 1.475, zc); mesh.visible = false; G.scene.add(mesh);
    tvs.push({c, g: c.getContext('2d'), tex, mesh});
  }
}
function arrowPath(g, x, y, s, rot){
  g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
  g.moveTo(-0.5*s, 0); g.lineTo(-0.02*s, -0.46*s); g.lineTo(-0.02*s, -0.19*s); g.lineTo(0.46*s, -0.19*s); g.lineTo(0.46*s, 0.19*s); g.lineTo(-0.02*s, 0.19*s); g.lineTo(-0.02*s, 0.46*s); g.closePath();
  g.restore();
}
function drawMat(i, bits, active){
  const M = mats[i], g = M.g, col = MAT_COL[i], key = bits + (active ? 16 : 0); if (M.lit === key) return; M.lit = key;
  g.fillStyle = '#1b1e26'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = col; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246);
  const cell = [[0, 1], [1, 2], [1, 0], [2, 1]];   // ← ↓ ↑ → as (column, row) in the 3 × 3 grid; the top of the canvas faces the TV
  for (let r = 0; r < 3; r++) for (let cI = 0; cI < 3; cI++){ g.fillStyle = (r + cI) % 2 ? '#2a2f3a' : '#232731'; g.fillRect(12 + cI*77.3, 12 + r*77.3, 75, 75); }
  cell.forEach(([cx, cy], lane) => {
    const on = bits & (1 << lane), x = 12 + cx*77.3 + 37.5, y = 12 + cy*77.3 + 37.5;
    if (on){ g.fillStyle = col; g.fillRect(x - 37.5, y - 37.5, 75, 75); }
    arrowPath(g, x, y, 54, ROT[lane]); g.fillStyle = on ? '#fff' : active ? col : '#5b6270'; g.fill();
  });
  g.fillStyle = col; g.font = '700 22px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 128, 128);
  M.tex.needsUpdate = true;
}

// ---------- who is dancing ----------
function everyone(){
  const list = players().filter(p => p.dd && (p.l || 0) === 0).map(p => ({key: p.key, name: p.name, dd: p.dd, p}));
  if (me) list.push({key: myKey() || 'me', name: myName(), dd: G.state.dd || {p: me.mat, ph: me.ph}, mine: true});
  return list;
}
const matTaken = i => players().some(p => p.dd && p.dd.p === i && (p.l || 0) === 0);
function onMat(){
  const s = G.state; if (s.lv !== 0 || Math.abs(s.y || 0) > 0.5) return null;
  for (const m of MATS) if (Math.abs(s.x - m.x) < 0.45 && Math.abs(s.z - m.z) < 0.42) return m;
  return null;
}
// the session the TVs show: the latest start time among people dancing
function session(){
  const all = everyone(), live = all.filter(e => e.dd.go && (e.dd.ph === 'count' || e.dd.ph === 'play' || e.dd.ph === 'end'));
  if (!live.length) return null;
  const go = Math.max(...live.map(e => e.dd.go)), s = (live.find(e => e.dd.go === go).dd.s) | 0;
  if (now() > go + (songLen(s) + 12)*1000) return null;
  return {go, s, list: live.filter(e => e.dd.go === go)};
}
const busy = () => players().some(p => p.dd && (p.dd.ph === 'count' || p.dd.ph === 'play') && p.dd.go && now() < p.dd.go + songLen(p.dd.s|0)*1000);

// ---------- joining, starting, leaving ----------
function join(m){
  try { sound.unlock(); } catch (e) {}
  me = {mat: m.i, ph: 'lobby'}; quitArm = 0;
  G.controlLock = {aim(){}, press(){}};
  G.setView(m.x, m.z, Math.PI/2, 0.02);
  help.textContent = '← ↓ ↑ → or W A S D on the beat · hold the long arrows · E twice to stop'; renderLobby(); if (pads) pads.style.display = 'flex';
  if (window.__ach) window.__stat('danceMats');
}
function leave(){
  me = null; G.controlLock = null; G.state.dd = null; card.style.display = 'none'; help.style.display = 'none'; if (pads) pads.style.display = 'none';
  keyDown = [false, false, false, false]; g2.clearRect(0, 0, cv.width, cv.height);
}
function startSong(){
  if (!me || me.ph !== 'lobby') return;
  if (busy()){ say('Wait for the current song to finish'); return; }
  begin(now() + COUNT*1000, sel.s);
}
function begin(go, s){
  const d = sel.d, notes = chart(s, d).map(n => Object.assign({}, n, {j: null, hold: n.len ? 'wait' : null, rel: null}));
  const maxPts = notes.reduce((a, n) => a + 10 + (n.len ? 10 : 0), 0);
  Object.assign(me, {ph: 'count', go, s, d, notes, maxPts, pts: 0, combo: 0, maxCombo: 0, life: 50, failed: false, last: null, jc: 0,
    counts: {P: 0, G: 0, O: 0, M: 0, OK: 0, NG: 0}, err: 0, errN: 0, flash: [0, 0, 0, 0], burst: [null, null, null, null], result: null, endAt: 0, winDone: false});
  card.style.display = 'none';
  try { sound.unlock(); } catch (e) {}
  startListen(go, s);
}
function finish(){
  const f = me; f.ph = 'end'; f.endAt = performance.now();
  const sc = score(), gr = f.failed ? 'E' : sc >= 990000 ? 'AAA' : sc >= 950000 ? 'AA' : sc >= 900000 ? 'A' : sc >= 800000 ? 'B' : sc >= 700000 ? 'C' : 'D';
  const fc = !f.failed && f.counts.M === 0 && f.counts.NG === 0, k = f.s + ':' + f.d, nb = !f.failed && sc > (best[k] || 0);
  if (nb){ best[k] = sc; saveCfg(); }
  f.result = {sc, gr, fc, nb};
  if (window.__ach){ const A = window.__ach; A('d_first'); window.__stat('danceSongs');
    if (!f.failed){ A('d_clear'); if (f.d === 2) A('d_hard'); }
    if (gr === 'A' || gr === 'AA' || gr === 'AAA') A('d_a'); if (gr === 'AAA') A('d_aaa'); if (fc) A('d_fc');
    const sess = session(); if (sess && sess.list.length >= 4) A('d_party');
    window.__xp(8 + ({AAA: 40, AA: 30, A: 20, B: 12, C: 8, D: 4, E: 0})[gr], `Danced ${SONGS[f.s].name} (${gr})`); }
  play(f.failed ? 'boo' : 'cheer', 0.6, 0);
  renderResults();
}
function say(t){ toast.textContent = t; toast.style.display = 'block'; clearTimeout(say.t); say.t = setTimeout(() => { toast.style.display = 'none'; }, 2200); }
const score = () => me && me.maxPts ? Math.round(me.pts/me.maxPts*1e6/10)*10 : 0;

// ---------- input ----------
const evTime = e => (e && e.timeStamp && e.timeStamp <= performance.now() + 5) ? Math.max(0, performance.now() - e.timeStamp)/1000 : 0;
function onKey(e){
  if (!me) return;
  const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
  const down = e.type === 'keydown', lane = KEYMAP[e.code];
  if (lane !== undefined){
    e.preventDefault(); e.stopImmediatePropagation();
    if (me.ph === 'lobby'){ if (down) menuKey(lane); return; }
    if (down){ if (!e.repeat) hit(lane, evTime(e)); } else release(lane);
    return;
  }
  if (!down) return;
  if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter'){ e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return; if (me.ph === 'lobby') startSong(); else if (me.ph === 'end') toLobby(); return; }
  if (me.ph !== 'lobby') return;
  if (e.code === 'Minus' || e.code === 'NumpadSubtract'){ speed = Math.max(0.5, speed - 0.25); saveCfg(); renderLobby(); }
  else if (e.code === 'Equal' || e.code === 'NumpadAdd'){ speed = Math.min(3, speed + 0.25); saveCfg(); renderLobby(); }
  else if (e.code === 'BracketLeft'){ off = Math.max(-200, off - 5); saveCfg(); renderLobby(); }
  else if (e.code === 'BracketRight'){ off = Math.min(200, off + 5); saveCfg(); renderLobby(); }
}
function menuKey(lane){
  if (lane === 0) sel.s = (sel.s + SONGS.length - 1) % SONGS.length; else if (lane === 3) sel.s = (sel.s + 1) % SONGS.length;
  else if (lane === 2) sel.d = Math.max(0, sel.d - 1); else if (lane === 1) sel.d = Math.min(2, sel.d + 1);
  saveCfg(); renderLobby(); play('mouse', 0.5, 0);
}
function hit(lane, ago){
  keyDown[lane] = true; const f = me; if (!f) return;
  f.flash[lane] = 1;
  if ((f.ph !== 'play' && f.ph !== 'count') || f.failed) return;
  const t = songTime(f.go) - ago;
  let best2 = null;
  for (const n of f.notes){ if (n.lane !== lane || n.j) continue; if (n.t - t > WIN.O) break; if (t - n.t <= WIN.O){ best2 = n; break; } }
  if (!best2) return;
  const e = t - best2.t, a = Math.abs(e), j = a <= WIN.P ? 'P' : a <= WIN.G ? 'G' : 'O';
  best2.j = j; f.pts += PTS[j]; f.counts[j]++; f.combo++; f.maxCombo = Math.max(f.maxCombo, f.combo); f.life = Math.min(100, f.life + LIFE[j]);
  f.err += e; f.errN++;
  f.last = {j, e, at: performance.now()}; f.jc++; f.burst[lane] = {j, at: performance.now()};
  if (best2.len) best2.hold = 'on';
  if (f.combo === 100 && window.__ach) window.__ach('d_combo');
}
function release(lane){ keyDown[lane] = false; }
function judgeTime(){
  const f = me, t = songTime(f.go);
  for (const n of f.notes){
    if (n.t - t > 0.2) break;
    if (!n.j && t - n.t > WIN.O){ n.j = 'M'; miss('M'); if (n.len) n.hold = 'ng'; }
    if (n.hold === 'on'){
      if (t >= n.t + n.len){ n.hold = 'ok'; f.pts += 10; f.counts.OK++; f.burst[n.lane] = {j: 'OK', at: performance.now()}; }
      else if (!keyDown[n.lane]){ if (n.rel === null) n.rel = t; else if (t - n.rel > 0.13){ n.hold = 'ng'; miss('NG'); } }
      else n.rel = null;
    }
  }
  if (f.failed) return;
  if (f.life <= 0){ f.failed = true; f.life = 0; say('Failed! Keep watching, the others are still going'); }
}
function miss(j){ const f = me; f.counts[j]++; f.combo = 0; f.life = Math.max(0, f.life + LIFE[j]*(f.d === 0 ? 0.6 : 1)); f.last = {j, e: 0, at: performance.now()}; f.jc++; }   // Easy forgives a little more
function toLobby(){ if (!me) return; Object.assign(me, {ph: 'lobby', notes: null, result: null}); renderLobby(); }

// ---------- per frame ----------
function step(){
  const f = me;
  if (f.ph === 'lobby'){
    // someone else pressed Enter: join their song (the earliest start wins if two people pressed at once)
    const c = players().filter(p => p.dd && p.dd.ph === 'count' && p.dd.go > now() + 250 && (p.l || 0) === 0).sort((a, b) => a.dd.go - b.dd.go)[0];
    if (c) begin(c.dd.go, c.dd.s | 0);
    return;
  }
  if (f.ph === 'count'){
    const c = players().filter(p => p.dd && p.dd.ph === 'count' && p.dd.go !== f.go && p.dd.go > now() + 250 && (p.dd.go < f.go || (p.dd.go === f.go && p.key < myKey())))[0];
    if (c){ begin(c.dd.go, c.dd.s | 0); return; }
    if (songTime(f.go) >= -0.05) f.ph = 'play';
  }
  if (f.ph === 'end') return;
  if (!listen || listen.go !== f.go) startListen(f.go, f.s);
  judgeTime();
  if (songTime(f.go) > songLen(f.s) - 1.5) finish();
}
function broadcast(){
  const f = me; if (!f){ G.state.dd = null; return; }
  const bits = keyDown.reduce((a, d, i) => a | (d ? 1 << i : 0), 0);
  if (f.ph === 'lobby'){ G.state.dd = {p: f.mat, ph: 'lobby', k: bits}; return; }
  G.state.dd = {p: f.mat, ph: f.ph, go: f.go, s: f.s, d: f.d, sc: f.ph === 'end' ? f.result.sc : score(), cb: f.combo, mc: f.maxCombo, j: f.last ? f.last.j : '', jc: f.jc,
    k: bits, lf: Math.round(f.life/5)*5, f: f.failed ? 1 : 0, gr: f.result ? f.result.gr : '', fc: f.result && f.result.fc ? 1 : 0};
}
// spectators hear the music too, quieter with distance
function updateMusic(){
  const c = sound.ctx, s = G.state; if (!c) return;
  const sess = session();
  if (me && me.go && (me.ph === 'count' || me.ph === 'play' || me.ph === 'end')){ if (!listen || listen.go !== me.go) startListen(me.go, me.s); if (listen){ listen.gain.gain.setTargetAtTime(0.5, c.currentTime, 0.1); } pumpMusic(); return; }
  if (sess && s.lv === 0 && now() < sess.go + songLen(sess.s)*1000){
    const d = Math.hypot(s.x - 20.5, s.z - 10.3), inRoom = s.x > 17 && s.x < 25.5 && s.z > 7.68 && s.z < 13, v = inRoom ? 0.45 : Math.max(0, 0.3*(1 - d/14));
    if (v > 0.01){ if (!listen || listen.go !== sess.go) startListen(sess.go, sess.s); if (listen) listen.gain.gain.setTargetAtTime(v, c.currentTime, 0.2); pumpMusic(); return; }
  }
  stopListen();
}

// ---------- remote dancers (mp.js calls this every frame for every avatar) ----------
function poseDancer(obj, dd, t){
  const L = obj.userData.limbs; if (!L) return;
  if (!dd){ if (obj.userData.danced){ obj.userData.danced = false; L.armL.rotation.z = L.armR.rotation.z = 0; } return; }
  obj.userData.danced = true;
  const S = SONGS[dd.s | 0], k = dd.k | 0;
  const beat = dd.go ? (t - dd.go)/1000*S.bpm/60 : t/1000*1.8, playing = dd.ph === 'play' || dd.ph === 'count';
  const bob = Math.abs(Math.sin(Math.PI*beat));
  obj.position.y += playing ? bob*0.05 : bob*0.015;
  L.armL.rotation.z = (k & 1) ? -1.35 : -0.12; L.armR.rotation.z = (k & 8) ? 1.35 : 0.12;
  if (k & 4){ L.armL.rotation.x = L.armR.rotation.x = Math.PI*0.95; }
  if (k & 2){ obj.position.y -= 0.07; L.legL.rotation.x = 0.35; L.legR.rotation.x = -0.15; }
  if (dd.ph === 'end' && dd.gr && dd.gr !== 'E' && !k){ L.armL.rotation.x = L.armR.rotation.x = Math.PI*(0.9 + 0.08*Math.sin(t/200)); }
}

// ---------- my screen: lanes, arrows, judgments ----------
function draw(dt){
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W*dpr) || cv.height !== Math.round(H*dpr)){ cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, W, H);
  const f = me; if (!f || f.ph === 'lobby' || !f.notes) return;
  const t = songTime(f.go), Lw = Math.round(Math.max(52, Math.min(isTouch() ? W/4.6 : 84, W*0.11))), PW = Lw*4, x0 = Math.round(W/2 - PW/2), ry = Math.max(70, H*0.13);
  const pps = speed*H*0.5, bottom = isTouch() ? H - 110 : H;
  // panel and lanes
  g2.fillStyle = 'rgba(10,12,20,.62)'; g2.fillRect(x0 - 8, 0, PW + 16, H);
  g2.fillStyle = MAT_COL[f.mat]; g2.fillRect(x0 - 8, 0, 3, H); g2.fillRect(x0 + PW + 5, 0, 3, H);
  // beat lines moving up with the arrows
  const bt = 60/SONGS[f.s].bpm; g2.fillStyle = 'rgba(255,255,255,.07)';
  for (let b = Math.ceil(t/bt); (b*bt - t)*pps + ry < bottom; b++){ if (b < 0) continue; const y = ry + (b*bt - t)*pps; g2.fillRect(x0, y, PW, b % 4 === 0 ? 2 : 1); }
  // receptors: pulse on the beat, flash when pressed, burst when hit
  const pulse = t > -4 ? Math.pow(1 - ((t/bt) % 1 + 1) % 1, 3) : 0;
  for (let l = 0; l < 4; l++){
    const cx = x0 + Lw*l + Lw/2, sz = Lw*0.78;
    f.flash[l] = Math.max(keyDown[l] ? 0.6 : 0, f.flash[l] - dt*6);
    arrowPath(g2, cx, ry, sz*(1 + 0.06*pulse), ROT[l]); g2.fillStyle = `rgba(255,255,255,${0.08 + 0.35*f.flash[l]})`; g2.fill();
    g2.lineWidth = 3; g2.strokeStyle = `rgba(220,226,235,${0.55 + 0.4*pulse})`; g2.stroke();
    const b = f.burst[l]; if (b){ const a = (performance.now() - b.at)/260; if (a > 1) f.burst[l] = null; else {
      arrowPath(g2, cx, ry, sz*(1 + a*0.5), ROT[l]); g2.globalAlpha = 1 - a; g2.lineWidth = 5; g2.strokeStyle = JCOL[b.j]; g2.stroke(); g2.globalAlpha = 1; } }
  }
  // arrows (freeze bodies first, then heads)
  const vis = (bottom - ry)/pps + 0.1;
  for (const pass of [0, 1]) for (const n of f.notes){
    if (n.t - t > vis) break;
    if (n.t + n.len - t < -0.3) continue;
    const cx = x0 + Lw*n.lane + Lw/2, sz = Lw*0.78;
    let y = ry + (n.t - t)*pps;
    if (pass === 0){
      if (!n.len || n.hold === 'ok') continue;
      const yEnd = ry + (n.t + n.len - t)*pps, yStart = n.hold === 'on' ? ry : y;
      if (yEnd <= yStart) continue;
      g2.fillStyle = n.hold === 'ng' ? 'rgba(120,120,130,.5)' : n.hold === 'on' ? 'rgba(120,255,170,.85)' : 'rgba(80,220,140,.6)';
      g2.fillRect(cx - sz*0.28, yStart, sz*0.56, yEnd - yStart);
      g2.fillStyle = 'rgba(255,255,255,.5)'; g2.fillRect(cx - sz*0.28, yEnd - 3, sz*0.56, 3);
      continue;
    }
    if (n.j && n.j !== 'M' && !(n.len && n.hold === 'on')) continue;   // hit: gone (a held freeze keeps its head on the target)
    if (n.len && n.hold === 'on') y = ry;
    if (n.j === 'M'){ g2.globalAlpha = 0.35; }
    arrowPath(g2, cx, y, sz, ROT[n.lane]);
    const gr = g2.createLinearGradient(cx, y - sz/2, cx, y + sz/2); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, n.len ? '#5be37d' : QCOL[n.q]); gr.addColorStop(1, n.len ? '#1f8a4a' : QCOL[n.q]);
    g2.fillStyle = gr; g2.fill(); g2.lineWidth = 2; g2.strokeStyle = 'rgba(0,0,0,.6)'; g2.stroke(); g2.globalAlpha = 1;
  }
  // life bar and score
  g2.fillStyle = 'rgba(255,255,255,.15)'; g2.fillRect(x0, 14, PW, 10);
  g2.fillStyle = f.failed ? '#ff6b6b' : f.life > 80 ? '#7cf0ff' : f.life > 25 ? '#5be37d' : '#ff9800'; g2.fillRect(x0, 14, PW*f.life/100, 10);
  g2.textBaseline = 'middle'; g2.font = '700 14px system-ui, sans-serif'; g2.fillStyle = '#fff'; g2.textAlign = 'left';
  g2.fillText(score().toLocaleString('en-US').replace(/,/g, ' '), x0, 38);
  g2.textAlign = 'right'; g2.fillStyle = DIFF_COL[f.d]; g2.fillText(`${DIFF[f.d]} ${SONGS[f.s].lv[f.d]}`, x0 + PW, 38);
  // progress along the panel edge
  g2.fillStyle = 'rgba(255,255,255,.5)'; g2.fillRect(x0 - 8, 0, (PW + 16)*Math.max(0, Math.min(1, t/songLen(f.s))), 3);
  // judgment and combo
  g2.textAlign = 'center';
  if (f.last){ const a = (performance.now() - f.last.at)/1000; if (a < 0.7){
    const sc = 1 + Math.max(0, 0.25 - a)*1.2, y = ry + Lw*1.9;
    g2.save(); g2.translate(W/2, y); g2.scale(sc, sc); g2.globalAlpha = Math.min(1, (0.7 - a)*4);
    g2.font = '900 34px system-ui, sans-serif'; g2.lineWidth = 6; g2.strokeStyle = 'rgba(10,12,20,.85)'; g2.strokeText(JNAME[f.last.j], 0, 0); g2.fillStyle = JCOL[f.last.j]; g2.fillText(JNAME[f.last.j], 0, 0);
    if (f.last.j === 'G' || f.last.j === 'O'){ g2.font = '700 13px system-ui, sans-serif'; g2.fillStyle = f.last.e < 0 ? '#9cc3ff' : '#ffb27c'; g2.fillText(f.last.e < 0 ? 'early' : 'late', 0, 24); }
    g2.restore(); g2.globalAlpha = 1; } }
  if (f.combo >= 4){ g2.font = '900 46px system-ui, sans-serif'; g2.lineWidth = 6; g2.strokeStyle = 'rgba(10,12,20,.85)'; const y = ry + Lw*1.9 + 54;
    g2.strokeText(String(f.combo), W/2, y); g2.fillStyle = '#fff'; g2.fillText(String(f.combo), W/2, y); g2.font = '700 12px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,255,255,.8)'; g2.fillText('COMBO', W/2, y + 30); }
  if (f.failed){ g2.font = '900 44px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,90,90,.9)'; g2.fillText('FAILED', W/2, H*0.55); }
  // countdown
  if (t < 0){ const n = Math.ceil(-t), big = n > 3 ? 'Ready?' : String(n), a = 1 - ((-t) % 1);
    g2.font = `900 ${n > 3 ? 54 : 96}px system-ui, sans-serif`; g2.lineWidth = 8; g2.strokeStyle = 'rgba(10,12,20,.8)'; g2.globalAlpha = 0.4 + 0.6*a;
    g2.strokeText(big, W/2, H*0.5); g2.fillStyle = '#fff'; g2.fillText(big, W/2, H*0.5); g2.globalAlpha = 1;
    g2.font = '700 15px system-ui, sans-serif'; g2.fillStyle = '#fff'; g2.fillText(SONGS[f.s].name + ' · ' + SONGS[f.s].bpm + ' BPM', W/2, H*0.5 + 64); }
  // the other dancers
  const sess = session(); if (sess){ let y = 60; g2.textAlign = 'left';
    const others = sess.list.filter(e => !e.mine); if (others.length && W > 640) for (const e of others.sort((a, b) => (b.dd.sc || 0) - (a.dd.sc || 0))){
      const xx = x0 + PW + 24; g2.fillStyle = 'rgba(10,12,20,.6)'; g2.fillRect(xx - 8, y - 16, 170, 42);
      g2.fillStyle = MAT_COL[e.dd.p | 0]; g2.fillRect(xx - 8, y - 16, 3, 42);
      g2.font = '700 13px system-ui, sans-serif'; g2.fillStyle = '#fff'; g2.fillText(String(e.name).slice(0, 14), xx, y - 3);
      g2.font = '600 12px system-ui, sans-serif'; g2.fillStyle = 'rgba(255,255,255,.75)'; g2.fillText(`${(e.dd.sc || 0).toLocaleString('en-US')}${e.dd.f ? ' · failed' : e.dd.cb >= 4 ? ' · ' + e.dd.cb + ' combo' : ''}`, xx, y + 14);
      y += 50; } }
}

// ---------- the TVs: every mat's lanes for the room to watch ----------
let tvAcc = 0;
function drawTVs(dt){
  const s = G.state, near = s.lv === 0 && Math.hypot(s.x - 20.5, s.z - 10.3) < 16;
  const sess = session();
  const show = !!sess || everyone().length > 0;
  for (const tv of tvs) tv.mesh.visible = show;
  if (!show || !near) return;
  tvAcc += dt; if (tvAcc < 1/30) return; tvAcc = 0;
  const t = now();
  tvs.forEach((tv, side) => {
    const g = tv.g, W = tv.c.width, H = tv.c.height;
    const bgr = g.createLinearGradient(0, 0, W, H); bgr.addColorStop(0, '#160c2e'); bgr.addColorStop(1, '#071a2c'); g.fillStyle = bgr; g.fillRect(0, 0, W, H);
    if (!sess || t > sess.go + (songLen(sess.s) + 1.5)*1000){
      // results, or the lobby
      const done = sess && sess.list.length ? sess.list.slice().sort((a, b) => (b.dd.sc || 0) - (a.dd.sc || 0)) : null;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (done && side === 1){
        g.fillStyle = '#fff'; g.font = '900 30px system-ui, sans-serif'; g.fillText('RESULTS', W/2, 38);
        g.font = '600 15px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(SONGS[sess.s].name, W/2, 64);
        done.forEach((e, i) => { const y = 108 + i*58; g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(40, y - 24, W - 80, 48); g.fillStyle = MAT_COL[e.dd.p | 0]; g.fillRect(40, y - 24, 6, 48);
          g.textAlign = 'left'; g.font = '900 26px system-ui, sans-serif'; g.fillStyle = i === 0 ? '#ffe066' : '#fff'; g.fillText(`${i + 1}`, 60, y);
          g.font = '700 20px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(String(e.name).slice(0, 14), 96, y);
          g.textAlign = 'right'; g.font = '900 24px system-ui, sans-serif'; g.fillStyle = gradeCol(e.dd.gr); g.fillText(e.dd.gr || '…', W - 190, y);
          g.font = '700 18px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText((e.dd.sc || 0).toLocaleString('en-US'), W - 56, y); });
      } else {
        g.font = '900 54px system-ui, sans-serif'; const tg = g.createLinearGradient(0, 40, 0, 110); tg.addColorStop(0, '#ff7ac6'); tg.addColorStop(1, '#7cd8ff'); g.fillStyle = tg;
        g.fillText(side === 0 ? 'DANCE' : 'OFF!', W/2, 82);
        g.font = '600 16px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)';
        g.fillText(side === 0 ? 'Step on a mat and press E' : 'Up to 4 dancers · Enter starts the song', W/2, 136);
        for (let k = 0; k < 2; k++){ const i = side*2 + k, e = everyone().find(x => (x.dd.p | 0) === i), x = W*(0.27 + 0.46*k), y = 230;
          g.fillStyle = MAT_COL[i]; g.globalAlpha = e ? 1 : 0.35; g.fillRect(x - 100, y - 50, 200, 100); g.globalAlpha = 1;
          g.fillStyle = '#10131a'; g.fillRect(x - 94, y - 44, 188, 88);
          g.fillStyle = MAT_COL[i]; g.font = '700 14px system-ui, sans-serif'; g.fillText(`MAT ${i + 1}`, x, y - 22);
          g.fillStyle = '#fff'; g.font = '700 20px system-ui, sans-serif'; g.fillText(e ? String(e.name).slice(0, 12) : 'free', x, y + 8);
          if (e && e.dd.ph !== 'lobby'){ g.font = '600 12px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('just danced', x, y + 30); } }
      }
    } else {
      // two mats per TV: lanes, arrows, score
      for (let k = 0; k < 2; k++){
        const i = side*2 + k, e = sess.list.find(x => (x.dd.p | 0) === i), X0 = k*W/2;
        g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(X0 + 8, 0, W/2 - 16, H);
        g.fillStyle = MAT_COL[i]; g.fillRect(X0 + 8, 0, W/2 - 16, 4);
        if (!e){ g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 16px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.3)'; g.fillText(`MAT ${i + 1}`, X0 + W/4, H/2); continue; }
        tvLanes(g, X0, W/2, H, e, sess);
      }
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, H - 4, W*Math.max(0, Math.min(1, (t - sess.go)/1000/songLen(sess.s))), 4);
    }
    tv.tex.needsUpdate = true;
  });
}
const gradeCol = gr => ({AAA: '#ffe066', AA: '#ffe066', A: '#6ee7a0', B: '#7cc4ff', C: '#c7b3ff', D: '#cfd6de', E: '#ff6b6b'})[gr] || '#fff';
function tvLanes(g, X0, PW0, H, e, sess){
  const dd = e.dd, lw = 46, PW = lw*4, x0 = X0 + (PW0 - PW)/2, ry = 64, pps = 150;
  const mine = e.mine && me && me.notes, t = mine ? songTime(me.go) : (now() - sess.go)/1000, list = mine ? me.notes : chart(dd.s | 0, dd.d | 0);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = '700 15px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(String(e.name).slice(0, 12), X0 + 16, 22);
  g.textAlign = 'right'; g.fillStyle = DIFF_COL[dd.d | 0]; g.font = '700 12px system-ui, sans-serif'; g.fillText(DIFF[dd.d | 0], X0 + PW0 - 16, 22);
  g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(X0 + 16, 36, PW0 - 32, 5); g.fillStyle = dd.f ? '#ff6b6b' : '#5be37d'; g.fillRect(X0 + 16, 36, (PW0 - 32)*(dd.lf || 0)/100, 5);
  for (let l = 0; l < 4; l++){ arrowPath(g, x0 + lw*l + lw/2, ry, lw*0.8, ROT[l]); g.fillStyle = (dd.k | 0) & (1 << l) ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.06)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(220,226,235,.7)'; g.stroke(); }
  for (const n of list){
    if (n.t - t > (H - ry)/pps) break;
    const done = mine ? (n.j && n.j !== 'M' && !(n.len && n.hold === 'on')) : n.t < t - 0.03;
    if (n.len && (mine ? n.hold === 'on' || n.hold === 'wait' : n.t + n.len > t)){
      const y1 = ry + Math.max(0, n.t - t)*pps, y2 = ry + (n.t + n.len - t)*pps; if (y2 > y1){ g.fillStyle = 'rgba(80,220,140,.6)'; g.fillRect(x0 + lw*n.lane + lw*0.28, y1, lw*0.44, y2 - y1); } }
    if (done || n.t - t < -0.3) continue;
    const y = ry + (n.t - t)*pps; arrowPath(g, x0 + lw*n.lane + lw/2, y, lw*0.8, ROT[n.lane]); g.fillStyle = n.len ? '#5be37d' : QCOL[n.q]; g.globalAlpha = n.j === 'M' ? 0.3 : 1; g.fill(); g.globalAlpha = 1;
  }
  g.textAlign = 'center'; g.fillStyle = 'rgba(10,12,20,.55)'; g.fillRect(x0, H - 92, PW, 74);
  if (dd.j && !(e.mine && me && me.last && performance.now() - me.last.at > 900)){ g.font = '900 22px system-ui, sans-serif'; g.fillStyle = JCOL[dd.j] || '#fff'; g.fillText(JNAME[dd.j] || '', x0 + PW/2, H - 74); }
  g.font = '900 24px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(dd.f ? 'FAILED' : (dd.cb || 0) >= 4 ? `${dd.cb} combo` : '', x0 + PW/2, H - 48);
  g.font = '700 15px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText((dd.sc || 0).toLocaleString('en-US'), x0 + PW/2, H - 26);
}

// ---------- menus ----------
function renderLobby(){
  if (!me || me.ph !== 'lobby') return;
  const on = everyone().filter(e => !e.mine), list = SONGS.map((S, i) => {
    const b = best[i + ':' + sel.d];
    return `<div data-s="${i}" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:7px 10px;border-radius:9px;cursor:pointer;${i === sel.s ? 'background:#1d2229;color:#fff' : 'background:#f1f3f6'}">`
      + `<span><b>${esc(S.name)}</b> <span style="opacity:.65;font-size:12px">${S.bpm} BPM</span></span><span style="font-size:12px;opacity:.8">${b ? 'best ' + b.toLocaleString('en-US') : ''}</span></div>`; }).join('');
  const diffs = DIFF.map((d, i) => `<span data-d="${i}" style="flex:1;text-align:center;padding:6px 0;border-radius:8px;cursor:pointer;font-weight:600;${i === sel.d ? `background:${DIFF_COL[i]};color:#1d2229` : 'background:#f1f3f6;color:#69707a'}">${d} ${SONGS[sel.s].lv[i]}</span>`).join('');
  const who = on.length ? on.map(e => `<span style="display:inline-block;margin:2px 6px 0 0;padding:1px 8px;border-radius:10px;background:${MAT_COL[e.dd.p | 0]};color:#1d2229;font-size:12px;font-weight:600">${esc(e.name)}</span>`).join('') : '<span style="opacity:.6">Nobody else yet; colleagues can join on the other mats</span>';
  const t = isTouch();
  card.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="width:14px;height:14px;border-radius:4px;background:${MAT_COL[me.mat]}"></span><b style="font-size:17px">Dance-off · mat ${me.mat + 1}</b></div>`
    + `<div style="display:grid;gap:5px">${list}</div><div style="display:flex;gap:6px;margin:8px 0">${diffs}</div>`
    + `<div style="display:flex;justify-content:space-between;font-size:12px;color:#454b55;margin-bottom:6px"><span>Speed <b data-sp="-1" style="cursor:pointer;padding:0 6px">−</b><b>${speed.toFixed(2)}×</b><b data-sp="1" style="cursor:pointer;padding:0 6px">+</b></span>`
    + `<span>Timing <b data-of="-1" style="cursor:pointer;padding:0 6px">−</b><b>${off > 0 ? '+' : ''}${off} ms</b><b data-of="1" style="cursor:pointer;padding:0 6px">+</b></span></div>`
    + `<div style="font-size:12px;color:#454b55;margin-bottom:8px">On the mats: ${who}</div>`
    + `<button type="button" data-go style="width:100%;font-size:16px;padding:10px;border:0;border-radius:10px;background:#2f5d9e;color:#fff;font-weight:600">${busy() ? 'Song in progress…' : 'Start' + (t ? '' : ' (Enter)')}</button>`
    + (t ? `<button type="button" data-leave style="width:100%;margin-top:6px;font-size:14px;padding:8px;border:0;border-radius:10px;background:#e8ebef;color:#1d2229">Step off</button>` : '')
    + (t ? '' : `<div style="font-size:11px;color:#69707a;margin-top:8px;text-align:center">← → song · ↑ ↓ difficulty · − + speed · [ ] timing · E step off</div>`);
  card.style.display = 'block';
  const on2 = (sel2, fn) => card.querySelectorAll(sel2).forEach(b => { const go = e => { e.preventDefault(); e.stopPropagation(); fn(b); }; b.addEventListener('click', go); b.addEventListener('touchend', go); });
  on2('[data-s]', b => { sel.s = +b.dataset.s; saveCfg(); renderLobby(); });
  on2('[data-d]', b => { sel.d = +b.dataset.d; saveCfg(); renderLobby(); });
  on2('[data-sp]', b => { speed = Math.max(0.5, Math.min(3, speed + 0.25*b.dataset.sp)); saveCfg(); renderLobby(); });
  on2('[data-of]', b => { off = Math.max(-200, Math.min(200, off + 5*b.dataset.of)); saveCfg(); renderLobby(); });
  on2('[data-go]', () => startSong());
  on2('[data-leave]', () => leave());
}
function renderResults(){
  const f = me, r = f.result; if (!r) return;
  const sess = session(), rank = sess && sess.list.length > 1 ? sess.list.slice().sort((a, b) => (b.dd.sc || 0) - (a.dd.sc || 0)) : null;
  const avg = f.errN ? Math.round(f.err/f.errN*1000) : 0, c = f.counts, t = isTouch();
  const rows = rank ? `<div style="margin-top:10px;border-top:1px solid #e3e6ea;padding-top:8px">${rank.map((e, i) => `<div style="display:flex;gap:8px;align-items:center;font-size:13px;${e.mine ? 'font-weight:700' : ''}"><span style="width:14px">${i + 1}</span><span style="width:10px;height:10px;border-radius:3px;background:${MAT_COL[e.dd.p | 0]}"></span><span style="flex:1">${esc(e.name)}</span><span style="color:${gradeCol(e.dd.gr) === '#fff' ? '#69707a' : '#1d2229'}">${e.dd.gr || '…'}</span><span style="width:78px;text-align:right">${(e.dd.sc || 0).toLocaleString('en-US')}</span></div>`).join('')}</div>` : '';
  card.innerHTML = `<div style="display:flex;align-items:baseline;gap:12px"><span style="font-size:46px;font-weight:900;line-height:1;color:${r.gr === 'E' ? '#d64545' : r.gr.startsWith('A') ? '#c99a00' : '#1d2229'}">${r.gr}</span>`
    + `<span><b style="font-size:20px">${r.sc.toLocaleString('en-US')}</b>${r.nb ? ' <span style="color:#2f9e5b;font-size:12px;font-weight:700">new best!</span>' : ''}<br><span style="color:#454b55;font-size:13px">${esc(SONGS[f.s].name)} · ${DIFF[f.d]}${r.fc ? ' · <b style="color:#2f9e5b">Full combo</b>' : f.failed ? ' · failed' : ''}</span></span></div>`
    + `<div style="display:grid;grid-template-columns:auto auto auto auto;gap:2px 14px;margin-top:10px;font-size:13px;color:#454b55">`
    + `<span>Perfect</span><b style="color:#1d2229">${c.P}</b><span>Freeze OK</span><b style="color:#1d2229">${c.OK}</b>`
    + `<span>Great</span><b style="color:#1d2229">${c.G}</b><span>Freeze N.G.</span><b style="color:#1d2229">${c.NG}</b>`
    + `<span>Good</span><b style="color:#1d2229">${c.O}</b><span>Max combo</span><b style="color:#1d2229">${f.maxCombo}</b>`
    + `<span>Miss</span><b style="color:#1d2229">${c.M}</b><span>Timing</span><b style="color:#1d2229">${Math.abs(avg) < 6 ? 'spot on' : Math.abs(avg) + ' ms ' + (avg > 0 ? 'late' : 'early')}</b></div>`
    + rows
    + `<button type="button" data-again style="margin-top:12px;width:100%;font-size:16px;padding:10px;border:0;border-radius:10px;background:#2f5d9e;color:#fff;font-weight:600">Dance again${t ? '' : ' (Enter)'}</button>`
    + `<button type="button" data-leave style="width:100%;margin-top:6px;font-size:14px;padding:8px;border:0;border-radius:10px;background:#e8ebef;color:#1d2229">Step off${t ? '' : ' (E)'}</button>`;
  card.style.display = 'block';
  const on2 = (sel2, fn) => card.querySelectorAll(sel2).forEach(b => { const go = e => { e.preventDefault(); e.stopPropagation(); fn(); }; b.addEventListener('click', go); b.addEventListener('touchend', go); });
  on2('[data-again]', toLobby); on2('[data-leave]', leave);
}
// the dance-off winner: once everyone in the song has finished (or a few seconds after me)
function checkWin(){
  const f = me; if (!f || f.ph !== 'end' || f.winDone) return;
  const sess = session(); if (!sess || sess.go !== f.go) return;
  const all = sess.list, done = all.every(e => e.dd.ph === 'end' || e.dd.ph === 'lobby');
  if (!done && performance.now() - f.endAt < 5000) return;
  f.winDone = true; renderResults();
  if (all.length < 2 || f.failed) return;
  const mine = f.result.sc, top = Math.max(...all.filter(e => !e.mine).map(e => e.dd.sc || 0));
  if (mine > top){ say('🏆 You won the dance-off!'); if (window.__ach){ window.__ach('d_win'); window.__xp(15, 'Won a dance-off'); } }
}

function use(){
  if (me){
    if (me.ph === 'lobby' || me.ph === 'end'){ leave(); return true; }
    if (performance.now() - quitArm < 2000){ stopListen(); leave(); return true; }
    quitArm = performance.now(); say('Press E again to stop dancing'); return true;
  }
  if (!G.state.started || G.controlLock) return false;
  const m = onMat(); if (!m) return false;
  if (matTaken(m.i)){ say('Someone is already on this mat'); return true; }
  join(m); return true;
}
let lobbyAcc = 0;
function tick(dt, keys){
  if (!G) return '';
  updateMusic();
  if (me){
    step();
    if (me) broadcast();
    if (me && me.ph === 'lobby'){ lobbyAcc += dt; if (lobbyAcc > 0.6){ lobbyAcc = 0; renderLobby(); } }
    if (me && me.ph === 'end'){ checkWin(); lobbyAcc += dt; if (lobbyAcc > 0.6 && !me.winDone){ lobbyAcc = 0; renderResults(); } }
  } else G.state.dd = null;
  help.style.display = me && (me.ph === 'count' || me.ph === 'play') && !isTouch() ? 'block' : 'none';
  draw(dt);
  // the mats light up under everyone's feet
  const all = everyone();
  for (let i = 0; i < 4; i++){ const e = all.find(x => (x.dd.p | 0) === i); drawMat(i, e ? (e.mine ? keyDown.reduce((a, d, l) => a | (d ? 1 << l : 0), 0) : e.dd.k | 0) : 0, !!e); }
  drawTVs(dt);
  if (me || !G.state.started || G.controlLock) return '';
  const m = onMat(); if (!m) return '';
  return matTaken(m.i) ? 'This mat is taken' : (isTouch() ? 'Tap to ' : 'Press E to ') + 'dance 🕺';
}

function init(){
  G = window.GAME; THREE = G.THREE;
  cv = el('canvas', 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2'); g2 = cv.getContext('2d');
  help = el('div', 'position:fixed;left:50%;bottom:44px;transform:translateX(-50%);display:none;z-index:3;color:#fff;font-size:12px;background:rgba(20,24,30,.55);border-radius:8px;padding:4px 10px;pointer-events:none;white-space:nowrap');
  toast = el('div', 'position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:rgba(20,24,30,.8);color:#fff;border-radius:12px;padding:10px 16px;font-size:15px;pointer-events:none');
  card = el('div', 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:4;background:#fff;color:#1d2229;border-radius:16px;padding:16px 18px 14px;width:min(380px,calc(100vw - 32px));box-sizing:border-box;line-height:1.4;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.35);max-height:calc(100vh - 32px);overflow:auto');
  if (isTouch()){
    pads = el('div', 'position:fixed;left:0;right:0;bottom:0;height:100px;display:none;z-index:3;gap:6px;padding:0 6px 8px;box-sizing:border-box');
    ['←', '↓', '↑', '→'].forEach((a, lane) => { const b = el('div', `flex:1;border-radius:14px;background:rgba(20,24,30,.55);border:2px solid ${MAT_COL[lane]};color:#fff;font-size:34px;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none`, pads); b.textContent = a;
      b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (me && me.ph === 'lobby') menuKey(lane); else hit(lane, evTime(e)); b.style.background = MAT_COL[lane]; }, {passive: false});
      const up = e => { e.preventDefault(); e.stopPropagation(); release(lane); b.style.background = 'rgba(20,24,30,.55)'; }; b.addEventListener('touchend', up); b.addEventListener('touchcancel', up); });
  }
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  addEventListener('blur', () => { keyDown = [false, false, false, false]; });
  buildRoom();
  G.poseDancer = poseDancer;
  G.uses.unshift({tick, use});
}

window.DANCE = {get me(){ return me; }, chart, songs: SONGS, hit, release, start: startSong, sel};   // for testing in the console
if (window.GAME && window.GAME.uses) init(); else addEventListener('game-ready', init, {once: true});
