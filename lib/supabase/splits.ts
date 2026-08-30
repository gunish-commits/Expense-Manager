// lib/supabase/splits.ts
import { supabase, isGuestMode } from './client';
import { ExpenseSplit } from '@/types';
import { getLocalList, saveLocalList } from './groups';

export async function markSplitSettled(splitId: string, settled: boolean): Promise<void> {
  if (isGuestMode()) {
    const splits = getLocalList<any>('local_expense_splits');
    const idx = splits.findIndex(s => s.id === splitId);
    if (idx !== -1) {
      splits[idx].settled = settled;
      saveLocalList('local_expense_splits', splits);
    }
    return;
  }

  const { error } = await supabase
    .from('expense_splits')
    .update({ settled })
    .eq('id', splitId);

  if (error) throw error;
}

export async function markAllGroupSplitsSettled(groupId: string): Promise<void> {
  if (isGuestMode()) {
    const expenses = getLocalList<any>('local_expenses').filter(e => e.group_id === groupId);
    const expenseIds = expenses.map(e => e.id);
    const splits = getLocalList<any>('local_expense_splits');
    
    const updated = splits.map(s => {
      if (expenseIds.includes(s.expense_id)) {
        return { ...s, settled: true };
      }
      return s;
    });
    
    saveLocalList('local_expense_splits', updated);
    return;
  }

  // Find all expenses in group, then update their splits to settled = true
  const { data: expenses, error: expError } = await supabase
    .from('expenses')
    .select('id')
    .eq('group_id', groupId);

  if (expError) throw expError;
  if (!expenses || expenses.length === 0) return;

  const expenseIds = expenses.map(e => e.id);

  const { error: splitsError } = await supabase
    .from('expense_splits')
    .update({ settled: true })
    .in('expense_id', expenseIds);

  if (splitsError) throw splitsError;
}
