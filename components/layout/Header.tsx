// components/layout/Header.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Bell, LogOut, User, Sparkles, WifiOff, RefreshCw, Wallet } from 'lucide-react';
import { isGuestMode, getGuestUser, supabase } from '@/lib/supabase/client';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '@/lib/supabase/notifications';
import { addMemberToGroup } from '@/lib/supabase/groups';
import { processDueRecurringExpenses } from '@/lib/supabase/recurring';
import { Notification } from '@/types';
import { useToast } from '../ui/Toast';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  
  const [isGuest, setIsGuest] = useState(false);
  const [userName, setUserName] = useState('User');
  const [userAvatar, setUserAvatar] = useState('');
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [processingRecur, setProcessingRecur] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setIsGuest(isGuestMode());
    if (isGuestMode()) {
      const gu = getGuestUser();
      setUserName(gu.name);
      setUserAvatar(gu.avatar_url);
    } else {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setUserName(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User');
          setUserAvatar(user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`);
        }
      });
    }
  }, [pathname]);

  // Load and subscribe to notifications
  const loadNotifications = async () => {
    try {
      const list = await getNotifications();
      setNotifications(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (pathname === '/login' || pathname === '/signup' || pathname === '/') return;
    
    loadNotifications();

    if (!isGuestMode()) {
      // Subscribe to Postgres Changes in notifications
      const channel = supabase
        .channel('realtime-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        }, () => {
          loadNotifications();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // In Guest Mode, check local storage updates periodically
      const interval = setInterval(() => {
        loadNotifications();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [pathname]);

  // Run recurring expense check on first load of dashboard
  useEffect(() => {
    if (pathname === '/dashboard') {
      setProcessingRecur(true);
      processDueRecurringExpenses()
        .then(count => {
          if (count > 0) {
            showToast(`Automatically generated ${count} recurring expense entries!`, 'success');
            loadNotifications();
          }
        })
        .catch(console.error)
        .finally(() => setProcessingRecur(false));
    }
  }, [pathname]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      showToast('All notifications marked as read', 'success');
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptInvite = async (notif: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notif.related_group_id) return;
    try {
      let userId = '';
      if (isGuestMode()) {
        userId = getGuestUser().id;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user.id || '';
      }

      if (!userId) {
        showToast('You must be logged in to accept invites', 'error');
        return;
      }

      await addMemberToGroup(notif.related_group_id, userId);
      await deleteNotification(notif.id);
      showToast('Successfully joined group!', 'success');
      loadNotifications();
      window.dispatchEvent(new Event('refresh-dashboard-data'));
    } catch (err: any) {
      showToast(err.message || 'Error joining group', 'error');
    }
  };

  const handleDeclineInvite = async (notif: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotification(notif.id);
      showToast('Invitation declined', 'success');
      loadNotifications();
    } catch (err: any) {
      showToast(err.message || 'Error declining invite', 'error');
    }
  };

  const handleLogout = async () => {
    if (isGuestMode()) {
      localStorage.removeItem('guest_mode');
      showToast('Logged out of Guest Mode', 'success');
      router.push('/login');
    } else {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast('Logged out successfully', 'success');
        router.push('/login');
      }
    }
  };

  // Don't show header on login/signup page or landing
  if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
    return null;
  }

  return (
    <>
      {/* Banner for Guest Mode / Offline */}
      {isGuest && (
        <div className="bg-indigo-600 text-white text-center py-1.5 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-inner sticky top-0 z-50">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Running in Guest Sandbox Mode (Offline). All data is saved on this device.</span>
        </div>
      )}

      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 h-16 sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="bg-primary text-white p-2 rounded-xl shadow-md">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-base sm:text-lg tracking-tight text-primary">
            Expense Manager
          </span>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifPopover(!showNotifPopover);
                setShowProfileMenu(false);
              }}
              className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 bg-rose-500 text-white font-bold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Popover */}
            {showNotifPopover && (
              <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-slate-950 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/60 z-50 flex flex-col max-h-[480px]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Activity</h4>
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 flex-1">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No activity yet
                    </div>
                  ) : (
                    notifications.map(notif => {
                      const isInvite = notif.type === 'group_invite';
                      return (
                        <div 
                          key={notif.id} 
                          className={`p-3.5 text-xs flex gap-3 items-start transition-colors ${
                            notif.read ? 'opacity-70' : 'bg-emerald-50/10 dark:bg-emerald-950/5'
                          }`}
                          onClick={() => !isInvite && handleMarkSingleRead(notif.id)}
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isInvite ? 'bg-[#1F6E5C]' : 'bg-slate-400'} opacity-80`} />
                          <div className="flex-1 text-left">
                            <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-semibold">
                              {notif.message}
                            </p>
                            
                            {isInvite && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={(e) => handleAcceptInvite(notif, e)}
                                  className="bg-[#1F6E5C] hover:bg-[#2B9B82] text-white px-3 py-1.5 rounded-xl font-bold text-[10px] active:scale-95 transition-all shadow-sm"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={(e) => handleDeclineInvite(notif, e)}
                                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 px-3 py-1.5 rounded-xl font-bold text-[10px] active:scale-95 transition-all"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                            
                            <span className="text-[10px] text-slate-400 mt-1.5 block">
                              {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Settings Dropdown */}
          <div className="relative flex items-center" ref={profileRef}>
            <button 
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifPopover(false);
              }}
              className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-all hover:scale-105 flex items-center justify-center border border-slate-200 dark:border-slate-800"
            >
              <Image 
                src={userAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=User'} 
                alt={userName}
                width={28}
                height={28}
                unoptimized={userAvatar?.startsWith('data:')}
                className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 object-cover"
              />
            </button>

            {/* Profile Dropdown popover */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2.5 w-56 bg-white dark:bg-slate-950 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/60 z-50 py-2">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{userName}</p>
                </div>

                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
