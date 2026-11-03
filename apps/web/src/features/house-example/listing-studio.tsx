import { studioDirection } from './studio-directions.js';
import { thumbnailUrl } from './ui-thumbnails.js';
import { directionDesign } from './direction-design.js';
import { EXAMPLE_ADDRESS } from './example-privacy.js';
import { useEffect, useMemo, useState } from 'react';
import { Glyph } from '../../components/glyph.js';
import { PaintFloorStudio } from './paint-floor-studio.js';
import type { HouseProject, StudioRoom } from './paint-floor.js';

// Curated listing examples, prepared once by scripts/prepare-listing-example.ts
// from images the owner saved from a listing they chose to feature.
type ExampleCard = {
  route: string;
  address: string;
  place: string;
  cover: string;
  rooms?: number;
};
export const EXAMPLES: ExampleCard[] = [
  {
    route: '#example-house',
    address: EXAMPLE_ADDRESS,
    place: 'Philadelphia rowhouse',
    cover: './examples/hutchinson/rooms/photo-04-lvp.jpg',
    rooms: 5,
  },
  {
    route: '#example/oakland',
    address: '2244 E 20th St',
    place: 'Oakland, CA',
    cover: './examples/oakland/image-01-lvp.jpg',
    rooms: 6,
  },
  {
    route: '#example/brooklyn',
    address: '621 E 43rd St',
    place: 'Brooklyn, NY',
    cover: './examples/brooklyn/image-03-lvp.jpg',
    rooms: 5,
  },
  {
    route: '#example/bedroom-refresh',
    address: 'Bedroom refresh',
    place: 'From a saved Pinterest pin',
    cover: './examples/bedroom-refresh/after.jpg',
  },
];

type Edits = { ceilingFt?: number; sizes?: Record<string, { xFt: number; yFt: number }> };
const editStore = (id: string) => `renovagent.example.${id}.edits.v1`;
function loadEdits(id: string): Edits {
  try {
    return (JSON.parse(localStorage.getItem(editStore(id)) || 'null') as Edits) ?? {};
  } catch {
    return {};
  }
}

export function ListingStudio({ id, onBack }: { id: string; onBack: () => void }) {
  const [project, setProject] = useState<(HouseProject & { receipts?: unknown }) | null>(null);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState<Edits>(() => loadEdits(id));
  useEffect(() => {
    let live = true;
    fetch(`./examples/${studioDirection(id) ? 'oakland' : id}/project.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('This example is not available.'))))
      .then((p) => live && setProject(p))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [id]);
  const save = (next: Edits) => {
    setEdits(next);
    try {
      localStorage.setItem(editStore(id), JSON.stringify(next));
    } catch {
      // The edit still applies for this visit.
    }
  };
  const direction = studioDirection(id);
  const seed = useMemo(
    () => (project && direction ? directionDesign(project, direction) : undefined),
    [project, direction],
  );
  if (error) return <p className="pf-empty">{error}</p>;
  if (!project) return null;
  // The viewer may fill in what the listing does not say.
  const base = seed?.project ?? project;
  const shown: HouseProject = {
    ...base,
    ceilingFt: edits.ceilingFt ?? base.ceilingFt ?? null,
    ...(edits.ceilingFt
      ? { ceilingNote: undefined }
      : project.ceilingNote
        ? { ceilingNote: project.ceilingNote }
        : {}),
    rooms: base.rooms.map((r): StudioRoom => {
      const reported = edits.sizes?.[r.id];
      const size = reported ?? r.size;
      return size ? { ...r, size, ...(reported ? { sizeNote: undefined } : {}) } : r;
    }),
  };
  return (
    <PaintFloorStudio
      project={shown}
      initialDesign={seed}
      kicker={
        direction
          ? 'Muse photo concept · editable 3D starter · changes stay in this browser'
          : 'Listing example · changes stay in this browser'
      }
      onEditRoom={(roomId, patch) =>
        patch.size && save({ ...edits, sizes: { ...edits.sizes, [roomId]: patch.size } })
      }
      onCeiling={(ceilingFt) => save({ ...edits, ceilingFt })}
      actions={
        <button type="button" className="pf-reset" onClick={onBack}>
          All examples
        </button>
      }
      sources={
        <ul>
          {direction && (
            <li>
              Prepared Muse Image photo concept. The 3D view is an editable starter arrangement, not
              a reconstruction of the photograph. Furniture is illustrative; dimensions, fit and
              products need confirming.
            </li>
          )}
          <li>
            Photos{project.listing ? ' and plans' : ''}:{' '}
            {project.listing ? (
              <a href={project.listing} target="_blank" rel="noreferrer">
                the public listing
              </a>
            ) : (
              'the listing'
            )}
            , saved by the owner of this demo.
          </li>
          <li>
            Rooms and printed plan sizes: read by Muse Spark. Wall outlines: SAM 3.1. New floors:
            Muse Image edits of each photo (receipts in{' '}
            <a
              href={`./examples/${direction ? 'oakland' : id}/project.json`}
              target="_blank"
              rel="noreferrer"
            >
              project.json
            </a>
            ).
          </li>
          <li>
            Quantities: the living-room recipe (2 coats; openings not deducted). Prices: an example
            catalog for this demo, not live offers. Labor is quoted separately.
          </li>
        </ul>
      }
    />
  );
}

export function ExamplesGallery({ onOpen }: { onOpen: (route: string) => void }) {
  return (
    <section className="pf-gallery" aria-label="Listing examples">
      <h1>From a listing to a plan.</h1>
      <p className="pf-sub">
        Real listings, priced room by room. Plus a room restyled from a saved pin.
      </p>
      <div className="pf-cards">
        <button type="button" className="pf-card is-own" onClick={() => onOpen('#your-project')}>
          <Glyph name="plus" />
          <span>
            <b>Your project</b>
            <small>Your photos and floor plan</small>
          </span>
        </button>
        {EXAMPLES.map((e) => (
          <button key={e.route} type="button" className="pf-card" onClick={() => onOpen(e.route)}>
            <img src={thumbnailUrl(e.cover)} alt="" loading="lazy" />
            <span>
              <b>{e.address}</b>
              <small>
                {e.place}
                {e.rooms ? ` · ${e.rooms} rooms` : ''}
              </small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
