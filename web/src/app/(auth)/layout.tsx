import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

const POINTS = ["Human-like conversations", "Calls your leads in bulk", "Answers incoming calls", "Follows up automatically"];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await currentUser()) redirect("/");
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-gradient-to-b from-brand to-[#160f30] p-12 text-white md:flex">
        <div className="flex items-center gap-2 text-lg font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-brand">V</span> Voxura
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Put a voice agent<br />on every phone call.</h1>
          <ul className="max-w-sm space-y-2">
            {POINTS.map((p) => (
              <li key={p} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold">{p}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">Prepaid wallet · pay per minute</p>
      </aside>
      <main className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
