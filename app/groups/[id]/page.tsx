// app/groups/[id]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Plus, Upload, FileText, ArrowLeft, Trash2, Download, 
  Settings, HeartHandshake, UserPlus, Info, CheckSquare, 
  Square, Calendar, CreditCard, ChevronRight, Eye, MoreVertical 
} from 'lucide-react';
import { isGuestMode, getGuestUser, supabase } from '@/lib/supabase/client';
import { getGroup, getGroupMembers, addMemberToGroup, updateGroupStatus, createPlaceholderMember } from '@/lib/supabase/groups';
import { getExpenses, createExpense, updateExpense, deleteExpense, getSettlements, createSettlement } from '@/lib/supabase/expenses';
import { uploadFile } from '@/lib/supabase/storage';
import { simplifyDebts } from '@/lib/utils/simplifyDebts';

import { formatCurrency, formatDate, getCategoryEmoji } from '@/lib/utils/format';
import { Modal } from '@/components/ui/Modal';
import { SettleUpVisualizer } from '@/components/groups/SettleUpVisualizer';
import { useToast } from '@/components/ui/Toast';
import { SkeletonList, Skeleton } from '@/components/ui/Skeleton';
import { Group, Expense, Profile, Settlement, SettleUpPayment } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'expenses' | 'settle' | 'members';

export default function GroupDetail({ params }: PageProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { id: groupId } = use(params);

  // Core data states
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Expense modal states
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expCategory, setExpCategory] = useState('Food');
  const [payerId, setPayerId] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  
  // Splitting selections inside modal
  const [selectedSplitUsers, setSelectedSplitUsers] = useState<Record<string, boolean>>({});
  const [modalLoading, setModalLoading] = useState(false);

  // Date filters for timeline
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | 'specific' | 'custom'>('all');
  const [specificDate, setSpecificDate] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Three-dot popover state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Member invite modal states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  // View Receipt Modal
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  // Delete confirmations
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  // Calculations
  const [netBalances, setNetBalances] = useState<Record<string, number>>({});
  const [simplifiedTransactions, setSimplifiedTransactions] = useState<SettleUpPayment[]>([]);

  // Fetch all group details
  const loadGroupDetails = async () => {
    try {
      const g = await getGroup(groupId);
      if (!g) {
        showToast('Group not found', 'error');
        router.push('/groups');
        return;
      }
      setGroup(g);

      const mList = await getGroupMembers(groupId);
      setMembers(mList);

      const expList = await getExpenses(groupId);
      setExpenses(expList);

      const settleList = await getSettlements(groupId);
      setSettlements(settleList);

      // Fetch user details
      if (isGuestMode()) {
        setCurrentUser(getGuestUser());
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
      }
    } catch (e: any) {
      showToast(e.message || 'Error loading group detail', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroupDetails();

    if (!isGuestMode()) {
      const expChannel = supabase
        .channel(`group-${groupId}-events`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, () => {
          loadGroupDetails();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` }, () => {
          loadGroupDetails();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(expChannel);
      };
    } else {
      const interval = setInterval(() => {
        loadGroupDetails();
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [groupId]);

  // Compute Balances whenever expenses or settlements change
  useEffect(() => {
    if (members.length === 0) return;

    const balances: Record<string, number> = {};
    members.forEach(m => { balances[m.id] = 0; });

    // 1. Calculate paid vs owed from expenses
    expenses.forEach(exp => {
      const parsedAmt = Number(exp.amount);
      const payerId = exp.added_by;

      if (balances[payerId] !== undefined) {
        balances[payerId] += parsedAmt;
      }

      // Debit Splits
      exp.splits?.forEach(split => {
        if (balances[split.user_id] !== undefined) {
          balances[split.user_id] -= Number(split.share_amount);
        }
      });
    });

    // 2. Adjust balances based on payments (settlements)
    settlements.forEach(s => {
      const parsedAmt = Number(s.amount);
      if (balances[s.from_user] !== undefined) {
        balances[s.from_user] += parsedAmt;
      }
      if (balances[s.to_user] !== undefined) {
        balances[s.to_user] -= parsedAmt;
      }
    });

    setNetBalances(balances);

    // 3. Run Debt Simplifier Algorithm
    const transactions = simplifyDebts(balances, members);
    setSimplifiedTransactions(transactions);
  }, [expenses, settlements, members]);

  const openAddExpenseModal = () => {
    setEditingExpenseId(null);
    setExpAmount('');
    setExpDesc('');
    setExpCategory('Food');
    setExpDate(new Date().toISOString().split('T')[0]);
    setPayerId('');
    setReceiptFile(null);
    
    // Default: split among nobody selected (forces user selection)
    const selections: Record<string, boolean> = {};
    members.forEach(m => { selections[m.id] = false; });
    setSelectedSplitUsers(selections);
    
    setIsExpModalOpen(true);
  };

  const handleStartEditExpense = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setExpAmount(String(exp.amount));
    setExpDesc(exp.description);
    setExpCategory(exp.category);
    setExpDate(exp.date);
    setPayerId(exp.added_by);
    setReceiptFile(null);
    
    const selections: Record<string, boolean> = {};
    members.forEach(m => {
      selections[m.id] = exp.splits?.some(s => s.user_id === m.id) || false;
    });
    setSelectedSplitUsers(selections);
    
    setIsExpModalOpen(true);
    setActiveMenuId(null);
  };

  const parsedAmount = parseFloat(expAmount) || 0;

  const handleCreateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      showToast('Amount must be a positive number', 'error');
      return;
    }
    if (!expDesc.trim()) {
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

    setModalLoading(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUploading || setReceiptUploading(true);
        receiptUrl = await uploadFile('receipts', receiptFile);
        setReceiptUploading(false);
      }

      // Prepare equal split amounts
      const share = Math.round((parsedAmount / checkedUserIds.length) * 100) / 100;
      let leftover = parsedAmount - (share * checkedUserIds.length);
      
      const splitsInput = checkedUserIds.map((uid, index) => {
        let userShare = share;
        if (index === 0) {
          userShare = Math.round((share + leftover) * 100) / 100;
        }
        return { user_id: uid, share_amount: userShare };
      });

      if (editingExpenseId) {
        await updateExpense(
          editingExpenseId,
          parsedAmount,
          expDesc.trim(),
          expCategory,
          expDate,
          splitsInput,
          receiptUrl,
          payerId
        );
        showToast('Expense updated successfully!', 'success');
      } else {
        await createExpense(
          groupId,
          parsedAmount,
          expDesc.trim(),
          expCategory,
          expDate,
          splitsInput,
          receiptUrl,
          payerId
        );
        showToast('Expense added successfully!', 'success');
      }

      setIsExpModalOpen(false);
      setExpAmount('');
      setExpDesc('');
      setReceiptFile(null);
      setEditingExpenseId(null);
      
      loadGroupDetails();
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (err: any) {
      showToast(err.message || 'Error saving expense', 'error');
    } finally {
      setModalLoading(false);
      setReceiptUploading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim()) return;

    setInviteLoading(true);
    try {
      await createPlaceholderMember(groupId, inviteName.trim());
      showToast(`Added placeholder "${inviteName.trim()}"`, 'success');
      setInviteName('');
      setIsInviteModalOpen(false);
      loadGroupDetails();
    } catch (err: any) {
      showToast(err.message || 'Failed to add placeholder member', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleMarkAsPaid = async (payment: SettleUpPayment, note: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await createSettlement(
        groupId,
        payment.from,
        payment.to,
        payment.amount,
        today,
        note || `Settled balance payment between members`
      );
      showToast('Settlement payment recorded!', 'success');
      loadGroupDetails();
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (err: any) {
      showToast(err.message || 'Error saving settlement', 'error');
    }
  };

  const handleExpenseDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      showToast('Expense deleted', 'success');
      setDeletingExpenseId(null);
      loadGroupDetails();
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (err: any) {
      showToast(err.message || 'Failed to delete expense', 'error');
    }
  };

  const handleCloseGroupToggle = async () => {
    if (!group) return;
    try {
      const nextStatus = group.status === 'active' ? 'settled' : 'active';
      await updateGroupStatus(groupId, nextStatus);
      showToast(
        nextStatus === 'settled' 
          ? 'Group marked as settled! All balances balances cleared.' 
          : 'Group reopened! You can now log expenses.', 
        'success'
      );
      loadGroupDetails();
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (err: any) {
      showToast(err.message || 'Error updating status', 'error');
    }
  };

  const copyInviteDetails = () => {
    if (!group) return;
    const shareText = `Join my Expense Manager group "${group.name}"! Use code: ${group.invite_code} or link: ${window.location.origin}/join/${group.invite_code}`;
    navigator.clipboard.writeText(shareText);
    showToast('Invite details copied!', 'success');
  };

  // Filter timeline items
  const filterTimelineItemsByDate = (items: any[]) => {
    let result = items;
    const now = new Date();
    
    if (dateFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      result = result.filter(e => new Date(e.date) >= sevenDaysAgo);
    } else if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      result = result.filter(e => new Date(e.date) >= thirtyDaysAgo);
    } else if (dateFilter === 'specific') {
      if (specificDate) {
        result = result.filter(e => e.date === specificDate);
      }
    } else if (dateFilter === 'custom') {
      if (customStart && customEnd) {
        const start = new Date(customStart);
        const end = new Date(customEnd);
        result = result.filter(e => {
          const d = new Date(e.date);
          return d >= start && d <= end;
        });
      }
    }
    return result;
  };

  // Group timeline items by date headers
  const groupTimelineItemsByDate = (items: any[]) => {
    const groups: Record<string, any[]> = {};
    const sorted = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    sorted.forEach(item => {
      let header = '';
      if (item.date === todayStr) {
        header = 'Today';
      } else if (item.date === yesterdayStr) {
        header = 'Yesterday';
      } else {
        header = formatDate(item.date);
      }
      if (!groups[header]) groups[header] = [];
      groups[header].push(item);
    });
    return groups;
  };

  if (loading || !group) {
    return (
      <div className="space-y-6 text-left">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-1/3 rounded-lg" />
          <Skeleton className="w-24 h-8 rounded-xl" />
        </div>
        <SkeletonList count={3} />
      </div>
    );
  }

  const isGroupSettled = group.status === 'settled';

  return (
    <div className="space-y-6 pb-6 text-[#262421] dark:text-slate-100">
      {/* Group Detail Header */}
      <div className="flex items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/dashboard')}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {group.name}
              </h1>
              {isGroupSettled && (
                <span className="text-[8px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                  Settled Up
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Code: <span className="text-slate-500 font-bold">{group.invite_code}</span> • {members.length} members
            </p>
          </div>
        </div>

        <div>
          {isGroupSettled ? (
            <button 
              onClick={handleCloseGroupToggle}
              className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-55 dark:hover:bg-slate-850 rounded-xl text-xs font-bold transition-all"
            >
              Reopen Group
            </button>
          ) : (
            <button 
              onClick={openAddExpenseModal}
              className="bg-primary hover:opacity-90 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Tab Selector Headers */}
      <div className="flex border-b border-border-custom py-1 text-left">
        {(['expenses', 'settle', 'members'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 capitalize flex-shrink-0 ${
              activeTab === tab 
                ? 'border-primary text-primary dark:text-[#E6B560] dark:border-[#E6B560] font-black scale-105' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab === 'settle' 
              ? 'Settle Up' 
              : tab === 'expenses' 
                ? 'Expenses' 
                : 'Members'}
          </button>
        ))}
      </div>

      {/* Tab Content Wrappers */}

      {/* 1. Expenses feed tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-3.5">
          {/* Collapsible Date Filter widget */}
          <div className="flex flex-col gap-1.5 p-3 bg-white dark:bg-slate-900 border border-border-custom rounded-2xl text-left shadow-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase text-slate-400">Filter by Date</span>
              <select
                value={dateFilter}
                onChange={(e: any) => setDateFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="all">All Dates</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="specific">Specific Date</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {dateFilter === 'specific' && (
              <input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none mt-1"
              />
            )}

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            )}
          </div>

          {expenses.length === 0 && settlements.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-border-custom rounded-3xl p-8 text-center flex flex-col items-center justify-center shadow-sm">
              <span className="text-3xl mb-3">💸</span>
              <h4 className="font-bold text-slate-850 dark:text-white mb-1">No activity logged</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-4">
                Record your first bill or trip receipt using the "+ Add Expense" button.
              </p>
            </div>
          ) : (
            (() => {
              const rawTimeline = [
                ...expenses.map(e => ({ ...e, isExpense: true as const, key: `exp-${e.id}` })),
                ...settlements.map(s => ({ ...s, isExpense: false as const, key: `settle-${s.id}` }))
              ];
              const filteredTimeline = filterTimelineItemsByDate(rawTimeline);
              const groupedTimeline = groupTimelineItemsByDate(filteredTimeline);

              if (filteredTimeline.length === 0) {
                return (
                  <div className="bg-white dark:bg-slate-900 border border-border-custom rounded-3xl p-6 text-center text-slate-400 text-xs shadow-sm">
                    No activity matches the selected filters.
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {Object.entries(groupedTimeline).map(([dateHeader, list]) => (
                    <div key={dateHeader} className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left mt-3">
                        {dateHeader}
                      </h4>
                      <div className="space-y-2">
                        {list.map(item => {
                          if (item.isExpense) {
                            const isPayer = currentUser && item.added_by === currentUser.id;
                            return (
                              <div 
                                key={item.key}
                                className="bg-white dark:bg-slate-900 border border-[#E6E2DA] dark:border-[#2F2C29] rounded-2xl p-3 flex items-center justify-between hover:border-primary transition-colors shadow-sm relative group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-slate-50 dark:bg-slate-850 rounded-xl flex items-center justify-center text-lg">
                                    {getCategoryEmoji(item.category)}
                                  </div>
                                  <div className="text-left">
                                    <h4 className="font-bold text-slate-850 dark:text-slate-100 text-xs sm:text-sm">
                                      {item.description}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Paid by <span className="font-semibold">{isPayer ? 'You' : item.added_by_profile?.name || 'someone'}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="text-right mr-1">
                                    <span className="font-extrabold text-slate-905 dark:text-white text-xs sm:text-sm block">
                                      {formatCurrency(item.amount)}
                                    </span>
                                    {isPayer ? (
                                      <span className="text-[9px] text-[#D4A24C] dark:text-[#E6B560] font-bold block">
                                        You lent {formatCurrency(Number(item.amount) - (item.splits?.find((s: any) => s.user_id === currentUser?.id)?.share_amount || 0))}
                                      </span>
                                    ) : (
                                      item.splits?.some((s: any) => s.user_id === currentUser?.id) && (
                                        <span className="text-[9px] text-[#E68A2E] dark:text-[#FF9F40] font-bold block">
                                          You owe {formatCurrency(item.splits.find((s: any) => s.user_id === currentUser?.id)?.share_amount || 0)}
                                        </span>
                                      )
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {item.receipt_url && (
                                      <button 
                                        onClick={() => setViewReceiptUrl(item.receipt_url)}
                                        className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                                        title="View Receipt"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    )}

                                    {/* Three-dot menu popover - all group members can update or delete */}
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveMenuId(activeMenuId === item.key ? null : item.key);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        title="Actions"
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </button>

                                      {activeMenuId === item.key && (
                                        <>
                                          <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                                          <div className="absolute right-0 mt-1 w-24 bg-white dark:bg-slate-950 rounded-xl shadow-lg border border-slate-200/60 dark:border-slate-800/60 py-1.5 z-40 text-left">
                                            <button
                                              onClick={() => handleStartEditExpense(item)}
                                              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => {
                                                setDeletingExpenseId(item.id);
                                                setActiveMenuId(null);
                                              }}
                                              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            const isPayer = currentUser && item.from_user === currentUser.id;
                            const isRecipient = currentUser && item.to_user === currentUser.id;
                            return (
                              <div 
                                key={item.key}
                                className="bg-white dark:bg-slate-900 border border-[#E6E2DA] dark:border-[#2F2C29] rounded-2xl p-3 flex items-center justify-between opacity-80 shadow-sm"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/20 text-[#D4A24C] dark:text-[#E6B560] rounded-xl flex items-center justify-center text-lg font-black">
                                    ✓
                                  </div>
                                  <div className="text-left">
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                                      {item.from_profile?.name || 'Someone'} paid {item.to_profile?.name || 'Someone'}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      {item.note || 'Settled balance'}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="font-extrabold text-[#D4A24C] dark:text-[#E6B560] text-xs sm:text-sm block">
                                    {formatCurrency(item.amount)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block font-bold">
                                    {isPayer ? 'You paid' : isRecipient ? 'You received' : 'Settlement'}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* 2. Settle Up (Debts) tab */}
      {activeTab === 'settle' && (
        <div className="space-y-4">


          <SettleUpVisualizer 
            payments={simplifiedTransactions}
            onSettle={handleMarkAsPaid}
          />
        </div>
      )}

      {/* 3. Members tab */}
      {activeTab === 'members' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-border-custom p-4 rounded-3xl text-left flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Invite Members</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Share this group invite code or copy direct join links to onboard real profiles.
              </p>
            </div>
            
            <button 
              onClick={copyInviteDetails}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 p-2 rounded-xl text-xs font-bold transition-all"
              title="Copy group invite details"
            >
              Copy Info
            </button>
          </div>

          {/* Group Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400 text-left">Active Members ({members.length})</h3>
              
              <button
                onClick={() => {
                  setInviteName('');
                  setIsInviteModalOpen(true);
                }}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Member
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {members.map(member => {
                const balance = netBalances[member.id] || 0;
                return (
                  <div 
                    key={member.id}
                    className="bg-white dark:bg-slate-900 border border-border-custom rounded-2xl p-3 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-750 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={member.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.name}`}
                        alt={member.name}
                        className="w-8.5 h-8.5 rounded-full"
                      />
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                            {member.name}
                          </h4>
                          {member.is_placeholder && (
                            <span className="text-[7.5px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 px-1 rounded tracking-wider">
                              not on app yet
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Joined {formatDate(member.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {balance === 0 ? (
                        <span className="text-xs text-slate-400">Balanced</span>
                      ) : balance > 0 ? (
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-450 text-xs sm:text-sm">
                          Owed ₹{balance.toFixed(2)}
                        </span>
                      ) : (
                        <span className="font-extrabold text-[#E68A2E] dark:text-[#FF9F40] text-xs sm:text-sm">
                          Owes ₹{Math.abs(balance).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}

      {/* 1. Redesigned Add/Edit Expense Modal */}
      <Modal 
        isOpen={isExpModalOpen} 
        onClose={() => {
          setEditingExpenseId(null);
          setIsExpModalOpen(false);
        }} 
        title={editingExpenseId ? 'Edit Expense' : 'Add Expense'}
      >
        <form onSubmit={handleCreateExpenseSubmit} className="flex flex-col max-h-[70vh]">
          <div className="space-y-4 overflow-y-auto flex-1 pr-1 pb-4">
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
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              disabled={modalLoading}
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
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              disabled={modalLoading}
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
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                disabled={modalLoading}
                className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
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
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                disabled={modalLoading}
                className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Paid by dropdown */}
          <div className="text-left">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Paid by
            </label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              disabled={modalLoading}
              className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
              required
            >
              <option value="">Choose Member...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Split among list */}
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
                  const amt = parseFloat(expAmount) || 0;
                  if (checkedCount === 0) return '₹0.00 each';
                  return `${formatCurrency(amt / checkedCount)} each (${checkedCount} checked)`;
                })()}
              </span>
            </div>
          </div>

          {/* Receipt attachment option */}
          <div className="text-left">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
              Attach Bill Receipt (Optional)
            </label>
            <label className="flex items-center gap-1.5 justify-center border border-dashed border-slate-350 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{receiptFile ? receiptFile.name : 'Upload File'}</span>
              <input 
                type="file" 
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          </div>

          {/* Fixed bottom button panel */}
          <div className="flex gap-2 pt-3 justify-end border-t border-slate-100 dark:border-slate-800">
            <button 
              type="button"
              onClick={() => {
                setEditingExpenseId(null);
                setIsExpModalOpen(false);
              }}
              disabled={modalLoading}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={modalLoading}
              className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              {modalLoading ? 'Saving...' : editingExpenseId ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Add Member Modal */}
      <Modal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        title="Add Group Member"
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="text-left">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Member Display Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. Kaveri"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              required
              disabled={inviteLoading}
              className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
            />
            <p className="text-[10px] text-slate-450 mt-1.5">
              This creates a placeholder member. You can start splitting expenses with them immediately, and they can link a real account later via the invite link.
            </p>
          </div>

          <div className="flex gap-2 pt-2 justify-end">
            <button 
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              disabled={inviteLoading}
              className="px-4 py-2 border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-550"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={inviteLoading}
              className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              {inviteLoading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Receipt Attachment Modal */}
      <Modal isOpen={viewReceiptUrl !== null} onClose={() => setViewReceiptUrl(null)} title="Bill Receipt Attachment">
        <div className="flex flex-col items-center justify-center p-2">
          {viewReceiptUrl?.endsWith('.pdf') ? (
            <a 
              href={viewReceiptUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-95 transition-colors"
            >
              Open PDF Document in New Tab
            </a>
          ) : (
            <div className="relative w-full h-[400px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
              <Image 
                src={viewReceiptUrl || ''} 
                alt="Receipt Attachment" 
                fill 
                unoptimized
                className="object-contain" 
              />
            </div>
          )}
        </div>
      </Modal>

      {/* 4. Confirm Delete Expense Modal */}
      <Modal 
        isOpen={deletingExpenseId !== null} 
        onClose={() => setDeletingExpenseId(null)} 
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-left">
            Are you sure you want to permanently delete this expense? This action will restore split balances and cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setDeletingExpenseId(null)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850"
            >
              Cancel
            </button>
            <button 
              onClick={() => deletingExpenseId && handleExpenseDelete(deletingExpenseId)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              Delete Expense
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
