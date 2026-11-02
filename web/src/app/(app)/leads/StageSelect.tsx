"use client";

import { useState, useTransition } from "react";
import { STAGES } from "@/lib/leads";
import { setLeadStage } from "./actions";

// Small "move to stage" picker used on board cards and the lead page.
export function StageSelect({ leadId, stage, label }: { leadId: string; stage: string; label: string }) {
  const [value, setValue] = useState(stage);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div>
      <select
        aria-label={label}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setError(undefined);
          start(async () => {
            const res = await setLeadStage(leadId, next);
            if (res.error) { setValue(prev); setError(res.error); }
          });
        }}
        className="w-full rounded-md border border-line bg-white px-2 py-1 text-xs"
      >
        {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {error && <p role="alert" className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}
