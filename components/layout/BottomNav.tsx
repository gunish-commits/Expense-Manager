// components/layout/BottomNav.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, HeartHandshake, User, Plus } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Groups', href: '/groups', icon: Users },
    { label: 'Add', href: '#add', icon: Plus, isAction: true },
    { label: 'Dues', href: '/dues', icon: HeartHandshake },
    { label: 'Me', href: '/personal', icon: User },
  ];

  // Don't show bottom nav on login/signup page or root landing
  if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
    return null;
  }

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new Event('open-global-expense-modal'));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-955/95 backdrop-blur-lg border-t border-border-custom px-2 py-1 max-w-5xl mx-auto">
      <div className="flex items-center justify-around w-full relative">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href) && !item.isAction;

          if (item.isAction) {
            return (
              <button 
                key={item.href}
                onClick={handleAddClick}
                className="relative -top-3.5 bg-primary hover:bg-primary-light text-white w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 hover:scale-105 border-4 border-background"
                title="Add Expense"
              >
                <Plus className="w-5.5 h-5.5 stroke-[3px]" />
              </button>
            );
          }

          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-0.5 px-3 rounded-xl transition-all duration-200 gap-0.5 ${
                isActive 
                  ? 'text-primary font-extrabold scale-105' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 transition-transform duration-200 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
              <span className="text-[9px] tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
