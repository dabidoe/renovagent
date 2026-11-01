# Launch checklist: hosted Renovagent with Free and Premium

October 31, 2026. This builds on [the homepage promise audit](architecture/homepage-promise-audit-2026-10-31.md) and [hosted deployment](architecture/hosted-deployment.md).

**Stack:**

- Railway runs the app.
- Bunny is the CDN, and later the photo storage.
- Atlas is the database.
- Google handles sign-in.
- Stripe takes payments.
- Firebase is not needed. See "Decisions".

**Plans:**

|                                                 | Free                       | Premium, $7.99/month |
| ----------------------------------------------- | -------------------------- | -------------------- |
| Projects                                        | 3                          | Unlimited            |
| Built-in AI (photo reads, renders, Jev pricing) | Small starter credit grant | Monthly credits      |
| Your own agent over MCP (Muse, etc.)            | Included, no credits       | Included, no credits |
| Planning, quantities, materials lists, looks    | Included                   | Included             |

Agent calls over MCP run on the user's own model, so they cost us only storage. That matches `docs/MODEL_INTEGRATION.md`: credits pay for hosted AI operations, never for arithmetic or for a user's own agent.

---

## Your part (accounts and settings)

### Decisions

- [ ] **Firebase: skip it.** The API already has its own Google and Meta sign-in, sessions and per-owner workspaces. Setting only the Google variables turns account mode on (`server.ts:949`). Firebase Auth would duplicate it. Revisit only if you want email/password or phone login.
- [ ] **Meta login: skip at launch.** It needs App Review, a privacy policy and a data-deletion callback. Google alone is enough.
- [ ] **Payments: Stripe.** Its standard US card fee is 2.9% + 30¢, so $7.99 nets about $7.45. Any other processor works if you prefer; tell me which.
- [ ] **Domain name** for the app (for example `app.<yourdomain>`). Google's consent screen needs a domain you own for the homepage and privacy links.

### Atlas

- [ ] Rotate the current password, as planned. Update **both** `.env` and `server/.env` locally.
- [ ] Create a **separate production** project and cluster with its own database user (read/write on its database only). Keep the current one for development.
- [ ] Tier:
  - **M0 (free)** is fine for a beta. We use about 5.4 MB of its 512 MB.
  - M0 has **no backups**. Before taking money, move to Flex or M10 for backups. Check the current prices in Atlas.
- [ ] Put the cluster in the **same region** as the Railway service.
- [ ] Load the paint palette into the hosted database: `npm run seed:paint -- --brand <name> --collection <name> --file <file.ase>`, with `RENOVAGENT_MONGO_URI` set to it, from the brand file you downloaded. Without it, "Imagine the room" snaps colours to the six starting colours.
- [ ] Network access: Railway's outbound IPs change unless your plan includes static outbound IPs. If it does, allow just those. Otherwise allow `0.0.0.0/0` and rely on the strong, rotated password.

### Railway

- [ ] New service from GitHub `dabidoe/renovagent`, branch `main`. It reads `railway.json` and the `Dockerfile`.
- [ ] Region: same as Atlas.
- [ ] Generate the `*.up.railway.app` domain first, then add your custom domain.
- [ ] Variables:

  | Variable                                           | Value                                                                                                                    |
  | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
  | `RENOVAGENT_MONGO_URI`                             | cluster0 URI ending in `/renovagent_demo` for the hackathon demo (its own database; the local workspace stays untouched) |
  | `RENOVAGENT_PUBLIC_URL`                            | `https://<railway domain>` now; your custom domain later                                                                 |
  | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`         | from the Google OAuth client                                                                                             |
  | `TYPESAFE_API_KEY`                                 | Jev, a **production key** with a spend limit                                                                             |
  | `MUSE_API_KEY`                                     | Meta Model API key (Muse Spark, Muse Image, SAM 3.1)                                                                     |
  | `RENOVAGENT_RENDER_URL`, `RENOVAGENT_RENDER_TOKEN` | Blender HD on Modal; same values as local `.env`                                                                         |
  | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`       | once I've built billing                                                                                                  |

  Railway provides `PORT`. Don't set `GOOGLE_REDIRECT_URI`; it is derived from the public URL.

### Google sign-in

- [ ] Google Cloud project, then the OAuth consent screen:
  - app name, support email, homepage, privacy policy and terms URLs;
  - scopes: only `openid`, `email` and `profile`.
- [ ] Web OAuth client with this redirect URI: `https://<public url>/api/workspace/auth/google/callback`. Add the Railway URL now and the custom domain later.
- [ ] Publish the consent screen to **In production**. While it's in "Testing", only listed test users can sign in. The basic scopes above shouldn't need Google's full verification, but Google may ask you to verify the domain in Search Console.

### Bunny

- [ ] Pull zone with the Railway URL as origin and **Forward Host Header** turned on. The API accepts only its public `Host`; this is unverified behind Bunny, so test it on the Railway URL before switching DNS.
- [ ] Cache only `/assets/*`. The API already marks everything else `no-cache` or `no-store`.
- [ ] DNS: CNAME the app domain to the pull zone. Add the same domain to Railway too.
- [ ] Later, when photos approach Atlas's limit: a **Storage zone** for user photos, with its API key as a Railway variable. That needs code from me.

### Stripe (after I build billing)

- [ ] Product "Renovagent Premium" with a recurring **$7.99/month** price.
- [ ] Webhook endpoint `https://<public url>/api/billing/webhook`, with the events I'll list. Copy its signing secret.
- [ ] Turn on the Customer Portal so users can cancel or change their card.
- [ ] Tax: decide whether to use Stripe Tax.

### Model providers

- [ ] TypeSafe (Jev) and Muse: production keys, **monthly spend caps and alerts** in each dashboard.

### Legal pages

- [ ] Privacy policy and terms. I can draft them, but you own the wording. They're needed for Google's consent screen and for taking payments.

---

## My part (code), in order

1. **Fix the public site.** Pages currently serves the raw source and shows a blank page. Either publish the built site, or redirect Pages to the hosted app once it's live.
2. **Hosting fixes:**
   - Start listening before the first workspace read. The health check timeout is 60 s, and the cold start here took about 2 minutes.
   - Use `/readyz` for readiness.
   - Serve MCP from the same container at `/mcp`.
   - Swap macOS `sips` for a Linux image converter. That's a new dependency; I'll name it for your approval.
   - Make Muse photo jobs call its API instead of the local CLI.
3. **Plans and limits:**
   - plan on the account (`free` or `premium`);
   - Free capped at 3 projects, enforced on the server when a project is created;
   - a credits ledger;
   - each built-in AI call records its provider usage and is charged against the ledger, with the estimated cost shown before costly generation.
4. **Billing:**
   - Stripe Checkout for Premium;
   - signature-verified webhook that sets the plan and grants monthly credits;
   - Customer Portal link;
   - downgrade keeps existing projects read-only past 3 rather than deleting anything.
5. **Account and data deletion**, needed for the privacy policy and Meta later.
6. **Shrink workspace history** (F4 in `architecture/runtime-fixes-2026-10-31.md`), before contractors write to projects.
7. **Contractor share link:** a per-project, expiring, read-only handoff page, plus a "send a quote" form that arrives as a proposal.
8. **Homepage copy** to match: labor wording, the two starters with nothing behind them, "Built on MCP" link, and the plan table showing Free and $7.99 Premium.

## Credits: measure before choosing numbers

We don't yet know what a photo read, a render or a Jev pricing pass costs us. The only data point so far is about 5k input tokens for a Jev photo read (`architecture/room-studio.md`).

Step 3 records actual usage per call. After a week of beta use:

- Set the monthly Premium credits so that average model cost per paying user stays well below the about $7.45 left after Stripe's fee.
- Leave room for Railway, Atlas and Bunny.
- Then size the Free starter grant.

Until then, any credit amount is a guess.
