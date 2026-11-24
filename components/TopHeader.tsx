'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { HelpButton } from '@/components/help/HelpButton';
import { ChangePasswordButton } from '@/components/auth/ChangePasswordButton';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { CREW_PANELS, CrewMember, ShiftRecord, UserRole } from '@/types';
import ShiftChatDrawer from '@/components/ShiftChatDrawer';
import { Permissions, isWorkshopRoster, type Department } from '@/utils/permissions';
import { getShiftClock, type ShiftClock } from '@/utils/shiftClock';
import { formatStartDay, shiftIsPast } from '@/utils/crewStanding';
import type { SyncStatus } from '@/hooks/useRealtimeWorkboard';
import { useSiteBrand } from '@/components/SiteBrand';

type Tab = 'management' | 'board' | 'handover' | 'dossier' | 'crew' | 'training' | 'status';

interface TopHeaderProps {
  activeShift: ShiftRecord | null;
  syncStatus: SyncStatus;
  pendingStages?: number;
  activeFitter: string;
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  shiftJobsCount: number;
  userRole: UserRole;
  permissions: Permissions;
  onOpenAssign: () => void;
  onRefresh: () => void;
  crewAttention?: number;
  fleetChoices?: string[];
  myCrewMemberId?: string | null;
  crew?: CrewMember[];
  onLinkCrew?: (crewMemberId: string) => void;
  onSetShiftCrew?: (panel: string) => void;
  profileId?: string | null;
  lensDepartment?: Department | null;
}

function screenTitle(tab: Tab, department: Department, siteCommand = false, lens = false) {
  if (tab === 'management') return siteCommand ? 'Site Command' : 'Management & Gaps';
  if (lens && tab === 'board' && department === 'workshop') return 'Workshop whiteboard';
  if (lens && tab === 'board' && department === 'production') return 'Pit Fleet & ETAs';
  if (lens && tab === 'board' && department === 'training') return 'Operator Pass-Outs';
  if (lens && tab === 'handover' && department === 'workshop') return 'Maintenance Shift Handover';
  if (lens && tab === 'handover' && department === 'production') return 'Pit Shift Handover';
  if (lens && tab === 'handover' && department === 'training') return 'Operator Pass-Outs';
  if (lens && tab === 'crew' && department === 'workshop') return 'Trades Roster';
  if (lens && tab === 'crew' && department === 'production') return 'Operator Allocations';
  if (lens && tab === 'crew' && department === 'training') return 'Operator Pass-Outs';
  if (tab === 'training') return 'Training';
  if (tab === 'status') return 'Production whiteboard';
  if (tab === 'board' && siteCommand) return 'Whiteboard';
  if (tab === 'board' && department === 'production') return 'Down Fleet & ETAs';
  if (tab === 'dossier') return 'Fleet directory';
  if (tab === 'handover') return 'Shift handover';
  if (tab === 'crew') return department === 'training' ? 'Competencies' : 'Crew';
  return 'Workshop whiteboard';
}

function crewTabLabel(department: Department, accessLevel: number, count: number) {
  const name = department === 'training' ? 'Competencies' : 'Crew';
  if (accessLevel >= 4 || count <= 0) return name;
  return `${name} (${count})`;
}

function workshopPeople(crew: CrewMember[]) {
  return crew.filter((member) => member.active && isWorkshopRoster(member));
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
  permissions,
  onOpenAssign,
  onRefresh,
  crewAttention = 0,
  fleetChoices = [],
  myCrewMemberId = null,
  crew = [],
  onLinkCrew,
  onSetShiftCrew,
  profileId = null,
  lensDepartment = null,
}) => {
  const { name: siteName } = useSiteBrand();
  const router = useRouter();
  const supabase = createClient();
  const { confirm } = useFeedback();
  const [signingOut, setSigningOut] = useState(false);
  const [clock, setClock] = useState<ShiftClock | null>(null);

  useEffect(() => {
    const tick = () => setClock(getShiftClock());
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);
  const people = workshopPeople(crew);
  const linked = myCrewMemberId;
  const workshopCrew = permissions.department === 'workshop' && permissions.accessLevel === 2;
  const workshopDesk = permissions.department === 'workshop' && (permissions.accessLevel === 3 || permissions.accessLevel === 4);

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
    { id: 'management', label: 'Site Command', icon: <ClipboardList className="w-4 h-4" />, show: permissions.canViewManagementDashboard },
    { id: 'board', label: `Whiteboard (${shiftJobsCount})`, icon: <ClipboardList className="w-4 h-4" />, show: permissions.canViewWhiteboard },
    { id: 'dossier', label: 'Fleet directory', icon: <BookOpen className="w-4 h-4" />, show: permissions.canViewFleetDirectory },
    { id: 'handover', label: 'Shift handover', icon: <FileSpreadsheet className="w-4 h-4" />, show: permissions.canViewHandover },
    { id: 'crew', label: crewTabLabel(permissions.department, permissions.accessLevel, crewAttention), icon: <Users className="w-4 h-4" />, show: permissions.canViewCrew },
    { id: 'training', label: 'Training', icon: <GraduationCap className="w-4 h-4" />, show: permissions.department === 'training' },
  ];

  const showAssign = permissions.accessLevel < 4 && permissions.canAssignMachine && (currentTab === 'board' || currentTab === 'dossier' || currentTab === 'status');

  return (
    <header className="space-y-3 pb-4 border-b border-slate-300 print:hidden">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{screenTitle(currentTab, lensDepartment ?? permissions.department, permissions.canViewManagementDashboard, Boolean(lensDepartment))}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-black text-slate-900">{siteName}</span>
            <span className={permissions.isSiteExecutive
              ? 'inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-black tracking-wide text-amber-300'
              : 'font-black uppercase tracking-wide text-slate-800'}>
              {permissions.badge}
            </span>
            <strong className="text-slate-900" title="Your name is stamped on every note and sign-off you make">
              {activeFitter || '...'}
            </strong>
            {workshopCrew && onLinkCrew && linked && (
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
            {clock && (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-900">
                {clock.shiftName}
                <span className="font-bold text-slate-600">{clock.timeRemaining}</span>
              </span>
            )}
            {permissions.accessLevel < 4 && permissions.canViewHandover && permissions.department !== 'production' && onSetShiftCrew ? (
              <label className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
                <span className="sr-only">Active crew</span>
                <select
                  value={activeShift?.crew ?? ''}
                  onChange={(event) => {
                    if (event.target.value) onSetShiftCrew(event.target.value);
                  }}
                  className="min-h-9 rounded-full border border-slate-300 bg-white px-3 text-xs font-black text-slate-900"
                  aria-label="Active crew"
                >
                  {!activeShift?.crew && <option value="">Active crew</option>}
                  {CREW_PANELS.map((panel) => (
                    <option key={panel} value={panel}>{panel}</option>
                  ))}
                  {activeShift?.crew && !(CREW_PANELS as readonly string[]).includes(activeShift.crew) && (
                    <option value={activeShift.crew}>{activeShift.crew}</option>
                  )}
                </select>
              </label>
            ) : (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                {activeShift?.crew || 'No crew'}
              </span>
            )}
            <span className="text-slate-500">
              {permissions.department === 'training'
                ? 'All crews'
                : (
                  <>
                    {activeShift?.shift_date ? formatStartDay(activeShift.shift_date) : 'No open shift'}
                    {shiftIsPast(activeShift?.shift_date) ? ' · still open' : ''}
                  </>
                )}
            </span>
            <SyncStatusBadge status={syncStatus} pending={pendingStages} onRefresh={onRefresh} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {permissions.canUseShiftChat && profileId && (
            <ShiftChatDrawer
              senderName={activeFitter}
              userRole={permissions.department === 'training' ? 'training' : workshopDesk ? 'management' : 'fitter'}
              profileId={profileId}
              crew={crew}
              readOnly={permissions.accessLevel >= 4}
              executive={permissions.accessLevel >= 4}
              crewMemberId={myCrewMemberId}
              callouts={workshopDesk || (permissions.department === 'production' && (permissions.accessLevel === 3 || permissions.accessLevel === 4))}
            />
          )}
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
            <Plus className="w-4 h-4" /> Create downtime event
          </button>
        )}
      </div>
    </header>
  );
};
