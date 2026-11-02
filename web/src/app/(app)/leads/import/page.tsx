import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ImportLeads } from "./ImportLeads";

export const metadata = { title: "Import leads" };

export default async function ImportLeadsPage() {
  await requireRole("OWNER", "ADMIN");
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <p className="text-sm text-muted"><Link href="/leads" className="hover:underline">Leads</Link> / Import</p>
        <h1 className="text-2xl font-extrabold">Import leads from a file</h1>
        <p className="text-sm text-muted">We check every number before anything is saved. Nothing is imported until you press Import.</p>
      </header>
      <ImportLeads />
    </div>
  );
}
