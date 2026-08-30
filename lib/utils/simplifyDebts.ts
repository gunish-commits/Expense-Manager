// lib/utils/simplifyDebts.ts
import { Profile, SettleUpPayment } from '@/types';

/**
 * Greedily resolves debts by matching the largest debtor with the largest creditor.
 * This yields the minimum number of transactions needed to settle a group's balances.
 * 
 * @param balances - Map of userId to net balance (positive = owed money, negative = owes money)
 * @param members - Array of user profiles for name resolution
 */
export function simplifyDebts(
  balances: Record<string, number>,
  members: Profile[]
): SettleUpPayment[] {
  const debtors: { id: string; balance: number }[] = [];
  const creditors: { id: string; balance: number }[] = [];

  const nameMap = new Map<string, string>();
  members.forEach(m => nameMap.set(m.id, m.name));

  // Using 0.01 to ignore micro-rounding errors (floating-point precision)
  const EPSILON = 0.01;

  for (const [userId, bal] of Object.entries(balances)) {
    if (!nameMap.has(userId)) {
      nameMap.set(userId, userId.substring(0, 8)); // fallback to portion of ID
    }

    if (bal < -EPSILON) {
      debtors.push({ id: userId, balance: bal });
    } else if (bal > EPSILON) {
      creditors.push({ id: userId, balance: bal });
    }
  }

  // Sort debtors ascending (most negative first, e.g., -500 before -100)
  debtors.sort((a, b) => a.balance - b.balance);
  // Sort creditors descending (most positive first, e.g., 500 before 100)
  creditors.sort((a, b) => b.balance - a.balance);

  const transactions: SettleUpPayment[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const oweAmount = -debtor.balance;
    const creditAmount = creditor.balance;

    const amountToSettle = Math.min(oweAmount, creditAmount);
    const roundedAmount = Math.round(amountToSettle * 100) / 100;

    if (roundedAmount > 0) {
      transactions.push({
        from: debtor.id,
        from_name: nameMap.get(debtor.id) || debtor.id,
        to: creditor.id,
        to_name: nameMap.get(creditor.id) || creditor.id,
        amount: roundedAmount
      });
    }

    // Adjust balances
    debtor.balance += amountToSettle;
    creditor.balance -= amountToSettle;

    // Advance pointers if fully settled
    if (Math.abs(debtor.balance) < EPSILON) {
      dIdx++;
    }
    if (Math.abs(creditor.balance) < EPSILON) {
      cIdx++;
    }
  }

  return transactions;
}
