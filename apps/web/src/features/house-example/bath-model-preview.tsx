import { useEffect, useRef, useState } from 'react';

// Illustrative fixture arrangement. Display transforms never supply site measurements.
export type ModelPins = Record<
  'vanity' | 'mirror' | 'floor' | 'paint' | 'window',
  readonly [number, number]
>;
export function BathModelPreview({
  floating,
  grayTile,
  onPins,
}: {
  floating: boolean;
  grayTile: boolean;
  onPins: (pins: ModelPins) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    setState('loading');
    let stopped = false;
    let dispose = () => {};
    void (async () => {
      const T = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      if (!host.current || stopped) return;
      const el = host.current;
      const scene = new T.Scene();
      scene.background = new T.Color('#ddd9ce');
      const renderer = new T.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      el.appendChild(renderer.domElement);
      const camera = new T.PerspectiveCamera(42, 1, 0.01, 30);
      camera.position.set(2.6, 2.8, 4);
      camera.lookAt(0, 0.95, 0);
      const materials = new Set<import('three').Material>();
      const textures = new Set<import('three').Texture>();
      const geometries = new Set<import('three').BufferGeometry>();
      function track(root: import('three').Object3D) {
        root.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            materials.add(material);
            for (const value of Object.values(material)) {
              if (value instanceof T.Texture) textures.add(value);
            }
          }
        });
      }
      let observer: ResizeObserver | undefined;
      dispose = () => {
        observer?.disconnect();
        renderer.dispose();
        renderer.domElement.remove();
        for (const geometry of geometries) geometry.dispose();
        for (const material of materials) material.dispose();
        for (const texture of textures) texture.dispose();
      };
      scene.add(new T.HemisphereLight('#ffffff', '#807767', 3));
      const sun = new T.DirectionalLight('#fff6e0', 4);
      sun.position.set(1, 5, 4);
      scene.add(sun);
      const loader = new GLTFLoader();
      const meshes = await Promise.all([
        loader.loadAsync('./furniture/kenney/bathroomCabinet.glb'),
        loader.loadAsync('./furniture/kenney/bathroomSinkSquare.glb'),
        loader.loadAsync('./furniture/kenney/toilet.glb'),
        loader.loadAsync('./furniture/kenney/bathtub.glb'),
      ]);
      for (const mesh of meshes) track(mesh.scene);
      if (stopped) {
        dispose();
        return;
      }
      function box(size: [number, number, number], at: [number, number, number], color: string) {
        const mesh = new T.Mesh(
          new T.BoxGeometry(...size),
          new T.MeshStandardMaterial({ color, roughness: 0.75 }),
        );
        mesh.position.set(...at);
        scene.add(mesh);
        track(mesh);
        return mesh;
      }
      // Plan-based envelope, with explicitly schematic fixture positions.
      const width = 76 * 0.0254,
        depth = 68 * 0.0254;
      const floor = box([width, 0.035, depth], [0, -0.018, 0], '#bfc0b6');
      box([width, 2.4384, 0.045], [0, 1.2192, -depth / 2], '#ded8ca');
      box([0.045, 2.4384, depth], [-width / 2, 1.2192, 0], '#e7e1d5');
      box([0.54, 0.45, 0.06], [0.52, 1.92, -depth / 2 + 0.03], '#eff6f7');
      box([0.56, 0.47, 0.025], [0.52, 1.92, -depth / 2 + 0.065], '#f7f7ec');
      box([0.48, 0.39, 0.035], [0.52, 1.92, -depth / 2 + 0.09], '#d5e6e9');
      const mirror = box([0.61, 0.62, 0.045], [-0.59, 1.46, -depth / 2 + 0.045], '#bac7ca');
      mirror.material.metalness = 0.65;
      mirror.material.roughness = 0.13;
      for (const x of [-0.7, -0.49])
        box([0.006, 0.62, 0.005], [x, 1.46, -depth / 2 + 0.07], '#f0f0e8');

      function fixture(
        index: number,
        size: [number, number, number],
        at: [number, number, number],
        color?: string,
      ) {
        const root = meshes[index].scene;
        const bounds = new T.Box3().setFromObject(root);
        const sourceSize = bounds.getSize(new T.Vector3());
        if (Math.min(sourceSize.x, sourceSize.y, sourceSize.z) <= 0)
          throw Error('Invalid fixture bounds');
        const centered = new T.Group();
        root.position.sub(bounds.getCenter(new T.Vector3()));
        centered.add(root);
        centered.scale.set(size[0] / sourceSize.x, size[1] / sourceSize.y, size[2] / sourceSize.z);
        centered.position.set(...at);
        if (color)
          root.traverse((object) => {
            if (!(object instanceof T.Mesh)) return;
            object.material = new T.MeshStandardMaterial({ color, roughness: 0.65 });
          });
        track(centered);
        scene.add(centered);
      }
      fixture(
        0,
        [0.6, floating ? 0.4 : 0.75, 0.43],
        [-0.59, floating ? 0.59 : 0.375, -0.58],
        floating ? '#b4824e' : '#f4f3e8',
      );
      fixture(1, [0.62, 0.13, 0.47], [-0.59, 0.83, -0.57]);
      fixture(2, [0.37, 0.8, 0.66], [0.04, 0.4, -0.46]);
      fixture(3, [0.66, 0.5, 1.55], [0.63, 0.25, 0.01]);
      const texture = await new T.TextureLoader().loadAsync(
        './examples/hutchinson/material-samples/' +
          (grayTile ? 'ambientcg-tiles074.webp' : 'poly-haven-interior-tiles.webp'),
      );
      textures.add(texture);
      if (stopped) {
        dispose();
        return;
      }
      texture.colorSpace = T.SRGBColorSpace;
      floor.material.map = texture;
      floor.material.needsUpdate = true;
      const render = () => {
        if (!el.clientWidth || !el.clientHeight) return;
        renderer.setSize(el.clientWidth, el.clientHeight);
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        const project = (point: [number, number, number]): readonly [number, number] => {
          const projected = new T.Vector3(...point).project(camera);
          return [(projected.x + 1) * 50, (1 - projected.y) * 50];
        };
        onPins({
          vanity: project([-0.59, 0.68, -0.35]),
          mirror: project([-0.59, 1.46, -0.78]),
          floor: project([0, 0.02, 0.55]),
          paint: project([-0.94, 1.65, 0.1]),
          window: project([0.52, 1.92, -0.75]),
        });
      };
      observer = new ResizeObserver(render);
      observer.observe(el);
      render();
      setState('ready');
    })().catch(() => {
      dispose();
      if (!stopped) setState('error');
    });
    return () => {
      stopped = true;
      dispose();
    };
  }, [floating, grayTile, onPins]);
  return (
    <div
      className="bath-model-preview"
      ref={host}
      role="img"
      aria-label={
        floating
          ? 'Schematic bathroom with floating oak vanity and sink'
          : 'Schematic bathroom with white floor-standing vanity and sink'
      }
    >
      {state !== 'ready' && (
        <span className="bath-model-status" role="status">
          {state === 'error'
            ? '3D preview unavailable. The existing photo and product links are available.'
            : 'Loading room model…'}
        </span>
      )}
    </div>
  );
}
