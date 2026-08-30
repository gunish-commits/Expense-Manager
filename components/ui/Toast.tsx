// components/ui/Toast.tsx
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-20 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto z-50 flex flex-col gap-2 max-w-md w-auto">
        {toasts.map(t => (
          <div 
            key={t.id}
            className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border animate-in slide-in-from-bottom duration-200 backdrop-blur-md bg-white/95 dark:bg-slate-900/95 ${
              t.type === 'success' 
                ? 'border-emerald-500/20 text-emerald-900 dark:text-emerald-300' 
                : t.type === 'error'
                  ? 'border-rose-500/20 text-rose-900 dark:text-rose-300'
                  : 'border-blue-500/20 text-blue-900 dark:text-blue-300'
            }`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
            </div>

            {/* Message */}
            <p className="text-sm font-medium pr-6 flex-1 text-slate-800 dark:text-slate-100">
              {t.message}
            </p>

            {/* Close Button */}
            <button 
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
