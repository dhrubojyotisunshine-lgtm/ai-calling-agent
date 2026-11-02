// Creates (or resets) a demo company with sample data on every screen, for trying the app locally.
//   node scripts/seed-demo.mjs          -> create / reset the demo company
//   node scripts/seed-demo.mjs --remove -> delete it
// Only touches the "Demo Traders" workspace (found by the demo owner's email). LOCAL USE ONLY.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const OWNER = "demo@voxura.test";
const STAFF = "staff@voxura.test";
const PASSWORD = "Demo@1234";
const NUMBER = "+918022223333";

const min = (n) => new Date(Date.now() + n * 60_000);
const day = (d, hhmm = "11:00") => {
  // d days from today, at hh:mm India time
  const ist = new Date(Date.now() + 330 * 60_000 + d * 86_400_000).toISOString().slice(0, 10);
  return new Date(`${ist}T${hhmm}:00+05:30`);
};

async function remove() {
  const owner = await db.user.findUnique({ where: { email: OWNER }, select: { workspaceId: true } });
  if (owner) {
    await db.phoneNumber.deleteMany({ where: { workspaceId: owner.workspaceId } });
    await db.workspace.delete({ where: { id: owner.workspaceId } }); // cascades to everything in it
  }
  await db.user.deleteMany({ where: { email: { in: [OWNER, STAFF] } } });
  await db.phoneNumber.deleteMany({ where: { e164: NUMBER } });
}

async function seed() {
  await remove();
  const hash = await bcrypt.hash(PASSWORD, 12);
  const ws = await db.workspace.create({ data: { name: "Demo Traders", walletBalance: 0 } });
  const owner = await db.user.create({ data: { workspaceId: ws.id, name: "Demo Owner", email: OWNER, phone: "+919876543210", passwordHash: hash, role: "OWNER", isPlatformAdmin: true } });
  const staff = await db.user.create({ data: { workspaceId: ws.id, name: "Sam (Staff)", email: STAFF, passwordHash: hash, role: "STAFF" } });

  // wallet: a top-up, then call charges below keep the ledger consistent
  let balance = 1000;
  await db.walletTransaction.create({ data: { workspaceId: ws.id, type: "TOPUP", amount: 1000, balanceAfter: balance, note: "Demo top-up", createdAt: day(-3, "10:00") } });

  const erp = await db.catalogItem.create({ data: { workspaceId: ws.id, type: "SERVICE", name: "ERP for retail", description: "Billing, stock and GST in one app.", priceText: "From ₹45,000 a year", whenToOffer: "Shops with 2+ branches", nextAction: "Book demo" } });
  const app = await db.catalogItem.create({ data: { workspaceId: ws.id, type: "PRODUCT", name: "Billing app", priceText: "₹499 a month", nextAction: "Send sign-up link", trialDays: 14, signupUrl: "https://example.com/signup" } });

  const number = await db.phoneNumber.create({ data: { workspaceId: ws.id, e164: NUMBER, channels: 2, monthlyRent: 499, renewsOn: day(5) } });
  const priya = await db.agent.create({
    data: {
      workspaceId: ws.id, name: "Priya Sales", mode: "ASSISTANT", purpose: "OUTBOUND", phoneNumberId: number.id, maxConcurrentCalls: 2,
      greeting: "Namaste {name}, main Priya bol rahi hoon Demo Traders se.", systemPrompt: "You are Priya, a friendly sales assistant. Offer a demo of our ERP.",
      knowledgeText: "Demo Traders sells ERP and billing software to shops.", catalogItems: { create: [{ catalogItemId: erp.id }, { catalogItemId: app.id }] },
      faqs: { create: [{ question: "Is there a free trial?", answer: "Yes, the billing app has a 14-day free trial.", position: 0 }] },
    },
  });
  const reception = await db.agent.create({
    data: { workspaceId: ws.id, name: "Reception", mode: "ASSISTANT", purpose: "INBOUND", phoneNumberId: number.id, greeting: "Demo Traders, namaste! How can I help?", systemPrompt: "Answer questions and take messages." },
  });

  const L = [
    ["Ravi Traders", "+919811100001", "Jaipur", "INTERESTED", erp.id, 450000],
    ["Meena Stores", "+919811100002", "Pune", "CONTACTED", null, null],
    ["Kumar Electricals", "+919811100003", "Jaipur", "DEMO_PROPOSAL", erp.id, 300000],
    ["Sharma Kirana", "+919811100004", "Delhi", "NEW", null, null],
    ["Gupta Medicals", "+919811100005", "Delhi", "NEW", null, null],
    ["Patel Hardware", "+919811100006", "Ahmedabad", "NEW", null, null],
    ["Singh Textiles", "+919811100007", "Ludhiana", "WON", app.id, 5988],
    ["Rao Mobiles", "+919811100008", "Hyderabad", "LOST", null, null],
    ["Iyer Bakery", "+919811100009", "Chennai", "NEW", null, null],
    ["Das Furniture", "+919811100010", "Kolkata", "CONTACTED", app.id, null],
    ["Khan Opticals", "+919811100011", "Lucknow", "NEW", null, null],
  ];
  const leads = {};
  for (const [name, phone, city, stage, item, deal] of L)
    leads[name] = await db.lead.create({ data: { workspaceId: ws.id, name, phone, city, stage, interestedItemId: item, dealValue: deal, assignedUserId: stage === "NEW" ? null : owner.id, fields: { loan_amount: "250000" } } });
  leads.dnd = await db.lead.create({ data: { workspaceId: ws.id, name: "Verma (DND)", phone: "+919811100012", city: "Jaipur", isDnd: true } });

  // a running campaign with progress
  const camp = await db.campaign.create({ data: { workspaceId: ws.id, agentId: priya.id, name: "Diwali offer – North", status: "RUNNING", startAt: day(-1, "10:00"), maxConcurrent: 2 } });
  const cl = ["Ravi Traders", "Meena Stores", "Kumar Electricals", "Sharma Kirana", "Gupta Medicals", "Patel Hardware"];
  const clStatus = ["ANSWERED", "NO_ANSWER", "ANSWERED", "PENDING", "PENDING", "FAILED"];
  for (let i = 0; i < cl.length; i++)
    await db.campaignLead.create({ data: { campaignId: camp.id, leadId: leads[cl[i]].id, status: clStatus[i], attempts: clStatus[i] === "PENDING" ? 0 : clStatus[i] === "NO_ANSWER" ? 3 : 1, lastError: clStatus[i] === "FAILED" ? "Number not reachable" : clStatus[i] === "NO_ANSWER" ? "No answer after 3 tries" : null } });
  await db.campaign.create({ data: { workspaceId: ws.id, agentId: priya.id, name: "New year follow-up", status: "DRAFT" } });

  // calls with transcripts and charges
  const calls = [
    { lead: "Ravi Traders", at: day(-1, "10:05"), sec: 125, outcome: "INTERESTED", summary: "Ravi wants the ERP demo on Friday at 11 am. Has 3 branches.", msgs: [["AGENT", "Namaste Ravi ji, main Priya bol rahi hoon Demo Traders se."], ["CUSTOMER", "Haan boliye."], ["AGENT", "Aapke teen branches ke liye hamara ERP stock aur GST ek jagah sambhalta hai. Demo dekhna chahenge?"], ["CUSTOMER", "Haan, Friday ko 11 baje rakh dijiye."]] },
    { lead: "Meena Stores", at: day(-1, "10:20"), sec: 0, status: "NO_ANSWER" },
    { lead: "Kumar Electricals", at: day(-1, "11:00"), sec: 64, outcome: "CALLBACK", summary: "Busy now, asked to call back tomorrow evening.", msgs: [["AGENT", "Namaste, Kumar ji?"], ["CUSTOMER", "Abhi busy hoon, kal shaam ko call kijiye."]] },
    { lead: "Patel Hardware", at: day(-1, "11:30"), sec: 0, status: "FAILED", fail: "Number not reachable" },
    { lead: null, inbound: "+919000000099", at: day(0, "09:40"), sec: 40, outcome: "NO_DECISION", agent: reception, summary: "Asked about office timings." },
  ];
  for (const c of calls) {
    const lead = c.lead ? leads[c.lead] : null;
    const charge = c.sec ? Math.round((c.sec / 60) * 5 * 100) / 100 : 0;
    const call = await db.call.create({
      data: {
        workspaceId: ws.id, agentId: (c.agent ?? priya).id, leadId: lead?.id, campaignId: c.lead && cl.includes(c.lead) ? camp.id : null,
        direction: c.inbound ? "INBOUND" : "OUTBOUND", status: c.status ?? "COMPLETED",
        fromNumber: c.inbound ?? NUMBER, toNumber: c.inbound ? NUMBER : lead.phone, startedAt: c.at,
        answeredAt: c.sec ? new Date(c.at.getTime() + 6000) : null, endedAt: new Date(c.at.getTime() + 6000 + c.sec * 1000),
        durationSec: c.sec, ratePerMin: c.sec ? 5 : null, totalCharge: charge, outcome: c.outcome, summary: c.summary, failReason: c.fail,
        messages: c.msgs ? { create: c.msgs.map(([role, text], i) => ({ role, text, at: new Date(c.at.getTime() + 8000 + i * 9000) })) } : undefined,
      },
    });
    if (charge) {
      balance = Math.round((balance - charge) * 100) / 100;
      await db.walletTransaction.create({ data: { workspaceId: ws.id, type: "CALL_CHARGE", amount: -charge, balanceAfter: balance, callId: call.id, note: "Call charge", createdAt: call.endedAt } });
    }
    if (c.lead === "Ravi Traders")
      await db.followUp.create({ data: { workspaceId: ws.id, leadId: lead.id, callId: call.id, agentId: priya.id, kind: "AI_CALLBACK", title: "Confirm Friday demo time", dueAt: day(2) } });
    if (c.lead === "Kumar Electricals")
      await db.followUp.create({ data: { workspaceId: ws.id, leadId: lead.id, callId: call.id, kind: "STAFF_TASK", title: "Call Kumar back in the evening", dueAt: min(-90), assignedUserId: staff.id } });
  }
  await db.workspace.update({ where: { id: ws.id }, data: { walletBalance: balance } });
  await db.followUp.create({ data: { workspaceId: ws.id, leadId: leads["Singh Textiles"].id, kind: "STAFF_TASK", title: "Send GST invoice", dueAt: min(120), assignedUserId: owner.id } });

  console.log(`Demo ready. Owner (also Voxura admin): ${OWNER} / ${PASSWORD}   Staff: ${STAFF} / ${PASSWORD}   Wallet: ₹${balance}`);
}

(process.argv.includes("--remove") ? remove().then(() => console.log("Demo removed.")) : seed())
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
