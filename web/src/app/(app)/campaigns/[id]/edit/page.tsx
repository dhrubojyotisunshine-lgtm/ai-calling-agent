import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { CAMPAIGN_STATUSES, CAN_EDIT, toIstLocal } from "@/lib/campaigns";
import { updateCampaign } from "../../actions";
import { CampaignForm } from "../../CampaignForm";
import { campaignFormOptions } from "../../options";

export const metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("OWNER", "ADMIN");
  const c = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!c) notFound();
  const crumbs = (
    <p className="text-sm text-muted">
      <Link href="/campaigns" className="hover:underline">Campaigns</Link> / <Link href={`/campaigns/${c.id}`} className="hover:underline">{c.name}</Link> / Edit
    </p>
  );

  if (!CAN_EDIT.includes(c.status))
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <header>{crumbs}<h1 className="text-2xl font-extrabold">Edit campaign</h1></header>
        <p role="alert" className="rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
          This campaign is {CAMPAIGN_STATUSES[c.status].label.toLowerCase()}, so it can&apos;t be changed.{" "}
          {c.status === "RUNNING" && "Pause it first, then edit."}
        </p>
      </div>
    );

  const { agents, team, balance } = await campaignFormOptions(user.workspaceId);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        {crumbs}
        <h1 className="text-2xl font-extrabold">Edit campaign</h1>
        <p className="text-sm text-muted">The people to call are fixed once a campaign is created. To call a different group, create a new campaign.</p>
      </header>
      <CampaignForm
        mode="edit"
        action={updateCampaign.bind(null, c.id)}
        cancelHref={`/campaigns/${c.id}`}
        agents={agents}
        team={team}
        balance={balance}
        initial={{
          name: c.name, agentId: c.agentId, startAt: toIstLocal(c.startAt), callWindowFrom: c.callWindowFrom, callWindowTo: c.callWindowTo,
          maxConcurrent: String(c.maxConcurrent), retryCount: String(c.retryCount), retryGapMinutes: String(c.retryGapMinutes), skipDnd: c.skipDnd,
        }}
      />
    </div>
  );
}
