import { type Artifact, type Workspace } from '@unpermitted/contracts';
import { mm } from '@unpermitted/core';
export function MeasuredSketch({ artifact, state }: { artifact: Artifact; state?: Workspace }) {
  const records = artifact.inputRefs.flatMap((r) =>
    r.kind === 'artifact'
      ? state?.artifacts[r.id]?.filter((a) => a.revision === r.revision) || []
      : [],
  );
  const site = records.find(
    (a) => a.payload.kind === 'planning-inputs' && a.payload.group === 'site',
  )?.payload;
  const layout = records.find(
    (a) => a.payload.kind === 'planning-inputs' && a.payload.group === 'layout',
  )?.payload;
  if (site?.kind !== 'planning-inputs' || layout?.kind !== 'planning-inputs') return null;
  const s = site.inputs.site,
    l = layout.inputs.layout;
  if (
    !s.width ||
    !s.length ||
    !l.toiletWidth ||
    !l.toiletProjection ||
    !l.toiletCenterX ||
    !l.basinWidth ||
    !l.basinDepth ||
    !l.basinX
  )
    return null;
  const w = mm(s.width),
    d = mm(s.length);
  if (w <= 0 || d <= 0) return null;
  const tw = mm(l.toiletWidth),
    tp = mm(l.toiletProjection),
    cx = mm(l.toiletCenterX),
    bw = mm(l.basinWidth),
    bd = mm(l.basinDepth),
    bx = mm(l.basinX);
  return (
    <figure className="measured-sketch">
      <svg
        viewBox={`-240 -180 ${w + 480} ${d + 360}`}
        role="img"
        aria-label="Measured rectangular layout using the exact saved dimensions and fixture footprints"
      >
        <rect x="0" y="0" width={w} height={d} fill="#fafbf6" stroke="#42543b" strokeWidth="12" />
        <rect
          x={cx - tw / 2}
          y="0"
          width={tw}
          height={tp}
          rx="50"
          fill="#e1e8d9"
          stroke="#42543b"
          strokeWidth="8"
        />
        <rect
          x={bx}
          y={d - bd}
          width={bw}
          height={bd}
          fill="#e3e5f3"
          stroke="#575782"
          strokeWidth="8"
        />
        <path d={`M${cx} 0v${d}`} stroke="#42543b" strokeWidth="3" strokeDasharray="15 15" />
        <text x={w / 2} y="-65" textAnchor="middle" fontSize="65">
          {w.toFixed(1)} mm finished
        </text>
        <text x={w / 2} y={d + 110} textAnchor="middle" fontSize="60">
          {d.toFixed(1)} mm length
        </text>
      </svg>
      <figcaption>
        Proportional footprints from this revision. Door sweep, pipe routes and other obstructions
        are not drawn. Not a construction drawing.
      </figcaption>
    </figure>
  );
}
