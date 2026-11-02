"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { CHANNELS_MAX } from "@/lib/numbers";
import type { AdminState } from "./actions";

const submit = (formAction: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  startTransition(() => formAction(data));
};

export function AddNumberForm({ action }: { action: (p: AdminState, f: FormData) => Promise<AdminState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form className="card space-y-3 p-5" noValidate onSubmit={submit(formAction)}>
      <h2 className="font-bold">Add a number to the pool</h2>
      {state?.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{state.ok}</p>}
      <div className="grid gap-3 md:grid-cols-4">
        <F label="Number" id="e164"><input id="e164" name="e164" className="input" placeholder="+91 80 4567 8901" /></F>
        <F label="Lines" id="channels"><input id="channels" name="channels" type="number" min={1} max={CHANNELS_MAX} defaultValue={1} className="input" /></F>
        <F label="Monthly rent (₹)" id="monthlyRent"><input id="monthlyRent" name="monthlyRent" inputMode="decimal" defaultValue="0" className="input" /></F>
        <F label="SIP trunk id (optional)" id="sipTrunkId"><input id="sipTrunkId" name="sipTrunkId" className="input" placeholder="ST_xxx" /></F>
      </div>
      <div className="flex justify-end"><button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add number"}</button></div>
    </form>
  );
}

export function AssignForm({ action, workspaces }: {
  action: (p: AdminState, f: FormData) => Promise<AdminState>;
  workspaces: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form className="flex flex-wrap items-end justify-end gap-2" noValidate onSubmit={submit(formAction)}>
      <div>
        <span className="label block">Company</span>
        <select name="workspaceId" defaultValue="" className="input w-56" aria-label="Company">
          <option value="">Pick a company</option>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
        </select>
      </div>
      <div>
        <span className="label block">Rent renews on</span>
        <input name="renewsOn" type="date" className="input w-40" aria-label="Rent renews on" />
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? "Assigning…" : "Assign"}</button>
      {state?.error && <p role="alert" className="w-full text-right text-xs text-bad">{state.error}</p>}
    </form>
  );
}

// Take back / Delete, both confirmed first.
export function ConfirmAction({ label, confirm, run }: { label: string; confirm: string; run: () => Promise<{ error?: string }> }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      {asking ? (
        <span className="flex items-center gap-2">
          <span className="text-xs text-bad">{confirm}</span>
          <button type="button" className="btn" disabled={pending} onClick={() => setAsking(false)}>Keep</button>
          <button type="button" className="btn-danger" disabled={pending} onClick={() => start(async () => { const r = await run(); setAsking(false); if (r.error) setError(r.error); })}>
            {pending ? "Working…" : `Yes, ${label.toLowerCase()}`}
          </button>
        </span>
      ) : (
        <button type="button" className="btn-danger" onClick={() => { setError(undefined); setAsking(true); }}>{label}</button>
      )}
      {error && <p role="alert" className="max-w-xs text-right text-xs text-bad">{error}</p>}
    </div>
  );
}

function F({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="label block">{label}</label>
      {children}
    </div>
  );
}
