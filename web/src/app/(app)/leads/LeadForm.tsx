"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { STAGES } from "@/lib/leads";
import type { LeadFormState } from "./actions";

export type LeadValues = {
  name: string; phone: string; city: string; stage: string; interestedItemId: string; dealValue: string;
  assignedUserId: string; isDnd: boolean; notes: string;
};

export function LeadForm({ action, initial, catalog, team, cancelHref }: {
  action: (prev: LeadFormState, form: FormData) => Promise<LeadFormState>;
  initial: LeadValues;
  catalog: { id: string; name: string }[];
  team: { id: string; name: string }[];
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

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
      <div className="card space-y-5 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Name" htmlFor="name"><input id="name" name="name" defaultValue={initial.name} maxLength={160} className="input" placeholder="Ravi Traders" /></Field>
          <Field label="Mobile number" htmlFor="phone"><input id="phone" name="phone" type="tel" defaultValue={initial.phone} className="input" placeholder="98765 43210" /></Field>
          <Field label="City" htmlFor="city"><input id="city" name="city" defaultValue={initial.city} maxLength={80} className="input" placeholder="Jaipur" /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Stage" htmlFor="stage">
            <select id="stage" name="stage" defaultValue={initial.stage} className="input">
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Interested in" htmlFor="interestedItemId">
            <select id="interestedItemId" name="interestedItemId" defaultValue={initial.interestedItemId} className="input">
              <option value="">Not known yet</option>
              {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Deal value (₹)" htmlFor="dealValue"><input id="dealValue" name="dealValue" inputMode="decimal" defaultValue={initial.dealValue} className="input" placeholder="450000" /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Owner (team member)" htmlFor="assignedUserId">
            <select id="assignedUserId" name="assignedUserId" defaultValue={initial.assignedUserId} className="input">
              <option value="">Nobody yet</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
            <input type="checkbox" name="isDnd" defaultChecked={initial.isDnd} className="h-4 w-4 accent-brand" /> Do not call (DND)
          </label>
        </div>
        <Field label="Notes" htmlFor="notes"><textarea id="notes" name="notes" defaultValue={initial.notes} rows={4} className="input" placeholder="Owner runs 4 shops, wants GST billing…" /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className="btn">Cancel</Link>
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save lead"}</button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="label block">{label}</label>
      {children}
    </div>
  );
}
