// app/groups/[id]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Plus, Upload, FileText, ArrowLeft, Trash2, Download, 
  Settings, HeartHandshake, UserPlus, Info, CheckSquare, 
  Square, Calendar, CreditCard, ChevronRight, Eye, MoreVertical, Copy, Check,
  ArrowUpRight, ArrowDownRight 
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

  const handleCopyInviteLink = () => {
    if (!group) return;
    const url = `${window.location.origin}/groups/join/${group.invite_code}`;
    navigator.clipboard.writeText(url);
    showToast(`Invite link copied to clipboard! (Code: ${group.invite_code})`, 'success');
  };

  const isGroupSettled = group.status === 'settled';

  return (
    <div className="space-y-6 pb-6 text-text-primary">
      {/* Group Detail Header */}
      <div className="flex items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/dashboard')}
            className="p-2 bg-surface border border-border rounded-lg hover:bg-background text-text-secondary transition-colors shadow-subtle"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold text-text-primary leading-[1.2]">
                {group.name}
              </h1>
              {isGroupSettled && (
                <span className="text-[12px] bg-success-light text-success px-2 py-0.5 rounded-full font-medium uppercase tracking-wider">
                  Settled Up
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <button 
                onClick={handleCopyInviteLink}
                className="inline-flex items-center gap-1 text-[13px] bg-primary-light text-primary hover:opacity-80 px-2.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer"
                title="Click to copy invite link"
              >
                Code: {group.invite_code} <Copy className="w-3 h-3" />
              </button>
              <span className="text-[13px] text-text-secondary">• {members.length} members</span>
            </div>
          </div>
        </div>

        <div>
          {isGroupSettled ? (
            <button 
              onClick={handleCloseGroupToggle}
              className="px-3.5 py-2 bg-surface border border-border text-text-primary hover:bg-background rounded-lg text-[15px] font-medium transition-colors shadow-subtle"
            >
              Reopen Group
            </button>
          ) : (
            <button 
              onClick={openAddExpenseModal}
              className="bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-lg text-[15px] font-medium flex items-center gap-1 shadow-subtle active:scale-95 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Tab Selector Headers */}
      <div className="flex border-b border-border-subtle text-left">
        {(['expenses', 'settle', 'members'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-[15px] transition-colors border-b-2 capitalize flex-shrink-0 ${
              activeTab === tab 
                ? 'border-primary text-primary font-medium' 
                : 'border-transparent text-text-secondary hover:text-text-primary font-normal'
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
        <div className="space-y-3">
          {/* Collapsible Date Filter widget */}
          <div className="flex flex-col gap-2 p-3.5 bg-surface border border-border rounded-xl text-left shadow-subtle">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[13px] font-normal text-text-secondary">Filter by Date</span>
              <select
                value={dateFilter}
                onChange={(e: any) => setDateFilter(e.target.value)}
                className="bg-surface border border-border rounded-lg px-2.5 py-1 text-[13px] text-text-primary focus:outline-none focus:border-primary"
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
                className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-[13px] text-text-primary focus:outline-none focus:border-primary mt-1"
              />
            )}

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex-1 bg-surface border border-border rounded-lg px-2 py-1 text-[13px] text-text-primary focus:outline-none focus:border-primary"
                />
                <span className="text-[13px] text-text-secondary">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex-1 bg-surface border border-border rounded-lg px-2 py-1 text-[13px] text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {expenses.length === 0 && settlements.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center shadow-subtle">
              <FileText className="w-8 h-8 text-text-secondary mb-3" />
              <h4 className="font-semibold text-text-primary text-[17px] mb-1 leading-[1.2]">No activity logged</h4>
              <p className="text-[13px] font-normal text-text-secondary max-w-xs mb-4 leading-[1.4]">
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
                  <div className="bg-surface border border-border rounded-xl p-6 text-center text-text-secondary text-[13px] shadow-subtle">
                    No activity matches the selected filters.
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {Object.entries(groupedTimeline).map(([dateHeader, list]) => (
                    <div key={dateHeader} className="space-y-2">
                      <h4 className="text-[13px] font-normal text-text-secondary text-left mt-3">
                        {dateHeader}
                      </h4>
                      <div className="space-y-2">
                        {list.map(item => {
                          if (item.isExpense) {
                            const isPayer = currentUser && item.added_by === currentUser.id;
                            return (
                              <div 
                                key={item.key}
                                className="bg-surface border border-border rounded-xl p-3.5 flex items-center justify-between hover:border-primary transition-all shadow-subtle relative group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-background rounded-full flex items-center justify-center text-lg flex-shrink-0">
                                    {getCategoryEmoji(item.category)}
                                  </div>
                                  <div className="text-left">
                                    <h4 className="font-medium text-text-primary text-[15px] leading-[1.4]">
                                      {item.description}
                                    </h4>
                                    <p className="text-[13px] text-text-secondary mt-0.5 leading-[1.4]">
                                      Paid by <span className="font-medium text-text-primary">{isPayer ? 'You' : item.added_by_profile?.name || 'someone'}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="text-right mr-1">
                                    <span className="font-semibold text-text-primary text-[15px] block leading-[1.4]">
                                      {formatCurrency(item.amount)}
                                    </span>
                                    {isPayer ? (
                                      <div className="flex items-center justify-end gap-0.5">
                                        <ArrowUpRight className="w-3 h-3 text-success stroke-[2.5px]" />
                                        <span className="text-[13px] text-success font-medium block leading-[1.4]">
                                          You lent {formatCurrency(Number(item.amount) - (item.splits?.find((s: any) => s.user_id === currentUser?.id)?.share_amount || 0))}
                                        </span>
                                      </div>
                                    ) : (
                                      item.splits?.some((s: any) => s.user_id === currentUser?.id) && (
                                        <div className="flex items-center justify-end gap-0.5">
                                          <ArrowDownRight className="w-3 h-3 text-warning stroke-[2.5px]" />
                                          <span className="text-[13px] text-warning font-medium block leading-[1.4]">
                                            You owe {formatCurrency(item.splits.find((s: any) => s.user_id === currentUser?.id)?.share_amount || 0)}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {item.receipt_url && (
                                      <button 
                                        onClick={() => setViewReceiptUrl(item.receipt_url)}
                                        className="p-1.5 border border-border hover:bg-background rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                                        title="View Receipt"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    )}

                                    {/* Three-dot menu popover */}
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveMenuId(activeMenuId === item.key ? null : item.key);
                                        }}
                                        className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-background transition-colors"
                                        title="Actions"
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </button>

                                      {activeMenuId === item.key && (
                                        <>
                                          <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                                          <div className="absolute right-0 mt-1 w-28 bg-surface rounded-xl shadow-subtle border border-border py-1.5 z-40 text-left">
                                            <button
                                              onClick={() => handleStartEditExpense(item)}
                                              className="w-full text-left px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-background transition-colors"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => {
                                                setDeletingExpenseId(item.id);
                                                setActiveMenuId(null);
                                              }}
                                              className="w-full text-left px-3 py-1.5 text-[13px] font-medium text-danger hover:bg-danger-light transition-colors"
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
                                className="bg-surface border border-border rounded-xl p-3.5 flex items-center justify-between shadow-subtle"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-success-light text-success rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                                    ✓
                                  </div>
                                  <div className="text-left">
                                    <h4 className="font-medium text-text-primary text-[15px] leading-[1.4]">
                                      {item.from_profile?.name || 'Someone'} paid {item.to_profile?.name || 'Someone'}
                                    </h4>
                                    <p className="text-[13px] text-text-secondary mt-0.5 leading-[1.4]">
                                      {item.note || 'Settled balance'}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="font-semibold text-success text-[15px] block leading-[1.4]">
                                    {formatCurrency(item.amount)}
                                  </span>
                                  <span className="text-[13px] text-text-secondary block font-normal">
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
          <div className="bg-surface border border-border p-4 rounded-xl text-left flex items-center justify-between shadow-subtle">
            <div>
              <span className="text-[15px] font-semibold text-text-primary block leading-[1.2]">Invite Members</span>
              <p className="text-[13px] text-text-secondary mt-0.5 leading-[1.4]">
                Share this group invite code or copy direct join links to onboard members.
              </p>
            </div>
            
            <button 
              onClick={copyInviteDetails}
              className="bg-surface border border-border text-text-primary hover:bg-background p-2 rounded-lg text-[13px] font-medium transition-colors shadow-subtle flex-shrink-0"
              title="Copy group invite details"
            >
              Copy Info
            </button>
          </div>

          {/* Group Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-text-primary text-left leading-[1.2]">Active Members ({members.length})</h2>
              
              <button
                onClick={() => {
                  setInviteName('');
                  setIsInviteModalOpen(true);
                }}
                className="text-[13px] font-medium text-primary hover:text-primary-hover flex items-center gap-1"
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
                    className="bg-surface border border-border rounded-xl p-3.5 flex items-center justify-between hover:border-border transition-colors shadow-subtle"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={member.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.name}`}
                        alt={member.name}
                        className="w-9 h-9 rounded-full bg-background object-cover"
                      />
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-medium text-text-primary text-[15px] leading-[1.4]">
                            {member.name}
                          </h4>
                          {member.is_placeholder && (
                            <span className="text-[11px] font-medium bg-background text-text-secondary px-1.5 py-0.5 rounded-full">
                              not on app
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-text-secondary">
                          Joined {formatDate(member.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {balance === 0 ? (
                        <span className="text-[13px] text-text-secondary font-normal">Balanced</span>
                      ) : balance > 0 ? (
                        <div className="flex items-center gap-0.5 justify-end">
                          <ArrowUpRight className="w-3 h-3 text-success stroke-[2.5px]" />
                          <span className="font-semibold text-success text-[15px] leading-[1.4]">
                            Owed {formatCurrency(balance)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 justify-end">
                          <ArrowDownRight className="w-3 h-3 text-warning stroke-[2.5px]" />
                          <span className="font-semibold text-warning text-[15px] leading-[1.4]">
                            Owes {formatCurrency(Math.abs(balance))}
                          </span>
                        </div>
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

      {/* 1. Add/Edit Expense Modal */}
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
            <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
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
              className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Description input */}
          <div className="text-left">
            <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
              Description / Note
            </label>
            <input 
              type="text"
              required
              placeholder="e.g. Seafood dinner, Cabin booking"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              disabled={modalLoading}
              className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Category dropdown & Date */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div>
              <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
                Category
              </label>
              <select 
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                disabled={modalLoading}
                className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="Food">Food</option>
                <option value="Travel">Travel</option>
                <option value="Stay">Stay</option>
                <option value="Shopping">Shopping</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
                Date
              </label>
              <input 
                type="date"
                required
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                disabled={modalLoading}
                className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Paid by dropdown */}
          <div className="text-left">
            <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
              Paid by
            </label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              disabled={modalLoading}
              className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary"
              required
            >
              <option value="">Choose Member...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Split among list */}
          <div className="border-t border-border-subtle pt-3 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-normal text-text-secondary">Split Among</span>
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
                className="flex items-center gap-1.5 text-[13px] text-text-primary font-medium focus:outline-none"
              >
                {Object.values(selectedSplitUsers).every(v => v) && Object.keys(selectedSplitUsers).length === members.length ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4 text-text-secondary" />
                )}
                <span>All</span>
              </button>
            </div>
            
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {members.map(member => {
                const isSelected = selectedSplitUsers[member.id] || false;
                return (
                  <div key={member.id} className="flex items-center justify-between text-[15px] py-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSplitUsers(prev => ({ ...prev, [member.id]: !prev[member.id] }))}
                      className="flex items-center gap-2 text-text-primary hover:opacity-85"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-text-secondary" />
                      )}
                      <img 
                        src={member.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.name}`}
                        alt={member.name}
                        className="w-5.5 h-5.5 rounded-full object-cover"
                      />
                      <span className="text-[15px] text-text-primary">{member.name}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Live math share calculation display */}
            <div className="mt-3 p-3 bg-primary-light rounded-lg flex items-center justify-between text-[13px]">
              <span className="font-normal text-text-secondary">Each:</span>
              <span className="font-semibold text-primary">
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
            <label className="block text-[13px] font-normal text-text-secondary mb-1">
              Attach Bill Receipt (Optional)
            </label>
            <label className="flex items-center gap-1.5 justify-center border border-dashed border-border bg-surface px-3 py-2.5 rounded-lg text-[13px] text-text-secondary cursor-pointer hover:bg-background transition-colors">
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
          <div className="flex gap-2 pt-3 justify-end border-t border-border-subtle">
            <button 
              type="button"
              onClick={() => {
                setEditingExpenseId(null);
                setIsExpModalOpen(false);
              }}
              disabled={modalLoading}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-[15px] font-medium text-text-secondary hover:bg-background transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={modalLoading}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-[15px] font-medium transition-colors shadow-subtle"
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
            <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
              Member Display Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. Kaveri"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              required
              disabled={inviteLoading}
              className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-[13px] text-text-secondary mt-1.5 leading-[1.4]">
              This creates a placeholder member. You can start splitting expenses with them immediately, and they can link a real account later via the invite link.
            </p>
          </div>

          <div className="flex gap-2 pt-2 justify-end">
            <button 
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              disabled={inviteLoading}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-[15px] font-medium text-text-secondary hover:bg-background transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={inviteLoading}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-[15px] font-medium transition-colors shadow-subtle"
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
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-[15px] font-medium transition-colors shadow-subtle"
            >
              Open PDF Document in New Tab
            </a>
          ) : (
            <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-border">
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
          <p className="text-[13px] text-text-secondary text-left leading-[1.4]">
            Are you sure you want to permanently delete this expense? This action will restore split balances and cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setDeletingExpenseId(null)}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-[15px] font-medium text-text-secondary hover:bg-background transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => deletingExpenseId && handleExpenseDelete(deletingExpenseId)}
              className="bg-danger hover:opacity-90 text-white px-4 py-2 rounded-lg text-[15px] font-medium transition-colors shadow-subtle active:scale-95"
            >
              Delete Expense
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
