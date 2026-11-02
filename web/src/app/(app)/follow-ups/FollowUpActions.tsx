"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setFollowUpStatus } from "./actions";

// Done / Cancel / Reopen / Edit for one follow-up, with a friendly error if it can't be done.
export function FollowUpActions({ id, status, back }: { id: string; status: "OPEN" | "DONE" | "CANCELLED"; back: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (to: "OPEN" | "DONE" | "CANCELLED") =>
    start(async () => {
      setError(undefined);
      const res = await setFollowUpStatus(id, to);
      if (res.error) setError(res.error);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {status === "OPEN" ? (
          <>
            <button type="button" className="btn-go" disabled={pending} onClick={() => run("DONE")}>Done</button>
            <Link href={`/follow-ups/${id}/edit?back=${encodeURIComponent(back)}`} className="btn">Edit</Link>
            <button type="button" className="btn" disabled={pending} onClick={() => run("CANCELLED")}>Cancel</button>
          </>
        ) : (
          <button type="button" className="btn" disabled={pending} onClick={() => run("OPEN")}>Reopen</button>
        )}
      </div>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-bad">{error}</p>}
    </div>
  );
}
