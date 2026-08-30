// components/groups/SettleUpVisualizer.tsx
'use client';

import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { SettleUpPayment } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

interface SettleUpVisualizerProps {
  payments: SettleUpPayment[];
  onSettle: (payment: SettleUpPayment, note: string) => Promise<void>;
}

export function SettleUpVisualizer({ payments, onSettle }: SettleUpVisualizerProps) {
  const [settlingPaymentId, setSettlingPaymentId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRecordSettlement = async (payment: SettleUpPayment) => {
    setLoading(true);
    try {
      await onSettle(payment, note || `Settled balance: ${payment.from_name} paid ${payment.to_name}`);
      setSettlingPaymentId(null);
      setNote('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (payments.length === 0) {
    return (
      <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-[#E6E2DA] dark:border-[#2F2C29] rounded-2xl p-6 text-center shadow-sm">
        <div className="mx-auto w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3">
          <Check className="w-6 h-6 text-[#D4A24C] dark:text-[#E6B560]" />
        </div>
        <h4 className="font-bold text-slate-900 dark:text-white mb-1">Group is Settled!</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">All member accounts are perfectly balanced.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment, idx) => {
        const paymentKey = `${payment.from}-${payment.to}-${idx}`;
        const isSelected = settlingPaymentId === paymentKey;

        return (
          <div 
            key={paymentKey}
            className={`border rounded-2xl p-4 transition-all duration-300 ${
              isSelected 
                ? 'border-primary bg-slate-50 dark:bg-slate-950' 
                : 'border-[#E6E2DA] dark:border-[#2F2C29] hover:border-primary bg-white dark:bg-slate-900'
            }`}
          >
            {/* visual transaction card */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5 sm:gap-4 flex-1">
                {/* Debtor */}
                <div className="flex items-center gap-2 text-left">
                  <img 
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${payment.from_name}`} 
                    alt={payment.from_name}
                    className="w-8 h-8 rounded-full bg-slate-100 object-cover"
                  />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">
                      {payment.from_name}
                    </p>
                    <span className="text-[9px] text-[#E4572E] dark:text-[#FF754F] font-semibold uppercase tracking-wider">pays</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-slate-400">
                  <ArrowRight className="w-4 h-4" />
                </div>

                {/* Creditor */}
                <div className="flex items-center gap-2 text-left">
                  <img 
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${payment.to_name}`} 
                    alt={payment.to_name}
                    className="w-8 h-8 rounded-full bg-slate-100 object-cover"
                  />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">
                      {payment.to_name}
                    </p>
                    <span className="text-[9px] text-[#D4A24C] dark:text-[#E6B560] font-semibold uppercase tracking-wider">receives</span>
                  </div>
                </div>
              </div>

              {/* Amount & Settle trigger */}
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base block">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
                {!isSelected && (
                  <button 
                    onClick={() => setSettlingPaymentId(paymentKey)}
                    className="bg-[#2C3E66] hover:bg-[#3E588F] text-white px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 shadow-sm"
                  >
                    Mark as Paid
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Confirmation Inputs */}
            {isSelected && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 animate-in fade-in duration-200 text-left">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Are you sure you want to log a payment of <strong className="text-primary">{formatCurrency(payment.amount)}</strong> from <strong>{payment.from_name}</strong> to <strong>{payment.to_name}</strong>?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    placeholder="Add a settlement note (optional)..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={loading}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-slate-100"
                  />
                  <div className="flex gap-1.5 self-end sm:self-auto">
                    <button 
                      onClick={() => setSettlingPaymentId(null)}
                      disabled={loading}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleRecordSettlement(payment)}
                      disabled={loading}
                      className="bg-[#2C3E66] hover:bg-[#3E588F] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                    >
                      {loading ? 'Logging...' : 'Confirm Paid'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
