import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { toIstLocal } from "@/lib/campaigns";
import { db } from "@/lib/db";
import { FU_STATUSES } from "@/lib/followups";
import { formatPhone } from "@/lib/phone";
import { saveFollowUp } from "../../actions";
import { FollowUpForm } from "../../FollowUpForm";
import { followUpFormOptions } from "../../options";

export const metadata = { title: "Edit follow-up" };

export default async function EditFollowUpPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const f = await db.followUp.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: { lead: { select: { id: true, name: true, phone: true, isDnd: true } } },
  });
  if (!f) notFound();
  const back = sp.back === `/leads/${f.leadId}` ? sp.back : "/follow-ups";
  const isManager = user.role !== "STAFF";
  const header = (
    <header>
      <p className="text-sm text-muted"><Link href="/follow-ups" className="hover:underline">Follow-ups</Link> / Edit</p>
      <h1 className="text-2xl font-extrabold">Edit follow-up</h1>
    </header>
  );

  const blocked = f.status !== "OPEN"
    ? `This follow-up is ${FU_STATUSES[f.status].label.toLowerCase()}. Reopen it to make changes.`
    : f.kind === "AI_CALLBACK" && !isManager ? "Only owners and admins can change an agent callback." : null;
  if (blocked)
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {header}
        <p role="alert" className="rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">{blocked}</p>
        <Link href={back} className="btn">Back</Link>
      </div>
    );

  const opts = await followUpFormOptions(user.workspaceId);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {header}
      <FollowUpForm
        action={saveFollowUp.bind(null, { id: f.id })}
        lead={f.lead.name ?? formatPhone(f.lead.phone)}
        isDnd={f.lead.isDnd}
        canCallback={isManager}
        back={back}
        cancelHref={back}
        {...opts}
        initial={{ kind: f.kind, title: f.title, dueAt: toIstLocal(f.dueAt), agentId: f.agentId ?? "", assignedUserId: f.assignedUserId ?? "" }}
      />
    </div>
  );
}
