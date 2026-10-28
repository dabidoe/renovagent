import { homeInventory, inventoryDirections } from './home-inventory.js';
import { candidateRoles, candidateMeasurement, candidateCheck } from './candidate-measurements.js';
import { photoQuestions } from './photo-answers.js';
import { referenceCurrent } from '../domain/invalidate.js';
import {
  type Workspace,
  type CommandContext,
  type InputRef,
  type Artifact,
} from '@unpermitted/contracts';
import { propertyAddress } from './property-research.js';
import { inputSignature } from '../domain/input-context.js';
import { fingerprint } from '../domain/canonical-json.js';
export function researchForArtifact(state: Workspace, artifact: Artifact) {
  for (const ref of artifact.inputRefs) {
    if (ref.kind !== 'artifact') continue;
    const source = state.artifacts[ref.id]?.find(
      (a) => a.revision === ref.revision && a.projectId === artifact.projectId,
    );
    if (source?.payload.kind === 'property-research') return source.payload;
  }
  return null;
}
export function refreshPropertyBrief(state: Workspace, projectId: string, ctx: CommandContext) {
  const address = propertyAddress(state, projectId);
  if (!address || address.value.kind !== 'text') return;
  const project = state.projects[projectId];
  const facts = Object.values(state.facts)
    .map((v) => v.at(-1)!)
    .filter(
      (f) =>
        f.propertyId === project.propertyId && (f.projectId === null || f.projectId === projectId),
    );
  const research = state.artifacts[`${projectId}:property-research`]?.at(-1);
  const usable =
    research?.payload.kind === 'property-research' &&
    referenceCurrent(state, projectId, {
      kind: 'artifact',
      id: research.id,
      revision: research.revision,
    }) &&
    research.inputRefs.some((r) => r.id === address.id && r.revision === address.revision);
  const notes = state.messages
    .filter(
      (m) =>
        m.projectId === projectId &&
        m.role === 'user' &&
        !m.artifactRefs.some((r) => {
          const a = state.artifacts[r.id]?.find((v) => v.revision === r.revision);
          return (
            (a?.payload.kind === 'photo-planning-answer' ||
              a?.payload.kind === 'inventory-direction') &&
            !referenceCurrent(state, projectId, r)
          );
        }),
    )
    .slice(-3);
  const files = Object.values(state.evidence).filter(
    (e) => e.projectId === projectId && e.source.attachment,
  );
  const goal = facts.find((f) => f.key === 'goal');
  const p = usable && research?.payload.kind === 'property-research' ? research.payload : null;
  const questions = p ? photoQuestions(state, projectId) : [];
  const answers = questions.flatMap((q) =>
    q.answer?.payload.kind === 'photo-planning-answer' ? [q.answer] : [],
  );
  const pending = questions.filter(
    (q) =>
      !q.answer ||
      q.answer.payload.kind !== 'photo-planning-answer' ||
      q.answer.payload.disposition !== 'direction',
  );
  const oldAnswerCount = Object.values(state.artifacts).filter((v) => {
    const a = v.at(-1)!;
    return (
      a.projectId === projectId &&
      a.payload.kind === 'photo-planning-answer' &&
      !answers.some((current) => current.id === a.id)
    );
  }).length;
  const surveys = candidateRoles.flatMap((role) => {
    const a = candidateMeasurement(state, projectId, role.id),
      check = candidateCheck(state, projectId, role.id);
    return a &&
      a.payload.kind === 'candidate-measurements' &&
      referenceCurrent(state, projectId, { kind: 'artifact', id: a.id, revision: a.revision })
      ? [{ a, check }]
      : [];
  });
  const inventory = homeInventory(state, projectId);
  const currentInventory =
    inventory &&
    referenceCurrent(state, projectId, {
      kind: 'artifact',
      id: inventory.id,
      revision: inventory.revision,
    })
      ? inventory
      : undefined;
  const elementDirections = currentInventory
    ? inventoryDirections(state, projectId, currentInventory).filter((a) =>
        referenceCurrent(state, projectId, { kind: 'artifact', id: a.id, revision: a.revision }),
      )
    : [];
  const payload = {
    kind: 'project-brief' as const,
    sections: [
      { title: 'The project', text: goal?.value.kind === 'text' ? goal.value.text : project.name },
      {
        title: 'The property',
        text: `${address.value.text}\n${
          p
            ? p.findings
                .filter((f) => !f.blockedReason)
                .slice(0, 8)
                .map((f) => `${f.label}: ${f.value} (${f.sourceId}; unreviewed). ${f.limit}`)
                .join('\n')
            : 'Public records have not been added yet. Building and room dimensions remain unknown.'
        }\n${p?.findings.filter((f) => f.blockedReason).length || 0} blocked finding(s) excluded; inspect the research record for reasons.\n${files.length} local reference file(s); not analyzed.`,
      },
      ...(p?.images.some((i) => !i.blockedReason)
        ? [
            {
              title: p.photoReview
                ? 'Muse visual review and site checks'
                : 'Visual references and site checks',
              text:
                (p.photoReview
                  ? `${p.photoReview.photos.filter((photo) => photo.status === 'reviewed').length}/${p.photoReview.photos.length} source photos inspected through attached-image runs. All visual proposals remain unreviewed.\n`
                  : '') +
                p.images
                  .filter((i) => !i.blockedReason)
                  .slice(0, 6)
                  .map(
                    (i) =>
                      `${i.title}${i.locator ? ' · ' + i.locator : ''}. ${i.planningUse || 'Confirm current conditions and collect measured details before design.'} (${i.sourceId}; unreviewed reference, not a measured survey)`,
                  )
                  .join('\n'),
            },
          ]
        : []),
      ...(questions.length || oldAnswerCount
        ? [
            {
              title: 'Your direction from the photo review',
              text:
                questions
                  .map((q) => {
                    const a = q.answer?.payload;
                    return `${q.index + 1}. ${q.text}\n${a?.kind === 'photo-planning-answer' ? `${a.disposition === 'direction' ? 'Direction captured' : a.disposition === 'unsure' ? 'Still unsure' : 'Deferred'} · response r${q.answer!.revision}: ${a.answer}` : 'Awaiting your response'}\nPhotos: ${q.photoIds.join(', ')} · Muse review r${q.research.revision}; visual interpretation unreviewed. User responses are reported preferences, not verified site facts.`;
                  })
                  .join('\n\n') +
                (oldAnswerCount
                  ? `\n${oldAnswerCount} earlier response(s) need reconfirmation against current research; excluded from current direction.`
                  : ''),
            },
          ]
        : []),
      ...(surveys.length
        ? [
            {
              title: 'Candidate measurements',
              text: surveys
                .map(({ a, check }) =>
                  a.payload.kind === 'candidate-measurements'
                    ? `${a.payload.survey.label} · ${a.payload.basis} · survey r${a.revision} · ${a.payload.survey.measurement} boundaries. ${Object.entries(
                        a.payload.survey.values,
                      )
                        .map(([key, v]) => `${key}: ${v ? `${v.amount} ${v.unit}` : 'unknown'}`)
                        .join(
                          '; ',
                        )}. Method: ${a.payload.survey.method}. ${check?.payload.kind === 'candidate-checks' ? `Still needed: ${check.payload.missing.join('; ') || 'detailed layout and qualified review'}.` : 'Candidate checks unavailable.'} Feasibility and construction remain blocked.`
                    : '',
                )
                .join('\n\n'),
            },
          ]
        : []),
      ...(currentInventory?.payload.kind === 'photo-inventory'
        ? [
            {
              title: 'Element decisions and next evidence',
              text:
                elementDirections
                  .map((a) => {
                    const d = a.payload;
                    if (d.kind !== 'inventory-direction') return '';
                    const item =
                      currentInventory.payload.kind === 'photo-inventory'
                        ? currentInventory.payload.items.find((i) => i.id === d.itemId)
                        : undefined;
                    return `${d.correctedLabel || item?.label || d.itemId}: ${d.disposition}; identification ${d.identification}. ${d.note} ${d.disposition === 'exclude' ? 'Excluded as a rejected identification.' : `Next evidence (unreviewed Muse proposal): ${item?.nextAction || 'Inspect on site.'}`} No physical work released.`;
                  })
                  .join('\n') ||
                'Review a visible element and record what to retain, replace or investigate. Model regions and identifications remain unreviewed.',
            },
          ]
        : []),
      {
        title: 'What you’ve told us',
        text:
          notes.map((m) => m.text).join('\n\n') ||
          'Add your priorities, constraints or observations in the conversation.',
      },
      {
        title: 'Next useful work',
        text:
          (questions.length
            ? [
                ...pending.map((q) => `Clarify question ${q.index + 1}: ${q.text}`),
                ...(pending.length
                  ? []
                  : ['Review the captured direction together before developing options.']),
                ...(p?.photoReview?.planning?.nextSteps || []).map(
                  (step) =>
                    `${step.kind === 'user-choice' ? 'Reconcile with reported direction' : step.kind === 'site-measurement' ? 'Measurement still required' : 'Qualified review still required'}: ${step.text} (photos ${step.photoIds.join(', ')}; Muse proposal, unverified)`,
                ),
              ]
            : p?.nextQuestions.length
              ? p.nextQuestions
              : [
                  'Add current photos and establish the room or part of the house being changed.',
                  'Collect measured room dimensions and existing service observations before technical planning.',
                ]
          ).join('\n') +
          '\nQualified review of applicable technical requirements and affected systems remains open. Then compare options, resolve technical requirements and prepare the job. No construction work is released.',
      },
    ],
  };
  const inputRefs: InputRef[] = [
    ...(currentInventory
      ? [
          {
            kind: 'artifact' as const,
            id: currentInventory.id,
            revision: currentInventory.revision,
          },
        ]
      : []),
    ...elementDirections.map((a) => ({
      kind: 'artifact' as const,
      id: a.id,
      revision: a.revision,
    })),
    ...surveys.flatMap(({ a, check }) => [
      { kind: 'artifact' as const, id: a.id, revision: a.revision },
      ...(check ? [{ kind: 'artifact' as const, id: check.id, revision: check.revision }] : []),
    ]),
    ...answers.map((a) => ({ kind: 'artifact' as const, id: a.id, revision: a.revision })),
    ...facts.map((f) => ({ kind: 'fact' as const, id: f.id, revision: f.revision })),
    ...notes
      .filter((m) => state.evidence[m.id])
      .map((m) => ({ kind: 'evidence' as const, id: m.id, revision: 1 })),
    ...files.map((e) => ({ kind: 'evidence' as const, id: e.id, revision: 1 })),
    ...(p && research
      ? [{ kind: 'artifact' as const, id: research.id, revision: research.revision }]
      : []),
  ];
  const id = `${projectId}:working-brief`,
    old = state.artifacts[id]?.at(-1);
  if (
    old &&
    fingerprint(old.payload) === fingerprint(payload) &&
    fingerprint(old.inputRefs) === fingerprint(inputRefs)
  )
    return;
  (state.artifacts[id] ||= []).push({
    schemaVersion: 1,
    id,
    projectId,
    revision: (old?.revision || 0) + 1,
    lifecycle: 'proposed',
    freshness: 'current',
    inputRefs,
    evidenceIds: [],
    payload,
    contextSignature: inputSignature(state, projectId),
    createdAt: ctx.now,
    acceptedAt: null,
  });
  return id;
}
