"use client";

import { useState, useTransition } from "react";

// Delete button that asks first, then calls a server action returning an optional friendly error.
export function ConfirmDeleteButton({ name, onDelete }: { name: string; onDelete: () => Promise<{ error?: string }> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!confirming)
    return (
      <div className="flex flex-col items-end gap-1">
        <button type="button" className="btn-danger" onClick={() => { setError(undefined); setConfirming(true); }}>Delete</button>
        {error && <p role="alert" className="max-w-xs text-right text-xs text-bad">{error}</p>}
      </div>
    );

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-bad">Delete “{name}”?</span>
        <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={pending}>Keep</button>
        <button
          type="button"
          className="btn-danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await onDelete();
              if (res.error) {
                setError(res.error);
                setConfirming(false);
              }
            })
          }
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-bad">{error}</p>}
    </div>
  );
}
