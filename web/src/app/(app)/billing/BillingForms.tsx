"use client";

import { startTransition, useActionState, useState } from "react";
import { addFunds, setLowBalanceAlert, type BillingFormState } from "./actions";

const QUICK = [100, 250, 500, 1000];

function useForm(action: (prev: BillingFormState, form: FormData) => Promise<BillingFormState>) {
  const [state, run, pending] = useActionState(action, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  return { state, pending, onSubmit };
}

function Message({ state }: { state: BillingFormState }) {
  if (state?.error) return <p role="alert" className="text-sm text-bad">{state.error}</p>;
  if (state?.ok) return <p role="status" className="text-sm text-ok">{state.ok}</p>;
  return null;
}

export function AddFundsForm() {
  const { state, pending, onSubmit } = useForm(addFunds);
  const [amount, setAmount] = useState("");
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => setAmount(String(q))}
            className={`rounded-lg border px-4 py-2 text-sm font-bold tabular-nums ${amount === String(q) ? "border-brand bg-brand-soft text-brand" : "border-line bg-white hover:bg-paper"}`}>
            ₹{q.toLocaleString("en-IN")}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="amount" className="label block">Amount (₹)</label>
          <input id="amount" name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" className="input w-40" />
        </div>
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Adding…" : "Add funds"}</button>
      </div>
      <p className="text-xs text-muted">Whole rupees only, ₹10 to ₹1,00,000.</p>
      <Message state={state} />
    </form>
  );
}

export function LowBalanceForm({ current }: { current: number }) {
  const { state, pending, onSubmit } = useForm(setLowBalanceAlert);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="lowBalanceAt" className="label block">Warn me below (₹)</label>
          <input id="lowBalanceAt" name="lowBalanceAt" inputMode="numeric" defaultValue={current} className="input w-32" />
        </div>
        <button type="submit" disabled={pending} className="btn">{pending ? "Saving…" : "Save"}</button>
      </div>
      <p className="text-xs text-muted">Set 0 to turn the warning off.</p>
      <Message state={state} />
    </form>
  );
}
