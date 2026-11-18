# Renovagent product and business evaluation

November 16, 2026 · Decision memo

## Sell the output of the site visit

Start with small residential remodelers who quote bathroom or basement changes and need a plumber to review the scope. Sell a measured, annotated scope and priced materials worksheet that the firm can send to the homeowner and plumber the same day. Start the plumbing package with one exposed drain and one proposed change. The value to test is less re-entry between site notes, estimating, and purchasing, and fewer open questions discovered after the quote goes out.

The homeowner is also a viable buyer for a one-off project. Their demand is likely episodic. Give the homeowner and plumber a web link they can open without an install. Use the paid pilot to discover which party repeatedly owns the workflow and has a budget for it. Begin with remodelers quoting planned work. Emergency plumbing dispatch and generic home inventory have different buying triggers. Expand to adjacent trades when the same firm asks to use the workflow on more of its jobs.

Harvard puts annual US home maintenance and improvement spending above $600 billion. That is industry context. Size the initial business from reachable firms, eligible jobs per firm, paid conversion, and retention. The price and volume assumptions below are experiments. [Harvard remodeling research](https://www.jchs.harvard.edu/research-areas/remodeling)

## What the buyer can already buy

| Product | Listed offer | Implication |
| --- | --- | --- |
| PipeSketch | Free download with US Pro at $14.99 and Trade at $29.99. Its listing covers photo and LiDAR intake, layouts, a plumbing brief, and trade pricing tools. | The closest substitute. A basic scan, parts list, and PDF are inexpensive. Compare side by side on capturing actual installed conditions and carrying one change into a sourced quote. [US App Store](https://apps.apple.com/us/app/pipesketch-plumbing-planner/id6786223513) |
| magicplan | Two free starter projects, with estimating through its Pro offering. | Room capture and an initial shareable result are established entry points. [Starter plan](https://help.magicplan.app/using-magicplan-for-free) |
| CompanyCam | Core lists $79 monthly or $63 per month billed annually. | Repeat job documentation has a professional price point. The buyer still needs a reason to add a separate tool. [Plans](https://help.companycam.com/en/articles/14477655-companycam-plans-explained) |
| Handoff | Flex lists $149 monthly or $119 per month billed annually, with voice estimating, a custom catalog and proposals. | Generic walkthrough-to-estimate is already sold. Test the evidence-to-line-item workflow alongside the firm's current process. [Pricing](https://www.handoff.ai/pricing) |

## Feature decisions

| Feature | First paid workflow | Where it runs |
| --- | --- | --- |
| Identify | Attach a close-up. Read markings, record the user's label, and flag the questions that change the estimate. Add ordinary photo and tape input so a non-LiDAR phone can finish the job. | iPhone. Vision OCR exists. A small Core ML classifier is a later experiment if manual tagging is slow. |
| Trace | Keep existing evidence and a proposed change on the same plan. Allow point and elevation corrections. Tag where a visible run ends. Show the source image and measurement basis beside the line. | iPhone. The prototype has ARKit capture, manual points, and a SAM evidence overlay. The physical workflow and non-LiDAR path still need work. |
| Estimate | Turn a measured route and confirmed part selections into purchasable lengths and counts. Use one supplier cart or a contractor's price book. Show source date, stock unit, unresolved lines, and material versus labor cost. Let the contractor confirm scope and rates. | Shared TypeScript rules, bundled on the phone. The current prototype calculates length and pack counts from manual prices. Structured SKUs, quote import, labor, and revisions are gaps. |
| Review and share | Publish one revision as a browser link with an annotated image, scope, quantities, price basis, and open questions. Let the recipient acknowledge or request a correction. Provide PDF or CSV for the tools firms already use. | Existing web app and API. Add an iOS publish path and a plumbing packet view. |
| Hosted assistance | Offer an explicit one-frame trace when a customer needs help. Measure its effect on time, corrections, and purchase intent. Bring narrated or video intake forward if it reduces site-visit or estimating work. | Bounded API jobs. Keep the hosted model optional. Keep originals on the phone. |

Spend on accuracy of estimates, capture speed, and revision handling. Generic furniture, high-end renders, broad automated code review, a supplier marketplace, and job management can wait. Use the existing room and materials work and change one fixture or route at a time. A contractor's draft estimate and a supplier's purchase total carry distinct price bases.

## Architecture and operating cost

- **iPhone owns capture and offline drafts.** Keep original photos and clips on the phone. Run OCR, route editing, and shared math locally. Ask for sign-in when publishing or syncing across devices. The first release can publish immutable snapshots while keeping editing on the device that created the draft.
- **Railway and Atlas own connected records.** Reuse the existing API and database for account identity, metadata, validated publish commands, job revisions, structured quantities, price observations, share access, and purchase entitlements. Bring the shared domain into the iOS release through a narrow JSON interface and put the exact calculation version on the published snapshot.
- **Private object storage serves review images.** Upload only selected, resized derivatives. Store references and access policy in MongoDB. Issue short-lived media URLs after checking the share grant. New plumbing shares should have an owner-controlled expiry and revocation. Reuse the web share patterns, with explicit changes since the current shares are long-lived and permit copying. Add a CDN when traffic justifies it and keep private images behind access checks. [Existing share semantics](../architecture/limited-guest-sharing.md)
- **Models run by explicit request.** Scope retries, cap frames and bytes, and record provider cost, response latency, and whether the result was accepted. Audit repeated calls against entitlement and a daily budget. Avoid training a classifier until measured capture friction justifies collecting and labeling representative imagery.

Illustration: 1,000 published jobs per month at 3 MB each retained for 12 months would leave about 36 GB at steady state. At R2's Standard rate of $0.015 per GB-month, that is about $0.54 per month for those stored bytes before free allowances and request fees. R2 direct Internet egress is listed as free. API compute, database capacity, support, auth, monitoring, request fees, and model work are separate. This scenario is a sensitivity check, with no vendor selected or usage measured. [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

## Revenue experiments

| Offer | Price to test | What is purchased |
| --- | --- | --- |
| Free capture and invited review | $0 | On-device identification, manual capture and measurement, and the ability to open a shared packet. Allow enough free publishing to test the review loop under a byte limit. |
| Concierge remodeler pilot | $199 for one bathroom, or quote a narrower plumbing job separately | A real scope, reviewable worksheet and purchase list, with one revision. Collect a payment on a live job. Record all human minutes. This is the existing pilot hypothesis. |
| Self-serve household project | $19.99 once | A project with a shareable revision, dated materials estimate and bounded assistance. Test with active remodelers as reviewers and homeowners as buyers. |
| Repeat firm plan | $79/month to test | Several active projects, a company price book, repeat revisions and sharing, and a visible allowance for hosted assistance. Test after a firm has paid or asked to use it again. |

Treat a $1.99 assisted trace as an add-on experiment. At a 15% App Store fee it leaves about $1.69 before fulfillment. Two minutes of support at $45/hour already costs $1.50. For a consumer digital unlock bought in the iOS app, budget StoreKit and have the server honor verified entitlements across surfaces. Review the storefront and account rules for the chosen launch arrangement. The concierge service is a separately sold pilot. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Small Business Program](https://developer.apple.com/app-store/small-business-program/)

## Contribution and break-even illustration

| Scenario | Illustrative monthly or per-sale contribution before acquisition and fixed costs |
| --- | --- |
| $19.99 homeowner purchase | $16.99 after a 15% fee, less $0.40 in hosted work, $3.75 for five support minutes at $45/hour, and $1 for free usage allocated to each sale. That leaves **$11.84 per purchase**. The $1 assumes 20 activations per sale at $0.05 each. |
| $79 monthly firm subscription | $79 less an assumed 3% payment fee, $3.20 for eight jobs at $0.40 each, and $15 for 20 minutes of support at $45/hour. That leaves **$58.43 per firm-month**. Apply the applicable store fee for purchases through that channel. |
| $199 concierge job | $199 less an assumed 3% fee, $3.20 in direct technical cost, and $90 for two hours at $45/hour. That leaves **$99.83**. Four hours instead of two reduces it to **$9.83**. |

At an assumed $6,000 per month in fixed expenses, the examples imply roughly **507 homeowner purchases per month** or **103 retained firms** before acquisition and refunds. At 5% conversion, the household path calls for about 10,140 monthly activations. The firm path needs a repeat channel and tight support. A $180 acquisition cost at $58.43 a month would take just over three paid months to recover before fixed costs. These scenarios test feasibility and are neither forecasts nor market prices. Replace each input with receipts, logs, founder time, and cohort data.

## The next three decisions

1. **Hutchinson proves the workflow.** Trace one exposed drain manually and with assistance. Compare endpoint locations against tape, measure correction time, and compare the proposed quantities and priced basket to a plumber's takeoff and a dated supplier cart. Get the plumber to identify what would change the scope or remain conditional. A close-up that yields a credible handoff is more valuable than a successful model call.
2. **Three paid jobs test demand.** Recruit a small set of local remodelers with an active bathroom or basement job through direct outreach and supplier or trade referrals. Sell the same defined deliverable, fulfill it manually as needed, and ask each firm to share it with a real recipient. Track hours, support, missing items, revisions, and whether the worksheet gets used to quote or order. Compare against actual prior work rather than an opinion about the demo.
3. **A second paid job tests retention.** Look for at least two repeat buyers before committing to subscription development. Automate the most time-consuming repeated step first. Instrument scan-to-estimate completion, first share, recipient review, quote use, time saved, cost per usable assisted trace, gross receipts, support and acquisition effort. Add a supplier connection when the same supplier recurs and there is an authorized source worth maintaining.

If firms pay for the handoff and skip live tracing, improve intake and the estimate before training a model. If estimating stays in the firm's existing software, test whether the annotated scope and export are valuable on their own. If buyers praise the demo but fail to pay or reuse it, revise the offer before funding a broader app.
