import type { ScopeDraft, ScopeRequirement } from '@renovagent/contracts';

// Read-only scope draft: what the job includes, what each requirement is for,
// how much (or why the quantity is still open) and where that comes from.

const STATUS: Record<ScopeRequirement['status'], string> = {
  quantified: 'Quantified',
  'needs-input': 'Needs a measurement',
  'needs-product-spec': 'Needs the selected product',
  conditional: 'Conditional',
  'needs-source': 'Allowance unset',
};

const SOURCE_LABEL: Record<ScopeDraft['inputs'][number]['source'], string> = {
  'workspace-fact': 'recorded fact',
  'agent-relayed': 'relayed by your agent · unverified',
  'reported-unknown': "you said you don't know",
  'not-provided': 'not provided yet',
};

function quantity(r: ScopeRequirement): string {
  return r.quantity === null ? '—' : `${r.quantity} ${r.unit}`;
}

export function ScopeDraftView({ draft }: { draft: ScopeDraft }) {
  const included = draft.packages.filter((p) => p.included);
  const quantified = draft.requirements.filter((r) => r.status === 'quantified').length;
  const catalogued = draft.requirements.filter((r) => r.catalog).length;
  const sources = new Map(draft.sources.map((s) => [s.id, s]));
  return (
    <div className="document-sections">
      <div className="investigation-banner">
        Draft scope · recipe {draft.recipe.id} v{draft.recipe.version} · not a site survey or
        technical review
      </div>
      <p className="work-lede">“{draft.request}”</p>
      <p>
        {included.length} work packages · {draft.requirements.length} requirements · {quantified}{' '}
        quantified · {catalogued} matched to catalog categories. Not priced here:{' '}
        {draft.notPriced.join(', ').toLowerCase()}.
      </p>
      {draft.questions.length > 0 && (
        <section>
          <div>
            <h3>Next useful questions</h3>
            <ol>
              {draft.questions.map((q) => (
                <li key={q.question}>
                  {q.question}{' '}
                  <span className="small-note">· unblocks {q.unblocks} requirements</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
      <section>
        <div>
          <h3>Inputs</h3>
          <ul>
            {draft.inputs.map((input) => (
              <li key={input.key}>
                {input.label}: {input.amount === null ? 'unknown' : `${input.amount} ${input.unit}`}{' '}
                <span className="small-note">· {SOURCE_LABEL[input.source]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {included.map((pkg, index) => {
        const items = draft.requirements.filter((r) => r.packageId === pkg.id);
        return (
          <section key={pkg.id} aria-label={pkg.title}>
            <span className="section-number">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>{pkg.title}</h3>
              <p className="small-note">{pkg.summary}</p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>Quantity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.purpose}
                          {r.category === 'task' && ' (work)'}
                          <div className="small-note">{r.specification}</div>
                          {r.condition && <div className="small-note">If: {r.condition}</div>}
                          <div className="small-note">
                            Source:{' '}
                            {r.sourceIds.map((id) => sources.get(id)?.title ?? id).join('; ')}
                            {r.codeTopics.length > 0 && ` · verify: ${r.codeTopics.join(', ')}`}
                          </div>
                        </td>
                        <td>
                          {quantity(r)}
                          <div className="small-note">{r.quantityBasis}</div>
                        </td>
                        <td>
                          {STATUS[r.status]}
                          {r.blockedBy.length > 0 && (
                            <div className="small-note">Waiting on: {r.blockedBy.join(', ')}</div>
                          )}
                          <div className="small-note">
                            {r.catalog ? `Catalog: ${r.catalog.category}` : 'Unpriced'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })}
      <section>
        <div>
          <h3>Sources</h3>
          <ul>
            {draft.sources.map((s) => (
              <li key={s.id}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title} ↗
                  </a>
                ) : (
                  s.title
                )}{' '}
                <span className="small-note">
                  · {s.publisher} ·{' '}
                  {s.retrieval === 'search-excerpt'
                    ? `search excerpt ${s.retrievedOn ?? ''}, document not opened`
                    : s.retrieval === 'fetched'
                      ? `retrieved ${s.retrievedOn ?? ''}`
                      : 'internal reference, unreviewed'}{' '}
                  · {s.supports}
                </span>
              </li>
            ))}
          </ul>
          {draft.limits.map((limit) => (
            <p key={limit} className="small-note">
              {limit}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
