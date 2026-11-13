// Avatars: everyone has the same blocky body; only colours, hair and facial hair differ.
// The avatar faces -z (the same way the camera looks at yaw 0), feet at y = 0, about 1.82 m tall.

export const OPTIONS = {
  skin: ['#f6d7c3', '#eac0a0', '#d8a27c', '#b97e56', '#8d5a3b', '#5e3a26'],
  shirt: ['#1f3a68', '#2f5d9e', '#9cc3e6', '#f4f4f2', '#2a2a2e', '#7d8288', '#b8322a', '#2f7d4a', '#e07a1f', '#f2c230', '#6a4c9c', '#d9709f'],
  pants: ['#2b3a55', '#5876a0', '#1f1f22', '#5d5f63', '#c9b48a', '#6b4a32', '#55603a', '#1f3a68'],
  hairColor: ['#1f1a17', '#3b2a20', '#6b4a32', '#9a6f45', '#d8b46a', '#b5562b', '#8f8f8f', '#e6e3dc'],
  hair: [['bald', 'Bald'], ['buzz', 'Buzz cut'], ['short', 'Short'], ['quiff', 'Quiff'], ['curly', 'Curly'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['bun', 'Bun'], ['afro', 'Afro'], ['mohawk', 'Mohawk']],
  facial: [['none', 'None'], ['stubble', 'Stubble'], ['moustache', 'Moustache'], ['goatee', 'Goatee'], ['beard', 'Short beard'], ['fullbeard', 'Full beard']],
};

export function defaultAvatar(){
  return {skin: OPTIONS.skin[1], shirt: OPTIONS.shirt[1], pants: OPTIONS.pants[0], hair: 'short', hairColor: OPTIONS.hairColor[2], facial: 'none', facialColor: OPTIONS.hairColor[2]};
}

const HEX = /^#[0-9a-f]{6}$/i;
// The Orbid sweater (avatar.sweater = true): an unlockable "shirt", grey with the Orbid logo on the left chest (progress.js unlocks it)
export const SWEATER = '#9a9da2';
let logoTex = null;
export function logoTexture(THREE){
  if (logoTex) return logoTex;
  const c = document.createElement('canvas'); c.width = 384; c.height = 128; logoTex = new THREE.CanvasTexture(c); logoTex.encoding = THREE.sRGBEncoding; logoTex.anisotropy = 4;
  const img = new Image();
  img.onload = () => {
    // the logo mark only (no "A RICOH Company" line), white background made transparent so the grey shows through
    const g = c.getContext('2d'); g.drawImage(img, 60, 90, 1800, 610, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4){ const w = Math.min(p[i], p[i+1], p[i+2]); if (w > 200) p[i+3] = Math.max(0, 255 - (w - 200)*4.6); }
    g.putImageData(d, 0, 0); logoTex.needsUpdate = true;
  };
  img.src = 'orbid-logo.png';
  return logoTex;
}
// Make any stored or received avatar safe to build: unknown values fall back to the default.
export function cleanAvatar(a){
  const d = defaultAvatar(), o = Object.assign({}, d, a || {});
  for (const k of ['skin', 'shirt', 'pants', 'hairColor', 'facialColor']) if (!HEX.test(o[k] || '')) o[k] = d[k];
  if (!OPTIONS.hair.some(h => h[0] === o.hair)) o.hair = d.hair;
  if (!OPTIONS.facial.some(f => f[0] === o.facial)) o.facial = d.facial;
  return {skin: o.skin, shirt: o.shirt, pants: o.pants, hair: o.hair, hairColor: o.hairColor, facial: o.facial, facialColor: o.facialColor, sweater: o.sweater === true};
}

const geo = new Map();
function boxGeo(THREE){ if (!geo.has(THREE)) geo.set(THREE, new THREE.BoxGeometry(1, 1, 1)); return geo.get(THREE); }

function shade(hex, f){
  const n = parseInt(hex.slice(1), 16), r = Math.round(((n >> 16) & 255)*f), g = Math.round(((n >> 8) & 255)*f), b = Math.round((n & 255)*f);
  return (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b);
}

export function buildAvatar(THREE, avatar){
  const a = cleanAvatar(avatar), G = boxGeo(THREE);
  // colours are picked as sRGB swatches; the renderer outputs sRGB, so convert to linear to match the swatch
  const m = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color: new THREE.Color(c).convertSRGBToLinear(), roughness: 0.8}, o || {}));
  const SKIN = m(a.skin), SHIRT = m(a.sweater ? SWEATER : a.shirt, a.sweater ? {roughness: 1} : undefined), PANTS = m(a.pants), SHOE = m(0x2a2a2e), HAIR = m(a.hairColor, {roughness: 0.95});
  const FACIAL = a.facial === 'stubble' ? m(a.facialColor, {transparent: true, opacity: 0.45, roughness: 1}) : m(a.facialColor, {roughness: 0.95});
  const DARK = m(0x1c1c20), MOUTH = m(shade(a.skin, 0.62)), NOSE = m(shade(a.skin, 0.93));
  const box = (parent, w, h, d, x, y, z, mat) => { const me = new THREE.Mesh(G, mat); me.scale.set(w, h, d); me.position.set(x, y, z); parent.add(me); return me; };

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const limb = (x, y) => { const g = new THREE.Group(); g.position.set(x, y, 0); body.add(g); return g; };

  // legs (pivot at the hip) with shoes
  const legL = limb(-0.105, 0.9), legR = limb(0.105, 0.9);
  for (const leg of [legL, legR]){ box(leg, 0.17, 0.82, 0.2, 0, -0.41, 0, PANTS); box(leg, 0.17, 0.09, 0.29, 0, -0.855, -0.04, SHOE); }
  // torso, belt line, neck
  box(body, 0.5, 0.6, 0.26, 0, 1.2, 0, SHIRT);
  box(body, 0.5, 0.05, 0.265, 0, 0.92, 0, PANTS);
  box(body, 0.13, 0.07, 0.13, 0, 1.53, 0, SKIN);
  // arms (pivot at the shoulder) with hands
  const armL = limb(-0.32, 1.46), armR = limb(0.32, 1.46);
  for (const arm of [armL, armR]){ box(arm, 0.13, 0.52, 0.15, 0, -0.26, 0, SHIRT); box(arm, 0.11, 0.11, 0.12, 0, -0.575, 0, SKIN); }

  // head: front face at z = -0.15
  const head = new THREE.Group(); head.position.set(0, 1.72, 0); body.add(head);
  box(head, 0.3, 0.32, 0.3, 0, 0, 0, SKIN);
  for (const sx of [-1, 1]){
    box(head, 0.05, 0.05, 0.012, sx*0.07, 0.03, -0.152, DARK);                   // eyes
    box(head, 0.075, 0.016, 0.012, sx*0.07, 0.075, -0.152, HAIR);                // eyebrows
    box(head, 0.03, 0.07, 0.05, sx*0.157, -0.005, 0, SKIN);                      // ears
  }
  box(head, 0.045, 0.06, 0.03, 0, -0.01, -0.16, NOSE);
  box(head, 0.09, 0.018, 0.012, 0, -0.085, -0.152, MOUTH);

  // hair
  const H = (w, h, d, x, y, z) => box(head, w, h, d, x, y, z, HAIR);
  const cap = (t) => { H(0.318, t, 0.318, 0, 0.16 - t/2 + 0.015, 0); H(0.318, 0.2, 0.05, 0, 0.06, 0.137); for (const sx of [-1, 1]) H(0.03, 0.12, 0.2, sx*0.155, 0.1, 0.05); };
  switch (a.hair){
    case 'buzz': H(0.31, 0.05, 0.31, 0, 0.15, 0); H(0.31, 0.16, 0.03, 0, 0.06, 0.145); for (const sx of [-1, 1]) H(0.015, 0.1, 0.2, sx*0.152, 0.1, 0.04); break;
    case 'short': cap(0.09); break;
    case 'quiff': cap(0.09); H(0.27, 0.07, 0.14, 0, 0.21, -0.08); break;
    case 'curly': { cap(0.08); const s = new THREE.SphereGeometry(1, 8, 6);
      for (let i = 0; i < 14; i++){ const t = i/14*Math.PI*2, me = new THREE.Mesh(s, HAIR); me.scale.setScalar(0.055); me.position.set(Math.cos(t)*0.13, 0.16 + (i % 2)*0.03, Math.sin(t)*0.13); head.add(me); }
      break; }
    case 'long': cap(0.09); H(0.32, 0.46, 0.07, 0, -0.09, 0.14); for (const sx of [-1, 1]) H(0.04, 0.4, 0.14, sx*0.16, -0.05, 0.06); break;
    case 'ponytail': cap(0.09); H(0.09, 0.3, 0.09, 0, -0.04, 0.2); H(0.1, 0.05, 0.1, 0, 0.1, 0.19); break;
    case 'bun': cap(0.09); H(0.14, 0.13, 0.14, 0, 0.23, 0.07); break;
    case 'afro': { const me = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), HAIR); me.scale.set(0.25, 0.22, 0.25); me.position.set(0, 0.12, 0.03); head.add(me); H(0.3, 0.06, 0.02, 0, 0.12, -0.16); break; }
    case 'mohawk': H(0.07, 0.12, 0.33, 0, 0.2, 0.01); H(0.31, 0.02, 0.31, 0, 0.155, 0); break;
  }

  // facial hair (a chin piece, jaw sides and/or a moustache, leaving the mouth free)
  const F = (w, h, d, x, y, z) => box(head, w, h, d, x, y, z, FACIAL);
  const moustache = () => F(0.13, 0.03, 0.02, 0, -0.058, -0.158);
  const jaw = (y0) => { for (const sx of [-1, 1]){ F(0.05, 0.2, 0.02, sx*0.125, (y0 + 0.06)/2, -0.155); F(0.02, 0.2, 0.18, sx*0.155, (y0 + 0.06)/2, -0.06); } };
  switch (a.facial){
    case 'stubble': F(0.29, 0.07, 0.02, 0, -0.13, -0.155); jaw(-0.16); moustache(); break;
    case 'moustache': moustache(); break;
    case 'goatee': F(0.1, 0.08, 0.025, 0, -0.13, -0.158); moustache(); break;
    case 'beard': F(0.29, 0.08, 0.03, 0, -0.13, -0.158); jaw(-0.16); moustache(); break;
    case 'fullbeard': F(0.3, 0.16, 0.06, 0, -0.17, -0.15); jaw(-0.2); moustache(); break;
  }

  // the Orbid sweater: grey, darker ribbed cuffs and hem, the logo on the left chest (the avatar's left is -x, the front is -z)
  if (a.sweater){ const RIB = m('#7b7e83', {roughness: 1});
    box(body, 0.51, 0.06, 0.27, 0, 0.93, 0, RIB);
    for (const arm of [armL, armR]) box(arm, 0.135, 0.05, 0.155, 0, -0.5, 0, RIB);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.05), new THREE.MeshStandardMaterial({map: logoTexture(THREE), transparent: true, roughness: 0.9}));
    logo.position.set(-0.12, 1.36, -0.1315); logo.rotation.y = Math.PI; body.add(logo); }
  root.userData.limbs = {legL, legR, armL, armR};
  root.userData.phase = 0;
  return root;
}

// Swing arms and legs while walking; `amount` 0 = standing still, 1 = full walk.
export function animateAvatar(root, phaseStep, amount){
  const L = root.userData.limbs; if (!L) return;
  root.userData.phase += phaseStep;
  const s = Math.sin(root.userData.phase)*0.55*amount;
  L.legL.rotation.x = s; L.legR.rotation.x = -s; L.armL.rotation.x = -s*0.8; L.armR.rotation.x = s*0.8;
}

export function makeNameTag(THREE, name){
  const c = document.createElement('canvas'), g = c.getContext('2d'), text = String(name || '').slice(0, 24);
  g.font = '600 44px system-ui, sans-serif'; const w = Math.ceil(g.measureText(text).width) + 40;
  c.width = Math.max(96, w); c.height = 72;
  g.font = '600 44px system-ui, sans-serif'; g.fillStyle = 'rgba(20,24,30,0.72)';
  const r = 30; g.beginPath(); g.moveTo(r, 4); g.arcTo(c.width - 4, 4, c.width - 4, 68, r); g.arcTo(c.width - 4, 68, 4, 68, r); g.arcTo(4, 68, 4, 4, r); g.arcTo(4, 4, c.width - 4, 4, r); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width/2, 38);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: t, depthWrite: false}));
  const h = 0.2; sp.scale.set(h*c.width/c.height, h, 1); sp.position.set(0, 2.08, 0);
  return sp;
}
