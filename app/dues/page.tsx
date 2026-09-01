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
        className={`border rounded-xl p-4 bg-surface transition-all shadow-subtle ${
          rec.settled 
            ? 'border-border opacity-70 shadow-none' 
            : 'border-border hover:border-primary'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-background rounded-full flex items-center justify-center text-lg flex-shrink-0">
              {isLender ? '📈' : '📉'}
            </div>
            <div className="text-left">
              <h4 className="font-medium text-text-primary text-[15px] leading-[1.4]">
                {isLender ? `Lent to ${counterPartyName}` : `Borrowed from ${counterPartyName}`}
              </h4>
              <p className="text-[13px] text-text-secondary mt-0.5 leading-[1.4]">
                Reason: <span className="font-medium text-text-primary">{rec.reason}</span> • {formatDate(rec.date)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <div className="flex items-center justify-end gap-0.5">
                {!rec.settled && (isLender ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-success stroke-[2.5px]" />
                ) : (
                  <ArrowDownLeft className="w-3.5 h-3.5 text-warning stroke-[2.5px]" />
                ))}
                <span className={`font-semibold text-[15px] block leading-[1.4] ${
                  rec.settled 
                    ? 'text-text-secondary' 
                    : isLender 
                      ? 'text-success' 
                      : 'text-warning'
                }`}>
                  {formatCurrency(rec.amount)}
                </span>
              </div>
              {rec.settled && (
                <span className="inline-flex items-center gap-0.5 text-[11px] bg-success-light text-success px-2 py-0.5 rounded-full font-medium uppercase tracking-wider mt-0.5">
                  <Check className="w-2.5 h-2.5 text-success" /> Settled
                </span>
              )}
            </div>

            {/* Settle Action Button */}
            <button 
              onClick={() => handleToggleSettle(rec)}
              className={`text-[13px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                rec.settled 
                  ? 'bg-background text-text-secondary border border-border hover:bg-surface' 
                  : 'bg-primary-light hover:opacity-80 text-primary'
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
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-background transition-colors"
                title="Actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {activeMenuId === rec.id && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                  <div className="absolute right-0 mt-1 w-28 bg-surface rounded-xl shadow-subtle border border-border py-1.5 z-40 text-left">
                    <button
                      onClick={() => handleStartEdit(rec)}
                      className="w-full text-left px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-background transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeletingId(rec.id);
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
  };

  if (loading || !currentUser) {
    return (
      <div className="space-y-6 pb-6 text-left">
        <Skeleton className="h-8 w-1/3 rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 text-text-primary">
      {/* Top Header */}
      <div className="flex items-center justify-between text-left">
        <div>
          <h1 className="text-[22px] font-semibold text-text-primary leading-[1.2]">
            Dues
          </h1>
          <p className="text-[13px] font-normal text-text-secondary leading-[1.4] mt-0.5">
            Personal peer-to-peer debts
          </p>
        </div>

        <button 
          onClick={() => {
            setEditingId(null);
            setAmount('');
            setReason('');
            setCustomContactName('');
            setIsModalOpen(true);
          }}
          className="bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-lg text-[15px] font-medium transition-colors flex items-center gap-1.5 shadow-subtle active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Payment
        </button>
      </div>

      {/* Stats summaries */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Someone owes me (Lent) */}
        <div className="bg-surface border border-border p-4 rounded-xl text-left shadow-subtle">
          <div className="w-9 h-9 bg-success-light text-success rounded-full flex items-center justify-center mb-2">
            <ArrowUpRight className="w-5 h-5 text-success stroke-[2.5px]" />
          </div>
          <span className="text-[13px] font-normal text-text-secondary block">Owed to You</span>
          <span className="text-[22px] font-bold text-success mt-1 block leading-[1.2]">
            {formatCurrency(owedToMe)}
          </span>
        </div>

        {/* I owe someone (Borrowed) */}
        <div className="bg-surface border border-border p-4 rounded-xl text-left shadow-subtle">
          <div className="w-9 h-9 bg-warning-light text-warning rounded-full flex items-center justify-center mb-2">
            <ArrowDownLeft className="w-5 h-5 text-warning stroke-[2.5px]" />
          </div>
          <span className="text-[13px] font-normal text-text-secondary block">You Owe</span>
          <span className="text-[22px] font-bold text-warning mt-1 block leading-[1.2]">
            {formatCurrency(iOwe)}
          </span>
        </div>
      </div>

      {/* Active Dues Section */}
      <div className="space-y-3">
        <h2 className="text-[17px] font-semibold text-text-primary text-left leading-[1.2]">Active Dues</h2>
        
        {unsettledRecords.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center shadow-subtle">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-text-secondary mb-3">
              <span className="text-3xl">🤝</span>
            </div>
            <h4 className="font-semibold text-text-primary text-[17px] mb-1 leading-[1.2]">No active dues</h4>
            <p className="text-[13px] font-normal text-text-secondary max-w-xs leading-[1.4]">
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
              className="w-full flex items-center justify-between font-semibold text-[15px] text-text-primary bg-surface border border-border p-3.5 rounded-xl shadow-subtle focus:outline-none"
            >
              <span>Settled Dues ({settledRecords.length})</span>
              <span className="text-[13px] font-normal text-text-secondary">{showSettled ? 'Hide ▲' : 'Show ▼'}</span>
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
            <label className="block text-[13px] font-normal text-text-secondary mb-1.5 text-left">
              Direction of Transaction
            </label>
            <div className="grid grid-cols-2 gap-2 bg-background p-1 rounded-lg border border-border">
              <button 
                type="button"
                onClick={() => setDirection('collect')}
                className={`py-2 text-[15px] font-medium rounded-md transition-colors ${
                  direction === 'collect' 
                    ? 'bg-surface text-success shadow-subtle' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                I Lent
              </button>
              <button 
                type="button"
                onClick={() => setDirection('pay')}
                className={`py-2 text-[15px] font-medium rounded-md transition-colors ${
                  direction === 'pay' 
                    ? 'bg-surface text-warning shadow-subtle' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                I Borrowed
              </button>
            </div>
          </div>

          <div className="text-left">
            <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
              Person's Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. Kaveri"
              value={customContactName}
              onChange={(e) => setCustomContactName(e.target.value)}
              required
              disabled={modalLoading}
              className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div>
              <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
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
                className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
                Date
              </label>
              <input 
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={modalLoading}
                className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="text-left">
            <label className="block text-[13px] font-normal text-text-secondary mb-1.5">
              Reason / Item detail
            </label>
            <input 
              type="text"
              required
              placeholder="e.g. Pizza share, Uber split, Coffee"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={modalLoading}
              className="block w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[15px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
              className="px-4 py-2 bg-surface border border-border rounded-lg text-[15px] font-medium text-text-secondary hover:bg-background transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={modalLoading}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-[15px] font-medium transition-colors shadow-subtle"
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
          <p className="text-[13px] text-text-secondary text-left leading-[1.4]">
            Are you sure you want to permanently delete this due log? It will be removed from your summaries.
          </p>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setDeletingId(null)}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-[15px] font-medium text-text-secondary hover:bg-background transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-danger hover:opacity-90 text-white px-4 py-2 rounded-lg text-[15px] font-medium transition-colors shadow-subtle active:scale-95"
            >
              Delete Log
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
