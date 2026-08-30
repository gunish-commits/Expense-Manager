// components/groups/GlobalAddExpenseModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { getGroups, getGroupMembers } from '@/lib/supabase/groups';
import { createExpense } from '@/lib/supabase/expenses';
import { Group, Profile } from '@/types';
import { User, Users, PlusCircle, CheckSquare, Square } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export function GlobalAddExpenseModal() {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  
  // View states: 'closed' | 'action-sheet' | 'group-form'
  const [view, setView] = useState<'closed' | 'action-sheet' | 'group-form'>('closed');
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [members, setMembers] = useState<Profile[]>([]);
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payerId, setPayerId] = useState('');
  const [selectedSplitUsers, setSelectedSplitUsers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setView('action-sheet');
      loadGroups();
    };

    window.addEventListener('open-global-expense-modal', handleOpen);
    return () => window.removeEventListener('open-global-expense-modal', handleOpen);
  }, []);

  // Detect group from pathname when group form is shown
  useEffect(() => {
    if (view === 'group-form') {
      const match = pathname.match(/\/groups\/([a-zA-Z0-9-]+)/);
      if (match && match[1]) {
        setSelectedGroupId(match[1]);
      }
    }
  }, [pathname, view]);

  // Load members when group changes
  useEffect(() => {
    if (selectedGroupId) {
      loadMembers(selectedGroupId);
    } else {
      setMembers([]);
      setPayerId('');
      setSelectedSplitUsers({});
    }
  }, [selectedGroupId]);

  const loadGroups = async () => {
    try {
      const list = await getGroups('active');
      setGroups(list);
      // Pre-select first active group if no group selected
      if (list.length > 0 && !selectedGroupId) {
        setSelectedGroupId(list[0].id);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadMembers = async (gid: string) => {
    try {
      const list = await getGroupMembers(gid);
      setMembers(list);
      // Reset payer and default splits to empty
      setPayerId('');
      const selections: Record<string, boolean> = {};
      list.forEach(m => {
        selections[m.id] = false;
      });
      setSelectedSplitUsers(selections);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) {
      showToast('Please select a group', 'error');
      return;
    }
    const parsedAmt = parseFloat(amount) || 0;
    if (parsedAmt <= 0) {
      showToast('Amount must be a positive number', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Description is required', 'error');
      return;
    }
    if (!payerId) {
      showToast('Please select who paid for the expense', 'error');
      return;
    }

    const checkedUserIds = Object.keys(selectedSplitUsers).filter(uid => selectedSplitUsers[uid]);
    if (checkedUserIds.length === 0) {
      showToast('Select at least one member to split with', 'error');
      return;
    }

    setLoading(true);
    try {
      // Prepare equal split amounts
      const share = Math.round((parsedAmt / checkedUserIds.length) * 100) / 100;
      let leftover = parsedAmt - (share * checkedUserIds.length);
      
      const splitsInput = checkedUserIds.map((uid, index) => {
        let userShare = share;
        if (index === 0) {
          userShare = Math.round((share + leftover) * 100) / 100;
        }
        return { user_id: uid, share_amount: userShare };
      });

      await createExpense(selectedGroupId, parsedAmt, description.trim(), category, date, splitsInput, null, payerId);
      showToast('Expense split successfully!', 'success');
      
      // Dispatch refresh events
      window.dispatchEvent(new Event('refresh-group-details'));
      window.dispatchEvent(new Event('refresh-dashboard-data'));
      
      // Reset fields
      setDescription('');
      setAmount('');
      setCategory('Food');
      setDate(new Date().toISOString().split('T')[0]);
      setPayerId('');
      setSelectedSplitUsers({});
      setView('closed');
    } catch (e: any) {
      showToast(e.message || 'Failed to add expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  const activeGroups = groups.filter(g => g.status === 'active');
  const isGroupPageActive = !!pathname.match(/\/groups\/([a-zA-Z0-9-]+)/);

  if (view === 'closed') {
    return null;
  }

  // View 1: Bottom Action Sheet
  if (view === 'action-sheet') {
    return (
      <Modal isOpen={true} onClose={() => setView('closed')} title="Add Expense">
        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-550 dark:text-slate-400 text-left">Where would you like to log this expense?</p>
          <div className="grid grid-cols-1 gap-3">
            {/* Option A: Personal */}
            <button
              onClick={() => {
                router.push('/personal?action=add-expense');
                setView('closed');
              }}
              className="flex items-center gap-4 p-4 border border-[#E6E4DF] dark:border-[#2D2A26] rounded-2xl hover:border-[#1F6E5C] transition-all bg-white dark:bg-slate-900 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/20 flex items-center justify-center text-[#1F6E5C] dark:text-[#2B9B82]">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Personal Spending</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Log private expenses tracked only in your ledger</p>
              </div>
            </button>

            {/* Option B: Group */}
            <button
              onClick={() => setView('group-form')}
              className="flex items-center gap-4 p-4 border border-[#E6E4DF] dark:border-[#2D2A26] rounded-2xl hover:border-[#1F6E5C] transition-all bg-white dark:bg-slate-900 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-[#1F6E5C] dark:text-[#2B9B82]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Group Expense</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Split bills and share balances with roommates or friends</p>
              </div>
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // View 2: Group Splits Form Modal
  return (
    <Modal isOpen={true} onClose={() => setView('closed')} title="Add Group Expense">
      {activeGroups.length === 0 && !isGroupPageActive ? (
        <div className="space-y-4 py-4 text-center">
          <p className="text-xs text-rose-500 font-bold">No active groups — create one first</p>
          <button
            onClick={() => {
              router.push('/groups?action=create-group');
              setView('closed');
            }}
            className="inline-flex items-center gap-1.5 bg-[#1F6E5C] hover:bg-[#2B9B82] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" /> Create a Group
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[70vh]">
          <div className="space-y-4 overflow-y-auto flex-1 pr-1 pb-4">
            {/* Group Selector */}
            {!isGroupPageActive && (
              <div className="text-left">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                  Select Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="block w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="">Select Group...</option>
                  {activeGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount input */}
            <div className="text-left">
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Amount (₹)
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Description input */}
            <div className="text-left">
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Description / Note
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Seafood dinner, Cabin booking"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Category dropdown & Date */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={loading}
                  className="block w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                >
                  <option value="Food">Food 🍔</option>
                  <option value="Travel">Travel ✈️</option>
                  <option value="Stay">Stay 🏠</option>
                  <option value="Shopping">Shopping 🛒</option>
                  <option value="Other">Other 💸</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={loading}
                  className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Paid by dropdown */}
            {members.length > 0 && (
              <div className="text-left">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                  Paid by
                </label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  disabled={loading}
                  className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                  required
                >
                  <option value="">Choose Member...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Split among list */}
            {members.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Split Among</span>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = Object.values(selectedSplitUsers).every(v => v) && Object.keys(selectedSplitUsers).length === members.length;
                      const nextSelections: Record<string, boolean> = {};
                      members.forEach(m => {
                        nextSelections[m.id] = !allSelected;
                      });
                      setSelectedSplitUsers(nextSelections);
                    }}
                    className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-350 font-bold focus:outline-none"
                  >
                    {Object.values(selectedSplitUsers).every(v => v) && Object.keys(selectedSplitUsers).length === members.length ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>All</span>
                  </button>
                </div>
                
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {members.map(member => {
                    const isSelected = selectedSplitUsers[member.id] || false;
                    return (
                      <div key={member.id} className="flex items-center justify-between text-xs py-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedSplitUsers(prev => ({ ...prev, [member.id]: !prev[member.id] }))}
                          className="flex items-center gap-2 hover:opacity-85 text-slate-700 dark:text-slate-350"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                          <img 
                            src={member.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.name}`}
                            alt={member.name}
                            className="w-5.5 h-5.5 rounded-full"
                          />
                          <span>{member.name}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Live math share calculation display */}
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-xl flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-500">Each:</span>
                  <span className="font-black text-primary">
                    {(() => {
                      const checkedCount = Object.values(selectedSplitUsers).filter(v => v).length;
                      const amt = parseFloat(amount) || 0;
                      if (checkedCount === 0) return '₹0.00 each';
                      return `${formatCurrency(amt / checkedCount)} each (${checkedCount} checked)`;
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3 justify-end border-t border-slate-200/50 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setView('action-sheet')}
              className="px-4 py-2 border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-855"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#1F6E5C] hover:bg-[#2B9B82] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            >
              {loading ? 'Splitting...' : 'Add Expense'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
