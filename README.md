# Voxura AI Calling Agent

AI voice agents for Indian businesses. The agents answer incoming calls, call leads and follow up. Customers pay from a prepaid ₹ wallet, billed per minute.

## Layout
- `web/`: the web app (dashboard, all screens, API). Built with Next.js 15 (App Router, TypeScript, Tailwind v4), Prisma and MySQL.
- `agent/` (coming): a Python voice worker on LiveKit Agents. It turns the caller's speech into text, sends it to the AI, and speaks the reply. Phone calls go over SIP.
- `docs/client-approval/`: draft screens and the work log. Start with `docs/client-approval/WORK-LOG.md`.

## Run locally (Windows + XAMPP)
1. Start MySQL in XAMPP (port 3306).
2. `cd web`, then copy `.env.example` to `.env`. Set `DATABASE_URL` and a 64-character `SESSION_SECRET`.
3. `npm install`
4. `npx prisma migrate dev` creates the `voxura_agent` tables.
5. `npm run dev`, then open http://localhost:3000 and click Register.
6. Optional demo data: `node scripts/seed-demo.mjs` (run inside `web/`) creates the company "Demo Traders" with agents, leads, a campaign, calls, follow-ups and a phone number. Log in as `demo@voxura.test` / `Demo@1234` (owner, also Voxura admin) or `staff@voxura.test` / `Demo@1234` (staff). Run it again to reset the demo; `--remove` deletes it. Local testing only; never run it on a live server.
7. Don't run `npm run build` while `npm run dev` is running: both use the `.next` folder. If pages fail oddly afterwards, stop the server, delete `web/.next` and start again.

## Rules for every feature
- Every record belongs to one workspace (company), and every query filters by the signed-in user's `workspaceId`.
- Names and phone numbers are unique within a workspace, not globally. Show friendly errors when they clash.
- Money is stored as `Decimal(12,2)` in rupees. Times are stored in UTC and shown in IST.



Login	Email	Password	What you see
Owner	demo@voxura.test	Demo@1234	Everything, plus the Voxura admin → Number pool menu
Staff	staff@voxura.test	Demo@1234	The staff view: no imports, deletes or campaign controls
