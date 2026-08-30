// lib/supabase/borrow.ts
import { supabase, isGuestMode, getGuestUser } from './client';
import { BorrowRecord, Profile } from '@/types';
import { getLocalList, saveLocalList } from './groups';

export async function getBorrowRecords(): Promise<BorrowRecord[]> {
  if (isGuestMode()) {
    const records = getLocalList<any>('local_borrow_records');
    const profiles = getLocalList<Profile>('local_profiles');
    const guest = getGuestUser();

    // Filter to records where guest is either lender or borrower
    const myRecords = records.filter(r => r.lender_id === guest.id || r.borrower_id === guest.id);

    return myRecords.map(rec => ({
      ...rec,
      amount: Number(rec.amount),
      lender_profile: profiles.find(p => p.id === rec.lender_id),
      borrower_profile: profiles.find(p => p.id === rec.borrower_id)
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('borrow_records')
    .select(`
      *,
      lender_profile:profiles!borrow_records_lender_id_fkey (*),
      borrower_profile:profiles!borrow_records_borrower_id_fkey (*)
    `)
    .or(`lender_id.eq.${user.id},borrower_id.eq.${user.id}`)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, amount: Number(r.amount) }));
}

export async function createBorrowRecord(
  lenderId: string,
  borrowerId: string,
  amount: number,
  reason: string,
  date: string
): Promise<BorrowRecord> {
  if (isGuestMode()) {
    const guest = getGuestUser();
    const newRecord: BorrowRecord = {
      id: crypto.randomUUID(),
      lender_id: lenderId,
      borrower_id: borrowerId,
      amount,
      reason,
      date,
      settled: false,
      created_by: guest.id
    };

    const records = getLocalList<any>('local_borrow_records');
    records.unshift(newRecord);
    saveLocalList('local_borrow_records', records);

    const profiles = getLocalList<Profile>('local_profiles');
    
    // Add local notification
    const notifications = getLocalList<any>('local_notifications');
    const lenderName = profiles.find(p => p.id === lenderId)?.name || 'Someone';
    const borrowerName = profiles.find(p => p.id === borrowerId)?.name || 'Someone';
    
    // Notify the other user (if they are a guest profile)
    const otherUserId = lenderId === guest.id ? borrowerId : lenderId;
    notifications.unshift({
      id: crypto.randomUUID(),
      user_id: otherUserId,
      type: 'general',
      message: `${guest.name} logged a borrow record: ${borrowerName} owes ${lenderName} ₹${amount} for "${reason}"`,
      related_group_id: null,
      related_expense_id: null,
      read: false,
      created_at: new Date().toISOString()
    });
    saveLocalList('local_notifications', notifications);

    return {
      ...newRecord,
      lender_profile: profiles.find(p => p.id === lenderId),
      borrower_profile: profiles.find(p => p.id === borrowerId)
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('borrow_records')
    .insert({
      lender_id: lenderId,
      borrower_id: borrowerId,
      amount,
      reason,
      date,
      settled: false,
      created_by: user.id
    })
    .select()
    .single();

  if (error) throw error;

  // Fetch record with profiles
  const { data: fullRecord, error: fetchError } = await supabase
    .from('borrow_records')
    .select(`
      *,
      lender_profile:profiles!borrow_records_lender_id_fkey (*),
      borrower_profile:profiles!borrow_records_borrower_id_fkey (*)
    `)
    .eq('id', data.id)
    .single();

  if (fetchError) throw fetchError;
  return { ...fullRecord, amount: Number(fullRecord.amount) };
}

export async function settleBorrowRecord(recordId: string, settled: boolean): Promise<void> {
  if (isGuestMode()) {
    const records = getLocalList<any>('local_borrow_records');
    const idx = records.findIndex(r => r.id === recordId);
    if (idx !== -1) {
      records[idx].settled = settled;
      saveLocalList('local_borrow_records', records);
    }
    return;
  }

  const { error } = await supabase
    .from('borrow_records')
    .update({ settled })
    .eq('id', recordId);

  if (error) throw error;
}

export async function deleteBorrowRecord(recordId: string): Promise<void> {
  if (isGuestMode()) {
    const records = getLocalList<any>('local_borrow_records');
    saveLocalList('local_borrow_records', records.filter(r => r.id !== recordId));
    return;
  }

  const { error } = await supabase
    .from('borrow_records')
    .delete()
    .eq('id', recordId);

  if (error) throw error;
}

export async function updateBorrowRecord(
  recordId: string,
  lenderId: string,
  borrowerId: string,
  amount: number,
  reason: string,
  date: string
): Promise<BorrowRecord> {
  if (isGuestMode()) {
    const records = getLocalList<any>('local_borrow_records');
    const idx = records.findIndex(r => r.id === recordId);
    if (idx === -1) throw new Error('Record not found');

    records[idx] = {
      ...records[idx],
      lender_id: lenderId,
      borrower_id: borrowerId,
      amount,
      reason,
      date
    };
    saveLocalList('local_borrow_records', records);

    const profiles = getLocalList<Profile>('local_profiles');
    return {
      ...records[idx],
      lender_profile: profiles.find(p => p.id === lenderId),
      borrower_profile: profiles.find(p => p.id === borrowerId)
    };
  }

  const { error } = await supabase
    .from('borrow_records')
    .update({
      lender_id: lenderId,
      borrower_id: borrowerId,
      amount,
      reason,
      date
    })
    .eq('id', recordId);

  if (error) throw error;

  const { data: fullRecord, error: fetchError } = await supabase
    .from('borrow_records')
    .select(`
      *,
      lender_profile:profiles!borrow_records_lender_id_fkey (*),
      borrower_profile:profiles!borrow_records_borrower_id_fkey (*)
    `)
    .eq('id', recordId)
    .single();

  if (fetchError) throw fetchError;
  return { ...fullRecord, amount: Number(fullRecord.amount) };
}
