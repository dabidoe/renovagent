// Curated investigation topics, not a compliance engine or an assertion that a code applies.
export const adoptionSource = {
  title: 'Philadelphia L&I · Applicable codes',
  url: 'https://www.phila.gov/departments/department-of-licenses-and-inspections/resources/applicable-codes/',
  checked: 'October 26, 2026',
  note: 'The city lists 2021 IBC, IRC, IEBC, IPC, and IMC, plus 2020 NEC for electrical work. Local amendments and the listed accessibility exceptions must be reviewed. This is an adoption reference, not a determination for this project.',
};
export function technicalWorkup(facts) {
  const bathroom = /bath|toilet|sink/i.test(facts.goal);
  const kitchen = /kitchen/i.test(facts.goal);
  return {
    source: /philadelphia|philly/i.test(facts.location) ? adoptionSource : null,
    basis: facts.building ? 'Building description recorded. Code applicability still requires review.' : 'Building use, unit count, stories, and alteration scope are needed before selecting a code path.',
    checks: bathroom ? [
      { title: 'Fixture fit & finished clearances', need: 'Toilet centerline, finished wall locations, fixture projections, and door swing. Room area alone cannot establish fit.', evidence: 'Measured sketch + fixture cut sheets', research: 'Adopted plumbing / residential fixture provisions; accessibility applicability' },
      { title: 'Drainage & vent route', need: 'Existing stack size and material, proposed pipe route and length, connection elevation, and vent termination. Basement access alone does not establish a workable connection.', evidence: 'Route measurements + exposed-system observations', research: 'Adopted sanitary drainage sizing / slope and venting provisions' },
      { title: 'Electrical & exhaust route', need: 'Existing circuit arrangement, panel information, receptacle locations, and a proposed outdoor exhaust termination.', evidence: 'Existing-system survey + proposed equipment specifications', research: 'Adopted electrical bathroom provisions and mechanical exhaust provisions' },
    ] : kitchen ? [
      { title: 'Appliance loads & services', need: 'Selected appliance ratings, existing circuits, and whether gas or plumbing connections will move.', evidence: 'Appliance cut sheets + existing-system survey', research: 'Adopted electrical, plumbing, mechanical, and fuel-gas provisions as applicable' },
      { title: 'Walls, openings & exhaust', need: 'Which walls change, how their loads are supported, and where the proposed hood duct terminates.', evidence: 'Measured existing/proposed plans + structural investigation', research: 'Applicable alteration, structural, and exhaust provisions' },
    ] : [
      { title: 'Existing conditions & change of use', need: 'Existing and proposed room use, altered walls/openings, affected services, and measured dimensions.', evidence: 'Measured existing/proposed plans + site observations', research: 'Jurisdiction, adopted editions, building classification, and scope-specific provisions' },
    ],
    sequence: [
      ['Establish the code basis', 'Confirm jurisdiction, adopted editions, amendments, building use, and scope.'],
      ['Resolve physical feasibility', 'Measure the proposed routes and layout; investigate concealed conditions before committing.'],
      ['Define permits & inspection gates', 'Confirm required filings, responsible trades, and inspection stages with the authority.'],
      ['Release the work in order', 'Tie quantities, purchases, and downstream tasks to resolved design decisions and inspection gates.'],
    ],
  };
}
export function technicalMarkdown(facts) {
  const workup = technicalWorkup(facts);
  return `## Technical investigation · not yet verified\n${workup.basis}\n\n${workup.source ? `Adoption reference: ${workup.source.url}\nChecked: ${workup.source.checked}\n${workup.source.note}\n\n` : 'Code adoption source: not established for this jurisdiction.\n\n'}${workup.checks.map(c => `### ${c.title}\nNeeded: ${c.need}\nEvidence: ${c.evidence}\nResearch: ${c.research}\nStatus: unresolved`).join('\n\n')}\n\n## Proposed investigation order\n${workup.sequence.map(([title, detail], i) => `${i + 1}. ${title}: ${detail}`).join('\n')}\n\nNo section-level requirement has been verified or applied to this project.\n`;
}
