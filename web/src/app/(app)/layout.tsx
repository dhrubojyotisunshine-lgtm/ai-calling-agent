import { requireUser } from "@/lib/auth";
import { logout } from "../(auth)/actions";
import { Sidebar, type NavGroup } from "@/components/Sidebar";

// `ready: false` items are shown so the client sees the full product, but aren't clickable yet.
const NAV: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { href: "/", label: "Dashboard", ready: true },
      { href: "/call", label: "Live call", ready: false },
      { href: "/campaigns", label: "Campaigns", ready: true },
      { href: "/agents", label: "Agents", ready: true },
      { href: "/services", label: "Services & Products", ready: true },
      { href: "/leads", label: "Leads", ready: true },
      { href: "/follow-ups", label: "Follow-ups", ready: true },
      { href: "/phone-numbers", label: "Phone numbers", ready: true },
      { href: "/calls", label: "Call history", ready: true },
    ],
  },
  { title: "Finance", items: [{ href: "/billing", label: "Billing", ready: true }] },
];

// Only shown to Voxura staff (isPlatformAdmin).
const ADMIN: NavGroup = { title: "Voxura admin", items: [{ href: "/admin/numbers", label: "Number pool", ready: true }] };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar groups={user.isPlatformAdmin ? [...NAV, ADMIN] : NAV} workspace={user.workspace.name} user={user.name} logout={logout} />
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
