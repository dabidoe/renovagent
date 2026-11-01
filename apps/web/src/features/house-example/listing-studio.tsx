import { useEffect, useState } from 'react';
import { Glyph } from '../../components/glyph.js';
import { PaintFloorStudio } from './paint-floor-studio.js';
import type { HouseProject, StudioRoom } from './paint-floor.js';

// Curated listing examples, prepared once by scripts/prepare-listing-example.ts
// from images the owner saved from a listing they chose to feature.
type ExampleCard = { route: string; address: string; place: string; cover: string; rooms: number };
export const EXAMPLES: ExampleCard[] = [
  {
    route: '#example-house',
    address: '2440 S Hutchinson St',
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
    fetch(`./examples/${id}/project.json`)
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
  if (error) return <p className="pf-empty">{error}</p>;
  if (!project) return null;
  // The viewer may fill in what the listing does not say.
  const shown: HouseProject = {
    ...project,
    ceilingFt: edits.ceilingFt ?? project.ceilingFt ?? null,
    ...(edits.ceilingFt
      ? { ceilingNote: undefined }
      : project.ceilingNote
        ? { ceilingNote: project.ceilingNote }
        : {}),
    rooms: project.rooms.map((r): StudioRoom => {
      const size = r.size ?? edits.sizes?.[r.id];
      return size ? { ...r, size } : r;
    }),
  };
  return (
    <PaintFloorStudio
      project={shown}
      kicker="Example from a real listing · try any change; it isn’t saved"
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
            <a href={`./examples/${id}/project.json`} target="_blank" rel="noreferrer">
              project.json
            </a>
            ).
          </li>
          <li>
            Quantities: the living-room recipe (2 coats; openings not deducted). Prices: an example
            catalog for this demo, not live offers. Labour is quoted separately.
          </li>
        </ul>
      }
    />
  );
}

export function ExamplesGallery({ onOpen }: { onOpen: (route: string) => void }) {
  return (
    <section className="pf-gallery" aria-label="Listing examples">
      <p className="pf-kicker">Examples</p>
      <h1>From a listing to a plan.</h1>
      <p className="pf-sub">
        Real listings, read room by room: before and after, paint and floors, and what it costs.
      </p>
      <div className="pf-cards">
        {EXAMPLES.map((e) => (
          <button key={e.route} type="button" className="pf-card" onClick={() => onOpen(e.route)}>
            <img src={e.cover} alt="" loading="lazy" />
            <span>
              <b>{e.address}</b>
              <small>
                {e.place} · {e.rooms} rooms
              </small>
            </span>
          </button>
        ))}
        <button type="button" className="pf-card is-own" onClick={() => onOpen('#your-project')}>
          <Glyph name="plus" />
          <span>
            <b>Your project</b>
            <small>Your photos and floor plan</small>
          </span>
        </button>
      </div>
    </section>
  );
}
