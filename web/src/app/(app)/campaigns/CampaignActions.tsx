"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CAN_CANCEL, CAN_DELETE, CAN_EDIT, CAN_PAUSE, CAN_START, type CampaignStatusKey } from "@/lib/campaigns";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { cancelCampaign, deleteCampaignAndReturn, pauseCampaign, startCampaign } from "./actions";

// Start / pause / cancel / edit / delete buttons for one campaign. Each shows a friendly error if it can't be done.
export function CampaignActions({ id, name, status }: { id: string; name: string; status: CampaignStatusKey }) {
  const [error, setError] = useState<string>();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: (id: string) => Promise<{ error?: string }>) =>
    start(async () => {
      setError(undefined);
      const res = await fn(id);
      if (res.error) setError(res.error);
      setConfirmCancel(false);
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {CAN_EDIT.includes(status) && <Link href={`/campaigns/${id}/edit`} className="btn">Edit</Link>}
        {CAN_PAUSE.includes(status) && <button type="button" className="btn" disabled={pending} onClick={() => run(pauseCampaign)}>Pause</button>}
        {CAN_START.includes(status) && (
          <button type="button" className="btn-go" disabled={pending} onClick={() => run(startCampaign)}>{status === "PAUSED" ? "Resume" : "Start"}</button>
        )}
        {CAN_CANCEL.includes(status) && !confirmCancel && (
          <button type="button" className="btn-danger" disabled={pending} onClick={() => setConfirmCancel(true)}>Cancel campaign</button>
        )}
        {confirmCancel && (
          <span className="flex items-center gap-2">
            <span className="text-xs text-bad">Stop calling and cancel?</span>
            <button type="button" className="btn" disabled={pending} onClick={() => setConfirmCancel(false)}>Keep</button>
            <button type="button" className="btn-danger" disabled={pending} onClick={() => run(cancelCampaign)}>{pending ? "Cancelling…" : "Yes, cancel"}</button>
          </span>
        )}
        {CAN_DELETE.includes(status) && <ConfirmDeleteButton name={name} onDelete={() => deleteCampaignAndReturn(id)} />}
      </div>
      {error && <p role="alert" className="max-w-md text-right text-sm text-bad">{error}</p>}
    </div>
  );
}
