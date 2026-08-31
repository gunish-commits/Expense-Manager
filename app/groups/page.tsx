// app/groups/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Users, Calendar, ArrowRight, UserPlus, Sparkles } from 'lucide-react';
import { isGuestMode, supabase } from '@/lib/supabase/client';
import { getGroups, createGroup } from '@/lib/supabase/groups';
import { Group } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { SkeletonList, Skeleton } from '@/components/ui/Skeleton';

export default function Groups() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'settled'>('active');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await getGroups();
      setGroups(data);
    } catch (e: any) {
      showToast(e.message || 'Error fetching groups', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isGuestMode()) {
      fetchGroups();
    } else {
      const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
        } else {
          fetchGroups();
        }
      };
      checkAuth();
    }
  }, [router]);

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
          <span className="text-[10px] uppercase font-black tracking-widest text-primary">
            Shared Expenses
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            My Groups
          </h1>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary-light text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      {/* Active vs History Tab header */}
      <div className="flex border-b border-[#E6E4DF] dark:border-[#2D2A26] py-1 text-left">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'active' 
              ? 'border-primary text-primary font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setActiveTab('settled')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'settled' 
              ? 'border-primary text-primary font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          History (Settled)
        </button>
      </div>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-[#E6E4DF] dark:border-[#2D2A26] rounded-3xl p-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/20 rounded-2xl flex items-center justify-center text-primary mb-4 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white mb-1.5">
            {activeTab === 'active' ? 'No active groups yet' : 'No settled groups in history'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-5">
            {activeTab === 'active' 
              ? 'Groups allow you to split trips, rent, bills, or dinners easily with roommates and friends.'
              : 'When a group’s net balances all reach zero, they will appear here in your archive history.'}
          </p>
          {activeTab === 'active' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              Start your first group
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredGroups.map(grp => (
            <Link 
              key={grp.id}
              href={`/groups/${grp.id}`}
              className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-[#E6E4DF] dark:border-[#2D2A26] rounded-3xl transition-all hover:border-primary"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/20 rounded-2xl flex items-center justify-center text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-primary transition-colors">
                    {grp.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5" /> Established {new Date(grp.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
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
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
              Group Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. Goa Trip 2026, Flat 204 Roomies"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              required
              disabled={modalLoading}
              className="block w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1 mt-1">
              Invite Members
            </label>
            <span className="text-[10px] text-slate-400 block mb-2 leading-relaxed">
              Enter names or emails of group members, separated by commas or newlines.
            </span>
            <textarea 
              rows={3}
              placeholder="e.g. Alice, Bob, charlie@example.com"
              value={membersInput}
              onChange={(e) => setMembersInput(e.target.value)}
              disabled={modalLoading}
              className="block w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-slate-100 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2 justify-end">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={modalLoading}
              className="px-4 py-2 border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={modalLoading}
              className="bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
            >
              {modalLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
