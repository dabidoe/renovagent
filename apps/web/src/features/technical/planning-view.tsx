import { MeasuredSketch } from './measured-sketch.js';
import { type Artifact, type Workspace } from '@unpermitted/contracts';
import { taskReadiness, referenceCurrent } from '@unpermitted/core';
export function PlanningView({ artifact, state }: { artifact: Artifact; state?: Workspace }) {
  const p = artifact.payload;
  switch (p.kind) {
    case 'planning-inputs':
      return (
        <>
          <p className="investigation-banner">
            {p.basis === 'example' ? 'Synthetic example inputs' : 'User-reported inputs'} ·{' '}
            {p.group} · no professional verification
          </p>
          <pre className="input-record">{JSON.stringify(p.inputs[p.group], null, 2)}</pre>
        </>
      );
    case 'planning-sources':
      return (
        <>
          <p>
            Source package {p.version}. Metadata and paraphrase hashes only; no full code ingestion.
            Qualified reviewer: none. Source access and professional review are separate.
          </p>
          {p.sources.map((s) => (
            <section className="source-record" key={s.id}>
              <h3>{s.title}</h3>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.locator} ↗
              </a>
              <p>{s.paraphrase}</p>
              <p>
                {s.edition} · {s.access} · {s.review} · retrieved {s.retrievedAt.slice(0, 10)}
              </p>
              <p>
                {s.publication || 'Legacy metadata'} · {s.interpretation || s.access} · authority:{' '}
                {s.authority || 'See source'}
              </p>
              {s.coverageWindow && (
                <p>
                  Curated execution coverage: {s.coverageWindow.from} through{' '}
                  {s.coverageWindow.through}. Earlier amendment effective-date reconciliation still
                  needs review.
                </p>
              )}
              {s.reviewNeeded && (
                <details>
                  <summary>Still requires qualified review</summary>
                  <ul>
                    {s.reviewNeeded.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
              )}
              <details>
                <summary>Record identity</summary>
                <code>
                  {s.id} / {s.version}
                </code>
                <p className="hash-text">SHA-256 of curated paraphrase: {s.contentHash}</p>
              </details>
            </section>
          ))}
        </>
      );
    case 'measured-layout':
    case 'quantity-takeoff':
      return (
        <>
          <p className="investigation-banner">
            {p.status.replaceAll('_', ' ')} · deterministic method {p.algorithm}
          </p>
          {p.kind === 'quantity-takeoff' && (
            <p>
              Specification: {p.specification || 'unknown'}. Source task: {p.taskIds.join(', ')}.
              Quantities remain provisional until the technical scope is resolved.
            </p>
          )}
          {p.kind === 'measured-layout' && <MeasuredSketch artifact={artifact} state={state} />}
          <div className="calculation-grid">
            {p.traces.map((t) => (
              <section className="calculation-card" key={t.label}>
                <span>{t.label}</span>
                <strong>
                  {t.value === null
                    ? 'Unknown'
                    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(
                        t.value,
                      )}{' '}
                  <small>{t.value === null ? '' : t.unit}</small>
                </strong>
                <p>{t.formula}</p>
              </section>
            ))}
          </div>
          <h3>
            {p.kind === 'measured-layout'
              ? 'Unresolved inputs and conflicts'
              : 'Needed before quantity release'}
          </h3>
          <ul>
            {(p.kind === 'measured-layout' ? p.issues : p.missing).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          {p.kind === 'measured-layout' && (
            <>
              <h3>Method limits</h3>
              <ul>
                {p.limitations.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </>
          )}
        </>
      );
    case 'code-assessment':
      return (
        <>
          <p className="investigation-banner">
            Review incomplete · no qualified domain review · {p.playbook}
          </p>
          {p.locality && p.assessmentArea !== 'drainage' && (
            <section className="local-context-card">
              <p className="eyebrow">
                REPORTED PROPERTY CONTEXT · {p.locality.status.replaceAll('_', ' ')}
              </p>
              <h3>
                {[
                  p.locality.reported.municipality,
                  p.locality.reported.regionCode,
                  p.locality.reported.countryCode,
                ]
                  .filter(Boolean)
                  .join(', ') || 'Local authority unresolved'}
              </h3>
              <p>
                Candidate authority: {p.locality.authority || 'Not selected'}. Boundary basis:{' '}
                {p.locality.reported.boundaryBasis}. Postal code:{' '}
                {p.locality.reported.postalCode || 'unknown'}.
              </p>
              <ul>
                {p.locality.unresolved.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <details>
                <summary>
                  How locality will constrain code, pricing, shopping and contractor research
                </summary>
                {p.locality.uses.map((use) => (
                  <div key={use.purpose}>
                    <h4>{use.purpose} · not verified</h4>
                    <ul>
                      {use.requiredEvidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </details>
            </section>
          )}
          {p.codeBasis && (
            <section className="code-basis-card">
              <h3>
                General basis: {p.codeBasis.generalEdition || 'unresolved'} · accessibility basis:{' '}
                {p.codeBasis.accessibilityEdition}
              </h3>
              <p>{p.codeBasis.decision}</p>
              <ul>
                {p.codeBasis.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                Reported inputs select candidates. Qualified applicability review is still required.
              </p>
            </section>
          )}
          {p.checks.map((c) => (
            <section className="technical-check-card" key={c.id}>
              <div className="section-heading-row">
                <h3>{c.title}</h3>
                <span className="status warning-status">{c.status.replaceAll('_', ' ')}</span>
              </div>
              <p>
                <strong>Applicability: {c.applicability}.</strong> {c.rationale}
              </p>
              {c.mapping && (
                <div className="check-evaluation">
                  <strong>
                    Adopted-section mapping · {c.mapping.status.replaceAll('-', ' ')} · unreviewed
                  </strong>
                  <p>
                    {c.mapping.edition} · {c.mapping.locator}
                  </p>
                  <p>{c.mapping.finding}</p>
                </div>
              )}
              {c.referenceCriteria && (
                <div className="check-evaluation">
                  <strong>Source criteria · qualified compliance review blocked</strong>
                  <ul>
                    {c.referenceCriteria.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {!c.referenceCriteria.length && (
                    <p>
                      Source unavailable for this work. Restore the source basis before using its
                      criteria.
                    </p>
                  )}
                </div>
              )}
              {c.evaluation && (
                <div className="check-evaluation">
                  <strong>{c.evaluation.outcome.replaceAll('-', ' ')}</strong>
                  <p>
                    Observed: {c.evaluation.observed === null ? 'unknown' : c.evaluation.observed}{' '}
                    {c.evaluation.unit} · Required by selected method:{' '}
                    {c.evaluation.required === null ? 'not evaluated' : c.evaluation.required}{' '}
                    {c.evaluation.unit}
                  </p>
                  <p>{c.evaluation.method}</p>
                  <ul>
                    {c.evaluation.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <ul>
                {c.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              {c.sourceIds.map((id) => {
                const source = Object.values(state?.artifacts || {})
                  .flatMap((v) =>
                    v.filter((a) =>
                      artifact.inputRefs.some((r) => r.id === a.id && r.revision === a.revision),
                    ),
                  )
                  .flatMap((a) => (a.payload.kind === 'planning-sources' ? a.payload.sources : []))
                  .find((s) => s.id === id);
                return (
                  <p key={id}>
                    {source ? (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.edition} · {source.locator} · {source.access} /{' '}
                        {source.interpretation || source.access} ↗
                      </a>
                    ) : (
                      id
                    )}
                  </p>
                );
              })}
            </section>
          ))}
          {p.requirements && (
            <details className="requirement-register">
              <summary>
                Inspect exact requirement and amendment records ({p.requirements.length})
              </summary>
              {p.requirements.map((r) => (
                <section key={r.id}>
                  <h3>{r.title}</h3>
                  <p>
                    {r.edition} · {r.relationship} · {r.coverage} · {r.review}
                  </p>
                  <p>Source IDs: {r.sourceIds.join(', ')}</p>
                  <h4>Applies only when</h4>
                  <ul>
                    {r.conditions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <h4>Exceptions / limits</h4>
                  <ul>
                    {r.exceptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </details>
          )}
          <h3>Coverage matrix</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Coverage</th>
                  <th>Limit</th>
                </tr>
              </thead>
              <tbody>
                {p.coverage.map((c) => (
                  <tr key={c.topic}>
                    <td>{c.topic}</td>
                    <td>{c.status}</td>
                    <td>{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
    case 'cost-plan':
      return (
        <>
          <p className="investigation-banner">
            Partial floor-material cost only · {p.status.replaceAll('_', ' ')}
          </p>
          <div className="calculation-card">
            <span>Known floor packages × sourced package price</span>
            <strong>
              {p.totalMinor === null
                ? 'Unknown'
                : new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: p.currency,
                  }).format(p.totalMinor / 100)}
            </strong>
          </div>
          <p>
            Price basis: {p.priceSource || 'No source supplied'} · {p.priceDate || 'No price date'}{' '}
            · {p.currency}. No live price lookup.
          </p>
          <h3>Excluded from this total</h3>
          <p>{p.exclusions.join(' · ')}</p>
        </>
      );
    case 'gated-plan':
      return (
        <>
          <p className="investigation-banner">
            Computed readiness · {p.playbook}. No construction release or completion is recorded.
          </p>
          <ol className="task-outline">
            {taskReadiness(
              p.tasks,
              state
                ? referenceCurrent(state, artifact.projectId, {
                    kind: 'artifact',
                    id: artifact.id,
                    revision: artifact.revision,
                  })
                : false,
            ).map((t, i) => (
              <li key={t.id}>
                <span className="task-number">{i + 1}</span>
                <div>
                  <h3>{t.title}</h3>
                  <span className="status muted-status">
                    {t.readiness === 'ready' ? 'Ready for evidence collection' : 'Blocked'}
                  </span>
                  <p>
                    {t.reasons.join(' · ') ||
                      'Evidence collection can begin; no physical work authorized.'}
                  </p>
                  <p>Completion requires: {t.completionEvidence}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      );
    default:
      return null;
  }
}
