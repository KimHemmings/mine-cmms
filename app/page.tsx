'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useWorkboardData } from '@/hooks/useWorkboardData';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Asset, MachineWorkOrder, UserRole, personLight } from '@/types';
import { PRODUCTION_PLANT } from '@/types/production';
import TrainingMatrix from '@/components/training/TrainingMatrix';
import PassoutRegister from '@/components/training/PassoutRegister';
import SupervisionRegister from '@/components/training/SupervisionRegister';
import RecordTrail from '@/components/training/RecordTrail';
import TrainingDesk from '@/components/training/TrainingDesk';
import ProductionStatus from '@/components/production/ProductionStatus';
import ProductionHandover from '@/components/production/ProductionHandover';

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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { profile, displayName: activeFitter, loading: profileLoading, reload } = useCurrentUser();
  const userRole: UserRole = profile?.role ?? 'fitter';
  const [currentTab, setCurrentTab] = useState<'board' | 'handover' | 'dossier' | 'crew' | 'training' | 'status'>('board');
  const [trainingSection, setTrainingSection] = useState<'tickets' | 'passouts' | 'supervision'>('tickets');
  const [trainingMode, setTrainingMode] = useState<'person' | 'lists'>('person');
  const [routedRole, setRoutedRole] = useState<UserRole | null>(null);
  if (profile && routedRole !== profile.role) {
    setRoutedRole(profile.role);
    if (profile.role === 'training') setCurrentTab('training');
    if (profile.role === 'production') setCurrentTab('status');
  }
  const { showToast } = useFeedback();

  // Modal Visibility State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignAssetId, setAssignAssetId] = useState<string | null>(null);
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
    authorisations,
    holdings,
    passouts,
    machineOperators,
    supervision,
    loading,
    pendingStages,
    queuedWorkOrderIds,
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
    return {
      crew,
      onShiftIds: onShiftCrewIds,
      openJobsByCrew,
      openJobCounts,
      authorisations,
      holdings,
      supervision,
      canCheckAuthorisations: userRole !== 'fitter',
    };
  }, [crew, onShiftCrewIds, workOrders, allAssets, authorisations, holdings, supervision, userRole]);

  const crewAttention = useMemo(() => {
    let count = 0;
    for (const person of crew) {
      if (!onShiftCrewIds.has(person.id)) continue;
      const dates = holdings.filter((row) => row.crew_member_id === person.id).map((row) => row.expires_on);
      if (personLight(dates)) count += 1;
    }
    return count;
  }, [crew, onShiftCrewIds, holdings]);

  const fleetChoices = useMemo(
    () => allAssets
      .filter((asset) => (PRODUCTION_PLANT as readonly string[]).includes(asset.asset_type))
      .map((asset) => asset.fleet_id)
      .sort(),
    [allAssets],
  );

  const refreshAfterSave = () => {
    fetchAllData();
    showToast({ message: 'Saved' });
  };

  async function signOutInactive() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  async function linkMyCrew(crewMemberId: string) {
    const { error } = await supabase.rpc('link_my_crew', { p_crew_member_id: crewMemberId });
    if (error) {
      showToast({ message: error.message, tone: 'error' });
      return;
    }
    reload();
    showToast({ message: 'My jobs now follow that person' });
  }

  if (!profileLoading && !profile) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-2xl p-6 text-center space-y-3">
          <h1 className="text-lg font-black text-slate-900 uppercase">Account Not Activated</h1>
          <p className="text-sm text-slate-600">
            Your sign-in worked, but your account has no active workboard profile. Ask a
            maintenance superintendent to activate your access.
          </p>
          <button
            type="button"
            onClick={() => void signOutInactive()}
            className="min-h-11 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700"
          >
            Sign out
          </button>
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
        pendingStages={pendingStages}
        activeFitter={activeFitter}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        shiftJobsCount={shiftJobs.length}
        userRole={userRole}
        onOpenAssign={() => {
          setAssignAssetId(null);
          setShowAssignModal(true);
        }}
        onRefresh={fetchAllData}
        crewAttention={crewAttention}
        fleetChoices={fleetChoices}
        myCrewMemberId={profile?.crew_member_id ?? null}
        crew={crew}
        onLinkCrew={userRole === 'fitter' ? linkMyCrew : undefined}
      />

      <section className="mt-6">
        {currentTab === 'board' && (userRole === 'fitter' || userRole === 'management') && (
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
            openDefects={setActiveDefectAsset}
            openQuickEdit={setQuickEditAsset}
            myCrewMemberId={profile?.crew_member_id ?? null}
            crew={crew}
            onLinkCrew={userRole === 'fitter' ? linkMyCrew : undefined}
            queuedWorkOrderIds={queuedWorkOrderIds}
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
            onAssignJob={(asset) => {
              setAssignAssetId(asset.id);
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
            notes={notes}
            assets={allAssets}
            handoverLog={handoverLog}
            loading={loading}
            onRefresh={fetchAllData}
            onRolloverShift={handleRolloverShift}
          />
        )}

        {currentTab === 'training' && userRole === 'training' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Training navigation">
              {([
                ['person', 'One person'],
                ['lists', 'Whole crew'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTrainingMode(id)}
                  aria-pressed={trainingMode === id}
                  className={`min-h-10 px-4 rounded-full border text-sm font-bold ${
                    trainingMode === id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {trainingMode === 'person' ? (
              <>
                <TrainingDesk
                  crew={crew}
                  authorisations={authorisations}
                  holdings={holdings}
                  passouts={passouts}
                  machines={allAssets}
                  supervision={supervision}
                  onChanged={fetchAllData}
                />
                <RecordTrail title="Recent changes" tables={['crew_authorisations', 'operator_passouts', 'crew_supervision']} />
              </>
            ) : (
            <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Training sections">
              {([
                ['tickets', 'Tickets'],
                ['passouts', 'Pass-outs'],
                ['supervision', 'In training'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTrainingSection(id)}
                  aria-pressed={trainingSection === id}
                  className={`min-h-10 px-4 rounded-full border text-sm font-bold ${
                    trainingSection === id
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {trainingSection === 'tickets' && (
              <>
                <TrainingMatrix
                  crew={crew}
                  authorisations={authorisations}
                  holdings={holdings}
                  onChanged={fetchAllData}
                />
                <RecordTrail title="Ticket changes" tables={['crew_authorisations']} />
              </>
            )}
            {trainingSection === 'passouts' && (
              <>
                <PassoutRegister
                  machines={allAssets}
                  crew={crew}
                  passouts={passouts}
                  onChanged={fetchAllData}
                />
                <RecordTrail title="Pass-out changes" tables={['operator_passouts']} />
              </>
            )}
            {trainingSection === 'supervision' && (
              <>
                <SupervisionRegister
                  crew={crew}
                  supervision={supervision}
                  authorisations={authorisations}
                  holdings={holdings}
                  onChanged={fetchAllData}
                />
                <RecordTrail title="Supervision changes" tables={['crew_supervision']} />
              </>
            )}
            </div>
            )}
          </div>
        )}

        {currentTab === 'handover' && userRole === 'production' && (
          <ProductionHandover
            activeShift={activeShift}
            machines={allAssets}
            crew={crew}
            allocations={machineOperators}
            supervision={supervision}
            authorisations={authorisations}
            holdings={holdings}
          />
        )}

        {currentTab === 'status' && userRole === 'production' && (
          <ProductionStatus
            activeShift={activeShift}
            machines={allAssets}
            workOrders={workOrders}
            crew={crew}
            authorisations={authorisations}
            holdings={holdings}
            passouts={passouts}
            allocations={machineOperators}
            supervision={supervision}
            onChanged={fetchAllData}
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
        onCloseAssignModal={() => {
          setShowAssignModal(false);
          setAssignAssetId(null);
        }}
        preselectedAssetId={assignAssetId}
        preselectedAsset={assignAssetId ? allAssets.find((asset) => asset.id === assignAssetId) ?? null : null}
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
