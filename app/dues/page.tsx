// app/dues/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowUpRight, ArrowDownLeft, Trash2, Check, MoreVertical } from 'lucide-react';
import { isGuestMode, getGuestUser, supabase } from '@/lib/supabase/client';
import { getBorrowRecords, createBorrowRecord, settleBorrowRecord, deleteBorrowRecord, updateBorrowRecord } from '@/lib/supabase/borrow';
import { BorrowRecord, Profile } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { SkeletonList, Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export default function DuesPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [records, setRecords] = useState<BorrowRecord[]>([]);

  // Totals
  const [owedToMe, setOwedToMe] = useState(0);
  const [iOwe, setIOwe] = useState(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [direction, setDirection] = useState<'collect' | 'pay'>('collect');
  const [customContactName, setCustomContactName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalLoading, setModalLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Collapsible settled state
  const [showSettled, setShowSettled] = useState(false);

  // Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (isGuestMode()) {
      const gUser = getGuestUser();
      setCurrentUser(gUser);
      fetchRecords(gUser.id);
    } else {
      const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
        } else {
          setCurrentUser(session.user);
          fetchRecords(session.user.id);
        }
      };
      checkUser();
    }
  }, [router]);

  const fetchRecords = async (userId: string) => {
    setLoading(true);
    try {
      const data = await getBorrowRecords();
      setRecords(data);

      let lentTotal = 0;
      let borrowTotal = 0;
      data.forEach(r => {
        if (!r.settled) {
          if (r.lender_id === userId) {
            lentTotal += Number(r.amount);
          } else {
            borrowTotal += Number(r.amount);
          }
        }
      });
      setOwedToMe(lentTotal);
      setIOwe(borrowTotal);
    } catch (e: any) {
      showToast(e.message || 'Error loading dues ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (rec: BorrowRecord) => {
    setEditingId(rec.id);
    setAmount(String(rec.amount));
    setReason(rec.reason);
    setDirection(rec.lender_id === currentUser.id ? 'collect' : 'pay');
    
    const counterPartyName = rec.lender_id === currentUser.id 
      ? rec.borrower_profile?.name || '' 
      : rec.lender_profile?.name || '';
    setCustomContactName(counterPartyName);
    
    setDate(rec.date);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(amount);
    if (!parsedAmt || parsedAmt <= 0) {
      showToast('Amount must be positive number', 'error');
      return;
    }

    if (!customContactName.trim()) {
      showToast("Please enter the person's name", 'error');
      return;
    }

    setModalLoading(true);
    try {
      let contactId = '';
      
      if (isGuestMode()) {
        const profiles = JSON.parse(localStorage.getItem('local_profiles') || '[]');
        const newProfId = crypto.randomUUID();
        const newProfile: Profile = {
          id: newProfId,
          name: customContactName.trim(),
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${customContactName.trim()}`,
          created_at: new Date().toISOString()
        };
        profiles.push(newProfile);
        localStorage.setItem('local_profiles', JSON.stringify(profiles));
        contactId = newProfId;
      } else {
        // Cloud mode manually typed - create virtual profile under users list
        const { data: searchProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('name', customContactName.trim())
          .limit(1);

        if (searchProfile && searchProfile.length > 0) {
          contactId = searchProfile[0].id;
        } else {
          // Create a placeholder profile (profiles_id_fkey removed in migration!)
          const newProfId = crypto.randomUUID();
          const { error: profileErr } = await supabase
            .from('profiles')
            .insert({
              id: newProfId,
              name: customContactName.trim(),
              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${customContactName.trim()}`
            });

          if (profileErr) throw profileErr;
          contactId = newProfId;
        }
      }

      // Assign direction
      const lender_id = direction === 'collect' ? currentUser.id : contactId;
      const borrower_id = direction === 'collect' ? contactId : currentUser.id;

      if (editingId) {
        await updateBorrowRecord(editingId, lender_id, borrower_id, parsedAmt, reason.trim(), date);
        showToast('Due record updated successfully', 'success');
      } else {
        await createBorrowRecord(lender_id, borrower_id, parsedAmt, reason.trim(), date);
        showToast('Due record recorded successfully', 'success');
      }

      // Reset
      setAmount('');
      setReason('');
      setCustomContactName('');
      setEditingId(null);
      setIsModalOpen(false);
      fetchRecords(currentUser.id);
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (e: any) {
      showToast(e.message || 'Failed to save due record', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleSettle = async (rec: BorrowRecord) => {
    try {
      await settleBorrowRecord(rec.id, !rec.settled);
      showToast(rec.settled ? 'Record marked unsettled' : 'Record marked settled', 'success');
      fetchRecords(currentUser.id);
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (e: any) {
      showToast(e.message || 'Error updating status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBorrowRecord(id);
      showToast('Due record deleted', 'success');
      setDeletingId(null);
      fetchRecords(currentUser.id);
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (e: any) {
      showToast(e.message || 'Error deleting record', 'error');
    }
  };

  const unsettledRecords = records.filter(r => !r.settled);
  const settledRecords = records.filter(r => r.settled);

  const renderDueCard = (rec: BorrowRecord) => {
    const isLender = rec.lender_id === currentUser.id;
    const counterPartyName = isLender 
      ? rec.borrower_profile?.name || 'Someone' 
      : rec.lender_profile?.name || 'Someone';

    return (
      <div 
        key={rec.id}
        className={`border rounded-3xl p-4 bg-white dark:bg-slate-900 transition-all ${
          rec.settled 
            ? 'border-[#E6E2DA] dark:border-[#2F2C29] opacity-70 shadow-none' 
            : 'border-[#E6E2DA] dark:border-[#2F2C29] hover:border-primary transition-colors shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-850 rounded-2xl flex items-center justify-center text-lg">
              {isLender ? '📈' : '📉'}
            </div>
            <div className="text-left">
              <h4 className="font-bold text-slate-805 dark:text-slate-100 text-xs sm:text-sm">
                {isLender ? `Lent to ${counterPartyName}` : `Borrowed from ${counterPartyName}`}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Reason: <span className="font-semibold text-slate-500">{rec.reason}</span> • {formatDate(rec.date)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <span className={`font-black text-sm sm:text-base block ${
                rec.settled 
                  ? 'text-slate-500' 
                  : isLender 
                    ? 'text-emerald-600 dark:text-emerald-450' 
                    : 'text-[#E68A2E] dark:text-[#FF9F40]'
              }`}>
                {formatCurrency(rec.amount)}
              </span>
              {rec.settled && (
                <span className="inline-flex items-center gap-0.5 text-[8px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider mt-0.5">
                  <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" /> Settled
                </span>
              )}
            </div>

            {/* Settle Action Button */}
            <button 
              onClick={() => handleToggleSettle(rec)}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl transition-colors ${
                rec.settled 
                  ? 'bg-slate-50 text-slate-450 border border-slate-200/50 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800' 
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-650 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/40'
              }`}
            >
              {rec.settled ? 'Unsettle' : 'Settle'}
            </button>

            {/* Three-dot Actions Trigger */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuId(activeMenuId === rec.id ? null : rec.id);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="Actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {activeMenuId === rec.id && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                  <div className="absolute right-0 mt-1 w-24 bg-white dark:bg-slate-950 rounded-xl shadow-lg border border-slate-200/60 dark:border-slate-800/60 py-1.5 z-40 text-left">
                    <button
                      onClick={() => handleStartEdit(rec)}
                      className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeletingId(rec.id);
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
  };

  if (loading || !currentUser) {
    return (
      <div className="space-y-6 pb-6 text-left">
        <Skeleton className="h-8 w-1/3 rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
        </div>
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 text-[#262421] dark:text-slate-100">
      {/* Top Header */}
      <div className="flex items-center justify-between text-left">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-primary">
            Dues Ledger
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Dues
          </h1>
        </div>

        <button 
          onClick={() => {
            setEditingId(null);
            setAmount('');
            setReason('');
            setCustomContactName('');
            setIsModalOpen(true);
          }}
          className="bg-primary hover:opacity-90 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Payment
        </button>
      </div>

      {/* Stats summaries */}
      <div className="grid grid-cols-2 gap-4">
        {/* Someone owes me (Lent) */}
        <div className="bg-white dark:bg-slate-900 border border-[#E6E2DA] dark:border-[#2F2C29] p-4 rounded-3xl text-left">
          <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl flex items-center justify-center mb-3">
            <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-450" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Owed to You</span>
          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-450 mt-1 block">
            {formatCurrency(owedToMe)}
          </span>
        </div>

        {/* I owe someone (Borrowed) */}
        <div className="bg-white dark:bg-slate-900 border border-[#E6E2DA] dark:border-[#2F2C29] p-4 rounded-3xl text-left">
          <div className="w-9 h-9 bg-rose-50 dark:bg-rose-950/20 rounded-xl flex items-center justify-center mb-3">
            <ArrowDownLeft className="w-5 h-5 text-[#E68A2E] dark:text-[#FF9F40]" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">You Owe</span>
          <span className="text-base sm:text-lg font-black text-[#E68A2E] dark:text-[#FF9F40] mt-1 block">
            {formatCurrency(iOwe)}
          </span>
        </div>
      </div>

      {/* Active Dues Section */}
      <div className="space-y-4">
        <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400 text-left">Active Dues</h3>
        
        {unsettledRecords.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-[#E6E2DA] dark:border-[#2F2C29] rounded-3xl p-8 text-center flex flex-col items-center justify-center shadow-sm">
            <span className="text-3xl mb-3">🤝</span>
            <h4 className="font-bold text-slate-800 dark:text-white mb-1">No active dues</h4>
            <p className="text-xs text-slate-500 dark:text-slate-455 max-w-xs">
              Quickly record any simple cash loans you made to a friend without setting up a group workspace.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {unsettledRecords.map(rec => renderDueCard(rec))}
          </div>
        )}

        {/* Collapsible Settled Section */}
        {settledRecords.length > 0 && (
          <div className="space-y-2 mt-4 text-left">
            <button
              onClick={() => setShowSettled(!showSettled)}
              className="w-full flex items-center justify-between font-bold text-xs uppercase tracking-widest text-slate-500 bg-white dark:bg-slate-900 border border-[#E6E2DA] dark:border-[#2F2C29] p-3 rounded-2xl focus:outline-none"
            >
              <span>Settled Dues ({settledRecords.length})</span>
              <span>{showSettled ? 'Hide ▲' : 'Show ▼'}</span>
            </button>

            {showSettled && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {settledRecords.map(rec => renderDueCard(rec))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Borrow Record Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingId ? 'Edit Payment' : 'Add Payment'}
      >
        <form onSubmit={handleCreateRecord} className="space-y-4">
          {/* Direction toggle */}
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5 text-left">
              Direction of Transaction
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
              <button 
                type="button"
                onClick={() => setDirection('collect')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  direction === 'collect' 
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm' 
                    : 'text-slate-450 hover:text-slate-655'
                }`}
              >
                I Lent
              </button>
              <button 
                type="button"
                onClick={() => setDirection('pay')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  direction === 'pay' 
                    ? 'bg-white dark:bg-slate-900 text-[#E68A2E] dark:text-[#FF9F40] shadow-sm' 
                    : 'text-slate-455 hover:text-slate-650'
                }`}
              >
                I Borrowed
              </button>
            </div>
          </div>

          <div className="text-left">
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
              Person's Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. Kaveri"
              value={customContactName}
              onChange={(e) => setCustomContactName(e.target.value)}
              required
              disabled={modalLoading}
              className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Amount (₹)
              </label>
              <input 
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={modalLoading}
                className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Date
              </label>
              <input 
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={modalLoading}
                className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="text-left">
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
              Reason / Item detail
            </label>
            <input 
              type="text"
              required
              placeholder="e.g. Pizza share, Uber split, Coffee"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={modalLoading}
              className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-2 pt-2 justify-end">
            <button 
              type="button"
              onClick={() => {
                setEditingId(null);
                setIsModalOpen(false);
              }}
              disabled={modalLoading}
              className="px-4 py-2 border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={modalLoading}
              className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              {modalLoading ? 'Saving...' : editingId ? 'Save Changes' : 'Add Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <Modal 
        isOpen={deletingId !== null} 
        onClose={() => setDeletingId(null)} 
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-left">
            Are you sure you want to permanently delete this due log? It will be removed from your summaries.
          </p>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setDeletingId(null)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              Delete Log
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
