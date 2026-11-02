import { emptyPlanningInputs, type PlanningInputs } from '@renovagent/contracts';
import {
  assessCode,
  assessDrainage,
  determineCodeBasis,
  resolveLocalContext,
  sourceCaptureDate,
  sourceSetVersion,
  technicalRequirements,
  technicalSources,
} from '@renovagent/core';

const coverageNotice =
  'Local code coverage is available for Philadelphia, PA in this preview. Add your property address to check.';

// A source/review brief only. No address parsing, inferred filing facts or new rules.
export function LocalCodeCard({
  address,
  inputs = emptyPlanningInputs(),
}: {
  address: string;
  inputs?: PlanningInputs;
}) {
  const locality = resolveLocalContext(inputs.context);
  if (locality.jurisdictionId !== 'us-pa-philadelphia')
    return (
      <section className="pf-local-code" aria-label="Local Building code">
        <h3>Local code</h3>
        <p>{coverageNotice}</p>
      </section>
    );

  const basis = determineCodeBasis(inputs.context);
  const assessment = assessCode(inputs);
  const halfBath = inputs.context.scope === 'new-half-bath';
  // Other studio scopes have no plumbing applicability determination. Show only
  // the captured permit records as a question, never a half-bath exemption/result.
  const checks = halfBath
    ? [
        ...assessment.checks.filter((check) => check.id !== 'plumbing-basis'),
        ...assessDrainage(inputs).checks,
      ]
    : assessment.checks.filter((check) => check.id === 'permit-path');
  const adoptionIds = ['pa-ucc', 'phila-adoption', 'phila-transition', 'phila-plumbing-scope'];
  const selectedIds = new Set([...adoptionIds, ...checks.flatMap((check) => check.sourceIds)]);
  const sources = technicalSources.filter((source) => selectedIds.has(source.id));
  const reviewNeeds = [
    ...new Set([
      ...basis.missing,
      ...checks.flatMap((check) => check.missing),
      ...sources.flatMap((source) => source.reviewNeeded ?? []),
      ...(halfBath ? assessment.coverage.map((record) => record.reason) : []),
    ]),
  ];
  const sourceLinks = (ids: string[]) => (
    <ul className="pf-code-sources">
      {ids.map((id) => {
        const source = technicalSources.find((record) => record.id === id)!;
        const unavailable =
          source.access === 'unavailable' ||
          inputs.context.sourceAvailability === 'unavailable' ||
          inputs.context.unavailableSourceIds.includes(id);
        const coverageUnavailable = technicalRequirements.some(
          (requirement) =>
            requirement.coverage === 'unavailable' && requirement.sourceIds.includes(id),
        );
        return (
          <li key={id}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title} ↗
            </a>
            <small>{source.locator}</small>
            <span className="pf-code-status">{source.review}</span>
            {(unavailable || coverageUnavailable) && (
              <span className="pf-code-status">
                {unavailable ? 'unavailable' : 'coverage: unavailable'}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
  const captured = new Date(`${sourceCaptureDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <section className="pf-local-code" aria-label="Local Building code">
      <h3>Local code — {locality.reported.municipality}, PA</h3>
      <p>Reported address: {address}. Reported locality; not geocoded.</p>
      <details>
        <summary>What governs this work</summary>
        {sourceLinks(adoptionIds)}
        <p>{basis.decision}</p>
        {basis.generalEdition && <p>Candidate general edition: {basis.generalEdition}</p>}
      </details>
      <details>
        <summary>What this means for your project</summary>
        {!halfBath && (
          <p>
            Check whether this work needs a permit. Captured plumbing records; applicability
            unresolved.
          </p>
        )}
        {checks.map((check) => (
          <div className="pf-code-record" key={check.id}>
            <strong>{check.title}</strong> <span className="pf-code-status">{check.status}</span>
            {sourceLinks(check.sourceIds)}
          </div>
        ))}
      </details>
      <details>
        <summary>Still needs a pro</summary>
        <ul>
          {reviewNeeds.map((need) => (
            <li key={need}>{need}</li>
          ))}
        </ul>
      </details>
      <footer>
        <span>Sources captured {captured} · Not yet reviewed by a licensed professional</span>
        <small>{sourceSetVersion}</small>
      </footer>
    </section>
  );
}
