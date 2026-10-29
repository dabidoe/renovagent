import type { SpecConstraint } from '@renovagent/contracts';

export type SpecMap = Record<string, string | number | boolean>;
export type MatchResult = { ok: boolean; reasons: string[] };

// Hard-constraint matching only. A missing spec never passes: unknown
// compatibility is a rejection with a reason, not a silent accept.
export function matchConstraints(specs: SpecMap, constraints: SpecConstraint[]): MatchResult {
  const reasons: string[] = [];
  for (const constraint of constraints) {
    const actual = specs[constraint.attribute];
    const label = constraint.attribute;
    if (constraint.operator === 'exists') {
      if (actual === undefined) reasons.push(`${label} is not specified`);
      continue;
    }
    if (actual === undefined) {
      reasons.push(
        `${label} is unknown; cannot verify ${constraint.operator} ${describe(constraint.value)}`,
      );
      continue;
    }
    const expected = constraint.value;
    switch (constraint.operator) {
      case 'eq':
        if (actual !== expected)
          reasons.push(`${label} is ${describe(actual)}, needs ${describe(expected)}`);
        break;
      case 'neq':
        if (actual === expected) reasons.push(`${label} must differ from ${describe(expected)}`);
        break;
      case 'lte':
        if (typeof actual !== 'number' || typeof expected !== 'number' || actual > expected)
          reasons.push(`${label} exceeds maximum ${describe(expected)}`);
        break;
      case 'gte':
        if (typeof actual !== 'number' || typeof expected !== 'number' || actual < expected)
          reasons.push(`${label} is below minimum ${describe(expected)}`);
        break;
      case 'oneOf':
        if (typeof actual !== 'string' || !Array.isArray(expected) || !expected.includes(actual))
          reasons.push(`${label} '${describe(actual)}' is not an accepted option`);
        break;
    }
  }
  return { ok: reasons.length === 0, reasons };
}

function describe(value: unknown): string {
  return Array.isArray(value) ? value.join('|') : String(value);
}
