// lib/supabase/recurring.ts
import { supabase, isGuestMode, getGuestUser } from './client';
import { RecurringExpense } from '@/types';
import { getLocalList, saveLocalList } from './groups';
import { createExpense } from './expenses';

export async function getRecurringExpenses(groupId?: string): Promise<RecurringExpense[]> {
  if (isGuestMode()) {
    const list = getLocalList<any>('local_recurring_expenses');
    const guest = getGuestUser();
    
    // Get group ids guest is member of
    const members = getLocalList<any>('local_group_members');
    const myGroupIds = members.filter(m => m.user_id === guest.id).map(m => m.group_id);

    return list
      .filter(r => {
        if (groupId) return r.group_id === groupId;
        return myGroupIds.includes(r.group_id);
      })
      .map(r => ({ ...r, amount: Number(r.amount) }));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase.from('recurring_expenses').select('*');
  
  if (groupId) {
    query = query.eq('group_id', groupId);
  } else {
    // Get groups user belongs to
    const { data: memberGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);
    
    const groupIds = (memberGroups || []).map(mg => mg.group_id);
    query = query.in('group_id', groupIds);
  }

  const { data, error } = await query.order('next_due_date', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, amount: Number(r.amount) }));
}

export async function createRecurringExpense(
  groupId: string,
  description: string,
  amount: number,
  category: string,
  splitBetween: string[],
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
  nextDueDate: string
): Promise<RecurringExpense> {
  if (isGuestMode()) {
    const guest = getGuestUser();
    const newRecur: RecurringExpense = {
      id: crypto.randomUUID(),
      group_id: groupId,
      description,
      amount,
      category,
      split_between: splitBetween,
      frequency,
      next_due_date: nextDueDate,
      created_by: guest.id
    };

    const list = getLocalList<any>('local_recurring_expenses');
    list.push(newRecur);
    saveLocalList('local_recurring_expenses', list);
    return newRecur;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('recurring_expenses')
    .insert({
      group_id: groupId,
      description,
      amount,
      category,
      split_between: splitBetween,
      frequency,
      next_due_date: nextDueDate,
      created_by: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, amount: Number(data.amount) };
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  if (isGuestMode()) {
    const list = getLocalList<any>('local_recurring_expenses');
    saveLocalList('local_recurring_expenses', list.filter(r => r.id !== id));
    return;
  }

  const { error } = await supabase
    .from('recurring_expenses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Computes next date based on frequency
function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(dateStr);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

// Auto-process due recurring items and spawn actual expenses
export async function processDueRecurringExpenses(): Promise<number> {
  const todayStr = new Date().toISOString().split('T')[0];
  let processedCount = 0;

  if (isGuestMode()) {
    const recurringList = getLocalList<RecurringExpense>('local_recurring_expenses');
    let updatedList = [...recurringList];

    for (let i = 0; i < updatedList.length; i++) {
      const recur = updatedList[i];
      if (recur.next_due_date <= todayStr) {
        // Calculate splits
        const splitCount = recur.split_between.length;
        const share = Math.round((recur.amount / splitCount) * 100) / 100;
        const splits = recur.split_between.map(userId => ({
          user_id: userId,
          share_amount: share
        }));

        // 1. Create a live group expense
        await createExpense(
          recur.group_id,
          recur.amount,
          `[Recurring] ${recur.description}`,
          recur.category,
          recur.next_due_date,
          splits
        );

        // 2. Advance due date
        updatedList[i] = {
          ...recur,
          next_due_date: advanceDate(recur.next_due_date, recur.frequency)
        };
        processedCount++;
      }
    }

    if (processedCount > 0) {
      saveLocalList('local_recurring_expenses', updatedList);
    }
    return processedCount;
  }

  // Supabase implementation: fetch due items
  const { data: dueItems, error: fetchError } = await supabase
    .from('recurring_expenses')
    .select('*')
    .lte('next_due_date', todayStr);

  if (fetchError) throw fetchError;
  if (!dueItems || dueItems.length === 0) return 0;

  for (const recur of dueItems) {
    const splitCount = recur.split_between.length;
    const share = Math.round((Number(recur.amount) / splitCount) * 100) / 100;
    const splits = recur.split_between.map((userId: string) => ({
      user_id: userId,
      share_amount: share
    }));

    // Create group expense
    await createExpense(
      recur.group_id,
      Number(recur.amount),
      `[Recurring] ${recur.description}`,
      recur.category,
      recur.next_due_date,
      splits
    );

    // Advance due date
    const nextDate = advanceDate(recur.next_due_date, recur.frequency);
    await supabase
      .from('recurring_expenses')
      .update({ next_due_date: nextDate })
      .eq('id', recur.id);
    
    processedCount++;
  }

  return processedCount;
}
