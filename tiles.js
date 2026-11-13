// Tile wall: the divider between desk 6 and desk 7 is printed with white-and-blue tiles (desk 6 side).
// Look at an empty tile and press E (or tap the prompt) to put your own quote on it, like the classic blue tile wisdoms.
// Look at a quote to read it; press E on one of your own to change or remove it. Up to 5 tiles per player.
// Shared through the database (tiles/<panel>_<col>_<row> = {q, n, by, t}).

const X = 6.925 - 0.003;                 // desk 6 side of the divider, facing -x
const COLS = 10, ROWS = 11, TS = 0.16067; // 10 tiles across a 1.607 m panel, 11 rows up to ~1.79 m
const PANELS = [{z0: 7.72}, {z0: 10.9933}];
const PX = 128, MAXQ = 70, MAXPER = 5;
const BLUE = '#1f4e9c', BLUE2 = '#5f86c6';
const CSS = `
#tileCard{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;z-index:6;background:#fff;color:#1d2229;border-radius:16px;padding:18px 20px 14px;width:min(380px,90vw);box-shadow:0 10px 40px rgba(0,0,0,.35);font-size:14px;line-height:1.45}
#tileCard h1{font-size:18px;margin:0 0 8px;font-weight:600}
#tileCard .row{display:flex;gap:14px;align-items:center}
#tileCard canvas{width:128px;height:128px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.25);flex:none}
#tileCard textarea{width:100%;box-sizing:border-box;font:16px Georgia,serif;padding:8px 10px;border:1px solid #c5cdd8;border-radius:8px;resize:none;height:84px}
#tileCard .btns{display:flex;gap:8px;margin-top:12px}
#tileCard button{flex:1;font-size:15px;padding:10px;border:0;border-radius:10px;font-weight:600;cursor:pointer;background:#e6eaf0;color:#1d2229}
#tileCard button.go{background:#2f5d9e;color:#fff}
#tileCard button.del{background:#fbe3e1;color:#a3261d}
#tileCard .note{font-size:12px;color:#5a6472;margin-top:6px}
`;

// ---------- drawing a tile ----------
function ornament(g, x, y, s){
  // printed Delft-style pattern: blue quarter flowers in the corners and a small rosette in the middle
  g.fillStyle = '#f7f6f1'; g.fillRect(x, y, s, s);
  g.strokeStyle = 'rgba(31,78,156,.18)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, s - 2, s - 2);
  g.fillStyle = BLUE2;
  for (const [cx, cy, a] of [[x, y, 0], [x + s, y, Math.PI/2], [x + s, y + s, Math.PI], [x, y + s, -Math.PI/2]]){
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.beginPath(); g.arc(0, 0, s*0.16, 0, Math.PI/2); g.lineTo(0, 0); g.fill();
    for (const t of [0.2, 0.62, 1.05, 1.47]){ g.beginPath(); g.ellipse(Math.cos(t)*s*0.24, Math.sin(t)*s*0.24, s*0.05, s*0.022, t, 0, Math.PI*2); g.fill(); }
    g.restore();
  }
}
function drawTile(g, x, y, s, tile){
  if (tile){   // a quote tile: plain white glaze with a thin blue double border and tiny corner dots, so the text stands out
    g.fillStyle = '#fbfaf5'; g.fillRect(x, y, s, s);
    g.strokeStyle = BLUE; g.lineWidth = s*0.025; g.strokeRect(x + s*0.06, y + s*0.06, s*0.88, s*0.88);
    g.lineWidth = s*0.008; g.strokeRect(x + s*0.1, y + s*0.1, s*0.8, s*0.8);
    g.fillStyle = BLUE2; for (const [cx, cy] of [[0.035, 0.035], [0.965, 0.035], [0.965, 0.965], [0.035, 0.965]]){ g.beginPath(); g.arc(x + cx*s, y + cy*s, s*0.022, 0, Math.PI*2); g.fill(); }
  } else ornament(g, x, y, s);
  if (!tile){   // empty: a small rosette
    g.fillStyle = 'rgba(95,134,198,.55)'; const c = s/2;
    for (let i = 0; i < 6; i++){ const a = i*Math.PI/3; g.beginPath(); g.ellipse(x + c + Math.cos(a)*s*0.07, y + c + Math.sin(a)*s*0.07, s*0.05, s*0.025, a, 0, Math.PI*2); g.fill(); }
    g.beginPath(); g.arc(x + c, y + c, s*0.025, 0, Math.PI*2); g.fill(); return;
  }
  // quote: blue serif, as large as fits, max 5 lines; the author small underneath
  g.fillStyle = BLUE; g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = String(tile.q).split(/\s+/), W = s*0.7, maxH = s*0.56;
  let size = s*0.2, lines;
  for (; size > s*0.075; size -= 1){
    g.font = `italic 600 ${size}px Georgia,"Times New Roman",serif`; lines = []; let line = '';
    for (const w of words){ const t = line ? line + ' ' + w : w; if (g.measureText(t).width > W && line){ lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    if (lines.length*size*1.12 <= maxH && lines.every(l => g.measureText(l).width <= W)) break;
  }
  const lh = size*1.12, y0 = y + s*0.44 - (lines.length - 1)*lh/2;
  lines.slice(0, 6).forEach((l, i) => g.fillText(l, x + s/2, y0 + i*lh));
  g.font = `${Math.max(9, s*0.075)}px Georgia,serif`; g.fillStyle = BLUE2; g.fillText('— ' + tile.n, x + s/2, y + s*0.86);
}

export function initTiles({G, net, me}){
  const THREE = G.THREE, tiles = new Map();
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  // one canvas texture per panel
  for (const p of PANELS){
    p.c = document.createElement('canvas'); p.c.width = COLS*PX; p.c.height = ROWS*PX; p.g = p.c.getContext('2d');
    p.tex = new THREE.CanvasTexture(p.c); p.tex.encoding = THREE.sRGBEncoding; p.tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(COLS*TS, ROWS*TS), new THREE.MeshStandardMaterial({map: p.tex, roughness: 0.55}));
    m.rotation.y = -Math.PI/2; m.position.set(X, 0.02 + ROWS*TS/2, p.z0 + COLS*TS/2); G.scene.add(m);
  }
  const key = (pi, c, r) => `${pi}_${c}_${r}`;
  function paint(pi){
    const p = PANELS[pi];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) drawTile(p.g, c*PX, (ROWS - 1 - r)*PX, PX, tiles.get(key(pi, c, r)));
    p.tex.needsUpdate = true;
  }
  paint(0); paint(1);
  let queued = new Set(), qt = 0;
  net.onTiles((k, v) => {
    if (!/^[01]_\d_\d{1,2}$/.test(k)) return;
    if (v && typeof v.q === 'string' && v.q.trim()) tiles.set(k, {q: v.q.slice(0, MAXQ), n: String(v.n || '').slice(0, 20), by: v.by, t: v.t || 0}); else tiles.delete(k);
    queued.add(+k[0]); clearTimeout(qt); qt = setTimeout(() => { for (const pi of queued) paint(pi); queued.clear(); }, 60);
  });

  // ---------- which tile you look at ----------
  const ray = new THREE.Vector3(), dir = new THREE.Vector3();
  function lookedAt(){
    const s = G.state; if (!s.started || s.lv !== 0 || s.y > 1.2 || G.controlLock) return null;
    G.camera.getWorldPosition(ray); G.camera.getWorldDirection(dir);
    if (ray.x >= X || dir.x <= 0.05) return null;
    const t = (X - ray.x)/dir.x; if (t > 3.2) return null;
    const y = ray.y + dir.y*t, z = ray.z + dir.z*t;
    for (let pi = 0; pi < PANELS.length; pi++){
      const p = PANELS[pi], c = Math.floor((z - p.z0)/TS), r = Math.floor((y - 0.02)/TS);
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) return {pi, c, r, k: key(pi, c, r)};
    }
    return null;
  }

  // ---------- the card for writing a quote ----------
  const card = document.createElement('div'); card.id = 'tileCard'; document.body.appendChild(card);
  let editing = null;
  function openCard(at){
    const who = me(); if (!who) return;
    const cur = tiles.get(at.k), mine = cur && cur.by === who.id, count = [...tiles.values()].filter(t => t.by === who.id).length;
    if (!cur && count >= MAXPER){ flashHint(`You already have ${MAXPER} tiles. Press E on one of yours to change or remove it`); return; }
    editing = {at, mine};
    card.innerHTML = `<h1>${mine ? 'Change your tile' : 'Your own tile'}</h1><div class="row"><canvas width="256" height="256"></canvas><div style="flex:1;min-width:0">`
      + `<textarea maxlength="${MAXQ}" placeholder="Wie het laatst lacht… / A bug a day keeps the client away"></textarea></div></div>`
      + `<div class="note">Max ${MAXQ} characters, printed on the divider for everyone with your name. Enter to place, Esc to cancel.</div>`
      + `<div class="btns"><button class="go" type="button">Place tile</button>${mine ? '<button class="del" type="button">Remove</button>' : ''}<button type="button">Cancel</button></div>`;
    const ta = card.querySelector('textarea'), pv = card.querySelector('canvas').getContext('2d');
    const preview = () => drawTile(pv, 0, 0, 256, ta.value.trim() ? {q: ta.value.trim(), n: who.name} : null);
    ta.value = mine ? cur.q : ''; ta.addEventListener('input', preview); preview();
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter'){ e.preventDefault(); save(ta.value); } else if (e.key === 'Escape'){ e.preventDefault(); closeCard(); } });
    const [go, ...rest] = card.querySelectorAll('button');
    const tap = (b, f) => { b.addEventListener('click', e => { e.preventDefault(); f(); }); b.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); f(); }); };
    tap(go, () => save(ta.value)); if (mine) tap(rest[0], remove); tap(rest[rest.length - 1], closeCard);
    G.controlLock = true; card.style.display = 'block'; setTimeout(() => ta.focus(), 30);
  }
  function closeCard(){ card.style.display = 'none'; editing = null; G.controlLock = false; const ta = card.querySelector('textarea'); if (ta) ta.blur(); }
  function save(text){
    const who = me(), q = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAXQ); if (!who || !editing) return;
    if (!q){ closeCard(); return; }
    const k = editing.at.k, d = {q, n: who.name, by: who.id, t: Date.now()};
    tiles.set(k, d); paint(editing.at.pi); net.setTile(k, d);
    try { window.__mpSay && !editing.mine && window.__mpSay(`🟦 put a tile on the divider at desk 6: “${q}”`); } catch (e) {}
    closeCard();
  }
  function remove(){ if (!editing) return; const k = editing.at.k; tiles.delete(k); paint(editing.at.pi); net.removeTile(k); closeCard(); }

  // ---------- prompt and E ----------
  let flashUntil = 0, flashText = '';
  function flashHint(t){ flashText = t; flashUntil = performance.now() + 2500; }
  let looking = null;
  window.__onUseTiles = () => {
    if (editing) return true;
    if (!looking) return false;
    const cur = tiles.get(looking.k), who = me();
    if (!who){ flashHint('Sign in to add a tile'); return true; }
    if (cur && cur.by !== who.id){ flashHint(`“${cur.q}” — ${cur.n}`); return true; }
    openCard(looking); return true;
  };
  window.__onFrameTiles = () => {
    if (editing) return '';
    looking = lookedAt();
    if (performance.now() < flashUntil) return flashText;
    if (!looking) return '';
    const cur = tiles.get(looking.k), who = me(), act = window.__isTouch ? 'Tap' : 'Press E';
    if (cur) return `“${cur.q}” — ${cur.n}` + (who && cur.by === who.id ? ` · ${act} to change` : '');
    return who ? `${act} to put your own quote on this tile` : 'Sign in to add a tile';
  };
}
