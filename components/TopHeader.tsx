'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Plus,
  BookOpen,
  FileSpreadsheet,
  RefreshCw,
  UserCheck,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { ShiftRecord } from '@/types';

interface TopHeaderProps {
  activeShift: ShiftRecord | null;
  syncStatus: any;
  activeFitter: string;
  onUpdateFitter: (name: string) => void;
  currentTab: 'board' | 'handover' | 'dossier';
  onTabChange: (tab: 'board' | 'handover' | 'dossier') => void;
  shiftJobsCount: number;
  userRole: 'management' | 'fitter';
  onOpenAssign: () => void;
  onRefresh: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeShift,
  syncStatus,
  activeFitter,
  onUpdateFitter,
  currentTab,
  onTabChange,
  shiftJobsCount,
  userRole,
  onOpenAssign,
  onRefresh,
}) => {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-300 gap-4 print:hidden">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
          <Wrench className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
              MINE SHIFT WORKBOARD
            </h1>
            <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-300 text-slate-800 border border-slate-400 uppercase">
              {activeShift?.shift_name || 'Active Shift'}
            </span>
            <SyncStatusBadge status={syncStatus} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            High-contrast crib room & field workstation • SAP Work Orders & Defect Tracking
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-3 py-1.5 rounded-xl shadow-2xs text-xs">
          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold text-slate-500 text-[11px] uppercase">Fitter on Duty:</span>
          <input
            type="text"
            value={activeFitter}
            onChange={(e) => onUpdateFitter(e.target.value)}
            placeholder="e.g. D. Kelly (#4821)"
            className="font-bold text-slate-900 focus:outline-none w-36 bg-transparent"
            title="Your Name & ID will stamp on all progressive notes and sign-offs"
          />
        </div>

        <div className="bg-white border border-slate-300 p-1 rounded-xl flex items-center shadow-2xs">
          <button
            type="button"
            onClick={() => onTabChange('board')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              currentTab === 'board' ? 'bg-slate-200 text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Shift Work ({shiftJobsCount})
          </button>
          <button
            type="button"
            onClick={() => onTabChange('dossier')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              currentTab === 'dossier' ? 'bg-slate-200 text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Fleet Directory
          </button>
          {userRole === 'management' && (
            <button
              type="button"
              onClick={() => onTabChange('handover')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                currentTab === 'handover' ? 'bg-slate-200 text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Shift Handover
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenAssign}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Assign Machine
        </button>

        <button
          type="button"
          onClick={onRefresh}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl transition shadow-2xs"
          title="Refresh All Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="p-2.5 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-600 rounded-xl transition shadow-2xs"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};