import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { saveLead } from "../actions";
import { LeadForm } from "../LeadForm";
import { leadFormOptions } from "../options";

export const metadata = { title: "Add lead" };

export default async function NewLeadPage() {
  const user = await requireUser();
  const opts = await leadFormOptions(user.workspaceId);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <p className="text-sm text-muted"><Link href="/leads" className="hover:underline">Leads</Link> / New</p>
        <h1 className="text-2xl font-extrabold">Add a lead</h1>
      </header>
      <LeadForm
        action={saveLead.bind(null, null)}
        cancelHref="/leads"
        {...opts}
        initial={{ name: "", phone: "", city: "", stage: "NEW", interestedItemId: "", dealValue: "", assignedUserId: "", isDnd: false, notes: "" }}
      />
    </div>
  );
}
