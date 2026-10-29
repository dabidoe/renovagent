import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  commandSchema,
  workspaceSchema,
  valueSchema,
  emptyWorkspace,
  DomainError,
} from '@renovagent/contracts';
import { Scenario, createCommand, context } from '../foundation-helpers.js';
import { handleCommand } from '@renovagent/core';

test('schemas reject unsupported versions, non-finite quantities, incompatible units, and injected authority', () => {
  assert.equal(
    workspaceSchema.safeParse({ ...emptyWorkspace('owner-test'), schemaVersion: 99 }).success,
    false,
  );
  assert.equal(
    valueSchema.safeParse({ kind: 'quantity', amount: Infinity, unit: 'mm', dimension: 'length' })
      .success,
    false,
  );
  assert.equal(
    valueSchema.safeParse({ kind: 'quantity', amount: 4, unit: 'ft2', dimension: 'length' })
      .success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({ ...createCommand(), actorId: 'someone-else' }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({ ...createCommand(), commandId: 'constructor' }).success,
    false,
  );
});
test('invalid command and cross-owner calls do not mutate their input', () => {
  const initial = emptyWorkspace('owner-test');
  const before = structuredClone(initial);
  assert.throws(
    () => handleCommand(initial, { ...createCommand(), baseRevision: -1 }, context),
    (e: unknown) => e instanceof DomainError && e.code === 'VALIDATION',
  );
  assert.throws(
    () => handleCommand(initial, createCommand(), { ...context, ownerId: 'intruder' }),
    (e: unknown) => e instanceof DomainError && e.code === 'FORBIDDEN',
  );
  assert.deepEqual(initial, before);
});
test('new projects contain no invented site facts and normalize explicit units with their source retained', () => {
  const s = new Scenario();
  s.create();
  assert.deepEqual(s.state.facts, {});
  s.evidence();
  const command = s.width();
  if (command.type !== 'RecordFact') throw Error();
  command.payload.value = { kind: 'quantity', amount: 4, dimension: 'length', unit: 'ft' };
  s.apply(command);
  const fact = s.state.facts['fact-width'][0];
  assert.deepEqual(fact.value, {
    kind: 'quantity',
    amount: 1219.2,
    dimension: 'length',
    unit: 'mm',
  });
  assert.equal(fact.originalValue.kind === 'quantity' && fact.originalValue.unit, 'ft');
  assert.deepEqual(fact.evidenceIds, ['evidence-width']);
  assert.equal(fact.verification, null);
});
test('missing evidence, wrong subjects, and changed quantity dimensions are rejected', () => {
  const s = new Scenario();
  s.create();
  assert.throws(() => s.apply(s.width()), /Missing evidence/);
  s.evidence();
  s.apply(s.width());
  const command = s.width();
  if (command.type !== 'RecordFact') throw Error();
  command.payload.value = { kind: 'quantity', amount: 20, dimension: 'area', unit: 'm2' };
  assert.throws(() => s.apply(command), /dimension/);
  command.payload.subjectId = 'foreign-space';
  assert.throws(() => s.apply(command), /identity/);
});

test('unknown intermediate value cannot change an established measurement dimension', () => {
  const s = new Scenario();
  s.create();
  s.evidence();
  s.apply(s.width());
  const unknown = s.width();
  if (unknown.type !== 'RecordFact') throw Error();
  unknown.payload.value = { kind: 'unknown' };
  unknown.payload.assertion = 'unknown';
  s.apply(unknown);
  const invalid = s.width();
  if (invalid.type !== 'RecordFact') throw Error();
  invalid.payload.value = { kind: 'quantity', amount: 4, dimension: 'area', unit: 'm2' };
  assert.throws(() => s.apply(invalid), /dimension/);
});
