import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
  dimensionLabel,
  floorFinishKind,
  floorOutline,
  wallSwatch,
  type ModelWall,
  type RoomModel,
  type RoomSurface,
} from '@renovagent/core';

// The room model as a three.js scene. Plan (x, y) maps to three (x, up, y), so
// the view matches the plan drawing from above. Display-only stand-ins (wall
// thickness or height the plan does not give) are drawn in a distinct
// translucent style and recorded as such in the exported GLB.

export type RoomLook = { wallColor: string; floorFinish: string; label: string };
export type RoomScene = {
  select(surfaceId: string | null): void;
  setLook(look: RoomLook): void;
  exportGlb(): Promise<ArrayBuffer>;
  dispose(): void;
};

const DISPLAY_THICKNESS_M = 0.08;
const DISPLAY_HEIGHT_M = 2.4;
const UNKNOWN = new THREE.Color('#f97316');

// Procedural finish textures (illustrative, not a product photo).
function finishTexture(finish: string): THREE.CanvasTexture {
  const kind = floorFinishKind(finish);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const plank = (base: [number, number, number], vary: number, gap: string) => {
    for (let row = 0; row < 16; row++) {
      for (let x = -((row * 173) % 512); x < 512; x += 300) {
        const k = 1 - vary / 2 + (vary * (((row * 7 + x) * 9301 + 49297) % 233280)) / 233280;
        g.fillStyle = `rgb(${base.map((v) => Math.round(v * k)).join(',')})`;
        g.fillRect(x, row * 32, 300, 32);
        g.fillStyle = gap;
        g.fillRect(x, row * 32, 2, 32);
      }
      g.fillStyle = gap;
      g.fillRect(0, row * 32, 512, 1);
    }
  };
  if (kind === 'wood') plank([176, 128, 82], 0.12, '#5b3d22');
  else if (kind === 'vinyl-plank') plank([170, 160, 146], 0.1, '#6b6258');
  else if (kind === 'tile') {
    g.fillStyle = '#d8d4cc';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#9b958a';
    for (let i = 0; i <= 512; i += 128) {
      g.fillRect(i, 0, 3, 512);
      g.fillRect(0, i, 512, 3);
    }
  } else if (kind === 'carpet') {
    g.fillStyle = '#b9ab98';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.05)`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
  } else {
    g.fillStyle = '#cfcac0';
    g.fillRect(0, 0, 512, 512);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Wall face in its own plane: x along the wall, y up. Doors (no sill) are
// notches in the outline; windows are holes.
function wallShape(w: ModelWall, height: number): THREE.Shape {
  const L = w.lengthM;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const spans = w.openings.map((o) => ({
    o,
    u0: clamp(o.alongM - o.widthM / 2, 0.01, L - 0.01),
    u1: clamp(o.alongM + o.widthM / 2, 0.01, L - 0.01),
  }));
  const doors = spans.filter((s) => (s.o.sillM ?? 0) <= 0.01).sort((a, b) => a.u0 - b.u0);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  let at = 0;
  for (const d of doors) {
    if (d.u0 <= at) continue;
    const top = Math.min(d.o.heightM, height - 0.02);
    shape.lineTo(d.u0, 0);
    shape.lineTo(d.u0, top);
    shape.lineTo(d.u1, top);
    shape.lineTo(d.u1, 0);
    at = d.u1;
  }
  shape.lineTo(L, 0);
  shape.lineTo(L, height);
  shape.lineTo(0, height);
  shape.lineTo(0, 0);
  for (const s of spans.filter((x) => (x.o.sillM ?? 0) > 0.01)) {
    const v0 = Math.min(s.o.sillM!, height - 0.05);
    const v1 = Math.min(v0 + s.o.heightM, height - 0.02);
    const hole = new THREE.Path();
    hole.moveTo(s.u0, v0);
    hole.lineTo(s.u1, v0);
    hole.lineTo(s.u1, v1);
    hole.lineTo(s.u0, v1);
    hole.lineTo(s.u0, v0);
    shape.holes.push(hole);
  }
  return shape;
}

export function mountRoomScene(
  host: HTMLElement,
  model: RoomModel,
  surfaces: RoomSurface[],
  look: RoomLook,
  onSelect: (surfaceId: string | null) => void,
  meta: { sourceEvidenceId: string | null; title: string },
): RoomScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'room3d-labels';
  host.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eef1f4');
  const room = new THREE.Group();
  room.name = meta.title;
  room.userData = {
    renovagent: {
      units: 'm',
      verified: false,
      format: model.format,
      storey: model.storey,
      sourceEvidenceId: meta.sourceEvidenceId,
      note: 'Measured geometry from a plan or measurements; not verified. Not for construction.',
    },
  };
  scene.add(room);
  const bySurface = new Map(surfaces.map((s) => [s.id, s]));
  const pickable: THREE.Mesh[] = [];
  const tag = (mesh: THREE.Mesh, surfaceId: string, extra: Record<string, unknown> = {}) => {
    const s = bySurface.get(surfaceId);
    mesh.name = s?.label ?? surfaceId;
    mesh.userData = {
      surfaceId,
      renovagent: {
        kind: s?.kind,
        geometry: s?.geometry,
        requirements: s?.links.map((l) => l.requirementId) ?? [],
        ...extra,
      },
    };
    pickable.push(mesh);
  };

  const pts = model.walls.flatMap((w) => [w.a, w.b]);
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const center = new THREE.Vector3((minX + maxX) / 2, 0, (minY + maxY) / 2);
  const span = Math.max(maxX - minX, maxY - minY, 2);

  const wallMat = new THREE.MeshStandardMaterial({
    color: wallSwatch(look.wallColor).hex,
    roughness: 0.9,
  });
  const unknownMat = new THREE.MeshStandardMaterial({
    color: UNKNOWN,
    roughness: 0.9,
    transparent: true,
    opacity: 0.45,
  });
  model.walls.forEach((w) => {
    const height = w.heightM ?? DISPLAY_HEIGHT_M;
    const thickness = w.thicknessM ?? DISPLAY_THICKNESS_M;
    const geometry = new THREE.ExtrudeGeometry(wallShape(w, height), {
      depth: thickness,
      bevelEnabled: false,
    });
    const known = w.heightM !== null && !w.curved;
    const mesh = new THREE.Mesh(geometry, known ? wallMat : unknownMat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.z = -thickness / 2;
    const group = new THREE.Group();
    group.position.set(w.a[0], 0, w.a[1]);
    group.rotation.y = -Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]);
    group.add(mesh);
    room.add(group);
    tag(mesh, `wall:${w.id}`, {
      heightMeasured: w.heightM !== null,
      thicknessMeasured: w.thicknessM !== null,
      displayOnly: {
        ...(w.heightM === null ? { heightM: DISPLAY_HEIGHT_M } : {}),
        ...(w.thicknessM === null ? { thicknessM: DISPLAY_THICKNESS_M } : {}),
      },
    });
    const label = document.createElement('div');
    label.className = 'room3d-dim';
    label.textContent = dimensionLabel(w.lengthM);
    const obj = new CSS2DObject(label);
    obj.position.set((w.a[0] + w.b[0]) / 2, height + 0.15, (w.a[1] + w.b[1]) / 2);
    room.add(obj);
  });

  const outline = floorOutline(model);
  const floorPts = outline ?? [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
  const floorShape = new THREE.Shape(floorPts.map(([x, y]) => new THREE.Vector2(x, -y)));
  const floorGeo = new THREE.ShapeGeometry(floorShape);
  floorGeo.rotateX(-Math.PI / 2);
  const floorTex = finishTexture(look.floorFinish);
  floorTex.repeat.set(1 / 2.4, 1 / 2.4);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  // Shape UVs are in metres; one texture tile covers 2.4 m.
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  room.add(floor);
  tag(floor, 'floor', { outlineMeasured: outline !== null });

  model.fixtures.forEach((f) => {
    const h = f.heightM ?? 0.4;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(f.widthM, h, f.depthM),
      new THREE.MeshStandardMaterial({
        color: '#dfe3e8',
        roughness: 0.6,
        transparent: true,
        opacity: 0.92,
      }),
    );
    mesh.position.set(f.center[0], h / 2, f.center[1]);
    mesh.rotation.y = -f.rotationRad;
    mesh.castShadow = true;
    room.add(mesh);
    tag(mesh, `fixture:${f.id}`, {
      category: f.category,
      existing: true,
      heightMeasured: f.heightM !== null,
    });
    const label = document.createElement('div');
    label.className = 'room3d-fixture';
    label.textContent = f.category;
    const obj = new CSS2DObject(label);
    obj.position.set(f.center[0], h + 0.1, f.center[1]);
    room.add(obj);
  });

  scene.add(new THREE.HemisphereLight('#ffffff', '#b9b1a3', 1.4));
  const sun = new THREE.DirectionalLight('#fff3e0', 2.2);
  sun.position.set(center.x + span, span * 1.6, center.z + span * 0.6);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -span;
  sc.right = sc.top = span;
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  camera.position.set(center.x + span * 0.9, span * 1.1, center.z + span * 1.1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center).setY(1);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();

  // The selected mesh gets a highlighted copy of its material; deselecting
  // restores the shared one, so look changes reach every surface.
  let selected: { mesh: THREE.Mesh; shared: THREE.Material } | null = null;
  const highlight = (mesh: THREE.Mesh | null) => {
    if (selected) {
      (selected.mesh.material as THREE.Material).dispose();
      selected.mesh.material = selected.shared;
    }
    selected = null;
    if (!mesh) return;
    const shared = mesh.material as THREE.MeshStandardMaterial;
    const lit = shared.clone();
    lit.emissive.set('#1d4ed8');
    lit.emissiveIntensity = 0.35;
    mesh.material = lit;
    selected = { mesh, shared };
  };
  const ray = new THREE.Raycaster();
  let down: [number, number] | null = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
  el.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = el.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      ),
      camera,
    );
    const hit = ray.intersectObjects(pickable, false)[0]?.object as THREE.Mesh | undefined;
    highlight(hit ?? null);
    onSelect(hit ? (hit.userData.surfaceId as string) : null);
  });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  loop();

  return {
    select(surfaceId) {
      highlight(pickable.find((m) => m.userData.surfaceId === surfaceId) ?? null);
    },
    setLook(next) {
      const reselect = selected?.mesh ?? null;
      highlight(null);
      wallMat.color.set(wallSwatch(next.wallColor).hex);
      const tex = finishTexture(next.floorFinish);
      tex.repeat.copy(floorTex.repeat);
      floorMat.map?.dispose();
      floorMat.map = tex;
      floorMat.needsUpdate = true;
      room.userData.renovagent.look = next;
      highlight(reselect);
    },
    async exportGlb() {
      const result = await new GLTFExporter().parseAsync(room, { binary: true, onlyVisible: true });
      return result as ArrayBuffer;
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}
