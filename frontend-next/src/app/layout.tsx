'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AuthProvider } from '@/lib/AuthContext';

function AppContent({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (isAuthPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      <div
        className={`flex-1 transition-all duration-200 ${
          isCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        <Header isCollapsed={isCollapsed} />

        <main className="pt-18 px-6 pb-12 min-h-screen max-w-7xl mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>DriverHub Enterprise | Next.js Fleet Operating System</title>
        <meta
          name="description"
          content="Production-grade Fleet Management & Logistics Operating System built with Next.js & FastAPI."
        />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen selection:bg-blue-500 selection:text-white">
        <AuthProvider>
          <AppContent>{children}</AppContent>
        </AuthProvider>
      </body>
    </html>
  );
}
