'use client';

import { useEffect, useState } from 'react';
import { useWorkboardData } from '@/hooks/useWorkboardData';
import { Asset } from '@/types';

import WorkboardTab from '@/components/WorkboardTab';
import FleetDossierTab from '@/components/FleetDossierTab';
import HandoverReportTab from '@/components/HandoverReportTab';
import WorkboardModals from '@/components/WorkboardModals';
import { TopHeader } from '@/components/TopHeader';

export default function Home() {
  const [activeFitter, setActiveFitter] = useState('D. Kelly (#4821)');
  const [currentTab, setCurrentTab] = useState<'board' | 'handover' | 'dossier'>('board');
  const [userRole, setUserRole] = useState<'management' | 'fitter'>('management');

  // Modals Visibility State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetAddWoAsset, setTargetAddWoAsset] = useState<Asset | null>(null);
  const [activeHistoryAsset, setActiveHistoryAsset] = useState<Asset | null>(null);
  const [activeDefectAsset, setActiveDefectAsset] = useState<Asset | null>(null);
  const [quickEditAsset, setQuickEditAsset] = useState<Asset | null>(null);

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
      <TopHeader
        activeShift={activeShift}
        syncStatus={syncStatus}
        activeFitter={activeFitter}
        onUpdateFitter={handleUpdateActiveFitter}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        shiftJobsCount={shiftJobs.length}
        userRole={userRole}
        onOpenAssign={() => setShowAssignModal(true)}
        onRefresh={fetchAllData}
      />

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
          <FleetDossierTab
            assets={allAssets}
            openHistory={setActiveHistoryAsset}
            onAssignJob={(asset) => {
              setShowAssignModal(true);
            }}
          />
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