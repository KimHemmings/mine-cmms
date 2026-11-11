'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  BookOpen,
  FileSpreadsheet,
  UserCheck,
  LogOut,
  ClipboardList,
  Users,
  GraduationCap,
  Factory,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { HelpButton } from '@/components/help/HelpButton';
import { ChangePasswordButton } from '@/components/auth/ChangePasswordButton';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { CrewMember, ShiftRecord, UserRole } from '@/types';
import type { SyncStatus } from '@/hooks/useRealtimeWorkboard';

type Tab = 'board' | 'handover' | 'dossier' | 'crew' | 'training' | 'status';

const ROLE_LABEL: Record<UserRole, string> = {
  fitter: 'Fitter',
  management: 'Supervisor',
  training: 'Training',
  production: 'Production',
};

interface TopHeaderProps {
  activeShift: ShiftRecord | null;
  syncStatus: SyncStatus;
  pendingStages?: number;
  activeFitter: string;
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  shiftJobsCount: number;
  userRole: UserRole;
  onOpenAssign: () => void;
  onRefresh: () => void;
  crewAttention?: number;
  fleetChoices?: string[];
  myCrewMemberId?: string | null;
  crew?: CrewMember[];
  onLinkCrew?: (crewMemberId: string) => void;
}

function screenTitle(role: UserRole, tab: Tab) {
  if (role === 'training') return 'Training';
  if (role === 'production') return tab === 'handover' ? 'Shift handover' : 'Production whiteboard';
  if (tab === 'dossier') return 'Fleet directory';
  if (tab === 'handover') return 'Shift handover';
  if (tab === 'crew') return 'Crew';
  return 'Workshop whiteboard';
}

function workshopPeople(crew: CrewMember[]) {
  return crew.filter((member) => member.active && member.department !== 'Production' && member.trade !== 'Operator');
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeShift,
  syncStatus,
  pendingStages = 0,
  activeFitter,
  currentTab,
  onTabChange,
  shiftJobsCount,
  userRole,
  onOpenAssign,
  onRefresh,
  crewAttention = 0,
  fleetChoices = [],
  myCrewMemberId = null,
  crew = [],
  onLinkCrew,
}) => {
  const router = useRouter();
  const supabase = createClient();
  const { confirm } = useFeedback();
  const [signingOut, setSigningOut] = useState(false);
  const people = workshopPeople(crew);
  const linked = myCrewMemberId;

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
    { id: 'status', label: 'Whiteboard', icon: <Factory className="w-4 h-4" />, show: userRole === 'production' },
    { id: 'board', label: `Whiteboard (${shiftJobsCount})`, icon: <ClipboardList className="w-4 h-4" />, show: userRole === 'fitter' || userRole === 'management' },
    { id: 'dossier', label: 'Fleet directory', icon: <BookOpen className="w-4 h-4" />, show: userRole === 'fitter' || userRole === 'management' },
    { id: 'handover', label: 'Shift handover', icon: <FileSpreadsheet className="w-4 h-4" />, show: userRole === 'management' || userRole === 'production' },
    { id: 'crew', label: crewAttention > 0 ? `Crew (${crewAttention})` : 'Crew', icon: <Users className="w-4 h-4" />, show: userRole === 'management' },
    { id: 'training', label: 'Training', icon: <GraduationCap className="w-4 h-4" />, show: userRole === 'training' },
  ];

  const showAssign = currentTab === 'board' && (userRole === 'fitter' || userRole === 'management');

  return (
    <header className="space-y-3 pb-4 border-b border-slate-300 print:hidden">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{screenTitle(userRole, currentTab)}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-black uppercase tracking-wide text-slate-800">{ROLE_LABEL[userRole]}</span>
            <strong className="text-slate-900" title="Your name is stamped on every note and sign-off you make">
              {activeFitter || '...'}
            </strong>
            {userRole === 'fitter' && onLinkCrew && linked && (
              <label className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
                <UserCheck className="w-3.5 h-3.5" />
                <span className="sr-only">Change the person My jobs follows</span>
                <select
                  value={linked}
                  onChange={(event) => {
                    if (event.target.value) onLinkCrew(event.target.value);
                  }}
                  className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-900"
                  aria-label="Change the person My jobs follows"
                >
                  {people.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name}{member.panel ? ` · ${member.panel}` : ''}
                    </option>
                  ))}
                  {!people.some((member) => member.id === linked) && (
                    <option value={linked}>{activeFitter}</option>
                  )}
                </select>
              </label>
            )}
            <span className="text-slate-500">
              {activeShift?.shift_name || 'No active shift'}
              {activeShift?.crew ? ` · ${activeShift.crew}` : ''}
            </span>
            <SyncStatusBadge status={syncStatus} pending={pendingStages} onRefresh={onRefresh} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ChangePasswordButton />
          <HelpButton userRole={userRole} shiftId={activeShift?.id ?? null} fleetChoices={fleetChoices} />
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="min-h-11 flex items-center gap-1.5 px-4 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-600 text-sm font-bold rounded-xl transition disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" /> {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <nav className="bg-white border border-slate-300 p-1 rounded-xl flex flex-wrap items-center gap-1" aria-label="Sections">
          {tabs
            .filter((tab) => tab.show)
            .map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={currentTab === tab.id ? 'page' : undefined}
                className={`min-h-11 px-4 text-sm font-bold rounded-lg transition flex items-center gap-2 ${
                  currentTab === tab.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
        </nav>

        {showAssign && (
          <button
            type="button"
            onClick={onOpenAssign}
            className="min-h-11 flex items-center gap-2 px-4 bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-800 text-sm font-bold rounded-xl"
          >
            <Plus className="w-4 h-4" /> Assign machine
          </button>
        )}
      </div>
    </header>
  );
};
