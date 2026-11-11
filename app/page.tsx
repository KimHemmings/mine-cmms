'use client';

import { useMemo, useState } from 'react';
import { useWorkboardData } from '@/hooks/useWorkboardData';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Asset, MachineWorkOrder } from '@/types';

import WorkboardTab from '@/components/WorkboardTab';
import FleetDossierTab from '@/components/FleetDossierTab';
import HandoverReportTab from '@/components/HandoverReportTab';
import WorkboardModals from '@/components/WorkboardModals';
import { TopHeader } from '@/components/TopHeader';
import { FeedbackProvider, useFeedback } from '@/components/ui/FeedbackProvider';
import CrewTab from '@/components/crew/CrewTab';
import AssignCrewModal from '@/components/crew/AssignCrewModal';
import { CrewDataContext, CrewData } from '@/components/crew/CrewDataContext';
import { getOpenJobsByCrew } from '@/utils/crew';

export default function Home() {
  return (
    <FeedbackProvider>
      <Workboard />
    </FeedbackProvider>
  );
}

function Workboard() {
  const { profile, displayName: activeFitter, loading: profileLoading } = useCurrentUser();
  const userRole = profile?.role ?? 'fitter';
  const [currentTab, setCurrentTab] = useState<'board' | 'handover' | 'dossier' | 'crew'>('board');
  const { showToast } = useFeedback();

  // Modal Visibility State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetAddWoAsset, setTargetAddWoAsset] = useState<Asset | null>(null);
  const [activeHistoryAsset, setActiveHistoryAsset] = useState<Asset | null>(null);
  const [activeDefectAsset, setActiveDefectAsset] = useState<Asset | null>(null);
  const [quickEditAsset, setQuickEditAsset] = useState<Asset | null>(null);
  const [targetPartsWoId, setTargetPartsWoId] = useState<string | null>(null);
  const [targetCrewWoId, setTargetCrewWoId] = useState<string | null>(null);

  const {
    allAssets,
    workOrders,
    defects,
    notes,
    handoverLog,
    activeShift,
    crew,
    onShiftCrewIds,
    loading,
    syncStatus,
    shiftJobs,
    completedJobs,
    unassignedMachines,
    fetchAllData,
    updateWorkOrderStage,
    releaseMachineToProduction,
    handleRolloverShift,
    addWorkOrderPart,
    updatePartStatus,
    saveCrewMember,
    setCrewMemberActive,
    setCrewOnShift,
    setWorkOrderCrew,
    setShiftPanel,
  } = useWorkboardData({ activeFitter });

  const targetPartsWo = targetPartsWoId ? workOrders.find((w) => w.id === targetPartsWoId) ?? null : null;
  const targetCrewWo = targetCrewWoId ? workOrders.find((w) => w.id === targetCrewWoId) ?? null : null;

  const crewData = useMemo<CrewData>(() => {
    const openJobsByCrew = getOpenJobsByCrew(workOrders, allAssets);
    const openJobCounts = new Map([...openJobsByCrew].map(([id, jobs]) => [id, jobs.length]));
    return { crew, onShiftIds: onShiftCrewIds, openJobsByCrew, openJobCounts };
  }, [crew, onShiftCrewIds, workOrders, allAssets]);

  const refreshAfterSave = () => {
    fetchAllData();
    showToast({ message: 'Saved' });
  };

  if (!profileLoading && !profile) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-2xl p-6 text-center space-y-2">
          <h1 className="text-lg font-black text-slate-900 uppercase">Account Not Activated</h1>
          <p className="text-sm text-slate-600">
            Your sign-in worked, but your account has no active workboard profile. Ask a
            maintenance superintendent to activate your access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <CrewDataContext.Provider value={crewData}>
    <main className="min-h-screen bg-slate-200 text-slate-900 p-4 md:p-8 font-sans">
      <TopHeader
        activeShift={activeShift}
        syncStatus={syncStatus}
        activeFitter={activeFitter}
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
            notes={notes}
            loading={loading}
            activeFitter={activeFitter}
            myName={profile?.display_name ?? ''}
            updateWorkOrderStage={updateWorkOrderStage}
            openAddWorkOrder={setTargetAddWoAsset}
            openHistory={setActiveHistoryAsset}
            openQuickEdit={setQuickEditAsset}
            openPartsModal={(wo: MachineWorkOrder) => setTargetPartsWoId(wo.id)}
            openCrewPicker={(wo: MachineWorkOrder) => setTargetCrewWoId(wo.id)}
            releaseMachineToProduction={releaseMachineToProduction}
            onRefresh={refreshAfterSave}
          />
        )}

        {currentTab === 'dossier' && (
          <FleetDossierTab
            assets={allAssets}
            openHistory={setActiveHistoryAsset}
            onAssignJob={() => setShowAssignModal(true)}
          />
        )}

        {currentTab === 'handover' && userRole === 'management' && (
          <HandoverReportTab
            activeShift={activeShift}
            shiftJobs={shiftJobs}
            completedJobs={completedJobs}
            workOrders={workOrders}
            defects={defects}
            notes={notes}
            assets={allAssets}
            handoverLog={handoverLog}
            loading={loading}
            onRefresh={fetchAllData}
            onRolloverShift={handleRolloverShift}
          />
        )}

        {currentTab === 'crew' && userRole === 'management' && (
          <CrewTab
            activeShift={activeShift}
            saveCrewMember={saveCrewMember}
            setCrewMemberActive={setCrewMemberActive}
            setCrewOnShift={setCrewOnShift}
            setShiftPanel={setShiftPanel}
          />
        )}
      </section>

      {targetCrewWo && (
        <AssignCrewModal
          key={targetCrewWo.id}
          workOrder={targetCrewWo}
          fleetId={allAssets.find((a) => a.id === targetCrewWo.asset_id)?.fleet_id ?? ''}
          onClose={() => setTargetCrewWoId(null)}
          onSave={setWorkOrderCrew}
        />
      )}

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
        targetPartsWo={targetPartsWo}
        onClosePartsModal={() => setTargetPartsWoId(null)}
        onSubmitPart={addWorkOrderPart}
        onUpdatePartStatus={updatePartStatus}
        activeShiftId={activeShift?.id || null}
        unassignedMachines={unassignedMachines}
        defects={defects}
        notes={notes}
        userRole={userRole}
        activeFitter={activeFitter}
        onSuccessRefresh={refreshAfterSave}
      />
    </main>
    </CrewDataContext.Provider>
  );
}
