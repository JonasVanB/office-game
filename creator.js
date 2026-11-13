// Character creator: a full-screen panel with a turning 3D preview, a name field and the avatar choices.
import {OPTIONS, cleanAvatar, buildAvatar, animateAvatar} from './avatar.js';

const CSS = `
#creator{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(15,20,28,.8);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
#creator .cr{background:#fff;color:#1d2229;border-radius:16px;width:min(760px,calc(100vw - 32px));max-height:calc(100dvh - 32px);display:flex;overflow:hidden}
#creator .pv{flex:0 0 260px;background:linear-gradient(#e8eef5,#cfdbe8);position:relative;cursor:grab;touch-action:none}
#creator .pv canvas{width:100%;height:100%;display:block}
#creator .pv span{position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:12px;color:#5a6472}
#creator .ctl{flex:1;overflow:auto;padding:18px 20px 16px}
#creator h1{font-size:20px;margin:0 0 4px;font-weight:600}
#creator .sub{font-size:13px;color:#5a6472;margin:0 0 12px}
#creator label.h{display:block;font-size:13px;font-weight:600;margin:12px 0 6px}
#creator input[type=text]{width:100%;box-sizing:border-box;font-size:16px;padding:9px 10px;border:1px solid #c5cdd8;border-radius:8px}
#creator .sw{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#creator .sw button{width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #c5cdd8;cursor:pointer;padding:0}
#creator .sw button.on{box-shadow:0 0 0 2px #2f5d9e}
#creator .sw input[type=color]{width:32px;height:30px;border:0;background:none;padding:0;cursor:pointer}
#creator .ch{display:flex;flex-wrap:wrap;gap:6px}
#creator .ch button{font-size:13px;padding:6px 10px;border-radius:16px;border:1px solid #c5cdd8;background:#fff;color:#1d2229;cursor:pointer}
#creator .ch button.on{background:#2f5d9e;border-color:#2f5d9e;color:#fff}
#creator .act{display:flex;gap:8px;margin-top:16px}
#creator .act button{flex:1;font-size:16px;padding:12px;border:0;border-radius:10px;font-weight:600;cursor:pointer}
#creator .save{background:#2f5d9e;color:#fff}
#creator .cancel{background:#e6eaf0;color:#1d2229}
#creator .err{color:#b8322a;font-size:13px;min-height:1em;margin:6px 0 0}
@media (max-width:620px){#creator .cr{flex-direction:column}#creator .pv{flex:0 0 200px}}
`;

let styled = false;

// Opens the creator. Resolves with {name, avatar} on save, or null on cancel.
export function openCreator(THREE, {name = '', avatar, title = 'Create your character', canCancel = false} = {}){
  if (!styled){ const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styled = true; }
  let av = cleanAvatar(avatar);
  const wrap = document.createElement('div'); wrap.id = 'creator';
  wrap.innerHTML = `<div class="cr" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="pv"><canvas></canvas><span>Drag to turn</span></div>
    <div class="ctl">
      <h1>${title}</h1><p class="sub">Everyone has the same body; pick your colours, hair and facial hair.</p>
      <label class="h" for="crName">Name</label><input type="text" id="crName" maxlength="20" autocomplete="nickname">
      <div data-k="skin"></div><div data-k="shirt"></div><div data-k="pants"></div>
      <div data-k="hair"></div><div data-k="hairColor"></div><div data-k="facial"></div><div data-k="facialColor"></div>
      <p class="err"></p>
      <div class="act">${canCancel ? '<button class="cancel" type="button">Cancel</button>' : ''}<button class="save" type="button">Save character</button></div>
    </div></div>`;
  document.body.appendChild(wrap);
  const nameIn = wrap.querySelector('#crName'); nameIn.value = name;

  const LABELS = {skin: 'Face colour', shirt: 'Shirt colour', pants: 'Pants colour', hair: 'Hair', hairColor: 'Hair colour', facial: 'Facial hair', facialColor: 'Facial hair colour'};
  const rows = {};
  function swatches(k, list){
    const el = wrap.querySelector(`[data-k="${k}"]`);
    el.innerHTML = `<label class="h">${LABELS[k]}</label><div class="sw"></div>`;
    const sw = el.querySelector('.sw');
    for (const c of list){ const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.title = c; b.setAttribute('aria-label', LABELS[k] + ' ' + c); b.onclick = () => set(k, c); sw.appendChild(b); }
    if (k !== 'skin'){ const ci = document.createElement('input'); ci.type = 'color'; ci.title = 'Custom colour'; ci.setAttribute('aria-label', LABELS[k] + ', custom'); ci.oninput = () => set(k, ci.value); sw.appendChild(ci); }
    rows[k] = () => { for (const b of sw.querySelectorAll('button')) b.classList.toggle('on', b.title.toLowerCase() === av[k].toLowerCase()); const ci = sw.querySelector('input'); if (ci) ci.value = av[k]; };
  }
  function choices(k, list){
    const el = wrap.querySelector(`[data-k="${k}"]`);
    el.innerHTML = `<label class="h">${LABELS[k]}</label><div class="ch"></div>`;
    const ch = el.querySelector('.ch');
    for (const [v, l] of list){ const b = document.createElement('button'); b.type = 'button'; b.textContent = l; b.dataset.v = v; b.onclick = () => set(k, v); ch.appendChild(b); }
    rows[k] = () => { for (const b of ch.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === av[k]); };
  }
  swatches('skin', OPTIONS.skin); swatches('shirt', OPTIONS.shirt); swatches('pants', OPTIONS.pants);
  choices('hair', OPTIONS.hair); swatches('hairColor', OPTIONS.hairColor);
  choices('facial', OPTIONS.facial); swatches('facialColor', OPTIONS.hairColor);
  const fcRow = wrap.querySelector('[data-k="facialColor"]');

  // 3D preview
  const pv = wrap.querySelector('.pv'), canvas = pv.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, preserveDrawingBuffer: true});
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 0.8)); scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const sun = new THREE.DirectionalLight(0xfff3df, 0.6); sun.position.set(-2, 4, -3); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cam.position.set(0, 1.2, -5.2); cam.lookAt(0, 1.0, 0);
  let model = null, turn = 0.35, dragging = false, lastX = 0, alive = true, idle = 0;
  function rebuild(){ if (model) scene.remove(model); model = buildAvatar(THREE, av); model.rotation.y = turn; scene.add(model); }
  function size(){ const w = pv.clientWidth, h = pv.clientHeight; renderer.setSize(w, h, false); cam.aspect = w/h; cam.updateProjectionMatrix(); }
  pv.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; pv.setPointerCapture(e.pointerId); });
  pv.addEventListener('pointermove', e => { if (!dragging) return; turn += (e.clientX - lastX)*0.012; lastX = e.clientX; idle = 0; });
  pv.addEventListener('pointerup', () => { dragging = false; });
  addEventListener('resize', size);
  function loop(){ if (!alive) return; if (!dragging && (idle += 1) > 90) turn += 0.008; if (model){ model.rotation.y = turn; animateAvatar(model, 0.05, 0.25); } renderer.render(scene, cam); requestAnimationFrame(loop); }

  function set(k, v){ av[k] = v; rows[k](); fcRow.style.display = av.facial === 'none' ? 'none' : ''; rebuild(); }
  for (const k in rows) rows[k](); fcRow.style.display = av.facial === 'none' ? 'none' : '';
  rebuild(); size(); loop();
  setTimeout(() => { if (!nameIn.value) nameIn.focus(); }, 50);

  return new Promise(resolve => {
    const close = result => { alive = false; removeEventListener('resize', size); renderer.dispose(); wrap.remove(); resolve(result); };
    wrap.querySelector('.save').onclick = () => {
      const n = nameIn.value.trim().replace(/\s+/g, ' ');
      if (!n){ wrap.querySelector('.err').textContent = 'Please enter a name.'; nameIn.focus(); return; }
      close({name: n.slice(0, 20), avatar: cleanAvatar(av)});
    };
    const c = wrap.querySelector('.cancel'); if (c) c.onclick = () => close(null);
    nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') wrap.querySelector('.save').click(); });
  });
}

// A small front-facing picture of an avatar (data URL), for the start card.
export function avatarPicture(THREE, avatar){
  const canvas = document.createElement('canvas'); canvas.width = 112; canvas.height = 144;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, preserveDrawingBuffer: true});
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 0.8)); scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const sun = new THREE.DirectionalLight(0xfff3df, 0.6); sun.position.set(-2, 4, -3); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 112/144, 0.1, 20); cam.position.set(0, 1.62, -1.75); cam.lookAt(0, 1.5, 0);
  const m = buildAvatar(THREE, avatar); m.rotation.y = 0.3; scene.add(m);
  renderer.render(scene, cam);
  const url = canvas.toDataURL('image/png'); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
  return url;
}
