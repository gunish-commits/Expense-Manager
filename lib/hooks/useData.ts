// lib/hooks/useData.ts
'use client';

import useSWR, { SWRConfiguration } from 'swr';
import { isGuestMode, getGuestUser, supabase } from '@/lib/supabase/client';
import { getGroups, getGroup, getGroupMembers } from '@/lib/supabase/groups';
import { getExpenses, getSettlements } from '@/lib/supabase/expenses';
import { getBorrowRecords } from '@/lib/supabase/borrow';
import { getPersonalExpenses } from '@/lib/supabase/personalExpenses';
import { getNotifications } from '@/lib/supabase/notifications';
import { Group, Profile, Expense, Settlement, BorrowRecord, PersonalExpense, Notification } from '@/types';

// Default configuration with short stale time & revalidation on focus / network reconnect
const swrConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 4000,
  keepPreviousData: true,
};

// 1. Current User Hook
export function useCurrentUser() {
  return useSWR(
    'current-user-session',
    async () => {
      if (isGuestMode()) {
        return getGuestUser();
      }
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user || null;
    },
    swrConfig
  );
}

// 2. Groups Hook
export function useGroups(status?: 'active' | 'settled') {
  return useSWR<Group[]>(
    ['groups-list', status || 'all'],
    () => getGroups(status),
    swrConfig
  );
}

// 3. Single Group Hook
export function useGroupDetail(groupId: string | undefined) {
  return useSWR<Group | null>(
    groupId ? ['group-detail', groupId] : null,
    () => getGroup(groupId!),
    swrConfig
  );
}

// 4. Group Members Hook
export function useGroupMembers(groupId: string | undefined) {
  return useSWR<Profile[]>(
    groupId ? ['group-members', groupId] : null,
    () => getGroupMembers(groupId!),
    swrConfig
  );
}

// 5. Group Expenses Hook
export function useGroupExpenses(groupId: string | undefined) {
  return useSWR<Expense[]>(
    groupId ? ['group-expenses', groupId] : null,
    () => getExpenses(groupId!),
    swrConfig
  );
}

// 6. Group Settlements Hook
export function useGroupSettlements(groupId: string | undefined) {
  return useSWR<Settlement[]>(
    groupId ? ['group-settlements', groupId] : null,
    () => getSettlements(groupId!),
    swrConfig
  );
}

// 7. Borrow Records (Dues) Hook
export function useBorrowRecords() {
  return useSWR<BorrowRecord[]>(
    'borrow-records-list',
    () => getBorrowRecords(),
    swrConfig
  );
}

// 8. Personal Expenses Hook
export function usePersonalExpenses() {
  return useSWR<PersonalExpense[]>(
    'personal-expenses-list',
    () => getPersonalExpenses(),
    swrConfig
  );
}

// 9. Notifications Hook
export function useNotifications() {
  return useSWR<Notification[]>(
    'notifications-list',
    () => getNotifications(),
    { ...swrConfig, refreshInterval: 15000 }
  );
}
