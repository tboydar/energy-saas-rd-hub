import {
  BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DynamicDrawUsage, Group, HemisphereLight,
  IcosahedronGeometry, InstancedMesh, Mesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, PlaneGeometry, PointLight,
  RingGeometry, Scene, SphereGeometry, SRGBColorSpace,
} from 'three';
import type { DeviceId } from '../core/types';

// 等距微縮「能源資料工廠」的模型。全部用基本幾何（方塊、圓柱、圓錐）拼出低多邊形風格，
// 材質用 Lambert（霧面、便宜），配色是柔和的橘紅、亮黃與霧面鋼灰。
// 座標：底座上表面是 y = 0；相機在 +x、+z 方向，所以高的東西放在 -x、-z 那一側才不會擋住視線。

export const C = {
  orange: 0xf26b4a, orangeDeep: 0xd9532f, yellow: 0xffcf4a, steel: 0x9aa9b1, steelDark: 0x5f7079, steelLight: 0xc8d2d6,
  cream: 0xf3ead8, floor: 0xdde2df, yard: 0xc9d3cf, grass: 0xb5d6a7, soil: 0xd2a27f, soilDark: 0xb98561, plinth: 0x35454d,
  glass: 0xa9d8e6, navy: 0x3f5f7d, mint: 0x6fd0b8, red: 0xe5484d, white: 0xfbfaf5, tire: 0x38434a, rubber: 0x4d5b63,
  wood: 0xd9b48a, leaf: 0x9ccf9a, skin: 0xf2c9a5, sage: 0x9bbcae,
};

/** L 型輸送帶的路徑：A 段沿 -x 方向，轉角後 B 段沿 +z 方向；沖壓機在 B 段上。 */
export const PATH = { ax0: 2.95, az: -3.0, bx: -2.5, lenA: 5.45, lenB: 5.6, total: 11.05, press: 7.55, top: 0.84 };

/** 把路徑距離 s 換成位置；回傳 true 代表在 B 段（已經轉彎）。 */
export function pathPoint(s: number, out: { x: number; z: number }): boolean {
  if (s < PATH.lenA) {
    out.x = PATH.ax0 - s;
    out.z = PATH.az;
    return false;
  }
  out.x = PATH.bx;
  out.z = PATH.az + (s - PATH.lenA);
  return true;
}

export const BELT_ITEMS = 24;
export const SLATS = 46;
export const SMOKE = 28;
export const SMOKE_ORIGIN = { x: -4.25, y: 5.15, z: -0.9 };

export interface Beacon { mat: MeshLambertMaterial; halo: Mesh; haloMat: MeshBasicMaterial }
export interface SceneParts {
  scene: Scene;
  sun: DirectionalLight;
  pressLight: PointLight;
  devices: Record<DeviceId, Group>;
  beacons: Record<DeviceId, Beacon>;
  ring: Mesh;
  fans: Object3D[];
  ram: Mesh;
  glowMat: MeshLambertMaterial;
  buttons: MeshLambertMaterial[];
  screenMat: MeshLambertMaterial;
  smoke: InstancedMesh;
  smokeMat: MeshLambertMaterial;
  raw: InstancedMesh;
  rawStatic: number;
  product: InstancedMesh;
  productStatic: number;
  slats: InstancedMesh;
}

const cache = new Map<number, MeshLambertMaterial>();
function lam(color: number): MeshLambertMaterial {
  let m = cache.get(color);
  if (!m) {
    m = new MeshLambertMaterial({ color, flatShading: true });
    cache.set(color, m);
  }
  return m;
}
const glow = (color: number, intensity = 1) => new MeshLambertMaterial({ color, emissive: color, emissiveIntensity: intensity, flatShading: true });

function add<T extends Mesh>(parent: Object3D, mesh: T, x: number, y: number, z: number, shadow = true): T {
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}
const box = (p: Object3D, w: number, h: number, d: number, m: MeshLambertMaterial | MeshBasicMaterial, x: number, y: number, z: number, shadow = true) =>
  add(p, new Mesh(new BoxGeometry(w, h, d), m), x, y, z, shadow);
const cyl = (p: Object3D, rTop: number, rBottom: number, h: number, m: MeshLambertMaterial, x: number, y: number, z: number, seg = 10) =>
  add(p, new Mesh(new CylinderGeometry(rTop, rBottom, h, seg), m), x, y, z);

function device(scene: Scene, id: DeviceId, x = 0, y = 0, z = 0): Group {
  const g = new Group();
  g.position.set(x, y, z);
  g.userData.deviceId = id;
  scene.add(g);
  return g;
}

function beacon(parent: Object3D, x: number, y: number, z: number): Beacon {
  cyl(parent, 0.03, 0.03, 0.3, lam(C.steelDark), x, y - 0.2, z, 6);
  const mat = glow(C.mint, 1);
  add(parent, new Mesh(new SphereGeometry(0.13, 10, 8), mat), x, y, z, false);
  const haloMat = new MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0, depthWrite: false });
  const halo = add(parent, new Mesh(new SphereGeometry(0.5, 12, 10), haloMat), x, y, z, false);
  halo.visible = false;
  return { mat, halo, haloMat };
}

function buildBase(scene: Scene): void {
  box(scene, 17, 0.4, 17, lam(C.plinth), 0, -1.9, 0);
  box(scene, 16, 1.3, 16, lam(C.soil), 0, -1.05, 0);
  box(scene, 16.04, 0.14, 16.04, lam(C.soilDark), 0, -1.3, 0);
  box(scene, 16.04, 0.07, 16.04, lam(C.soilDark), 0, -0.72, 0);
  box(scene, 16, 0.4, 16, lam(C.yard), 0, -0.2, 0);
  // 切面上露出來的管線與電纜（地底的「資料管線」）
  for (const [z, color, r] of [[-3, C.yellow, 0.16], [-2.4, C.orange, 0.1], [4.6, C.steel, 0.13]] as const) {
    cyl(scene, r, r, 0.3, lam(color), 8.05, -1.0, z).rotation.z = Math.PI / 2;
  }
  for (const [x, color, r] of [[-2.5, C.yellow, 0.16], [-1.9, C.steel, 0.1], [4.2, C.orange, 0.12]] as const) {
    cyl(scene, r, r, 0.3, lam(color), x, -1.0, 8.05).rotation.x = Math.PI / 2;
  }
  box(scene, 7.8, 0.06, 4.8, lam(C.grass), 4.0, 0.03, 5.5);
  for (let i = 0; i < 6; i++) box(scene, 0.5, 0.02, 0.1, lam(C.yellow), 3.4 + i * 0.85, 0.01, -1.55, false);
  // 微縮模型放在切割墊上的接觸陰影
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.shadowColor = 'rgba(20,40,40,0.55)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(20,40,40,0.5)';
  ctx.fillRect(26, 26, 76, 76);
  const shadow = new Mesh(new PlaneGeometry(27, 27), new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(-0.6, -2.12, -0.6);
  scene.add(shadow);
}

function buildFactory(scene: Scene): Object3D[] {
  const cream = lam(C.cream);
  const cut = lam(C.orange);
  box(scene, 9, 0.12, 8, lam(C.floor), -2, 0.06, -2.5);
  // 兩面完整的牆（後、左），前方與右方切開成矮牆，露出室內
  box(scene, 9, 3.6, 0.3, cream, -2, 1.92, -6.35);
  box(scene, 0.3, 3.6, 7.7, cream, -6.35, 1.92, -2.35);
  box(scene, 9.02, 0.45, 0.34, lam(C.steelDark), -2, 0.345, -6.35);
  box(scene, 0.34, 0.45, 7.72, lam(C.steelDark), -6.35, 0.345, -2.35);
  // 剖面（被切開的面）漆成橘紅色
  box(scene, 9, 0.08, 0.3, cut, -2, 3.76, -6.35);
  box(scene, 0.3, 0.08, 7.7, cut, -6.35, 3.76, -2.35);
  box(scene, 0.08, 3.6, 0.3, cut, 2.54, 1.92, -6.35);
  box(scene, 0.3, 3.6, 0.08, cut, -6.35, 1.92, 1.54);
  const glass = new MeshLambertMaterial({ color: C.glass, emissive: C.glass, emissiveIntensity: 0.25, flatShading: true });
  for (const x of [-4.6, 0.7]) box(scene, 1.3, 1.0, 0.36, glass, x, 2.3, -6.35, false);
  for (const z of [-4.4, 0.3]) box(scene, 0.36, 1.0, 1.3, glass, -6.35, 2.3, z, false);
  const stubs: [number, number, number, number][] = [[3.2, 0.3, -4.9, 1.35], [4.2, 0.3, 0.4, 1.35], [0.3, 2.45, 2.35, -4.975], [0.3, 3.75, 2.35, -0.375]];
  for (const [w, d, x, z] of stubs) {
    box(scene, w, 0.5, d, cream, x, 0.37, z);
    box(scene, w, 0.06, d, cut, x, 0.65, z, false);
  }
  // 後牆上方留一條屋頂，放排風扇
  box(scene, 9.3, 0.22, 2.4, lam(C.steel), -2, 3.91, -5.3);
  box(scene, 9.3, 0.1, 0.08, lam(C.yellow), -2, 3.86, -4.08, false);
  box(scene, 0.22, 3.6, 0.22, lam(C.steelDark), 2.3, 1.92, -4.22);
  const fans: Object3D[] = [];
  for (const x of [-4.7, -0.3]) {
    cyl(scene, 0.62, 0.62, 0.3, lam(C.steelDark), x, 4.17, -5.3, 12);
    const rotor = new Group();
    rotor.position.set(x, 4.37, -5.3);
    box(rotor, 1.05, 0.04, 0.22, lam(C.yellow), 0, 0, 0, false);
    box(rotor, 0.22, 0.04, 1.05, lam(C.yellow), 0, 0, 0, false);
    cyl(rotor, 0.12, 0.12, 0.12, lam(C.orange), 0, 0.03, 0, 8);
    scene.add(rotor);
    fans.push(rotor);
  }
  for (const z of [-3.68, -2.32]) box(scene, 4.3, 0.02, 0.07, lam(C.yellow), 0.2, 0.13, z, false);
  for (const x of [-3.18, -1.82]) box(scene, 0.07, 0.02, 3.2, lam(C.yellow), x, 0.13, -0.4, false);
  return fans;
}

function buildConveyor(scene: Scene): InstancedMesh {
  const rubber = lam(C.rubber);
  const rail = lam(C.orange);
  const leg = lam(C.steel);
  box(scene, 5.85, 0.16, 0.8, rubber, 0.425, 0.76, -3.0);
  box(scene, 0.8, 0.16, 6.0, rubber, -2.5, 0.76, -0.4);
  box(scene, 6.28, 0.1, 0.06, rail, 0.21, 0.87, -3.43);
  box(scene, 5.42, 0.1, 0.06, rail, 0.64, 0.87, -2.57);
  box(scene, 0.06, 0.1, 6.03, rail, -2.93, 0.87, -0.415);
  box(scene, 0.06, 0.1, 5.17, rail, -2.07, 0.87, 0.015);
  for (const x of [3.1, 1.4, -0.4]) for (const z of [-3.3, -2.7]) box(scene, 0.12, 0.68, 0.12, leg, x, 0.34, z);
  for (const z of [-3.2, -2.0, 0.6, 2.4]) for (const x of [-2.8, -2.2]) box(scene, 0.12, 0.68, 0.12, leg, x, 0.34, z);
  const slats = new InstancedMesh(new BoxGeometry(0.07, 0.012, 0.7), lam(0x66757d), SLATS);
  slats.instanceMatrix.setUsage(DynamicDrawUsage);
  slats.receiveShadow = true;
  scene.add(slats);
  return slats;
}

function buildPress(scene: Scene): { group: Group; ram: Mesh; glowMat: MeshLambertMaterial; light: PointLight; beacon: Beacon } {
  const g = device(scene, 'press');
  const px = PATH.bx;
  const pz = -0.9;
  for (const x of [px - 0.66, px + 0.66]) for (const z of [pz - 0.45, pz + 0.45]) box(g, 0.2, 2.4, 0.2, lam(C.orange), x, 1.32, z);
  box(g, 1.75, 0.5, 1.3, lam(C.orangeDeep), px, 2.75, pz);
  box(g, 1.79, 0.1, 1.34, lam(C.yellow), px, 2.48, pz, false);
  cyl(g, 0.3, 0.3, 0.42, lam(C.steelDark), px, 3.2, pz);
  const ram = box(g, 0.74, 0.55, 0.74, lam(C.steelLight), px, 2.0, pz);
  cyl(ram, 0.11, 0.11, 1.1, lam(C.steel), 0, 0.75, 0, 8);
  // 熔爐：在沖壓機左側，開口朝向輸送帶，煙囪從上方伸出
  box(g, 1.3, 1.9, 1.5, lam(C.steelDark), -4.05, 1.07, pz);
  box(g, 1.34, 0.16, 1.54, lam(C.yellow), -4.05, 0.5, pz, false);
  box(g, 1.42, 0.12, 1.62, lam(C.steel), -4.05, 2.08, pz);
  const glowMat = glow(0xff8a3d, 1.2);
  box(g, 0.06, 0.62, 0.86, glowMat, -3.385, 1.2, pz, false);
  cyl(g, 0.3, 0.38, 2.95, lam(C.orange), SMOKE_ORIGIN.x, 3.6, pz);
  cyl(g, 0.4, 0.4, 0.2, lam(C.cream), SMOKE_ORIGIN.x, 4.45, pz);
  cyl(g, 0.36, 0.36, 0.12, lam(C.steelDark), SMOKE_ORIGIN.x, 5.1, pz);
  const light = new PointLight(0xff8a3d, 3, 4.5, 2);
  light.position.set(-3.0, 1.3, pz);
  g.add(light);
  return { group: g, ram, glowMat, light, beacon: beacon(g, px, 3.72, pz) };
}

function buildConsole(scene: Scene): { group: Group; buttons: MeshLambertMaterial[]; screenMat: MeshLambertMaterial; beacon: Beacon } {
  const g = device(scene, 'console', 0.7, 0.12, -0.5);
  box(g, 1.7, 0.75, 0.7, lam(C.steelLight), 0, 0.375, 0);
  box(g, 1.72, 0.1, 0.72, lam(C.orange), 0, 0.1, 0, false);
  const panel = box(g, 1.7, 0.08, 0.66, lam(C.steelDark), 0, 0.87, 0.1);
  panel.rotation.x = 0.45;
  const buttons = [C.red, C.yellow, C.mint, C.orange, C.yellow].map((color, i) => {
    const m = glow(color, 1);
    box(panel, 0.16, 0.07, 0.16, m, -0.6 + i * 0.3, 0.07, i % 2 ? 0.1 : -0.08, false);
    return m;
  });
  box(g, 0.1, 0.45, 0.1, lam(C.steelDark), 0, 1.0, -0.3);
  box(g, 1.15, 0.72, 0.08, lam(C.steelDark), 0, 1.5, -0.3);
  const screenMat = glow(C.mint, 0.8);
  box(g, 1.0, 0.56, 0.02, screenMat, 0, 1.5, -0.25, false);
  // 一位操作員，讓模型有比例感
  cyl(g, 0.13, 0.17, 0.55, lam(C.orange), 0.25, 0.275, 0.8, 8);
  add(g, new Mesh(new SphereGeometry(0.14, 8, 6), lam(C.skin)), 0.25, 0.68, 0.8);
  cyl(g, 0.16, 0.16, 0.07, lam(C.yellow), 0.25, 0.79, 0.8, 8);
  return { group: g, buttons, screenMat, beacon: beacon(g, 0, 2.1, -0.3) };
}

function buildTruck(scene: Scene): { group: Group; beacon: Beacon } {
  const g = device(scene, 'truck', 4.95, 0, PATH.az);
  for (const x of [-1.05, -0.38, 1.15]) for (const z of [-0.62, 0.62]) cyl(g, 0.3, 0.3, 0.22, lam(C.tire), x, 0.3, z, 12).rotation.x = Math.PI / 2;
  box(g, 3.1, 0.16, 1.2, lam(C.steelDark), 0, 0.52, 0);
  box(g, 2.1, 0.1, 1.3, lam(C.steelLight), -0.45, 0.65, 0);
  for (const z of [-0.62, 0.62]) box(g, 2.1, 0.42, 0.07, lam(C.steel), -0.45, 0.9, z);
  box(g, 0.07, 0.52, 1.3, lam(C.steel), 0.6, 0.95, 0);
  box(g, 0.95, 1.0, 1.25, lam(C.orange), 1.13, 1.1, 0);
  const glass = lam(C.glass);
  box(g, 0.05, 0.42, 1.0, glass, 1.62, 1.28, 0, false);
  box(g, 0.5, 0.4, 1.27, glass, 1.2, 1.3, 0, false);
  box(g, 0.12, 0.2, 1.25, lam(C.steelDark), 1.66, 0.6, 0);
  for (const z of [-0.45, 0.45]) box(g, 0.04, 0.12, 0.2, glow(C.yellow, 0.9), 1.63, 0.8, z, false);
  box(g, 0.6, 0.06, 0.85, lam(C.yellow), -1.75, 0.78, 0).rotation.z = 0.22;
  return { group: g, beacon: beacon(g, 1.13, 1.85, 0) };
}

function buildTanks(scene: Scene): { group: Group; beacon: Beacon } {
  const g = device(scene, 'tank');
  box(g, 4.6, 0.1, 3.5, lam(C.floor), 5.4, 0.05, -5.75);
  const big: [number, number, number][] = [[4.45, C.orange, C.yellow], [6.5, C.yellow, C.steel]];
  for (const [x, band, cap] of big) {
    cyl(g, 0.9, 0.9, 2.7, lam(C.white), x, 1.45, -6.35, 12);
    cyl(g, 0.92, 0.92, 0.22, lam(band), x, 1.0, -6.35, 12);
    add(g, new Mesh(new ConeGeometry(0.92, 0.5, 12), lam(cap)), x, 3.05, -6.35);
    box(g, 0.14, 1.5, 0.08, glow(C.mint, 0.7), x, 1.75, -5.43, false);
  }
  box(g, 0.3, 2.6, 0.05, lam(C.steelDark), 6.9, 1.4, -5.5);
  cyl(g, 0.6, 0.6, 1.5, lam(C.orange), 5.5, 0.85, -4.7, 10);
  add(g, new Mesh(new ConeGeometry(0.62, 0.36, 10), lam(C.steel)), 5.5, 1.78, -4.7);
  cyl(g, 0.09, 0.09, 1.3, lam(C.steel), 3.1, 0.6, -5.9, 8).rotation.z = Math.PI / 2;
  cyl(g, 0.09, 0.09, 0.9, lam(C.steel), 5.0, 0.5, -5.4, 8).rotation.x = Math.PI / 2;
  return { group: g, beacon: beacon(g, 4.45, 3.55, -6.35) };
}

function buildSolar(scene: Scene): { group: Group; beacon: Beacon } {
  const g = device(scene, 'solar');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3f5f7d';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#a9c8dc';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 16, 0); ctx.lineTo(i * 16, 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 16); ctx.lineTo(64, i * 16); ctx.stroke();
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const panelMat = new MeshLambertMaterial({ map, flatShading: true });
  for (const z of [4.5, 6.3]) {
    for (const x of [1.7, 3.3, 4.9, 6.5]) {
      const p = box(g, 1.42, 0.07, 1.02, panelMat, x, 0.78, z);
      p.rotation.x = 0.5;
      box(g, 1.48, 0.04, 1.08, lam(C.steelLight), x, 0.75, z - 0.01).rotation.x = 0.5;
      cyl(g, 0.06, 0.06, 0.7, lam(C.steel), x, 0.38, z, 6);
    }
  }
  box(g, 0.5, 0.7, 0.36, lam(C.cream), 0.55, 0.41, 5.4);
  box(g, 0.52, 0.1, 0.38, lam(C.orange), 0.55, 0.7, 5.4, false);
  return { group: g, beacon: beacon(g, 0.55, 1.1, 5.4) };
}

function buildSubstation(scene: Scene): { group: Group; beacon: Beacon } {
  const g = device(scene, 'substation', -5.3, 0, 4.7);
  box(g, 2.6, 0.1, 2.2, lam(C.floor), 0, 0.05, 0);
  box(g, 1.5, 1.3, 1.1, lam(C.sage), 0, 0.75, 0);
  for (let i = -2; i <= 2; i++) for (const z of [-0.63, 0.63]) box(g, 0.08, 0.9, 0.16, lam(C.steel), i * 0.3, 0.72, z);
  box(g, 1.6, 0.1, 1.2, lam(C.steelDark), 0, 1.45, 0);
  for (const i of [-1, 0, 1]) {
    cyl(g, 0.07, 0.09, 0.4, lam(C.cream), i * 0.45, 1.7, 0, 8);
    add(g, new Mesh(new SphereGeometry(0.1, 8, 6), lam(C.orange)), i * 0.45, 1.95, 0);
  }
  box(g, 0.02, 0.42, 0.42, lam(C.yellow), 0.765, 0.85, 0, false);
  for (const [x, z] of [[-1.2, -1.0], [1.2, -1.0], [-1.2, 1.0], [1.2, 1.0]]) box(g, 0.08, 0.6, 0.08, lam(C.yellow), x, 0.4, z);
  for (const z of [-1.0, 1.0]) box(g, 2.4, 0.05, 0.05, lam(C.yellow), 0, 0.62, z, false);
  box(g, 0.05, 0.05, 2.0, lam(C.yellow), -1.2, 0.62, 0, false);
  return { group: g, beacon: beacon(g, 0, 2.3, 0) };
}

function buildExtras(scene: Scene): void {
  // 地面電纜：太陽能板 → 變電箱 → 廠房
  box(scene, 4.6, 0.05, 0.1, lam(C.tire), -1.75, 0.03, 5.4, false);
  box(scene, 0.1, 0.05, 2.0, lam(C.tire), -5.3, 0.03, 2.6, false);
  box(scene, 1.4, 0.12, 1.4, lam(C.wood), PATH.bx, 0.06, 3.55);
  box(scene, 0.8, 0.05, 0.6, lam(C.steel), PATH.bx, 0.62, 2.85).rotation.x = 0.5;
  for (const [x, z, s] of [[7.1, 1.3, 1], [-7.0, 7.0, 1.15], [-7.2, 2.3, 0.85], [0.1, 7.3, 0.9]]) {
    cyl(scene, 0.08, 0.1, 0.5, lam(C.wood), x, 0.25, z, 6);
    const crown = add(scene, new Mesh(new IcosahedronGeometry(0.55 * s, 0), lam(C.leaf)), x, 0.5 + 0.55 * s, z);
    crown.scale.y = 1.25;
  }
}

/** 建立整個場景，回傳之後動畫與互動要用到的零件。 */
export function buildScene(): SceneParts {
  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0xd8cdbd, 1.3));
  const sun = new DirectionalLight(0xfff1dc, 2.3);
  sun.position.set(9, 16, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  buildBase(scene);
  const fans = buildFactory(scene);
  const slats = buildConveyor(scene);
  const press = buildPress(scene);
  const consoleUnit = buildConsole(scene);
  const truck = buildTruck(scene);
  const tanks = buildTanks(scene);
  const solar = buildSolar(scene);
  const substation = buildSubstation(scene);
  buildExtras(scene);

  // 原料方塊：前面幾個是靜止的（貨車上的貨），後面的在輸送帶上移動
  const dummy = new Object3D();
  const color = new Color();
  const cargo: [number, number, number][] = [];
  for (const x of [3.6, 4.0, 4.4, 4.8, 5.2]) for (const z of [-3.28, -2.72]) cargo.push([x, 0.86, z]);
  for (const x of [3.8, 4.4, 5.0]) cargo.push([x, 1.17, -3.0]);
  const raw = new InstancedMesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshLambertMaterial({ color: 0xffffff, flatShading: true }), cargo.length + BELT_ITEMS);
  raw.instanceMatrix.setUsage(DynamicDrawUsage);
  raw.castShadow = true;
  const tones = [0x9aa9b1, 0xb9c4c9, 0x7f9099, 0xe8a07f, 0xc8d2d6];
  for (let i = 0; i < raw.count; i++) {
    raw.setColorAt(i, color.setHex(tones[i % tones.length]));
    if (i < cargo.length) {
      dummy.position.set(...cargo[i]);
      dummy.rotation.set(0, (i * 0.7) % 0.5, 0);
      dummy.updateMatrix();
      raw.setMatrixAt(i, dummy.matrix);
    }
  }
  scene.add(raw);

  // 發光成品：棧板上堆疊的是靜止的，其餘在輸送帶上
  const stack: [number, number, number][] = [];
  for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) stack.push([PATH.bx + ix * 0.36, 0.28, 3.55 + iz * 0.36]);
  for (const [ix, iz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) stack.push([PATH.bx + ix * 0.36, 0.6, 3.55 + iz * 0.36]);
  stack.push([PATH.bx, 0.92, 3.55]);
  const product = new InstancedMesh(
    new BoxGeometry(0.3, 0.3, 0.3),
    new MeshLambertMaterial({ color: 0xffffff, emissive: 0xffb72e, emissiveIntensity: 0.85, flatShading: true }),
    stack.length + BELT_ITEMS,
  );
  product.instanceMatrix.setUsage(DynamicDrawUsage);
  dummy.rotation.set(0, 0, 0);
  for (let i = 0; i < product.count; i++) {
    product.setColorAt(i, color.setHex(i % 4 === 0 ? 0xbff3e6 : 0xffe08a));
    if (i < stack.length) {
      dummy.position.set(...stack[i]);
      dummy.updateMatrix();
      product.setMatrixAt(i, dummy.matrix);
    }
  }
  scene.add(product);

  const smokeMat = new MeshLambertMaterial({ color: 0xf6f3ea, transparent: true, opacity: 0.62, depthWrite: false, flatShading: true });
  const smoke = new InstancedMesh(new IcosahedronGeometry(0.3, 0), smokeMat, SMOKE);
  smoke.instanceMatrix.setUsage(DynamicDrawUsage);
  scene.add(smoke);

  const ring = new Mesh(new RingGeometry(0.9, 1, 48), new MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0.95, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  return {
    scene, sun, pressLight: press.light, ring, fans, ram: press.ram, glowMat: press.glowMat,
    buttons: consoleUnit.buttons, screenMat: consoleUnit.screenMat, smoke, smokeMat,
    raw, rawStatic: cargo.length, product, productStatic: stack.length, slats,
    devices: { press: press.group, console: consoleUnit.group, truck: truck.group, tank: tanks.group, solar: solar.group, substation: substation.group },
    beacons: { press: press.beacon, console: consoleUnit.beacon, truck: truck.beacon, tank: tanks.beacon, solar: solar.beacon, substation: substation.beacon },
  };
}
