"use client";

import { startTransition, useActionState, useState } from "react";
import type { NumberAgentsState } from "./actions";

type AgentOption = { id: string; name: string; purpose: "OUTBOUND" | "INBOUND" | "BOTH"; otherNumber: string | null };

const PURPOSE = { OUTBOUND: "calls out", INBOUND: "answers calls", BOTH: "calls out + answers" } as const;

// "Change agents" panel for one number.
export function NumberAgents({ action, agents, selected, numberLabel }: {
  action: (prev: NumberAgentsState, form: FormData) => Promise<NumberAgentsState>;
  agents: AgentOption[];
  selected: string[];
  numberLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);

  if (!open)
    return (
      <div className="flex flex-col items-end gap-1">
        <button type="button" className="btn" onClick={() => setOpen(true)}>Change agents</button>
        {state?.ok && <p role="status" className="text-xs text-ok">Saved.</p>}
      </div>
    );

  return (
    <form
      className="w-full space-y-3 rounded-lg bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          await formAction(data);
        });
      }}
    >
      <p className="text-sm font-semibold">Agents that use {numberLabel}</p>
      {state?.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-ok">Saved.</p>}
      {agents.length === 0 ? (
        <p className="text-sm text-muted">You have no agents yet.</p>
      ) : (
        <ul className="space-y-2">
          {agents.map((a) => (
            <li key={a.id}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="agents" value={a.id} defaultChecked={selected.includes(a.id)} className="mt-0.5 h-4 w-4 accent-brand" />
                <span>
                  <b>{a.name}</b> <span className="text-muted">({PURPOSE[a.purpose]})</span>
                  {a.otherNumber && <span className="block text-xs text-warn">Now on {a.otherNumber}; ticking moves it here.</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">Only one agent can answer incoming calls on a number. Any number of agents can call out from it.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
