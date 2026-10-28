# Product workflow and workspace

## Product contract

The agent helps a homeowner decide, prepare, and carry out a home improvement project. It accumulates knowledge about the actual property and reuses that knowledge across projects. It does not reset to an uninformed chat at each stage.

The core loop is:

**User goal or site discovery → agent investigation → evidence and options → decision → updated project artifacts → next executable work.**

Multiple loops can run across a project. Stages are a navigation aid; prerequisites and unresolved risks control what is ready. An inspection failure or new discovery can reopen earlier design work without erasing completed construction history.

## Lifecycle and outputs

| Stage | Agent work | Persistent outputs | Exit condition / next handoff |
|---|---|---|---|
| Understand the property | Organize photos, measurements, existing systems, documents, and project intent; ask high-impact missing questions | Property/space records, sourced facts, proposed scope, investigation list | Enough building and site context to compare options, or an explicit site-survey task |
| Explore options | Compare layouts, methods, affected systems, cost drivers, and professional input needed | Versioned options, sketches, tradeoff table, feasibility findings | User selects an option or commissions additional investigation |
| Resolve technical basis | Establish applicable codes/editions/amendments; inspect system dependencies; perform supported calculations; reconcile specialist findings | Code basis, cited requirements, checks, unresolved issues, permit/inspection plan | The selected scope's required checks are resolved or assigned explicit hold points |
| Prepare the job | Derive task graph, quantities, compatible materials, tools, labor/trade scope, procurement phases, and estimate | Execution plan, BOM, purchasing plan, scope package, estimate basis | User approves a plan revision; unresolved items cannot silently release dependent work |
| Coordinate resources | Compare quotes against the same scope, collect credential evidence, manage lead times and deliveries | Quote comparisons, contractor records, approved assignments, purchase/delivery records | Named responsibilities, available prerequisites, accepted scope and dates |
| Guide execution | Show next ready work, collect completion evidence, track actual costs/material use, respond to discoveries and changes | Task evidence, inspections, issues, change proposals, actuals | Required completion and inspection evidence accepted; punch list closed |
| Handover and maintain | Compile as-built changes, manuals, receipts, approvals, warranties, and future maintenance | Handover pack and updated property history | Exportable project record, with remaining maintenance obligations visible |

Completing intake produces the first brief. It does not complete planning.

## What makes the agent useful

- It performs bounded investigations and creates durable work products, rather than repeatedly advising the user to research something.
- It chooses questions based on the next blocked decision. Budget may matter, but building classification or the available connection elevation may determine whether a proposed method is viable.
- Specialist outputs share the same revision of project facts. A plumbing option, layout, and materials list must not describe different versions of the job.
- Each recommendation states its basis and the unresolved evidence that limits it.
- A discovery changes affected tasks, quantities, estimates, and decisions; it does not merely append a warning to chat.
- User corrections preserve history and propagate through the dependency model.
- Real cost/time benefits are derived from explainable alternatives or observed actuals. No fixed “money saved” amount is credited for the existence of a warning.

## Workspace interaction model

Use three coordinated surfaces, progressively revealed:

1. **Project navigation:** property, active project, lifecycle overview, and saved artifacts. A lifecycle stage shows unresolved decisions and real status, not a fabricated completion percentage.
2. **Work surface:** the current artifact, option comparison, measured layout, materials table, dependency plan, source evidence, or progress record. The agent opens the output relevant to the current work.
3. **Conversation and activity:** user direction, agent explanations, tool/run progress, questions, and links to produced artifacts. The user can distinguish queued, running, waiting, failed, and completed work.

Desktop can place work and conversation side by side with resizable emphasis. Mobile uses a work/conversation switch that preserves context and composer drafts. Do not put every capability into opening-screen cards. After the user identifies the job, reveal a project workspace with meaningful work in progress.

### First session

- Explain the end-to-end promise in plain language; show an example of an actual deliverable, not just a generic renovation image.
- Accept a goal, photo, document, measured sketch, existing quote, or an already-started job. Starting at execution must be supported through an evidence-reconstruction path.
- Create a property/project draft immediately. Summarize interpreted facts with their sources and unresolved interpretation.
- Propose a bounded next job, such as “Compare two placement options after we establish the drain connection and finished clearances.”
- Show the needed site observations and why they affect that job. Allow the user to say “unknown,” delegate investigation, or attach evidence.
- As work completes, open the produced artifact, show its confidence limits, and offer the decision that advances the project.

## Reference workflow: first-floor half bath

The first reliable slice must traverse the whole workflow for a deliberately limited project, using a curated, reviewed technical coverage set. It is not a claim to handle every bathroom in every building.

1. Record jurisdiction, building use/unit count/stories, current room use, intended fixtures, and changed systems.
2. Collect a measured plan, fixture specifications, relevant existing-system observations, and explicitly unknown concealed conditions.
3. Establish a reviewed code basis; compare candidate configurations and list unresolved technical checks.
4. Select an option, resolve required checks, and generate a task/material plan that records its prerequisites.
5. Produce a contractor/procurement package. Any example prices are clearly fixture data; live pricing comes later.
6. Record a simulated site discovery. Recalculate dependent work, present a change proposal, and preserve the prior approved revision.
7. Collect completion/inspection records in the fixture scenario, assemble the handover pack, and update property history.

During frontend development, simulated runs are marked fixtures. Their artifact structures and command paths must match the future real workflow. User-facing “completed” must describe an actual stored output, not an animation timer.

## Scope strategy

Generalize the property model, artifacts, task dependencies, evidence, and execution mechanics. Specialize technical content in versioned project-type playbooks. The first playbook is the half bath; a second, smaller project such as a flooring replacement tests that the model does not require toilets, vent paths, or plumbing permits everywhere.

Defer nationwide code coverage, automatic permit filing, autonomous purchasing, contractor calls, and AR until the reference workflow is demonstrably reliable. The architecture must leave extension points without pretending these services exist.
