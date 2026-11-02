import "server-only";
import { Prisma, type TxType } from "@prisma/client";
import { db } from "./db";

// All wallet changes go through here: the balance update and its ledger row are written in one transaction,
// using an atomic increment so concurrent calls/top-ups can't overwrite each other.

export const TOPUP_MIN = 10;
export const TOPUP_MAX = 100000;

export async function creditWallet(workspaceId: string, rupees: number, type: Extract<TxType, "TOPUP" | "ADJUSTMENT">, note: string) {
  if (!(rupees > 0)) throw new Error("Credit amount must be positive.");
  const amount = new Prisma.Decimal(rupees).toDecimalPlaces(2);
  return db.$transaction(async (tx) => {
    const ws = await tx.workspace.update({ where: { id: workspaceId }, data: { walletBalance: { increment: amount } } });
    return tx.walletTransaction.create({
      data: { workspaceId, type, amount, balanceAfter: ws.walletBalance, note },
    });
  });
}

// Charges a finished call once. A second call with the same callId does nothing (unique callId on the ledger).
export async function chargeCall(workspaceId: string, callId: string, rupees: number, note: string) {
  const amount = new Prisma.Decimal(rupees).toDecimalPlaces(2);
  if (amount.lte(0)) return null;
  try {
    return await db.$transaction(async (tx) => {
      const tx1 = await tx.walletTransaction.create({
        data: { workspaceId, type: "CALL_CHARGE", amount: amount.neg(), balanceAfter: 0, callId, note },
      });
      const ws = await tx.workspace.update({ where: { id: workspaceId }, data: { walletBalance: { decrement: amount } } });
      return tx.walletTransaction.update({ where: { id: tx1.id }, data: { balanceAfter: ws.walletBalance } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null; // already charged
    throw e;
  }
}
