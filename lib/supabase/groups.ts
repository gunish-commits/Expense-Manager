// lib/supabase/groups.ts
import { supabase, isGuestMode, getGuestUser } from './client';
import { Group, Profile, GroupMember } from '@/types';

// Seed local storage with initial data if running in Guest Mode
export function seedLocalData() {
  if (typeof window === 'undefined') return;

  // Automatically purge legacy mock data (Goa trip, Alice, Bob, etc.)
  if (localStorage.getItem('local_clean_v4') !== 'true') {
    localStorage.removeItem('local_groups');
    localStorage.removeItem('local_group_members');
    localStorage.removeItem('local_expenses');
    localStorage.removeItem('local_expense_splits');
    localStorage.removeItem('local_settlements');
    localStorage.removeItem('local_personal_expenses');
    localStorage.removeItem('local_borrow_records');
    localStorage.removeItem('local_recurring_expenses');
    localStorage.removeItem('local_notifications');
    localStorage.setItem('local_clean_v4', 'true');
  }

  const guest = getGuestUser();

  // Initialize clean profiles list
  if (!localStorage.getItem('local_profiles')) {
    const profiles: Profile[] = [
      { id: guest.id, name: guest.name, avatar_url: guest.avatar_url, created_at: new Date().toISOString() }
    ];
    localStorage.setItem('local_profiles', JSON.stringify(profiles));
  }

  // Initialize empty collections
  if (!localStorage.getItem('local_groups')) localStorage.setItem('local_groups', JSON.stringify([]));
  if (!localStorage.getItem('local_group_members')) localStorage.setItem('local_group_members', JSON.stringify([]));
  if (!localStorage.getItem('local_expenses')) localStorage.setItem('local_expenses', JSON.stringify([]));
  if (!localStorage.getItem('local_expense_splits')) localStorage.setItem('local_expense_splits', JSON.stringify([]));
  if (!localStorage.getItem('local_settlements')) localStorage.setItem('local_settlements', JSON.stringify([]));
  if (!localStorage.getItem('local_personal_expenses')) localStorage.setItem('local_personal_expenses', JSON.stringify([]));
  if (!localStorage.getItem('local_borrow_records')) localStorage.setItem('local_borrow_records', JSON.stringify([]));
  if (!localStorage.getItem('local_recurring_expenses')) localStorage.setItem('local_recurring_expenses', JSON.stringify([]));
  if (!localStorage.getItem('local_notifications')) localStorage.setItem('local_notifications', JSON.stringify([]));

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

export async function getBatchGroupMembers(groupIds: string[]): Promise<Record<string, Profile[]>> {
  const result: Record<string, Profile[]> = {};
  groupIds.forEach(gid => { result[gid] = []; });
  if (groupIds.length === 0) return result;

  if (isGuestMode()) {
    seedLocalData();
    const gm = getLocalList<GroupMember>('local_group_members');
    const profiles = getLocalList<Profile>('local_profiles');
    
    gm.filter(m => groupIds.includes(m.group_id)).forEach(m => {
      const p = profiles.find(prof => prof.id === m.user_id);
      if (result[m.group_id]) {
        result[m.group_id].push({
          id: m.user_id,
          name: m.display_name || p?.name || 'Unknown',
          avatar_url: p?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.user_id}`,
          created_at: m.joined_at,
          is_placeholder: m.is_placeholder || false
        });
      }
    });
    return result;
  }

  const { data, error } = await supabase
    .from('group_members')
    .select(`
      group_id,
      user_id,
      joined_at,
      is_placeholder,
      display_name,
      profile:profiles(*)
    `)
    .in('group_id', groupIds);

  if (error) throw error;

  (data || []).forEach((gm: any) => {
    if (result[gm.group_id]) {
      result[gm.group_id].push({
        id: gm.user_id,
        name: gm.display_name || gm.profile?.name || 'Unknown User',
        avatar_url: gm.profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${gm.user_id}`,
        created_at: gm.joined_at,
        is_placeholder: gm.is_placeholder || false
      });
    }
  });

  return result;
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
  if (!code) return null;
  const cleanCode = decodeURIComponent(code).trim().toUpperCase();
  
  if (isGuestMode()) {
    const groups = getLocalList<Group>('local_groups');
    return groups.find(g => g.invite_code?.toUpperCase() === cleanCode) || null;
  }

  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .ilike('invite_code', cleanCode)
    .maybeSingle();

  if (error) {
    console.error('Error fetching group by invite code:', error);
    return null;
  }
  return data;
}

export async function joinGroupByCode(code: string, userId: string): Promise<void> {
  const grp = await getGroupByInviteCode(code);
  if (!grp) throw new Error('Group not found or invalid invite code');

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
      .maybeSingle();
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

  // Check if already a member in Cloud Supabase
  const alreadyMember = members.some(m => m.id === userId);
  if (alreadyMember) {
    return; // Already joined, proceed to view group
  }

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: grp.id, user_id: userId });

  if (error && !error.message?.includes('duplicate key')) {
    throw error;
  }
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
