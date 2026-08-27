'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, Bell, User, LogOut, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

interface HeaderProps {
  isCollapsed: boolean;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isCollapsed,
  onRefreshData,
  isRefreshing = false,
}) => {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 transition-all duration-200 flex items-center justify-between px-6 ${
        isCollapsed ? 'left-16' : 'left-60'
      }`}
    >
      {/* Search Input */}
      <div className="relative w-64">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search trips, drivers, plates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs glass-input focus:outline-none"
        />
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Auto-Sync'}</span>
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 rounded-xl p-3 border border-slate-800 shadow-xl z-50 text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 font-semibold text-slate-200">
                <span>System Notifications</span>
                <span className="text-[10px] text-blue-400 cursor-pointer">Clear</span>
              </div>
              <div className="space-y-2">
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px]">
                  <div className="font-semibold text-slate-200">Fuel Level Drop Detected</div>
                  <div className="text-slate-400">MH-12-PQ-8890 lost 45.5L fuel at NH-48.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30 uppercase">
              {user.username.substring(0, 2)}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-slate-200 leading-tight">
                {user.username}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                {user.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/40 transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="pl-3 border-l border-slate-800">
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
