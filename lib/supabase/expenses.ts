// lib/supabase/expenses.ts
import { supabase, isGuestMode, getGuestUser } from './client';
import { Expense, ExpenseSplit, Settlement, Profile } from '@/types';
import { getLocalList, saveLocalList } from './groups';

export async function getExpenses(groupId: string): Promise<Expense[]> {
  if (isGuestMode()) {
    const expenses = getLocalList<any>('local_expenses').filter(e => e.group_id === groupId);
    const splits = getLocalList<ExpenseSplit>('local_expense_splits');
    const profiles = getLocalList<Profile>('local_profiles');

    // Attach splits and profiles to expenses
    return expenses.map(expense => {
      const expSplits = splits.filter(s => s.expense_id === expense.id).map(s => ({
        ...s,
        profile: profiles.find(p => p.id === s.user_id)
      }));
      const added_by_profile = profiles.find(p => p.id === expense.added_by);

      return {
        ...expense,
        amount: Number(expense.amount),
        splits: expSplits,
        added_by_profile
      };
    });
  }

  // Supabase Fetch
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      added_by_profile:profiles!expenses_added_by_fkey (*),
      splits:expense_splits (
        *,
        profile:profiles (*)
      )
    `)
    .eq('group_id', groupId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map((exp: any) => ({
    ...exp,
    amount: Number(exp.amount),
    splits: (exp.splits || []).map((s: any) => ({ ...s, share_amount: Number(s.share_amount) }))
  }));
}

export interface NewSplitInput {
  user_id: string;
  share_amount: number;
}

export async function createExpense(
  groupId: string,
  amount: number,
  description: string,
  category: string,
  date: string,
  splits: NewSplitInput[],
  receiptUrl: string | null = null,
  payerId: string | null = null
): Promise<Expense> {
  if (isGuestMode()) {
    const guest = getGuestUser();
    const expenseId = crypto.randomUUID();
    const profiles = getLocalList<Profile>('local_profiles');
    const actualPayerId = payerId || guest.id;
    const guestProfile = profiles.find(p => p.id === actualPayerId);

    const newExpense: Expense = {
      id: expenseId,
      group_id: groupId,
      added_by: actualPayerId,
      amount,
      description,
      category,
      date,
      receipt_url: receiptUrl,
      created_at: new Date().toISOString()
    };

    // Save Expense
    const expenses = getLocalList<any>('local_expenses');
    expenses.unshift(newExpense);
    saveLocalList('local_expenses', expenses);

    // Save Splits
    const localSplits = getLocalList<any>('local_expense_splits');
    const splitEntities: ExpenseSplit[] = splits.map((s, idx) => ({
      id: `split-${expenseId}-${idx}`,
      expense_id: expenseId,
      user_id: s.user_id,
      share_amount: s.share_amount,
      settled: false
    }));

    localSplits.push(...splitEntities);
    saveLocalList('local_expense_splits', localSplits);

    // Create Notification message
    const notifications = getLocalList<any>('local_notifications');
    const groupName = getLocalList<any>('local_groups').find(g => g.id === groupId)?.name || 'the group';
    
    // Notify other group members
    const groupMembers = getLocalList<any>('local_group_members').filter(gm => gm.group_id === groupId);
    groupMembers.forEach((member: any) => {
      if (member.user_id !== actualPayerId) {
        notifications.unshift({
          id: crypto.randomUUID(),
          user_id: member.user_id,
          type: 'expense_added',
          message: `${guestProfile?.name || 'Someone'} added ₹${amount} for "${description}" in ${groupName}`,
          related_group_id: groupId,
          related_expense_id: expenseId,
          read: false,
          created_at: new Date().toISOString()
        });
      }
    });
    saveLocalList('local_notifications', notifications);

    return {
      ...newExpense,
      splits: splitEntities.map(se => ({
        ...se,
        profile: profiles.find(p => p.id === se.user_id)
      })),
      added_by_profile: guestProfile
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const actualPayerId = payerId || user.id;

  // 1. Insert Expense
  const { data: newExp, error: expError } = await supabase
    .from('expenses')
    .insert({
      group_id: groupId,
      added_by: actualPayerId,
      amount,
      description,
      category,
      date,
      receipt_url: receiptUrl
    })
    .select()
    .single();

  if (expError) throw expError;

  // 2. Insert Splits
  const splitsToInsert = splits.map(s => ({
    expense_id: newExp.id,
    user_id: s.user_id,
    share_amount: s.share_amount,
    settled: false
  }));

  const { error: splitsError } = await supabase
    .from('expense_splits')
    .insert(splitsToInsert);

  if (splitsError) throw splitsError;

  // Fetch full expense back with joined data
  const { data: fullExp, error: fetchError } = await supabase
    .from('expenses')
    .select(`
      *,
      added_by_profile:profiles!expenses_added_by_fkey (*),
      splits:expense_splits (
        *,
        profile:profiles (*)
      )
    `)
    .eq('id', newExp.id)
    .single();

  if (fetchError) throw fetchError;
  return {
    ...fullExp,
    amount: Number(fullExp.amount),
    splits: (fullExp.splits || []).map((s: any) => ({ ...s, share_amount: Number(s.share_amount) }))
  };
}

export async function updateExpense(
  expenseId: string,
  amount: number,
  description: string,
  category: string,
  date: string,
  splits: NewSplitInput[],
  receiptUrl: string | null = null,
  payerId: string | null = null
): Promise<Expense> {
  if (isGuestMode()) {
    const guest = getGuestUser();
    const expenses = getLocalList<any>('local_expenses');
    const expIdx = expenses.findIndex(e => e.id === expenseId);
    if (expIdx === -1) throw new Error('Expense not found');

    const actualPayerId = payerId || guest.id;

    expenses[expIdx] = {
      ...expenses[expIdx],
      added_by: actualPayerId,
      amount,
      description,
      category,
      date,
      receipt_url: receiptUrl !== undefined ? receiptUrl : expenses[expIdx].receipt_url
    };
    saveLocalList('local_expenses', expenses);

    // Replace splits
    const localSplits = getLocalList<any>('local_expense_splits');
    const filteredSplits = localSplits.filter(s => s.expense_id !== expenseId);
    const splitEntities: ExpenseSplit[] = splits.map((s, idx) => ({
      id: `split-${expenseId}-${idx}`,
      expense_id: expenseId,
      user_id: s.user_id,
      share_amount: s.share_amount,
      settled: false
    }));

    filteredSplits.push(...splitEntities);
    saveLocalList('local_expense_splits', filteredSplits);

    const profiles = getLocalList<Profile>('local_profiles');
    return {
      ...expenses[expIdx],
      splits: splitEntities.map(se => ({
        ...se,
        profile: profiles.find(p => p.id === se.user_id)
      })),
      added_by_profile: profiles.find(p => p.id === actualPayerId)
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const actualPayerId = payerId || user.id;

  // Update Expense
  const { data: updatedExp, error: expError } = await supabase
    .from('expenses')
    .update({
      added_by: actualPayerId,
      amount,
      description,
      category,
      date,
      receipt_url: receiptUrl
    })
    .eq('id', expenseId)
    .select()
    .single();

  if (expError) throw expError;

  // Delete old splits
  const { error: deleteSplitsError } = await supabase
    .from('expense_splits')
    .delete()
    .eq('expense_id', expenseId);

  if (deleteSplitsError) throw deleteSplitsError;

  // Insert new splits
  const splitsToInsert = splits.map(s => ({
    expense_id: expenseId,
    user_id: s.user_id,
    share_amount: s.share_amount,
    settled: false
  }));

  const { error: splitsError } = await supabase
    .from('expense_splits')
    .insert(splitsToInsert);

  if (splitsError) throw splitsError;

  // Fetch full expense back
  const { data: fullExp, error: fetchError } = await supabase
    .from('expenses')
    .select(`
      *,
      added_by_profile:profiles!expenses_added_by_fkey (*),
      splits:expense_splits (
        *,
        profile:profiles (*)
      )
    `)
    .eq('id', expenseId)
    .single();

  if (fetchError) throw fetchError;
  return {
    ...fullExp,
    amount: Number(fullExp.amount),
    splits: (fullExp.splits || []).map((s: any) => ({ ...s, share_amount: Number(s.share_amount) }))
  };
}

export async function deleteExpense(expenseId: string): Promise<void> {
  if (isGuestMode()) {
    const expenses = getLocalList<any>('local_expenses');
    const splits = getLocalList<any>('local_expense_splits');
    
    saveLocalList('local_expenses', expenses.filter(e => e.id !== expenseId));
    saveLocalList('local_expense_splits', splits.filter(s => s.expense_id !== expenseId));
    return;
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId);

  if (error) throw error;
}

export async function getSettlements(groupId: string): Promise<Settlement[]> {
  if (isGuestMode()) {
    const settlements = getLocalList<any>('local_settlements').filter(s => s.group_id === groupId);
    const profiles = getLocalList<Profile>('local_profiles');

    return settlements.map(settle => ({
      ...settle,
      amount: Number(settle.amount),
      from_profile: profiles.find(p => p.id === settle.from_user),
      to_profile: profiles.find(p => p.id === settle.to_user)
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const { data, error } = await supabase
    .from('settlements')
    .select(`
      *,
      from_profile:profiles!settlements_from_user_fkey (*),
      to_profile:profiles!settlements_to_user_fkey (*)
    `)
    .eq('group_id', groupId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map((s: any) => ({ ...s, amount: Number(s.amount) }));
}

export async function createSettlement(
  groupId: string,
  fromUser: string,
  toUser: string,
  amount: number,
  date: string,
  note: string | null = null
): Promise<Settlement> {
  if (isGuestMode()) {
    const newSettlement: Settlement = {
      id: crypto.randomUUID(),
      group_id: groupId,
      from_user: fromUser,
      to_user: toUser,
      amount,
      date,
      note,
    };

    const settlements = getLocalList<any>('local_settlements');
    settlements.unshift(newSettlement);
    saveLocalList('local_settlements', settlements);

    const profiles = getLocalList<Profile>('local_profiles');
    const fromProfile = profiles.find(p => p.id === fromUser);
    const toProfile = profiles.find(p => p.id === toUser);

    // Add local notification
    const notifications = getLocalList<any>('local_notifications');
    const groupName = getLocalList<any>('local_groups').find(g => g.id === groupId)?.name || 'the group';
    
    // Notify users involved
    [fromUser, toUser].forEach(userId => {
      notifications.unshift({
        id: crypto.randomUUID(),
        user_id: userId,
        type: 'settlement_made',
        message: `${fromProfile?.name || 'Someone'} paid ₹${amount} to ${toProfile?.name || 'Someone'} in ${groupName}`,
        related_group_id: groupId,
        related_expense_id: null,
        read: false,
        created_at: new Date().toISOString()
      });
    });
    saveLocalList('local_notifications', notifications);

    return {
      ...newSettlement,
      from_profile: fromProfile,
      to_profile: toProfile
    };
  }

  const { data, error } = await supabase
    .from('settlements')
    .insert({
      group_id: groupId,
      from_user: fromUser,
      to_user: toUser,
      amount,
      date,
      note
    })
    .select()
    .single();

  if (error) throw error;

  // Fetch settlement with joined data
  const { data: fullSettle, error: fetchError } = await supabase
    .from('settlements')
    .select(`
      *,
      from_profile:profiles!settlements_from_user_fkey (*),
      to_profile:profiles!settlements_to_user_fkey (*)
    `)
    .eq('id', data.id)
    .single();

  if (fetchError) throw fetchError;
  return { ...fullSettle, amount: Number(fullSettle.amount) };
}

export async function deleteSettlement(settlementId: string): Promise<void> {
  if (isGuestMode()) {
    const settlements = getLocalList<any>('local_settlements');
    saveLocalList('local_settlements', settlements.filter(s => s.id !== settlementId));
    return;
  }

  const { error } = await supabase
    .from('settlements')
    .delete()
    .eq('id', settlementId);

  if (error) throw error;
}

export async function getBatchExpenses(groupIds: string[]): Promise<Expense[]> {
  if (groupIds.length === 0) return [];
  
  if (isGuestMode()) {
    const expenses = getLocalList<any>('local_expenses').filter(e => groupIds.includes(e.group_id));
    const splits = getLocalList<ExpenseSplit>('local_expense_splits');
    const profiles = getLocalList<Profile>('local_profiles');

    return expenses.map(expense => {
      const expSplits = splits.filter(s => s.expense_id === expense.id).map(s => ({
        ...s,
        profile: profiles.find(p => p.id === s.user_id)
      }));
      const added_by_profile = profiles.find(p => p.id === expense.added_by);

      return {
        ...expense,
        amount: Number(expense.amount),
        splits: expSplits,
        added_by_profile
      };
    });
  }

  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      added_by_profile:profiles!expenses_added_by_fkey (*),
      splits:expense_splits (
        *,
        profile:profiles (*)
      )
    `)
    .in('group_id', groupIds)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map((exp: any) => ({
    ...exp,
    amount: Number(exp.amount),
    splits: (exp.splits || []).map((s: any) => ({ ...s, share_amount: Number(s.share_amount) }))
  }));
}

export async function getBatchSettlements(groupIds: string[]): Promise<Settlement[]> {
  if (groupIds.length === 0) return [];
  
  if (isGuestMode()) {
    const settlements = getLocalList<any>('local_settlements').filter(s => groupIds.includes(s.group_id));
    const profiles = getLocalList<Profile>('local_profiles');

    return settlements.map(settle => ({
      ...settle,
      amount: Number(settle.amount),
      from_profile: profiles.find(p => p.id === settle.from_user),
      to_profile: profiles.find(p => p.id === settle.to_user)
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const { data, error } = await supabase
    .from('settlements')
    .select(`
      *,
      from_profile:profiles!settlements_from_user_fkey (*),
      to_profile:profiles!settlements_to_user_fkey (*)
    `)
    .in('group_id', groupIds)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map((s: any) => ({ ...s, amount: Number(s.amount) }));
}
