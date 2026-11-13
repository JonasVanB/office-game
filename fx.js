// What the night events look like: ghosts on a spooky night, flames and smoke during a fire,
// a burglar with a flashlight, the cleaner with a vacuum, and alarm beacons.
// Positions follow the shared game time, so every player sees the ghosts, the burglar and the cleaner
// in the same place. Only the scares (a ghost rushing at you, the burglar running off) are per player.
import {play, loop, spatial} from './sound.js';
import {buildAvatar, animateAvatar, OPTIONS} from './avatar.js';

const LO = -3.06;                                   // floor height of the 3e verdiep
const floorY = lv => lv === 2 ? LO : 0;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a)/(b - a)); return t*t*(3 - 2*t); };

export function createFX(G, announce){
  const THREE = G.THREE, scene = G.scene, fog = scene.fog, FOG0 = fog ? {near: fog.near, far: fog.far} : null;
  const add = o => { o.visible = false; scene.add(o); return o; };
  function radial(stops, size = 128){
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), gr = g.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  const GLOW = radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
  const SMOKE = radial([[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']], 64);
  const glow = (color, size, opacity = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({map: GLOW, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false})); s.scale.set(size, size, 1); return s; };
  const basic = (color, o) => new THREE.MeshBasicMaterial(Object.assign({color, fog: false}, o || {}));
  const face = (dx, dz) => Math.atan2(-dx, -dz);   // avatars look along -z

  // ================= ghosts =================
  // classic sheet ghosts: a glowing body with a wavy hem, black eyes and an "o" mouth, floating through walls
  function makeGhost(){
    const g = new THREE.Group(), pts = [];
    // round dome on top (a quarter circle), then the sheet widens a little towards the hem
    for (let i = 0; i <= 20; i++){ const a = i/20, y = 1.55 - a*1.55, r = a < 0.22 ? 0.34*Math.sqrt(1 - Math.pow(1 - a/0.22, 2)) : 0.34 + (a - 0.22)*0.16; pts.push(new THREE.Vector2(Math.max(0.001, r), y)); }
    const geo = new THREE.LatheGeometry(pts, 28), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++){ const y = p.getY(i); if (y < 0.12){ const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + 0.07*Math.sin(a*7)); } }   // wavy hem
    geo.computeVertexNormals();
    const body = new THREE.Mesh(geo, basic(0xe8f0ff, {transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false}));
    g.add(body);
    const black = basic(0x05060a), eye = new THREE.SphereGeometry(0.055, 12, 8);
    for (const sx of [-1, 1]){ const e = new THREE.Mesh(eye, black); e.scale.set(1, 1.6, 0.5); e.position.set(sx*0.11, 1.22, -0.31); g.add(e); }
    const mouth = new THREE.Mesh(eye, black); mouth.scale.set(0.9, 1.4, 0.5); mouth.position.set(0, 1.02, -0.33); g.add(mouth);
    for (const sx of [-1, 1]){ const arm = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), body.material); arm.scale.set(0.8, 1.6, 0.8); arm.position.set(sx*0.4, 0.82, -0.05); arm.rotation.z = sx*0.6; g.add(arm); }
    const halo = glow(0x9fc4ff, 2.4, 0.55); halo.position.y = 0.9; g.add(halo);
    g.userData = {body, halo};
    return add(g);
  }
  // each ghost drifts back and forth along a corridor (x from x0 to x1), swaying a little in z, so you can see it coming
  const GHOSTS = [
    {lv: 0, x0: 1.5, x1: 13, zc: 8.5, za: 2.5, ph: 0.0, sp: 0.07},  // Landscape, over the desks
    {lv: 0, x0: 14.5, x1: 33, zc: 6.5, za: 0.5, ph: 2.1, sp: 0.05}, // meeting corridor and entrance
    {lv: 0, x0: 36, x1: 49, zc: 6.5, za: 0.6, ph: 4.2, sp: 0.06},   // Stille ruimte corridor
    {lv: 2, x0: 29, x1: 49, zc: 6.5, za: 0.8, ph: 1.3, sp: 0.06},   // 3e verdiep corridor
  ].map(o => Object.assign(o, {obj: makeGhost(), hideUntil: 0, booAt: -9, laughAt: 0}));
  function ghostPos(gh, t){
    const u = t*gh.sp + gh.ph, mid = (gh.x0 + gh.x1)/2, half = (gh.x1 - gh.x0)/2;
    return {x: mid + half*Math.sin(u), z: gh.zc + gh.za*Math.sin(u*1.7 + gh.ph), y: floorY(gh.lv) + 0.35 + 0.12*Math.sin(t*1.7 + gh.ph),
      dx: half*Math.cos(u), dz: gh.za*1.7*Math.cos(u*1.7 + gh.ph)};
  }

  // ================= fire =================
  const fireG = add(new THREE.Group());
  const flames = [];
  for (let i = 0; i < 9; i++){
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.13 + Math.random()*0.12, 0.55 + Math.random()*0.5, 10, 1, true),
      basic(i % 3 === 0 ? 0xffa620 : i % 3 === 1 ? 0xff5a0a : 0xd8300a, {transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
    const a = Math.random()*Math.PI*2, r = Math.random()*0.3; m.userData = {x: Math.cos(a)*r, z: Math.sin(a)*r, ph: Math.random()*10, h: m.geometry.parameters.height};
    fireG.add(m); flames.push(m);
  }
  const fireGlow = glow(0xff6a1a, 3.6, 0.6); fireGlow.position.y = 0.4; fireG.add(fireGlow);
  const embers = [];
  for (let i = 0; i < 18; i++){ const s = glow(0xffb040, 0.08, 1); fireG.add(s); embers.push({s, age: Math.random()*2}); }
  // smoke: soft grey puffs that rise to the ceiling and spread out under it
  const smoke = [];
  for (let i = 0; i < 70; i++){ const s = add(new THREE.Sprite(new THREE.SpriteMaterial({map: SMOKE, color: 0x2c2a28, transparent: true, opacity: 0, depthWrite: false}))); smoke.push({s, age: Math.random()*8, life: 6 + Math.random()*4, a: Math.random()*Math.PI*2}); }

  // ================= alarm beacons (fire: red, burglar: red/blue) =================
  const BEACONS = [[28.15, 6.5, 0], [34.85, 6.5, 0], [14.15, 6.5, 0], [44, 5.4, 0], [6, 0.15, 0], [28.15, 6.5, 2], [34.85, 6.5, 2], [44, 5.0, 2]].map(([x, z, lv]) => {
    const g = add(new THREE.Group()); g.position.set(x, floorY(lv) + 2.35, z);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), basic(0xff2020)); g.add(lamp);
    const h = glow(0xff2020, 1.6, 0.9); g.add(h); g.userData = {lamp, h}; return g;
  });

  // ================= server room beacon =================
  const beacon = add(new THREE.Group()); beacon.position.set(27.47, 2.22, 7.55);
  { const dome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8, 0, Math.PI*2, 0, Math.PI/2), basic(0xff1a1a)); beacon.add(dome);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), basic(0x222222)); base.position.y = -0.02; beacon.add(base);
    const rot = new THREE.Group(); beacon.add(rot);
    for (const s of [1, -1]){ const beam = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 16, 1, true), basic(0xff2a2a, {transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
      beam.rotation.z = s*Math.PI/2; beam.position.x = s*1.35; beam.position.y = 0.04; rot.add(beam); }
    const h = glow(0xff2020, 1.8, 1); h.position.y = 0.05; beacon.add(h);
    beacon.userData = {rot, h}; }
  const serverGlow = add(glow(0xff2020, 4, 0.6)); serverGlow.position.set(26.7, 1.3, 10.3);

  // ================= people: burglar and cleaner =================
  const burglar = add(buildAvatar(THREE, {skin: OPTIONS.skin[2], shirt: '#1b1c20', pants: '#22242a', hair: 'buzz', hairColor: '#111111', facial: 'none', facialColor: '#111111'}));
  { const black = new THREE.MeshStandardMaterial({color: 0x101114, roughness: 0.9});
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.32), black); cap.position.y = 1.84; burglar.add(cap);          // beanie
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.315, 0.13, 0.315), black); mask.position.y = 1.625; burglar.add(mask);   // mask over nose and mouth
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshStandardMaterial({color: 0x8a7a5a, roughness: 1})); sack.scale.set(1, 1.2, 0.8); sack.position.set(0, 1.25, 0.3); burglar.add(sack);
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), black); torch.rotation.x = Math.PI/2; torch.position.set(0.32, 0.95, -0.15); burglar.add(torch);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75, 4.2, 20, 1, true), basic(0xfff1b0, {transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
    cone.rotation.x = Math.PI/2 - 0.22; cone.position.set(0.32, 0.55, -2.25); burglar.add(cone);
    const spot = glow(0xfff1b0, 0.6, 1); spot.position.set(0.32, 0.95, -0.27); burglar.add(spot); }
  const cleaner = add(buildAvatar(THREE, {skin: OPTIONS.skin[3], shirt: '#2a9d8f', pants: '#264653', hair: 'bun', hairColor: '#3b2a20', facial: 'none', facialColor: '#3b2a20'}));
  { const red = new THREE.MeshStandardMaterial({color: 0xc0392b, roughness: 0.5}), grey = new THREE.MeshStandardMaterial({color: 0x555a60, roughness: 0.6});
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 16), red); can.position.set(0.45, 0.15, 0.25); cleaner.add(can);   // vacuum cleaner
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), grey); stick.position.set(0.3, 0.45, -0.45); stick.rotation.x = 0.85; cleaner.add(stick);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.1), grey); head.position.set(0.3, 0.03, -0.8); cleaner.add(head); }
  const cart = add(new THREE.Group());
  { const grey = new THREE.MeshStandardMaterial({color: 0x6b7178, roughness: 0.6}), yellow = new THREE.MeshStandardMaterial({color: 0xf2c230, roughness: 0.5});
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.9), grey); frame.position.y = 0.5; cart.add(frame);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.3, 16), yellow); bucket.position.set(0, 1.1, 0.2); cart.add(bucket);
    const mop = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), new THREE.MeshStandardMaterial({color: 0x2f5d9e})); mop.position.set(0.05, 1.3, 0.2); mop.rotation.z = 0.15; cart.add(mop); }

  // ================= per-player state =================
  let fled = {A: null, at: 0, x: 0, z: 0, dx: 0, dz: 0, gone: false}, fireSaid = null;
  const tmpC = new THREE.Color(), COLD = new THREE.Color(0x6a62d8), SPOOKFOG = new THREE.Color(0x150c28), SMOKEFOG = new THREE.Color(0x4d4945);

  // ================= flashlight (F): a beam from your view; handy at night, needed during a power failure =================
  const torch = new THREE.SpotLight(0xfff1d6, 0, 15, 0.34, 0.6, 1.5); scene.add(torch); scene.add(torch.target);
  const dirV = new THREE.Vector3(); let torchOn = false;
  addEventListener('keydown', e => {
    const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
    if (e.code === 'KeyF' && !e.repeat && G.state.started){ torchOn = !torchOn; play('mouse', 0.8, 0); if (torchOn && window.__ach) window.__ach('n_torch'); }
  });

  // ================= power failure: emergency lights, glowing exit signs, the UPS beeping =================
  const EMERG = [[7, 6.5, 0], [21, 6.5, 0], [31.5, 6.5, 0], [43, 6.5, 0], [32, 6.5, 2], [40, 6.5, 2], [46, 6.5, 2]].map(([x, z, lv]) => {
    const g = add(new THREE.Group()); g.position.set(x, floorY(lv) + (lv === 2 ? 2.55 : 2.52), z);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.12), basic(0xf4fff4))); const h = glow(0xd8ffe0, 2.2, 0.55); h.position.y = -0.1; g.add(h); return g; });
  const EXITS = [[49.97, 2.4, 6.5, 0], [0.03, 2.4, 6.5, 0], [34.43, 2.35, 5.4, 0], [34.43, 2.35, 5.4, 2]].map(([x, y, z, lv]) => { const s = add(glow(0x22dd66, 1.1, 0.8)); s.position.set(x, floorY(lv) + y, z); return s; });
  let upsNext = 0;

  // ================= haunted extras: ghost orbs and faces at the windows =================
  const orbs = []; for (let i = 0; i < 26; i++){ const s = add(glow(0xbfe8ff, 0.16, 0.9)); orbs.push({s, x: 0, y: 0, z: 0, lv: -1, ph: Math.random()*10}); }
  const faceTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 60, 10, 64, 64, 62); gr.addColorStop(0, 'rgba(235,245,255,.95)'); gr.addColorStop(0.7, 'rgba(200,220,255,.6)'); gr.addColorStop(1, 'rgba(200,220,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(64, 64, 50, 62, 0, 0, Math.PI*2); g.fill(); g.fillStyle = '#05060a';
    for (const dx of [-18, 18]){ g.beginPath(); g.ellipse(64 + dx, 52, 9, 15, 0, 0, Math.PI*2); g.fill(); } g.beginPath(); g.ellipse(64, 92, 11, 17, 0, 0, Math.PI*2); g.fill();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
  const winFace = add(new THREE.Sprite(new THREE.SpriteMaterial({map: faceTex, transparent: true, depthWrite: false, fog: false}))); winFace.scale.set(0.55, 0.65, 1);
  let faceAt = 0, faceNext = 0;

  G.fx = {burglar, cleaner, cart, ghosts: GHOSTS.map(g => g.obj), torch, winFace};   // for testing in the console
  return {update(dt, ev){
    const st = G.state, {nowS, t, A} = ev, myLv = st.lv;
    const life = e => e ? Math.min(smooth(0, 6, A - e.A), smooth(0, 6, e.A + e.dur - A)) : 0;   // fades in and out over ~6 s

    // ---------- spooky ----------
    const ks = life(ev.spooky);
    for (const gh of GHOSTS){
      const o = gh.obj; if (ks <= 0){ o.visible = false; continue; }
      const p = ghostPos(gh, t); let x = p.x, z = p.z, y = p.y, scale = 1, op = 1;
      const d = Math.hypot(x - st.x, z - st.z), same = myLv === gh.lv;
      if (same && d < 2.2 && nowS > gh.hideUntil && nowS - gh.booAt > 1.4){ gh.booAt = nowS; const s = spatial(x, z, gh.lv, 6); play('boo', Math.max(0.6, s.g), s.p); if (window.__ach){ window.__ach('n_boo'); window.__stat('boo'); } }
      const sinceBoo = nowS - gh.booAt;
      if (sinceBoo < 1.4){   // rushes at you, grows, then vanishes
        const k = smooth(0, 0.5, sinceBoo), fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
        x += (st.x + fx*0.9 - x)*k; z += (st.z + fz*0.9 - z)*k; y = floorY(gh.lv) + 0.2 + 0.2*k; scale = 1 + 0.5*k; op = 1 - smooth(0.9, 1.4, sinceBoo);
        if (sinceBoo > 1.3) gh.hideUntil = nowS + 10;
      }
      else if (nowS < gh.hideUntil) op = smooth(gh.hideUntil - 2, gh.hideUntil, nowS);   // comes back slowly somewhere else on its path
      o.visible = true; o.position.set(x, y, z); o.scale.setScalar(scale);
      o.rotation.y = sinceBoo < 1.4 ? face(st.x - x, st.z - z) : face(p.dx, p.dz);
      const flick = 0.75 + 0.25*Math.sin(nowS*13 + gh.ph*3)*Math.sin(nowS*7.3);
      o.userData.body.material.opacity = 0.62*ks*op*flick; o.userData.halo.material.opacity = 0.55*ks*op;
      for (const c of o.children) if (c !== o.userData.body && c !== o.userData.halo && c.material && c.material !== o.userData.body.material) c.visible = op*ks > 0.25;
      if (same && d < 14 && nowS > gh.laughAt){ gh.laughAt = nowS + 9 + Math.random()*10; if (Math.random() < 0.5){ const s = spatial(x, z, gh.lv, 16); play(Math.random() < 0.5 ? 'cackle' : 'boo', s.g*0.8, s.p); } }
    }
    loop('haunt', 0.35*ks);
    if (ks > 0){ G.hemi.color.lerp(COLD, 0.6*ks); G.hemi.intensity *= 1 - 0.55*ks; G.amb.intensity *= 1 - 0.6*ks; for (const m of G.ENVMATS || []) m.envMapIntensity *= 1 - 0.85*ks; }

    // ---------- fire ----------
    const fire = ev.fire, kf = fire ? Math.min(smooth(0, 15, A - fire.A), smooth(0, 25, fire.A + fire.dur - A)) : 0;
    let fogFar = FOG0 ? FOG0.far : 190, fogNear = FOG0 ? FOG0.near : 70, fogCol = null;
    if (kf > 0){
      const sp = fire.spot, oy = floorY(sp.lv) + sp.y; fireG.visible = true; fireG.position.set(sp.x, oy, sp.z);
      for (const f of flames){ const u = f.userData, s = kf*(0.75 + 0.35*Math.sin(nowS*11 + u.ph) + 0.15*Math.random());
        f.scale.set(kf, s, kf); f.position.set(u.x, u.h*s/2, u.z); f.rotation.y += dt*2; }
      fireGlow.material.opacity = kf*(0.45 + 0.2*Math.random()); fireGlow.scale.setScalar(3.6*kf + 0.2);
      for (const e of embers){ e.age += dt; if (e.age > 2){ e.age = 0; e.x = (Math.random() - 0.5)*0.5; e.z = (Math.random() - 0.5)*0.5; } e.s.position.set(e.x || 0, e.age*0.9, (e.z || 0) + Math.sin(e.age*4)*0.1); e.s.material.opacity = kf*(1 - e.age/2); }
      const ceil = floorY(sp.lv) + 2.5;
      for (const p of smoke){
        p.age += dt; if (p.age > p.life){ p.age = 0; p.a = Math.random()*Math.PI*2; }
        const u = p.age/p.life, rise = Math.min(1, u*3), spread = Math.max(0, u*3 - 1)*2.2;
        p.s.visible = true; p.s.position.set(sp.x + Math.cos(p.a)*(0.2 + spread), oy + 0.4 + (ceil - oy - 0.4)*rise, sp.z + Math.sin(p.a)*(0.2 + spread));
        const sz = 0.5 + u*2.6; p.s.scale.set(sz, sz, 1); p.s.material.opacity = 0.6*kf*Math.sin(Math.PI*Math.min(1, u*1.1));
      }
      // smoke fills the floor: thicker the closer you are to the fire
      const near = myLv === sp.lv ? Math.hypot(st.x - sp.x, st.z - sp.z) : 40;
      fogCol = SMOKEFOG; fogNear = 0.5; fogFar = fogFar + (Math.min(60, 7 + near*0.9) - fogFar)*kf;
      const s = spatial(sp.x, sp.z, sp.lv, 16); loop('crackle', s.g*0.5*kf, s.p);
      if (fireSaid !== fire.A && myLv === sp.lv && near < 6){ fireSaid = fire.A; window.__ach && window.__ach('n_hot'); announce && announce('🥵', "It's getting really hot here. Get out!", 'Take the stairs, not the lifts', true); }
    } else { fireG.visible = false; for (const p of smoke) p.s.visible = false; loop('crackle', 0); }
    if (ks > 0 && !fogCol){ fogCol = SPOOKFOG; fogNear = 1; fogFar = fogFar + (18 - fogFar)*ks; }
    if (fog){ fog.near = fogNear; fog.far = fogFar; if (fogCol){ tmpC.copy(fog.color).lerp(fogCol, Math.max(kf, ks)); fog.color.copy(tmpC); scene.background.copy(tmpC); } }

    // ---------- alarm beacons ----------
    const alarm = fire ? 'fire' : ev.burglar ? 'burglar' : null;
    for (const b of BEACONS){
      b.visible = !!alarm; if (!alarm) continue;
      const on = Math.floor(nowS*4) % 2 === 0, col = alarm === 'burglar' && Math.floor(nowS*2) % 2 ? 0x2a5bff : 0xff2020;
      b.userData.lamp.material.color.setHex(on ? col : 0x330000); b.userData.h.material.color.setHex(col); b.userData.h.visible = on;
    }

    // ---------- server alert ----------
    beacon.visible = serverGlow.visible = !!ev.server;
    if (ev.server){ beacon.userData.rot.rotation.y += dt*5; const p = 0.6 + 0.4*Math.sin(nowS*10); beacon.userData.h.material.opacity = p; serverGlow.material.opacity = 0.35 + 0.3*Math.sin(nowS*5); }

    // ---------- burglar ----------
    const kb = life(ev.burglar);
    if (kb > 0){
      const e = ev.burglar; if (fled.A !== e.A) fled = {A: e.A, at: 0, gone: false};
      // sneaks up and down the 4e: through the Landscape, the meeting corridor and the Stille ruimte
      const L = 46, sp = 1.15, u = ((t*sp/L) % 2 + 2) % 2, dir = u < 1 ? 1 : -1, x = 2 + L*(u < 1 ? u : 2 - u);
      let bx = x, bz = 6.5 + (x < 13 ? 3.8*Math.sin(x*0.45) : x > 36 ? 1.0*Math.sin(x*0.8) : 0), fdx = dir, fdz = 0, running = false;
      const d = Math.hypot(bx - st.x, bz - st.z);
      if (!fled.at && myLv === 0 && d < 4.5){ fled.at = nowS; fled.x = bx; fled.z = bz; const k = Math.max(d, 0.1); fled.dx = (bx - st.x)/k; fled.dz = (bz - st.z)/k;
        const s = spatial(bx, bz, 0, 12); play('run', Math.max(0.5, s.g), s.p); announce && announce('🏃', 'The burglar spotted you and ran off!', 'He dropped something… the Friday fries money?', false); window.__ach && window.__ach('n_burglar'); }
      if (fled.at){ const r = nowS - fled.at; if (r > 3){ fled.gone = true; } bx = fled.x + fled.dx*4.8*r; bz = fled.z + fled.dz*4.8*r; fdx = fled.dx; fdz = fled.dz; running = true; }
      burglar.visible = !fled.gone; burglar.position.set(bx, 0, bz); burglar.rotation.y = face(fdx, fdz);
      animateAvatar(burglar, dt*(running ? 14 : 6), running ? 1.3 : 0.7);
      for (const c of burglar.children) if (c.material && c.material.blending === THREE.AdditiveBlending) c.material.opacity = (c.isSprite ? 1 : 0.13)*kb;
    } else burglar.visible = false;

    // ---------- power failure ----------
    const pw = !!ev.power;
    for (const e of EMERG) e.visible = pw; for (const e of EXITS) e.visible = pw || ks > 0;
    if (pw){
      window.__ach && window.__ach("n_power");
      G.hemi.intensity *= 0.4; G.amb.intensity *= 0.35; for (const m of G.ENVMATS || []) m.envMapIntensity *= 0.2;   // pitch dark, only the emergency lights
      if (nowS > upsNext){ upsNext = nowS + 3.2; const s = spatial(26.7, 10.3, 0, 24); play('beep', Math.max(0.12, s.g), s.p); }   // the UPS in the server room
    }
    // ---------- flashlight: F, or automatically on touch screens when it is dark ----------
    const dark = (ev.lit !== undefined ? ev.lit : 1) < 0.25;
    const torchLit = st.started && (torchOn || (window.__isTouch && (pw || dark)));
    torch.intensity = torchLit ? 1.7 : 0;
    if (torchLit){ G.camera.getWorldPosition(torch.position); G.camera.getWorldDirection(dirV); torch.position.y -= 0.15; torch.target.position.copy(torch.position).addScaledVector(dirV, 6); }

    // ---------- haunted: orbs drifting around you, a face at a window now and then ----------
    for (const o of orbs){
      if (ks <= 0){ o.s.visible = false; o.lv = -1; continue; }
      if (o.lv !== myLv || Math.hypot(o.x - st.x, o.z - st.z) > 12){ const a = Math.random()*Math.PI*2, r = 2 + Math.random()*8; o.x = st.x + Math.cos(a)*r; o.z = st.z + Math.sin(a)*r; o.y = floorY(myLv) + 0.6 + Math.random()*1.8; o.lv = myLv; }
      o.x += Math.sin(nowS*0.3 + o.ph)*dt*0.25; o.z += Math.cos(nowS*0.27 + o.ph*1.3)*dt*0.25; o.y += Math.sin(nowS*0.8 + o.ph)*dt*0.12;
      o.s.visible = true; o.s.position.set(o.x, o.y, o.z); o.s.material.opacity = ks*(0.35 + 0.35*Math.sin(nowS*2 + o.ph));
    }
    if (ks > 0 && nowS > faceNext && myLv === 0){
      faceNext = nowS + 12 + Math.random()*10; faceAt = nowS;
      const side = st.z < 6.5 ? -0.2 : 13.2;   // the window wall you are closest to
      winFace.position.set(Math.max(1, Math.min(49, st.x + (Math.random() - 0.5)*6)), 1.65, side);
      const s = spatial(winFace.position.x, side, 0, 14); play("whisper", Math.max(0.3, s.g), s.p);
    }
    const fa = nowS - faceAt; winFace.visible = ks > 0 && fa < 2.2; if (winFace.visible) winFace.material.opacity = ks*Math.min(1, fa*3, (2.2 - fa)*2);

    // ---------- cleaner ----------
    const kc = life(ev.clean);
    if (kc > 0){
      const p = ev.clean.pos, xa = p.xa || 4, za = p.za || 1.6, y = floorY(p.lv), x = p.x + Math.sin(t*0.15)*xa, z = p.z + Math.cos(t*0.195)*za;
      cleaner.visible = true; cleaner.position.set(x, y, z); cleaner.rotation.y = face(0.15*xa*Math.cos(t*0.15), -0.195*za*Math.sin(t*0.195));
      animateAvatar(cleaner, dt*4, 0.5);
      cart.visible = true; cart.position.set(p.x + 0.4, y, p.z + (p.z > 6.5 ? -2.2 : 2.2));
      const s = spatial(x, z, p.lv, 18); loop('vacuum', s.g*0.2*kc, s.p);
      if (st.lv === p.lv && Math.hypot(st.x - x, st.z - z) < 2.5 && window.__ach) window.__ach('n_cleaner');
    } else { cleaner.visible = cart.visible = false; loop('vacuum', 0); }
  }};
}
