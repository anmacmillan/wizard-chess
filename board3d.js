// Wizard Chess: the 3D board. A torch-lit castle hall, a marble board with a
// runed gold border, carved ivory and black-lacquer pieces trimmed in gold,
// and captures where the attacker strikes and the victim bursts into rubble.
//
// The page talks to it through a small API:
//   setPosition(board), setHighlights(h), setOrientation(side), animateMove(mv),
//   topple(square), resize(); and hooks.onTap(square), hooks.sfx(name, arg).

import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment.js';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from './jsm/utils/SkeletonUtils.js';

// Heroes: animated fantasy characters by Quaternius (RPG Character Pack) as the pieces
const HERO = {
  p: { file: 'Rogue', h: 0.74, base: 0.82, attack: 'Dagger_Attack', ready: 'Attacking_Idle' },
  n: { file: 'Warrior', h: 0.66, attack: 'Sword_Attack', ready: 'Idle_Attacking', jump: 'Roll' },   // rides a horse
  b: { file: 'Cleric', h: 1.08, attack: 'Staff_Attack', ready: 'Idle_Weapon', hat: 'mitre' },
  r: { file: 'Monk', h: 1.16, attack: 'Attack', ready: 'Idle_Attacking' },
  q: { file: 'Ranger', h: 1.34, base: 1.06, attack: 'Bow_Shoot', ready: 'Idle_Attacking', hat: 'tiara' },
  k: { file: 'Wizard', h: 1.5, base: 1.1, attack: 'Spell1', ready: 'Idle_Attacking', hat: 'crown' },
};
// the knight's horse: white horse for White, a dark bay for Black (Quaternius, CC0)
const HORSE = { w: 'HorseWhite', b: 'Horse', scale: 0.168, saddle: [0, 3.25, -0.35] };
const HORSE_MAP = { Idle: 'Idle', Walk: 'Walk', Run: 'Gallop', Roll: 'Gallop_Jump', Sword_Attack: 'Attack_Headbutt', RecieveHit: 'Idle_HitReact_Left', Death: 'Death' };
const RIDER_MAP = { Walk: 'Idle', Run: 'Idle', Roll: 'Idle' };

// ---------- the rook: a war elephant carrying a battle tower (built here, animated by hand) ----------
// Old Indian chess sets often showed the rook this way. Facing +z, sized to stand on one square.
const ELE_M = {
  w: new THREE.MeshStandardMaterial({ color: 0xc9c2b8, roughness: 0.85 }),
  b: new THREE.MeshStandardMaterial({ color: 0x45404c, roughness: 0.8 }),
  ivory: new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.4 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 }),
  clothW: new THREE.MeshStandardMaterial({ color: 0xb3122a, roughness: 0.6 }),
  clothB: new THREE.MeshStandardMaterial({ color: 0x5b1f86, roughness: 0.6 }),
};
class ElephantRig {
  constructor(color) {
    const skin = ELE_M[color], g = this.root = new THREE.Group();
    const part = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    this.body = new THREE.Group(); g.add(this.body);
    const torso = part(new THREE.SphereGeometry(0.27, 24, 16), skin, 0, 0.52, 0, this.body); torso.scale.set(1, 0.85, 1.22);
    // the blanket and the tower
    const cloth = color === 'w' ? ELE_M.clothW : ELE_M.clothB;
    part(new THREE.BoxGeometry(0.44, 0.03, 0.4), cloth, 0, 0.735, -0.02, this.body);                  // the blanket over the back
    for (const x of [-0.262, 0.262]) {                                                                // and down each side
      const panel = part(new THREE.BoxGeometry(0.014, 0.2, 0.38), cloth, x, 0.6, -0.02, this.body); panel.rotation.z = Math.sign(x) * 0.2;
      const trim = part(new THREE.BoxGeometry(0.018, 0.028, 0.39), HAT_M.gold, x * 1.07, 0.505, -0.02, this.body); trim.rotation.z = panel.rotation.z;
    }
    const stone = color === 'w' ? M.white : M.black;
    part(new THREE.BoxGeometry(0.34, 0.2, 0.34), stone, 0, 0.84, -0.02, this.body);
    part(new THREE.BoxGeometry(0.37, 0.025, 0.37), HAT_M.gold, 0, 0.75, -0.02, this.body);
    part(new THREE.BoxGeometry(0.37, 0.025, 0.37), HAT_M.gold, 0, 0.94, -0.02, this.body);
    for (let i = 0; i < 4; i++) for (const side of [0, 1, 2, 3]) {      // battlements
      const t = -0.13 + i * 0.087, x = side < 2 ? t : (side === 2 ? -0.16 : 0.16), z = side < 2 ? (side ? 0.14 : -0.18) : t - 0.02;
      part(new THREE.BoxGeometry(0.055, 0.06, 0.055), stone, x, 0.98, z, this.body);
    }
    // head, ears, tusks, trunk
    this.head = new THREE.Group(); this.head.position.set(0, 0.6, 0.3); this.body.add(this.head);
    part(new THREE.SphereGeometry(0.17, 20, 14), skin, 0, 0, 0.06, this.head);
    for (const sx of [-1, 1]) part(new THREE.SphereGeometry(0.035, 10, 8), ELE_M.eye, sx * 0.1, 0.04, 0.18, this.head).scale.set(1, 1.2, 0.6);
    this.ears = [-1, 1].map(sx => {
      const pivot = new THREE.Group(); pivot.position.set(sx * 0.13, 0.02, 0.0); this.head.add(pivot);
      const ear = part(new THREE.SphereGeometry(0.16, 16, 12), skin, sx * 0.08, -0.03, -0.02, pivot); ear.scale.set(0.95, 1.1, 0.18); ear.rotation.y = sx * 0.5;
      pivot.userData.sx = sx; return pivot;
    });
    for (const sx of [-1, 1]) { const t = part(new THREE.ConeGeometry(0.026, 0.17, 10), ELE_M.ivory, sx * 0.075, -0.1, 0.2, this.head); t.rotation.x = 1.1; }
    this.trunk = []; let parent = this.head, r = 0.06;
    const first = new THREE.Group(); first.position.set(0, -0.04, 0.2); this.head.add(first); parent = first;
    for (let i = 0; i < 6; i++) {
      const seg = i === 0 ? first : new THREE.Group();
      if (i) { seg.position.y = -0.065; parent.add(seg); }
      part(new THREE.CylinderGeometry(r, r * 0.9, 0.075, 12), skin, 0, -0.03, 0, seg);
      this.trunk.push(seg); parent = seg; r *= 0.86;
    }
    // legs swing from the hips
    this.legs = [[-0.14, 0.17], [0.14, 0.17], [-0.14, -0.17], [0.14, -0.17]].map(([x, z], i) => {
      const hip = new THREE.Group(); hip.position.set(x, 0.42, z); g.add(hip);
      part(new THREE.CylinderGeometry(0.075, 0.08, 0.3, 14), skin, 0, -0.15, 0, hip);
      part(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 14), ELE_M.ivory, 0, -0.29, 0, hip);
      hip.userData.phase = i === 0 || i === 3 ? 0 : Math.PI; return hip;
    });
    const tail = part(new THREE.CylinderGeometry(0.012, 0.008, 0.2, 6), skin, 0, 0.46, -0.33, this.body); tail.rotation.x = -0.3;
    this.state = 'Idle'; this.t = Math.random() * 10; this.st = 0; this.fall = 0;
  }
  play(name) {
    const map = { Walk: 'Walk', Run: 'Run', Roll: 'Run', Attack: 'Attack', RecieveHit: 'Hit', Death: 'Death' };
    this.state = map[name] || 'Idle'; this.st = 0;
    return { Attack: 1.1, Hit: 0.5, Death: 1.3 }[this.state] || 1;
  }
  update(dt) {
    this.t += dt; this.st += dt;
    const s = this.state, t = this.t, moving = s === 'Walk' || s === 'Run';
    const sp = s === 'Run' ? 11 : 7;
    for (const leg of this.legs) leg.rotation.x = moving ? Math.sin(t * sp + leg.userData.phase) * 0.45 : 0;
    this.body.position.y = moving ? Math.abs(Math.sin(t * sp)) * 0.025 : Math.sin(t * 1.6) * 0.006;
    for (const e of this.ears) e.rotation.y = e.userData.sx * (0.15 + Math.sin(t * (moving ? 6 : 2.2)) * 0.25);
    // the trunk: a gentle sway, curled high to trumpet when attacking
    let lift = 0;
    if (s === 'Attack') lift = this.st < 0.55 ? this.st / 0.55 : Math.max(0, 1 - (this.st - 0.55) / 0.25);
    this.trunk.forEach((seg, i) => {
      seg.rotation.x = -lift * (0.55 + i * 0.12) + (i ? 0.08 : 0.25) + Math.sin(t * 2 + i * 0.6) * 0.06 * (1 - lift);
      seg.rotation.z = Math.sin(t * 1.3 + i * 0.5) * 0.08 * (1 - lift);
    });
    this.head.rotation.x = -lift * 0.35;
    this.root.position.x = s === 'Hit' && this.st < 0.4 ? Math.sin(this.st * 60) * 0.02 : 0;
    if (s === 'Death') this.fall = Math.min(1, this.st / 1.1); else this.fall = 0;
    this.root.rotation.z = (this.fall * this.fall) * 1.45;
    this.root.position.y = -this.fall * 0.08;
  }
}

// ---------- hats: so the king, queen and bishop can be told apart at a glance ----------
const HAT_M = {
  gold: new THREE.MeshStandardMaterial({ color: 0xf3c24c, metalness: 0.9, roughness: 0.25, emissive: 0x4a3000, emissiveIntensity: 0.45 }),
  ruby: new THREE.MeshStandardMaterial({ color: 0xe0102a, roughness: 0.15, emissive: 0x6a0010, emissiveIntensity: 0.8 }),
  sapphire: new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.15, emissive: 0x0a2a90, emissiveIntensity: 0.8 }),
  pearl: new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.3, emissive: 0x4a4440, emissiveIntensity: 0.3 }),
  mitreW: new THREE.MeshStandardMaterial({ color: 0xfbf4e2, roughness: 0.55, emissive: 0x2a261e, emissiveIntensity: 0.3 }),
  mitreB: new THREE.MeshStandardMaterial({ color: 0x6a1f8a, roughness: 0.5, emissive: 0x1c0628, emissiveIntensity: 0.4 }),
};
function hatMesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; }
// sizes are in the characters' own units: the head is about 0.9 across, its top about 0.85 above the head bone
function makeHat(kind, color) {
  const g = new THREE.Group();
  if (kind === 'crown') {          // the king: a tall gold crown with a cross on top
    const band = hatMesh(new THREE.CylinderGeometry(0.44, 0.47, 0.26, 28, 1, true), HAT_M.gold); band.material.side = THREE.DoubleSide; band.position.y = 0.13; g.add(band);
    g.add(hatMesh(new THREE.TorusGeometry(0.47, 0.035, 8, 28).rotateX(Math.PI / 2), HAT_M.gold, 0, 0.01, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(hatMesh(new THREE.ConeGeometry(0.085, 0.3, 8), HAT_M.gold, Math.sin(a) * 0.44, 0.4, Math.cos(a) * 0.44));
      g.add(hatMesh(new THREE.SphereGeometry(0.05, 10, 8), HAT_M.pearl, Math.sin(a) * 0.44, 0.56, Math.cos(a) * 0.44));
      g.add(hatMesh(new THREE.SphereGeometry(0.055, 10, 8), i % 2 ? HAT_M.sapphire : HAT_M.ruby, Math.sin(a + 0.39) * 0.475, 0.13, Math.cos(a + 0.39) * 0.475));
    }
    // two arches meeting under an orb and cross
    for (const r of [0, Math.PI / 2]) { const arch = hatMesh(new THREE.TorusGeometry(0.4, 0.035, 8, 24, Math.PI), HAT_M.gold, 0, 0.22, 0); arch.rotation.y = r; g.add(arch); }
    g.add(hatMesh(new THREE.SphereGeometry(0.09, 14, 10), HAT_M.gold, 0, 0.68, 0));
    g.add(hatMesh(new THREE.BoxGeometry(0.07, 0.32, 0.07), HAT_M.gold, 0, 0.88, 0));
    g.add(hatMesh(new THREE.BoxGeometry(0.22, 0.07, 0.07), HAT_M.gold, 0, 0.92, 0));
  } else if (kind === 'tiara') {   // the queen: a lighter crown of tall and short points with pearls
    const band = hatMesh(new THREE.CylinderGeometry(0.4, 0.43, 0.16, 28, 1, true), HAT_M.gold); band.material.side = THREE.DoubleSide; band.position.y = 0.08; g.add(band);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, tall = i % 2 === 0, h = tall ? 0.34 : 0.17;
      g.add(hatMesh(new THREE.ConeGeometry(0.06, h, 6), HAT_M.gold, Math.sin(a) * 0.41, 0.16 + h / 2, Math.cos(a) * 0.41));
      g.add(hatMesh(new THREE.SphereGeometry(tall ? 0.055 : 0.04, 10, 8), HAT_M.pearl, Math.sin(a) * 0.41, 0.17 + h, Math.cos(a) * 0.41));
    }
    g.add(hatMesh(new THREE.SphereGeometry(0.09, 12, 10), HAT_M.sapphire, 0, 0.1, 0.43));
    g.add(hatMesh(new THREE.SphereGeometry(0.06, 10, 8), HAT_M.ruby, 0.3, 0.09, 0.3));
    g.add(hatMesh(new THREE.SphereGeometry(0.06, 10, 8), HAT_M.ruby, -0.3, 0.09, 0.3));
  } else if (kind === 'mitre') {   // the bishop: a tall pointed mitre with gold trim and a cross
    const sh = new THREE.Shape();
    sh.moveTo(-0.4, 0); sh.lineTo(-0.38, 0.45); sh.quadraticCurveTo(-0.3, 0.95, 0, 1.25); sh.quadraticCurveTo(0.3, 0.95, 0.38, 0.45); sh.lineTo(0.4, 0); sh.lineTo(-0.4, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.56, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 16 });
    geo.translate(0, 0, -0.28);
    g.add(hatMesh(geo, color === 'w' ? HAT_M.mitreW : HAT_M.mitreB));
    g.add(hatMesh(new THREE.BoxGeometry(0.92, 0.12, 0.72), HAT_M.gold, 0, 0.06, 0));           // gold band round the bottom
    g.add(hatMesh(new THREE.BoxGeometry(0.1, 1.05, 0.04), HAT_M.gold, 0, 0.62, 0.35));         // gold stripe up the front
    g.add(hatMesh(new THREE.BoxGeometry(0.1, 1.05, 0.04), HAT_M.gold, 0, 0.62, -0.35));
    g.add(hatMesh(new THREE.BoxGeometry(0.34, 0.09, 0.05), HAT_M.gold, 0, 0.62, 0.37));        // a cross
    g.add(hatMesh(new THREE.BoxGeometry(0.09, 0.4, 0.05), HAT_M.gold, 0, 0.62, 0.37));
  }
  return g;
}

// ---------- blood splats where a piece falls (cartoon style, they fade over a few moves) ----------
const splatTex = [];
function splatTexture(i) {
  if (splatTex[i]) return splatTex[i];
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  let seed = 7 + i * 101; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const blob = (cx, cy, rad, col) => {
    x.fillStyle = col; x.beginPath();
    for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2, rr = rad * (0.75 + r() * 0.45); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.closePath(); x.fill();
  };
  blob(128, 128, 62, '#a3081a');
  for (let k = 0; k < 9; k++) { const a = r() * Math.PI * 2, d = 60 + r() * 50; blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 6 + r() * 14, '#a3081a'); }
  for (let k = 0; k < 5; k++) { const a = r() * Math.PI * 2, d = 40 + r() * 30; x.strokeStyle = '#a3081a'; x.lineWidth = 8 + r() * 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a) * (d + 30), 128 + Math.sin(a) * (d + 30)); x.stroke(); }
  blob(112, 112, 22, 'rgba(220,40,50,.55)');      // a wet shine
  blob(104, 104, 7, 'rgba(255,190,190,.7)');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (splatTex[i] = t);
}
const GLYPH = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
const glyphTex = {};
function glyphMaterial(color, type) {
  const k = color + type;
  if (!glyphTex[k]) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = color === 'w' ? '#f6efe0' : '#1b1820'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#d8a945'; g.stroke();
    g.fillStyle = color === 'w' ? '#2a2230' : '#f6efe0'; g.font = '84px "Apple Symbols","Segoe UI Symbol",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(GLYPH[color][type] + '\uFE0E', 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    glyphTex[k] = new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true, alphaTest: 0.1 });
  }
  return glyphTex[k];
}

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
// hat fit on the head bone: [height, forward, scale]
const SPELL = { k: { kind: 'fire', anim: 'Spell1', sfx: 'fireball', at: 0.45 }, q: { kind: 'arrow', anim: 'Bow_Shoot', sfx: 'arrow', at: 0.5 }, b: { kind: 'beam', anim: 'Spell1', sfx: 'beam', at: 0.45 } };
const HAT_FIT = { crown: [0.6, 0.0, 0.92], tiara: [0.66, 0.0, 0.9], mitre: [0.55, 0.0, 0.68] };
// rider's legs: bone -> extra rotation (x, y, z) to sit in the saddle
const SEAT = { UpperLegL: [-1.45, 0, -0.45], UpperLegR: [-1.45, 0, 0.45], LowerLegL: [1.55, 0, 0], LowerLegR: [1.55, 0, 0] };

export class Board3D {
  constructor(container, hooks = {}) {
    this.el = container;
    this.hooks = hooks;
    this.pieces = new Map();       // square -> outer group
    this.tweens = [];
    this.debris = [];
    this.shake = 0;
    this.selected = null;
    this.style = hooks.style || 'heroes';
    this.mixers = new Set();
    this.riders = new Set();
    this.splats = [];
    this.heroTpl = null;
    this.lastBoard = null;
    this.loadHeroes();

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

  async loadHeroes() {
    try {
      const L = new GLTFLoader(), tpl = {};
      await Promise.all(Object.entries(HERO).map(async ([t, cfg]) => { tpl[t] = await L.loadAsync(`models/${cfg.file}.glb`); }));
      const [hw, hb] = await Promise.all([L.loadAsync(`models/${HORSE.w}.glb`), L.loadAsync(`models/${HORSE.b}.glb`)]).catch(() => [null, null]);
      if (hw && hb) this.horseTpl = { w: hw, b: hb };
      this.heroTpl = tpl;
      if (this.style === 'heroes' && this.lastBoard) this.setPosition(this.lastBoard);
    } catch (e) { console.warn('heroes failed to load, using classic pieces', e); }
  }
  setStyle(style) {
    this.style = style;
    if (this.lastBoard) this.setPosition(this.lastBoard);
  }
  useHeroes() { return this.style === 'heroes' && this.heroTpl; }

  tintHero(model, color) {
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      o.material = o.material.clone();
      if (color === 'b') { o.material.color.multiplyScalar(0.26); o.material.color.lerp(new THREE.Color(0x2a1640), 0.25); if (o.material.emissive) o.material.emissive.setHex(0x0c0616); }
      else { o.material.color.lerp(new THREE.Color(0xfff4e0), 0.35); if (o.material.emissive) o.material.emissive.setHex(0x1a140c); }
      o.material.envMapIntensity = 0.5;
    });
  }
  heroBase(group, color, size = 1) {
    // the base: marble or obsidian with gold, like the classic pieces
    const base = new THREE.Group();
    base.add(mesh(lathe('base', BASE), color === 'w' ? M.white : M.black));
    ring(base, 0.345, 0.075, 0.022);
    base.scale.set(size, 1, size);
    group.add(base);
  }
  track(model, animations, map = null) {
    const mixer = new THREE.AnimationMixer(model);
    this.mixers.add(mixer);
    return { mixer, clips: Object.fromEntries(animations.map(c => [c.name, c])), map, current: null };
  }
  buildKnight(color) {
    const cfg = HERO.n, group = new THREE.Group();
    this.heroBase(group, color, 1);
    const mount = new THREE.Group();            // turns as one: horse and rider
    mount.rotation.y = color === 'w' ? Math.PI : 0;
    group.add(mount);
    const hsrc = this.horseTpl[color];
    const horse = SkeletonUtils.clone(hsrc.scene);
    horse.scale.setScalar(HORSE.scale);
    horse.position.set(0, 0.13, -0.62 * HORSE.scale);     // centre the horse on its square
    horse.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.material = o.material.clone(); o.material.envMapIntensity = 0.5;
      if (color === 'b') o.material.color.multiplyScalar(0.55);
    });
    mount.add(horse);
    const rsrc = this.heroTpl.n, rider = SkeletonUtils.clone(rsrc.scene);
    const rs = cfg.h / 3.1;
    rider.scale.setScalar(rs);
    const [sx, sy, sz] = HORSE.saddle;
    rider.position.set(sx * HORSE.scale, 0.13 + sy * HORSE.scale - 1.01 * rs, (sz - 0.62) * HORSE.scale);
    this.tintHero(rider, color);
    mount.add(rider);
    // sit astride: thighs forward and apart, shins down
    const seat = [];
    const q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    for (const [name, rot] of Object.entries(SEAT)) { const b = rider.getObjectByName(name); if (b) seat.push({ b, q: q(...rot), out: null, base: new THREE.Quaternion() }); }
    const badge = new THREE.Sprite(glyphMaterial(color, 'n'));
    badge.scale.setScalar(0.26); badge.position.set(0.3, 0.24, 0.3);
    group.add(badge);
    const tracks = [this.track(rider, rsrc.animations, RIDER_MAP), this.track(horse, hsrc.animations, HORSE_MAP)];
    group.userData.hero = { tracks, mixer: tracks[0].mixer, model: mount, cfg, color, seat };
    this.riders.add(group.userData.hero);
    this.play(group, 'Idle', { offset: Math.random() * 3 });
    return group;
  }
  buildElephant(color) {
    const cfg = HERO.r, group = new THREE.Group();
    this.heroBase(group, color, 1.04);
    const mount = new THREE.Group();
    mount.rotation.y = color === 'w' ? Math.PI : 0;
    group.add(mount);
    const ele = new ElephantRig(color);
    ele.root.position.y = 0.13;
    mount.add(ele.root);
    // the monk stands in the tower, waist-deep
    const src = this.heroTpl.r, monk = SkeletonUtils.clone(src.scene);
    monk.scale.setScalar(0.5 / 3.1);
    monk.position.set(0, 0.13 + 0.62, -0.02);
    this.tintHero(monk, color);
    ele.body.add(monk); monk.position.y = 0.73;
    const badge = new THREE.Sprite(glyphMaterial(color, 'r'));
    badge.scale.setScalar(0.26); badge.position.set(0.3, 0.24, 0.3);
    group.add(badge);
    this.mixers.add(ele);
    const tracks = [this.track(monk, src.animations, RIDER_MAP), { proc: ele, mixer: ele }];
    group.userData.hero = { tracks, mixer: tracks[0].mixer, model: mount, cfg, color, seat: [] };
    this.play(group, 'Idle', { offset: Math.random() * 3 });
    return group;
  }
  dropHero(H) {
    if (!H) return;
    for (const t of H.tracks || [{ mixer: H.mixer }]) this.mixers.delete(t.mixer);
    this.riders.delete(H);
  }

  buildHero(type, color) {
    if (type === 'n' && this.horseTpl) return this.buildKnight(color);
    if (type === 'r') return this.buildElephant(color);
    const cfg = HERO[type], src = this.heroTpl[type];
    const group = new THREE.Group();
    this.heroBase(group, color, cfg.base || 1);
    const model = SkeletonUtils.clone(src.scene);
    model.scale.setScalar(cfg.h / 3.1);
    model.position.y = 0.13;
    this.tintHero(model, color);
    if (cfg.hat) {      // worn on the head bone, so it moves with every animation
      const head = model.getObjectByName('Head');
      if (head) { const hat = makeHat(cfg.hat, color); hat.userData.hat = cfg.hat; const [y, z, s] = HAT_FIT[cfg.hat]; hat.position.set(0, y, z); hat.scale.setScalar(s); head.add(hat); }
    }
    model.rotation.y = color === 'w' ? Math.PI : 0;     // face the other side
    group.add(model);
    // a small badge with the chess symbol, so the girls still learn which piece is which
    const badge = new THREE.Sprite(glyphMaterial(color, type));
    badge.scale.setScalar(0.24); badge.position.set(0.26, 0.24, 0.26);
    group.add(badge);
    const tr = this.track(model, src.animations);
    group.userData.hero = { tracks: [tr], mixer: tr.mixer, model, cfg, color };
    this.play(group, 'Idle', { offset: Math.random() * 3 });
    return group;
  }
  // crossfade to an animation; once: true plays it one time and holds the last frame
  play(g, name, { once = false, fade = 0.22, offset = 0, speed = 1 } = {}) {
    const H = g.userData.inner && g.userData.inner.userData.hero || g.userData.hero;
    if (!H) return 0;
    let dur = 0;
    for (const t of H.tracks) {     // a knight has two: the rider and the horse
      if (t.proc) { const d = t.proc.play(name); if (!dur) dur = d / speed; continue; }
      const clip = t.clips[(t.map && t.map[name]) || name];
      if (!clip) continue;
      const a = t.mixer.clipAction(clip);
      a.reset(); a.timeScale = speed;
      a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
      if (offset) a.time = offset % clip.duration;
      a.play();
      if (t.current && t.current !== a) t.current.crossFadeTo(a, fade, false);
      t.current = a;
      if (!dur) dur = clip.duration / speed;
    }
    return dur;
  }
  heroOf(g) { return g && g.userData.inner && g.userData.inner.userData.hero; }
  face(g, dir) {   // turn the character to walk towards dir (or back to its side when dir is null)
    const H = this.heroOf(g); if (!H) return;
    const target = dir ? Math.atan2(dir.x, dir.z) : (H.color === 'w' ? Math.PI : 0);
    const from = H.model.rotation.y; let to = target;
    while (to - from > Math.PI) to -= Math.PI * 2; while (from - to > Math.PI) to += Math.PI * 2;
    this.tween(220, p => { H.model.rotation.y = from + (to - from) * ease(p); });
  }

  // ---------- pieces ----------
  makePiece(type, color, sq) {
    const outer = new THREE.Group();
    const inner = this.useHeroes() ? this.buildHero(type, color) : buildPiece(type, color);
    outer.add(inner);
    outer.userData = { sq, type, color, inner };
    outer.position.copy(sqPos(sq));
    this.scene.add(outer);
    return outer;
  }

  setPosition(board) {
    // more pieces than before means a new game, a take-back or another game: wipe the floor
    const count = b => b ? b.flat().filter(Boolean).length : 0;
    if (count(board) > count(this.lastBoard)) this.clearSplats();
    this.lastBoard = board;
    for (const g of this.pieces.values()) { this.scene.remove(g); this.dropHero(this.heroOf(g)); }
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
    for (const [sq, g] of this.pieces) {
      const H = this.heroOf(g);
      if (H) {   // heroes take up a fighting stance instead of floating
        const want = sq === this.selected ? H.cfg.ready : 'Idle';
        if (g.userData.stance !== want) { g.userData.stance = want; this.play(g, want); }
        g.userData.lift = 0;
      } else g.userData.lift = sq === this.selected ? 0.18 : 0;
    }
  }

  tween(ms, fn) {
    return new Promise(resolve => this.tweens.push({ t0: performance.now(), ms: ms * (this.slowmo || 1), fn, resolve }));   // slowmo: for testing
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
    this.fadeSplats();
    if (this.heroOf(g)) return this.animateHero(mv, g);
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
      g.userData.inner = this.useHeroes() ? this.buildHero(mv.promotion, mv.color) : buildPiece(mv.promotion, mv.color);
      g.add(g.userData.inner);
      this.flash(b, 0xfff0b0, 60);
      await this.tween(500, p => { g.scale.setScalar(1 + Math.sin(Math.PI * p) * 0.35); });
      g.scale.setScalar(1);
    }
  }

  async animateHero(mv, g) {
    const a = sqPos(mv.from), b = sqPos(mv.to);
    this.pieces.delete(mv.from); g.userData.stance = null;
    const victimSq = mv.isEnPassant() ? mv.to[0] + mv.from[1] : mv.captured ? mv.to : null;
    const victim = victimSq ? this.pieces.get(victimSq) : null;
    if (victimSq) this.pieces.delete(victimSq);
    const H = this.heroOf(g);
    const walk = async (from, to, jump) => {
      const d = from.distanceTo(to); if (d < 0.05) return;
      this.face(g, to.clone().sub(from));
      const run = d > 2.2 && !jump;
      this.play(g, jump ? H.cfg.jump || 'Roll' : run ? 'Run' : 'Walk', { speed: jump ? 1.1 : 1 });
      await this.glide(g, from, to, jump ? 900 : Math.min(1600, d * (run ? 260 : 420)), !!jump);
    };
    let rookDone = null;
    if (mv.isKingsideCastle() || mv.isQueensideCastle()) {
      const rk = mv.from[1], ks = mv.isKingsideCastle();
      const rf = (ks ? 'h' : 'a') + rk, rt = (ks ? 'f' : 'd') + rk, rg = this.pieces.get(rf);
      if (rg) {
        this.pieces.delete(rf); rg.userData.sq = rt; this.pieces.set(rt, rg);
        this.face(rg, sqPos(rt).sub(sqPos(rf))); this.play(rg, 'Walk');
        rookDone = this.glide(rg, sqPos(rf), sqPos(rt), 1100, false).then(() => { this.face(rg, null); this.play(rg, 'Idle'); });
      }
    }
    this.hooks.sfx && this.hooks.sfx(mv.isKingsideCastle() || mv.isQueensideCastle() ? 'castle' : 'piece', mv.piece);
    if (victim) {
      // the fight: walk up, attack, the victim is hit and falls, then crumbles to rubble.
      // The king, queen and bishop cast from where they stand: fireball, magic arrow, beam of light.
      const vp = victim.position.clone();
      const dir = vp.clone().sub(a).setY(0).normalize();
      const spell = SPELL[mv.piece];
      const stop = spell ? a.clone() : vp.clone().addScaledVector(dir, -0.72);
      await walk(a, stop, mv.piece === 'n');
      this.face(g, dir); this.face(victim, dir.clone().negate());
      if (spell) {
        await new Promise(r => setTimeout(r, 240));
        const atk = this.play(g, spell.anim, { once: true, fade: 0.12 });
        this.hooks.sfx && this.hooks.sfx(spell.sfx);
        await new Promise(r => setTimeout(r, atk * spell.at * 1000));
        await this.cast(spell.kind, stop.clone().setY(H.cfg.h * 0.62).addScaledVector(dir, 0.18), vp.clone().setY(0.5));
      } else {
        this.hooks.sfx && this.hooks.sfx('battlecry');
        const atk = this.play(g, H.cfg.attack, { once: true, fade: 0.12 });
        await new Promise(r => setTimeout(r, atk * 520));
      }
      this.hooks.sfx && this.hooks.sfx('strike');
      this.play(victim, 'RecieveHit', { once: true, fade: 0.08 });
      await new Promise(r => setTimeout(r, 380));
      const die = this.play(victim, 'Death', { once: true, fade: 0.15 });
      await new Promise(r => setTimeout(r, die * 1000 + 150));
      this.play(g, 'Idle');
      this.dropHero(this.heroOf(victim));
      this.smash(victim, dir);
      await new Promise(r => setTimeout(r, 250));
      await walk(g.position.clone().setY(0), b, false);
    } else {
      await walk(a, b, mv.piece === 'n');
    }
    if (rookDone) await rookDone;
    g.position.copy(b);
    g.userData.sq = mv.to; this.pieces.set(mv.to, g);
    if (mv.promotion) {
      this.dropHero(H);
      g.remove(g.userData.inner);
      g.userData.inner = this.buildHero(mv.promotion, mv.color);
      g.add(g.userData.inner);
      this.flash(b, 0xfff0b0, 60);
      await this.tween(500, p => { g.scale.setScalar(1 + Math.sin(Math.PI * p) * 0.35); });
      g.scale.setScalar(1);
    } else {
      this.face(g, null); this.play(g, 'Idle');
    }
  }

  // a spell flying from one point to another; resolves when it hits
  async cast(kind, from, to) {
    const add = (geo, color, op = 1) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); this.scene.add(m); return m; };
    const kill = (...ms) => ms.forEach(m => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    const color = { fire: 0xff7a1a, arrow: 0x7fe9ff, beam: 0xffc23a }[kind];
    const light = new THREE.PointLight(color, 9, 3.5, 2); this.scene.add(light);
    const sparks = [];
    const spark = (p, c, size) => { const m = add(sphereGeo(size), c, 0.9); m.position.copy(p); sparks.push({ m, v: new THREE.Vector3(rnd(-0.6, 0.6), rnd(-0.2, 0.8), rnd(-0.6, 0.6)), life: 1 }); };
    const tickSparks = dt => { for (const s of sparks) { s.life -= dt * 2.2; s.m.position.addScaledVector(s.v, dt); s.m.material.opacity = Math.max(0, s.life); s.m.scale.setScalar(Math.max(0.05, s.life)); } };
    const dist = from.distanceTo(to), dirv = to.clone().sub(from).normalize();
    let last = performance.now();
    if (kind === 'beam') {
      // a pillar of light from the staff, widening then fading
      const beam = add(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), 0xffc23a, 0.85);
      const core = add(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), 0xffffff, 0.95);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      for (const b of [beam, core]) { b.position.copy(mid); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirv); }
      light.position.copy(to);
      await this.tween(650, p => {
        const now = performance.now(), dt = (now - last) / 1000; last = now;
        const w = Math.sin(Math.PI * Math.min(1, p * 1.3)) * 0.09;
        beam.scale.set(w + 0.001, dist * Math.min(1, p * 3), w + 0.001); core.scale.set(w * 0.35 + 0.001, dist * Math.min(1, p * 3), w * 0.35 + 0.001);
        beam.material.opacity = 0.8 * (1 - p * 0.6);
        if (p > 0.3 && Math.random() < 0.6) spark(to.clone().add(new THREE.Vector3(rnd(-0.15, 0.15), rnd(-0.2, 0.3), rnd(-0.15, 0.15))), 0xfff8d0, 0.025);
        tickSparks(dt);
      });
      kill(beam, core);
    } else {
      // fireball or glowing arrow, flying in a little arc with a trail
      const ball = kind === 'fire' ? add(sphereGeo(0.09), 0xffd080) : add(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6).rotateX(Math.PI / 2), 0xd8fbff);
      const glow = add(sphereGeo(kind === 'fire' ? 0.17 : 0.07), color, 0.55);
      const tip = kind === 'arrow' ? add(new THREE.ConeGeometry(0.035, 0.09, 8).rotateX(Math.PI / 2).translate(0, 0, 0.2), 0xffffff) : null;
      await this.tween(Math.max(320, dist * 260), p => {
        const now = performance.now(), dt = (now - last) / 1000; last = now;
        const pos = from.clone().lerp(to, p); pos.y += Math.sin(Math.PI * p) * (kind === 'fire' ? 0.35 : 0.12);
        for (const m of [ball, glow, tip]) if (m) { m.position.copy(pos); m.lookAt(to); }
        glow.scale.setScalar(1 + Math.sin(now / 40) * 0.15);
        light.position.copy(pos);
        spark(pos, kind === 'fire' ? (Math.random() < 0.5 ? 0xff5a10 : 0xffc040) : 0x9ff4ff, kind === 'fire' ? 0.05 : 0.025);
        tickSparks(dt);
      });
      kill(ball, glow); if (tip) kill(tip);
    }
    // the burst on impact
    for (let i = 0; i < 18; i++) { spark(to, color, 0.04); sparks[sparks.length - 1].v.multiplyScalar(3); }
    this.flash(to, color, 90);
    last = performance.now();
    this.tween(500, () => { const now = performance.now(); tickSparks((now - last) / 1000); last = now; }).then(() => { sparks.forEach(s => kill(s.m)); this.scene.remove(light); });
    this.tween(300, p => { light.intensity = 9 * (1 - p); });
  }

  // checkmate: the loser's crown flies off and rolls away, the winners leap about, confetti and fireworks
  celebrate(winner, loserKingSq) {
    const g = this.pieces.get(loserKingSq), H = this.heroOf(g);
    if (H) {
      let crown = null;
      H.model.traverse(o => { if (o.userData.hat === 'crown') crown = o; });
      if (crown) setTimeout(() => {
        const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
        crown.updateWorldMatrix(true, false); crown.matrixWorld.decompose(wp, wq, ws);
        this.scene.attach(crown);
        const away = new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).normalize();
        const land = wp.clone().addScaledVector(away, 0.9).setY(0.05);
        const rollTo = land.clone().addScaledVector(away, 1.1);
        const spin = new THREE.Vector3(away.z, 0, -away.x);
        this.tween(700, p => { crown.position.lerpVectors(wp, land, p); crown.position.y = THREE.MathUtils.lerp(wp.y, 0.05, p) + Math.sin(Math.PI * p) * 0.7; crown.rotateOnWorldAxis(spin, 0.18); })
          .then(() => { this.hooks.sfx && this.hooks.sfx('thud'); crown.quaternion.setFromAxisAngle(spin, Math.PI / 2); return this.tween(1400, p => { crown.position.lerpVectors(land, rollTo, easeOut(p)); crown.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0.06 * (1 - p)); }); })
          .then(() => setTimeout(() => this.scene.remove(crown), 6000));
      }, 1100);
    }
    // the winning side leaps for joy
    setTimeout(() => {
      for (const p of this.pieces.values()) {
        if (p.userData.color !== winner) continue;
        const delay = rnd(0, 600), hops = 3 + Math.floor(rnd(0, 3));
        setTimeout(() => {
          const W = this.heroOf(p);
          if (W) this.play(p, W.cfg.attack, { once: false, fade: 0.2, speed: 1.2 });
          this.tween(hops * 520, q => { p.position.y = Math.abs(Math.sin(q * hops * Math.PI)) * 0.32; })
            .then(() => { p.position.y = 0; if (W) this.play(p, 'Idle'); });
        }, delay);
      }
    }, 900);
    // confetti and fireworks
    const conf = [], cols = [0xff4d6d, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xb388ff, 0xffffff];
    const pg = new THREE.PlaneGeometry(0.11, 0.06);
    for (let i = 0; i < 320; i++) {
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, transparent: true, fog: false }));
      m.position.set(rnd(-4.2, 4.2), rnd(2.5, 7.5), rnd(-4.2, 4.2)); m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      this.scene.add(m); conf.push({ m, v: rnd(0.9, 1.6), w: new THREE.Vector3(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6)), s: rnd(0, 6) });
    }
    let last = performance.now();
    this.tween(6500, p => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      for (const c of conf) {
        c.m.position.y = Math.max(0.01, c.m.position.y - c.v * dt); c.m.position.x += Math.sin(now / 400 + c.s) * dt * 0.3;
        if (c.m.position.y > 0.02) { c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt; } else c.m.rotation.set(-Math.PI / 2, 0, c.s);
        if (p > 0.8) c.m.material.opacity = (1 - p) * 5;
      }
    }).then(() => conf.forEach(c => { this.scene.remove(c.m); c.m.material.dispose(); }));
    for (let k = 0; k < 6; k++) setTimeout(() => this.firework(new THREE.Vector3(rnd(-3.5, 3.5), rnd(3.2, 4.6), rnd(-3, 1))), 700 + k * 650);
  }
  firework(at) {
    this.hooks.sfx && this.hooks.sfx('firework');
    const col = new THREE.Color().setHSL(Math.random(), 0.9, 0.62), n = 70;
    const pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1.6, 2.4)); vel.push(v); pos.set([at.x, at.y, at.z], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size: 0.16, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.scene.add(pts);
    const light = new THREE.PointLight(col, 40, 12, 2); light.position.copy(at); this.scene.add(light);
    this.tween(1500, p => {
      for (let i = 0; i < n; i++) { const e = easeOut(p); pos[i * 3] = at.x + vel[i].x * e; pos[i * 3 + 1] = at.y + vel[i].y * e - p * p * 1.2; pos[i * 3 + 2] = at.z + vel[i].z * e; }
      geo.attributes.position.needsUpdate = true; pts.material.opacity = 1 - p; light.intensity = 40 * (1 - p) * (1 - p);
    }).then(() => { this.scene.remove(pts, light); geo.dispose(); pts.material.dispose(); });
  }

  flash(pos, color, power) {
    const l = new THREE.PointLight(color, power, 7, 2);
    l.position.set(pos.x, 0.8, pos.z);
    this.scene.add(l);
    this.tween(420, p => { l.intensity = power * (1 - p); }).then(() => this.scene.remove(l));
  }

  splat(pos) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: splatTexture(this.splats.length % 4), emissiveMap: splatTexture(this.splats.length % 4), emissive: 0xffffff, emissiveIntensity: 0.35, transparent: true, depthWrite: false, roughness: 0.2, opacity: 0.95 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * Math.PI * 2;
    m.position.set(pos.x + rnd(-0.06, 0.06), 0.008, pos.z + rnd(-0.06, 0.06));
    m.receiveShadow = true; m.renderOrder = 3;     // above the square highlights
    this.scene.add(m);
    this.tween(260, p => { m.scale.setScalar(0.2 + 0.9 * easeOut(p)); });
    this.splats.push(m);
  }
  fadeSplats() {
    this.splats = this.splats.filter(m => {
      m.material.opacity -= 0.09;
      if (m.material.opacity > 0.15) return true;
      this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false;
    });
  }
  clearSplats() { this.splats.forEach(m => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); this.splats = []; }

  smash(victim, dir) {
    const pos = victim.position.clone();
    this.splat(pos);
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
    if (this.heroOf(g)) { setTimeout(() => { this.play(g, 'Death', { once: true }); setTimeout(() => { this.shake = 0.08; this.hooks.sfx && this.hooks.sfx('thud'); }, 900); }, 300); return; }
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
    for (const m of this.mixers) m.update(dt);
    for (const H of this.riders) for (const s of H.seat) {
      // if the animation did not touch this bone this frame, start again from last frame's pose
      if (!(s.out && s.b.quaternion.equals(s.out))) s.base.copy(s.b.quaternion);
      s.b.quaternion.copy(s.base).multiply(s.q);
      s.out = s.b.quaternion.clone();
    }
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
