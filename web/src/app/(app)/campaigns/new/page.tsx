import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { createCampaign } from "../actions";
import { CampaignForm } from "../CampaignForm";
import { campaignFormOptions } from "../options";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ addedSince?: string }> }) {
  const user = await requireRole("OWNER", "ADMIN");
  const sp = await searchParams;
  const { window, ...opts } = await campaignFormOptions(user.workspaceId);
  const since = sp.addedSince ? new Date(sp.addedSince) : null;
  const addedSince = since && !Number.isNaN(since.getTime()) ? { iso: since.toISOString(), label: dateTime(since) } : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <p className="text-sm text-muted"><Link href="/campaigns" className="hover:underline">Campaigns</Link> / New</p>
        <h1 className="text-2xl font-extrabold">New campaign</h1>
        <p className="text-sm text-muted">
          Pick an agent and the leads to call. To call people from a new file, <Link href="/leads/import" className="font-semibold text-brand hover:underline">import it first</Link>, then come back from the import result.
        </p>
      </header>
      <CampaignForm
        mode="create"
        action={createCampaign}
        cancelHref="/campaigns"
        addedSince={addedSince}
        {...opts}
        initial={{
          name: "", agentId: opts.agents.length === 1 ? opts.agents[0].id : "", startAt: "", callWindowFrom: window.from, callWindowTo: window.to,
          maxConcurrent: "1", retryCount: "2", retryGapMinutes: "180", skipDnd: true,
        }}
      />
    </div>
  );
}
