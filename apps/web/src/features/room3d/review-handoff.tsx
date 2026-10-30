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

export function ReviewPopup({
  review,
  draftNote,
  location,
  onLocation,
  onClose,
}: {
  review: ScopeReview;
  draftNote: string | null;
  location: string;
  onLocation: (id: string) => void;
  onClose: () => void;
}) {
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
      {GROUPS.map((g) => {
        const items = review.findings.filter((f) => f.group === g.key);
        return (
          <section key={g.key} className={`room3d-findings is-${g.key}`}>
            <h5>{g.title}</h5>
            {items.length ? (
              <ul>
                {items.map((f) => (
                  <li key={f.id}>
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
                ))}
              </ul>
            ) : (
              <p className="small-note">{g.empty}</p>
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
