// app/groups/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Users, Calendar, ArrowRight, UserPlus, Sparkles } from 'lucide-react';
import { isGuestMode, supabase } from '@/lib/supabase/client';
import { createGroup } from '@/lib/supabase/groups';
import { useGroups } from '@/lib/hooks/useData';
import { Group } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { SkeletonList, Skeleton } from '@/components/ui/Skeleton';

export default function Groups() {
  const router = useRouter();
  const { showToast } = useToast();

  const { data: cachedGroups, isLoading, mutate: mutateGroups } = useGroups();
  const [activeTab, setActiveTab] = useState<'active' | 'settled'>('active');
  const groups = cachedGroups || [];
  const loading = isLoading && !cachedGroups;

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Join group modal state
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinModalLoading, setJoinModalLoading] = useState(false);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) {
      showToast('Please enter an invite code', 'error');
      return;
    }
    router.push(`/groups/join/${joinCodeInput.trim().toUpperCase()}`);
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('action') === 'create-group') {
      setIsModalOpen(true);
    }
  }, [router]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      showToast('Group name is required', 'error');
      return;
    }

    setModalLoading(true);
    try {
      // Split members input by commas or newlines
      const emailsOrNames = membersInput
        .split(/[,\n]/)
        .map(item => item.trim())
        .filter(item => item.length > 0);

      const created = await createGroup(newGroupName.trim(), emailsOrNames);
      showToast(`Group "${created.name}" created successfully!`, 'success');
      
      // Reset inputs & refresh
      setNewGroupName('');
      setMembersInput('');
      setIsModalOpen(false);
      
      // Redirect to newly created group details
      router.push(`/groups/${created.id}`);
    } catch (e: any) {
      showToast(e.message || 'Failed to create group', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1.5 w-1/3">
            <Skeleton className="w-10 h-2.5 rounded" />
            <Skeleton className="w-24 h-5 rounded-md" />
          </div>
          <Skeleton className="w-24 h-8 rounded-xl" />
        </div>
        <SkeletonList count={4} />
      </div>
    );
  }

  const filteredGroups = groups.filter(g => activeTab === 'settled' ? g.status === 'settled' : (g.status === 'active' || !g.status));

  return (
    <div className="space-y-6 pb-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="text-left">
          <h1 className="text-[22px] font-semibold text-text-primary leading-[1.2]">
            My Groups
          </h1>
          <p className="text-[13px] font-normal text-text-secondary leading-[1.4] mt-0.5">
            Shared expense splitting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsJoinModalOpen(true)}
            className="px-3.5 py-2 bg-surface border border-border text-text-primary hover:bg-background rounded-lg text-[15px] font-medium transition-colors flex items-center gap-1.5 shadow-subtle active:scale-95"
          >
            <UserPlus className="w-4 h-4 text-primary" /> Join with Code
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-lg text-[15px] font-medium transition-colors flex items-center gap-1.5 shadow-subtle active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Group
          </button>
        </div>
      </div>

      {/* Active vs History Tab header */}
      <div className="flex border-b border-border-subtle text-left">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2.5 text-[15px] transition-colors border-b-2 ${
            activeTab === 'active' 
              ? 'border-primary text-primary font-medium' 
              : 'border-transparent text-text-secondary hover:text-text-primary font-normal'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setActiveTab('settled')}
          className={`px-4 py-2.5 text-[15px] transition-colors border-b-2 ${
            activeTab === 'settled' 
              ? 'border-primary text-primary font-medium' 
              : 'border-transparent text-text-secondary hover:text-text-primary font-normal'
          }`}
        >
          History (Settled)
        </button>
      </div>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center shadow-subtle">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-text-secondary mb-3">
            <Users className="w-8 h-8 text-text-secondary" />
          </div>
          <h3 className="font-semibold text-text-primary text-[17px] mb-1.5 leading-[1.2]">
            {activeTab === 'active' ? 'No active groups yet' : 'No settled groups in history'}
          </h3>
          <p className="text-[13px] font-normal text-text-secondary max-w-xs mb-5 leading-[1.4]">
            {activeTab === 'active' 
              ? 'Groups allow you to split trips, rent, bills, or dinners easily with roommates and friends.'
              : 'When a group’s net balances all reach zero, they will appear here in your archive history.'}
          </p>
          {activeTab === 'active' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-[15px] font-medium transition-colors active:scale-95 shadow-subtle"
            >
              Start your first group
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGroups.map(grp => (
            <Link 
              key={grp.id}
              href={`/groups/${grp.id}`}
              className="group flex items-center justify-between p-4 bg-surface border border-border rounded-xl transition-all hover:border-primary shadow-subtle"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center text-primary transition-colors group-hover:bg-primary group-hover:text-white flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-text-primary text-[15px] group-hover:text-primary transition-colors leading-[1.4]">
                    {grp.name}
                  </h3>
                  <span className="text-[13px] font-normal text-text-secondary flex items-center gap-1 mt-0.5 leading-[1.4]">
                    <Calendar className="w-3.5 h-3.5" /> Established {new Date(grp.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-text-secondary group-hover:translate-x-1 transition-transform" />
            </Link>
          ))}
        </div>
      )}

      {/* Create Group Dialog Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create New Group"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
              Group Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. Goa Trip 2026, Flat 204 Roomies"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              required
              disabled={modalLoading}
              className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-[13px] font-normal text-text-secondary mb-1 mt-1">
              Invite Members
            </label>
            <span className="text-[13px] text-text-secondary block mb-2 leading-[1.4]">
              Enter names or emails of group members, separated by commas or newlines.
            </span>
            <textarea 
              rows={3}
              placeholder="e.g. Alice, Bob, charlie@example.com"
              value={membersInput}
              onChange={(e) => setMembersInput(e.target.value)}
              disabled={modalLoading}
              className="block w-full bg-surface border border-border rounded-lg px-3 py-2 text-[15px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2 justify-end">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={modalLoading}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-[15px] font-medium text-text-secondary hover:bg-background transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={modalLoading}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-[15px] font-medium transition-colors shadow-subtle flex items-center gap-1 active:scale-95"
            >
              {modalLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Join Group with Code Modal */}
      <Modal 
        isOpen={isJoinModalOpen} 
        onClose={() => setIsJoinModalOpen(false)} 
        title="Join Group with Code"
      >
        <form onSubmit={handleJoinByCode} className="space-y-4 text-left">
          <div>
            <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
              Group Invite Code
            </label>
            <input 
              type="text" 
              placeholder="e.g. GOA123, FLA456"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              required
              disabled={joinModalLoading}
              className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] uppercase tracking-widest font-semibold text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <span className="text-[13px] text-text-secondary block mt-1.5 leading-[1.4]">
              Ask your friend or group creator for their 6-character group invite code.
            </span>
          </div>

          <div className="flex gap-2 pt-2 justify-end">
            <button 
              type="button"
              onClick={() => setIsJoinModalOpen(false)}
              disabled={joinModalLoading}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-[15px] font-medium text-text-secondary hover:bg-background transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={joinModalLoading}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-[15px] font-medium transition-colors shadow-subtle flex items-center gap-1 active:scale-95"
            >
              {joinModalLoading ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
