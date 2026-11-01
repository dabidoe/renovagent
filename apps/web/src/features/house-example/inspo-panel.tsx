import { useEffect, useRef, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { Glyph } from '../../components/glyph.js';
import { SignInChoices } from '../connect/sign-in.js';
import { imageUrl } from './own-project.js';
import type { StudioRoom, WallColor } from './paint-floor.js';
import { AMAZON_DISCLOSURE, shopLinks } from './shop-links.js';

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
  onPaint,
  onRestyled,
}: {
  room: StudioRoom;
  onPaint: (color: WallColor) => void;
  onRestyled: (src: string) => void;
}) {
  const [inspo, setInspo] = useState<Inspo | null>(null);
  const [colours, setColours] = useState<string[]>([]);
  const [paints, setPaints] = useState<Nearest | null>(null);
  const [paint, setPaint] = useState<Match | null>(null);
  const [borrow, setBorrow] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const [status, setStatus] = useState<{ busy: string; error: string }>({ busy: '', error: '' });
  const [amazonTag, setAmazonTag] = useState<string | undefined>();
  const [changes, setChanges] = useState<Change[]>([]);
  const file = useRef<HTMLInputElement>(null);
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

  const analyse = async (picked: File) => {
    setStatus({ busy: 'Reading the photo…', error: '' });
    setInspo(null);
    setPaints(null);
    setPaint(null);
    try {
      const sha256 = await upload(picked, picked.name, 'owner');
      setStatus({ busy: 'Finding what makes the look…', error: '' });
      const found = (await workspaceRequest('/studio/inspo', { sha256 })) as Inspo;
      setInspo(found);
      setBorrow(new Set(found.items.filter((i) => i.segments.length).map((i) => i.phrase)));
      const read = await itemColours(found);
      setColours(read);
      const wall = found.items.findIndex((i) => i.kind === 'walls');
      if (wall >= 0 && read[wall])
        setPaints(
          (await workspaceRequest(
            `/paint/nearest?hex=${encodeURIComponent(read[wall]!)}`,
          )) as Nearest,
        );
      setStatus({ busy: '', error: '' });
    } catch (e) {
      fail(e);
    }
  };
  const restyle = async () => {
    if (!inspo || !room.photo.src) return;
    const items = inspo.items
      .filter((i) => borrow.has(i.phrase) && i.kind !== 'walls')
      .map((i) => i.name);
    if (!items.length && !paint) return;
    setStatus({ busy: 'Restyling your room… about 30 seconds', error: '' });
    setChanges([]);
    try {
      const sha256 = await roomSha(room.photo.src);
      const done = (await workspaceRequest('/studio/restyle', {
        sha256,
        inspo: inspo.sha256,
        items: items.length ? items : ['wall paint'],
        ...(paint ? { paint: { name: paint.name, code: paint.code, hex: paint.hex } } : {}),
      })) as { sha256: string; changes?: Change[] };
      setChanges(done.changes ?? []);
      onRestyled(imageUrl(done.sha256));
      setStatus({ busy: '', error: '' });
    } catch (e) {
      fail(e);
    }
  };
  const signIn = /^Sign in/.test(status.error);
  const borrowsItems = !!inspo?.items.some((i) => borrow.has(i.phrase) && i.kind !== 'walls');
  const usesAmazon = Boolean(amazonTag && inspo);
  return (
    <div className="pf-inspo">
      <div className="pf-group-head">
        <h3>Inspiration</h3>
        {inspo && (
          <button type="button" className="pf-inspo-again" onClick={() => file.current?.click()}>
            Another photo
          </button>
        )}
      </div>
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
            <small>A saved Pinterest pin, a screenshot, a room you love</small>
          </span>
        </button>
      )}
      {status.busy && (
        <p className="pf-inspo-status">
          <span className="pf-spinner" aria-hidden="true" /> {status.busy}
        </p>
      )}
      {status.error && (
        <div className="pf-intake-error" role="alert">
          {status.error}
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
                    checked={borrow.has(item.phrase)}
                    disabled={!item.segments.length}
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
                      {item.segments.length ? item.kind : `${item.kind} · not outlined`}
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
          {room.photo.src ? (
            <button
              type="button"
              className="pf-inspo-go"
              disabled={!!status.busy || (!paint && !borrowsItems)}
              onClick={() => void restyle()}
            >
              Restyle the {room.title.toLowerCase()} with this look
            </button>
          ) : (
            <p className="pf-inspo-note">
              This room has no photo to restyle; the paint applies in 3D.
            </p>
          )}
          {changes.length > 0 && (
            <div className="pf-inspo-changes">
              <h4>What Muse changed in your room</h4>
              <ul>
                {changes.map((c) => (
                  <li key={c.target}>
                    <s>{c.target}</s> → {c.becomes}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="pf-inspo-note">
            Colours are read from the photo, so its lighting shows in them. Store links are
            searches, not picked products.
            {usesAmazon ? ` ${AMAZON_DISCLOSURE}` : ''}
          </p>
        </>
      )}
    </div>
  );
}

// The restyled room against the photo it came from.
export function InspiredView({
  before,
  after,
  caption = 'Muse Image restyle from your inspiration photo; a picture, not a plan.',
}: {
  before: string;
  after: string;
  caption?: string;
}) {
  const [split, setSplit] = useState(50);
  return (
    <figure className="pf-inspired">
      <div className="pf-inspired-stage" style={{ ['--split' as string]: `${split}%` }}>
        <img src={after} alt="Your room restyled from the inspiration photo" />
        <img className="pf-inspired-before" src={before} alt="Your room before" />
        <span className="pf-inspired-divider" aria-hidden="true" />
        <span className="pf-inspired-label is-before">Before</span>
        <span className="pf-inspired-label is-after">Inspired</span>
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          aria-label="Compare before and inspired"
          onChange={(e) => setSplit(Number(e.target.value))}
        />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
