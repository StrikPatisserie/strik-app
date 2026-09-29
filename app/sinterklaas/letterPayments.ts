import type { ChocolateLetterOrder } from "./types";

type LetterPayment = Pick<ChocolateLetterOrder, "paid" | "paidAmountCents" | "totalCents">;

export function paidAmountCents(order: LetterPayment) {
  const storedAmount = Number(order.paidAmountCents);
  if (Number.isFinite(storedAmount) && storedAmount > 0) {
    return Math.round(storedAmount);
  }

  return order.paid ? Math.max(0, Math.round(order.totalCents)) : 0;
}

export function openAmountCents(order: LetterPayment) {
  return Math.max(0, Math.round(order.totalCents) - paidAmountCents(order));
}

export function isFullyPaid(order: LetterPayment) {
  return order.totalCents > 0 && openAmountCents(order) === 0 && paidAmountCents(order) > 0;
}
