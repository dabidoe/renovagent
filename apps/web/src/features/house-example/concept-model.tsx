import { useEffect, useRef, useState } from 'react';

// Display-only listing concept. No geometry in this canvas writes measurements
// or supplies a quantity calculation to the project.
export function ConceptModel() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stopped = false;
    let dispose = () => {};
    void (async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (stopped || !host.current) return;
      const element = host.current;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0xf1f3ee, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x65715a, 2.5));
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(5, 10, 5);
      scene.add(light);
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 500);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI / 2.05;
      let frame = 0;
      const observer = new ResizeObserver(() => {
        if (!element.clientWidth || !element.clientHeight) return;
        renderer.setSize(element.clientWidth, element.clientHeight);
        camera.aspect = element.clientWidth / element.clientHeight;
        camera.updateProjectionMatrix();
      });
      observer.observe(element);
      dispose = () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        controls.dispose();
        renderer.dispose();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) material.dispose();
          }
        });
        renderer.domElement.remove();
      };
      const gltf = await new GLTFLoader().loadAsync('./examples/hutchinson/hutchinson-concept.glb');
      if (stopped) {
        gltf.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
        return;
      }
      scene.add(gltf.scene);
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const distance = Math.max(size.x, size.y, size.z) * 1.5;
      camera.position
        .copy(center)
        .add(new THREE.Vector3(0.65, 0.8, 0.8).normalize().multiplyScalar(distance));
      controls.target.copy(center);
      controls.minDistance = distance * 0.4;
      controls.maxDistance = distance * 2.5;
      controls.update();
      renderer.setSize(element.clientWidth, element.clientHeight);
      camera.aspect = element.clientWidth / element.clientHeight;
      camera.updateProjectionMatrix();
      const draw = () => {
        if (stopped) return;
        controls.update();
        renderer.render(scene, camera);
        frame = requestAnimationFrame(draw);
      };
      draw();
    })().catch((e) => {
      if (!stopped) {
        dispose();
        console.warn('Unable to load the concept model', e);
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      stopped = true;
      dispose();
    };
  }, [attempt]);
  return error ? (
    <div className="house-model-fallback">
      <img
        src="./examples/hutchinson/blender-reference.png"
        alt="Blender ground-floor concept reference"
      />
      <span>Showing the saved Blender reference. Interactive 3D is unavailable.</span>
      <button
        type="button"
        className="house-text-button"
        onClick={() => {
          setError('');
          setAttempt((value) => value + 1);
        }}
      >
        Retry interactive view
      </button>
    </div>
  ) : (
    <div
      ref={host}
      className="house-model"
      aria-label="Orbit the listing-derived ground-floor concept"
    />
  );
}
