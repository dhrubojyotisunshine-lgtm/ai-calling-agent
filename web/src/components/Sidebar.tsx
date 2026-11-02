"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; ready: boolean };
export type NavGroup = { title: string; items: NavItem[] };

export function Sidebar({ groups, workspace, user, logout }: {
  groups: NavGroup[];
  workspace: string;
  user: string;
  logout: () => Promise<void>;
}) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-brand text-[#e6defc]">
      <div className="flex items-center gap-2 px-5 py-5 text-lg font-extrabold text-white">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-brand">V</span> Voxura
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3" aria-label="Main">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#a999e0]">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.href}>
                  {it.ready ? (
                    <Link
                      href={it.href}
                      aria-current={isActive(it.href) ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm ${isActive(it.href) ? "bg-white/15 font-bold text-white" : "hover:bg-white/10"}`}
                    >
                      {it.label}
                    </Link>
                  ) : (
                    <span className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#a999e0]" title="Coming in a later build step">
                      {it.label}
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase">Soon</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4 text-xs">
        <p className="truncate font-bold text-white">{workspace}</p>
        <p className="truncate text-[#a999e0]">{user}</p>
        <form action={logout} className="mt-2">
          <button className="text-[#cfc4f6] underline-offset-2 hover:underline">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
