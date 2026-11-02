# Work Log — ai-calling-agent (newest first)

## How to resume
- Project folder: `D:\sunshine\ai-calling-agent`. Git repo initialised, NOTHING COMMITTED yet (commit only when the user asks).
- DEVELOPMENT HAS STARTED (user, 2026-10-31): build FROM SCRATCH (not the live Voxura code), any technology. Live app https://agents.kriscenttechnohub.com/ is a reference only.
- Stack: `web/` Next.js 15 + TypeScript + Tailwind v4 + Prisma 6 + MySQL (XAMPP MariaDB 10.4, db `voxura_agent`, root/no password locally). Voice worker (`agent/`, Python + LiveKit Agents) not started.
- Run: `cd web && npm run dev` (or `npm run build && npx next start -p 3100`). See root README.md.
- Screens spec = draft screens v2 artifact https://claude.ai/artifact/HWG5ADzHj7Q6Vsw7MxeomR
- Next step: Live call / browser test call (talk to an agent from the browser; needs LiveKit + provider keys), then the Python voice worker; then the voice worker (it must also run campaigns: see "Voice worker must" below). Payment gateway (e.g. Razorpay) to replace test top-ups before go-live.
- BUILD ON THIS PC: the user runs `npm run dev` on port 3000. `next build` uses the same `.next` folder, so building while it runs broke the build once (fix: delete `.next`, rebuild). For E2E tests prefer a separate copy/`distDir`, or ask the user to stop dev first.
- Demo login (local only): `node scripts/seed-demo.mjs` in `web/` → demo@voxura.test / Demo@1234 (owner + Voxura admin), staff@voxura.test / Demo@1234. Note: the demo company has a phone number, so the Phone numbers E2E counts (pool/with companies) assume the demo is removed (`--remove`) first.
- Platform admin (Voxura staff): set `User.isPlatformAdmin = 1` in the database for now; they get a "Voxura admin → Number pool" menu.
- MIGRATIONS ON THIS PC: do NOT use `prisma migrate dev` or `migrate diff` with a shadow DB. Windows MySQL lowercases table names, so Prisma generates "drop and recreate every table". Write the migration SQL by hand in `prisma/migrations/<timestamp>_<name>/migration.sql`, then `npx prisma migrate deploy` + `npx prisma generate` (stop `next start` first, it locks the engine DLL).
- Provider accounts needed before the voice worker: LiveKit Cloud (free tier), Deepgram ($200 credit), Sarvam (small credit), Claude API key (user has Claude; confirm it's an API/Console account, not only a subscription), Indian SIP provider (only for real phone calls).

## 2026-11-02 — Demo account for local testing (user asked to test with credentials)
- `web/scripts/seed-demo.mjs`: creates/resets "Demo Traders": wallet ₹1,000 top-up minus call charges (ledger consistent), 2 services/products, agents Priya Sales (outbound) + Reception (answers calls) on +91 80222 23333 (2 lines, rent due in 5 days), 12 leads in all stages (one DND), running campaign with progress + a draft, 5 calls (transcripts, outcomes, no-answer, failed, incoming), 3 follow-ups (overdue / later today / in 2 days). `--remove` deletes it. Touches only that company.
- Verified on the user's own `npm run dev` (port 3000): both logins open Dashboard, Leads, Campaigns, Calls, Follow-ups, Phone numbers, Billing (+ Number pool for the owner).
- Final full E2E before seeding: 9 suites, 285 PASS (Auth 17, Agents 18, Services 21, Billing 30, Leads 35, Campaigns 47, Calls 44, Follow-ups 43, Phone numbers 30).

## 2026-11-02 — Build step 9: Phone numbers
- `src/lib/numbers.ts`: `normalizeDid` for business numbers (landline with 0, toll-free 1800, +country), 14/14 unit cases; `formatPhone` now also shows toll-free as "+91 1800 123 4567".
- `/phone-numbers` (company): each number with lines, monthly rent, renewal date (warning within 7 days / overdue), who answers incoming calls (or "Nobody"), who calls out from it; totals. OWNER/ADMIN "Change agents" (ticking an agent that is on another number moves it). STAFF view only. Empty state explains numbers come from Voxura (fixes the live app's page that never loaded).
- Rule (both on this page and on the agent form): only one agent that answers calls (Inbound or Both) per number.
- `/admin/numbers` (Voxura staff, `isPlatformAdmin`): add numbers to the pool (lines 1–30, rent, SIP trunk id; duplicates refused), assign a pool number to a company with a renewal date, take it back (that company's agents stop using it), delete only pool numbers. Assign works only from the pool (no silent moves between companies).
- Agents page/form show numbers formatted ("+91 80456 78901 · 2 lines") instead of raw +91….
- Not done: automatic monthly rent charge from the wallet (needs scheduler/payment gateway), number request flow, audit log of admin actions.
- Tested: tsc + clean build. E2E Phone numbers 30/30 (all 9 suites 285 PASS) (admin guard for owner/staff/other company, add/invalid/duplicate/lines limit, ₹ and commas in rent, assign with/without company, company sees only own numbers, renewal warning, one answering agent on both screens, formatted numbers, staff view only, company B picks only own agents, take back unlinks agents, delete pool only).

## 2026-11-02 — Build step 8: Follow-ups
- Schema: FollowUp.agentId (optional, agent who calls back; SET NULL if the agent is deleted). Migration `followup_agent`, written by hand.
- `src/lib/followups.ts`: kinds ("Agent calls back" / "Team task"), statuses, buckets: Overdue = open and time passed; Today = open, still to come today (IST); Upcoming = after today. Dashboard now uses the same buckets and links to the right tab.
- `/follow-ups`: tabs with counts (opens on Overdue if any, else Today, else Upcoming), filter by type and "assigned to me / nobody", 50 per page, lead link + DND chip, agent or person, "from call on …" link, flags callbacks with no agent. Done / Edit / Cancel / Reopen buttons.
- `/follow-ups/new`: find the lead by name or number, then the form; also opened from the lead page (+ Add follow-up) and the call page (+ Add, linked to that call). Quick times: In 1 hour, Tomorrow 11 am, In 3 days 11 am. After saving: back to the lead/call page, or to the tab the follow-up sits in.
- `/follow-ups/[id]/edit`: only open follow-ups.
- Rules: title required (max 255); time required and not in the past; callbacks need an outgoing agent and are refused for DND leads; assigned person must be in the workspace; a linked call must be that lead's call in this workspace (else not linked); the return link only goes to our own pages.
- Roles: agent callbacks (they spend wallet money) are created/changed/closed only by OWNER/ADMIN; STAFF can create and close team tasks and see everything.
- Tested: tsc + build clean. E2E Follow-ups 43/43 (lead search, validation, IST preset + UTC storage, callbacks, DND block incl. forced form, forged back link + foreign call, buckets + dashboard, done/reopen/cancel, edit, filters, lead + call page flows, agent removed flag, staff limits incl. forced callback, isolation). All suites: Auth 17, Agents 18, Services 21, Billing 30, Leads 35, Campaigns 47, Calls 44, Follow-ups 43 = 255 PASS. Test data deleted.
- Voice worker must: call AI_CALLBACK follow-ups at dueAt (inside the workspace calling hours), re-check DND + wallet, mark DONE with doneAt and link the new call; create follow-ups when a caller asks for a callback.

## 2026-11-02 — Build step 7: Call history
- `src/lib/calls.ts`: labels for call result, outcome, direction (Outgoing/Incoming/Test call). A "completed" call with 0 seconds and no answer time is shown as "No answer" (live app showed these as Completed). Recordings only play from http(s) links.
- `/calls`: filters in the URL (search name/number, result answered/no answer/failed/in progress, outcome, type, agent, campaign, from/to India dates), stats for the filter (calls, answered %, talk time, charged), 25 per page, names instead of ids, IST times. Filters always limited to the workspace (other companies' ids in the URL match nothing).
- `/calls/[id]`: who, result + outcome, agent/campaign links, numbers, answered/ended times, failure reason, summary, recording player, conversation bubbles with speaker + time, billing (talk time, rate, charged, wallet after, link to billing), follow-ups from the call.
- `/calls/export` (OWNER/ADMIN): CSV of the current filters, max 10,000 rows, UTF-8 BOM for Excel, cells that look like formulas prefixed with ' (phone numbers left as is).
- Linked from: lead page call rows, billing call rows, campaign page "N calls", sidebar.
- Roles: everyone can view calls; only OWNER/ADMIN download CSV.
- Tested: tsc + build clean (also removed an unused-variable warning in campaign edit page). E2E Call history 44/44 (stats, paging, IST order, 0-sec call label, 13 filters incl. 11:30 pm IST day edge, detail/transcript/recording/billing/follow-up, unsafe recording link not played, cross-page links, CSV contents/escaping/filters, staff limits, isolation). All suites: Auth 17, Agents 18, Services 21, Billing 30, Leads 35, Campaigns 47, Calls 44 = 212 PASS. Test data deleted.
- Open question for the client: how calls are rounded for billing (per second or per started minute). Detail page shows only stored duration/rate/charge, no derived "billable minutes".

## 2026-11-02 — Build step 6: Campaigns
- Schema: campaign name unique per workspace (migration `campaign_unique_name`); Campaign→Agent FK changed Restrict→Cascade (`campaign_agent_cascade`) because Restrict blocked deleting a whole workspace. The app still refuses to delete an agent used by a campaign, now atomically (`deleteMany … campaigns: none`).
- `src/lib/campaigns.ts`: status labels, which action is allowed from which status, retry gaps, 10,000-lead cap, IST <-> datetime-local helpers, cost estimate (placeholder ≈1.5 min/call at ≈₹5/min assistant, ≈₹2/min announcement, until plans fix real rates).
- `/campaigns` list (tabs All/Active/Drafts/Finished, progress bar, calls, spent), `/campaigns/new`, `/campaigns/[id]` (status explanation, progress, counts per lead status, settings, lead table with status filter + paging, manual Refresh link, NO auto-refresh), `/campaigns/[id]/edit` (settings only; people fixed after creation).
- Who to call: lead stages, city, owner, "only leads added since your import"; skip DND (default on, TRAI warning when off); skip leads another active campaign is still calling (default on). Live count + cost estimate + wallet check as filters change (debounced, no polling).
- Rules: outbound/both agents only; calls at once ≤ agent's limit; hours end after start; start time not in the past; Start needs an active agent, people left to call and wallet > ₹0. Statuses: Draft → (Start) Scheduled → Running (set by worker) ⇄ Paused → Completed/Cancelled. Cancel skips everyone still waiting. Delete only Draft/Completed/Cancelled (call records stay).
- Lead import result now offers "Call these leads in a campaign" (passes the import time). Dashboard running-campaign name links to it. Sidebar Campaigns live.
- Roles: OWNER/ADMIN create/edit/start/pause/cancel/delete; STAFF view only.
- Bug fixed (shared): ConfirmDeleteButton hid its own error when a delete was refused (e.g. "agent is used by a campaign"); error now shows under the Delete button. Affects Agents, Services, Leads, Campaigns.
- Tested: tsc + build pass. E2E Campaigns 47/47 (audience counts, DND, busy leads, validation, wallet, draft/start/pause/resume/cancel/delete, edit, progress, dashboard, agent-in-use delete error, staff, isolation, import hand-off, name per company). All suites: Auth 17, Agents 18, Services 21, Billing 30, Leads 35, Campaigns 47 = 168 PASS. Test data deleted.
- Voice worker must: move SCHEDULED→RUNNING at startAt; only call inside callWindowFrom/To IST; respect maxConcurrent; re-check DND (skipDnd) and wallet before each call and stop at ₹0; retries with retryGapMinutes; set COMPLETED + completedAt when nobody is waiting; never charge unanswered calls (0 sec).
- Not done: add more leads to an existing campaign, duplicate campaign, per-campaign script overrides.

## 2026-11-02 — Build step 5: Leads (CRM)
- `src/lib/phone.ts` (normalise to E.164: Indian mobiles → +91XXXXXXXXXX from spaces/dashes/0/91/0091/Excel "9.87E+09"; foreign numbers need +code; `formatPhone` → "+91 98765 43210"). 18/18 unit cases pass. `src/lib/leads.ts` stages: New, Contacted, Interested, Demo/proposal, Won, Lost.
- `/leads`: Board (6 columns, counts, 25 newest per column + "See all"), stage picker on each card (no drag-and-drop yet), next follow-up + interest + DND on cards; List (stage tabs with counts, 50 per page); search by name, city or number (any format).
- `/leads/new`, `/leads/[id]` (+ `?edit=1`): name, mobile, city, stage, interested in (catalog), deal value (₹, commas ok), owner (workspace team only), DND, notes. Detail page: info tiles, notes, agent memory, extra import columns as {placeholders}, calls list, follow-ups list. Duplicate number (any format) → "already saved as …".
- `/leads/import` (OWNER/ADMIN): CSV/XLSX/XLS via SheetJS 0.20.3 (official CDN tarball) parsed in the browser; auto-detects phone/name/city columns (changeable); preview with valid/invalid/repeated counts and "Saved as" column; extra columns kept as {snake_case} fields; server re-validates, skips existing numbers (never overwrites), skips repeats/invalid, max 10,000 rows / 5 MB (`serverActions.bodySizeLimit = 5mb` in next.config.ts).
- Roles: STAFF can add/edit/move leads; only OWNER/ADMIN import or delete.
- Tested: tsc, eslint, build pass. E2E Leads 35/35 (validation, duplicate, edit, CSV/XLSX/XLS import counts, existing not overwritten, extra column kept, board counts + stage move persists, search by spaced number/city, list paging + stage filter, staff limits, workspace isolation incl. B importing same numbers, delete). All suites rerun: Auth 17, Agents 18, Services 21, Billing 30, Leads 35 = 121 PASS. Board columns narrowed after screenshot showed "Lost" cut off at 1440px. Test data deleted.
- Not done: drag-and-drop on board, bulk actions (assign/move many), export to CSV.

## 2026-10-31 — Build step 4: Billing & wallet
- `src/lib/wallet.ts`: `creditWallet()` and `chargeCall()` — balance change + ledger row in one transaction with atomic increment/decrement; `chargeCall` is once-per-call (unique `callId`, duplicate returns null). `chargeCall` not yet used (voice worker will call it).
- `/billing`: balance card (total added, spent on calls, below-alert note); Add funds (₹100/250/500/1,000 quick + custom, whole rupees ₹10–₹1,00,000, commas/₹ accepted) labelled TEST MODE (no payment); low-balance alert setting (0 = off); transactions with tabs All / Top-ups / Call charges / Plan + counts, IST dates, call rows show lead name/number + duration + agent (never raw call id), balance-after column, 20 per page.
- Dashboard: low-balance alert links to Billing and respects 0 = off; "?denied=1" now shows "Only an owner or admin can open that page".
- Roles: STAFF sees balance + history only.
- Tested: tsc, eslint, build pass. E2E Billing 30/30 (validation, top-ups, 5 simultaneous top-ups → exact balance + distinct balance-after + ledger sum = balance, alert on/off, DB blocks second charge for same call, call row shows "Ravi Traders · 1m 53s", pagination, staff limits, workspace isolation). Auth 17, Agents 18, Services 21 rerun PASS. Test data deleted.
- Not done: real payment gateway, GST invoices/receipts, plans & add-ons purchase.

## 2026-10-31 — Build step 3: Services & Products
- `/services` table (name, Service/Product chip, price shown to caller + "Agent won't say it", when to offer, next step, agent count, Inactive tag); "+ Add service" / "+ Add product"; Edit; Delete with confirm (agent links removed, leads keep record).
- `/services/new` (`?type=PRODUCT`), `/services/[id]`: type switch, name, price text, description, may-quote-price, when to offer, next step (suggestions list), product-only free trial (0–365) + sign-up link (http/https), agents that may offer it (two-way with agent "What to sell"), Active toggle. Inactive items are hidden from the agent form.
- `services/actions.ts`: zod + friendly errors, OWNER/ADMIN only, agent ids verified per workspace, unique name per workspace, links replaced in a transaction.
- Shared `components/ConfirmDeleteButton.tsx` now used by Agents and Services (old DeleteAgentButton removed).
- Forms now `noValidate` so our friendly messages show instead of browser pop-ups (found by test).
- Tested: tsc, eslint, build pass. E2E: Services 21/21, Agents 18/18, Auth 17/17 PASS. Test data deleted.

## 2026-10-31 — Build step 2: Agents module
- `/agents` list: cards with status, mode, plain-language chips (Brain / Speaks / purpose · number / memory / recording / concurrency), "Offers:" catalog items, calls + billed per agent; Edit, Call (disabled until Live call), Delete with inline confirm. STAFF sees View only.
- `/agents/new`, `/agents/[id]`: 6-step form (Identity, What to say, What to sell, Knowledge, Voice & language, Advanced). Assistant vs Announcement switch; FAQs add/remove; catalog ticks; voice list follows gender. Choices in `src/lib/agent-options.ts` (11 Indian languages, Sarvam voices, Claude Haiku 5.5 default / Sonnet 5.5).
- `agents/actions.ts`: zod validation with friendly messages; OWNER/ADMIN only; phone number + catalog ids verified to belong to the workspace; FAQs + catalog links replaced in one transaction; duplicate name (per workspace) → friendly error; delete blocked if a campaign uses the agent.
- Bug found by test and fixed: React 19 `<form action>` reset the whole form after a failed validation (user lost typed data) → form now submits via onSubmit + startTransition.
- Tested: tsc, eslint, build pass. E2E 18/18 PASS (validation, FAQ, voice switch, save, duplicate name, announcement mode, edit persistence, rename, workspace B can't see / gets 404 for A's agent, same name allowed in B, delete confirm). Auth E2E rerun 17/17 PASS. Test data deleted.
- Not done: ₹/min price estimate in the form (needs pricing rules), voice preview, knowledge file upload, plan agent limit.

## 2026-10-31 — Build step 1: foundation (from scratch)
- Created `web/` (create-next-app 15.5), Prisma schema for all modules: Workspace, User (OWNER/ADMIN/STAFF, isPlatformAdmin), Plan, Agent, AgentFaq, CatalogItem (+AgentCatalogItem), PhoneNumber, Lead, Campaign, CampaignLead, Call, CallMessage, FollowUp, WalletTransaction. Migration `init` applied to new DB `voxura_agent` (other DBs untouched).
- Company scope: every table has workspaceId; uniqueness per workspace (agent name, catalog name, lead phone); `WalletTransaction.callId` unique = one charge per call.
- Auth: register (company, name, email, Indian mobile, password ≥ 8, bcrypt 12) creates workspace + OWNER; login with generic error; signed HS256 cookie `vx_session` (7 days, httpOnly); `requireUser()` re-reads user from DB each request; middleware only checks cookie presence (no redirect loop on stale cookie).
- UI: Voxura look (purple sidebar with labels; unbuilt modules shown as "Soon"); dashboard with wallet, total calls, minutes this month, single "Spent on calls" figure (fixes live app's two spend figures), low-balance alert, Get-started steps, Today / running campaign / follow-ups due.
- Tested: tsc, eslint, `next build` pass. E2E in headless Edge against `next start` — 17/17 PASS (redirects, validation, duplicate email any case, workspace B can't see A, sign out, wrong/right password, forged cookie). Test accounts deleted afterwards (DB has 0 users).
- Not done: no login rate limiting yet; Forgot password / OTP not built; no commit (git commit was blocked — needs user's go-ahead).

## 2026-10-31 — Draft screens v2 from the LIVE app (user request)
- Logged into live app (read-only: only opened pages/forms/one call detail; nothing saved, deleted, called or paid) with headless Edge + puppeteer-core.
- Live app pages: Login/Register, Dashboard (/), Live call (/call), Campaigns (/campaigns, empty) + Create (/campaigns/new), Agents (/agents) + New/Edit (/agents/new, /agents/:id), Phone numbers (/phone-numbers), Call history (/calls, View = details panel with billing + transcript), Billing (/billing: wallet, plan ₹4,999/mo, add-ons, transactions). Sidebar is icon-only.
- Issues seen on live: Phone numbers stuck on "Loading…" (2 visits, >12s); dashboard 124 calls vs call history 184; "Customer spend" ₹161.40 vs "Total spent" ₹121.97; call history shows internal IDs only (no customer/number/agent name); many "Completed" 0s/₹0 calls; billing dates raw UTC ISO strings; plan dropdown shows "__none__"; agent chips show raw provider codes; no recording player in call detail.
- Created `draft-screens/live-app-draft-screens.html` — 15 screens, each tagged Live / Changed / New with "live today / issues / proposed / questions". New: Services & Products, Campaign progress, Leads (CRM), Follow-ups. Sample data only (no client agents, numbers or transcripts).
- Published as artifact (private until shared): https://claude.ai/artifact/HWG5ADzHj7Q6Vsw7MxeomR
- Captures (screenshots + page text) saved in `live-app-capture-2026-10-31/` (local only; contain the account's real data).
- Tested: one rendered screenshot check at 1440px; fixed mock width and pin clipping. Not checked on mobile width.
- Not seen: admin console (customer login), campaign list/detail with data, SIP-phone call flow, payment gateway.
- Older artifacts (v1 draft screens, suggested add-ons) left untouched.

## 2026-10-26 — Suggested add-ons artifact (separate, user request)
- New artifact https://claude.ai/artifact/58GcXFMQsDQM975F6hUCU3 (`suggested-additions-artifact.html`): 33 optional ideas in 6 groups with tick-list and "Copy my list". Original draft-screens artifact untouched. Not browser-checked; private until shared. Nothing is in scope until the client picks.

## 2026-10-26 — Products added beside services (user request)
- Screen 4 renamed "Services & Products": "+ Add service" and "+ Add product" buttons, Type column, Service/Product switch in the edit form, sample product "Brightlane Billing App", sidebar and agent-setup selection updated. Artifact republished (v4). Not browser-checked. Open: product-specific fields (pricing per user/month, free trial, sign-up link).

## 2026-10-26 — Services = SOFTWARE services (user clarification)
- Sample data changed from real estate to a software company (mobile apps, websites, AI chatbots/voice agents, ERP/CRM). Service decision questions rewritten (pricing model, timeline, may agent quote prices, demo/proposal next steps). Artifact republished (v3). Not browser-checked.

## 2026-10-26 — Services screen added (user request)
- Added Screen 4 "Your services" (title, description, price, when to offer, next action per service; per-agent selection in Agent setup). Screens renumbered to 12. Artifact https://claude.ai/artifact/ASV6pVfF612Bri2SrGvimk republished. Not browser-checked. Open: client decisions on service fields and what happens when a customer picks a service. Still awaiting approval.
- Note: older `draft-screens.html` (plain wireframes) not updated with Services.

## 2026-10-26 — Draft screens created
- Inspected: project folder (empty); live site via read-only fetch (Next.js, wallet billing per minute, 4 model providers, 8 voices, contact-sales access, DLT/ISO claims unverified).
- Created `draft-screens/draft-screens.html` — 11 wireframes (S1–S11) with open questions.
- Tested: not rendered/visually checked yet; nothing else run.
- Open: awaiting user approval; not complete.
