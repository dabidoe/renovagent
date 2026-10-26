## Unpermitted.ai  
## AI Construction Crew — Product & Technical Project Plan  
**Version:** 0.1 · October 2026 **Initial use case:** First-floor half-bathroom renovation **Hackathon track:** Indie Developer  
**1. Product vision**  
**Unpermitted.ai — Questionable name. Surprisingly sound advice.**  
An AI-powered renovation and construction assistant that helps homeowners, DIY renovators, landlords, and small contractors take a project from an initial idea through design, feasibility, material procurement, contractor coordination, and execution.  
Users interact with a cast of specialized, opinionated AI construction characters. Behind the personalities is a shared project model that maintains measurements, plans, tasks, material requirements, decisions, budgets, and progress.  
**Core promise:** Figure out what to build, how to build it, what to buy, who to consult, and what to do next.  
**2. Primary demonstration**  
**Project:** Convert an existing first-floor space in a Philadelphia rowhouse into a half bathroom.  
The user uploads photographs, identifies the intended space, and describes the goal.  
“I want a toilet and sink here. There’s a basement underneath. I want to keep it affordable. What are my options?”  
The application:  
1. Analyzes the visible space and asks for missing measurements.  
2. Generates potential layouts and conceptual mockups.  
3. Investigates feasibility and identifies unknown conditions.  
4. Produces a phased construction plan.  
5. Generates a detailed, consolidated bill of materials.  
6. Organizes materials into purchasing and pickup groups.  
7. Reviews the plan through specialist agents.  
8. Prepares a contractor scope and due-diligence checklist.  
9. Tracks completed work and revises the remaining plan.  
**Hackathon success criterion:** Demonstrate one complete, persistent workflow, not a collection of unrelated AI outputs.  
   
⸻  
   
**3. Specialized AI crew**  
**Dwang — General Contractor / Orchestrator**  
* Maintains the overall project plan.  
* Coordinates specialist input.  
* Manages task dependencies and scheduling.  
* Reconciles conflicts, materials, and budgets.  
* Summarizes the next actionable steps.  
**Pete — Plumbing Specialist**  
* Reviews plumbing concepts and feasibility.  
* Identifies drainage, supply, and venting considerations.  
* Generates plumbing-specific material requirements.  
* Challenges missing information and incompatible proposals.  
* Prepares questions for licensed plumbers.  
**Sparky — Electrical Specialist**  
* Reviews lighting, circuits, loads, and equipment requirements.  
* Identifies electrical dependencies and safety considerations.  
* Produces provisional electrical materials and contractor scopes.  
* Flags work requiring professional verification.  
**Archie — Design / Spatial Planning**  
* Interprets room dimensions and spatial constraints.  
* Develops layout alternatives.  
* Generates visual mockups and fixture arrangements.  
* Coordinates dimensional requirements with the other specialists.  
**Future specialists:** Structural/framing, HVAC, roofing, flooring, painting, code/permit research, estimating, and purchasing.  
**Technical principle:** Agents share structured project data. Their different personalities should not produce contradictory authoritative records.  
   
⸻  
   
**4. Product modules**  
**A. Property Intelligence**  
Persistent hierarchy:  
```
Property → Floor → Room → Project → Tasks

```
Store:  
* Property address and relevant jurisdiction.  
* Room dimensions, photos, and sketches.  
* Existing construction and utilities.  
* Known measurements versus assumptions.  
* Proposed and completed improvements.  
* Relevant documents, quotes, and inspection records.  
Every fact should have a source and confidence or verification status.  
**B. Concept & Visualization Studio**  
* Upload photos of an existing space.  
* Describe proposed changes conversationally.  
* Generate multiple design alternatives.  
* Compare rough costs and tradeoffs.  
* Save selected concepts to the project.  
* Preserve original images separately from AI-generated mockups.  
**Stretch goal:** AR placement of selected fixtures or virtual construction elements using compatible mobile devices.  
**C. Feasibility & Technical Planning**  
* Identify required site observations.  
* Produce specialist questions.  
* Map relevant construction systems.  
* Generate preliminary methods and alternatives.  
* Identify permitting and inspection questions.  
* Distinguish verified requirements from suggestions.  
* Establish prerequisites before approving downstream work.  
Technical guidance must not assume concealed structural, electrical, or plumbing conditions from photographs.  
**D. Project Planning Engine**  
Each task contains:  
* Title and scope.  
* Trade or responsible party.  
* Prerequisites and dependencies.  
* Estimated labor effort and duration range.  
* Required materials and tools.  
* Inspection or approval hold points.  
* Completion criteria.  
* Status, notes, and photos.  
Support task dependencies, phased scheduling, and automatic identification of blocked tasks.  
**E. Materials & Procurement Engine**  
Generate a complete bill of materials including:  
* Material descriptions and technical specifications.  
* Quantity and units.  
* Waste and contingency allowances.  
* Package sizes and purchase quantities.  
* Consumables, fittings, fasteners, and accessories.  
* Required tools and rentals.  
* Existing inventory and reusable leftovers.  
* Source tasks and responsible specialists.  
* Compatibility requirements and substitution rules.  
**Reconciliation:** Merge duplicate requests only when material specifications and intended uses are compatible. Preserve traceability to the requesting tasks.  
**Procurement:** Group purchases by phase, store, delivery/pickup, lead time, and vehicle constraints.  
**Future integration:** Retailer product catalogs, current pricing, local inventory, shopping carts, and pickup coordination.  
**F. Contractor Due Diligence**  
Users supply contractor names, websites, quotes, or contact details.  
The system assists with:  
* Business identity and license/registration verification.  
* Public permit and inspection history where available.  
* Review aggregation with source attribution.  
* Relevant portfolio and reference evaluation.  
* Insurance-document requests.  
* Scope completeness and exclusions.  
* Schedule, staffing, and availability questions.  
* Quote normalization and comparison.  
* Written contractor interview questions.  
Unknown information remains explicitly unverified.  
**Future capability:** User-authorized AI-assisted contractor calls and follow-up communications, with appropriate disclosure and consent.  
**G. Guided Execution**  
* Daily and weekly work plans.  
* Context-aware instructions and explainers.  
* Task-specific visual aids.  
* Photo-based progress reporting.  
* Material consumption tracking.  
* Updated estimates and schedules.  
* Change-order and unexpected-condition workflows.  
The system must identify when work should stop pending inspection, measurement, or qualified professional review.  
   
⸻  
   
**5. Proposed technical architecture**  
**Frontend**  
* Next.js / React / TypeScript.  
* Mobile-first responsive interface.  
* Project dashboard, visual studio, chat, crew review, materials, and timeline.  
* Three.js / React Three Fiber for optional 3D previews.  
* AR exploration through a device-compatible viewer or WebXR where supported.  
**Backend**  
* Node.js / TypeScript API.  
* MongoDB for project documents and structured records.  
* Object storage for photos, mockups, and documents.  
* Background jobs for long-running analysis and generation.  
* Authentication and project-level access control.  
**AI Orchestration**  
* Meta model integration for reasoning and multimodal tasks, subject to available APIs and hackathon requirements.  
* Structured JSON outputs validated with schemas.  
* Specialist-agent orchestration with a shared context.  
* Tool/function calling for project updates, calculations, and document retrieval.  
* Optional image-generation and segmentation services.  
* Retrieval layer for verified product specifications, documentation, and jurisdiction-specific information.  
**Important:** Use deterministic code for arithmetic, quantity conversions, package rounding, inventory reconciliation, and task-graph validation. Do not rely on an LLM to perform all calculations.  
   
⸻  
   
**6. Core data models**  
**Property**  
* id, address, jurisdiction, floors, rooms, documents.  
**Room**  
* id, propertyId, dimensions, features, photos, existingConditions.  
**Project**  
* id, roomIds, description, goals, budget, selectedConcept, status, revisions.  
**Task**  
* id, projectId, trade, description, dependencies, duration, status, acceptanceCriteria.  
**MaterialRequirement**  
* id, taskId, specification, quantity, unit, wasteAllowance, verificationStatus.  
**CatalogItem**  
* id, productIdentifier, manufacturer, specifications, packageQuantity, supplier, price, availabilityTimestamp.  
**Purchase**  
* id, projectId, catalogItems, quantities, supplier, pickupGroup, orderStatus.  
**Decision**  
* id, projectId, question, alternatives, selectedOption, rationale, affectedRecords.  
**AgentReview**  
* id, projectId, specialist, finding, severity, evidence, proposedChanges, resolution.  
**Contractor**  
* id, trade, identity, credentials, sources, quotes, references, verificationStatus.  
   
⸻  
   
**7. Agent coordination workflow**  
1. Dwang receives a user request.  
2. The system retrieves relevant project context.  
3. Dwang selects the required specialists.  
4. Specialists return structured findings, requirements, and objections.  
5. A validation layer checks data completeness, calculations, and conflicting assumptions.  
6. Dwang presents decisions or clarification questions to the user.  
7. Approved changes are committed to the project.  
8. A dependency engine identifies affected tasks, quantities, purchases, and estimates.  
9. The user receives an updated project plan and change summary.  
**Crew Meeting:** An explicit review action where multiple agents inspect the current plan, debate important issues, and produce a consolidated list of findings and proposed revisions.  
For safety-critical or expensive changes, user approval is required before committing the revision.  
   
⸻  
   
**8. Hackathon MVP scope**  
**Must ship**  
* Create property, room, and renovation project.  
* Upload photos and enter dimensions.  
* Conversational project intake.  
* Dwang plus two specialist agents.  
* Structured feasibility questions.  
* Task plan with dependencies.  
* Detailed materials list with waste allowances.  
* Deduplication and basic inventory subtraction.  
* Purchasing groups by project phase.  
* Crew Meeting with structured objections.  
* Persistent project state and revisions.  
**Should ship**  
* AI renovation concept mockup.  
* Contractor scope-of-work generator.  
* Contractor interview and due-diligence checklist.  
* Exportable project plan and shopping list.  
**Stretch**  
* Interactive 3D fixture placement.  
* AR visualization.  
* Voice-driven crew discussion.  
* Live retailer price/product lookup.  
* Public contractor-record lookup.  
* AI-assisted contractor calls.  
   
⸻  
   
**9. Ten-day delivery plan**  
**Day 1 — Foundation**  
* Define MVP and data schemas.  
* Set up app, authentication, storage, and project records.  
* Create demonstration property and bathroom project.  
**Day 2 — Project intake**  
* Photo uploads and dimensions.  
* Conversational project requirements.  
* Persist existing conditions and uncertainties.  
**Day 3 — Planning engine**  
* Generate structured tasks.  
* Implement dependencies, stages, and acceptance criteria.  
* Build project-plan interface.  
**Day 4 — Materials engine**  
* Task-linked material requirements.  
* Unit conversions, waste allowances, and package rounding.  
* Basic inventory and duplication handling.  
**Day 5 — Crew orchestration**  
* Implement Dwang, Pete, and Sparky.  
* Structured specialist reviews.  
* Crew Meeting and conflict resolution.  
**Day 6 — Procurement**  
* Shopping list consolidation.  
* Purchasing groups and pickup checklist.  
* Source traceability and quantity adjustments.  
**Day 7 — Visual concepts**  
* Room-photo analysis.  
* Concept mockup generation.  
* Save selected concept to project.  
**Day 8 — Contractor support**  
* Generate scopes of work.  
* Create due-diligence checklist.  
* Normalize example quotes.  
**Day 9 — Integration and testing**  
* Test complete bathroom workflow.  
* Verify persistence and revision behavior.  
* Fix calculation, agent, and UI issues.  
* Attempt a limited AR/3D demonstration if core functionality is stable.  
**Day 10 — Demo and submission**  
* Prepare reproducible demonstration.  
* Record concise product video.  
* Explain Meta model usage and architecture.  
* Document limitations and future development.  
   
⸻  
   
**10. Evaluation criteria**  
The MVP should demonstrate:  
1. **Planning completeness:** Does it identify meaningful tasks, dependencies, and missing information?  
2. **Materials accuracy:** Are quantities explainable, units consistent, and duplicates handled correctly?  
3. **State persistence:** Does the app remember measurements, decisions, and project progress?  
4. **Revision integrity:** Does changing one constraint update affected downstream records?  
5. **Agent usefulness:** Do specialist reviews catch meaningful omissions rather than merely generate banter?  
6. **Usability:** Can a homeowner understand what to do next?  
7. **Technical credibility:** Does the demo use real structured data and functioning calculations?  
8. **Safety and transparency:** Are assumptions, uncertainty, and professional-review requirements visible?  
**11. Post-hackathon roadmap**  
**Phase 2 — Procurement intelligence**  
* Retailer catalogs and SKU matching.  
* Local pricing and availability.  
* Pickup route and delivery optimization.  
* Receipt scanning and return tracking.  
**Phase 3 — Property intelligence**  
* Whole-property renovation history.  
* System diagrams and documentation.  
* Maintenance scheduling.  
* Multi-project inventory optimization.  
**Phase 4 — Contractor collaboration**  
* Contractor portals and quote requests.  
* Credential and permit research.  
* Schedule and milestone coordination.  
* Change orders and payment documentation.  
**Phase 5 — Spatial computing**  
* Measured floor plans.  
* Interactive 3D renovation proposals.  
* AR fixture placement.  
* Progress comparisons between planned and actual work.  
   
⸻  
   
**12. Key product differentiation**  
Unpermitted.ai is not simply an AI assistant that answers home-improvement questions.  
It combines:  
* A persistent model of a real property.  
* Multiple specialized AI perspectives.  
* Technical planning and dependency management.  
* Deterministic material estimation and reconciliation.  
* Purchasing and inventory coordination.  
* Contractor due diligence.  
* Visual design and eventual spatial interaction.  
* An entertaining, memorable cast of construction characters.  
**The comedy is the interface. The project intelligence is the product.**  
