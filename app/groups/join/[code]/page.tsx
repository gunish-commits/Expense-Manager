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
    <div className="max-w-md mx-auto p-6 bg-surface border border-border rounded-xl text-center space-y-6 mt-12 text-text-primary shadow-subtle">
      <span className="text-4xl">✉️</span>
      <div className="space-y-1">
        <h1 className="text-[22px] font-semibold text-text-primary leading-[1.2]">Group Invitation</h1>
        <p className="text-[13px] text-text-secondary leading-[1.4]">You have been invited to join</p>
      </div>

      <div className="p-4 bg-primary-light rounded-xl border border-primary/20">
        <h2 className="text-[17px] font-semibold text-primary leading-[1.2]">{group.name}</h2>
        <p className="text-[13px] text-text-secondary mt-1 font-normal">Invite Code: {group.invite_code}</p>
      </div>

      <div className="flex flex-col gap-2.5 pt-2">
        <button
          onClick={handleAccept}
          className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-[15px] font-medium transition-colors active:scale-95 shadow-subtle"
        >
          Accept & Join Group
        </button>
        <button
          onClick={handleDecline}
          className="w-full bg-surface hover:bg-background border border-border text-text-secondary py-2.5 rounded-lg text-[15px] font-medium transition-colors shadow-subtle"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
