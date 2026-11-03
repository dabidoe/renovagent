import type { SampleRoom } from '../project-start/sample-rooms.js';
import { StudioError } from './studio-error.js';
import { studioStylingSignature } from './studio-signatures.js';
import { useEffect, useRef, useState } from 'react';
import {
  studioStylingDraftSchema,
  type StudioStylingDraft,
  type StudioItem,
  type StudioIdeas,
  type StudioAssetId,
} from '@renovagent/contracts';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { Glyph } from '../../components/glyph.js';
import { SignInChoices } from '../connect/sign-in.js';
import { imageUrl } from './own-project.js';
import type { StudioRoom, WallColor } from './paint-floor.js';
import { AMAZON_DISCLOSURE, shopLinks } from './shop-links.js';
import { InspoBoard } from './inspo-board.js';
import { AssetThumb } from './furniture-panel.js';
import { studioAsset } from '@renovagent/core';

// "Use an inspiration photo": Muse Spark names what makes the look, SAM 3.1
// outlines each item, the colours are read from those outlines here, the walls
// get the three closest loaded paints, and Muse Image restyles the room photo.
// Store links are searches for the described item, never products or prices.
type Segment = {
  box: { left: number; top: number };
  path: string;
  scaleX: number;
  scaleY: number;
};
type Item = { phrase: string; name: string; kind: string; segments: Segment[] };
type Inspo = { sha256: string; width: number; height: number; items: Item[] };
type Change = { target: string; becomes: string };
type Match = WallColor & { deltaE: number };
type Nearest = { hex: string; close: boolean; matches: Match[] };
export type StylingDraft = StudioStylingDraft;
type DesignVersion = NonNullable<StylingDraft['versions']>[number];
export function stylingDraft(projectId: string, room: StudioRoom) {
  return readDraft(`renovagent.styling.${projectId}.${room.id}.v1`, room.photo.src);
}
function readDraft(key: string, source: string): StylingDraft | null {
  try {
    const parsed = studioStylingDraftSchema.safeParse(
      JSON.parse(localStorage.getItem(key) || 'null'),
    );
    return parsed.success && parsed.data.source === source ? parsed.data : null;
  } catch {
    return null;
  }
}

const SHA = /\/design-images\/([a-f0-9]{64})/;
async function upload(blob: Blob, name: string, origin: 'owner' | 'listing-example') {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const stored = (await workspaceRequest('/studio/photo', { data, name, origin })) as {
    sha256: string;
  };
  return stored.sha256;
}
// The room photo by hash: an owner's photo already is; a listing example's is
// sent once, labelled as the listing's.
async function roomSha(src: string) {
  const own = SHA.exec(src)?.[1];
  if (own) return own;
  const blob = await (await fetch(src)).blob();
  return upload(blob, src.split('/').pop() || 'listing.jpg', 'listing-example');
}

// The colour of each outlined item: the middle of its brightness range
// (25th–85th percentile), so shadow and glare do not count as the finish.
async function itemColours(inspo: Inspo): Promise<string[]> {
  const img = new Image();
  img.src = imageUrl(inspo.sha256);
  await img.decode();
  const scale = Math.min(1, 640 / inspo.width);
  const w = Math.max(1, Math.round(inspo.width * scale)),
    h = Math.max(1, Math.round(inspo.height * scale));
  const photo = document.createElement('canvas');
  photo.width = w;
  photo.height = h;
  const pc = photo.getContext('2d', { willReadFrequently: true })!;
  pc.drawImage(img, 0, 0, w, h);
  const pixels = pc.getImageData(0, 0, w, h).data;
  return inspo.items.map((item) => {
    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    const mc = mask.getContext('2d', { willReadFrequently: true })!;
    mc.fillStyle = '#fff';
    for (const s of item.segments) {
      const shape = new Path2D();
      shape.addPath(
        new Path2D(s.path),
        new DOMMatrix([
          s.scaleX * scale,
          0,
          0,
          s.scaleY * scale,
          s.box.left * scale,
          s.box.top * scale,
        ]),
      );
      mc.fill(shape, 'evenodd');
    }
    const on = mc.getImageData(0, 0, w, h).data;
    const px: [number, number, number][] = [];
    for (let i = 0; i < on.length; i += 4)
      if (on[i + 3]! > 127) px.push([pixels[i]!, pixels[i + 1]!, pixels[i + 2]!]);
    if (!px.length) return '';
    px.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    const mid = px.slice(Math.floor(px.length * 0.25), Math.ceil(px.length * 0.85));
    const mean = (k: 0 | 1 | 2) => Math.round(mid.reduce((t, p) => t + p[k], 0) / mid.length);
    return '#' + [mean(0), mean(1), mean(2)].map((v) => v.toString(16).padStart(2, '0')).join('');
  });
}

export function InspoPanel({
  room,
  projectId,
  initialDraft,
  onStale,
  finishSignature,
  onDraftChange,
  onDesignItems,
  currentColor,
  basePhotoSrc,
  floorPending,
  designItems = [],
  initialBrief,
  sampleRoom,
  onIdeaLayout,
  onPaint,
  onRestyled,
}: {
  room: StudioRoom;
  projectId: string;
  initialDraft?: StylingDraft | null;
  onStale?: (roomId: string, stale: boolean) => void;
  finishSignature?: string;
  onDraftChange?: (roomId: string, draft: StylingDraft) => void;
  onDesignItems?: (items: string[]) => void;
  currentColor?: WallColor | null;
  basePhotoSrc?: string;
  floorPending?: boolean;
  designItems?: StudioItem[];
  initialBrief?: string;
  sampleRoom?: SampleRoom;
  onIdeaLayout?: (assets: StudioAssetId[]) => void;
  onPaint: (color: WallColor) => void;
  onRestyled: (src: string, finishSignature?: string) => void;
}) {
  const storageKey = `renovagent.styling.${projectId}.${room.id}.v1`;
  const [draft] = useState(() =>
    initialDraft === undefined ? readDraft(storageKey, room.photo.src) : initialDraft,
  );
  const [inspo, setInspo] = useState<Inspo | null>(draft?.inspo ?? null);
  const [colours, setColours] = useState<string[]>(draft?.colours ?? []);
  const [paints, setPaints] = useState<Nearest | null>(null);
  const [paint, setPaint] = useState<Match | null>(draft?.paint ?? null);
  const [borrow, setBorrow] = useState<Set<string>>(new Set(draft?.borrow ?? []));
  const [mode, setMode] = useState<'refresh' | 'furnish'>(draft?.mode ?? 'furnish');
  const [keep, setKeep] = useState(draft?.keep ?? '');
  const [brief, setBrief] = useState(draft?.brief ?? initialBrief ?? '');
  const [ideas, setIdeas] = useState<StudioIdeas | undefined>(draft?.ideas);
  const [versions, setVersions] = useState<DesignVersion[]>(draft?.versions ?? []);
  const [selectedVersionId, setSelectedVersionId] = useState(draft?.selectedVersionId ?? '');
  const [resultSignature, setResultSignature] = useState(draft?.resultSignature ?? '');
  const [storageFailed, setStorageFailed] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [status, setStatus] = useState<{ busy: string; error: string }>({ busy: '', error: '' });
  const [amazonTag, setAmazonTag] = useState<string | undefined>();
  const [changes, setChanges] = useState<Change[]>(draft?.changes ?? []);
  const file = useRef<HTMLInputElement>(null);
  const briefInput = useRef<HTMLTextAreaElement>(null);
  const signature = studioStylingSignature({
    inspo,
    borrow: [...borrow],
    paint,
    mode,
    keep,
    finishSignature,
    brief,
    items: designItems,
  });
  const stale = !!resultSignature && resultSignature !== signature;
  useEffect(() => {
    onStale?.(room.id, stale);
  }, [room.id, stale, onStale]);
  const draftJson = JSON.stringify({
    source: room.photo.src,
    inspo,
    colours,
    paint,
    borrow: [...borrow],
    changes,
    mode,
    keep,
    resultSignature,
    brief,
    versions,
    selectedVersionId,
    ideas,
  } satisfies StylingDraft);
  useEffect(() => {
    onDraftChange?.(room.id, JSON.parse(draftJson) as StylingDraft);
  }, [room.id, draftJson, onDraftChange]);
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          source: room.photo.src,
          inspo,
          colours,
          paint,
          borrow: [...borrow],
          changes,
          mode,
          keep,
          resultSignature,
          brief,
          versions,
          selectedVersionId,
          ideas,
        } satisfies StylingDraft),
      );
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }, [
    storageKey,
    room.photo.src,
    inspo,
    colours,
    paint,
    borrow,
    changes,
    mode,
    keep,
    resultSignature,
    brief,
    versions,
    selectedVersionId,
    ideas,
  ]);
  useEffect(() => {
    let live = true;
    setPaints(null);
    const wall = inspo?.items.findIndex((i) => i.kind === 'walls') ?? -1;
    if (wall >= 0 && colours[wall])
      void (
        workspaceRequest(
          `/paint/nearest?hex=${encodeURIComponent(colours[wall]!)}`,
        ) as Promise<Nearest>
      )
        .then((nearest) => {
          if (live) setPaints(nearest);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [inspo, colours]);
  useEffect(() => {
    void (workspaceRequest('/session') as Promise<{ amazonTag?: string }>)
      .then((s) => setAmazonTag(s.amazonTag))
      .catch(() => {});
  }, []);
  const fail = (e: unknown) =>
    setStatus({
      busy: '',
      error: e instanceof Error ? e.message.slice(0, 160) : 'That did not work.',
    });

  const analyse = async (picked: File | string) => {
    setStatus({ busy: 'Reading the photo…', error: '' });
    setInspo(null);
    setPaints(null);
    setPaint(null);
    try {
      // A photo from the board is already stored; a picked file is uploaded.
      const sha256 =
        typeof picked === 'string' ? picked : await upload(picked, picked.name, 'owner');
      setStatus({ busy: 'Finding what makes the look…', error: '' });
      const found = (await workspaceRequest('/studio/inspo', { sha256 })) as Inspo;
      setInspo(found);
      setBorrow(
        new Set(
          found.items
            .filter((i) => i.segments.length && (i.kind !== 'floor' || /rug|mat/i.test(i.phrase)))
            .map((i) => i.phrase),
        ),
      );
      const read = await itemColours(found);
      setColours(read);
      setStatus({ busy: '', error: '' });
    } catch (e) {
      fail(e);
    }
  };
  const suggest = async () => {
    setStatus({ busy: 'Finding three directions for your room…', error: '' });
    try {
      const sha256 = await roomSha(room.photo.src);
      const protectedItems = [
        keep.trim(),
        ...designItems.filter((i) => i.action === 'keep').map((i) => i.name),
      ]
        .filter(Boolean)
        .join('; ');
      if (protectedItems.length > 300)
        throw new Error('Shorten the keep instructions to 300 characters before asking for ideas.');
      const result = (await workspaceRequest('/studio/ideas', {
        sha256,
        brief: brief.trim(),
        keep: protectedItems,
      })) as StudioIdeas;
      setIdeas(result);
      setStatus({ busy: '', error: '' });
    } catch (e) {
      fail(e);
    }
  };
  const restyle = async () => {
    if (!room.photo.src) return;
    const borrowed = (inspo?.items ?? [])
      .filter(
        (i) =>
          borrow.has(i.phrase) &&
          i.kind !== 'walls' &&
          (i.kind !== 'floor' || /rug|mat/i.test(i.phrase)),
      )
      .map((i) => i.name);
    const items = [
      ...new Set([
        ...borrowed,
        ...designItems
          .filter((i) => i.action !== 'keep')
          .map((i) => `${i.quantity ?? ''} ${i.name}`.trim()),
      ]),
    ];
    const selectedPaint = currentColor === undefined ? paint : currentColor;
    if (!items.length && !selectedPaint && !brief.trim()) return;
    setStatus({ busy: 'Creating your room design…', error: '' });
    try {
      if (items.length > 12)
        throw new Error('Choose up to 12 items for one design. Keep the rest in your room list.');
      const protectedItems = [
        keep.trim(),
        ...designItems.filter((i) => i.action === 'keep').map((i) => i.name),
      ]
        .filter(Boolean)
        .join('; ');
      if (protectedItems.length > 300)
        throw new Error(
          'Shorten the keep instructions to 300 characters before creating the design.',
        );
      const sha256 = await roomSha(basePhotoSrc || room.photo.src);
      const done = (await workspaceRequest('/studio/restyle', {
        sha256,
        ...(inspo ? { inspo: inspo.sha256 } : {}),
        items,
        brief: brief.trim(),
        mode,
        keep: protectedItems,
        preserveFloor: true,
        ...(selectedPaint
          ? {
              paint: { name: selectedPaint.name, code: selectedPaint.code, hex: selectedPaint.hex },
            }
          : {}),
      })) as { sha256: string; changes?: Change[] };
      setChanges(done.changes ?? []);
      const proposalNames = borrowed.length
        ? borrowed
        : (done.changes ?? [])
            .map((c) => c.becomes)
            .filter((name) => !/\b(walls?|flooring|ceiling|paint)\b/i.test(name));
      const known = new Set(designItems.map((i) => i.name.trim().toLowerCase()));
      const resultItems = [
        ...designItems.map((i) => ({ name: i.name, action: i.action, quantity: i.quantity })),
        ...proposalNames
          .filter(
            (name) => !known.has(name.trim().toLowerCase()) && known.add(name.trim().toLowerCase()),
          )
          .map((name) => ({ name, action: 'add', quantity: null })),
      ];
      const completedSignature = JSON.stringify({
        ...JSON.parse(signature),
        roomItems: resultItems,
      });
      setResultSignature(completedSignature);
      const src = imageUrl(done.sha256);
      const version: DesignVersion = {
        id: crypto.randomUUID(),
        image: src,
        title:
          brief.trim().slice(0, 70) || (mode === 'furnish' ? 'Furnished room' : 'Finish refresh'),
        createdAt: new Date().toISOString(),
        signature: completedSignature,
        finishSignature: finishSignature ?? '',
        changes: done.changes ?? [],
      };
      setVersions((current) => [...current, version].slice(-12));
      setSelectedVersionId(version.id);
      onDesignItems?.(proposalNames);
      onRestyled(src, finishSignature);
      setStatus({ busy: '', error: '' });
    } catch (e) {
      fail(e);
    }
  };
  const signIn = /^Sign in/.test(status.error);
  const borrowsItems = !!inspo?.items.some(
    (i) =>
      borrow.has(i.phrase) &&
      i.kind !== 'walls' &&
      (i.kind !== 'floor' || /rug|mat/i.test(i.phrase)),
  );
  const usesAmazon = Boolean(amazonTag && inspo);
  return (
    <div className="pf-inspo">
      <div className="pf-group-head">
        <h3>Make it your room.</h3>
        {inspo && (
          <button
            type="button"
            disabled={!!status.busy}
            className="pf-inspo-again"
            onClick={() => file.current?.click()}
          >
            Another photo
          </button>
        )}
      </div>
      <section className="pf-room-ideas" aria-label="Ideas for your room">
        <div className="pf-ideas-intro">
          <span>A fresh pair of eyes</span>
          <h4>You know what would look good here?</h4>
          <p>Three directions, based on your photo. Pick one and make it yours.</p>
        </div>
        <button
          className="pf-suggest-button"
          type="button"
          disabled={!!status.busy || !room.photo.src}
          onClick={() => void suggest()}
        >
          {ideas ? 'Find three new ideas' : 'What would look good here?'}
        </button>
        {ideas && (
          <>
            <div className="pf-direction-cards">
              {ideas.directions.map((idea, index) => (
                <article key={idea.id} className={`pf-direction-card pf-direction-${index}`}>
                  <div
                    className="pf-direction-art"
                    style={{
                      background: `linear-gradient(135deg,${idea.palette[0]},${idea.palette[1]})`,
                    }}
                  >
                    <span className="pf-direction-number">0{index + 1}</span>
                    <div>
                      {idea.assets.slice(0, 3).map((id) => (
                        <AssetThumb key={id} id={id} />
                      ))}
                    </div>
                    <div className="pf-direction-palette" aria-label="Proposed colour palette">
                      {idea.palette.map((c, i) => (
                        <i key={`${c}:${i}`} title={c} style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="pf-direction-copy">
                    <h4>{idea.title}</h4>
                    <p>{idea.description}</p>
                    <small>{idea.why}</small>
                    <div>
                      <button
                        type="button"
                        disabled={!!status.busy}
                        aria-pressed={brief === idea.brief}
                        onClick={() => {
                          setBrief(idea.brief);
                          setMode('furnish');
                          briefInput.current?.focus();
                        }}
                      >
                        {brief === idea.brief ? 'In your brief ✓' : 'Use this idea'}
                      </button>
                      {onIdeaLayout && (
                        <button
                          type="button"
                          disabled={!!status.busy}
                          onClick={() => {
                            setBrief(idea.brief);
                            setMode('furnish');
                            onIdeaLayout(idea.assets);
                          }}
                        >
                          Try in 3D ↗
                        </button>
                      )}
                    </div>
                    <span>{idea.assets.map((id) => studioAsset(id).name).join(' · ')}</span>
                  </div>
                </article>
              ))}
            </div>
            {!!ideas.observations.length && (
              <details className="pf-idea-observations">
                <summary>What the photo suggests</summary>
                <ul>
                  {ideas.observations.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                <small>
                  Visual observations to check, not measured facts. The card artwork shows library
                  furniture; generate a design to see it in your room.
                </small>
              </details>
            )}
          </>
        )}
      </section>
      <div className="pf-styling-modes" role="group" aria-label="Room design approach">
        <button
          type="button"
          aria-pressed={mode === 'refresh'}
          disabled={!!status.busy}
          onClick={() => setMode('refresh')}
        >
          <b>Refresh finishes</b>
          <small>Keep the furniture</small>
        </button>
        <button
          type="button"
          aria-pressed={mode === 'furnish'}
          disabled={!!status.busy}
          onClick={() => setMode('furnish')}
        >
          <b>Furnish the room</b>
          <small>Furniture, lighting & décor</small>
        </button>
      </div>
      <p className="pf-inspo-note">
        {mode === 'furnish'
          ? 'Borrow furniture and lighting from a room you love. Keep your room’s architecture.'
          : 'Borrow colours and textures while keeping your furniture in place.'}
      </p>
      <label className="pf-design-brief">
        Your design brief
        <textarea
          ref={briefInput}
          aria-label="Your design brief"
          value={brief}
          maxLength={1000}
          disabled={!!status.busy}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="A cream sofa, walnut coffee table and a large striped rug. Keep the stairs clear. Warm and lived-in."
        />
      </label>
      {!!sampleRoom?.furnishingSuggestions?.length && (
        <div className="sample-room-restyle">
          <p>Try a furniture direction</p>
          <div className="sample-room-suggestions" aria-label="Sample furnishing ideas">
            {sampleRoom.furnishingSuggestions.map((idea) => (
              <button
                type="button"
                key={idea.title}
                disabled={!!status.busy}
                onClick={() => {
                  setBrief(idea.brief);
                  setMode('furnish');
                  briefInput.current?.focus();
                }}
              >
                {idea.title}
              </button>
            ))}
          </div>
          <small>Fills your brief. Create room design makes the live mockup.</small>
        </div>
      )}
      <label className="pf-styling-keep">
        Keep unchanged
        <input
          type="text"
          maxLength={300}
          disabled={!!status.busy}
          value={keep}
          placeholder="e.g. my sofa, the piano and the fireplace"
          onChange={(e) => setKeep(e.target.value)}
        />
      </label>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          if (picked) void analyse(picked);
        }}
      />
      {!inspo && !status.busy && (
        <button type="button" className="pf-inspo-add" onClick={() => file.current?.click()}>
          <Glyph name="photo" />
          <span>
            <b>Use an inspiration photo</b>
            <small>Optional · a screenshot or a room you love</small>
          </span>
        </button>
      )}
      <InspoBoard onUsePhoto={(sha256) => void analyse(sha256)} busy={!!status.busy} />
      {status.busy && (
        <p className="pf-inspo-status">
          <span className="pf-spinner" aria-hidden="true" /> {status.busy}
        </p>
      )}
      {status.error && (
        <div>
          <StudioError message={status.error} />
          {signIn && (
            <div className="pf-inspo-signin">
              <SignInChoices />
            </div>
          )}
        </div>
      )}
      {inspo && (
        <>
          <figure className="pf-inspo-photo">
            <img src={imageUrl(inspo.sha256)} alt="Your inspiration photo" />
            <svg viewBox={`0 0 ${inspo.width} ${inspo.height}`} aria-hidden="true">
              {inspo.items.map((item) =>
                item.segments.map((s, k) => (
                  <path
                    key={`${item.phrase}-${k}`}
                    d={s.path}
                    transform={`translate(${s.box.left} ${s.box.top}) scale(${s.scaleX} ${s.scaleY})`}
                    className={hover === item.phrase ? 'is-hover' : ''}
                  />
                )),
              )}
            </svg>
            <figcaption>Outlined by SAM 3.1 · named by Muse</figcaption>
          </figure>
          <ul className="pf-inspo-items">
            {inspo.items.map((item, i) => (
              <li
                key={item.phrase}
                onMouseEnter={() => setHover(item.phrase)}
                onMouseLeave={() => setHover(null)}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={
                      borrow.has(item.phrase) &&
                      (item.kind !== 'floor' || /rug|mat/i.test(item.phrase))
                    }
                    disabled={
                      !!status.busy || (item.kind === 'floor' && !/rug|mat/i.test(item.phrase))
                    }
                    onChange={(e) =>
                      setBorrow((b) => {
                        const next = new Set(b);
                        if (e.target.checked) next.add(item.phrase);
                        else next.delete(item.phrase);
                        return next;
                      })
                    }
                  />
                  <i style={{ background: colours[i] || 'transparent' }} />
                  <span>
                    {item.name}
                    <small>
                      {item.kind === 'floor' && !/rug|mat/i.test(item.phrase)
                        ? 'Use floor controls below'
                        : item.segments.length
                          ? item.kind
                          : `${item.kind} · not outlined`}
                    </small>
                  </span>
                </label>
                {item.kind === 'walls' && paints?.matches.length ? (
                  <div className="pf-inspo-paints">
                    <small>
                      {paints.close
                        ? `Closest ${paints.matches[0]?.brand ?? ''} colours to how it looks in this photo`
                        : 'No close match in the loaded colours; the nearest are'}
                    </small>
                    <div role="group" aria-label="Closest paints">
                      {paints.matches.map((m) => (
                        <button
                          key={m.code || m.name}
                          type="button"
                          aria-pressed={paint?.hex === m.hex}
                          onClick={() => {
                            setPaint(m);
                            onPaint({ name: m.name, code: m.code, hex: m.hex, brand: m.brand });
                          }}
                        >
                          <i style={{ background: m.hex }} />
                          {m.name}
                          <small>{m.code}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : item.kind !== 'walls' ? (
                  <p className="pf-inspo-shop">
                    Search:{' '}
                    {shopLinks(item.name, amazonTag).map((l) => (
                      <a key={l.store} href={l.href} target="_blank" rel="noreferrer sponsored">
                        {l.store}
                      </a>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="pf-inspo-note">
            Furniture and lighting are visual concepts; fit, products and installation are not
            verified or included in the paint-and-floor total. Colours are read from the photo, so
            its lighting shows in them. Store links are searches, not picked products.
            {usesAmazon ? ` ${AMAZON_DISCLOSURE}` : ''}
          </p>
        </>
      )}
      {changes.length > 0 && (
        <div className="pf-inspo-changes">
          <h4>Last design · proposed changes</h4>
          {resultSignature !== signature && (
            <p className="pf-styling-stale" role="status">
              Choices changed. Generate a new design to see them applied.
            </p>
          )}
          <ul>
            {changes.map((c) => (
              <li key={c.target}>
                <s>{c.target}</s> → {c.becomes}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pf-design-action">
        <button
          type="button"
          className="pf-inspo-go"
          disabled={
            !!status.busy ||
            !!floorPending ||
            !room.photo.src ||
            (!brief.trim() &&
              !borrowsItems &&
              !designItems.some((i) => i.action !== 'keep') &&
              !(currentColor === undefined ? paint : currentColor))
          }
          onClick={() => void restyle()}
        >
          {status.busy
            ? 'Creating…'
            : resultSignature
              ? 'Update room design'
              : 'Create room design'}{' '}
          <Glyph name="right" />
        </button>
        <small>
          {floorPending
            ? 'Waiting for the selected floor preview…'
            : 'Generated concept · your room, your choices'}
        </small>
      </div>
      {versions.length > 0 && (
        <div className="pf-design-history">
          <h4>
            Your designs <span>{versions.length}</span>
          </h4>
          <div role="group" aria-label="Previous room designs">
            {versions.map((v, index) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === selectedVersionId}
                disabled={!!status.busy}
                onClick={() => {
                  setSelectedVersionId(v.id);
                  setResultSignature(v.signature);
                  setChanges(v.changes);
                  onRestyled(v.image, v.finishSignature);
                }}
              >
                <img src={v.image} alt={`Design ${index + 1}`} />
                <span>
                  {index + 1}. {v.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="pf-inspo-note">
        {storageFailed
          ? 'Choices could not be saved in this browser.'
          : 'Save project to keep this design in your workspace.'}
      </p>
    </div>
  );
}

// The restyled room against the photo it came from.
export function InspiredView({
  before,
  after,
  caption = 'Generated room concept · check dimensions and product fit before buying.',
}: {
  before: string;
  after: string;
  caption?: string;
}) {
  const [split, setSplit] = useState(50);
  return (
    <figure className="pf-inspired">
      <div className="pf-inspired-stage" style={{ ['--split' as string]: `${split}%` }}>
        <img src={after} alt="Your generated room design" />
        <img className="pf-inspired-before" src={before} alt="Your room before" />
        <span className="pf-inspired-divider" aria-hidden="true" />
        <span className="pf-inspired-label is-before">Before</span>
        <span className="pf-inspired-label is-after">Your design</span>
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          aria-label="Compare before and room design"
          onChange={(e) => setSplit(Number(e.target.value))}
        />
      </div>
      <figcaption>{caption}</figcaption>
      <a
        className="pf-design-download"
        href={after}
        download="renovagent-generated-room-design.jpg"
      >
        Download room design
      </a>
    </figure>
  );
}
