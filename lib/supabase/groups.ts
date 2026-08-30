// lib/supabase/groups.ts
import { supabase, isGuestMode, getGuestUser } from './client';
import { Group, Profile, GroupMember } from '@/types';

// Seed local storage with initial data if running in Guest Mode
export function seedLocalData() {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('local_data_seeded') === 'true') return;

  const guest = getGuestUser();
  const aliceId = 'alice-uuid-1111-1111';
  const bobId = 'bob-uuid-2222-2222';
  const charlieId = 'charlie-uuid-3333-3333';

  // Seed Profiles
  const profiles: Profile[] = [
    { id: guest.id, name: guest.name, avatar_url: guest.avatar_url, created_at: new Date().toISOString() },
    { id: aliceId, name: 'Alice Smith', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice', created_at: new Date().toISOString() },
    { id: bobId, name: 'Bob Vance', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob', created_at: new Date().toISOString() },
    { id: charlieId, name: 'Charlie Green', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie', created_at: new Date().toISOString() }
  ];
  localStorage.setItem('local_profiles', JSON.stringify(profiles));

  // Seed Groups
  const group1Id = 'group-uuid-goa-trip';
  const group2Id = 'group-uuid-flatmates';
  const groups: Group[] = [
    { id: group1Id, name: 'Goa Trip', created_by: guest.id, created_at: new Date().toISOString(), status: 'active', invite_code: 'GOA123' },
    { id: group2Id, name: 'Flat 204 Expenses', created_by: guest.id, created_at: new Date().toISOString(), status: 'active', invite_code: 'FLA456' }
  ];
  localStorage.setItem('local_groups', JSON.stringify(groups));

  // Seed Group Members
  const members: GroupMember[] = [
    // Group 1 members
    { group_id: group1Id, user_id: guest.id, joined_at: new Date().toISOString() },
    { group_id: group1Id, user_id: aliceId, joined_at: new Date().toISOString() },
    { group_id: group1Id, user_id: bobId, joined_at: new Date().toISOString() },
    { group_id: group1Id, user_id: charlieId, joined_at: new Date().toISOString() },

    // Group 2 members
    { group_id: group2Id, user_id: guest.id, joined_at: new Date().toISOString() },
    { group_id: group2Id, user_id: aliceId, joined_at: new Date().toISOString() }
  ];
  localStorage.setItem('local_group_members', JSON.stringify(members));

  // Seed Expenses
  const exp1Id = 'exp-uuid-1';
  const exp2Id = 'exp-uuid-2';
  const exp3Id = 'exp-uuid-3';
  const expenses = [
    { id: exp1Id, group_id: group1Id, added_by: guest.id, amount: 2400, description: 'Seafront Villa Booking', category: 'Lodging', date: '2026-08-25', receipt_url: null, created_at: new Date().toISOString() },
    { id: exp2Id, group_id: group1Id, added_by: aliceId, amount: 1200, description: 'Dinner & Drinks at Curlies', category: 'Food', date: '2026-08-26', receipt_url: null, created_at: new Date().toISOString() },
    { id: exp3Id, group_id: group2Id, added_by: guest.id, amount: 3000, description: 'Monthly WiFi Broadband', category: 'Utilities', date: '2026-08-01', receipt_url: null, created_at: new Date().toISOString() }
  ];
  localStorage.setItem('local_expenses', JSON.stringify(expenses));

  // Seed Expense Splits
  const splits = [
    // seafront villa split (2400 / 4 members = 600 each)
    { id: 'split-1-1', expense_id: exp1Id, user_id: guest.id, share_amount: 600, settled: false },
    { id: 'split-1-2', expense_id: exp1Id, user_id: aliceId, share_amount: 600, settled: false },
    { id: 'split-1-3', expense_id: exp1Id, user_id: bobId, share_amount: 600, settled: false },
    { id: 'split-1-4', expense_id: exp1Id, user_id: charlieId, share_amount: 600, settled: false },

    // dinner split (1200 / 3 members = 400 each, charlie opted out)
    { id: 'split-2-1', expense_id: exp2Id, user_id: guest.id, share_amount: 400, settled: false },
    { id: 'split-2-2', expense_id: exp2Id, user_id: aliceId, share_amount: 400, settled: false },
    { id: 'split-2-3', expense_id: exp2Id, user_id: bobId, share_amount: 400, settled: false },

    // wifi split (3000 / 2 members = 1500 each)
    { id: 'split-3-1', expense_id: exp3Id, user_id: guest.id, share_amount: 1500, settled: false },
    { id: 'split-3-2', expense_id: exp3Id, user_id: aliceId, share_amount: 1500, settled: false }
  ];
  localStorage.setItem('local_expense_splits', JSON.stringify(splits));

  // Seed Settlements
  const settlements = [
    { id: 'settle-1', group_id: group1Id, from_user: bobId, to_user: guest.id, amount: 200, date: '2026-08-28', note: 'Partial payment for villa' }
  ];
  localStorage.setItem('local_settlements', JSON.stringify(settlements));

  // Seed Personal Expenses
  const personal = [
    { id: 'pers-1', user_id: guest.id, amount: 150, category: 'Coffee', date: '2026-08-29', note: 'Starbucks latte', receipt_url: null },
    { id: 'pers-2', user_id: guest.id, amount: 450, category: 'Transport', date: '2026-08-28', note: 'Uber ride to station', receipt_url: null }
  ];
  localStorage.setItem('local_personal_expenses', JSON.stringify(personal));

  // Seed Borrow Records
  const borrow = [
    { id: 'borrow-1', lender_id: guest.id, borrower_id: aliceId, amount: 500, reason: 'Snacks at airport', date: '2026-08-25', settled: false, created_by: guest.id },
    { id: 'borrow-2', lender_id: bobId, borrower_id: guest.id, amount: 300, reason: 'Cab share cash', date: '2026-08-26', settled: false, created_by: bobId }
  ];
  localStorage.setItem('local_borrow_records', JSON.stringify(borrow));

  // Seed Recurring Expenses
  const recurring = [
    { id: 'recur-1', group_id: group2Id, description: 'Broadband Bill Renewal', amount: 3000, category: 'Utilities', split_between: [guest.id, aliceId], frequency: 'monthly', next_due_date: '2026-09-01', created_by: guest.id }
  ];
  localStorage.setItem('local_recurring_expenses', JSON.stringify(recurring));

  // Seed Notifications
  const notifications = [
    { id: 'notif-1', user_id: guest.id, type: 'expense_added', message: 'Alice Smith added ₹1200 for Dinner & Drinks at Curlies in Goa Trip 🏖️', related_group_id: group1Id, related_expense_id: exp2Id, read: false, created_at: new Date().toISOString() },
    { id: 'notif-2', user_id: guest.id, type: 'group_invited', message: 'You created the group Flat 204 Expenses 🏠', related_group_id: group2Id, related_expense_id: null, read: true, created_at: new Date().toISOString() }
  ];
  localStorage.setItem('local_notifications', JSON.stringify(notifications));

  localStorage.setItem('local_data_seeded', 'true');
}

// Service helper to read from local storage list
export function getLocalList<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const val = localStorage.getItem(key);
  return val ? JSON.parse(val) : [];
}

// Service helper to save to local storage list
export function saveLocalList<T>(key: string, list: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(list));
}

export async function getGroups(status?: 'active' | 'settled'): Promise<Group[]> {
  if (isGuestMode()) {
    seedLocalData();
    const guest = getGuestUser();
    const members = getLocalList<GroupMember>('local_group_members');
    const groups = getLocalList<Group>('local_groups');
    
    // Find all group ids where current guest user is a member
    const myGroupIds = members
      .filter(m => m.user_id === guest.id)
      .map(m => m.group_id);
    
    let filtered = groups.filter(g => myGroupIds.includes(g.id));
    if (status) {
      filtered = filtered.filter(g => g.status === status);
    }
    return filtered;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Select groups where the user is in group_members table
  const { data, error } = await supabase
    .from('group_members')
    .select('groups (*)')
    .eq('user_id', user.id);

  if (error) throw error;
  
  let groupsList = (data || []).map((d: any) => d.groups).filter(Boolean);
  if (status) {
    groupsList = groupsList.filter((g: any) => g.status === status);
  }
  return groupsList;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  if (isGuestMode()) {
    seedLocalData();
    const groups = getLocalList<Group>('local_groups');
    return groups.find(g => g.id === groupId) || null;
  }

  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) return null;
  return data;
}

export async function getGroupMembers(groupId: string): Promise<Profile[]> {
  if (isGuestMode()) {
    seedLocalData();
    const gm = getLocalList<GroupMember>('local_group_members');
    const profiles = getLocalList<Profile>('local_profiles');
    const groupMemberships = gm.filter(m => m.group_id === groupId);
    
    return groupMemberships.map(m => {
      const p = profiles.find(prof => prof.id === m.user_id);
      return {
        id: m.user_id,
        name: m.display_name || p?.name || 'Unknown',
        avatar_url: p?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.user_id}`,
        created_at: m.joined_at,
        is_placeholder: m.is_placeholder || false
      };
    });
  }

  const { data, error } = await supabase
    .from('group_members')
    .select(`
      user_id,
      joined_at,
      is_placeholder,
      display_name,
      profile:profiles(*)
    `)
    .eq('group_id', groupId);

  if (error) throw error;
  
  return (data || []).map((gm: any) => ({
    id: gm.user_id,
    name: gm.display_name || gm.profile?.name || 'Unknown User',
    avatar_url: gm.profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${gm.user_id}`,
    created_at: gm.joined_at,
    is_placeholder: gm.is_placeholder || false
  }));
}

export async function createGroup(name: string, invitedEmailsOrNames: string[] = []): Promise<Group> {
  if (isGuestMode()) {
    seedLocalData();
    const guest = getGuestUser();
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name,
      created_by: guest.id,
      created_at: new Date().toISOString(),
      status: 'active',
      invite_code: Math.random().toString(36).substring(2, 8).toUpperCase()
    };

    // Save group
    const groups = getLocalList<Group>('local_groups');
    groups.push(newGroup);
    saveLocalList('local_groups', groups);

    // Save members: guest + invited
    const members = getLocalList<GroupMember>('local_group_members');
    members.push({ group_id: newGroup.id, user_id: guest.id, joined_at: new Date().toISOString() });

    const profiles = getLocalList<Profile>('local_profiles');

    for (const nameOrEmail of invitedEmailsOrNames) {
      if (!nameOrEmail.trim()) continue;
      
      // Check if user profile already exists with this name/email
      let existingProfile = profiles.find(
        p => p.name.toLowerCase() === nameOrEmail.trim().toLowerCase()
      );
      
      if (!existingProfile) {
        // Create virtual user profile for the guest sandbox
        existingProfile = {
          id: crypto.randomUUID(),
          name: nameOrEmail.trim().split('@')[0], // strip email if domain included
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${nameOrEmail}`,
          created_at: new Date().toISOString()
        };
        profiles.push(existingProfile);
      }
      
      members.push({ group_id: newGroup.id, user_id: existingProfile.id, joined_at: new Date().toISOString() });
    }

    saveLocalList('local_profiles', profiles);
    saveLocalList('local_group_members', members);

    // Create a local notification
    const notifications = getLocalList<any>('local_notifications');
    notifications.unshift({
      id: crypto.randomUUID(),
      user_id: guest.id,
      type: 'group_invited',
      message: `You created the group "${name}"`,
      related_group_id: newGroup.id,
      related_expense_id: null,
      read: false,
      created_at: new Date().toISOString()
    });
    saveLocalList('local_notifications', notifications);

    return newGroup;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Insert group
  const { data: newGroup, error: groupError } = await supabase
    .from('groups')
    .insert({ name, created_by: user.id })
    .select()
    .single();

  if (groupError) throw groupError;

  // Add creator as member
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: newGroup.id, user_id: user.id });

  if (memberError) throw memberError;

  // Invite others - typically in Supabase, we either invite by email, which sends email or auto-joins
  // Here, we'll try to find matching user profiles by name/email or generate invite codes.
  // For simplicity, we search if user exists in profiles, otherwise we can create mock links.
  for (const contact of invitedEmailsOrNames) {
    if (!contact.trim()) continue;
    
    // We attempt to find a profile with this name or email
    // For production splitwise, we can lookup profiles or trigger a Resend email with invite link.
    // If profiles exist:
    const { data: searchProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('name', contact) // Simple lookup. In real system, we'd lookup auth.users by email.
      .limit(1);

    if (searchProfile && searchProfile.length > 0) {
      await supabase
        .from('group_members')
        .insert({ group_id: newGroup.id, user_id: searchProfile[0].id });
    }
  }

  return newGroup;
}

export async function addMemberToGroup(groupId: string, memberId: string): Promise<void> {
  // 1. Fetch real user's profile name to match against placeholders
  let realName = '';
  if (isGuestMode()) {
    const profiles = getLocalList<Profile>('local_profiles');
    const p = profiles.find(prof => prof.id === memberId);
    realName = p?.name || '';
  } else {
    const { data: p } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', memberId)
      .single();
    realName = p?.name || '';
  }

  // 2. Check if a placeholder matches this name case-insensitively
  const members = await getGroupMembers(groupId);
  const matchedPlaceholder = members.find(
    m => m.is_placeholder && m.name.trim().toLowerCase() === realName.trim().toLowerCase()
  );

  if (matchedPlaceholder) {
    await mergePlaceholderMember(groupId, matchedPlaceholder.id, memberId);
    return;
  }

  // 3. Regular insert if no match
  if (isGuestMode()) {
    const gm = getLocalList<GroupMember>('local_group_members');
    const alreadyMember = gm.some(m => m.group_id === groupId && m.user_id === memberId);
    if (!alreadyMember) {
      gm.push({ group_id: groupId, user_id: memberId, joined_at: new Date().toISOString() });
      saveLocalList('local_group_members', gm);
    }
    return;
  }

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: memberId });

  if (error) throw error;
}

export async function getGroupByInviteCode(code: string): Promise<Group | null> {
  const cleanCode = code.trim().toUpperCase();
  if (isGuestMode()) {
    const groups = getLocalList<Group>('local_groups');
    return groups.find(g => g.invite_code?.toUpperCase() === cleanCode) || null;
  }

  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', cleanCode)
    .single();

  if (error) return null;
  return data;
}

export async function joinGroupByCode(code: string, userId: string): Promise<void> {
  const grp = await getGroupByInviteCode(code);
  if (!grp) throw new Error('Group not found');

  // 1. Fetch real user's profile name to match against placeholders
  let realName = '';
  if (isGuestMode()) {
    const profiles = getLocalList<Profile>('local_profiles');
    const p = profiles.find(prof => prof.id === userId);
    realName = p?.name || '';
  } else {
    const { data: p } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    realName = p?.name || '';
  }

  // 2. Check if a placeholder matches this name case-insensitively
  const members = await getGroupMembers(grp.id);
  const matchedPlaceholder = members.find(
    m => m.is_placeholder && m.name.trim().toLowerCase() === realName.trim().toLowerCase()
  );

  if (matchedPlaceholder) {
    await mergePlaceholderMember(grp.id, matchedPlaceholder.id, userId);
    return;
  }

  // 3. Regular insert if no match
  if (isGuestMode()) {
    const gm = getLocalList<GroupMember>('local_group_members');
    const alreadyMember = gm.some(m => m.group_id === grp.id && m.user_id === userId);
    if (!alreadyMember) {
      gm.push({ group_id: grp.id, user_id: userId, joined_at: new Date().toISOString() });
      saveLocalList('local_group_members', gm);
    }
    return;
  }

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: grp.id, user_id: userId });

  if (error) throw error;
}

export async function updateGroupStatus(groupId: string, status: 'active' | 'settled'): Promise<void> {
  if (isGuestMode()) {
    const groups = getLocalList<Group>('local_groups');
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx !== -1) {
      groups[idx].status = status;
      saveLocalList('local_groups', groups);
    }
    return;
  }

  const { error } = await supabase
    .from('groups')
    .update({ status })
    .eq('id', groupId);

  if (error) throw error;
}

export async function createGroupInviteNotification(
  groupId: string,
  inviteeUserId: string,
  message: string
): Promise<void> {
  if (isGuestMode()) {
    const notifications = getLocalList<any>('local_notifications');
    notifications.unshift({
      id: crypto.randomUUID(),
      user_id: inviteeUserId,
      type: 'group_invite',
      message,
      related_group_id: groupId,
      related_expense_id: null,
      read: false,
      created_at: new Date().toISOString()
    });
    saveLocalList('local_notifications', notifications);
    return;
  }

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: inviteeUserId,
      type: 'group_invite',
      message,
      related_group_id: groupId
    });

  if (error) throw error;
}

export async function createPlaceholderMember(groupId: string, name: string): Promise<Profile> {
  const placeholderId = crypto.randomUUID();
  const profileData: Profile = {
    id: placeholderId,
    name: name.trim(),
    avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${name.trim()}`,
    created_at: new Date().toISOString(),
    is_placeholder: true,
    display_name: name.trim()
  };

  if (isGuestMode()) {
    const profiles = getLocalList<Profile>('local_profiles');
    profiles.push(profileData);
    saveLocalList('local_profiles', profiles);

    const gm = getLocalList<GroupMember>('local_group_members');
    gm.push({
      group_id: groupId,
      user_id: placeholderId,
      joined_at: new Date().toISOString(),
      is_placeholder: true,
      display_name: name.trim()
    });
    saveLocalList('local_group_members', gm);

    return profileData;
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .insert({
      id: placeholderId,
      name: name.trim(),
      avatar_url: profileData.avatar_url
    });

  if (profileErr) throw profileErr;

  const { error: memberErr } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: placeholderId,
      is_placeholder: true,
      display_name: name.trim()
    });

  if (memberErr) throw memberErr;

  return profileData;
}

export async function mergePlaceholderMember(
  groupId: string,
  placeholderUserId: string,
  realUserId: string
): Promise<void> {
  if (isGuestMode()) {
    const gm = getLocalList<GroupMember>('local_group_members');
    const gmIdx = gm.findIndex(m => m.group_id === groupId && m.user_id === placeholderUserId);
    if (gmIdx !== -1) {
      gm[gmIdx].user_id = realUserId;
      gm[gmIdx].is_placeholder = false;
      gm[gmIdx].display_name = null;
      saveLocalList('local_group_members', gm);
    }

    const expenses = getLocalList<any>('local_expenses');
    expenses.forEach(e => {
      if (e.group_id === groupId && e.added_by === placeholderUserId) {
        e.added_by = realUserId;
      }
    });
    saveLocalList('local_expenses', expenses);

    const splits = getLocalList<any>('local_expense_splits');
    splits.forEach(s => {
      const exp = expenses.find((e: any) => e.id === s.expense_id);
      if (exp && exp.group_id === groupId && s.user_id === placeholderUserId) {
        s.user_id = realUserId;
      }
    });
    saveLocalList('local_expense_splits', splits);

    const settlements = getLocalList<any>('local_settlements');
    settlements.forEach(s => {
      if (s.group_id === groupId) {
        if (s.from_user === placeholderUserId) s.from_user = realUserId;
        if (s.to_user === placeholderUserId) s.to_user = realUserId;
      }
    });
    saveLocalList('local_settlements', settlements);

    const profiles = getLocalList<Profile>('local_profiles');
    const updatedProfiles = profiles.filter(p => p.id !== placeholderUserId);
    saveLocalList('local_profiles', updatedProfiles);

    return;
  }

  const { data: exps } = await supabase
    .from('expenses')
    .select('id')
    .eq('group_id', groupId);

  const expenseIds = (exps || []).map(e => e.id);

  if (expenseIds.length > 0) {
    const { error: splitErr } = await supabase
      .from('expense_splits')
      .update({ user_id: realUserId })
      .eq('user_id', placeholderUserId)
      .in('expense_id', expenseIds);

    if (splitErr) throw splitErr;
  }

  const { error: expErr } = await supabase
    .from('expenses')
    .update({ added_by: realUserId })
    .eq('group_id', groupId)
    .eq('added_by', placeholderUserId);

  if (expErr) throw expErr;

  const { error: setFromErr } = await supabase
    .from('settlements')
    .update({ from_user: realUserId })
    .eq('group_id', groupId)
    .eq('from_user', placeholderUserId);

  if (setFromErr) throw setFromErr;

  const { error: setToErr } = await supabase
    .from('settlements')
    .update({ to_user: realUserId })
    .eq('group_id', groupId)
    .eq('to_user', placeholderUserId);

  if (setToErr) throw setToErr;

  const { error: memberErr } = await supabase
    .from('group_members')
    .update({
      user_id: realUserId,
      is_placeholder: false,
      display_name: null
    })
    .eq('group_id', groupId)
    .eq('user_id', placeholderUserId);

  if (memberErr) throw memberErr;

  const { error: profErr } = await supabase
    .from('profiles')
    .delete()
    .eq('id', placeholderUserId);

  if (profErr) throw profErr;
}
