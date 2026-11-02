"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { EST_MIN_PER_CALL, EST_RATE_PER_MIN, MAX_RETRIES, RETRY_GAPS, estimateCost } from "@/lib/campaigns";
import { money } from "@/lib/format";
import { STAGES } from "@/lib/leads";
import { previewAudience, type AudienceCount, type CampaignFormState } from "./actions";

export type CampaignValues = {
  name: string; agentId: string; startAt: string; callWindowFrom: string; callWindowTo: string;
  maxConcurrent: string; retryCount: string; retryGapMinutes: string; skipDnd: boolean;
};
export type AgentOption = { id: string; name: string; mode: "ASSISTANT" | "ANNOUNCEMENT"; status: "ACTIVE" | "PAUSED"; maxConcurrentCalls: number };

export function CampaignForm({ mode, action, initial, agents, team, balance, addedSince, cancelHref }: {
  mode: "create" | "edit";
  action: (prev: CampaignFormState, form: FormData) => Promise<CampaignFormState>;
  initial: CampaignValues;
  agents: AgentOption[];
  team: { id: string; name: string }[];
  balance: number;
  addedSince?: { iso: string; label: string };
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [agentId, setAgentId] = useState(initial.agentId);
  const [skipDnd, setSkipDnd] = useState(initial.skipDnd);
  const agent = agents.find((a) => a.id === agentId);

  return (
    // Submit via onSubmit (not `action=`) so React doesn't reset the form when validation fails.
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(data));
      }}
    >
      {state?.error && <p role="alert" className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">{state.error}</p>}

      <section className="card space-y-4 p-6">
        <h2 className="font-bold">1. Campaign</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Campaign name" htmlFor="name">
            <input id="name" name="name" defaultValue={initial.name} maxLength={160} className="input" placeholder="Diwali offer – Jaipur" />
          </Field>
          <Field label="Agent who calls" htmlFor="agentId">
            <select id="agentId" name="agentId" value={agentId} onChange={(e) => setAgentId(e.target.value)} className="input">
              <option value="">Pick an agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.status === "PAUSED" ? " (paused)" : ""}</option>
              ))}
            </select>
          </Field>
        </div>
        {agents.length === 0 && (
          <p className="text-sm text-warn">You don&apos;t have an agent that makes outgoing calls yet. <Link href="/agents/new" className="font-semibold underline">Create one first</Link>.</p>
        )}
        {agent?.status === "PAUSED" && <p className="text-sm text-warn">{agent.name} is paused. You can save a draft, but turn the agent on before starting.</p>}
      </section>

      {mode === "create" && (
        <AudiencePicker team={team} addedSince={addedSince} skipDnd={skipDnd} setSkipDnd={setSkipDnd} agent={agent} balance={balance} />
      )}

      <section className="card space-y-4 p-6">
        <h2 className="font-bold">{mode === "create" ? "3" : "2"}. When and how often</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Start (India time)" htmlFor="startAt" hint="Leave empty to start as soon as you press Start.">
            <input id="startAt" name="startAt" type="datetime-local" defaultValue={initial.startAt} className="input" />
          </Field>
          <Field label="Call from" htmlFor="callWindowFrom" hint="Calls only happen between these times, every day.">
            <input id="callWindowFrom" name="callWindowFrom" type="time" defaultValue={initial.callWindowFrom} className="input" />
          </Field>
          <Field label="Call until" htmlFor="callWindowTo">
            <input id="callWindowTo" name="callWindowTo" type="time" defaultValue={initial.callWindowTo} className="input" />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Calls at once" htmlFor="maxConcurrent" hint={agent ? `${agent.name} can take up to ${agent.maxConcurrentCalls}.` : undefined}>
            <input id="maxConcurrent" name="maxConcurrent" type="number" min={1} max={10} defaultValue={initial.maxConcurrent} className="input" />
          </Field>
          <Field label="If not answered, try again" htmlFor="retryCount">
            <select id="retryCount" name="retryCount" defaultValue={initial.retryCount} className="input">
              {Array.from({ length: MAX_RETRIES + 1 }, (_, n) => (
                <option key={n} value={n}>{n === 0 ? "Don't retry" : `${n} more time${n > 1 ? "s" : ""}`}</option>
              ))}
            </select>
          </Field>
          <Field label="Wait between tries" htmlFor="retryGapMinutes">
            <select id="retryGapMinutes" name="retryGapMinutes" defaultValue={initial.retryGapMinutes} className="input">
              {RETRY_GAPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </Field>
        </div>
        {mode === "edit" && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="skipDnd" checked={skipDnd} onChange={(e) => setSkipDnd(e.target.checked)} className="h-4 w-4 accent-brand" />
            Don&apos;t call numbers marked Do not call (DND)
          </label>
        )}
        {!skipDnd && <DndWarning />}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={cancelHref} className="btn">Cancel</Link>
        {mode === "create" ? (
          <>
            <button type="submit" name="intent" value="draft" disabled={pending} className="btn">{pending ? "Saving…" : "Save as draft"}</button>
            <button type="submit" name="intent" value="schedule" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save and start"}</button>
          </>
        ) : (
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save changes"}</button>
        )}
      </div>
    </form>
  );
}

function AudiencePicker({ team, addedSince, skipDnd, setSkipDnd, agent, balance }: {
  team: { id: string; name: string }[];
  addedSince?: { iso: string; label: string };
  skipDnd: boolean;
  setSkipDnd: (v: boolean) => void;
  agent?: AgentOption;
  balance: number;
}) {
  const [stages, setStages] = useState<string[]>(["NEW", "CONTACTED", "INTERESTED", "DEMO_PROPOSAL"]);
  const [city, setCity] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [since, setSince] = useState(addedSince?.iso ?? "");
  const [skipBusy, setSkipBusy] = useState(true);
  const [count, setCount] = useState<AudienceCount>();
  const [loading, setLoading] = useState(false);

  // Recount only when a filter changes (debounced); nothing refreshes on a timer.
  useEffect(() => {
    let live = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await previewAudience({ stages, city, ownerId, addedSince: since, skipDnd, skipBusy }).catch(() => ({ error: "Couldn't count leads. Check your connection." }));
      if (live) { setCount(res); setLoading(false); }
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [stages, city, ownerId, since, skipDnd, skipBusy]);

  const toggle = (v: string) => setStages((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const estimate = agent && count?.eligible ? estimateCost(count.eligible, agent.mode) : 0;

  return (
    <section className="card space-y-4 p-6">
      <h2 className="font-bold">2. Who to call</h2>
      <fieldset>
        <legend className="label mb-2 block">Lead stages</legend>
        <div className="flex flex-wrap gap-3">
          {STAGES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="stages" value={s.value} checked={stages.includes(s.value)} onChange={() => toggle(s.value)} className="h-4 w-4 accent-brand" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="City contains" htmlFor="city">
          <input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className="input" placeholder="Any city" />
        </Field>
        <Field label="Lead owner" htmlFor="ownerId">
          <select id="ownerId" name="ownerId" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="input">
            <option value="">Anyone</option>
            <option value="none">Nobody assigned</option>
            {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        {addedSince && (
          <div className="space-y-1.5">
            <span className="label block">From your import</span>
            <label className="flex items-center gap-2 pt-2 text-sm">
              <input type="checkbox" checked={since !== ""} onChange={(e) => setSince(e.target.checked ? addedSince.iso : "")} className="h-4 w-4 accent-brand" />
              Only leads added since {addedSince.label}
            </label>
          </div>
        )}
      </div>
      <input type="hidden" name="addedSince" value={since} />
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="skipDnd" checked={skipDnd} onChange={(e) => setSkipDnd(e.target.checked)} className="h-4 w-4 accent-brand" />
          Don&apos;t call numbers marked Do not call (DND)
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="skipBusy" checked={skipBusy} onChange={(e) => setSkipBusy(e.target.checked)} className="h-4 w-4 accent-brand" />
          Skip leads another active campaign is still calling
        </label>
      </div>

      <div className="rounded-lg bg-paper p-4 text-sm" aria-live="polite">
        {count?.error ? (
          <p className="text-bad">{count.error}</p>
        ) : !count ? (
          <p className="text-muted">Counting leads…</p>
        ) : (
          <div className={loading ? "opacity-60" : ""}>
            <p>
              <b className="text-xl tabular-nums" data-testid="eligible">{count.eligible?.toLocaleString("en-IN")}</b> leads will be called
              <span className="text-muted"> · {count.matched?.toLocaleString("en-IN")} match the filters</span>
              {skipDnd && !!count.dnd && <span className="text-muted"> · {count.dnd} on DND left out</span>}
              {skipBusy && !!count.busy && <span className="text-muted"> · {count.busy} already in another campaign left out</span>}
            </p>
            {agent && !!count.eligible && (
              <p className="mt-1 text-muted">
                Estimated cost about <b className="text-ink">{money(estimate)}</b> if everyone answers
                (≈{EST_MIN_PER_CALL} min a call at ≈₹{EST_RATE_PER_MIN[agent.mode]}/min). Unanswered calls are not charged.
                Wallet: <b className={estimate > balance ? "text-bad" : "text-ink"}>{money(balance)}</b>.
              </p>
            )}
            {agent && estimate > balance && (
              <p className="mt-1 text-warn">Your wallet may run out before everyone is called. Calls stop when it reaches ₹0.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function DndWarning() {
  return (
    <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
      Calling DND numbers for promotions can break TRAI rules. Only do this for service calls the customer expects.
    </p>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="label block">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
