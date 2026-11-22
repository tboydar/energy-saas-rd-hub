import { Color, Object3D, OrthographicCamera, Raycaster, Vector2, Vector3, WebGLRenderer, type Mesh } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { DeviceId } from '../core/types';
import type { DeviceStatus } from '../sim/engine';
import { BELT_ITEMS, buildScene, PATH, pathPoint, SLATS, SMOKE, SMOKE_ORIGIN } from './scene';

// 3D 場景的執行期：相機、OrbitControls、動畫迴圈、點擊聚焦，以及與 Dashboard 同步的狀態。

export interface FactoryLabel { id: DeviceId; tag: string; name: string }
export interface FactoryOptions {
  container: HTMLElement;
  labelLayer: HTMLElement;
  labels: FactoryLabel[];
  /** 給螢幕報讀器的場景說明。 */
  ariaLabel: string;
  lowFx: boolean;
  onSelect(id: DeviceId | null): void;
  /** 場景因為裝置太慢而自動切到「降低特效」時通知頁面（用來同步核取方塊）。 */
  onAutoLowFx?(): void;
}
export interface FactoryHandle {
  focus(id: DeviceId | null): void;
  resetView(): void;
  zoomBy(factor: number): void;
  setStatus(id: DeviceId, status: DeviceStatus): void;
  setFlow(flow: number): void;
  setLowFx(low: boolean): void;
  setLabels(labels: FactoryLabel[]): void;
  dispose(): void;
}

/** 每個設備的聚焦點、聚焦倍率、選取圈大小與標籤高度。 */
const FOCUS: Record<DeviceId, { at: [number, number, number]; zoom: number; ring: number; label: number }> = {
  press: { at: [-3.1, 1.6, -0.9], zoom: 2.1, ring: 1.9, label: 4.3 },
  truck: { at: [4.95, 0.8, -3.0], zoom: 2.3, ring: 2.0, label: 2.5 },
  tank: { at: [5.4, 1.4, -5.8], zoom: 2.0, ring: 2.5, label: 4.2 },
  solar: { at: [4.1, 0.6, 5.4], zoom: 1.9, ring: 3.3, label: 1.9 },
  substation: { at: [-5.3, 0.8, 4.7], zoom: 2.5, ring: 1.6, label: 2.9 },
  console: { at: [0.7, 0.9, -0.4], zoom: 2.5, ring: 1.3, label: 2.8 },
};
const IDS = Object.keys(FOCUS) as DeviceId[];
const VIEW = 21;
const HOME_OFFSET = new Vector3(20, 17, 20);
const HOME_TARGET = new Vector3(0, 0.3, 0);
const BASE_SPEED = 0.95;

/** 把主執行緒讓出來一下，讓瀏覽器有機會處理輸入與繪製。 */
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const mark = (name: string, since: number) => performance.measure(`factory:${name}`, { start: since, end: performance.now() });

/**
 * 建立 3D 場景。初始化很重（建立 WebGL context、建模、編譯 shader），
 * 所以拆成幾段、每段之間讓出主執行緒，避免出現一個卡住畫面數百毫秒的長任務。
 */
export async function createFactory(opts: FactoryOptions): Promise<FactoryHandle> {
  const { container, labelLayer } = opts;
  let lowFx = opts.lowFx;

  let t = performance.now();
  const renderer = new WebGLRenderer({ antialias: !lowFx, alpha: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  // 場景大多是靜止的：陰影貼圖不必每幀重算，改成每隔幾幀更新一次（見 frame()）。
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.className = 'stage-canvas';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', opts.ariaLabel);
  mark('renderer', t);
  await pause();

  t = performance.now();
  const parts = buildScene();
  const { scene } = parts;
  mark('scene', t);
  await pause();
  container.prepend(renderer.domElement);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.copy(HOME_TARGET).add(HOME_OFFSET);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.9;
  // 限制俯仰角：最高不到正上方，最低不會翻到底座下面。
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = 1.42;

  let fitZoom = 1;
  function resize(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    camera.left = (-VIEW * aspect) / 2;
    camera.right = (VIEW * aspect) / 2;
    camera.top = VIEW / 2;
    camera.bottom = -VIEW / 2;
    const nextFit = Math.min(1.12, (VIEW * aspect) / 26.5);
    camera.zoom = camera.zoom * (nextFit / fitZoom);
    fitZoom = nextFit;
    controls.minZoom = fitZoom * 0.7;
    controls.maxZoom = fitZoom * 4.5;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(lowFx ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
  }
  resize();
  camera.zoom = fitZoom;
  camera.updateProjectionMatrix();

  // ───── 標籤（HTML 疊在 canvas 上，可用鍵盤操作）
  const labelEls = new Map<DeviceId, HTMLButtonElement>();
  function setLabels(labels: FactoryLabel[]): void {
    labelLayer.replaceChildren();
    labelEls.clear();
    for (const l of labels) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tag3d';
      b.dataset.device = l.id;
      const tag = document.createElement('b');
      tag.textContent = l.tag;
      const name = document.createElement('span');
      name.textContent = l.name;
      b.append(tag, name);
      b.addEventListener('click', () => select(l.id));
      labelLayer.appendChild(b);
      labelEls.set(l.id, b);
    }
    refreshLabelState();
  }

  // ───── 狀態
  const status: Record<DeviceId, DeviceStatus> = { press: 'ok', truck: 'ok', tank: 'ok', solar: 'ok', substation: 'ok', console: 'ok' };
  let selected: DeviceId | null = null;
  let flowTarget = 1;
  let speed = BASE_SPEED;
  let offset = 0;
  let smokeGray = 0;

  function refreshLabelState(): void {
    for (const [id, el] of labelEls) {
      el.classList.toggle('is-alarm', status[id] !== 'ok');
      el.classList.toggle('is-selected', selected === id);
      el.setAttribute('aria-pressed', String(selected === id));
    }
  }

  // ───── 聚焦動畫（Lerp）
  let anim: { target: Vector3; zoom: number; offset?: Vector3 } | null = null;
  controls.addEventListener('start', () => { anim = null; });

  function focus(id: DeviceId | null): void {
    selected = id;
    parts.ring.visible = !!id;
    if (id) {
      const f = FOCUS[id];
      parts.ring.position.set(f.at[0], 0.16, f.at[2]);
      parts.ring.scale.setScalar(f.ring);
      anim = { target: new Vector3(...f.at), zoom: fitZoom * f.zoom };
    }
    refreshLabelState();
  }
  function resetView(): void {
    anim = { target: HOME_TARGET.clone(), zoom: fitZoom, offset: HOME_OFFSET.clone() };
  }
  function select(id: DeviceId | null): void {
    focus(id);
    opts.onSelect(id);
  }

  // ───── 點擊偵測（Raycaster）
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const pickables = IDS.map((id) => parts.devices[id]);
  let downX = 0;
  let downY = 0;
  function pick(event: PointerEvent): DeviceId | null {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, true)[0];
    for (let o: Object3D | null = hit?.object ?? null; o; o = o.parent) {
      if (o.userData.deviceId) return o.userData.deviceId as DeviceId;
    }
    return null;
  }
  const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; };
  const onUp = (e: PointerEvent) => {
    // 拖曳旋轉後放開不算點擊
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    const id = pick(e);
    if (id) select(id);
  };
  let lastHover = 0;
  const onMove = (e: PointerEvent) => {
    if (e.buttons || e.timeStamp - lastHover < 90) return;
    lastHover = e.timeStamp;
    renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab';
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointermove', onMove);

  // ───── 每幀更新
  const dummy = new Object3D();
  const pt = { x: 0, z: 0 };
  const v = new Vector3();
  const before = new Vector3();
  const cWhite = new Color(0xf6f3ea);
  const cGray = new Color(0x596168);
  const cMint = new Color(0x6fd0b8);
  const cRed = new Color(0xff3b30);
  const spacing = PATH.total / BELT_ITEMS;
  const slatGap = PATH.total / SLATS;
  const hidden = new Object3D();
  hidden.scale.setScalar(0);
  hidden.updateMatrix();

  function update(dt: number, t: number): void {
    const k = 1 - Math.exp(-dt * 3);
    speed += (BASE_SPEED * flowTarget - speed) * k;
    offset = (offset + speed * dt) % PATH.total;
    const items = lowFx ? BELT_ITEMS / 2 : BELT_ITEMS;
    const gap = lowFx ? spacing * 2 : spacing;

    for (let i = 0; i < BELT_ITEMS; i++) {
      const rawIndex = parts.rawStatic + i;
      const productIndex = parts.productStatic + i;
      if (i >= items) {
        parts.raw.setMatrixAt(rawIndex, hidden.matrix);
        parts.product.setMatrixAt(productIndex, hidden.matrix);
        continue;
      }
      const s = (offset + i * gap) % PATH.total;
      pathPoint(s, pt);
      const isProduct = s >= PATH.press;
      dummy.position.set(pt.x, PATH.top + 0.16, pt.z);
      dummy.rotation.set(0, isProduct ? 0 : (i * 1.3) % 0.6, 0);
      dummy.scale.setScalar(isProduct ? 1 : 0.86 + ((i * 7) % 5) * 0.05);
      dummy.updateMatrix();
      parts.raw.setMatrixAt(rawIndex, isProduct ? hidden.matrix : dummy.matrix);
      parts.product.setMatrixAt(productIndex, isProduct ? dummy.matrix : hidden.matrix);
    }
    parts.raw.instanceMatrix.needsUpdate = true;
    parts.product.instanceMatrix.needsUpdate = true;

    dummy.scale.setScalar(1);
    for (let i = 0; i < SLATS; i++) {
      const onB = pathPoint((offset + i * slatGap) % PATH.total, pt);
      dummy.position.set(pt.x, PATH.top + 0.006, pt.z);
      dummy.rotation.set(0, onB ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix();
      parts.slats.setMatrixAt(i, dummy.matrix);
    }
    parts.slats.instanceMatrix.needsUpdate = true;

    // 衝頭：有方塊剛好在沖壓機正下方時往下壓
    const phase = (((offset - PATH.press) % gap) + gap) % gap / gap;
    const near = Math.min(phase, 1 - phase);
    const press = Math.max(0, 1 - near / 0.16);
    parts.ram.position.y = 2.0 - 0.56 * press * press;
    parts.glowMat.emissiveIntensity = 1.0 + press * 1.6 + Math.sin(t * 9) * 0.12;
    parts.pressLight.intensity = lowFx ? 0 : 2 + press * 5;

    for (const fan of parts.fans) fan.rotation.y += dt * (2.5 + 7 * flowTarget);

    // 煙：小球上升、變大、最後縮小消散；事件期間顏色轉灰
    const incident = IDS.some((id) => status[id] === 'incident');
    smokeGray += ((incident ? 1 : 0) - smokeGray) * k;
    parts.smokeMat.color.copy(cWhite).lerp(cGray, smokeGray);
    parts.smokeMat.opacity = 0.6 + smokeGray * 0.25;
    const puffs = lowFx ? SMOKE / 2 : SMOKE;
    for (let i = 0; i < SMOKE; i++) {
      if (i >= puffs) { parts.smoke.setMatrixAt(i, hidden.matrix); continue; }
      const life = (t * (0.16 + smokeGray * 0.1) + i / puffs) % 1;
      const sway = Math.sin(i * 12.9898) * 0.5;
      dummy.position.set(
        SMOKE_ORIGIN.x + Math.sin(life * 4 + i) * 0.22 * life + sway * life * 0.9,
        SMOKE_ORIGIN.y + life * 3.4,
        SMOKE_ORIGIN.z + Math.cos(life * 3 + i * 2) * 0.22 * life - life * 0.5,
      );
      const fade = life > 0.7 ? 1 - (life - 0.7) / 0.3 : 1;
      dummy.scale.setScalar((0.45 + life * 1.5) * fade * (1 + smokeGray * 0.3));
      dummy.rotation.set(i, life * 2 + i, 0);
      dummy.updateMatrix();
      parts.smoke.setMatrixAt(i, dummy.matrix);
    }
    parts.smoke.instanceMatrix.needsUpdate = true;

    // 狀態燈：正常是穩定的薄荷綠；異常與事件時閃紅燈並帶光暈
    for (const id of IDS) {
      const b = parts.beacons[id];
      const st = status[id];
      if (st === 'ok') {
        b.mat.color.copy(cMint);
        b.mat.emissive.copy(cMint);
        b.mat.emissiveIntensity = 0.9;
        b.halo.visible = false;
      } else {
        const blink = Math.sin(t * (st === 'incident' ? 11 : 7)) > 0 ? 1 : 0.12;
        b.mat.color.copy(cRed);
        b.mat.emissive.copy(cRed);
        b.mat.emissiveIntensity = 2.2 * blink;
        b.halo.visible = true;
        b.haloMat.opacity = 0.3 * blink;
        b.halo.scale.setScalar((st === 'incident' ? 2.4 : 1.6) + Math.sin(t * 5) * 0.2);
      }
    }
    parts.buttons.forEach((m, i) => {
      m.emissiveIntensity = Math.sin(t * (2.2 + i * 0.9) + i * 1.7) > 0.1 ? 1.5 : 0.12;
    });
    parts.screenMat.emissiveIntensity = 0.75 + Math.sin(t * 3.1) * 0.1;
    if (parts.ring.visible) {
      parts.ring.rotation.z = t * 0.6;
      (parts.ring as Mesh).scale.setScalar(FOCUS[selected!].ring * (1 + Math.sin(t * 3) * 0.03));
    }

    if (anim) {
      const a = 1 - Math.exp(-dt * 4.5);
      before.copy(controls.target);
      controls.target.lerp(anim.target, a);
      camera.position.add(v.copy(controls.target).sub(before));
      if (anim.offset) {
        v.copy(camera.position).sub(controls.target).lerp(anim.offset, a);
        camera.position.copy(controls.target).add(v);
      }
      camera.zoom += (anim.zoom - camera.zoom) * a;
      camera.updateProjectionMatrix();
      const settled = controls.target.distanceTo(anim.target) < 0.01 && Math.abs(camera.zoom - anim.zoom) < 0.004;
      if (settled && (!anim.offset || v.distanceTo(anim.offset) < 0.05)) anim = null;
    }
  }

  function placeLabels(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const [id, el] of labelEls) {
      const f = FOCUS[id];
      v.set(f.at[0], f.label, f.at[2]).project(camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // ───── 動畫迴圈：分頁不在前景、或場景捲出畫面時就停下來
  let raf = 0;
  let last = 0;
  let frameNo = 0;
  let rendered = 0;
  let cost = 0;
  let onScreen = true;
  let disposed = false;
  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    // 降低特效時只畫一半的幀（約 30 fps）
    if (lowFx && frameNo++ % 2) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const began = performance.now();
    update(dt, now / 1000);
    controls.update();
    // 陰影每 6 幀更新一次：移動的方塊陰影幾乎看不出差別，卻省下大部分的陰影計算。
    if (!lowFx && rendered++ % 6 === 0) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    placeLabels();
    // 自動降載：連續量到每幀都很慢（沒有 GPU 或裝置較舊）就自動切到「降低特效」。
    cost += (performance.now() - began - cost) * 0.1;
    if (!lowFx && rendered > 40 && cost > 26) {
      setLowFx(true);
      opts.onAutoLowFx?.();
    }
  }
  function sync(): void {
    const shouldRun = !disposed && onScreen && !document.hidden;
    if (shouldRun && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  document.addEventListener('visibilitychange', sync);
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    sync();
  });
  io.observe(container);
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function setLowFx(low: boolean): void {
    lowFx = low;
    parts.sun.castShadow = !low;
    renderer.shadowMap.needsUpdate = true;
    resize();
  }

  setLabels(opts.labels);
  setLowFx(lowFx);
  // 先把 shader 編譯好（支援平行編譯的瀏覽器不會卡住主執行緒），再開始動畫迴圈。
  t = performance.now();
  update(0, 0);
  await renderer.compileAsync(scene, camera);
  mark('compile', t);
  await pause();
  t = performance.now();
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  placeLabels();
  mark('first-frame', t);
  sync();

  return {
    focus,
    resetView,
    zoomBy(factor) {
      anim = { target: controls.target.clone(), zoom: Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom * factor)) };
    },
    setStatus(id, next) {
      if (status[id] === next) return;
      status[id] = next;
      refreshLabelState();
    },
    setFlow(flow) { flowTarget = flow; },
    setLowFx,
    setLabels,
    dispose() {
      disposed = true;
      sync();
      document.removeEventListener('visibilitychange', sync);
      io.disconnect();
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as Mesh;
        mesh.geometry?.dispose();
        const m = mesh.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelLayer.replaceChildren();
    },
  };
}
