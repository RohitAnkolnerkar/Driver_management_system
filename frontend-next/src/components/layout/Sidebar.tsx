'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Truck,
  Users,
  ShieldAlert,
  Fuel,
  FileCheck,
  CreditCard,
  Wrench,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard Overview', href: '/', icon: LayoutDashboard },
    { name: 'Trips & Dispatch', href: '/trips', icon: Truck },
    { name: 'Drivers & Payroll', href: '/drivers', icon: Users },
    { name: 'Fleet & FASTag', href: '/vehicles', icon: ShieldAlert },
    { name: 'Fuel & Theft Audit', href: '/fuel', icon: Fuel },
    { name: 'POD & OCR Center', href: '/pod', icon: FileCheck },
    { name: 'Finance & Payments', href: '/finance', icon: CreditCard },
    { name: 'Maintenance & ESG', href: '/maintenance', icon: Wrench },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-slate-900 border-r border-slate-800 transition-all duration-200 flex flex-col ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 font-bold text-sm">
            <Truck className="w-4 h-4 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-slate-100 text-sm leading-tight tracking-tight">
                DriverHub
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Enterprise OS</span>
            </div>
          )}
        </Link>

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      {!isCollapsed && (
        <div className="p-3 m-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">FastAPI API</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
