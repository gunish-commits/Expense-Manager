// lib/supabase/personalExpenses.ts
import { supabase, isGuestMode, getGuestUser } from './client';
import { PersonalExpense } from '@/types';
import { getLocalList, saveLocalList } from './groups';

export async function getPersonalExpenses(): Promise<PersonalExpense[]> {
  if (isGuestMode()) {
    const expenses = getLocalList<any>('local_personal_expenses');
    const guest = getGuestUser();

    // Filter to guest's personal expenses
    return expenses
      .filter(e => e.user_id === guest.id)
      .map(e => ({ ...e, amount: Number(e.amount) }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('personal_expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map((e: any) => ({ ...e, amount: Number(e.amount) }));
}

export async function createPersonalExpense(
  amount: number,
  category: string,
  date: string,
  note: string | null = null,
  receiptUrl: string | null = null
): Promise<PersonalExpense> {
  if (isGuestMode()) {
    const guest = getGuestUser();
    const newExpense: PersonalExpense = {
      id: crypto.randomUUID(),
      user_id: guest.id,
      amount,
      category,
      date,
      note,
      receipt_url: receiptUrl
    };

    const expenses = getLocalList<any>('local_personal_expenses');
    expenses.unshift(newExpense);
    saveLocalList('local_personal_expenses', expenses);

    return newExpense;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('personal_expenses')
    .insert({
      user_id: user.id,
      amount,
      category,
      date,
      note,
      receipt_url: receiptUrl
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, amount: Number(data.amount) };
}

export async function deletePersonalExpense(expenseId: string): Promise<void> {
  if (isGuestMode()) {
    const expenses = getLocalList<any>('local_personal_expenses');
    saveLocalList('local_personal_expenses', expenses.filter(e => e.id !== expenseId));
    return;
  }

  const { error } = await supabase
    .from('personal_expenses')
    .delete()
    .eq('id', expenseId);

  if (error) throw error;
}

export async function updatePersonalExpense(
  expenseId: string,
  amount: number,
  category: string,
  date: string,
  note: string | null = null,
  receiptUrl: string | null = null
): Promise<PersonalExpense> {
  if (isGuestMode()) {
    const expenses = getLocalList<any>('local_personal_expenses');
    const idx = expenses.findIndex(e => e.id === expenseId);
    if (idx === -1) throw new Error('Expense not found');

    expenses[idx] = {
      ...expenses[idx],
      amount,
      category,
      date,
      note,
      receipt_url: receiptUrl !== undefined ? receiptUrl : expenses[idx].receipt_url
    };
    saveLocalList('local_personal_expenses', expenses);
    return expenses[idx];
  }

  const { data, error } = await supabase
    .from('personal_expenses')
    .update({
      amount,
      category,
      date,
      note,
      receipt_url: receiptUrl
    })
    .eq('id', expenseId)
    .select()
    .single();

  if (error) throw error;
  return { ...data, amount: Number(data.amount) };
}
