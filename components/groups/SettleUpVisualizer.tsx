// components/groups/SettleUpVisualizer.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
      <div className="bg-success-light border border-success/30 rounded-xl p-6 text-center shadow-subtle">
        <div className="mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-2 text-success">
          <Check className="w-6 h-6 text-success" />
        </div>
        <h4 className="font-semibold text-text-primary text-[17px] mb-1 leading-[1.2]">Group is Settled!</h4>
        <p className="text-[13px] text-text-secondary leading-[1.4]">All member accounts are perfectly balanced.</p>
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
            className={`border rounded-xl p-4 transition-all duration-200 bg-surface shadow-subtle ${
              isSelected 
                ? 'border-primary bg-primary-light/20' 
                : 'border-border hover:border-primary'
            }`}
          >
            {/* visual transaction card */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5 sm:gap-4 flex-1">
                {/* Debtor */}
                <div className="flex items-center gap-2 text-left">
                  <Image 
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${payment.from_name}`} 
                    alt={payment.from_name}
                    width={32}
                    height={32}
                    unoptimized
                    className="w-8 h-8 rounded-full bg-background object-cover"
                  />
                  <div>
                    <p className="font-medium text-text-primary text-[15px] truncate max-w-[80px] sm:max-w-none leading-[1.4]">
                      {payment.from_name}
                    </p>
                    <span className="text-[11px] text-warning font-medium uppercase tracking-wider">pays</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-text-secondary">
                  <ArrowRight className="w-4 h-4" />
                </div>

                {/* Creditor */}
                <div className="flex items-center gap-2 text-left">
                  <Image 
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${payment.to_name}`} 
                    alt={payment.to_name}
                    width={32}
                    height={32}
                    unoptimized
                    className="w-8 h-8 rounded-full bg-background object-cover"
                  />
                  <div>
                    <p className="font-medium text-text-primary text-[15px] truncate max-w-[80px] sm:max-w-none leading-[1.4]">
                      {payment.to_name}
                    </p>
                    <span className="text-[11px] text-success font-medium uppercase tracking-wider">receives</span>
                  </div>
                </div>
              </div>

              {/* Amount & Settle trigger */}
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="font-semibold text-text-primary text-[15px] block leading-[1.4]">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
                {!isSelected && (
                  <button 
                    onClick={() => setSettlingPaymentId(paymentKey)}
                    className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors shadow-subtle active:scale-95"
                  >
                    Mark as Paid
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Confirmation Inputs */}
            {isSelected && (
              <div className="mt-4 pt-4 border-t border-border-subtle animate-in fade-in duration-200 text-left">
                <p className="text-[13px] text-text-secondary mb-3 leading-[1.4]">
                  Are you sure you want to log a payment of <strong className="text-primary font-medium">{formatCurrency(payment.amount)}</strong> from <strong>{payment.from_name}</strong> to <strong>{payment.to_name}</strong>?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    placeholder="Add a settlement note (optional)..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={loading}
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex gap-2 self-end sm:self-auto">
                    <button 
                      onClick={() => setSettlingPaymentId(null)}
                      disabled={loading}
                      className="px-3 py-2 rounded-lg bg-surface border border-border text-[13px] font-medium text-text-secondary hover:bg-background transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleRecordSettlement(payment)}
                      disabled={loading}
                      className="bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors shadow-subtle active:scale-95"
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
