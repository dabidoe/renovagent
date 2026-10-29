import { type WorkKind, type Run, type Fact } from '@renovagent/contracts';
export const stages: WorkKind[] = [
  'brief',
  'options',
  'technical',
  'plan',
  'procurement',
  'execution',
  'handover',
];
export const stageCopy: Record<WorkKind, { label: string; description: string }> = {
  brief: {
    label: 'Understand the project',
    description: 'Bring the property, the goal, and the unknowns into one place.',
  },
  options: {
    label: 'Explore the possibilities',
    description: 'Compare approaches before committing to a direction.',
  },
  technical: {
    label: 'Resolve the technical work',
    description: 'Connect site evidence to applicable requirements and feasibility.',
  },
  plan: {
    label: 'Prepare the job',
    description: 'Make decisions, trade responsibilities, and dependencies explicit.',
  },
  procurement: {
    label: 'Coordinate the resources',
    description: 'Bring scope, quantities, purchasing, and contractor questions together.',
  },
  execution: {
    label: 'Guide the work',
    description: 'Track evidence, surface discoveries, and understand the impact of changes.',
  },
  handover: {
    label: 'Keep the useful record',
    description: 'Collect approvals, as-built details, warranties, and maintenance needs.',
  },
};
export const stateLabel = (state: Run['state']) =>
  ({
    queued: 'Queued',
    running: 'In progress',
    waiting_for_input: 'Needs your input',
    waiting_for_approval: 'Decision needed',
    succeeded: 'Reviewed',
    failed: 'Simulation failed',
    cancelled: 'Cancelled',
  })[state];
export const factText = (fact: Fact) =>
  fact.value.kind === 'text'
    ? fact.value.text
    : fact.value.kind === 'quantity'
      ? `${fact.value.amount} ${fact.value.unit}`
      : fact.value.kind === 'unknown'
        ? 'Unknown'
        : fact.value.kind === 'money'
          ? `${fact.value.minorUnits / 100} ${fact.value.currency}`
          : String(fact.value.value);
