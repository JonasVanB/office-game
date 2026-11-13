// Office sounds, all made with the Web Audio API (no sound files): hums and murmur that loop,
// short effects (chime, lift bell, coffee machine, printer, keyboard, phone) and the alarms.
// Effects with a position get quieter with distance and pan left/right relative to where you look.

let ctx = null, master = null, noiseBuf = null, muted = false, listener = {x: 0, z: 0, yaw: 0, lv: 0};
try { muted = localStorage.getItem('office.muted') === '1'; } catch (e) {}

export const sound = {
  get ready(){ return !!ctx; },
  get muted(){ return muted; },
  // must run from a click or key press (browsers only allow audio after a user action)
  unlock(){
    if (ctx){ if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++){ const w = Math.random()*2 - 1; b = 0.97*b + 0.03*w; d[i] = w*0.5 + b*3; }   // white + a bit of brown
  },
  toggleMute(){ muted = !muted; try { localStorage.setItem('office.muted', muted ? '1' : '0'); } catch (e) {} if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05); return muted; },
  setListener(x, z, yaw, lv){ listener.x = x; listener.z = z; listener.yaw = yaw; listener.lv = lv; },
};

// gain and pan for a sound at (x, z) on level lv, heard within radius r
export function spatial(x, z, lv, r){
  if (lv !== listener.lv) return {g: 0, p: 0};
  const dx = x - listener.x, dz = z - listener.z, d = Math.hypot(dx, dz);
  const g = Math.pow(Math.max(0, 1 - d/r), 1.6);
  // listener looks along (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw)
  const p = d < 0.3 ? 0 : Math.max(-1, Math.min(1, (dx*Math.cos(listener.yaw) - dz*Math.sin(listener.yaw)) / d)) * 0.8;
  return {g, p};
}

function out(pan){
  const g = ctx.createGain();
  if (pan && ctx.createStereoPanner){ const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
  return g;
}
function noise(dest, t0, dur, type, freq, q){
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random();
  const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1000; if (q) f.Q.value = q;
  s.connect(f); f.connect(dest); s.start(t0, Math.random()*1.5); s.stop(t0 + dur); return {s, f};
}
function tone(dest, t0, dur, freq, type, vol, attack){
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + (attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05); return o;
}
function env(g, t0, a, hold, rel, v){ g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + a); g.gain.setValueAtTime(v, t0 + a + hold); g.gain.linearRampToValueAtTime(0, t0 + a + hold + rel); }

// ---------- one-shot effects. vol = 0..1 (already including distance), pan = -1..1 ----------
const FX = {
  // office PA: three-note ding-dong
  chime(v){ const d = out(0), t = ctx.currentTime; [[659, 0], [523, 0.32], [392, 0.64]].forEach(([f, o]) => { tone(d, t+o, 1.4, f, 'sine', 0.22*v); tone(d, t+o, 0.9, f*2, 'sine', 0.05*v); }); },
  // lift arrival "ding"
  lift(v, pan){ const d = out(pan), t = ctx.currentTime; tone(d, t, 1.6, 880, 'sine', 0.25*v); tone(d, t, 1.2, 1760, 'sine', 0.06*v); },
  // keyboard: a burst of clicks
  keys(v, pan){ const d = out(pan); let t = ctx.currentTime; const n = 4 + Math.random()*12 | 0;
    for (let i = 0; i < n; i++){ const g = ctx.createGain(); g.connect(d); env(g, t, 0.002, 0.008, 0.02, 0.12*v*(0.6 + Math.random()*0.6)); noise(g, t, 0.05, 'bandpass', 2500 + Math.random()*2500, 2); t += 0.06 + Math.random()*0.12; } },
  // coffee machine: grinder, then pump + pouring
  coffee(v, pan){ const d = out(pan), t = ctx.currentTime;
    const g1 = ctx.createGain(); g1.connect(d); env(g1, t, 0.1, 2.6, 0.2, 0.22*v); const n1 = noise(g1, t, 3, 'bandpass', 900, 1.5);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(n1.f.frequency); lfo.start(t); lfo.stop(t + 3);
    const g2 = ctx.createGain(); g2.connect(d); env(g2, t + 3.3, 0.3, 4, 0.8, 0.1*v); noise(g2, t + 3.3, 5.2, 'highpass', 3000);
    tone(d, t + 3.3, 4.8, 95, 'sawtooth', 0.04*v, 0.3); },
  // printer: rhythmic feed
  printer(v, pan, pages){ const d = out(pan); let t = ctx.currentTime; pages = pages || 2 + (Math.random()*4 | 0);
    tone(d, t, 1.0, 140, 'square', 0.03*v, 0.2); t += 0.8;
    for (let i = 0; i < pages; i++){ const g = ctx.createGain(); g.connect(d); env(g, t, 0.05, 0.9, 0.1, 0.12*v); const n = noise(g, t, 1.1, 'bandpass', 1400, 3);
      n.f.frequency.setValueAtTime(900, t); n.f.frequency.linearRampToValueAtTime(2000, t + 1); tone(d, t, 1.0, 220, 'triangle', 0.03*v); t += 1.3; } },
  // phone ringing twice (Teams-like two-tone)
  phone(v, pan){ const d = out(pan), t = ctx.currentTime; for (const o of [0, 2.2]) for (let i = 0; i < 6; i++){ tone(d, t+o+i*0.12, 0.11, i % 2 ? 784 : 988, 'sine', 0.12*v); } },
  // a door slamming somewhere
  slam(v, pan){ const d = out(pan), t = ctx.currentTime; const g = ctx.createGain(); g.connect(d); env(g, t, 0.003, 0.05, 0.5, 0.6*v); noise(g, t, 0.6, 'lowpass', 300); tone(d, t, 0.4, 60, 'sine', 0.5*v); },
  // footsteps walking past
  steps(v, pan){ const d = out(pan); let t = ctx.currentTime; for (let i = 0; i < 8; i++){ const g = ctx.createGain(); g.connect(d); env(g, t, 0.005, 0.03, 0.12, 0.3*v*(1 - Math.abs(i - 4)/6)); noise(g, t, 0.2, 'lowpass', 500); t += 0.55; } },
  // ghostly whisper
  whisper(v, pan){ const d = out(pan), t = ctx.currentTime; const g = ctx.createGain(); g.connect(d); env(g, t, 0.6, 1.4, 1.2, 0.14*v);
    const n = noise(g, t, 3.4, 'bandpass', 1800, 6); n.f.frequency.setValueAtTime(1200, t); n.f.frequency.linearRampToValueAtTime(2600, t + 1.5); n.f.frequency.linearRampToValueAtTime(900, t + 3.2); },
  // server alert beeps
  beep(v, pan){ const d = out(pan), t = ctx.currentTime; for (let i = 0; i < 3; i++) tone(d, t + i*0.25, 0.15, 1950, 'square', 0.05*v); },
  // a colleague saying something (muffled by distance): syllables with vowel formants on a voice pitch
  voices(v, pan){ talk(v, pan, 3 + (Math.random()*9 | 0), false); },
  laugh(v, pan){ talk(v, pan, 4 + (Math.random()*3 | 0), true); },
  // mug put down on a desk
  mug(v, pan){ const d = out(pan), t = ctx.currentTime, f = 1900 + Math.random()*600; tone(d, t, 0.35, f, 'sine', 0.06*v); tone(d, t, 0.25, f*1.58, 'sine', 0.03*v); tone(d, t + 0.09, 0.2, f*1.02, 'sine', 0.025*v); },
  // office chair: a squeak and a short roll
  chair(v, pan){ const d = out(pan), t = ctx.currentTime; const o = tone(d, t, 0.35, 420 + Math.random()*200, 'triangle', 0.025*v, 0.05); o.frequency.linearRampToValueAtTime(330, t + 0.3);
    const g = ctx.createGain(); g.connect(d); env(g, t + 0.1, 0.1, 0.4, 0.2, 0.05*v); noise(g, t + 0.1, 0.8, 'lowpass', 350); },
  // mouse clicks
  mouse(v, pan){ const d = out(pan); let t = ctx.currentTime; for (let i = 0; i < 1 + (Math.random()*3 | 0); i++){ const g = ctx.createGain(); g.connect(d); env(g, t, 0.001, 0.004, 0.01, 0.1*v); noise(g, t, 0.03, 'highpass', 3500); t += 0.12 + Math.random()*0.3; } },
  // ghost: a long wavering "oooOOOooo" that swoops down
  boo(v, pan){ const d = out(pan), t = ctx.currentTime, lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 400; lp.Q.value = 3; lp.connect(d);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.connect(g); g.connect(lp);
    o.frequency.setValueAtTime(380, t); o.frequency.linearRampToValueAtTime(520, t + 0.5); o.frequency.exponentialRampToValueAtTime(160, t + 1.8);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 6; vg.gain.value = 18; vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + 2);
    env(g, t, 0.25, 1.1, 0.6, 0.5*v); o.start(t); o.stop(t + 2.1);
    const w = ctx.createGain(); w.connect(d); env(w, t, 0.3, 1, 0.6, 0.12*v); noise(w, t, 2, 'bandpass', 900, 2); },
  // evil laugh, low and slow
  cackle(v, pan){ talk(v, pan, 7, true, 90); },
  // someone running away
  run(v, pan){ const d = out(pan); let t = ctx.currentTime; for (let i = 0; i < 10; i++){ const g = ctx.createGain(); g.connect(d); env(g, t, 0.003, 0.02, 0.08, 0.35*v*(1 - i/12)); noise(g, t, 0.15, 'lowpass', 700); t += 0.27; } },
  // darts: a dart whooshing off the hand, and the thud when it hits (board or wall)
  whoosh(v, pan){ const d = out(pan), t = ctx.currentTime, g = ctx.createGain(); g.connect(d); env(g, t, 0.03, 0.05, 0.12, 0.12*v); const n = noise(g, t, 0.25, 'bandpass', 1800, 1.5); n.f.frequency.setValueAtTime(2600, t); n.f.frequency.exponentialRampToValueAtTime(900, t + 0.2); },
  thud(v, pan, wall){ const d = out(pan), t = ctx.currentTime, g = ctx.createGain(); g.connect(d); env(g, t, 0.002, 0.02, 0.12, 0.5*v); noise(g, t, 0.15, 'lowpass', wall ? 900 : 1600);
    tone(d, t, 0.12, wall ? 140 : 220, 'sine', 0.25*v); },
  // bust: a low double buzz
  buzz(v, pan){ const d = out(pan), t = ctx.currentTime; for (const o of [0, 0.22]) tone(d, t + o, 0.18, 110, 'square', 0.08*v, 0.01); },
  // crowd cheer: lots of voices and a noisy swell (180, a checkout)
  cheer(v, pan){ const d = out(pan), t = ctx.currentTime, g = ctx.createGain(); g.connect(d); env(g, t, 0.25, 1.2, 1.2, 0.3*v); noise(g, t, 2.8, 'bandpass', 1100, 0.6);
    for (let i = 0; i < 6; i++) setTimeout(() => { try { talk(0.6*v, pan + (Math.random() - 0.5)*0.6, 3 + (Math.random()*4 | 0), Math.random() < 0.6, 160 + Math.random()*120); } catch (e) {} }, i*120); },
  // stiekem kussen: a quick smooch, and the suspicious colleague clearing their throat
  smooch(v, pan){ const d = out(pan), t = ctx.currentTime, g = ctx.createGain(); g.connect(d); env(g, t, 0.005, 0.03, 0.06, 0.25*v); noise(g, t, 0.12, "bandpass", 2600, 4);
    const o = tone(d, t + 0.02, 0.09, 900, "sine", 0.12*v); o.frequency.exponentialRampToValueAtTime(1700, t + 0.09); },
  cough(v, pan){ const d = out(pan); let t = ctx.currentTime; for (let i = 0; i < 2; i++){ const g = ctx.createGain(); g.connect(d); env(g, t, 0.01, 0.06, 0.12, 0.35*v); noise(g, t, 0.25, "bandpass", 700 - i*120, 1.5); t += 0.28; } },
  // a soft "pop" when a chat message appears
  pop(v, pan){ const d = out(pan), t = ctx.currentTime; const o = tone(d, t, 0.12, 600, 'sine', 0.12*v); o.frequency.exponentialRampToValueAtTime(1100, t + 0.08); },
  // toilet flush: a rush of water that rises, then refill hiss
  flush(v, pan){ const d = out(pan), t = ctx.currentTime;
    const g = ctx.createGain(); g.connect(d); env(g, t, 0.15, 1.2, 1.6, 0.45*v); const n = noise(g, t, 3.2, 'lowpass', 600, 0.8);
    n.f.frequency.setValueAtTime(400, t); n.f.frequency.linearRampToValueAtTime(1600, t + 0.5); n.f.frequency.linearRampToValueAtTime(500, t + 3);
    const g2 = ctx.createGain(); g2.connect(d); env(g2, t + 2.2, 0.5, 2.5, 1.2, 0.06*v); noise(g2, t + 2.2, 4.5, 'highpass', 4000); },
  // a hit on the target: a short bright ding
  ding(v, pan){ const d = out(pan), t = ctx.currentTime; tone(d, t, 0.25, 1320, 'sine', 0.1*v); tone(d, t + 0.06, 0.3, 1980, 'sine', 0.06*v); },
  // boxing: a glove landing (heavy = hook), a hit on the guard, the ring bell, the secret ring rising out of the floor
  punch(v, pan, heavy){ const d = out(pan), t = ctx.currentTime, g = ctx.createGain(); g.connect(d); env(g, t, 0.002, 0.02, heavy ? 0.22 : 0.12, 0.7*v); noise(g, t, 0.3, 'lowpass', heavy ? 700 : 1100);
    tone(d, t, heavy ? 0.25 : 0.14, heavy ? 75 : 110, 'sine', 0.5*v); },
  block(v, pan){ const d = out(pan), t = ctx.currentTime, g = ctx.createGain(); g.connect(d); env(g, t, 0.002, 0.01, 0.08, 0.4*v); noise(g, t, 0.15, 'bandpass', 1300, 1.2); tone(d, t, 0.1, 180, 'triangle', 0.15*v); },
  bell(v, pan, n){ const d = out(pan), t = ctx.currentTime; for (let i = 0; i < (n || 1); i++){ tone(d, t + i*0.32, 1.6, 1180, 'sine', 0.22*v, 0.003); tone(d, t + i*0.32, 1.1, 2950, 'sine', 0.07*v, 0.003); tone(d, t + i*0.32, 1.4, 1530, 'sine', 0.06*v, 0.003); } },
  rumble(v, pan){ const d = out(pan), t = ctx.currentTime, g = ctx.createGain(); g.connect(d); env(g, t, 0.4, 2.0, 0.8, 0.5*v); noise(g, t, 3.4, 'lowpass', 160);
    const o = tone(d, t, 3.0, 48, 'sawtooth', 0.08*v, 0.4); o.frequency.linearRampToValueAtTime(70, t + 2.6); },
  // building creak at night
  creak(v, pan){ const d = out(pan), t = ctx.currentTime; const o = tone(d, t, 1.2, 70, 'sawtooth', 0.05*v, 0.3); o.frequency.linearRampToValueAtTime(55, t + 1.2); },
};
const VOWELS = [[730, 1090], [270, 2290], [530, 1840], [300, 870], [570, 840], [440, 1020], [660, 1720], [390, 1990]];
function talk(v, pan, n, laugh, pitch){
  const d = out(pan), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.connect(d);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; const g = ctx.createGain(); g.gain.value = 0; g.connect(lp);
  const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(); for (const f of [f1, f2]){ f.type = 'bandpass'; f.Q.value = 7; o.connect(f); f.connect(g); }
  const t0 = ctx.currentTime + 0.02, base = pitch || (Math.random() < 0.5 ? 105 : 190) + Math.random()*40; let t = t0;
  for (let i = 0; i < n; i++){
    const [a, b] = laugh ? [700, 1220] : VOWELS[Math.random()*VOWELS.length | 0], dur = laugh ? 0.11 : 0.1 + Math.random()*0.17;
    f1.frequency.setTargetAtTime(a, t, 0.02); f2.frequency.setTargetAtTime(b, t, 0.02);
    o.frequency.setTargetAtTime(laugh ? base*1.4*(1 - i*0.05) : base*(0.88 + Math.random()*0.3), t, 0.03);
    g.gain.setTargetAtTime(0.16*v, t, 0.02); g.gain.setTargetAtTime(0, t + dur*0.75, 0.025);
    t += dur + (laugh ? 0.09 : 0.03 + Math.random()*0.06) + (!laugh && Math.random() < 0.2 ? 0.25 : 0);
  }
  o.start(t0); o.stop(t + 0.2);
}
export function play(name, vol = 1, pan = 0, arg){ if (!ctx || vol < 0.01 || !FX[name]) return; try { FX[name](Math.min(1, vol), pan, arg); } catch (e) {} }

// ---------- loops whose volume and pan are set every frame ----------
// kinds: haunt (spooky drone), crackle (flames), server (fans), vacuum, fire (alarm), siren (burglar)
const loops = {};
function makeLoop(kind){
  const g = ctx.createGain(); g.gain.value = 0; const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p){ g.connect(p); p.connect(master); } else g.connect(master);
  const t = ctx.currentTime, BIG = 1e7;
  if (kind === 'haunt'){ // spooky night: a low, beating drone and a cold wind
    for (const f of [55, 58.5, 110.7]){ const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = f > 100 ? 0.05 : 0.18; o.connect(og); og.connect(g); o.start(); }
    const w = noise(g, t, BIG, 'bandpass', 450, 1.5); const l = ctx.createOscillator(); l.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 250; l.connect(lg); lg.connect(w.f.frequency); l.start(); }
  else if (kind === 'crackle'){ // fire: roar plus crackling pops
    noise(g, t, BIG, 'lowpass', 500); const pops = ctx.createGain(); pops.gain.value = 0; pops.connect(g); noise(pops, t, BIG, 'highpass', 2500);
    const am = noise(pops.gain, t, BIG, 'lowpass', 25); am.f.Q.value = 0.3; }
  else if (kind === 'server'){ noise(g, t, BIG, 'bandpass', 700, 0.7); for (const f of [120, 240]){ const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = 0.15; o.connect(og); og.connect(g); o.start(); } }
  else if (kind === 'vacuum'){ noise(g, t, BIG, 'bandpass', 1100, 0.9); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 180; const og = ctx.createGain(); og.gain.value = 0.08; o.connect(og); og.connect(g); o.start(); }
  else if (kind === 'fire'){ // classic two-tone alarm bell
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 800; const og = ctx.createGain(); og.gain.value = 0.25; o.connect(og); og.connect(g); o.start();
    const l = ctx.createOscillator(); l.type = 'square'; l.frequency.value = 1.1; const lg = ctx.createGain(); lg.gain.value = 160; l.connect(lg); lg.connect(o.frequency); l.start(); }
  else if (kind === 'siren'){ const o = ctx.createOscillator(); o.type = 'sawtooth'; const og = ctx.createGain(); og.gain.value = 0.18; o.connect(og); og.connect(g); o.start();
    const l = ctx.createOscillator(); l.frequency.value = 0.6; const lg = ctx.createGain(); lg.gain.value = 350; l.connect(lg); lg.connect(o.frequency); o.frequency.value = 900; l.start(); }
  else if (kind === 'stream' || kind === 'splash'){   // pouring into water (stream) or onto tiles (splash)
    const n = noise(g, t, BIG, 'bandpass', kind === 'stream' ? 2200 : 4200, kind === 'stream' ? 1.2 : 0.8);
    const l = ctx.createOscillator(); l.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = kind === 'stream' ? 500 : 900; l.connect(lg); lg.connect(n.f.frequency); l.start(); }
  return {g, p};
}
// set a loop's volume (0..1) and pan; creates it the first time it becomes audible
export function loop(kind, vol, pan = 0){
  if (!ctx) return; let L = loops[kind];
  if (!L){ if (vol < 0.005) return; L = loops[kind] = makeLoop(kind); }
  const t = ctx.currentTime; L.g.gain.setTargetAtTime(Math.max(0, vol), t, kind === 'stream' || kind === 'splash' ? 0.05 : 0.25); if (L.p) L.p.pan.setTargetAtTime(pan, t, 0.1);
}
