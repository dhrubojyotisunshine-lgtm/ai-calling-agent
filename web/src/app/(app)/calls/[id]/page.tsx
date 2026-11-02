import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, duration, money } from "@/lib/format";
import { DIRECTIONS, OUTCOMES, callStatus, safeRecordingUrl } from "@/lib/calls";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Call" };

const time = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit" });

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const call = await db.call.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      lead: { select: { id: true, name: true, phone: true, city: true } },
      agent: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
      messages: { orderBy: { at: "asc" } },
      followUps: { orderBy: { dueAt: "asc" }, include: { assignedUser: { select: { name: true } } } },
    },
  });
  if (!call) notFound();
  const charge = await db.walletTransaction.findFirst({ where: { callId: call.id, workspaceId: user.workspaceId }, select: { amount: true, balanceAfter: true, createdAt: true } });

  const st = callStatus(call);
  const number = call.direction === "INBOUND" ? call.fromNumber : call.toNumber;
  const who = call.lead?.name ?? (number ? formatPhone(number) : call.direction === "BROWSER_TEST" ? "Browser test" : "Unknown number");
  const recording = safeRecordingUrl(call.recordingUrl);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted"><Link href="/calls" className="hover:underline">Call history</Link> / {who}</p>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold">
          {call.lead ? <Link href={`/leads/${call.lead.id}`} className="hover:underline">{who}</Link> : who}
          <span className={`chip ${st.tone}`}>{st.label}</span>
          {call.outcome && <span className={`chip ${OUTCOMES[call.outcome].tone}`}>{OUTCOMES[call.outcome].label}</span>}
        </h1>
        <p className="text-sm text-muted">
          {DIRECTIONS[call.direction]} call · {dateTime(call.startedAt)}
          {call.lead?.name && number && <> · <span className="tabular-nums">{formatPhone(number)}</span></>}
          {call.lead?.city && <> · {call.lead.city}</>}
        </p>
      </header>

      <section className="card grid gap-4 p-5 text-sm sm:grid-cols-2 md:grid-cols-4">
        <Info label="Agent">{call.agent ? <Link href={`/agents/${call.agent.id}`} className="hover:underline">{call.agent.name}</Link> : "Agent removed"}</Info>
        <Info label="Campaign">{call.campaign ? <Link href={`/campaigns/${call.campaign.id}`} className="hover:underline">{call.campaign.name}</Link> : "-"}</Info>
        <Info label="From → To"><span className="tabular-nums">{call.fromNumber ? formatPhone(call.fromNumber) : "-"} → {call.toNumber ? formatPhone(call.toNumber) : "-"}</span></Info>
        <Info label="Talk time">{duration(call.durationSec)}</Info>
        <Info label="Answered at">{call.answeredAt ? time(call.answeredAt) : "Not answered"}</Info>
        <Info label="Ended at">{call.endedAt ? time(call.endedAt) : "-"}</Info>
        {call.failReason && <div className="sm:col-span-2"><Info label="Why it failed"><span className="text-bad">{call.failReason}</span></Info></div>}
      </section>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-5 md:col-span-2">
          <section className="card p-5">
            <h2 className="font-bold">Summary</h2>
            <p className="mt-2 whitespace-pre-line text-sm">{call.summary ?? <span className="text-muted">No summary for this call.</span>}</p>
          </section>

          {recording && (
            <section className="card p-5">
              <h2 className="font-bold">Recording</h2>
              <audio controls preload="none" src={recording} className="mt-3 w-full">Your browser can&apos;t play this recording.</audio>
            </section>
          )}

          <section className="card">
            <h2 className="border-b border-line px-5 py-4 font-bold">Conversation</h2>
            {call.messages.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No transcript for this call.</p>
            ) : (
              <ol className="space-y-3 p-5">
                {call.messages.map((m) => {
                  const agent = m.role === "AGENT";
                  return (
                    <li key={m.id} className={`flex ${agent ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${agent ? "rounded-bl-sm bg-paper" : "rounded-br-sm bg-brand text-white"}`}>
                        <p className={`text-xs font-semibold ${agent ? "text-muted" : "text-white/80"}`}>
                          {agent ? call.agent?.name ?? "Agent" : call.lead?.name ?? "Caller"} · <span className="tabular-nums">{time(m.at)}</span>
                        </p>
                        <p className="mt-0.5 whitespace-pre-line">{m.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5 text-sm">
            <h2 className="font-bold">Billing</h2>
            <dl className="mt-3 space-y-2">
              <Row label="Talk time">{duration(call.durationSec)}</Row>
              <Row label="Rate">{call.ratePerMin ? `${money(call.ratePerMin)}/min` : "-"}</Row>
              <Row label="Charged"><b>{money(call.totalCharge)}</b></Row>
              {charge && <Row label="Wallet after"><span className="tabular-nums">{money(charge.balanceAfter)}</span></Row>}
            </dl>
            <p className="mt-3 text-xs text-muted">
              {charge ? <>Taken from your wallet on {dateTime(charge.createdAt)}. <Link href="/billing?tab=calls" className="text-brand hover:underline">See billing</Link></> : "No wallet charge for this call."}
            </p>
          </section>

          <section className="card p-5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">Follow-ups from this call</h2>
              {call.lead && <Link href={`/follow-ups/new?lead=${call.lead.id}&call=${call.id}&back=${encodeURIComponent(`/calls/${call.id}`)}`} className="text-sm font-semibold text-brand hover:underline">+ Add</Link>}
            </div>
            {call.followUps.length === 0 ? (
              <p className="mt-2 text-muted">None.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {call.followUps.map((f) => (
                  <li key={f.id}>
                    <p className="font-semibold">{f.title}</p>
                    <p className="text-xs text-muted">
                      {f.kind === "AI_CALLBACK" ? "Agent calls back" : `Task for ${f.assignedUser?.name ?? "the team"}`} · {dateTime(f.dueAt)} · {f.status === "OPEN" ? "Open" : f.status === "DONE" ? "Done" : "Cancelled"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="mt-1 font-semibold">{children}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
