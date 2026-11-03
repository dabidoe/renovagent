import { useEffect, useState } from 'react';
import { dimensionLabel, roomSurfaces, studioRoomBounds, type RoomModel } from '@renovagent/core';
import type { StudioPlacement } from '@renovagent/contracts';
import { Modal } from '../../components/modal.js';
import { SystemsDiagram } from './systems-diagram.js';
import './systems-diagram.css';

export function RoomDiagram({
  model,
  placements,
  title,
  sizeEstimated,
}: {
  model: RoomModel | null;
  placements: StudioPlacement[];
  title: string;
  sizeEstimated: boolean;
}) {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [exampleOpen, setExampleOpen] = useState(false);
  const bounds = model ? studioRoomBounds(model) : null;
  // Parent arrays are recreated during ordinary studio renders. Only changed
  // geometry/placements should generate a fresh drawing.
  const signature = JSON.stringify({ model, placements, title });
  useEffect(() => {
    let live = true;
    let url = '';
    setImage('');
    setError('');
    if (!model) return;
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;left:-10000px;top:0;width:640px;height:480px;pointer-events:none';
    document.body.append(host);
    void (async () => {
      let scene: import('../room3d/room-scene.js').RoomScene | undefined;
      try {
        const { mountRoomScene } = await import('../room3d/room-scene.js');
        if (!live) return;
        scene = mountRoomScene(
          host,
          model,
          roomSurfaces(model, null),
          { wallColor: '#ffffff', floorFinish: 'plain', label: 'Line drawing' },
          () => {},
          { title, sourceEvidenceId: null, renderActions: false, placements },
        );
        const blob = await scene.captureTopDown();
        if (live) {
          url = URL.createObjectURL(blob);
          setImage(url);
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Could not draw this room.');
      } finally {
        scene?.dispose();
        host.remove();
      }
    })();
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
      host.remove();
    };
    // Inputs are fully represented by the signature, including room identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return (
    <section className="room-diagram" aria-label="Current room diagram">
      <div className="systems-example-heading">
        <div>
          <p className="systems-kicker">YOUR ROOM · TOP-DOWN DRAWING</p>
          <h2>{title}</h2>
          <p>The same room and placed objects, drawn in lines.</p>
        </div>
        <span className="systems-coming-soon">
          Diagram editor <b>Coming soon</b>
        </span>
      </div>
      <div className="room-diagram-toolbar">
        <span>
          {bounds
            ? `${dimensionLabel(bounds.maxX - bounds.minX)} × ${dimensionLabel(bounds.maxZ - bounds.minZ)} overall`
            : ''}
        </span>
        <button
          type="button"
          className="room-diagram-example-link"
          onClick={() => setExampleOpen(true)}
        >
          Example bathroom ↗
        </button>
      </div>
      {!model ? (
        <p className="pf-layout-empty">Add room dimensions to create a drawing of this room.</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : image ? (
        <>
          <figure className="room-diagram-sheet">
            <img src={image} alt={`Top-down line drawing of ${title}`} />
            <figcaption>
              {placements.length} placed {placements.length === 1 ? 'object' : 'objects'} ·{' '}
              {sizeEstimated ? 'Estimated room size' : 'Entered room dimensions'} · Editable concept
              objects
            </figcaption>
          </figure>
          <div className="room-diagram-actions">
            <a
              className="pf-design-download"
              href={image}
              download={`${
                title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '') || 'room'
              }-top-down.png`}
            >
              Save drawing · PNG
            </a>
            <span>Arrange objects in Furnishings to update this drawing.</span>
          </div>
        </>
      ) : (
        <p role="status" className="pf-layout-empty">
          Drawing your room…
        </p>
      )}
      {exampleOpen && (
        <Modal
          title="Example bathroom"
          className="room-diagram-example-modal"
          onClose={() => setExampleOpen(false)}
        >
          <SystemsDiagram />
        </Modal>
      )}
    </section>
  );
}
