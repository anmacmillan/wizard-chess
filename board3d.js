// Wizard Chess: the 3D board. A torch-lit castle hall, a marble board with a
// runed gold border, carved ivory and black-lacquer pieces trimmed in gold,
// and captures where the attacker strikes and the victim bursts into rubble.
//
// The page talks to it through a small API:
//   setPosition(board), setHighlights(h), setOrientation(side), animateMove(mv),
//   topple(square), resize(); and hooks.onTap(square), hooks.sfx(name, arg).

import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment.js';

const sqPos = sq => new THREE.Vector3(sq.charCodeAt(0) - 97 - 3.5, 0, 4.5 - +sq[1]);
const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeIn = p => p * p * p;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- procedural textures ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(g, w, h, n, colors, size) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    g.globalAlpha = Math.random() * 0.25;
    g.fillRect(Math.random() * w, Math.random() * h, size * Math.random() + 1, size * Math.random() + 1);
  }
  g.globalAlpha = 1;
}
function marble(base, vein) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 900, [vein], 2);
    g.strokeStyle = vein;
    for (let i = 0; i < 5; i++) {
      g.globalAlpha = 0.18 + Math.random() * 0.2; g.lineWidth = 0.6 + Math.random() * 1.6;
      g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y);
      while (y < h) { x += rnd(-22, 22); y += rnd(12, 30); g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}
const flagstones = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#2a211b'; g.fillRect(0, 0, w, h);
  const n = 4, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const l = 13 + Math.random() * 8;
    g.fillStyle = `hsl(28, 14%, ${l}%)`;
    g.fillRect(i * s + 4, j * s + 4, s - 8, s - 8);
  }
  speckle(g, w, h, 4000, ['#000', '#fff'], 3);
}, [6, 6]);
const bricks = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#2b231d'; g.fillRect(0, 0, w, h);
  const rows = 8, bh = h / rows, bw = w / 4;
  for (let r = 0; r < rows; r++) for (let c = -1; c < 5; c++) {
    const x = c * bw + (r % 2) * bw / 2;
    g.fillStyle = `hsl(32, ${14 + Math.random() * 10}%, ${20 + Math.random() * 9}%)`;
    g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
  }
  speckle(g, w, h, 5000, ['#000', '#e8d8c0'], 2);
}, [10, 3]);

// the border: dark wood with gold double lines, runes and the coordinates
const F = 10.4;   // border plane size, in squares
const borderTex = () => canvasTex(1024, 1024, (g, w) => {
  const px = v => ((v + F / 2) / F) * w;
  g.fillStyle = '#16100c'; g.fillRect(0, 0, w, w);
  speckle(g, w, w, 3000, ['#3a2a1e'], 3);
  g.strokeStyle = '#d6a946'; g.lineWidth = 5;
  g.strokeRect(px(-5.0), px(-5.0), px(5.0) - px(-5.0), px(5.0) - px(-5.0));
  g.lineWidth = 2;
  g.strokeRect(px(-4.85), px(-4.85), px(4.85) - px(-4.85), px(4.85) - px(-4.85));
  g.strokeRect(px(-4.08), px(-4.08), px(4.08) - px(-4.08), px(4.08) - px(-4.08));
  g.fillStyle = '#e2b955';
  g.font = `600 ${w * 0.034}px Georgia, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const edge = 4.47;
  for (let i = 0; i < 8; i++) {
    const c = i - 3.5;
    g.fillText('abcdefgh'[i], px(c), px(edge));          // near edge (white side)
    g.save(); g.translate(px(c), px(-edge)); g.rotate(Math.PI); g.fillText('abcdefgh'[i], 0, 0); g.restore();
    g.fillText(String(8 - i), px(-edge), px(c));
    g.save(); g.translate(px(edge), px(c)); g.rotate(Math.PI); g.fillText(String(8 - i), 0, 0); g.restore();
  }
  // runes in the corners and between letters
  g.strokeStyle = 'rgba(226,185,85,.55)'; g.lineWidth = 2.2;
  const rune = (x, y, s) => {
    g.beginPath();
    const k = Math.floor(Math.random() * 4);
    g.moveTo(x, y - s); g.lineTo(x, y + s);
    if (k === 0) { g.moveTo(x, y - s * 0.4); g.lineTo(x + s * 0.7, y - s); }
    if (k === 1) { g.moveTo(x - s * 0.6, y); g.lineTo(x + s * 0.6, y - s * 0.6); }
    if (k === 2) { g.moveTo(x, y); g.lineTo(x + s * 0.6, y + s * 0.5); g.lineTo(x, y + s); }
    if (k === 3) { g.moveTo(x - s * 0.6, y - s); g.lineTo(x + s * 0.6, y + s); }
    g.stroke();
  };
  for (const [cx, cy] of [[-edge, -edge], [edge, -edge], [-edge, edge], [edge, edge]]) {
    g.beginPath(); g.arc(px(cx), px(cy), w * 0.018, 0, Math.PI * 2); g.stroke();
    rune(px(cx), px(cy), w * 0.011);
  }
});

// ---------- materials ----------
const M = {
  white: new THREE.MeshPhysicalMaterial({ color: 0xf2ece0, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  black: new THREE.MeshPhysicalMaterial({ color: 0x18161d, roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd8a945, metalness: 1, roughness: 0.28 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xd8dce4, metalness: 1, roughness: 0.16 }),
  gem: new THREE.MeshStandardMaterial({ color: 0x6fb8ff, emissive: 0x2a6cff, emissiveIntensity: 1.4, roughness: 0.2 }),
};

// ---------- piece models ----------
const GEO = new Map();
const cached = (key, make) => { if (!GEO.has(key)) GEO.set(key, make()); return GEO.get(key); };
const V2 = pts => pts.map(([r, y]) => new THREE.Vector2(r, y));

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const lathe = (key, pts) => cached('l' + key, () => new THREE.LatheGeometry(V2(pts), 40));
const ringGeo = (r, tube) => cached(`r${r},${tube}`, () => new THREE.TorusGeometry(r, tube, 10, 40));
const sphereGeo = r => cached('s' + r, () => new THREE.SphereGeometry(r, 24, 16));
const boxGeo = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylGeo = (rt, rb, h) => cached(`c${rt},${rb},${h}`, () => new THREE.CylinderGeometry(rt, rb, h, 16));
const coneGeo = (r, h) => cached(`k${r},${h}`, () => new THREE.ConeGeometry(r, h, 16));
function ring(g, r, y, tube, mat = M.gold) { const m = mesh(ringGeo(r, tube), mat, 0, y, 0); m.rotation.x = Math.PI / 2; g.add(m); return m; }

const BASE = [[0, 0], [0.36, 0], [0.37, 0.04], [0.36, 0.08], [0.32, 0.11], [0.3, 0.13], [0, 0.13]];

function horseGeo() {
  return cached('horse', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.2, 0.14);
    s.lineTo(0.24, 0.14);
    s.bezierCurveTo(0.22, 0.32, 0.12, 0.42, 0.07, 0.5);
    s.bezierCurveTo(0.17, 0.53, 0.3, 0.57, 0.34, 0.64);
    s.bezierCurveTo(0.38, 0.7, 0.34, 0.76, 0.27, 0.77);
    s.bezierCurveTo(0.18, 0.8, 0.12, 0.86, 0.07, 0.9);
    s.lineTo(0.03, 1.02);
    s.lineTo(-0.04, 0.9);
    s.bezierCurveTo(-0.2, 0.86, -0.28, 0.7, -0.26, 0.5);
    s.bezierCurveTo(-0.25, 0.36, -0.21, 0.26, -0.2, 0.14);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 3, curveSegments: 16 });
    g.translate(0, 0, -0.09);
    return g;
  });
}

function buildPiece(type, color) {
  const body = color === 'w' ? M.white : M.black;
  const g = new THREE.Group();
  g.add(mesh(lathe('base', BASE), body));
  ring(g, 0.345, 0.075, 0.022);
  // weapons and staffs are held on the piece's side (local -z); local +x faces the enemy
  const side = -0.22;
  if (type === 'p') {           // soldier with a spear
    g.add(mesh(lathe('pawn', [[0, 0.13], [0.24, 0.13], [0.2, 0.3], [0.15, 0.44], [0.12, 0.5], [0, 0.5]]), body));
    ring(g, 0.19, 0.33, 0.018);
    g.add(mesh(sphereGeo(0.11), body, 0, 0.6, 0));
    const helm = mesh(cached('helm', () => new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), M.gold, 0, 0.62, 0);
    g.add(helm);
    g.add(mesh(coneGeo(0.028, 0.09), M.gold, 0, 0.77, 0));
    g.add(mesh(cylGeo(0.014, 0.014, 0.95), M.gold, 0.04, 0.52, side));
    g.add(mesh(coneGeo(0.04, 0.14), M.steel, 0.04, 1.06, side));
    g.add(mesh(sphereGeo(0.04), body, 0.04, 0.42, side * 0.8));
  } else if (type === 'r') {    // castle tower
    g.add(mesh(lathe('rook', [[0, 0.13], [0.28, 0.13], [0.26, 0.3], [0.23, 0.62], [0.28, 0.66], [0.28, 0.8], [0.2, 0.8], [0.2, 0.74], [0, 0.74]]), body));
    ring(g, 0.265, 0.22, 0.02); ring(g, 0.28, 0.67, 0.02);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const m = mesh(boxGeo(0.12, 0.11, 0.08), body, Math.cos(a) * 0.235, 0.85, Math.sin(a) * 0.235);
      m.rotation.y = -a; g.add(m);
      const cap = mesh(boxGeo(0.13, 0.02, 0.09), M.gold, Math.cos(a) * 0.235, 0.91, Math.sin(a) * 0.235);
      cap.rotation.y = -a; g.add(cap);
      const win = mesh(boxGeo(0.02, 0.09, 0.05), M.gold, Math.cos(a) * 0.245, 0.46, Math.sin(a) * 0.245);
      win.rotation.y = -a; g.add(win);
    }
  } else if (type === 'n') {    // horse head
    g.add(mesh(lathe('nb', [[0, 0.13], [0.24, 0.13], [0.21, 0.2], [0, 0.2]]), body));
    ring(g, 0.215, 0.18, 0.018);
    g.add(mesh(horseGeo(), body));
    for (const z of [-0.115, 0.115]) g.add(mesh(sphereGeo(0.025), M.gold, 0.16, 0.76, z));
    for (let i = 0; i < 6; i++) {   // golden mane
      const t = i / 5;
      const m = mesh(boxGeo(0.05, 0.07, 0.07), M.gold, -0.27 + t * 0.24 + Math.sin(t * 3) * 0.02, 0.5 + t * 0.36, 0);
      m.rotation.z = 0.6; g.add(m);
    }
  } else if (type === 'b') {    // wizard with a staff
    g.add(mesh(lathe('bish', [[0, 0.13], [0.27, 0.13], [0.2, 0.35], [0.14, 0.55], [0.12, 0.62], [0, 0.62]]), body));
    ring(g, 0.2, 0.34, 0.016); ring(g, 0.13, 0.61, 0.02);
    g.add(mesh(sphereGeo(0.105), body, 0, 0.72, 0));
    g.add(mesh(lathe('hat', [[0, 0.78], [0.14, 0.78], [0.11, 0.9], [0.06, 1.0], [0.01, 1.08], [0, 1.08]]), body));
    ring(g, 0.13, 0.8, 0.018);
    g.add(mesh(sphereGeo(0.03), M.gold, 0, 1.09, 0));
    g.add(mesh(cylGeo(0.015, 0.015, 1.0), M.gold, 0.03, 0.55, side));
    const curl = mesh(cached('curl', () => new THREE.TorusGeometry(0.065, 0.014, 8, 24, Math.PI * 1.6)), M.gold, 0.03, 1.1, side);
    g.add(curl);
    g.add(mesh(sphereGeo(0.03), M.gem, 0.03, 1.1, side));
  } else if (type === 'q') {    // queen with a sceptre
    g.add(mesh(lathe('queen', [[0, 0.13], [0.31, 0.13], [0.22, 0.3], [0.15, 0.56], [0.12, 0.67], [0, 0.67]]), body));
    ring(g, 0.22, 0.3, 0.02); ring(g, 0.14, 0.66, 0.02);
    g.add(mesh(sphereGeo(0.11), body, 0, 0.78, 0));
    ring(g, 0.1, 0.87, 0.022);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(mesh(coneGeo(0.022, 0.1), M.gold, Math.cos(a) * 0.1, 0.93, Math.sin(a) * 0.1)); }
    g.add(mesh(sphereGeo(0.035), M.gem, 0, 0.98, 0));
    g.add(mesh(cylGeo(0.016, 0.016, 0.75), M.gold, 0.03, 0.55, side));
    g.add(mesh(sphereGeo(0.05), M.gold, 0.03, 0.95, side));
  } else if (type === 'k') {    // king with crown and sword
    g.add(mesh(lathe('king', [[0, 0.13], [0.32, 0.13], [0.24, 0.32], [0.17, 0.58], [0.14, 0.71], [0, 0.71]]), body));
    ring(g, 0.24, 0.32, 0.022); ring(g, 0.17, 0.58, 0.02);
    g.add(mesh(sphereGeo(0.12), body, 0, 0.83, 0));
    ring(g, 0.115, 0.93, 0.024);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(mesh(coneGeo(0.022, 0.11), M.gold, Math.cos(a) * 0.115, 0.99, Math.sin(a) * 0.115)); }
    g.add(mesh(boxGeo(0.035, 0.16, 0.035), M.gold, 0, 1.1, 0));
    g.add(mesh(boxGeo(0.11, 0.035, 0.035), M.gold, 0, 1.12, 0));
    g.add(mesh(boxGeo(0.04, 0.55, 0.012), M.steel, 0.05, 0.66, side - 0.04));
    g.add(mesh(boxGeo(0.14, 0.025, 0.04), M.gold, 0.05, 0.38, side - 0.04));
    g.add(mesh(cylGeo(0.016, 0.016, 0.1), M.gold, 0.05, 0.32, side - 0.04));
    g.add(mesh(sphereGeo(0.028), M.gold, 0.05, 0.26, side - 0.04));
  }
  g.rotation.y = color === 'w' ? Math.PI / 2 : -Math.PI / 2;   // face the enemy
  if (type === 'n') g.rotation.y += color === 'w' ? 0.9 : -0.9;   // knights turn so you see the horse's profile
  return g;
}

// ---------- the board ----------
export class Board3D {
  constructor(container, hooks = {}) {
    this.el = container;
    this.hooks = hooks;
    this.pieces = new Map();       // square -> outer group
    this.tweens = [];
    this.debris = [];
    this.shake = 0;
    this.selected = null;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;border-radius:12px';
    container.appendChild(r.domElement);

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0a10);
    scene.fog = new THREE.Fog(0x0c0a10, 16, 34);
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    for (const m of Object.values(M)) m.envMapIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
    this.view = { theta: 0, phi: 0.92, radius: 13.6, target: new THREE.Vector3(0, -0.3, 0.15) };
    this.baseTheta = 0;

    this.buildHall();
    this.buildBoard();
    this.bindInput();
    this.resize();
    this.clock = new THREE.Clock();
    const tick = () => { this.frame(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  buildHall() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x8a7fb0, 0x1c140e, 0.55));
    const key = new THREE.DirectionalLight(0xffe2b8, 2.3);
    key.position.set(-7, 12, -4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 2, far: 30 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    s.add(key);
    const rim = new THREE.DirectionalLight(0x7fa6ff, 0.7);
    rim.position.set(-6, 6, -9);
    s.add(rim);

    // floor, walls, arched windows, pillars and torches
    const floor = mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: flagstones(), roughness: 0.92 }), 0, -1.0, 0);
    floor.rotation.x = -Math.PI / 2; floor.castShadow = false; s.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ map: bricks(), roughness: 0.95 });
    const glass = new THREE.MeshBasicMaterial({ color: 0x9cbcff });
    const arch = new THREE.Shape();
    arch.moveTo(-0.7, 0); arch.lineTo(0.7, 0); arch.lineTo(0.7, 2.2); arch.absarc(0, 2.2, 0.7, 0, Math.PI, false); arch.lineTo(-0.7, 0);
    const archGeo = new THREE.ShapeGeometry(arch, 16);
    for (let k = 0; k < 4; k++) {
      const wall = new THREE.Group();
      const w = mesh(new THREE.BoxGeometry(32, 11, 0.8), wallMat, 0, 4.5, 0); w.castShadow = false; wall.add(w);
      for (const x of [-6, 0, 6]) {
        const win = new THREE.Mesh(archGeo, glass); win.position.set(x, 2.2, 0.41); wall.add(win);
        const bar = new THREE.Mesh(boxGeo(0.06, 2.9, 0.02), new THREE.MeshBasicMaterial({ color: 0x2a2230 })); bar.position.set(x, 3.6, 0.43); wall.add(bar);
        const bar2 = new THREE.Mesh(boxGeo(1.4, 0.06, 0.02), bar.material); bar2.position.set(x, 3.4, 0.43); wall.add(bar2);
      }
      wall.rotation.y = (k * Math.PI) / 2;
      wall.position.set(Math.sin(wall.rotation.y) * -15, -1, Math.cos(wall.rotation.y) * -15);
      s.add(wall);
    }
    const stone = new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.85 });
    this.flames = [];
    for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) {
      s.add(mesh(new THREE.CylinderGeometry(0.55, 0.6, 9, 20), stone, x, 3.5, z));
      s.add(mesh(boxGeo(1.6, 0.5, 1.6), stone, x, -0.75, z));
      s.add(mesh(boxGeo(1.5, 0.4, 1.5), stone, x, 7.9, z));
      const dir = new THREE.Vector3(-x, 0, -z).normalize();
      const tx = x + dir.x * 0.75, tz = z + dir.z * 0.75;
      s.add(mesh(cylGeo(0.08, 0.04, 0.5), M.gold, tx, 2.6, tz));
      const flame = new THREE.Mesh(sphereGeo(0.16), new THREE.MeshBasicMaterial({ color: 0xffb050 }));
      flame.position.set(tx, 3.0, tz); s.add(flame);
      const light = new THREE.PointLight(0xff9440, 22, 14, 2);
      light.position.set(tx, 3.1, tz); s.add(light);
      this.flames.push({ flame, light, ph: Math.random() * 10 });
    }
  }

  buildBoard() {
    const s = this.scene;
    const plinth = mesh(new THREE.BoxGeometry(F + 0.3, 1.0, F + 0.3), new THREE.MeshStandardMaterial({ color: 0x241914, roughness: 0.6, metalness: 0.2 }), 0, -0.52, 0);
    s.add(plinth);
    const border = mesh(new THREE.PlaneGeometry(F, F), new THREE.MeshStandardMaterial({ map: borderTex(), roughness: 0.5, metalness: 0.25 }), 0, -0.015, 0);
    border.rotation.x = -Math.PI / 2; s.add(border);
    const lightMats = [marble('#f1ede4', '#9a948a'), marble('#ece6db', '#8d867c')].map(map => new THREE.MeshPhysicalMaterial({ map, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25 }));
    const darkMats = [marble('#141217', '#4a4452'), marble('#18151b', '#57505f')].map(map => new THREE.MeshPhysicalMaterial({ map, roughness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    const geo = new THREE.BoxGeometry(1, 0.1, 1);
    this.squares = [];
    this.overlay = new Map();
    const ovGeo = new THREE.PlaneGeometry(0.96, 0.96);
    for (let f = 0; f < 8; f++) for (let rk = 1; rk <= 8; rk++) {
      const sq = 'abcdefgh'[f] + rk;
      const light = (f + rk) % 2 === 1;
      const m = new THREE.Mesh(geo, (light ? lightMats : darkMats)[(f * 3 + rk) % 2]);
      const p = sqPos(sq);
      m.position.set(p.x, -0.05, p.z);
      m.receiveShadow = true;
      m.userData.sq = sq;
      s.add(m); this.squares.push(m);
      const ov = new THREE.Mesh(ovGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      ov.rotation.x = -Math.PI / 2; ov.position.set(p.x, 0.004, p.z); ov.renderOrder = 2;
      s.add(ov); this.overlay.set(sq, ov);
    }
    // move markers
    this.dotGeo = new THREE.CircleGeometry(0.15, 32);
    this.ringGeo = new THREE.RingGeometry(0.34, 0.45, 40);
    this.dotMat = new THREE.MeshBasicMaterial({ color: 0x9fe2ff, transparent: true, opacity: 0.85, depthWrite: false });
    this.capMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.9, depthWrite: false });
    this.markers = [];
  }

  // ---------- camera & input ----------
  placeCamera() {
    const v = this.view;
    const aspect = this.camera.aspect;
    const rad = v.radius * Math.max(1, 1.05 / aspect);
    const x = rad * Math.sin(v.phi) * Math.sin(v.theta);
    const y = rad * Math.cos(v.phi);
    const z = rad * Math.sin(v.phi) * Math.cos(v.theta);
    const t = v.target.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), v.theta);
    this.camera.position.set(x + t.x, y, z + t.z);
    if (this.shake > 0.001) this.camera.position.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(this.shake));
    this.camera.lookAt(t);
  }

  bindInput() {
    const c = this.renderer.domElement;
    const pts = new Map();
    let start = null, moved = false, pinch = 0;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, theta: this.view.theta, phi: this.view.phi }; moved = false; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); moved = true; }
    });
    c.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.view.radius = THREE.MathUtils.clamp(this.view.radius * pinch / d, 7, 18);
        pinch = d; return;
      }
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 8) moved = true;
      if (moved) {
        this.view.theta = start.theta - dx * 0.008;
        this.view.phi = THREE.MathUtils.clamp(start.phi - dy * 0.006, 0.3, 1.3);
      }
    });
    const up = e => {
      const wasTap = pts.size === 1 && !moved && start;
      pts.delete(e.pointerId);
      if (wasTap) this.tap(e);
      if (pts.size === 0) { start = null; pinch = 0; }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', e => { pts.delete(e.pointerId); start = null; });
    c.addEventListener('wheel', e => { e.preventDefault(); this.view.radius = THREE.MathUtils.clamp(this.view.radius * (1 + e.deltaY * 0.001), 7, 18); }, { passive: false });
    this.ray = new THREE.Raycaster();
  }

  tap(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const objs = [...this.squares];
    for (const g of this.pieces.values()) objs.push(g);
    const hit = this.ray.intersectObjects(objs, true)[0];
    if (!hit) return;
    let o = hit.object;
    while (o && !o.userData.sq) o = o.parent;
    if (o && this.hooks.onTap) this.hooks.onTap(o.userData.sq);
  }

  resize() {
    const w = this.el.clientWidth || 300, h = this.el.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setOrientation(side, animate = true) {
    const target = side === 'w' ? 0 : Math.PI;
    if (this.baseTheta === target && this.oriented) return;
    this.baseTheta = target;
    if (!this.oriented || !animate) { this.view.theta = target; this.oriented = true; return; }
    const from = this.view.theta;
    let to = target;
    while (to - from > Math.PI) to -= Math.PI * 2;
    while (from - to > Math.PI) to += Math.PI * 2;
    this.tween(1400, p => { this.view.theta = from + (to - from) * ease(p); });
  }

  // ---------- pieces ----------
  makePiece(type, color, sq) {
    const outer = new THREE.Group();
    const inner = buildPiece(type, color);
    outer.add(inner);
    outer.userData = { sq, type, color, inner };
    outer.position.copy(sqPos(sq));
    this.scene.add(outer);
    return outer;
  }

  setPosition(board) {
    for (const g of this.pieces.values()) this.scene.remove(g);
    this.pieces.clear();
    for (const row of board) for (const p of row) if (p) this.pieces.set(p.square, this.makePiece(p.type, p.color, p.square));
    this.applyLift();
  }

  setHighlights({ last = [], selected = null, targets = [], check = null, hints = [] } = {}) {
    for (const ov of this.overlay.values()) ov.material.opacity = 0;
    const paint = (sq, color, op) => { const ov = this.overlay.get(sq); if (ov) { ov.material.color.setHex(color); ov.material.opacity = op; } };
    for (const sq of hints) paint(sq, 0xb47cff, 0.5);   // Professor Owl's squares
    for (const sq of last) paint(sq, 0xe6b43c, 0.34);
    if (selected) paint(selected, 0x6fc6ff, 0.45);
    if (check) paint(check, 0xff2a1a, 0.6);
    for (const m of this.markers) this.scene.remove(m);
    this.markers = targets.map(t => {
      const m = new THREE.Mesh(t.cap ? this.ringGeo : this.dotGeo, t.cap ? this.capMat : this.dotMat);
      const p = sqPos(t.to);
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.008, p.z); m.renderOrder = 3;
      this.scene.add(m);
      return m;
    });
    this.selected = selected;
    this.applyLift();
  }
  applyLift() {
    for (const [sq, g] of this.pieces) g.userData.lift = sq === this.selected ? 0.18 : 0;
  }

  tween(ms, fn) {
    return new Promise(resolve => this.tweens.push({ t0: performance.now(), ms, fn, resolve }));
  }
  glide(g, from, to, ms, hop) {
    const f = from.clone(), t = to.clone();
    return this.tween(ms, p => {
      g.position.lerpVectors(f, t, ease(p));
      g.position.y = Math.sin(Math.PI * p) * (hop ? 0.95 : 0.14);
    });
  }

  async animateMove(mv) {
    const g = this.pieces.get(mv.from);
    if (!g) return;
    const a = sqPos(mv.from), b = sqPos(mv.to);
    this.pieces.delete(mv.from);
    g.userData.lift = 0;
    const victimSq = mv.isEnPassant() ? mv.to[0] + mv.from[1] : mv.captured ? mv.to : null;
    const victim = victimSq ? this.pieces.get(victimSq) : null;
    if (victimSq) this.pieces.delete(victimSq);

    let rookDone = null;
    if (mv.isKingsideCastle() || mv.isQueensideCastle()) {
      const rk = mv.from[1], ks = mv.isKingsideCastle();
      const rf = (ks ? 'h' : 'a') + rk, rt = (ks ? 'f' : 'd') + rk;
      const rg = this.pieces.get(rf);
      if (rg) { this.pieces.delete(rf); rg.userData.sq = rt; this.pieces.set(rt, rg); rookDone = this.glide(rg, sqPos(rf), sqPos(rt), 800, true); }
    }
    const hop = mv.piece === 'n';
    const dist = a.distanceTo(b);
    this.hooks.sfx && this.hooks.sfx('slide', Math.min(0.9, 0.32 + dist * 0.1));
    this.hooks.sfx && this.hooks.sfx(mv.isKingsideCastle() || mv.isQueensideCastle() ? 'castle' : 'piece', mv.piece);   // whinny, bell, fanfare...

    if (victim) {
      // the kill: advance, wind up, strike, and the victim bursts apart
      const vp = victim.position.clone();
      const dir = vp.clone().sub(a).setY(0).normalize();
      if (dir.lengthSq() < 0.5) dir.set(0, 0, -1);
      const stop = vp.clone().addScaledVector(dir, -0.7);
      if (stop.distanceTo(a) > 0.1) await this.glide(g, a, stop, Math.min(950, 320 + stop.distanceTo(a) * 110), hop);
      const axis = new THREE.Vector3(dir.z, 0, -dir.x);
      const q = new THREE.Quaternion();
      const back = hop ? -0.75 : -0.42;           // knights rear up
      this.hooks.sfx && this.hooks.sfx('battlecry');
      await this.tween(260, p => {
        q.setFromAxisAngle(axis, back * easeOut(p)); g.quaternion.copy(q);
        g.position.y = hop ? 0.25 * easeOut(p) : 0;
        victim.position.x = vp.x + Math.sin(p * 45) * 0.025;
      });
      this.hooks.sfx && this.hooks.sfx('strike');
      const hitPos = stop.clone().addScaledVector(dir, 0.3);
      await this.tween(120, p => {
        q.setFromAxisAngle(axis, back + (0.5 - back) * p); g.quaternion.copy(q);
        g.position.lerpVectors(stop, hitPos, p); g.position.y = hop ? 0.25 * (1 - p) : 0;
      });
      this.smash(victim, dir);
      await this.tween(280, p => { q.setFromAxisAngle(axis, 0.5 * (1 - easeOut(p))); g.quaternion.copy(q); });
      g.quaternion.identity();
      await this.glide(g, g.position.clone().setY(0), b, 320, false);
    } else {
      await this.glide(g, a, b, Math.min(950, 340 + dist * 105), hop);
    }
    if (rookDone) await rookDone;
    g.position.copy(b);
    g.userData.sq = mv.to;
    this.pieces.set(mv.to, g);

    if (mv.promotion) {   // the pawn becomes a new piece in a flash of light
      g.remove(g.userData.inner);
      g.userData.inner = buildPiece(mv.promotion, mv.color);
      g.add(g.userData.inner);
      this.flash(b, 0xfff0b0, 60);
      await this.tween(500, p => { g.scale.setScalar(1 + Math.sin(Math.PI * p) * 0.35); });
      g.scale.setScalar(1);
    }
  }

  flash(pos, color, power) {
    const l = new THREE.PointLight(color, power, 7, 2);
    l.position.set(pos.x, 0.8, pos.z);
    this.scene.add(l);
    this.tween(420, p => { l.intensity = power * (1 - p); }).then(() => this.scene.remove(l));
  }

  smash(victim, dir) {
    const pos = victim.position.clone();
    const mat = victim.userData.color === 'w' ? M.white : M.black;
    this.scene.remove(victim);
    this.hooks.sfx && this.hooks.sfx('crash');
    this.shake = 0.16;
    this.flash(pos, 0xffd49a, 70);
    const shapes = [
      cached('dod', () => new THREE.DodecahedronGeometry(0.1, 0)),
      cached('ico', () => new THREE.IcosahedronGeometry(0.09, 0)),
      cached('tet', () => new THREE.TetrahedronGeometry(0.11, 0)),
    ];
    for (let i = 0; i < 30; i++) {
      const m = mesh(shapes[i % 3], i % 6 === 0 ? M.gold : mat, pos.x + rnd(-0.2, 0.2), rnd(0.1, 0.9), pos.z + rnd(-0.2, 0.2));
      const s = rnd(0.7, 1.9);
      m.scale.setScalar(s);
      m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      this.scene.add(m);
      const v = new THREE.Vector3(rnd(-1.6, 1.6), rnd(1.8, 4.6), rnd(-1.6, 1.6)).addScaledVector(dir, rnd(1.2, 3.6));
      this.debris.push({ m, v, w: new THREE.Vector3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)), r: 0.09 * s, age: 0 });
    }
    // a puff of stone dust
    const dust = new THREE.Mesh(sphereGeo(0.3), new THREE.MeshBasicMaterial({ color: 0xe6dac4, transparent: true, opacity: 0.5, depthWrite: false }));
    dust.position.set(pos.x, 0.35, pos.z);
    this.scene.add(dust);
    this.tween(700, p => { dust.scale.setScalar(1 + p * 3.5); dust.material.opacity = 0.5 * (1 - p); }).then(() => this.scene.remove(dust));
  }

  topple(sq) {
    const g = this.pieces.get(sq);
    if (!g) return;
    const axis = new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).normalize();
    const q = new THREE.Quaternion();
    setTimeout(() => {
      this.tween(1300, p => {
        q.setFromAxisAngle(axis, 1.5 * easeIn(p)); g.quaternion.copy(q);
        g.position.y = 0.12 * Math.sin(Math.PI * Math.min(1, p * 1.2));
      }).then(() => { this.shake = 0.08; this.hooks.sfx && this.hooks.sfx('thud'); });
    }, 300);
  }

  // ---------- frame loop ----------
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();
    this.tweens = this.tweens.filter(t => {
      const p = Math.min(1, (now - t.t0) / t.ms);
      t.fn(p);
      if (p >= 1) { t.resolve(); return false; }
      return true;
    });
    for (const g of this.pieces.values()) {   // the selected piece floats and bobs
      const lift = g.userData.lift || 0;
      g.userData.cur = THREE.MathUtils.lerp(g.userData.cur || 0, lift, 0.18);
      if (lift || g.userData.cur > 0.001) g.position.y = g.userData.cur + (lift ? Math.sin(now / 260) * 0.04 : 0);
    }
    for (const d of this.debris) {
      d.age += dt;
      d.v.y -= 9.8 * dt;
      d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
      const onBoard = Math.abs(d.m.position.x) < F / 2 && Math.abs(d.m.position.z) < F / 2;
      const floor = (onBoard ? 0 : -1.0) + d.r;
      if (d.m.position.y < floor && (onBoard || d.m.position.y > -0.9 || !onBoard)) {
        d.m.position.y = floor;
        d.v.y = Math.abs(d.v.y) > 0.6 ? -d.v.y * 0.33 : 0;
        d.v.x *= 0.72; d.v.z *= 0.72; d.w.multiplyScalar(0.7);
      }
      if (d.age > 4) { const k = Math.max(0, 1 - (d.age - 4) / 0.8); d.m.scale.setScalar(d.m.scale.x * (k > 0 ? 0.96 : 0)); }
    }
    this.debris = this.debris.filter(d => { if (d.age > 4.8) { this.scene.remove(d.m); return false; } return true; });
    for (const f of this.flames) {
      const k = 0.8 + 0.2 * Math.sin(now / 90 + f.ph) * Math.sin(now / 37 + f.ph * 2);
      f.light.intensity = 22 * k;
      f.flame.scale.setScalar(0.85 + 0.3 * k);
    }
    this.shake *= 0.86;
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
  }
}
