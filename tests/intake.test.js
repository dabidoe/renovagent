import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFacts, nextField, extractFacts, replyTo, briefMarkdown } from '../src/intake.js';

test('intake starts without invented project facts', () => {
  const facts = emptyFacts();
  assert.ok(Object.values(facts).every(v => v === ''));
  assert.equal(nextField(facts)[0], 'goal');
});
test('a project description produces a focused follow-up', () => {
  const result = replyTo('I want a half bath in my Philadelphia rowhouse', emptyFacts(), 'goal');
  assert.equal(result.updates.goal, 'Add a half bathroom');
  assert.equal(result.updates.location, 'Philadelphia');
  assert.equal(result.asked, 'building');
});
test('one answer can supply multiple facts without replacing the existing goal', () => {
  const facts = { ...emptyFacts(), goal: 'Add a half bathroom', location: 'Philadelphia', building: 'Single-family, three stories' };
  const result = replyTo('6 by 4 feet, budget $8,000, basement below, next spring', facts, 'dimensions');
  assert.deepEqual(result.updates, { dimensions: '6 × 4 ft', budget: '$8,000 target', conditions: 'Basement below / access reported', timeline: 'next spring' });
  assert.equal(result.asked, null);
  assert.equal(facts.budget, '');
});
test('corrections retain unrelated facts and preserve explicit units', () => {
  const facts = { ...emptyFacts(), goal: 'Create a home office', budget: '$4,000 target', dimensions: '6 × 4 ft' };
  const updates = extractFacts('Actually make that 3 by 2 meters', facts, 'conditions');
  assert.deepEqual(updates, { dimensions: '3 × 2 m' });
  assert.equal({ ...facts, ...updates }.budget, '$4,000 target');
});
test('uncertainty stays visible and the next question advances', () => {
  const facts = { ...emptyFacts(), goal: 'Add a half bathroom', location: 'Philadelphia', building: 'Single-family, three stories' };
  const result = replyTo('Not measured yet', facts, 'dimensions');
  assert.equal(result.updates.dimensions, 'To be confirmed');
  assert.equal(result.asked, 'budget');
});
test('budget understands shorthand and negative basement statements', () => {
  assert.equal(extractFacts('10k', emptyFacts(), 'budget').budget, '$10,000 target');
  assert.equal(extractFacts('There is no basement', emptyFacts(), 'conditions').conditions, 'No basement access reported');
});
test('unsupported questions do not silently become project facts', () => {
  const result = replyTo('What does a new drain cost?', emptyFacts(), 'goal');
  assert.deepEqual(result.updates, {});
  assert.match(result.text, /adopted edition and section/);
});
test('export identifies unknowns and limits without invented estimates', () => {
  const text = briefMarkdown({ facts: emptyFacts(), photos: [] });
  assert.match(text, /Not discussed yet/);
  assert.match(text, /without AI reasoning/);
  assert.doesNotMatch(text, /\$972|\$573/);
});

test('hypothetical questions cannot overwrite project facts', () => {
  const facts = { ...emptyFacts(), goal: 'Renovate the kitchen', budget: '$8,000 target' };
  const result = replyTo('Would a 6 by 4 bathroom cost $5000?', facts, 'dimensions');
  assert.deepEqual(result.updates, {});
  assert.equal(facts.goal, 'Renovate the kitchen');
  assert.equal(extractFacts('There is a bathroom next door', facts, 'conditions').goal, undefined);
});
