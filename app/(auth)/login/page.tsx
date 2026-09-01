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
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Logo */}
        <div className="inline-flex bg-primary-light text-primary p-3.5 rounded-full mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h1 className="text-[22px] font-semibold text-text-primary leading-[1.2]">
          Welcome to Expense Manager
        </h1>
        <p className="mt-1 text-[13px] text-text-secondary leading-[1.4]">
          Advanced expense management with offline sync
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-6 shadow-subtle rounded-xl border border-border space-y-6">
          
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-[13px] font-normal text-text-secondary mb-1.5 text-left">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-secondary">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="block w-full pl-10 pr-3 py-2.5 bg-surface border border-border rounded-lg text-[15px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-normal text-text-secondary mb-1.5 text-left">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-secondary">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="block w-full pl-10 pr-3 py-2.5 bg-surface border border-border rounded-lg text-[15px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg text-[15px] font-medium shadow-subtle transition-colors focus:outline-none disabled:opacity-50 active:scale-95"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle" />
            </div>
            <div className="relative flex justify-center text-[13px]">
              <span className="bg-surface px-3 text-text-secondary font-normal">Or</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Magic Link */}
            <button
              onClick={handleMagicLink}
              disabled={loading || magicLinkSent}
              className="w-full py-2.5 px-4 border border-border text-text-primary rounded-lg text-[13px] font-medium hover:bg-background transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-subtle"
            >
              <Send className="w-3.5 h-3.5" />
              {magicLinkSent ? 'Magic Link Sent' : 'Send Magic Link Email'}
            </button>

            {/* Guest Sandbox Mode */}
            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-surface text-primary border border-primary rounded-lg text-[13px] font-medium hover:bg-primary-light transition-colors flex items-center justify-center gap-2 shadow-subtle"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Continue as Guest (No Login Required)
            </button>
          </div>

          <div className="text-center text-[13px]">
            <span className="text-text-secondary">Don't have an account? </span>
            <Link 
              href="/signup" 
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Create one now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
