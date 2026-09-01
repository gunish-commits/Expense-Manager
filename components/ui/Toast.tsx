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
            className={`flex items-start gap-3 p-3.5 rounded-xl shadow-subtle border animate-in slide-in-from-bottom duration-200 bg-surface ${
              t.type === 'success' 
                ? 'border-success/30' 
                : t.type === 'error'
                  ? 'border-danger/30'
                  : 'border-primary/30'
            }`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle className="w-4.5 h-4.5 text-success" />}
              {t.type === 'error' && <AlertCircle className="w-4.5 h-4.5 text-danger" />}
              {t.type === 'info' && <Info className="w-4.5 h-4.5 text-primary" />}
            </div>

            {/* Message */}
            <p className="text-[13px] font-normal leading-[1.4] pr-4 flex-1 text-text-primary">
              {t.message}
            </p>

            {/* Close Button */}
            <button 
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 p-1 rounded-full hover:bg-background text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
