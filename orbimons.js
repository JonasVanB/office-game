// Orbimons: 20 little creatures hidden inside the building. Walk up to one and press E to catch it.
// Some sit in plain sight, others are inside fridges and cupboards (now openable), under desks, up near the ceiling
// (jump!), in level-locked rooms, or only appear at night, on Fridays or on a haunted night.
// Golden versions: every game day two Orbimons are golden (the same two for everyone); catch one that day to get it in gold.
// The Orbidex (Q → Orbimons) shows a grey silhouette until you find one. Saved with your progress (P.o, P.og).
import {play} from './sound.js';

const LO = -3.06;
const fY = lv => lv === 2 ? LO : 0;

// ---------- the 20 Orbimons: what they look like ----------
// parts: [type, color, position, size, rotation]; type: s sphere, b box, c cylinder [rTop, rBot, h], k cone [r, h], t torus [R, r], q torus knot
// eyes: [height, forward, spacing, size]
const C = {d: '#1b1c1f', w: '#ffffff'};
export const MONS = [
  {id: 'mayo', name: "Tim's Mayonaise", hint: "Cold and creamy, Tim's pride. It hides where the drinks are kept cold (4e).", where: 'In the fridge in the 4e kitchen',
    parts: [['c', '#f3ead0', [0, 0.1, 0], [0.1, 0.11, 0.2]], ['c', '#e8c53a', [0, 0.215, 0], [0.105, 0.105, 0.04]], ['c', '#c0392b', [0, 0.09, 0], [0.112, 0.112, 0.07]], ['s', '#fff8e0', [0, 0.25, 0], [0.06, 0.04, 0.06]]], eyes: [0.155, 0.1, 0.05, 0.026]},
  {id: 'tzatziki', name: "Ruben's Tzatziki", hint: "Ruben's dip chills one floor down.", where: 'In the fridge in the 3e kitchen',
    parts: [['c', '#ffffff', [0, 0.04, 0], [0.15, 0.11, 0.08]], ['s', '#eef3e4', [0, 0.1, 0], [0.13, 0.08, 0.13]], ['b', '#5c9a3c', [0.04, 0.17, 0.03], [0.03, 0.01, 0.02]], ['b', '#5c9a3c', [-0.05, 0.165, -0.02], [0.025, 0.01, 0.02]], ['s', '#2b2b2b', [0.02, 0.18, -0.05], [0.02, 0.02, 0.02]]], eyes: [0.13, 0.11, 0.05, 0.024]},
  {id: 'vomit', name: "Ruben's Vomit", hint: 'Ruben had a rough night… check where the gentlemen go (4e).', where: "In the men's toilets on the 4e",
    parts: [['s', '#b5c341', [0, 0.03, 0], [0.2, 0.035, 0.16]], ['s', '#a8b83a', [0.04, 0.07, 0], [0.09, 0.06, 0.08]], ['s', '#d9822b', [-0.1, 0.05, 0.05], [0.025, 0.02, 0.025]], ['s', '#8a5a2b', [0.12, 0.045, -0.06], [0.02, 0.02, 0.02]], ['s', '#d9822b', [-0.05, 0.04, -0.09], [0.02, 0.015, 0.02]]], eyes: [0.1, 0.075, 0.045, 0.022]},
  {id: 'car', name: "Arne's Stinky Car", hint: "Arne's car smells so bad it got parked in a utility room.", where: 'In the utility room on the 3e',
    parts: [['b', '#c0392b', [0, 0.07, 0], [0.34, 0.08, 0.18]], ['b', '#a93226', [-0.03, 0.14, 0], [0.18, 0.07, 0.16]], ['b', '#bfe3ff', [0.06, 0.14, 0], [0.01, 0.055, 0.14]], ...[[0.11, 0.09], [0.11, -0.09], [-0.11, 0.09], [-0.11, -0.09]].map(([x, z]) => ['c', C.d, [x, 0.04, z], [0.04, 0.04, 0.03], [Math.PI/2, 0, 0]]),
      ['s', '#9dbf5a', [-0.12, 0.27, 0], [0.06, 0.05, 0.06], null, 0.45], ['s', '#9dbf5a', [-0.03, 0.31, 0.03], [0.05, 0.04, 0.05], null, 0.4], ['s', '#9dbf5a', [0.04, 0.27, -0.03], [0.045, 0.035, 0.045], null, 0.35]], eyes: [0.14, 0.075, 0.045, 0.022], faceX: true},
  {id: 'bugsy', name: 'Bugsy', hint: 'Every program has one. This one hides under a desk in the Landscape.', where: 'Under desk 5 in the Landscape',
    parts: [['s', '#2f7d4a', [0, 0.06, 0.02], [0.1, 0.06, 0.13]], ['s', '#1f4f30', [0, 0.07, -0.11], [0.06, 0.05, 0.05]], ['b', '#103a22', [0, 0.115, 0.02], [0.006, 0.01, 0.2]],
      ...[-1, 1].flatMap(s => [-0.05, 0.02, 0.09].map(z => ['b', C.d, [s*0.11, 0.03, z], [0.07, 0.01, 0.012], [0, 0, s*0.4]])), ...[-1, 1].map(s => ['b', C.d, [s*0.03, 0.14, -0.14], [0.006, 0.07, 0.006], [0.5, 0, s*0.3]])], eyes: [0.09, 0.15, 0.04, 0.018]},
  {id: 'koffie', name: 'Koffiekop', hint: 'Cups belong in the kitchen cupboard, upstairs.', where: 'In a wall cupboard in the 4e kitchen',
    parts: [['c', '#ffffff', [0, 0.08, 0], [0.08, 0.07, 0.16]], ['t', '#ffffff', [0.085, 0.09, 0], [0.04, 0.012], [0, 0, 0]], ['c', '#5a3a22', [0, 0.158, 0], [0.074, 0.074, 0.006]],
      ['t', '#e8e8e8', [0, 0.22, 0], [0.025, 0.006], [Math.PI/2, 0, 0], 0.6], ['t', '#e8e8e8', [0.02, 0.26, 0], [0.02, 0.005], [Math.PI/2, 0, 0], 0.5]], eyes: [0.1, 0.08, 0.04, 0.022]},
  {id: 'wifi', name: 'Wifi-wisp', hint: 'Strong signal near the ceiling of the biggest meeting room upstairs. Jump!', where: 'Floating near the ceiling of Portus Ganda',
    parts: [['s', '#9cc3e6', [0, 0.1, 0], [0.09, 0.09, 0.09], null, 0.9, true], ...[0.05, 0.085, 0.12].map((r, i) => ['t', '#2f5d9e', [0, 0.17 + i*0.025, 0], [r, 0.008], [0, 0, 0], 1, false, true])], eyes: [0.11, 0.085, 0.04, 0.022], glow: '#9cc3e6'},
  {id: 'postit', name: 'Post-it Pal', hint: 'Stick it as high as you can, by the emergency exit in the Stille ruimte. Jump!', where: 'High up on the post-it wall',
    parts: [['b', '#ffe866', [0, 0.12, 0], [0.22, 0.22, 0.015]], ['b', '#f2d64a', [0.08, 0.04, 0.012], [0.06, 0.06, 0.01], [0, 0, 0.5]]], eyes: [0.14, 0.012, 0.06, 0.025]},
  {id: 'dart', name: 'Dartagnan', hint: 'Bullseye! Look in the cupboards near a dartboard.', where: 'In a wall cupboard in the 3e kitchen',
    parts: [['c', '#b8bcc2', [0, 0.08, 0], [0.025, 0.025, 0.12]], ['k', '#b8bcc2', [0, 0.17, 0], [0.012, 0.06]], ['b', '#c0392b', [0, 0.01, 0], [0.09, 0.05, 0.004]], ['b', '#2f7d4a', [0, 0.01, 0], [0.004, 0.05, 0.09]],
      ['k', '#1d2229', [0, 0.215, 0], [0.04, 0.04]], ['b', '#f2c230', [0.03, 0.215, 0], [0.04, 0.008, 0.008], [0, 0, 0.6]]], eyes: [0.11, 0.026, 0.02, 0.014]},
  {id: 'printo', name: 'Printosaurus', hint: 'Rawr… paper jam. Where else would it be?', where: 'In the Print room on the 4e',
    parts: [['b', '#7d8288', [0, 0.11, 0], [0.18, 0.12, 0.2]], ['b', '#5f6368', [0, 0.2, -0.05], [0.14, 0.08, 0.12]], ['b', '#ffffff', [0, 0.18, -0.13], [0.1, 0.005, 0.08], [-0.3, 0, 0]],
      ['k', '#7d8288', [0, 0.09, 0.16], [0.05, 0.14], [Math.PI/2, 0, 0]], ...[-1, 1].map(s => ['b', '#5f6368', [s*0.06, 0.025, 0.02], [0.04, 0.05, 0.05]])], eyes: [0.23, 0.12, 0.045, 0.02]},
  {id: 'server', name: 'Serverpent', hint: 'It lives where the servers hum. Only for the Trusted.', where: 'In the server room on the 4e',
    parts: [...Array.from({length: 9}, (_, i) => { const a = i*0.75; return ['s', i % 2 ? '#1f3a68' : '#2f5d9e', [Math.cos(a)*0.1, 0.03 + i*0.008, Math.sin(a)*0.1], [0.04, 0.035, 0.04]]; }),
      ['s', '#2f5d9e', [0.02, 0.13, -0.03], [0.055, 0.045, 0.06]], ...[0, 2, 4, 6].map(i => { const a = i*0.75; return ['s', '#3cff7a', [Math.cos(a)*0.13, 0.04 + i*0.008, Math.sin(a)*0.13], [0.008, 0.008, 0.008], null, 1, true]; })], eyes: [0.15, 0.05, 0.035, 0.017]},
  {id: 'ghostie', name: 'Ghostie', hint: 'Only on a haunted night, sitting where lovers kiss.', where: 'On a beanbag in the Boekentoren, on a haunted night',
    parts: [['s', '#eef3ff', [0, 0.14, 0], [0.1, 0.12, 0.1], null, 0.7], ['k', '#eef3ff', [0, 0.05, 0], [0.1, 0.1], [Math.PI, 0, 0], 0.7]], eyes: [0.16, 0.09, 0.04, 0.02], glow: '#bcd4ff'},
  {id: 'dust', name: 'Dustbunny', hint: 'Dust gathers in the white closets of the Stille ruimte.', where: 'In a white closet in the Stille ruimte',
    parts: [['s', '#9a9da2', [0, 0.08, 0], [0.09, 0.08, 0.09]], ...[-1, 1].map(s => ['s', '#8a8d92', [s*0.04, 0.18, 0], [0.02, 0.06, 0.015], [0, 0, s*0.2]]),
      ...Array.from({length: 10}, (_, i) => { const a = i*0.63; return ['k', '#8a8d92', [Math.cos(a)*0.085, 0.08 + Math.sin(i)*0.03, Math.sin(a)*0.085], [0.012, 0.04], [Math.sin(a)*1.4, 0, -Math.cos(a)*1.4]]; })], eyes: [0.1, 0.08, 0.035, 0.018]},
  {id: 'draakje', name: 'Draakje', hint: "Ghent's golden dragon lives in a room named after its tower (3e).", where: 'In Belfort on the 3e',
    parts: [['s', '#3f7d3a', [0, 0.08, 0], [0.08, 0.07, 0.11]], ['s', '#3f7d3a', [0, 0.16, -0.08], [0.055, 0.05, 0.06]], ['k', '#3f7d3a', [0, 0.06, 0.14], [0.03, 0.12], [-Math.PI/2.4, 0, 0]],
      ...[-1, 1].map(s => ['b', '#d4af37', [s*0.1, 0.14, 0.01], [0.12, 0.005, 0.08], [0, 0, s*0.6]]), ...[-1, 1].map(s => ['k', '#d4af37', [s*0.025, 0.215, -0.08], [0.012, 0.04]])], eyes: [0.17, 0.135, 0.035, 0.018]},
  {id: 'graven', name: 'Gravenstone', hint: 'A little castle golem guards the biggest room downstairs.', where: 'In Gravensteen on the 3e',
    parts: [['b', '#8a8f95', [0, 0.1, 0], [0.18, 0.2, 0.18]], ...[-1, 0, 1].flatMap(i => [-1, 1].map(j => ['b', '#7b8086', [i*0.06, 0.22, j*0.07], [0.04, 0.04, 0.04]])), ['b', '#3b2a20', [0, 0.04, 0.091], [0.05, 0.07, 0.01]]], eyes: [0.14, 0.091, 0.045, 0.02], faceZ: true},
  {id: 'neon', name: 'Neon', hint: 'It only shines when the building sleeps, in the emptiest place downstairs.', where: 'In the west wing of the 3e, only at night',
    parts: [['s', '#fff3a0', [0, 0.13, 0], [0.08, 0.09, 0.08], null, 0.9, true], ['c', '#9aa0a6', [0, 0.04, 0], [0.04, 0.045, 0.06]], ['c', '#7b8086', [0, 0.008, 0], [0.03, 0.03, 0.016]]], eyes: [0.14, 0.075, 0.035, 0.02], glow: '#fff3a0'},
  {id: 'tegel', name: 'Tegeltje', hint: 'Blue and white wisdom, on the shelf at desk 6.', where: 'On the shelf of the desk 6 divider',
    parts: [['b', '#f7f6f1', [0, 0.11, 0], [0.18, 0.18, 0.025]], ['t', '#2f5d9e', [0, 0.11, 0.014], [0.05, 0.008]], ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => ['s', '#5f86c6', [a*0.07, 0.11 + b*0.07, 0.014], [0.015, 0.015, 0.004]])], eyes: [0.13, 0.016, 0.05, 0.02]},
  {id: 'friet', name: 'Frietje', hint: 'Only on Fridays, where the fries are served.', where: 'On the bar in the 4e kitchen, only on Fridays',
    parts: [['k', '#c0392b', [0, 0.09, 0], [0.08, 0.18], [Math.PI, 0, 0]], ['c', '#ffffff', [0, 0.17, 0], [0.081, 0.081, 0.02]],
      ...Array.from({length: 7}, (_, i) => ['b', '#f2c230', [(i - 3)*0.02, 0.22 + (i % 3)*0.015, (i % 2 ? 0.02 : -0.02)], [0.016, 0.12, 0.016], [0, 0, (i - 3)*0.08]]), ['s', '#fff8e0', [0.02, 0.27, 0], [0.03, 0.02, 0.03]]], eyes: [0.12, 0.06, 0.035, 0.02]},
  {id: 'duivel', name: 'Duiveltje', hint: "A little devil in the devil's stone.", where: 'In Duivelsteen (HR) on the 4e',
    parts: [['s', '#c0392b', [0, 0.09, 0], [0.08, 0.09, 0.08]], ...[-1, 1].map(s => ['k', '#2b1d1d', [s*0.04, 0.19, 0], [0.015, 0.05], [0, 0, -s*0.3]]), ['k', '#c0392b', [0, 0.04, 0.1], [0.012, 0.12], [-1.2, 0, 0]], ['k', '#2b1d1d', [0, 0.02, 0.17], [0.025, 0.03], [-1.2, 0, 0]]], eyes: [0.11, 0.075, 0.035, 0.02]},
  {id: 'scribble', name: 'Scribblet', hint: 'Somebody drew it on a whiteboard one floor down.', where: 'On the whiteboard in the 3e kitchen',
    parts: [['q', '#2f5d9e', [0, 0.11, 0], [0.07, 0.012]], ['q', '#c0392b', [0.02, 0.13, 0.01], [0.04, 0.008]]], eyes: [0.13, 0.03, 0.04, 0.02]},
];

// where they hide: [x, base y above that floor, z, level], in: a container, when: night | friday | spooky, reach: catch distance
const SPOTS = {
  mayo: {p: [40.12, 0.95, 10.08, 0], in: 'fridge4'}, tzatziki: {p: [35.87, 0.9, 8.63, 2], in: 'fridge3'},
  vomit: {p: [28.45, 0, 10.2, 0]}, car: {p: [31.5, 0, 12.45, 2]}, bugsy: {p: [2.0, 0, 10.4, 0]},
  koffie: {p: [39.53, 1.54, 8.62, 0], in: 'wall4b'}, wifi: {p: [21.0, 2.25, 10.3, 0], reach: 1.0}, postit: {p: [49.84, 2.82, 6.86, 0], reach: 0.95},
  dart: {p: [35.5, 1.54, 11.6, 2], in: 'wall3c'}, printo: {p: [14.45, 0, 9.55, 0]}, server: {p: [27.25, 0, 12.5, 0]},
  ghostie: {p: [37.9, 0.62, 12.2, 0], when: 'spooky'}, dust: {p: [49.4, 0.9, 5.56, 0], in: 'closet7'}, draakje: {p: [40.2, 0.77, 10.6, 2]},
  graven: {p: [49.3, 0, 0.75, 2]}, neon: {p: [0.8, 0, 12.2, 2], when: 'night'}, tegel: {p: [6.955, 0.91, 10.2, 0]},
  friet: {p: [42.0, 1.1, 9.6, 0], when: 'friday'}, duivel: {p: [35.6, 0, 0.8, 0]}, scribble: {p: [37.88, 1.25, 11.0, 2]},
};

// ---------- openable furniture: an overlay door that swings open over the existing front ----------
// face: the front plane (axis 'x' = the front is at x = c, spanning z a0..a1; 'z' = at z = c spanning x), dir: which way it faces, y0..y1, lv
const GAGS = ['An old Kwak glass, still sticky', 'Three USB sticks, all called final_v2', 'A sad salad from last Tuesday', 'A cable for a phone nobody owns any more',
  'The good scissors! Hide them again', 'Somebody’s secret stash of stroopwafels', 'A Windows XP install CD', 'A label: DO NOT EAT (Ruben)', 'An empty box of fries',
  'Twelve sachets of mayonnaise', 'A dusty team-building trophy', 'Post-its. Hundreds of post-its', 'One sock. Nobody asks', 'A printer manual, never opened',
  'A mug that says WORLD’S OKAYEST DEVELOPER', 'Spare HDMI adapters (all the wrong kind)', 'A forgotten birthday card for someone who left in 2021', 'Coffee filters and a rubber duck',
  'A jar of speculoos spread, half empty', 'A note: “the Wi-Fi password is on the back”. The back is blank', 'A tiny Christmas tree, still decorated'];
function containers(){
  const L = [];
  L.push({id: 'fridge4', name: 'fridge', axis: 'x', c: 40.0, a0: 9.51, a1: 10.65, y0: 0.02, y1: 1.83, dir: 1, lv: 0, col: 0xb9bdc2, inside: 0xeef3f6, cold: true});
  L.push({id: 'fridge3', name: 'fridge', axis: 'x', c: 35.75, a0: 8.28, a1: 8.98, y0: 0.02, y1: 1.83, dir: 1, lv: 2, col: 0xd9dcdf, inside: 0xeef3f6, cold: true});
  L.push({id: 'wall4a', name: 'cupboard', axis: 'x', c: 39.43, a0: 7.73, a1: 8.62, y0: 1.5, y1: 2.2, dir: 1, lv: 0, col: 0xf3f2ee});
  L.push({id: 'wall4b', name: 'cupboard', axis: 'x', c: 39.43, a0: 8.62, a1: 9.51, y0: 1.5, y1: 2.2, dir: 1, lv: 0, col: 0xf3f2ee});
  L.push({id: 'wall4c', name: 'cupboard', axis: 'z', c: 8.1, a0: 39.73, a1: 40.69, y0: 1.5, y1: 2.2, dir: 1, lv: 0, col: 0xf3f2ee});
  L.push({id: 'wall4d', name: 'cupboard', axis: 'z', c: 8.1, a0: 40.69, a1: 41.65, y0: 1.5, y1: 2.2, dir: 1, lv: 0, col: 0xf3f2ee});
  ['a', 'b', 'c', 'd'].forEach((k, i) => L.push({id: 'wall3' + k, name: 'cupboard', axis: 'x', c: 35.4, a0: 9.98 + i*0.6425, a1: 9.98 + (i + 1)*0.6425, y0: 1.5, y1: 2.2, dir: 1, lv: 2, col: 0xf3f2ee}));
  ['a', 'b', 'c', 'd'].forEach((k, i) => L.push({id: 'base3' + k, name: 'cupboard', axis: 'x', c: 35.65, a0: 9.98 + i*0.6425, a1: 9.98 + (i + 1)*0.6425, y0: 0.06, y1: 0.86, dir: 1, lv: 2, col: 0xf3f2ee}));
  for (let i = 0; i < 7; i++) L.push({id: 'closet' + (i + 1), name: 'closet', axis: 'x', c: 49.5, a0: 0.45 + i*0.7857, a1: 0.45 + (i + 1)*0.7857, y0: 0.06, y1: 2.08, dir: -1, lv: 0, col: 0xf6f5f1});
  L.forEach((c, i) => { c.gag = GAGS[i % GAGS.length]; });
  return L;
}

export function initOrbimons({G, prog, me}){
  const THREE = G.THREE, scene = G.scene, P = () => prog.P;
  const owned = id => !!(P().o && P().o[id]), gold = id => !!(P().og && P().og[id]);
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const day = () => window.CLOCK && window.CLOCK.game ? window.CLOCK.game() : null;
  // the two golden Orbimons of this game day (the same for everyone)
  const goldenToday = () => { const g = day(); if (!g) return []; const R = rng(g.dayN*613 + 77), a = R()*MONS.length | 0; let b = R()*(MONS.length - 1) | 0; if (b >= a) b++; return [MONS[a].id, MONS[b].id]; };

  // ---------- building the models ----------
  const GOLD = new THREE.MeshStandardMaterial({color: 0xf2c230, metalness: 0.85, roughness: 0.25, emissive: 0x4a3600});
  function model(m, golden){
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    for (const [t, col, p, s, r, op, glow, flat] of m.parts){
      let geo;
      if (t === 's') geo = new THREE.SphereGeometry(1, 16, 12);
      else if (t === 'b') geo = new THREE.BoxGeometry(1, 1, 1);
      else if (t === 'c') geo = new THREE.CylinderGeometry(s[0], s[1], s[2], 18);
      else if (t === 'k') geo = new THREE.ConeGeometry(s[0], s[1], 14);
      else if (t === 't') geo = new THREE.TorusGeometry(s[0], s[1], 8, 24, flat ? Math.PI : Math.PI*2);
      else geo = new THREE.TorusKnotGeometry(s[0], s[1], 64, 6, 2, 3);
      const mat = golden ? GOLD : glow ? new THREE.MeshBasicMaterial({color: new THREE.Color(col).convertSRGBToLinear(), transparent: op < 1, opacity: op === undefined ? 1 : op})
        : new THREE.MeshStandardMaterial({color: new THREE.Color(col).convertSRGBToLinear(), roughness: 0.6, transparent: op !== undefined && op !== null && op < 1, opacity: op == null ? 1 : op});
      const me = new THREE.Mesh(geo, mat);
      if (t === 's' || t === 'b') me.scale.set(s[0], s[1], s[2]);
      me.position.set(p[0], p[1], p[2]); if (r) me.rotation.set(r[0], r[1], r[2]);
      if (t === 't' && flat) me.rotation.z = 0;
      body.add(me);
    }
    // googly eyes on the front (-z): white, a pupil, blink by scaling
    const [ey, ez, sep, sz] = m.eyes, eyes = [];
    for (const sx of [-1, 1]){
      const e = new THREE.Group(); e.position.set(sx*sep/2, ey, -ez);
      const w = new THREE.Mesh(new THREE.SphereGeometry(sz, 12, 10), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.3})); e.add(w);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(sz*0.5, 10, 8), new THREE.MeshBasicMaterial({color: 0x111111})); pu.position.z = -sz*0.62; e.add(pu);
      body.add(e); eyes.push(e);
    }
    if (golden || m.glow){ const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, golden ? 'rgba(255,220,90,.9)' : 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c), sp = new THREE.Sprite(new THREE.SpriteMaterial({map: t, color: golden ? 0xffd34d : m.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
      sp.scale.set(0.6, 0.6, 1); sp.position.y = 0.12; g.add(sp); g.userData.halo = sp; }
    g.userData.eyes = eyes; g.userData.body = body; return g;
  }

  // ---------- the furniture you can open ----------
  const BOX = new THREE.BoxGeometry(1, 1, 1), CONT = containers();
  for (const c of CONT){
    const w = c.a1 - c.a0, h = c.y1 - c.y0, base = fY(c.lv);
    const hinge = new THREE.Group(), out = c.dir*0.014;
    if (c.axis === 'x') hinge.position.set(c.c + out, base + c.y0 + h/2, c.a0); else hinge.position.set(c.a0, base + c.y0 + h/2, c.c + out);
    const door = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({color: c.col, roughness: 0.45}));
    if (c.axis === 'x'){ door.scale.set(0.02, h - 0.01, w - 0.01); door.position.set(0, 0, w/2); } else { door.scale.set(w - 0.01, h - 0.01, 0.02); door.position.set(w/2, 0, 0); }
    const handle = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({color: 0xb9bdc2, metalness: 0.6, roughness: 0.3}));
    if (c.axis === 'x'){ handle.scale.set(0.02, Math.min(0.2, h*0.3), 0.02); handle.position.set(c.dir*0.015, 0, w - 0.06); } else { handle.scale.set(0.02, Math.min(0.2, h*0.3), 0.02); handle.position.set(w - 0.06, 0, c.dir*0.015); }
    hinge.add(door); hinge.add(handle); scene.add(hinge);
    // the inside you see when it is open: a plane just in front of the original front, with a shelf
    const inside = new THREE.Group(); inside.visible = false; scene.add(inside);
    const back = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({color: c.inside || 0x3a3d42, roughness: 0.9, emissive: c.cold ? 0x2a3036 : 0}));
    const shelf = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({color: c.cold ? 0xdfe8ee : 0x55595e}));
    if (c.axis === 'x'){ back.scale.set(0.005, h - 0.04, w - 0.04); back.position.set(c.c + c.dir*0.006, base + c.y0 + h/2, (c.a0 + c.a1)/2); shelf.scale.set(0.12, 0.012, w - 0.06); shelf.position.set(c.c + c.dir*0.06, base + c.y0 + h*0.48, (c.a0 + c.a1)/2); }
    else { back.scale.set(w - 0.04, h - 0.04, 0.005); back.position.set((c.a0 + c.a1)/2, base + c.y0 + h/2, c.c + c.dir*0.006); shelf.scale.set(w - 0.06, 0.012, 0.12); shelf.position.set((c.a0 + c.a1)/2, base + c.y0 + h*0.48, c.c + c.dir*0.06); }
    inside.add(back); if (h > 0.5) inside.add(shelf);
    Object.assign(c, {hinge, inside, open: 0, target: 0, seen: false,
      ctr: c.axis === 'x' ? [c.c + c.dir*0.6, (c.a0 + c.a1)/2] : [(c.a0 + c.a1)/2, c.c + c.dir*0.6]});
  }
  const byId = Object.fromEntries(CONT.map(c => [c.id, c]));

  // ---------- the Orbimons in the building ----------
  const live = MONS.map(m => { const sp = SPOTS[m.id], n = model(m, false), g = model(m, true); n.visible = g.visible = false; scene.add(n); scene.add(g);
    const [x, y, z, lv] = sp.p; for (const o of [n, g]){ o.position.set(x, fY(lv) + y, z); }
    return {m, sp, n, g, poof: 0}; });

  const isNight = () => { const d = day(); return d && (d.min < 420 || d.min >= 1140); };
  const isFriday = () => { const d = day(); return d && d.wd === 4; };
  const spooky = () => window.CLOCK && window.CLOCK.active && window.CLOCK.active().includes('spooky');
  function present(o){
    const sp = o.sp;
    if (sp.in && !(byId[sp.in] && byId[sp.in].open > 0.7)) return false;
    if (sp.when === 'night' && !isNight()) return false;
    if (sp.when === 'friday' && !isFriday()) return false;
    if (sp.when === 'spooky' && !spooky()) return false;
    return true;
  }
  const wanted = (o, goldIds) => !owned(o.m.id) || (goldIds.includes(o.m.id) && !gold(o.m.id));

  // ---------- catching and opening (E) ----------
  const eye = new THREE.Vector3();
  function nearest(){
    const s = G.state; if (!s.started || G.controlLock) return null;
    G.camera.getWorldPosition(eye); const goldIds = goldenToday();
    let best = null, bd = 9;
    for (const o of live){
      if (o.poof || !wanted(o, goldIds) || !present(o) || o.sp.p[3] !== s.lv) continue;
      const p = o.n.position, d = Math.hypot(eye.x - p.x, eye.y - (p.y + 0.12), eye.z - p.z), r = o.sp.reach || 1.6;
      if (d < r && d < bd){ bd = d; best = {kind: 'mon', o, golden: goldIds.includes(o.m.id) && !gold(o.m.id)}; }
    }
    if (best) return best;
    for (const c of CONT){ if (c.lv !== s.lv || Math.abs(s.y - fY(c.lv)) > 1.2) continue; const d = Math.hypot(s.x - c.ctr[0], s.z - c.ctr[1]); if (d < 1.0 && d < bd){ bd = d; best = {kind: 'cont', c}; } }
    return best;
  }
  function catchMon(t){
    const o = t.o, id = o.m.id, first = !owned(id), P0 = P();
    P0.o = P0.o || {}; P0.og = P0.og || {}; P0.o[id] = 1; if (t.golden) P0.og[id] = 1;
    o.poof = performance.now(); play('cheer', 0.7, 0); play('ding', 0.9, 0);
    const n = Object.keys(P0.o).length, ng = Object.keys(P0.og).length;
    window.__progToast && window.__progToast(`${t.golden ? '✨ GOLDEN ' : '🟣 '}${o.m.name} caught!`, `${n}/${MONS.length} in your Orbidex${t.golden ? ` · ${ng} golden` : ''} · Q → Orbimons`);
    if (window.__xp) window.__xp(t.golden ? 60 : first ? 25 : 5, t.golden ? 'Golden Orbimon' : 'Orbimon');
    const A = window.__ach || (() => {});
    A('o_first'); if (n >= 5) A('o_5'); if (n >= 10) A('o_10'); if (n >= MONS.length) A('o_all');
    if (t.golden){ A('o_gold'); if (ng >= 5) A('o_gold5'); if (ng >= MONS.length) A('o_goldall'); }
    if (id === 'neon') A('o_neon'); if (id === 'ghostie') A('o_ghost'); if (id === 'wifi' || id === 'postit') A('o_jump'); if (o.sp.in) A('o_hidden');
    if ((t.golden || n === MONS.length) && window.__mpSay) window.__mpSay(t.golden ? `✨ caught a GOLDEN ${o.m.name}!` : `🟣 completed the Orbidex: all ${MONS.length} Orbimons!`);
    prog.save(); prog.refresh();
  }
  function toggle(c){
    c.target = c.target ? 0 : 1; play(c.cold ? 'pop' : 'creak', 0.5, 0);
    if (c.target && !c.seen){ c.seen = true; if (window.__stat) window.__stat('opened');
      const hasMon = live.some(o => o.sp.in === c.id && wanted(o, goldenToday()));
      if (!hasMon) window.__progToast && window.__progToast(`🗄️ ${c.gag}`, `Nothing alive in this ${c.name}`); }
  }
  G.uses.unshift({
    tick(dt){
      const goldIds = goldenToday(), t = performance.now()/1000, cam = G.camera.getWorldPosition(eye);
      // doors swing outwards; the inside shows while open
      for (const c of CONT){ c.open += (c.target - c.open)*Math.min(1, dt*7); c.hinge.rotation.y = c.open*1.9*(c.axis === 'x' ? c.dir : -c.dir); c.inside.visible = c.open > 0.05; }
      for (const o of live){
        const show = wanted(o, goldIds) && present(o), isGold = goldIds.includes(o.m.id) && !gold(o.m.id) && (owned(o.m.id) || true);
        const obj = isGold ? o.g : o.n, other = isGold ? o.n : o.g; other.visible = false;
        if (o.poof){ const k = (performance.now() - o.poof)/600; obj.visible = k < 1; obj.scale.setScalar(1 + k*0.8); obj.position.y = fY(o.sp.p[3]) + o.sp.p[1] + k*0.4; if (k >= 1){ o.poof = 0; obj.scale.setScalar(1); obj.position.y = fY(o.sp.p[3]) + o.sp.p[1]; } continue; }
        obj.visible = show; if (!show) continue;
        const b = obj.userData.body; b.position.y = Math.sin(t*2.2 + o.m.id.length)*0.012;
        if (!o.m.faceX && !o.m.faceZ) obj.rotation.y = Math.atan2(cam.x - obj.position.x, cam.z - obj.position.z) + Math.PI;
        const blink = (t + o.m.id.length*0.7) % 3.4 < 0.12 ? 0.15 : 1; for (const e of obj.userData.eyes) e.scale.y = blink;
        if (obj.userData.halo) obj.userData.halo.material.opacity = 0.55 + 0.3*Math.sin(t*3);
      }
      if (!me()) return '';
      const n = nearest(); if (!n) return '';
      const act = window.__isTouch ? 'Tap' : 'Press E';
      return n.kind === 'mon' ? `${n.golden ? '✨ ' : '🟣 '}${act} to catch ${owned(n.o.m.id) ? n.o.m.name : 'the Orbimon'}!${n.golden ? ' It is GOLDEN!' : ''}` : `${act} to ${n.c.target ? 'close' : 'open'} the ${n.c.name}`;
    },
    use(){ if (!me()) return false; const n = nearest(); if (!n) return false; if (n.kind === 'mon') catchMon(n); else toggle(n.c); return true; },
  });

  // ---------- the Orbidex: portraits rendered once, grey silhouettes until found ----------
  let pics = null;
  function portraits(){
    if (pics) return pics; pics = {};
    try {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const r = new THREE.WebGLRenderer({canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true}); r.outputEncoding = THREE.sRGBEncoding;
      const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 0.9)); sc.add(new THREE.AmbientLight(0xffffff, 0.35)); const sun = new THREE.DirectionalLight(0xfff3df, 0.7); sun.position.set(-1, 3, -2); sc.add(sun);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 10);
      for (const m of MONS) for (const golden of [false, true]){
        const o = model(m, golden); if (o.userData.halo) o.remove(o.userData.halo); o.rotation.y = 0.45; sc.add(o);
        const box = new THREE.Box3().setFromObject(o), ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
        cam.position.set(ctr.x - size*0.45, ctr.y + size*0.6, ctr.z - size*1.9); cam.lookAt(ctr); r.render(sc, cam);
        const url = c.toDataURL('image/png'); sc.remove(o);
        if (!golden){ pics[m.id] = url; const s = document.createElement('canvas'); s.width = s.height = 160; const x = s.getContext('2d'), im = new Image();
          im.onload = () => { x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#9aa0a6'; x.fillRect(0, 0, 160, 160); pics[m.id + '_s'] = s.toDataURL('image/png'); if (window.__progRefresh) window.__progRefresh(); };
          im.src = url; pics[m.id + '_s'] = url; }
        else pics[m.id + '_g'] = url;
      }
      r.dispose(); r.forceContextLoss && r.forceContextLoss();
    } catch (e){ console.warn('orbidex pictures', e); }
    return pics;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  window.__orbidex = () => {
    const pic = portraits(), goldIds = goldenToday(), n = MONS.filter(m => owned(m.id)).length, ng = MONS.filter(m => gold(m.id)).length;
    let h = `<h2>🟣 Orbidex · ${n} of ${MONS.length} found · ✨ ${ng} golden</h2><div class="note">Orbimons hide all over the building: in plain sight, in fridges and cupboards (press E to open them), up high (jump!), behind locked doors, or only at certain times.`
      + ` Every game day two of them are <b>golden</b>: catch one that day to add the golden version.</div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(132px,1fr));margin-top:10px">`;
    for (const m of MONS){
      const got = owned(m.id), g = gold(m.id), img = g ? pic[m.id + '_g'] : got ? pic[m.id] : pic[m.id + '_s'];
      h += `<div style="border-radius:12px;padding:8px;background:${g ? 'linear-gradient(#fff6d6,#f2d27a)' : got ? '#f6f8fb' : '#eef0f3'};text-align:center;font-size:12px;line-height:1.3;${g ? 'box-shadow:0 0 0 2px #e0b52c' : ''}">`
        + `<img src="${img || ''}" alt="" style="width:96px;height:96px;${got ? '' : 'opacity:.85'}"><b style="display:block;font-size:13px">${got ? esc(m.name) : '???'}${g ? ' ✨' : ''}</b>`
        + `<span style="color:#5a6472">${got ? esc(m.where) : esc(m.hint)}</span></div>`;
    }
    return h + `</div><div class="note" style="margin-top:8px">${goldIds.some(id => !gold(id)) ? '✨ Rumour has it a golden Orbimon is around today…' : 'No new golden Orbimons for you today.'}</div>`;
  };
  window.ORBI = {MONS, SPOTS, containers: CONT, goldenToday, live};   // for testing in the console
}
