'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Plus,
  BookOpen,
  FileSpreadsheet,
  RefreshCw,
  UserCheck,
  LogOut,
  ClipboardList,
  Users,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { ShiftRecord } from '@/types';
import type { SyncStatus } from '@/hooks/useRealtimeWorkboard';

type Tab = 'board' | 'handover' | 'dossier' | 'crew';

interface TopHeaderProps {
  activeShift: ShiftRecord | null;
  syncStatus: SyncStatus;
  activeFitter: string;
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  shiftJobsCount: number;
  userRole: 'management' | 'fitter';
  onOpenAssign: () => void;
  onRefresh: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeShift,
  syncStatus,
  activeFitter,
  currentTab,
  onTabChange,
  shiftJobsCount,
  userRole,
  onOpenAssign,
  onRefresh,
}) => {
  const router = useRouter();
  const supabase = createClient();
  const { confirm } = useFeedback();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    const ok = await confirm({
      title: 'Sign out?',
      message: `${activeFitter || 'You'} will be signed out of this computer.`,
      confirmLabel: 'Yes, sign out',
      tone: 'danger',
    });
    if (!ok) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out failed:', error.message);
    router.replace('/login');
    router.refresh();
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: 'board', label: `Workboard (${shiftJobsCount})`, icon: <ClipboardList className="w-4 h-4" />, show: true },
    { id: 'dossier', label: 'Fleet Directory', icon: <BookOpen className="w-4 h-4" />, show: true },
    { id: 'handover', label: 'Shift Handover', icon: <FileSpreadsheet className="w-4 h-4" />, show: userRole === 'management' },
    { id: 'crew', label: 'Crew', icon: <Users className="w-4 h-4" />, show: userRole === 'management' },
  ];

  return (
    <header className="space-y-4 pb-5 border-b border-slate-300 print:hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
            <Wrench className="w-6 h-6" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">MINE SHIFT WORKBOARD</h1>
            <span className="text-sm font-black px-2 py-0.5 rounded bg-slate-300 text-slate-800 border border-slate-400 uppercase">
              {activeShift?.shift_name || 'Active Shift'}
            </span>
            <SyncStatusBadge status={syncStatus} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="min-h-11 flex items-center gap-2 bg-white border border-slate-300 px-3 rounded-xl text-sm">
            <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-slate-500">Signed in as</span>
            <strong
              className="text-slate-900"
              title="Your name is stamped on every note and sign-off you make"
            >
              {activeFitter || '...'}
            </strong>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="min-h-11 flex items-center gap-1.5 px-4 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-600 text-sm font-bold rounded-xl transition disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" /> {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <nav className="bg-white border border-slate-300 p-1 rounded-xl flex flex-wrap items-center gap-1 shadow-2xs" aria-label="Sections">
          {tabs
            .filter((t) => t.show)
            .map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={currentTab === tab.id ? 'page' : undefined}
                className={`min-h-11 px-4 text-sm font-bold rounded-lg transition flex items-center gap-2 ${
                  currentTab === tab.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-12 flex items-center gap-1.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-bold rounded-xl transition shadow-2xs"
            title="Reload the latest data"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            type="button"
            onClick={onOpenAssign}
            className="min-h-12 flex items-center gap-2 px-5 bg-emerald-600 hover:bg-emerald-500 text-white text-base font-black rounded-xl shadow-md transition"
          >
            <Plus className="w-5 h-5" /> Assign Machine
          </button>
        </div>
      </div>
    </header>
  );
};
