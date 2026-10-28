import { technicalMarkdown } from './technical.js';
// Local, deliberately bounded intake. Replace this adapter with model-backed reasoning later.
export const fields = [
  ['goal', 'The idea', 'What would you like to change about your space?'],
  ['location', 'Location', 'What city is the home in? That helps frame the questions to research later.'],
  ['building', 'Building & use', 'Is this a single-family home, a multi-unit building, or a commercial space—and how many stories? That helps establish which code path to investigate.'],
  ['dimensions', 'Room dimensions', 'Roughly how big is the space? You can say “6 by 4 feet,” or “not measured yet.”'],
  ['budget', 'Budget', 'What budget would you like to work within? A rough target is fine, or say “not sure yet.”'],
  ['conditions', 'Existing conditions', 'What do you know about the space today—for example, what is underneath it or where the plumbing is?'],
  ['timeline', 'Timing', 'When would you like to get started? “Still exploring” is a perfectly good answer.'],
];
export const emptyFacts = () => Object.fromEntries(fields.map(([key]) => [key, '']));
export function nextField(facts) { return fields.find(([key]) => !facts[key]); }
export function extractFacts(text, facts, asked) {
  const updates = {};
  const t = text.trim();
  // Questions are requests for information, not confirmed project decisions.
  if (/^(?:what|how|can|could|would|should|is|are|do|does)\b/i.test(t)) return updates;
  const dims = t.match(/\b(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|['′])?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(m(?:eters|etres)?|ft|feet|foot|['′])?\b/i);
  if (dims && +dims[1] > 0 && +dims[2] > 0) updates.dimensions = `${dims[1]} × ${dims[2]} ${/^m/i.test(dims[3] || '') ? 'm' : 'ft'}`;
  const money = t.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\b/i) || t.match(/(?:budget|spend|afford|cap|ceiling|under|around)\D{0,18}(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\b/i) || (asked === 'budget' ? t.match(/^(?:about\s+)?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\b/i) : null);
  if (money) {
    const amount = +money[1].replaceAll(',', '') * (money[2] ? 1000 : 1);
    if (amount > 0) updates.budget = `$${amount.toLocaleString('en-US')} target`;
  }
  const goal = /\b(half[ -]?bath|powder room|toilet.{0,20}sink)\b/i.test(t) ? 'Add a half bathroom' : /\b(bathroom|bath remodel)\b/i.test(t) ? 'Renovate a bathroom' : /\bkitchen\b/i.test(t) ? 'Renovate the kitchen' : /\b(basement).{0,15}(finish|convert)|\b(finish|convert).{0,20}basement/i.test(t) ? 'Finish the basement' : /\b(home office|workspace)\b/i.test(t) ? 'Create a home office' : null;
  if (goal && (!facts.goal || /\b(?:instead|actually|change|switch|rather|new project|want|like to|plan to)\b/i.test(t))) updates.goal = goal;
  if (/\b(single[ -]family|one[ -]family|multi[ -]family|multi[ -]unit|duplex|commercial|two[ -]family)\b/i.test(t)) updates.building = t;
  const cities = ['Philadelphia', 'New York', 'Brooklyn', 'Queens', 'Boston', 'Chicago', 'Seattle', 'Portland', 'Austin', 'Denver', 'Baltimore', 'Washington', 'San Francisco', 'Los Angeles', 'Atlanta', 'Pittsburgh', 'Nashville', 'Miami'];
  const city = cities.find(city => t.toLowerCase().includes(city.toLowerCase()));
  if (city || /\bphilly\b/i.test(t)) updates.location = city || 'Philadelphia';
  if (/\b(?:no basement|without (?:a )?basement|isn['’]?t (?:a )?basement|no access|can['’]?t access)\b/i.test(t)) updates.conditions = 'No basement access reported';
  else if (/\bbasement\b/i.test(t) && !updates.goal?.includes('basement')) updates.conditions = 'Basement below / access reported';
  else if (/\b(crawl\s?space|slab|existing plumbing|soil stack)\b/i.test(t)) updates.conditions = t;
  const timing = t.match(/\b(?:in|within|over the next)\s+\d+\s+(?:weeks?|months?|years?)\b|\b(?:next|this)\s+(?:week|month|year|spring|summer|fall|autumn|winter)\b|\b(?:by|in)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\b|\b(?:still exploring|no rush|asap|as soon as possible)\b/i);
  if (timing) updates.timeline = timing[0];
  const unknown = /\b(not sure|don['’]?t know|unknown|not measured|haven['’]?t measured|undecided|not yet)\b/i.test(t);
  if (unknown && asked && !updates[asked]) updates[asked] = 'To be confirmed';
  // A direct answer to a requested field can be preserved verbatim; never infer it from an unrelated message.
  if (asked && !updates[asked] && Object.keys(updates).length === 0 && t.length < 280 && !t.includes('?') && !/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|help|review|export|show|what|how|why|can you)\b/i.test(t)) {
    if (['goal', 'location', 'building', 'conditions', 'timeline'].includes(asked)) updates[asked] = t;
  }
  return updates;
}
export function replyTo(text, facts, asked, hasPhoto = false) {
  if (/\b(what (?:do|can) you do|how (?:does (?:it|this) work|it works)|help)\b/i.test(text)) return { updates: {}, text: 'Start with the proposed work and its location. We’ll establish the building context and site information needed to investigate applicable codes, physical feasibility, and work sequencing. The brief keeps your reported facts separate from unresolved technical checks. The intended product connects each requirement to its adopted edition, section, local amendment, and project evidence.\n\nThis version is a guided frontend demo: I can record these details, but I’m not connected to an AI model or analyzing photos.', asked };
  const updates = extractFacts(text, facts, asked);
  const combined = { ...facts, ...updates };
  const next = nextField(combined);
  const changed = Object.entries(updates).filter(([key, value]) => facts[key] !== value);
  let acknowledgement = '';
  if (changed.length) {
    if (updates.goal && !facts.goal) acknowledgement = `${updates.goal === 'Add a half bathroom' ? 'A half bath—got it. Before laying it out, we need to establish the building context, fixture clearances, and possible drain and vent routes.' : 'Got it. Let’s establish the scope and building context before proposing the work.'}`;
    else acknowledgement = 'I’ve updated your brief with those details.';
    if (updates.conditions === 'Basement below / access reported') acknowledgement += ' I’ve recorded basement access as something you reported; the existing utilities still need checking.';
  } else if (hasPhoto) acknowledgement = 'Your photo is attached to the project as a reference. I can’t analyze images in this demo, so tell me what you’d like to change about the space.';
  else if (/\b(permit|code|safe|wiring|drain|vent|cost|estimate|layout)\b/i.test(text)) acknowledgement = 'That’s a question to carry into planning. A useful technical answer needs the adopted edition and section, local amendments, and site measurements—not just a general rule. The brief lists the evidence needed for this project. This frontend demo hasn’t retrieved or applied section-level requirements. I’ve kept your question in the conversation.';
  else acknowledgement = 'This guided demo can record the scope, jurisdiction, building type, room size, budget, site conditions, and timing. You can also edit any detail in your brief.';
  const ending = next ? next[2] : 'The starting facts are recorded. Open “Project brief” for the technical investigation: measurements to obtain, code topics to research, and the order to resolve them. No code requirement has been verified or applied yet.';
  return { updates, text: acknowledgement + '\n\n' + ending, asked: next?.[0] || null };
}
export function briefMarkdown(state) {
  return `# ${state.facts.goal || 'Your renovation project'}\n\nPreliminary project brief · Unpermitted.ai\n\n${fields.map(([key, label]) => `## ${label}\n${state.facts[key] || 'Not discussed yet'}`).join('\n\n')}\n\n${technicalMarkdown(state.facts)}\n## Photos\n${state.photos.length ? state.photos.map(p => `- ${p.name} (reference only; not analyzed)`).join('\n') : 'No photos attached.'}\n\n## What to clarify next\n${nextField(state.facts)?.[2] || 'Verify site conditions and discuss feasibility with the appropriate professionals before estimating or starting work.'}\n\n## Basis and limitations\nDetails above were supplied by the user and have not been independently verified. This is a guided frontend prototype, without AI reasoning, photo analysis, live prices, code research, or a backend. No construction plan or cost estimate has been verified.\n`;
}
