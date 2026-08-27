'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Truck, Lock, User, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(username, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = (demoUser: string, demoRole: string) => {
    setUsername(demoUser);
    setPassword('admin123');
    login(demoUser, 'admin123').then(() => {
      router.push('/');
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Logo Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-bold shadow-lg mb-2">
            <Truck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Sign in to DriverHub</h1>
          <p className="text-xs text-slate-400">Enterprise Fleet Management & Logistics Operating System</p>
        </div>

        {/* Login Card Form */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" /> Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-2.5 rounded-lg glass-input text-xs"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-400" /> Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2.5 rounded-lg glass-input text-xs"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-blue-500/20"
            >
              {isLoading ? 'Signing in...' : 'Sign In'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block text-center">
              Quick Demo One-Click Sign In
            </span>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <button
                onClick={() => handleQuickDemo('admin', 'admin')}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium text-center"
              >
                Admin
              </button>
              <button
                onClick={() => handleQuickDemo('dispatcher1', 'dispatcher')}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium text-center"
              >
                Dispatcher
              </button>
              <button
                onClick={() => handleQuickDemo('rajesh_kumar', 'driver')}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium text-center"
              >
                Driver
              </button>
            </div>
          </div>
        </div>

        {/* Link to Register */}
        <div className="text-center text-xs text-slate-400">
          Don't have an account yet?{' '}
          <Link href="/register" className="text-blue-400 font-semibold hover:underline">
            Register new account
          </Link>
        </div>
      </div>
    </div>
  );
}
