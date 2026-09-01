// app/(auth)/signup/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

export default function Signup() {
  const router = useRouter();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            name: fullName,
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${fullName}`
          }
        }
      });

      if (error) {
        showToast(error.message, 'error');
      } else if (data.session) {
        showToast('Registration successful! You have been logged in automatically.', 'success');
        localStorage.removeItem('guest_mode');
        router.push('/dashboard');
      } else {
        showToast('Registration successful! Please check your email inbox to confirm your account.', 'info');
        router.push('/login');
      }
    } catch (e: any) {
      showToast(e.message || 'An unexpected error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex bg-primary-light text-primary p-3.5 rounded-full mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h1 className="text-[22px] font-semibold text-text-primary leading-[1.2]">
          Create an Account
        </h1>
        <p className="mt-1 text-[13px] text-text-secondary leading-[1.4]">
          Sync your expenses across all devices
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-6 shadow-subtle rounded-xl border border-border space-y-6">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-[13px] font-normal text-text-secondary mb-1.5 text-left">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-secondary">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  className="block w-full pl-10 pr-3 py-2.5 bg-surface border border-border rounded-lg text-[15px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

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
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="text-center text-[13px]">
            <span className="text-text-secondary">Already have an account? </span>
            <Link 
              href="/login" 
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
