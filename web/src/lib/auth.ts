import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";

// The signed-in user and their workspace. Every page and action scopes its queries with `workspaceId` from here.
export const currentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { workspace: true },
  });
  // Reject if the user was deactivated or moved to another workspace after the cookie was issued.
  if (!user || !user.isActive || user.workspaceId !== session.workspaceId) return null;
  return user;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

// Voxura staff who manage the shared number pool. Not a workspace role.
export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/?denied=1");
  return user;
}

export async function requireRole(...roles: Array<"OWNER" | "ADMIN" | "STAFF">) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/?denied=1");
  return user;
}
