import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './camera-controls.css';

// View controls never change the room, furniture placements or render signature.
export function attachCameraControls(
  host: HTMLElement,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  canMove: boolean,
  finishDrag: () => void,
  floorSize: { width: number; depth: number; wallHeight: number },
) {
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  const moving = canMove;
  const bar = document.createElement('div');
  bar.className = 'room3d-camera';
  const group = (label: string) => {
    const el = document.createElement('div');
    el.className = 'room3d-camera-group';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', label);
    bar.append(el);
    return el;
  };
  const button = (parent: HTMLElement, label: string, text: string, action: () => void) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.title = label;
    el.setAttribute('aria-label', label);
    el.textContent = text;
    el.addEventListener('click', action);
    parent.append(el);
    return el;
  };
  if (controls.domElement) {
    controls.domElement.style.cursor = moving ? 'move' : 'grab';
    controls.domElement.title = moving
      ? 'Drag furniture to move it. Use the camera buttons to turn the view.'
      : 'Drag to turn the room. Pinch or scroll to zoom.';
  }

  const views = group('Room camera');
  const changeView = (change: () => void) => {
    finishDrag();
    // Drain gesture damping before applying a button view, so reset/top do not drift.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    change();
    controls.update();
    controls.enableDamping = damping;
  };
  const turn = (angle: number) =>
    changeView(() => {
      const offset = camera.position.clone().sub(controls.target);
      const orbit = new THREE.Spherical().setFromVector3(offset);
      orbit.theta += angle;
      // A turn from top view returns to an angle where the room's sides are visible.
      if (orbit.phi < 0.05) {
        orbit.phi = Math.PI / 4;
        orbit.radius = startPosition.distanceTo(startTarget);
        controls.target.copy(startTarget);
      }
      camera.position.copy(controls.target).add(offset.setFromSpherical(orbit));
    });
  const turnIcon = (el: HTMLButtonElement, mirror: boolean) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', 'M3 10a9 9 0 1 1 2.64 8.36M3 4v6h6');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.7');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    if (mirror) path.setAttribute('transform', 'translate(24 0) scale(-1 1)');
    svg.append(path);
    el.replaceChildren(svg);
  };
  turnIcon(
    button(views, 'Rotate view left 45 degrees', '', () => turn(-Math.PI / 4)),
    false,
  );
  turnIcon(
    button(views, 'Rotate view right 45 degrees', '', () => turn(Math.PI / 4)),
    true,
  );
  const zoom = (factor: number) =>
    changeView(() => {
      const offset = camera.position.clone().sub(controls.target);
      const length = Math.min(
        controls.maxDistance,
        Math.max(controls.minDistance, offset.length() * factor),
      );
      camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(length));
    });
  button(views, 'Zoom in', '+', () => zoom(0.85));
  button(views, 'Zoom out', '−', () => zoom(1 / 0.85));
  button(views, 'Top view', 'Top', () =>
    changeView(() => {
      // Fit the floor in both dimensions, with breathing room for the controls.
      const reserved = Math.min((bar.offsetWidth + 24) / Math.max(host.clientWidth, 1), 0.35);
      const extent = Math.max(floorSize.depth, floorSize.width / ((1 - reserved) * camera.aspect));
      const halfFov = Math.tan((camera.fov * Math.PI) / 360);
      const distance = (extent / (2 * halfFov)) * 1.1 + floorSize.wallHeight;
      controls.maxDistance = Math.max(controls.maxDistance, distance * 1.1);
      controls.target.copy(startTarget).setY(0);

      const orbit = new THREE.Spherical(distance, 0.001, 0);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(orbit));
    }),
  );
  button(views, 'Reset room view', 'Reset', () =>
    changeView(() => {
      controls.target.copy(startTarget);
      camera.position.copy(startPosition);
    }),
  );
  host.append(bar);
  return { isMoving: () => moving, dispose: () => bar.remove() };
}
