// components/ui/Modal.tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Close on Escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-text-primary/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full sm:max-w-lg bg-surface rounded-t-xl sm:rounded-xl shadow-subtle z-10 border border-border flex flex-col max-h-[90vh] sm:max-h-[85vh] transition-all transform duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h3 className="text-[17px] font-semibold text-text-primary leading-[1.2]">
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-background text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-text-primary">
          {children}
        </div>
      </div>
    </div>
  );
}
