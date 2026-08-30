// lib/supabase/notifications.ts
import { supabase, isGuestMode, getGuestUser } from './client';
import { Notification } from '@/types';
import { getLocalList, saveLocalList } from './groups';

export async function getNotifications(): Promise<Notification[]> {
  if (isGuestMode()) {
    const list = getLocalList<any>('local_notifications');
    const guest = getGuestUser();

    return list
      .filter(n => n.user_id === guest.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function markNotificationAsRead(id: string): Promise<void> {
  if (isGuestMode()) {
    const list = getLocalList<any>('local_notifications');
    const idx = list.findIndex(n => n.id === id);
    if (idx !== -1) {
      list[idx].read = true;
      saveLocalList('local_notifications', list);
    }
    return;
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) throw error;
}

export async function markAllNotificationsAsRead(): Promise<void> {
  if (isGuestMode()) {
    const list = getLocalList<any>('local_notifications');
    const guest = getGuestUser();
    const updated = list.map(n => n.user_id === guest.id ? { ...n, read: true } : n);
    saveLocalList('local_notifications', updated);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function createNotification(
  userId: string,
  type: string,
  message: string,
  relatedGroupId: string | null = null,
  relatedExpenseId: string | null = null
): Promise<Notification> {
  if (isGuestMode()) {
    const newNotif: Notification = {
      id: crypto.randomUUID(),
      user_id: userId,
      type,
      message,
      related_group_id: relatedGroupId,
      related_expense_id: relatedExpenseId,
      read: false,
      created_at: new Date().toISOString()
    };

    const list = getLocalList<any>('local_notifications');
    list.unshift(newNotif);
    saveLocalList('local_notifications', list);
    return newNotif;
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      message,
      related_group_id: relatedGroupId,
      related_expense_id: relatedExpenseId,
      read: false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNotification(id: string): Promise<void> {
  if (isGuestMode()) {
    const list = getLocalList<any>('local_notifications');
    const updated = list.filter(n => n.id !== id);
    saveLocalList('local_notifications', updated);
    return;
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
