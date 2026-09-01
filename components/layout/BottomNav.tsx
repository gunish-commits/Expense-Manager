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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border px-2 py-1 max-w-5xl mx-auto">
      <div className="flex items-center justify-around w-full relative">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href) && !item.isAction;

          if (item.isAction) {
            return (
              <button 
                key={item.href}
                onClick={handleAddClick}
                className="relative -top-3.5 bg-primary hover:bg-primary-hover text-white w-11 h-11 rounded-full flex items-center justify-center shadow-subtle transition-all active:scale-95 border-4 border-background"
                title="Add Expense"
              >
                <Plus className="w-5 h-5 stroke-[2.5px]" />
              </button>
            );
          }

          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 transition-colors duration-150 gap-0.5 ${
                isActive 
                  ? 'text-primary font-medium' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2px]' : 'stroke-[1.8px]'}`} />
              <span className="text-[11px] tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
