// app/groups/join/[code]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
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
  const rawCode = resolvedParams.code;

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        let cleanCode = rawCode ? decodeURIComponent(rawCode).trim() : '';
        if (cleanCode.includes('/join/')) {
          cleanCode = cleanCode.split('/join/').pop()?.split('?')[0]?.split('#')[0] || cleanCode;
        } else if (cleanCode.includes('/groups/')) {
          cleanCode = cleanCode.split('/groups/').pop()?.split('?')[0]?.split('#')[0] || cleanCode;
        }
        cleanCode = cleanCode.trim();

        // Check auth
        let user = null;
        if (isGuestMode()) {
          user = getGuestUser();
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            router.push(`/signup?redirectTo=/groups/join/${encodeURIComponent(cleanCode)}`);
            return;
          }
          user = session.user;
        }

        setCurrentUser(user);

        // Fetch group by code or ID
        const grp = await getGroupByInviteCode(cleanCode);
        if (!grp) {
          setErrorMessage(`No group found matching invite code "${cleanCode}". The code may be incorrect or expired.`);
          return;
        }

        setGroup(grp);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error resolving group invitation');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [rawCode, router]);

  const handleAccept = async () => {
    if (!currentUser || !group) return;
    setJoining(true);
    try {
      await joinGroupByCode(group.invite_code || group.id, currentUser.id);
      showToast(`Successfully joined "${group.name}"!`, 'success');
      router.push(`/groups/${group.id}`);
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (err: any) {
      showToast(err.message || 'Failed to join group', 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    let clean = manualCode.trim();
    if (clean.includes('/join/')) {
      clean = clean.split('/join/').pop()?.split('?')[0]?.split('#')[0] || clean;
    } else if (clean.includes('/groups/')) {
      clean = clean.split('/groups/').pop()?.split('?')[0]?.split('#')[0] || clean;
    }
    clean = clean.trim();
    router.push(`/groups/join/${encodeURIComponent(clean)}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 max-w-md mx-auto min-h-[50vh]">
        <Skeleton className="w-16 h-16 rounded-full" />
        <Skeleton className="w-48 h-6 rounded-md" />
        <Skeleton className="w-32 h-4 rounded-md" />
      </div>
    );
  }

  if (errorMessage || !group) {
    return (
      <div className="max-w-md mx-auto p-6 bg-surface border border-border rounded-xl text-center space-y-6 mt-12 text-text-primary shadow-subtle">
        <div className="w-12 h-12 bg-danger-light text-danger rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        
        <div className="space-y-1.5">
          <h1 className="text-[20px] font-semibold text-text-primary leading-[1.2]">
            Invalid or Expired Invite
          </h1>
          <p className="text-[13px] text-text-secondary leading-[1.5]">
            {errorMessage || 'We could not find a group with this invitation link.'}
          </p>
        </div>

        {/* Manual retry input */}
        <form onSubmit={handleManualLookup} className="space-y-3 pt-2">
          <input
            type="text"
            placeholder="Paste 6-character code or link..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-[14px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary text-center uppercase tracking-widest font-mono font-medium"
          />
          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-[14px] font-medium transition-colors shadow-subtle"
          >
            Try Code Again
          </button>
        </form>

        <div className="pt-2 border-t border-border-subtle">
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Groups
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-surface border border-border rounded-xl text-center space-y-6 mt-12 text-text-primary shadow-subtle">
      <div className="w-14 h-14 bg-primary-light text-primary rounded-full flex items-center justify-center mx-auto">
        <Users className="w-7 h-7" />
      </div>

      <div className="space-y-1">
        <h1 className="text-[22px] font-semibold text-text-primary leading-[1.2]">Group Invitation</h1>
        <p className="text-[13px] text-text-secondary leading-[1.4]">You have been invited to split expenses in</p>
      </div>

      <div className="p-4 bg-primary-light/60 rounded-xl border border-primary/20">
        <h2 className="text-[18px] font-semibold text-primary leading-[1.2]">{group.name}</h2>
        {group.invite_code && (
          <p className="text-[12px] text-text-secondary mt-1 font-mono">
            Invite Code: <span className="font-semibold text-text-primary tracking-widest">{group.invite_code}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2.5 pt-2">
        <button
          onClick={handleAccept}
          disabled={joining}
          className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-[15px] font-medium transition-colors active:scale-95 shadow-subtle flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          {joining ? 'Joining Group...' : 'Accept & Join Group'}
        </button>
        <Link
          href="/groups"
          className="w-full bg-surface hover:bg-background border border-border text-text-secondary py-2.5 rounded-lg text-[15px] font-medium transition-colors shadow-subtle block text-center"
        >
          Decline
        </Link>
      </div>
    </div>
  );
}
