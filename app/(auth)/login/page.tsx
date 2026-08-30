// app/(auth)/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Sparkles, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

export default function Login() {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        let msg = error.message;
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          msg = 'Incorrect email or password. Please try again.';
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          msg = 'Your email address is not verified yet. Please check your inbox for the verification link.';
        }
        showToast(msg, 'error');
      } else {
        showToast('Logged in successfully!', 'success');
        localStorage.removeItem('guest_mode'); // Disable guest mode
        router.push('/dashboard');
      }
    } catch (e: any) {
      showToast(e.message || 'An unexpected error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      showToast('Please enter your email to request a magic link', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + '/dashboard'
        }
      });

      if (error) {
        showToast(error.message, 'error');
      } else {
        setMagicLinkSent(true);
        showToast('Magic link sent to your email!', 'success');
      }
    } catch (e: any) {
      showToast(e.message || 'An unexpected error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem('guest_mode', 'true');
    const guestUser = {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Guest Explorer',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest',
      email: 'guest@example.com'
    };
    localStorage.setItem('guest_user', JSON.stringify(guestUser));
    showToast('Entered Guest Sandbox Mode (Offline)', 'info');
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-slate-50 dark:bg-slate-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Logo */}
        <div className="inline-flex bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white p-3.5 rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none mb-4">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Welcome to SplitAdvanced
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Advanced expense management with offline sync
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-6">
          
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-100 dark:shadow-none hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-bold">Or</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Magic Link */}
            <button
              onClick={handleMagicLink}
              disabled={loading || magicLinkSent}
              className="w-full py-2.5 px-4 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {magicLinkSent ? 'Magic Link Sent' : 'Send Magic Link Email'}
            </button>

            {/* Guest Sandbox Mode */}
            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl text-xs font-black hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Continue as Guest (No Login Required)
            </button>
          </div>

          <div className="text-center text-xs">
            <span className="text-slate-400">Don't have an account? </span>
            <Link 
              href="/signup" 
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
            >
              Create one now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
