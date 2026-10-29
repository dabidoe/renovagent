import { type Workspace } from '@renovagent/contracts';
import {
  photoQuestions,
  scopeQuestionBindings,
  referenceCurrent,
  candidateMeasurement,
  scopePlanningCoverage,
} from '@renovagent/core';

/** Presentation of current records only. Never infers preferences from free text. */
export function homePlanModel(state: Workspace, projectId: string) {
  const questions = photoQuestions(state, projectId).sort(
    (a, b) =>
      scopeQuestionBindings.findIndex((text) => text === a.text) -
      scopeQuestionBindings.findIndex((text) => text === b.text),
  );
  const coverage = scopePlanningCoverage(state, projectId);
  const current = (id: string) => {
    const a = state.artifacts[id]?.at(-1);
    return a &&
      referenceCurrent(state, projectId, { kind: 'artifact', id: a.id, revision: a.revision })
      ? a
      : undefined;
  };
  const research = current(`${projectId}:property-research`);
  const options = current(`${projectId}:scope-options`);
  const plan = current(`${projectId}:scope-work-plan`);
  const selection = plan?.payload.kind === 'project-work-plan' ? plan.payload.optionId : null;
  const role =
    selection === 'basement-powder'
      ? 'basement'
      : selection === 'ground-floor-powder'
        ? 'ground-floor'
        : 'kitchen';
  const survey = candidateMeasurement(state, projectId, role);
  const currentSurvey = survey && current(survey.id);
  const hasFootprint =
    currentSurvey?.payload.kind === 'candidate-measurements' &&
    currentSurvey.payload.basis === 'user-reported' &&
    currentSurvey.payload.survey.shape === 'rectangular' &&
    currentSurvey.payload.survey.measurement === 'finished' &&
    (currentSurvey.payload.survey.values.width?.amount || 0) > 0 &&
    (currentSurvey.payload.survey.values.length?.amount || 0) > 0;
  const first = questions[0];
  const next = !coverage.current
    ? 'research'
    : !first?.answer
      ? 'direction'
      : !selection
        ? 'study'
        : !hasFootprint
          ? 'measure'
          : 'investigate';
  return {
    questions,
    coverage,
    research,
    options,
    plan,
    selection,
    role,
    survey: currentSurvey,
    next,
  };
}
