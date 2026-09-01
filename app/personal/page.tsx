// app/personal/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Upload, Trash2, Calendar, Wallet, Tag, Eye, HardDrive, FileText, Download, MoreVertical, RotateCcw } from 'lucide-react';
import { isGuestMode, getGuestUser, supabase } from '@/lib/supabase/client';
import { getPersonalExpenses, createPersonalExpense, deletePersonalExpense, updatePersonalExpense, clearAllPersonalExpenses } from '@/lib/supabase/personalExpenses';
import { listDocuments, uploadFile, deleteDocument, StorageFile } from '@/lib/supabase/storage';
import { PersonalExpense } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { SkeletonList, Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate, getCategoryEmoji, getCategoryColor } from '@/lib/utils/format';

export default function PersonalProfileMe() {
  const router = useRouter();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'expenses' | 'bills'>('expenses');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Expenses States
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [totalSpent, setTotalSpent] = useState(0);
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [expModalLoading, setExpModalLoading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
  const [deletingExpId, setDeletingExpId] = useState<string | null>(null);

  // Date filters
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | 'specific' | 'custom'>('all');
  const [specificDate, setSpecificDate] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Three-dot popover state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Stored Bills (Documents) States
  const [documents, setDocuments] = useState<StorageFile[]>([]);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState('');
  const [docUploading, setDocUploading] = useState(false);
  const [deletingDocName, setDeletingDocName] = useState<string | null>(null);
  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchExpenses = async () => {
    try {
      const data = await getPersonalExpenses();
      setExpenses(data);
      const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
      setTotalSpent(total);
    } catch (e: any) {
      showToast(e.message || 'Error fetching personal expenses', 'error');
    }
  };

  const handleResetAll = async () => {
    setResetting(true);
    try {
      await clearAllPersonalExpenses();
      await fetchExpenses();
      setShowResetModal(false);
      showToast('Personal expenses have been reset to ₹0', 'success');
    } catch (e: any) {
      showToast(e.message || 'Error resetting personal expenses', 'error');
    } finally {
      setResetting(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const list = await listDocuments();
      setDocuments(list);
    } catch (e: any) {
      showToast(e.message || 'Error loading saved bills', 'error');
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchExpenses(), fetchDocuments()]);
    setLoading(false);
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'bills') {
      setActiveTab('bills');
    }
    if (searchParams.get('action') === 'add-expense') {
      setEditingExpenseId(null);
      setAmount('');
      setCategory('Food');
      setNote('');
      setReceiptFile(null);
      setIsExpModalOpen(true);
    }
  }, []);

  useEffect(() => {
    if (isGuestMode()) {
      setCurrentUser(getGuestUser());
      loadAllData();
    } else {
      const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
        } else {
          setCurrentUser(session.user);
          loadAllData();
        }
      };
      checkAuth();
    }
  }, [router]);

  const handleStartEdit = (exp: PersonalExpense) => {
    setEditingExpenseId(exp.id);
    setAmount(String(exp.amount));
    setCategory(exp.category);
    setDate(exp.date);
    setNote(exp.note || '');
    setReceiptFile(null);
    setIsExpModalOpen(true);
    setActiveMenuId(null);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Amount must be positive number', 'error');
      return;
    }

    setExpModalLoading(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        setUploadingReceipt(true);
        receiptUrl = await uploadFile('receipts', receiptFile);
        setUploadingReceipt(false);
      }

      if (editingExpenseId) {
        await updatePersonalExpense(
          editingExpenseId,
          parsedAmount,
          category,
          date,
          note.trim() || null,
          receiptUrl
        );
        showToast('Expense updated successfully!', 'success');
      } else {
        await createPersonalExpense(
          parsedAmount,
          category,
          date,
          note.trim() || null,
          receiptUrl
        );
        showToast('Personal expense logged!', 'success');
      }

      setAmount('');
      setNote('');
      setReceiptFile(null);
      setEditingExpenseId(null);
      setIsExpModalOpen(false);
      fetchExpenses();
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (err: any) {
      showToast(err.message || 'Error saving expense', 'error');
    } finally {
      setExpModalLoading(false);
      setUploadingReceipt(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deletePersonalExpense(id);
      showToast('Expense deleted', 'success');
      setDeletingExpId(null);
      fetchExpenses();
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (e: any) {
      showToast(e.message || 'Error deleting expense', 'error');
    }
  };

  const handleDocUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setDocUploading(true);
    try {
      const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.'));
      const finalName = `${customFileName.trim() || 'Receipt'}_${Date.now()}${ext}`;
      await uploadFile('receipts', selectedFile, finalName);
      showToast('Document archived in vault!', 'success');
      setIsDocModalOpen(false);
      setSelectedFile(null);
      setCustomFileName('');
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Failed to save document', 'error');
    } finally {
      setDocUploading(false);
    }
  };

  const handleDocDelete = async () => {
    if (!deletingDocName) return;
    try {
      await deleteDocument(deletingDocName);
      showToast('Document removed from vault', 'success');
      setDeletingDocName(null);
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Error deleting file', 'error');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // 1. Filter by category & Date
  const getFilteredExpenses = () => {
    let result = expenses;
    
    // Category filter
    if (categoryFilter !== 'All') {
      result = result.filter(e => e.category === categoryFilter);
    }
    
    // Date filter
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

  // 2. Group by date headers
  const getGroupedExpenses = (list: PersonalExpense[]) => {
    const groups: Record<string, PersonalExpense[]> = {};
    const sorted = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    sorted.forEach(exp => {
      let header = '';
      if (exp.date === todayStr) {
        header = 'Today';
      } else if (exp.date === yesterdayStr) {
        header = 'Yesterday';
      } else {
        header = formatDate(exp.date);
      }
      if (!groups[header]) groups[header] = [];
      groups[header].push(exp);
    });
    
    return groups;
  };

  const finalFilteredExpenses = getFilteredExpenses();
  const groupedExpenses = getGroupedExpenses(finalFilteredExpenses);

  if (loading || !currentUser) {
    return (
      <div className="space-y-6 text-left">
        <div className="flex justify-between items-center">
          <div className="space-y-1.5 w-1/3">
            <Skeleton className="w-10 h-2.5 rounded" />
            <Skeleton className="w-24 h-5 rounded-md" />
          </div>
          <Skeleton className="w-24 h-8 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 text-slate-900 dark:text-slate-100">
      {/* 1. Header Profile Banner */}
      <div className="flex justify-between items-center text-left">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-primary">
            Personal Wallet
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            My Expenses
          </h1>
        </div>

        {activeTab === 'expenses' ? (
          <div className="flex items-center gap-2">
            {expenses.length > 0 && (
              <button 
                onClick={() => setShowResetModal(true)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                title="Reset all personal expenses"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
            <button 
              onClick={() => {
                setEditingExpenseId(null);
                setAmount('');
                setCategory('Food');
                setNote('');
                setReceiptFile(null);
                setIsExpModalOpen(true);
              }}
              className="bg-primary hover:bg-primary-light text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsDocModalOpen(true)}
            className="bg-primary hover:bg-primary-light text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" /> Upload Standalone Bill
          </button>
        )}
      </div>

      {/* 2. Monthly Spend Analytics Summary */}
      <div className="grid grid-cols-2 gap-4 text-left">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/20 rounded-xl flex items-center justify-center mb-3">
            <Wallet className="w-5.5 h-5.5 text-primary" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Month Personal Spent</span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 mt-1 block">
            {formatCurrency(totalSpent)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/20 rounded-xl flex items-center justify-center mb-3">
            <Tag className="w-5.5 h-5.5 text-primary" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Records</span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 mt-1 block">
            {expenses.length} logs
          </span>
        </div>
      </div>

      {/* 3. Section Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 py-1 text-left">
        <button 
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'expenses' 
              ? 'border-primary text-primary font-black scale-105' 
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          My Expense Feed
        </button>
        <button 
          onClick={() => setActiveTab('bills')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'bills' 
              ? 'border-primary text-primary font-black scale-105' 
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          My Documents Vault
        </button>
      </div>

      {/* TAB 1: EXPENSE LIST */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Collapsible Date & Category filter widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {/* Category Filter */}
            <div className="flex flex-col gap-1.5 p-3 bg-white dark:bg-slate-900 border border-border-custom rounded-2xl">
              <span className="text-[10px] font-black uppercase text-slate-400">Category Filter</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="All">All Categories</option>
                <option value="Food">Food</option>
                <option value="Lodging">Lodging</option>
                <option value="Travel">Travel</option>
                <option value="Utilities">Utilities</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Shopping">Shopping</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex flex-col gap-1.5 p-3 bg-white dark:bg-slate-900 border border-border-custom rounded-2xl">
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
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none mt-1"
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
          </div>

          <div className="space-y-3">
            {expenses.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-border-custom rounded-3xl p-8 text-center flex flex-col items-center justify-center">
                <span className="text-3xl mb-3">💸</span>
                <h4 className="font-bold text-slate-800 dark:text-white mb-1.5">No expenses logged</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-4">
                  Log your personal, group-independent expenses here to track your overall monthly budget.
                </p>
                <button 
                  onClick={() => {
                    setEditingExpenseId(null);
                    setAmount('');
                    setCategory('Food');
                    setNote('');
                    setReceiptFile(null);
                    setIsExpModalOpen(true);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                  Add Expense
                </button>
              </div>
            ) : Object.keys(groupedExpenses).length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-border-custom rounded-3xl p-8 text-center text-slate-400 text-xs">
                No expenses match the selected filters.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedExpenses).map(([dateHeader, list]) => (
                  <div key={dateHeader} className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left mt-3">
                      {dateHeader}
                    </h4>
                    <div className="space-y-2">
                      {list.map(exp => (
                        <div 
                          key={exp.id}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between hover:border-blue-500 hover:shadow-md transition-all shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-lg">
                              {getCategoryEmoji(exp.category)}
                            </div>
                            <div className="text-left">
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                                {exp.note || exp.category}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {exp.category}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 mr-1">
                              {formatCurrency(exp.amount)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {exp.receipt_url && (
                                <button 
                                  onClick={() => setViewReceiptUrl(exp.receipt_url)}
                                  className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                  title="View receipt attachment"
                                >
                                  <Eye className="w-4.5 h-4.5" />
                                </button>
                              )}
                              
                              {/* Three-dot Action Button */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(activeMenuId === exp.id ? null : exp.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                  title="Actions"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {activeMenuId === exp.id && (
                                  <>
                                    <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                                    <div className="absolute right-0 mt-1 w-24 bg-white dark:bg-slate-950 rounded-xl shadow-lg border border-slate-200/60 dark:border-slate-800/60 py-1.5 z-40 text-left">
                                      <button
                                        onClick={() => handleStartEdit(exp)}
                                        className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          setDeletingExpId(exp.id);
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
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SAVED BILLS */}
      {activeTab === 'bills' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-left flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/20 rounded-xl flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Stored Bills Vault</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block truncate max-w-[180px]">
                  {documents.length} documents archived
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => setIsDocModalOpen(true)}
              className="bg-primary hover:bg-primary-light text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" /> Upload Receipt
            </button>
          </div>

          {/* Stored Documents list */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400 text-left">Saved Documents</h3>

            {documents.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center shadow-xs">
                <span className="text-3xl mb-3">📁</span>
                <h4 className="font-bold text-slate-800 dark:text-white mb-1.5">Your vault is empty</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-5">
                  Upload standalone utility contracts, house deposits, or lease scans to keep them handy.
                </p>
                <button 
                  onClick={() => setIsDocModalOpen(true)}
                  className="bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  Upload first file
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {documents.map(doc => (
                  <div 
                    key={doc.name}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between hover:border-blue-500 hover:shadow-md transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-50 dark:bg-slate-850 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <FileText className="w-5.5 h-5.5" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate max-w-[150px] sm:max-w-[200px]" title={doc.name}>
                          {doc.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatBytes(doc.size)} • {formatDate(doc.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a 
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        title="Download Document"
                      >
                        <Download className="w-4.5 h-4.5" />
                      </a>
                      <button 
                        onClick={() => setDeletingDocName(doc.name)}
                        className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Create/Edit Expense */}
      <Modal 
        isOpen={isExpModalOpen} 
        onClose={() => {
          setEditingExpenseId(null);
          setIsExpModalOpen(false);
        }} 
        title={editingExpenseId ? 'Edit Expense' : 'Add Expense'}
      >
        <form onSubmit={handleCreateExpense} className="space-y-4 text-slate-800 dark:text-slate-200">
          <div className="text-left">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Amount (INR)
            </label>
            <input 
              type="number" 
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={expModalLoading}
              className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-slate-850 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Category
              </label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={expModalLoading}
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
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={expModalLoading}
                className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="text-left">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Description / Detail Note
            </label>
            <input 
              type="text" 
              placeholder="e.g. Weekly organic groceries, Taxi ride"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={expModalLoading}
              className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-850 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <div className="text-left">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Receipt Attachment (Optional)
            </label>
            <label className="flex items-center gap-2 justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
              <Upload className="w-4 h-4" />
              <span className="truncate max-w-[120px]">{receiptFile ? receiptFile.name : 'Upload file'}</span>
              <input 
                type="file" 
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                disabled={expModalLoading}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex gap-2 pt-2 justify-end border-t border-slate-100 dark:border-slate-800">
            <button 
              type="button"
              onClick={() => {
                setEditingExpenseId(null);
                setIsExpModalOpen(false);
              }}
              disabled={expModalLoading}
              className="px-4 py-2 border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={expModalLoading}
              className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            >
              {expModalLoading ? 'Saving...' : editingExpenseId ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Upload Standalone Bill */}
      <Modal 
        isOpen={isDocModalOpen} 
        onClose={() => setIsDocModalOpen(false)} 
        title="Upload Stored Bill"
      >
        <form onSubmit={handleDocUploadSubmit} className="space-y-4 text-slate-800 dark:text-slate-200">
          <div className="text-left">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Select Receipt File
            </label>
            <label className="flex flex-col items-center gap-2 justify-center border-2 border-dashed border-slate-350 dark:border-slate-800 hover:border-slate-400 bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl cursor-pointer transition-colors text-slate-450 hover:text-slate-655">
              <Upload className="w-8 h-8" />
              <span className="text-xs font-bold truncate max-w-[200px]">
                {selectedFile ? selectedFile.name : 'Choose PDF, Image or Doc'}
              </span>
              <span className="text-[9px] text-slate-400">Max size limit: 5MB</span>
              <input 
                type="file" 
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file) {
                    const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
                    setCustomFileName(baseName);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>

          {selectedFile && (
            <div className="animate-in fade-in duration-200 text-left">
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                Custom Name (Optional)
              </label>
              <input 
                type="text" 
                placeholder="e.g. Broadband_Bill_Aug"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                disabled={docUploading}
                className="block w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2 justify-end border-t border-slate-100 dark:border-slate-800">
            <button 
              type="button"
              onClick={() => setIsDocModalOpen(false)}
              disabled={docUploading}
              className="px-4 py-2 border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={docUploading || !selectedFile}
              className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm disabled:opacity-40"
            >
              {docUploading ? 'Uploading...' : 'Upload Receipt'}
            </button>
          </div>
        </form>
      </Modal>
 
      {/* Modal 3: Receipt Image Visualizer */}
      <Modal isOpen={viewReceiptUrl !== null} onClose={() => setViewReceiptUrl(null)} title="Receipt Image Attachment">
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

      {/* Modal 4: Confirm Delete Expense */}
      <Modal 
        isOpen={deletingExpId !== null} 
        onClose={() => setDeletingExpId(null)} 
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-550 dark:text-slate-400 text-left">
            Are you sure you want to permanently delete this personal expense record?
          </p>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setDeletingExpId(null)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              onClick={() => deletingExpId && handleDeleteExpense(deletingExpId)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 5: Confirm Delete Document */}
      <Modal 
        isOpen={deletingDocName !== null} 
        onClose={() => setDeletingDocName(null)} 
        title="Confirm Delete Stored Bill"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-555 dark:text-slate-400 text-left">
            Are you sure you want to delete the file "{deletingDocName}" from your vault?
          </p>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setDeletingDocName(null)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleDocDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 6: Confirm Reset All Personal Expenses */}
      <Modal 
        isOpen={showResetModal} 
        onClose={() => setShowResetModal(false)} 
        title="Reset Personal Expenses"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to clear all your personal expenses? This will delete all logged personal records and reset your spending total to <strong className="text-slate-900 dark:text-white">₹0</strong>.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <button 
              type="button"
              onClick={() => setShowResetModal(false)}
              disabled={resetting}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleResetAll}
              disabled={resetting}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
            >
              {resetting ? 'Resetting...' : 'Yes, Reset to ₹0'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
