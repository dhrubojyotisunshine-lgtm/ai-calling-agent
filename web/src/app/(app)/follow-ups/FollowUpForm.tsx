"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { toIstLocal } from "@/lib/campaigns";
import { TITLE_MAX } from "@/lib/followups";
import type { FollowUpFormState } from "./actions";

export type FollowUpValues = { kind: "AI_CALLBACK" | "STAFF_TASK"; title: string; dueAt: string; agentId: string; assignedUserId: string };

// Quick picks, computed in India time.
function preset(kind: "hour" | "tomorrow" | "3days"): string {
  const now = new Date();
  if (kind === "hour") return toIstLocal(new Date(Math.ceil((now.getTime() + 3_600_000) / 900_000) * 900_000));
  const days = kind === "tomorrow" ? 1 : 3;
  const day = toIstLocal(new Date(now.getTime() + days * 86_400_000)).slice(0, 10);
  return `${day}T11:00`;
}

export function FollowUpForm({ action, initial, agents, team, canCallback, lead, back, cancelHref, isDnd }: {
  action: (prev: FollowUpFormState, form: FormData) => Promise<FollowUpFormState>;
  initial: FollowUpValues;
  agents: { id: string; name: string }[];
  team: { id: string; name: string }[];
  canCallback: boolean;
  lead: string;
  back: string;
  cancelHref: string;
  isDnd: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [kind, setKind] = useState(initial.kind);
  const due = useRef<HTMLInputElement>(null);

  return (
    // Submit via onSubmit (not `action=`) so React doesn't reset the form when validation fails.
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {state?.error && <p role="alert" className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">{state.error}</p>}
      <input type="hidden" name="back" value={back} />
      <div className="card space-y-5 p-6">
        <p className="text-sm">Follow-up for <b>{lead}</b>{isDnd && <span className="chip ml-2 border-bad/20 bg-bad-soft text-bad">Do not call</span>}</p>

        <fieldset>
          <legend className="label mb-2 block">Who follows up</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice name="kind" value="STAFF_TASK" checked={kind === "STAFF_TASK"} onChange={() => setKind("STAFF_TASK")}
              title="Team task" text="A reminder for someone in your team, e.g. send a quote." />
            <Choice name="kind" value="AI_CALLBACK" checked={kind === "AI_CALLBACK"} onChange={() => setKind("AI_CALLBACK")} disabled={(!canCallback || isDnd) && initial.kind !== "AI_CALLBACK"}
              title="Agent calls back" text={!canCallback ? "Only owners and admins can schedule these." : isDnd ? "Not possible: this lead is marked Do not call." : "Your AI agent calls the lead at this time. Uses wallet balance."} />
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="title" className="label block">What is it about</label>
          <input id="title" name="title" defaultValue={initial.title} maxLength={TITLE_MAX} className="input"
            placeholder={kind === "AI_CALLBACK" ? "Confirm the Friday demo time" : "Send GST quote on WhatsApp"} />
          {kind === "AI_CALLBACK" && <p className="text-xs text-muted">The agent sees this note and the lead&apos;s history when it calls.</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="dueAt" className="label block">When (India time)</label>
            <input ref={due} id="dueAt" name="dueAt" type="datetime-local" defaultValue={initial.dueAt} className="input" />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {([["hour", "In 1 hour"], ["tomorrow", "Tomorrow 11 am"], ["3days", "In 3 days, 11 am"]] as const).map(([k, l]) => (
                <button key={k} type="button" className="chip border-line bg-paper text-ink hover:border-brand" onClick={() => { if (due.current) due.current.value = preset(k); }}>{l}</button>
              ))}
            </div>
          </div>
          {kind === "AI_CALLBACK" ? (
            <div className="space-y-1.5">
              <label htmlFor="agentId" className="label block">Agent who calls</label>
              <select id="agentId" name="agentId" defaultValue={initial.agentId} className="input">
                <option value="">Pick an agent</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          ) : (
            <input type="hidden" name="agentId" value="" />
          )}
          <div className="space-y-1.5">
            <label htmlFor="assignedUserId" className="label block">{kind === "AI_CALLBACK" ? "Team member to inform (optional)" : "Assigned to"}</label>
            <select id="assignedUserId" name="assignedUserId" defaultValue={initial.assignedUserId} className="input">
              <option value="">Nobody yet</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className="btn">Cancel</Link>
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save follow-up"}</button>
      </div>
    </form>
  );
}

function Choice({ name, value, checked, onChange, disabled, title, text }: {
  name: string; value: string; checked: boolean; onChange: () => void; disabled?: boolean; title: string; text: string;
}) {
  return (
    <label className={`flex gap-3 rounded-xl border p-4 ${checked ? "border-brand bg-brand/5" : "border-line"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="mt-1 h-4 w-4 accent-brand" />
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </label>
  );
}
