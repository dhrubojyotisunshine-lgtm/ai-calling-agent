"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import type { ServiceFormState } from "./actions";

export type ServiceValues = {
  type: "SERVICE" | "PRODUCT"; name: string; description: string; priceText: string; mayQuotePrice: boolean;
  whenToOffer: string; nextAction: string; trialDays: string; signupUrl: string; isActive: boolean; agentIds: string[];
};

const NEXT_STEPS = ["Book a demo", "Send a proposal", "Send sign-up link", "Transfer to sales team", "Schedule a callback"];

export function ServiceForm({ action, initial, agents, canEdit }: {
  action: (prev: ServiceFormState, form: FormData) => Promise<ServiceFormState>;
  initial: ServiceValues;
  agents: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [type, setType] = useState(initial.type);
  const [quote, setQuote] = useState(initial.mayQuotePrice);

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

      <fieldset disabled={!canEdit} className="card space-y-5 p-6">
        <div className="space-y-1.5">
          <p className="label">Type</p>
          <div className="inline-flex gap-1 rounded-lg bg-paper p-1" role="radiogroup">
            {(["SERVICE", "PRODUCT"] as const).map((t) => (
              <label key={t} className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold ${type === t ? "bg-white shadow-sm" : "text-muted"}`}>
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                {t === "SERVICE" ? "Service" : "Product"}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">{type === "SERVICE" ? "Work you do for the customer, e.g. app development or ERP setup." : "Something ready-made the customer signs up for, e.g. a software subscription."}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" htmlFor="name">
            <input id="name" name="name" defaultValue={initial.name} maxLength={120} className="input" placeholder={type === "SERVICE" ? "ERP for retail" : "Brightlane Billing App"} />
          </Field>
          <Field label="Price the caller hears" htmlFor="priceText" hint="Write it the way it should be said, e.g. “From ₹4.5 lakh” or “₹799 per user per month”.">
            <input id="priceText" name="priceText" defaultValue={initial.priceText} maxLength={120} className="input" placeholder="From ₹4.5 lakh" />
          </Field>
        </div>

        <Field label="Short description (what the agent says)" htmlFor="description">
          <textarea id="description" name="description" defaultValue={initial.description} rows={4} className="input" placeholder="GST billing and stock app for small shops, works on mobile and desktop…" />
        </Field>

        <div className="space-y-1.5">
          <p className="label">May the agent say the price?</p>
          <div className="inline-flex gap-1 rounded-lg bg-paper p-1" role="radiogroup">
            {[["yes", "Yes"], ["no", "No, say we'll send a quote"]].map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold ${(v === "yes") === quote ? "bg-white shadow-sm" : "text-muted"}`}>
                <input type="radio" name="mayQuotePrice" value={v} checked={(v === "yes") === quote} onChange={() => setQuote(v === "yes")} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="When to offer it" htmlFor="whenToOffer" hint="Helps the agent decide who it suits.">
            <input id="whenToOffer" name="whenToOffer" defaultValue={initial.whenToOffer} maxLength={255} className="input" placeholder="Shops with 3 or more branches" />
          </Field>
          <Field label="Next step when the caller is interested" htmlFor="nextAction">
            <input id="nextAction" name="nextAction" list="next-steps" defaultValue={initial.nextAction} maxLength={255} className="input" placeholder="Book a demo" />
            <datalist id="next-steps">{NEXT_STEPS.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
        </div>

        {type === "PRODUCT" && (
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <Field label="Free trial (days)" htmlFor="trialDays">
              <input id="trialDays" name="trialDays" type="number" min={0} max={365} defaultValue={initial.trialDays} className="input" placeholder="14" />
            </Field>
            <Field label="Sign-up link" htmlFor="signupUrl" hint="Sent to interested callers once messaging is set up.">
              <input id="signupUrl" name="signupUrl" type="url" defaultValue={initial.signupUrl} maxLength={500} className="input" placeholder="https://brightlane.in/signup" />
            </Field>
          </div>
        )}

        <div className="space-y-2">
          <p className="label">Agents that may offer it</p>
          {agents.length === 0 ? (
            <p className="text-sm text-muted">No agents yet. You can link this later from the agent&apos;s “What to sell” step.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {agents.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-paper">
                  <input type="checkbox" name="agents" value={a.id} defaultChecked={initial.agentIds.includes(a.id)} className="accent-brand" /> {a.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="h-4 w-4 accent-brand" /> Active (agents may offer it)
        </label>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Link href="/services" className="btn">Cancel</Link>
        {canEdit && <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save"}</button>}
      </div>
    </form>
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
