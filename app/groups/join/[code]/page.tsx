// app/groups/join/[code]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getGroupByInviteCode, joinGroupByCode } from '@/lib/supabase/groups';
import { isGuestMode, getGuestUser, supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/ui/Skeleton';
import { Group } from '@/types';

export default function JoinGroupPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const { showToast } = useToast();
  
  // Resolve params promise
  const resolvedParams = use(params);
  const code = resolvedParams.code;

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Check auth
        let user = null;
        if (isGuestMode()) {
          user = getGuestUser();
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            // Redirect to signup preserving the redirect
            router.push(`/signup?redirectTo=/groups/join/${code}`);
            return;
          }
          user = session.user;
        }

        setCurrentUser(user);

        // Fetch group by code
        const grp = await getGroupByInviteCode(code);
        if (!grp) {
          showToast('Invalid invite code', 'error');
          router.push('/groups');
          return;
        }

        setGroup(grp);
      } catch (err: any) {
        showToast(err.message || 'Error resolving invitation', 'error');
        router.push('/groups');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [code, router]);

  const handleAccept = async () => {
    if (!currentUser || !group) return;
    try {
      await joinGroupByCode(code, currentUser.id);
      showToast(`Successfully joined group "${group.name}"!`, 'success');
      router.push(`/groups/${group.id}`);
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (err: any) {
      showToast(err.message || 'Failed to join group', 'error');
    }
  };

  const handleDecline = () => {
    showToast('Invitation declined', 'info');
    router.push('/groups');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 max-w-md mx-auto">
        <Skeleton className="w-16 h-16 rounded-full" />
        <Skeleton className="w-48 h-6 rounded-md" />
        <Skeleton className="w-32 h-4 rounded-md" />
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-slate-900 border border-[#E6E4DF] dark:border-[#2D2A26] rounded-3xl text-center space-y-6 mt-12 text-[#26241F] dark:text-slate-100 shadow-sm">
      <span className="text-4xl">✉️</span>
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Group Invitation</h2>
        <p className="text-xs text-slate-400">You have been invited to join</p>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-[#E6E4DF] dark:border-[#2D2A26]">
        <h3 className="text-lg font-black text-[#1F6E5C] dark:text-[#2B9B82]">{group.name}</h3>
      </div>

      <div className="flex flex-col gap-2.5 pt-2">
        <button
          onClick={handleAccept}
          className="w-full bg-[#1F6E5C] hover:bg-[#2B9B82] text-white py-3 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
        >
          Accept Invitation
        </button>
        <button
          onClick={handleDecline}
          className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 py-3 rounded-xl text-xs font-bold transition-all"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
