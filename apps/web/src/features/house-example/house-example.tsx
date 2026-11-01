import { useEffect, useRef, useState } from 'react';
import type { Workspace } from '@renovagent/contracts';
import { Glyph } from '../../components/glyph.js';
import { Modal } from '../../components/modal.js';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { hutchinsonCorpus as corpus } from './hutchinson-corpus.js';
import { ConceptModel } from './concept-model.js';
import {
  houseAreas,
  houseBrief,
  scopeForArea,
  HOUSE_CHOICES_NAME,
  parseHouseChoices,
  saveHouseCase,
  type AreaId,
  type HouseChoices,
} from './house-example-model.js';

type Stage = 'photo' | 'outline' | 'plan' | 'model' | 'look';
type Panel = 'plan' | 'sources' | null;
type Segmentation = {
  model: string;
  runId: string;
  photoId: string;
  width: number;
  height: number;
  segments: {
    id: string;
    path: string;
    scaleX: number;
    scaleY: number;
    box: { left: number; top: number };
  }[];
};
const asset = (name: string) => `./examples/hutchinson/${name}`;
const photoSrc = (id: string) => asset(`${id}.jpg`);
const roomDirection: Record<
  AreaId,
  { title: string; changes: { icon: string; title: string; detail: string }[] }
> = {
  living: {
    title: 'A lighter, more connected living space.',
    changes: [
      {
        icon: 'layers',
        title: 'A new floor',
        detail: 'Carpet out. Finish, trim and transitions together.',
      },
      {
        icon: 'paint',
        title: 'Fresh walls',
        detail: 'Repairs, preparation and a coordinated palette.',
      },
    ],
  },
  kitchen: {
    title: 'Keep the layout. Refine the details.',
    changes: [
      {
        icon: 'materials',
        title: 'Keep what works',
        detail: 'Review the cabinets, counters and appliances.',
      },
      {
        icon: 'paint',
        title: 'A targeted refresh',
        detail: 'Compare finishes, hardware and lighting.',
      },
      {
        icon: 'home',
        title: 'Preserve access',
        detail: 'Work around the rear door and retained services.',
      },
    ],
  },
  bedrooms: {
    title: 'One palette, throughout upstairs.',
    changes: [
      {
        icon: 'paint',
        title: 'Walls & ceilings',
        detail: 'Inspect the coverings, then plan preparation.',
      },
      {
        icon: 'layers',
        title: 'Connected finishes',
        detail: 'Coordinate floors, trim and paint between rooms.',
      },
      {
        icon: 'home',
        title: 'Keep the room working',
        detail: 'Retain access to closets, radiators and windows.',
      },
    ],
  },
  bathroom: {
    title: 'Choose what stays. Improve the rest.',
    changes: [
      {
        icon: 'pipe',
        title: 'Fixtures & fittings',
        detail: 'Review the existing bath before replacing anything.',
      },
      {
        icon: 'tile',
        title: 'Surfaces & wet areas',
        detail: 'Separate cosmetic changes from assembly work.',
      },
      {
        icon: 'materials',
        title: 'Complete replacements',
        detail: 'Include compatible parts for each chosen change.',
      },
    ],
  },
  basement: {
    title: 'Understand the services first.',
    changes: [
      {
        icon: 'home',
        title: 'Condition & moisture',
        detail: 'Survey before choosing new finishes.',
      },
      {
        icon: 'pipe',
        title: 'Services & access',
        detail: 'Keep the laundry, meter and existing bath accessible.',
      },
      {
        icon: 'plan',
        title: 'Possible service routes',
        detail: 'Investigate connections for the proposed work.',
      },
    ],
  },
  exterior: {
    title: 'Keep the weather outside.',
    changes: [
      {
        icon: 'home',
        title: 'Roof & facade',
        detail: 'Review the envelope, openings and drainage.',
      },
      {
        icon: 'materials',
        title: 'Repair where needed',
        detail: 'Let current condition guide the assemblies.',
      },
      {
        icon: 'layers',
        title: 'Coordinate the work',
        detail: 'Plan access and protection alongside the refresh.',
      },
    ],
  },
};
export function HouseExample({
  state,
  controller,
  projectId,
  onFinishStudio,
  onTools,
}: {
  state: Workspace;
  controller: WorkspaceController;
  projectId?: string;
  onFinishStudio: () => void;
  onTools: () => void;
}) {
  const [areaId, setAreaId] = useState<AreaId>('living');
  const [photoId, setPhotoId] = useState('photo-04');
  const [stage, setStage] = useState<Stage>('photo');
  const [panel, setPanel] = useState<Panel>(null);
  const [choices, setChoices] = useState<HouseChoices>({ excluded: [], halfBath: true });
  const [sam, setSam] = useState<Segmentation | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const revealGallery = () =>
    requestAnimationFrame(() => gallery.current?.scrollIntoView({ block: 'nearest' }));
  const area = houseAreas.find((a) => a.id === areaId)!;
  const areaScope = scopeForArea(area, choices);
  const direction = roomDirection[areaId];
  const excluded = choices.excluded.includes(areaId);
  const photoIndex = area.photoIds.findIndex((id) => id === photoId);
  const toggleArea = (id: AreaId) =>
    revise({
      ...choices,
      excluded: choices.excluded.includes(id)
        ? choices.excluded.filter((value) => value !== id)
        : [...choices.excluded, id],
    });
  const photo = corpus.photos.find((p) => p.id === photoId)!;
  const regions = corpus.inventory.items.filter((item) => item.photoId === photoId);
  const canOutline = regions.length > 0 || sam?.photoId === photoId;
  const item = regions.find((r) => r.id === itemId);
  const dims = corpus.inventory.photos.find((p) => p.id === photoId);
  const samVisible = stage === 'outline' && sam?.photoId === photoId;
  const chosenAreas = houseAreas.filter((a) => !choices.excluded.includes(a.id));
  const attachments = Object.values(state.evidence).filter(
    (e) => e.projectId === projectId && !!e.source.attachment,
  );
  const savedChoices = attachments
    .filter((e) => e.source.attachment?.name === HOUSE_CHOICES_NAME)
    .at(-1);
  useEffect(() => {
    let live = true;
    void fetch(asset('sam-floor.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((value: Segmentation | null) => {
        if (live) setSam(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const id = savedChoices?.source.attachment?.blobId;
    if (!id || dirty) return;
    let live = true;
    void controller.repository
      .readBlob(id)
      .then(async (blob) => {
        if (blob && live) setChoices(parseHouseChoices(JSON.parse(await blob.text())));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [controller, savedChoices?.id, dirty]);
  const selectArea = (id: AreaId) => {
    const next = houseAreas.find((a) => a.id === id)!;
    setAreaId(id);
    setPhotoId(next.photoIds[0]);
    setItemId(null);
    if (
      stage === 'model' ||
      stage === 'look' ||
      (stage === 'outline' && !corpus.inventory.photos.some((p) => p.id === next.photoIds[0]))
    )
      setStage('photo');
  };
  const chooseStage = (next: Stage) => {
    if (next === 'model' || next === 'look') {
      setAreaId('living');
      setPhotoId('photo-04');
    }
    setStage(next);
    setItemId(null);
  };
  const revise = (next: HouseChoices) => {
    setChoices(next);
    setDirty(true);
    setNotice('');
  };
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const id = await saveHouseCase(controller, corpus, choices, projectId);
      setDirty(false);
      setNotice('Concept plan and source receipts saved to your project.');
      return id;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSaving(false);
    }
  };
  const downloadBrief = () => {
    const url = URL.createObjectURL(
      new Blob([houseBrief(corpus, choices)], { type: 'text/markdown' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Hutchinson - whole-house concept.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const openPipelineStage = (next: Stage) => {
    setAreaId('living');
    setPhotoId('photo-04');
    setStage(next);
    setItemId(null);
    setPanel(null);
    revealGallery();
  };
  const stageCaption =
    stage === 'model'
      ? 'Listing-derived ground-floor study · orbit to explore'
      : stage === 'look'
        ? 'Muse Image · concept generated from the Blender reference'
        : stage === 'plan'
          ? 'Original listing plan · reference dimensions'
          : samVisible
            ? 'SAM 3.1 · floor masks from this exact source photo'
            : stage === 'outline'
              ? 'Saved Muse region proposals · tap an outline'
              : 'Original listing photo';
  const scene = (
    <>
      <div
        className={`house-photo-stage is-${stage}`}
        style={
          stage === 'photo' || stage === 'outline'
            ? { aspectRatio: `${dims?.width ?? 1500} / ${dims?.height ?? 1000}` }
            : undefined
        }
      >
        <div className="house-canvas-toolbar">
          <div>
            <span>{stage === 'model' || stage === 'look' ? 'Ground-floor study' : area.level}</span>
            <strong>
              {stage === 'model'
                ? 'Ground-floor layout'
                : stage === 'look'
                  ? 'A possible new look'
                  : area.title}
            </strong>
          </div>
          <label className="house-view-picker">
            <Glyph name={stage === 'plan' || stage === 'model' ? 'plan' : 'photo'} />
            <span className="house-sr-only">Image view</span>
            <select
              aria-label="Image view"
              value={stage === 'outline' ? 'photo' : stage}
              onChange={(e) => chooseStage(e.target.value as Stage)}
            >
              <option value="photo">Photo</option>
              {areaId === 'living' && <option value="look">Concept</option>}
              <option value="plan">Floor plan</option>
              {areaId === 'living' && <option value="model">3D room</option>}
            </select>
            <Glyph name="chevron" />
          </label>
        </div>
        {stage === 'model' ? (
          <ConceptModel />
        ) : (
          <img
            src={
              stage === 'look'
                ? asset('muse-concept.png')
                : photoSrc(stage === 'plan' ? area.planId : photoId)
            }
            alt={
              stage === 'look'
                ? 'Muse-generated concept of the Hutchinson ground floor'
                : stage === 'plan'
                  ? `${area.title}: original listing floor plan`
                  : `${area.title}: ${photo.observations[0]}`
            }
            draggable={false}
          />
        )}
        {stage === 'outline' &&
          (samVisible ? (
            <svg viewBox={`0 0 ${sam.width} ${sam.height}`} aria-label="SAM floor segmentation">
              <g>
                {sam.segments.map((segment, index) => (
                  <path
                    key={segment.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect floor segment ${index + 1}`}
                    onClick={() =>
                      setItemId(regions.find((r) => r.category === 'floor')?.id ?? null)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setItemId(regions.find((r) => r.category === 'floor')?.id ?? null);
                      }
                    }}
                    d={segment.path}
                    transform={`translate(${segment.box.left} ${segment.box.top}) scale(${segment.scaleX} ${segment.scaleY})`}
                  />
                ))}
              </g>
            </svg>
          ) : (
            <svg
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              aria-label="Saved Muse object regions"
            >
              {regions.map((region) => (
                <polygon
                  key={region.id}
                  points={region.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                  role="button"
                  tabIndex={0}
                  aria-label={region.label}
                  className={itemId === region.id ? 'is-selected' : ''}
                  onClick={() => setItemId(region.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setItemId(region.id);
                    }
                  }}
                />
              ))}
            </svg>
          ))}
        <div className="house-canvas-actions">
          {(stage === 'photo' || stage === 'outline') && canOutline && (
            <button
              type="button"
              className="house-highlight"
              aria-pressed={stage === 'outline'}
              onClick={() => chooseStage(stage === 'outline' ? 'photo' : 'outline')}
            >
              <Glyph name="layers" />
              Highlight surfaces
            </button>
          )}
          {stage === 'model' && <span className="house-geometry-note">Schematic geometry</span>}
          {areaId === 'living' && (
            <button
              type="button"
              className="house-concept-button"
              onClick={() => chooseStage(stage === 'look' ? 'photo' : 'look')}
            >
              <Glyph name={stage === 'look' ? 'photo' : 'paint'} />
              {stage === 'look' ? 'Back to the photo' : 'See the concept'}
              <Glyph name="right" />
            </button>
          )}
        </div>
      </div>
      <div className="house-scene-caption">
        <span>{stageCaption}</span>
        <a href={corpus.suppliedListing} target="_blank" rel="noopener noreferrer">
          Listing source ↗
        </a>
      </div>
      {(stage === 'photo' || stage === 'outline') && area.photoIds.length > 1 && (
        <div className="house-photo-paging" aria-label={`${area.title} source views`}>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => {
              const id =
                area.photoIds[(photoIndex - 1 + area.photoIds.length) % area.photoIds.length];
              setPhotoId(id);
              setItemId(null);
              if (stage === 'outline' && !corpus.inventory.photos.some((p) => p.id === id))
                setStage('photo');
            }}
          >
            <Glyph name="right" />
          </button>
          <span>
            Photo {photoIndex + 1} of {area.photoIds.length}
          </span>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => {
              const id = area.photoIds[(photoIndex + 1) % area.photoIds.length];
              setPhotoId(id);
              setItemId(null);
              if (stage === 'outline' && !corpus.inventory.photos.some((p) => p.id === id))
                setStage('photo');
            }}
          >
            <Glyph name="right" />
          </button>
        </div>
      )}
      {stage === 'plan' && (
        <div className="house-plan-picker" role="group" aria-label="Listing floor plans">
          {[
            { id: 'photo-19', title: 'Basement', area: 'basement' },
            { id: 'photo-20', title: 'Ground floor', area: 'living' },
            { id: 'photo-21', title: 'Upper floor', area: 'bedrooms' },
            { id: 'photo-22', title: 'All levels', area: 'exterior' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={area.planId === p.id}
              onClick={() => {
                setAreaId(p.area as AreaId);
                setPhotoId(houseAreas.find((a) => a.id === p.area)!.photoIds[0]);
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}
    </>
  );
  return (
    <section className="house-example" aria-label="Hutchinson whole-house concept">
      <header className="house-heading">
        <div>
          <p className="house-project-label">CONCEPT PLAN</p>
          <h1>2440 S Hutchinson St</h1>
          <p className="house-address">
            Whole-house refresh <span>Philadelphia, PA</span>
          </p>
        </div>
        <div className="house-header-actions">
          <button type="button" className="house-outline-button" onClick={() => setPanel('plan')}>
            <Glyph name="file" />
            Project plan
          </button>
          <button
            type="button"
            className="house-primary"
            disabled={saving || Boolean(projectId && !dirty)}
            onClick={() => void save()}
          >
            {saving
              ? 'Saving…'
              : projectId && !dirty
                ? 'Saved'
                : projectId
                  ? 'Save changes'
                  : 'Save project'}
            <Glyph name={projectId && !dirty ? 'check' : 'right'} />
          </button>
        </div>
      </header>
      {notice && (
        <p className="house-notice" role="status">
          <Glyph name="check" />
          {notice}
        </p>
      )}
      {error && (
        <p className="house-error" role="alert">
          {error}
        </p>
      )}
      <div className="house-workbench">
        <div className="house-gallery" ref={gallery}>
          {scene}
          <nav className="house-room-strip" aria-label="Rooms in this project">
            {houseAreas.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={areaId === a.id}
                onClick={() => selectArea(a.id)}
              >
                <img src={photoSrc(a.photoIds[0])} alt="" />
                <span>{a.title}</span>
                {choices.excluded.includes(a.id) && <small>Deferred</small>}
              </button>
            ))}
          </nav>
        </div>
        <aside className="house-inspector" aria-label="Proposed changes">
          {item ? (
            <>
              <button type="button" className="house-back" onClick={() => setItemId(null)}>
                <Glyph name="right" />
                Room overview
              </button>
              <span className="house-eyebrow">FROM THE PHOTO</span>
              <h2>
                {item.category === 'floor' ? 'The floor, and everything behind it.' : item.label}
              </h2>
              <p className="house-inspector-copy">{item.observation}</p>
              {item.category === 'floor' && (
                <div className="house-selected-work">
                  <Glyph name="layers" />
                  <div>
                    <strong>More than a new finish</strong>
                    <p>Removal, subfloor preparation, flooring, trim and transitions.</p>
                  </div>
                </div>
              )}
              <details className="house-disclosure">
                <summary>
                  What needs a closer look
                  <Glyph name="plus" />
                </summary>
                <ul>
                  {item.unknowns.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
                <p>{item.nextAction}</p>
              </details>
              {item.category === 'floor' && (
                <button
                  type="button"
                  className="house-primary"
                  onClick={() => {
                    chooseStage('look');
                    revealGallery();
                  }}
                >
                  Explore the concept
                  <Glyph name="right" />
                </button>
              )}
            </>
          ) : (
            <>
              <div className="house-inspector-heading">
                <span className="house-eyebrow">THE DIRECTION</span>
                <button
                  type="button"
                  className="house-scope-toggle"
                  aria-pressed={!excluded}
                  onClick={() => toggleArea(areaId)}
                >
                  {excluded ? 'Deferred' : 'In scope'}
                  <Glyph name={excluded ? 'plus' : 'check'} />
                </button>
              </div>
              <h2>{direction.title}</h2>
              <div className={`house-change-list ${excluded ? 'is-deferred' : ''}`}>
                {direction.changes.map((change) => (
                  <div className="house-change" key={change.title}>
                    <Glyph name={change.icon} />
                    <div>
                      <h3>{change.title}</h3>
                      <p>{change.detail}</p>
                    </div>
                  </div>
                ))}
                {areaId === 'living' && (
                  <div className="house-change house-bath-change">
                    <Glyph name="pipe" />
                    <div>
                      <h3>
                        A new half bath <span>Study</span>
                      </h3>
                      <p>Explore a location and the service routes.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={choices.halfBath}
                      aria-label="Include the new half-bath investigation"
                      onClick={() => revise({ ...choices, halfBath: !choices.halfBath })}
                    >
                      <span />
                    </button>
                  </div>
                )}
              </div>
              <details className="house-disclosure">
                <summary>
                  Work & materials
                  <Glyph name="plus" />
                </summary>
                <h3>Proposed work</h3>
                <ul>
                  {areaScope.work.map((work) => (
                    <li key={work}>{work}</li>
                  ))}
                </ul>
                <h3>Supporting materials</h3>
                <ul>
                  {areaScope.materials.map((material) => (
                    <li key={material}>{material}</li>
                  ))}
                </ul>
              </details>
              <div className="house-question">
                <Glyph name="chat" />
                <p>{areaScope.question}</p>
              </div>
            </>
          )}
        </aside>
      </div>
      <footer className="house-footer">
        <span>18 photos · 4 listing plans</span>
        <button type="button" onClick={() => setPanel('sources')}>
          <Glyph name="source" />
          Sources & process
        </button>
        <button type="button" disabled={saving} onClick={() => upload.current?.click()}>
          <Glyph name="plus" />
          Add photos or plans
        </button>
        <button
          type="button"
          onClick={() => {
            if (projectId) onTools();
            else
              void save().then((id) => {
                if (id) onTools();
              });
          }}
        >
          <Glyph name="connection" />
          Muse & tools
        </button>
      </footer>
      {panel === 'plan' && (
        <Modal title="Your project plan" className="house-panel" onClose={() => setPanel(null)}>
          <div className="house-panel-body">
            <p className="house-plan-intro">
              Whole-house refresh
              <span>
                {chosenAreas.length} areas{choices.halfBath ? ' · Half-bath investigation' : ''}
              </span>
            </p>
            <div className="house-plan-areas">
              {houseAreas.map((a) => (
                <details key={a.id} open={a.id === areaId}>
                  <summary>
                    <img src={photoSrc(a.photoIds[0])} alt="" />
                    <span>
                      <strong>{a.title}</strong>
                      <small>{a.approach}</small>
                    </span>
                    <span className="house-area-status">
                      {choices.excluded.includes(a.id) ? 'Deferred' : 'In scope'}
                    </span>
                    <Glyph name="chevron" />
                  </summary>
                  <div>
                    <ul>
                      {scopeForArea(a, choices).work.map((work) => (
                        <li key={work}>{work}</li>
                      ))}
                    </ul>
                    <details className="house-disclosure">
                      <summary>
                        Supporting materials
                        <Glyph name="plus" />
                      </summary>
                      <ul>
                        {scopeForArea(a, choices).materials.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </details>
                    <div className="house-plan-actions">
                      <button type="button" onClick={() => toggleArea(a.id)}>
                        {choices.excluded.includes(a.id) ? 'Include this area' : 'Defer this area'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          selectArea(a.id);
                          setPanel(null);
                          revealGallery();
                        }}
                      >
                        View room
                        <Glyph name="right" />
                      </button>
                    </div>
                  </div>
                </details>
              ))}
            </div>
            <p className="house-plan-note">
              A concept can start with photos. Measurements come in when the selected work needs
              quantities and a budget.
            </p>
          </div>
          <div className="house-panel-footer">
            <button type="button" className="house-outline-button" onClick={downloadBrief}>
              <Glyph name="file" />
              Export brief
            </button>
            <button type="button" className="house-primary" onClick={() => setPanel(null)}>
              Back to the house
              <Glyph name="right" />
            </button>
          </div>
        </Modal>
      )}
      {panel === 'sources' && (
        <Modal
          title="From the listing to the concept"
          className="house-panel house-source-panel"
          onClose={() => setPanel(null)}
        >
          <div className="house-panel-body">
            <p className="house-process-intro">
              The original evidence stays connected to the proposed look.
            </p>
            <div className="house-process-grid">
              {[
                {
                  stage: 'photo',
                  title: 'Understand',
                  tool: 'Muse review',
                  file: 'photo-04.jpg',
                  detail: 'Saved review of the listing photos and plans.',
                },
                {
                  stage: 'outline',
                  title: 'Pick out surfaces',
                  tool: 'SAM 3.1',
                  file: 'photo-04.jpg',
                  detail: 'Actual floor masks from this exact photo.',
                },
                {
                  stage: 'model',
                  title: 'Explore the space',
                  tool: 'Blender',
                  file: 'blender-reference.png',
                  detail: 'A schematic ground floor based on the listing plan.',
                },
                {
                  stage: 'look',
                  title: 'Try a new look',
                  tool: 'Muse Image',
                  file: 'muse-concept.png',
                  detail: 'A generated concept using that 3D reference.',
                },
              ].map((step) => (
                <button
                  type="button"
                  key={step.stage}
                  onClick={() => openPipelineStage(step.stage as Stage)}
                >
                  <div>
                    <img src={asset(step.file)} alt="" />
                    {step.stage === 'outline' && sam && (
                      <svg viewBox={`0 0 ${sam.width} ${sam.height}`}>
                        {sam.segments.map((segment) => (
                          <path
                            key={segment.id}
                            d={segment.path}
                            transform={`translate(${segment.box.left} ${segment.box.top}) scale(${segment.scaleX} ${segment.scaleY})`}
                          />
                        ))}
                      </svg>
                    )}
                  </div>
                  <span>{step.tool}</span>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </button>
              ))}
            </div>
            <p className="house-plan-note">
              The model uses listing-plan references and schematic wall heights and furniture. The
              generated look is a concept; the new bath's position and services still need
              investigation.
            </p>
            <details className="house-disclosure house-source-details">
              <summary>
                Source files & model receipts
                <Glyph name="plus" />
              </summary>
              <div className="house-source-files">
                <a href={corpus.suppliedListing} target="_blank" rel="noopener noreferrer">
                  Original listing
                  <Glyph name="right" />
                </a>
                <a href={corpus.suppliedVideo} target="_blank" rel="noopener noreferrer">
                  Listing video tour
                  <Glyph name="right" />
                </a>
                <a href={asset('sam-floor.json')} target="_blank" rel="noopener noreferrer">
                  SAM segmentation receipt
                  <Glyph name="right" />
                </a>
                <a href={asset('blender-reference.json')} target="_blank" rel="noopener noreferrer">
                  3D reference basis
                  <Glyph name="right" />
                </a>
                <a href={asset('muse-concept.json')} target="_blank" rel="noopener noreferrer">
                  Muse concept receipt
                  <Glyph name="right" />
                </a>
                <a href={asset('hutchinson-concept.glb')} download>
                  Download 3D model
                  <Glyph name="right" />
                </a>
                {corpus.photos
                  .filter((p) => p.roomType === 'uncertain')
                  .map((p) => (
                    <a key={p.id} href={photoSrc(p.id)} target="_blank" rel="noopener noreferrer">
                      Additional interior view · {p.id}
                      <Glyph name="right" />
                    </a>
                  ))}
                {Array.from(
                  new Map(attachments.map((e) => [e.source.attachment!.name, e])).values(),
                ).map((e) => (
                  <span key={e.id}>{e.source.attachment!.name}</span>
                ))}
              </div>
              <p>
                Source review: October 28, 2026 · {corpus.inventory.items.length} region
                observations. The whole-house scope is proposed from the owner's direction, separate
                from source observations and measured quantities.
              </p>
            </details>
            <button type="button" className="house-studio-link" onClick={onFinishStudio}>
              Open the separate finish-and-cost example
              <Glyph name="right" />
            </button>
          </div>
        </Modal>
      )}
      <input
        ref={upload}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={async (e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = '';
          if (!files.length) return;
          setError('');
          setSaving(true);
          try {
            const id = projectId ?? (await saveHouseCase(controller, corpus, choices));
            for (const file of files) await controller.attachFile(id, file);
            setDirty(false);
            setNotice(
              `${files.length} source file${files.length === 1 ? '' : 's'} saved for the next analysis.`,
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setSaving(false);
          }
        }}
      />
    </section>
  );
}
