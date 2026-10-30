import { useState } from 'react';
import {
  reviewLocations,
  type FindingGroup,
  type ReviewCitation,
  type ScopeReview,
} from '@renovagent/core';

// Where the codes come from: the recorded location, or one assumed here.
export function LocationPick({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="room3d-location">
      <span className="small-note">Location</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">As recorded</option>
        {reviewLocations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label} (assumed)
          </option>
        ))}
      </select>
    </label>
  );
}

// "Does this work?", the contractor handoff and the approval step for a design
// change, shown as cards over the room like the step popups.

const GROUPS: { key: FindingGroup; title: string; empty: string }[] = [
  {
    key: 'conflicts',
    title: 'Potential conflicts',
    empty: 'None found against the cited sources.',
  },
  { key: 'unresolved', title: 'To measure or confirm', empty: 'Nothing open.' },
  { key: 'passes', title: 'Passes known checks', empty: 'No checks could run yet.' },
];

function Cite({ c }: { c: ReviewCitation }) {
  const where = [c.edition, c.locator].filter(Boolean).join(', ');
  return (
    <li>
      {c.url ? (
        <a href={c.url} target="_blank" rel="noopener noreferrer">
          {c.title}
        </a>
      ) : (
        c.title
      )}
      {where && ` · ${where}`}
      {c.retrievedOn && ` · retrieved ${c.retrievedOn}`}
      {!c.reviewed && ' · unreviewed'}
    </li>
  );
}

function Close({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="room3d-close" aria-label="Close" onClick={onClose}>
      ×
    </button>
  );
}

export type JevRanking =
  | { status: 'working' }
  | { status: 'done'; model: string | null; relevance: Record<string, number | null> }
  | { status: 'error'; message: string };

// Below this, a code finding is folded away as less likely for this work.
const LOW = 0.15;

function Finding({
  f,
  relevance,
}: {
  f: ScopeReview['findings'][number];
  relevance?: number | null;
}) {
  return (
    <li>
      {relevance != null && (
        <span
          className={`room3d-jev ${relevance >= 0.5 ? 'is-high' : relevance >= LOW ? 'is-mid' : 'is-low'}`}
          title="Jev’s probability that this provision applies to this work (interpretation)"
        >
          {Math.round(relevance * 100)}%
        </span>
      )}
      <strong>{f.packageTitle}</strong> {f.summary}
      {f.group !== 'passes' && <em> {f.action}</em>}
      {f.citations.length > 0 && (
        <ul className="room3d-cites">
          {f.citations.map((c) => (
            <Cite key={c.id} c={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ReviewPopup({
  review,
  draftNote,
  location,
  onLocation,
  ranking,
  onRank,
  onClose,
}: {
  review: ScopeReview;
  draftNote: string | null;
  location: string;
  onLocation: (id: string) => void;
  ranking: JevRanking | null;
  onRank: () => void;
  onClose: () => void;
}) {
  const rel = ranking?.status === 'done' ? ranking.relevance : null;
  const score = (id: string) => rel?.[id] ?? null;
  return (
    <div className="room3d-popup room3d-review-card" role="dialog" aria-label="Does this work?">
      <header>
        <div>
          <span className="room3d-step-phase">Review</span>
          <h4>Does this work?</h4>
          <span className="small-note">
            {review.counts.conflicts} conflict{review.counts.conflicts === 1 ? '' : 's'} ·{' '}
            {review.counts.unresolved} to confirm · {review.counts.passes} pass
          </span>
        </div>
        <Close onClose={onClose} />
      </header>
      {draftNote && <p className="small-note">{draftNote}</p>}
      <div className="room3d-basis">
        <LocationPick value={location} onChange={onLocation} />
        <span
          className={review.codeBasis.adopted ? 'room3d-chip diy-easy' : 'room3d-chip diy-medium'}
        >
          {review.codeBasis.adopted ? 'Adopted code' : 'Model code'}
        </span>
        <span className="small-note">{review.codeBasis.label}</span>
      </div>
      <div className="room3d-basis">
        <button
          type="button"
          className="room3d-muse"
          disabled={ranking?.status === 'working'}
          onClick={onRank}
        >
          {ranking?.status === 'working'
            ? 'Jev is ranking…'
            : rel
              ? '✦ Ranked by Jev · re-rank'
              : '✦ Rank by relevance with Jev'}
        </button>
      </div>
      {ranking?.status === 'error' && (
        <p role="alert" className="small-note">
          {ranking.message}
        </p>
      )}
      {rel && (
        <p className="small-note">
          Percentages are the Jev model’s judgment ({ranking?.status === 'done' && ranking.model})
          of how likely each provision applies to this work: an interpretation, not a code
          determination. Findings without a code citation are not scored.
        </p>
      )}
      {GROUPS.map((g) => {
        const all = review.findings.filter((f) => f.group === g.key);
        // Ranked: code findings by relevance first, then the unscored ones (not
        // code questions), with code findings below LOW folded away.
        const items = rel
          ? [...all].sort((a, b) => (score(b.id) ?? -1) - (score(a.id) ?? -1))
          : all;
        const shown = rel ? items.filter((f) => (score(f.id) ?? 1) >= LOW) : items;
        const folded = rel ? items.filter((f) => (score(f.id) ?? 1) < LOW) : [];
        return (
          <section key={g.key} className={`room3d-findings is-${g.key}`}>
            <h5>{g.title}</h5>
            {shown.length ? (
              <ul>
                {shown.map((f) => (
                  <Finding key={f.id} f={f} relevance={score(f.id)} />
                ))}
              </ul>
            ) : (
              !folded.length && <p className="small-note">{g.empty}</p>
            )}
            {folded.length > 0 && (
              <details className="room3d-folded">
                <summary>
                  {folded.length} less likely for this work (under {Math.round(LOW * 100)}%)
                </summary>
                <ul>
                  {folded.map((f) => (
                    <Finding key={f.id} f={f} relevance={score(f.id)} />
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}
      <p className="small-note">
        {review.method} {review.limits[0]}
      </p>
    </div>
  );
}

export function HandoffPopup({
  markdown,
  fileName,
  onClose,
}: {
  markdown: string;
  fileName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="room3d-popup room3d-review-card" role="dialog" aria-label="Contractor handoff">
      <header>
        <div>
          <span className="room3d-step-phase">Handoff</span>
          <h4>Contractor handoff</h4>
          <span className="small-note">
            The work in order, measurements, sources, what to verify and reply fields.
          </span>
        </div>
        <Close onClose={onClose} />
      </header>
      <div className="room3d-use">
        <button type="button" className="primary" onClick={download}>
          Download (.md)
        </button>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(markdown)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <pre className="room3d-handoff">{markdown}</pre>
    </div>
  );
}

export type ChangeRow = { label: string; from: string; to: string };

export function ChangeConfirm({
  rows,
  busy,
  onApprove,
  onCancel,
}: {
  rows: ChangeRow[];
  busy: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="room3d-confirm" role="group" aria-label="Approve this change">
      <strong>Change the saved plan?</strong>
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th>{r.label}</th>
              <td>{r.from}</td>
              <td>→ {r.to}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small-note">Saved as a new proposed revision; the old one stays in history.</p>
      <div className="room3d-use">
        <button type="button" className="primary" disabled={busy} onClick={onApprove}>
          Approve and save
        </button>
        <button type="button" className="link-button subtle" onClick={onCancel}>
          Keep editing
        </button>
      </div>
    </div>
  );
}
