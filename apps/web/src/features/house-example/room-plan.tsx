import { StudioError } from './studio-error.js';
import { useState } from 'react';
import { studioItemSchema, type StudioItem } from '@renovagent/contracts';
import { studioItemBudget } from '@renovagent/core';
import { money } from './paint-floor.js';
import { shopLinks } from './shop-links.js';

export type StudioHandoff = {
  markdown: string;
  coverage: string;
  sourceRevision: number;
  roomId: string;
  questions: string[];
  checks: { status: string; message: string }[];
};

function Allowance({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  const [entry, setEntry] = useState(value === null ? '' : String(value / 100));
  return (
    <label>
      Allowance each · $
      <input
        type="text"
        inputMode="decimal"
        placeholder="Not priced"
        value={entry}
        onChange={(e) => {
          const text = e.target.value;
          setEntry(text);
          const valid = /^\d+(?:\.\d{0,2})?$/.test(text) && Number(text) <= 1_000_000;
          onChange(valid ? Math.round(Number(text) * 100) : null);
        }}
      />
    </label>
  );
}

export function RoomPlan({
  items,
  onChange,
  finishesMinor,
  finishesIncomplete = false,
  onPrepare,
  versionKey,
}: {
  items: StudioItem[];
  onChange: (items: StudioItem[]) => void;
  finishesMinor: number;
  finishesIncomplete?: boolean;
  onPrepare: () => Promise<StudioHandoff>;
  versionKey: string;
}) {
  const [name, setName] = useState('');
  const [handoff, setHandoff] = useState<{ data: StudioHandoff; version: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const budget = studioItemBudget(items);
  const patch = (id: string, data: Partial<StudioItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...data } : i)));
  const prepare = async () => {
    setBusy(true);
    setError('');
    try {
      setHandoff({ data: await onPrepare(), version: versionKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare the work plan');
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    if (!handoff) return;
    const url = URL.createObjectURL(new Blob([handoff.data.markdown], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'renovagent-room-work-plan.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return (
    <div className="pf-room-plan">
      <section className="pf-work-plan">
        <div className="pf-group-head">
          <h3>The work behind the room</h3>
        </div>
        <p>Prepare the paint-and-floor scope, checks and open questions from this saved design.</p>
        <button
          type="button"
          className="pf-inspo-go"
          disabled={busy}
          onClick={() => void prepare()}
        >
          {busy ? 'Preparing…' : handoff ? 'Update work plan' : 'Save & prepare work plan'}
        </button>
        {error && <StudioError message={error} className="pf-error-inline" />}
        {handoff && (
          <div>
            {handoff.version !== versionKey && (
              <p className="pf-styling-stale">
                Choices changed. Update this work plan before using it.
              </p>
            )}
            <p className="pf-inspo-note">{handoff.data.coverage}</p>
            {handoff.data.questions.length > 0 && (
              <ul>
                {handoff.data.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="pf-reset"
              disabled={handoff.version !== versionKey}
              onClick={download}
            >
              Download work plan
            </button>
            <details>
              <summary>Read the proposed handoff</summary>
              <pre>{handoff.data.markdown}</pre>
            </details>
          </div>
        )}
      </section>
      <div className="pf-budget-card">
        <p>Budget so far</p>
        <strong>{money(finishesMinor + budget.allowanceMinor)}</strong>
        <dl>
          <div>
            <dt>Paint & floor · demo materials</dt>
            <dd>{finishesIncomplete ? 'Needs measurements' : money(finishesMinor)}</dd>
          </div>
          <div>
            <dt>Your item allowances</dt>
            <dd>{money(budget.allowanceMinor)}</dd>
          </div>
        </dl>
        <small>
          {budget.unpriced
            ? `${budget.unpriced} item${budget.unpriced === 1 ? '' : 's'} still to price · `
            : ''}
          Labour, tax & delivery separate
        </small>
      </div>
      <div className="pf-group-head">
        <h3>Your room list</h3>
        <span>{items.length} items</span>
      </div>
      <form
        className="pf-add-item"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onChange([
            ...items,
            studioItemSchema.parse({
              id: crypto.randomUUID(),
              name: name.trim(),
              category: 'furniture',
              action: 'add',
              quantity: null,
              unitAllowanceMinor: null,
            }),
          ]);
          setName('');
        }}
      >
        <input
          aria-label="Add a furniture or decor item"
          maxLength={200}
          placeholder="Sofa, rug, pendant light…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={!name.trim() || items.length >= 100}>
          Add
        </button>
      </form>
      {!items.length && (
        <p className="pf-plan-empty">
          Build your room list here, or create a design to start with its proposed items.
        </p>
      )}
      <div className="pf-room-items">
        {items.map((item) => (
          <article key={item.id} className="pf-room-item">
            <div className="pf-item-title">
              <input
                aria-label={`Item name: ${item.name}`}
                maxLength={200}
                value={item.name}
                onChange={(e) => {
                  if (e.target.value.trim()) patch(item.id, { name: e.target.value });
                }}
              />
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
              >
                ×
              </button>
            </div>
            <div className="pf-item-actions" role="group" aria-label={`Plan for ${item.name}`}>
              {(['add', 'replace', 'keep'] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  aria-pressed={item.action === action}
                  onClick={() => patch(item.id, { action })}
                >
                  {action === 'keep' ? 'Keep mine' : action === 'replace' ? 'Replace' : 'Add new'}
                </button>
              ))}
            </div>
            {item.action !== 'keep' && (
              <div className="pf-item-numbers">
                <label>
                  Quantity
                  <input
                    aria-label={`Quantity for ${item.name}`}
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={item.quantity ?? ''}
                    placeholder="Unknown"
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      patch(item.id, {
                        quantity: Number.isInteger(n) && n > 0 && n <= 1000 ? n : null,
                      });
                    }}
                  />
                </label>
                <Allowance
                  value={item.unitAllowanceMinor}
                  onChange={(unitAllowanceMinor) => patch(item.id, { unitAllowanceMinor })}
                />
                <strong>
                  {budget.lines.find((l) => l.id === item.id)?.totalMinor == null
                    ? '—'
                    : money(budget.lines.find((l) => l.id === item.id)!.totalMinor!)}
                  <small>
                    {budget.lines.find((l) => l.id === item.id)?.totalMinor === null
                      ? 'Not priced'
                      : 'Your allowance'}
                  </small>
                </strong>
              </div>
            )}
            <details className="pf-item-source">
              <summary>{item.url ? 'Your product link' : 'Find it / add a product link'}</summary>
              <div className="pf-item-shops">
                Search:{' '}
                {shopLinks(item.name).map((link) => (
                  <a key={link.store} href={link.href} target="_blank" rel="noreferrer">
                    {link.store} ↗
                  </a>
                ))}
              </div>
              <small>Store searches · confirm the product and fit.</small>
              <input
                type="url"
                aria-label={`Product link for ${item.name}`}
                placeholder="Paste the product page"
                defaultValue={item.url ?? ''}
                onBlur={(e) => {
                  const url = e.target.value.trim();
                  const checked = studioItemSchema.safeParse({ ...item, url: url || undefined });
                  if (checked.success) {
                    patch(item.id, { url: checked.data.url });
                    e.target.setCustomValidity('');
                  } else {
                    e.target.setCustomValidity(
                      'Use an http or https product page without credentials',
                    );
                    e.target.reportValidity();
                  }
                }}
              />
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer">
                  Open your link ↗
                </a>
              )}
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
