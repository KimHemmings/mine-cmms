'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Wrench, Plus, Shield, BookOpen, FileSpreadsheet, RefreshCw, UserCheck } from 'lucide-react';

// Realtime hook
import { useWorkboardData } from '@/hooks/useWorkboardData';

import { Asset, MachineWorkOrder, DefectItem, HistoryNote, ShiftRecord } from '@/types';
import WorkboardTab from '@/components/WorkboardTab';
import FleetDossierTab from '@/components/FleetDossierTab';
import HandoverReportTab from '@/components/HandoverReportTab';
import WorkboardModals from '@/components/WorkboardModals';

// Status badge component
import { SyncStatusBadge } from '@/components/SyncStatusBadge';

export default function Home() {
  // Persistent Fitter Identity
  const [activeFitter, setActiveFitter] = useState('D. Kelly (#4821)');

  // Tab & Role State
  const [currentTab, setCurrentTab] = useState<'board' | 'handover' | 'dossier'>('board');
  const [userRole, setUserRole] = useState<'management' | 'fitter'>('management');

  // Modals Visibility State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetAddWoAsset, setTargetAddWoAsset] = useState<Asset | null>(null);
  const [activeHistoryAsset, setActiveHistoryAsset] = useState<Asset | null>(null);
  const [activeDefectAsset, setActiveDefectAsset] = useState<Asset | null>(null);
  const [quickEditAsset, setQuickEditAsset] = useState<Asset | null>(null);

  // Load and synchronize all Workboard data via hook
  const {
    allAssets,
    workOrders,
    defects,
    notes,
    activeShift,
    loading,
    syncStatus,
    shiftJobs,
    completedJobs,
    unassignedMachines,
    fetchAllData,
    updateWorkOrderStage,
    signOffWorkOrder,
    releaseMachineToProduction,
    handleRolloverShift,
  } = useWorkboardData({ activeFitter });

  useEffect(() => {
    const savedFitter = localStorage.getItem('mine_cmms_active_fitter');
    if (savedFitter) setActiveFitter(savedFitter);
  }, []);

  function handleUpdateActiveFitter(name: string) {
    setActiveFitter(name);
    localStorage.setItem('mine_cmms_active_fitter', name);
  }

  return (
    <main className="min-h-screen bg-slate-200 text-slate-900 p-4 md:p-8 font-sans">
      {/* Top Header */}
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
          {/* Active Fitter / User Stamp */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-3 py-1.5 rounded-xl shadow-2xs text-xs">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-slate-500 text-[11px] uppercase">Fitter on Duty:</span>
            <input
              type="text"
              value={activeFitter}
              onChange={(e) => handleUpdateActiveFitter(e.target.value)}
              placeholder="e.g. D. Kelly (#4821)"
              className="font-bold text-slate-900 focus:outline-none w-36 bg-transparent"
              title="Your Name & ID will stamp on all progressive notes and sign-offs"
            />
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white border border-slate-300 p-1 rounded-xl flex items-center shadow-2xs">
            <button
              onClick={() => setCurrentTab('board')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                currentTab === 'board' ? 'bg-slate-200 text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Shift Work ({shiftJobs.length})
            </button>
            <button
              onClick={() => setCurrentTab('dossier')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                currentTab === 'dossier' ? 'bg-slate-200 text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Fleet Directory
            </button>
            {userRole === 'management' && (
              <button
                onClick={() => setCurrentTab('handover')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  currentTab === 'handover' ? 'bg-slate-200 text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Shift Handover
              </button>
            )}
          </div>

          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Assign Machine
          </button>

          <button
            onClick={fetchAllData}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl transition shadow-2xs"
            title="Refresh All Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <section className="mt-6">
        {currentTab === 'board' && (
          <WorkboardTab
            shiftJobs={shiftJobs}
            workOrders={workOrders}
            defects={defects}
            notes={notes}
            loading={loading}
            activeFitter={activeFitter}
            updateWorkOrderStage={updateWorkOrderStage}
            signOffWorkOrder={signOffWorkOrder}
            openAddWorkOrder={setTargetAddWoAsset}
            openHistory={setActiveHistoryAsset}
            openDefects={setActiveDefectAsset}
            openQuickEdit={setQuickEditAsset}
            releaseMachineToProduction={releaseMachineToProduction}
            onRefresh={fetchAllData}
          />
        )}

        {currentTab === 'dossier' && (
          <FleetDossierTab assets={allAssets} openHistory={setActiveHistoryAsset} />
        )}

        {currentTab === 'handover' && userRole === 'management' && (
          <HandoverReportTab
            activeShift={activeShift}
            shiftJobs={shiftJobs}
            completedJobs={completedJobs}
            workOrders={workOrders}
            defects={defects}
            onRolloverShift={handleRolloverShift}
          />
        )}
      </section>

      {/* MODALS CONTAINER */}
      <WorkboardModals
        showAssignModal={showAssignModal}
        onCloseAssignModal={() => setShowAssignModal(false)}
        targetAddWoAsset={targetAddWoAsset}
        onCloseAddWoModal={() => setTargetAddWoAsset(null)}
        activeHistoryAsset={activeHistoryAsset}
        onCloseHistoryModal={() => setActiveHistoryAsset(null)}
        activeDefectAsset={activeDefectAsset}
        onCloseDefectsModal={() => setActiveDefectAsset(null)}
        quickEditAsset={quickEditAsset}
        onCloseQuickEditModal={() => setQuickEditAsset(null)}
        activeShiftId={activeShift?.id || null}
        unassignedMachines={unassignedMachines}
        defects={defects}
        notes={notes}
        userRole={userRole}
        activeFitter={activeFitter}
        onSuccessRefresh={fetchAllData}
      />
    </main>
  );
}