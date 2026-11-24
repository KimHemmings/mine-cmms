'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useWorkboardData } from '@/hooks/useWorkboardData';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Asset, MachineWorkOrder, UserRole } from '@/types';
import { PRODUCTION_PLANT } from '@/types/production';
import TicketRegister from '@/components/training/TicketRegister';
import PassoutRegister from '@/components/training/PassoutRegister';
import SupervisionRegister from '@/components/training/SupervisionRegister';
import RecordTrail from '@/components/training/RecordTrail';
import ProductionStatus from '@/components/production/ProductionStatus';
import ProductionShiftHandover from '@/components/production/ProductionShiftHandover';

import WorkboardTab from '@/components/WorkboardTab';
import FleetDossierTab from '@/components/FleetDossierTab';
import HandoverReportTab from '@/components/HandoverReportTab';
import PartsBoard from '@/components/parts/PartsBoard';
import WorkboardModals from '@/components/WorkboardModals';
import { getPermissions, operationalLens, type Department } from '@/utils/permissions';
import { SiteBrandProvider } from '@/components/SiteBrand';
import { crewTabAttention } from '@/utils/shiftRoster';
import { TopHeader } from '@/components/TopHeader';
import { FeedbackProvider, useFeedback } from '@/components/ui/FeedbackProvider';
import CrewTab from '@/components/crew/CrewTab';
import CompetencyBoard from '@/components/crew/CompetencyBoard';
import DepartmentLens from '@/components/DepartmentLens';
import ManagementTab from '@/components/ManagementTab';
import AssignCrewModal from '@/components/crew/AssignCrewModal';
import { CrewDataContext, CrewData } from '@/components/crew/CrewDataContext';
import { getOpenJobsByCrew } from '@/utils/crew';
import { getActiveCrewsForDate } from '@/utils/rosterCycle';
import { useRosterCycleSettings } from '@/hooks/useRosterCycleSettings';
import { useReliefCoverage } from '@/hooks/useReliefCoverage';
import { localDateIso, shiftDateIso } from '@/utils/crewLeave';
import { CREW_PANELS } from '@/types';
export default function Home() {
  return (
    <FeedbackProvider>
      <SiteBrandProvider>
        <Workboard />
      </SiteBrandProvider>
    </FeedbackProvider>
  );
}

function Workboard() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { profile, displayName: activeFitter, loading: profileLoading, reload } = useCurrentUser();
  const userRole: UserRole = profile?.role ?? 'fitter';
  const permissions = getPermissions(profile);
  const rosterSettings = useRosterCycleSettings();
  const { coveringCrew, setCoveringCrew } = useReliefCoverage(profile?.id ?? null);
  const syncedRosterShift = useRef<string | null>(null);
  const showLens = permissions.accessLevel >= 4;
  const [viewedDepartment, setViewedDepartment] = useState<Department>(permissions.accessLevel >= 5 ? 'production' : permissions.department);
  const [lensProfileId, setLensProfileId] = useState<string | null>(null);
  const routeKey = profile?.id ?? null;
  if (profile && showLens && lensProfileId !== routeKey) {
    setLensProfileId(routeKey);
    setViewedDepartment(permissions.accessLevel >= 5 ? 'production' : permissions.department);
  }
  const viewDepartment = showLens ? viewedDepartment : permissions.department;
  const viewPermissions = showLens ? operationalLens(permissions, viewedDepartment) : permissions;
  const [currentTab, setCurrentTab] = useState<'management' | 'board' | 'myLeave' | 'handover' | 'dossier' | 'crew' | 'training' | 'status' | 'parts'>('board');
  const [trainingSection, setTrainingSection] = useState<'tickets' | 'passouts' | 'supervision'>('tickets');
  const [routedProfile, setRoutedProfile] = useState<string | null>(null);
  const homeTab = permissions.canViewManagementDashboard ? 'management' : permissions.department === 'training' ? 'training' : 'board';
  if (routeKey && routedProfile !== routeKey) {
    setRoutedProfile(routeKey);
    setCurrentTab(homeTab);
  }
  useEffect(() => {
    if (!profile) return;
    const allowed =
      (currentTab === 'management' && permissions.canViewManagementDashboard)
      || (currentTab === 'board' && permissions.canViewWhiteboard)
      || (currentTab === 'myLeave' && permissions.accessLevel === 2 && permissions.department === 'workshop')
      || (currentTab === 'dossier' && permissions.canViewFleetDirectory)
      || (currentTab === 'handover' && permissions.canViewHandover)
      || (currentTab === 'crew' && permissions.canViewCrew)
      || (currentTab === 'training' && permissions.department === 'training')
      || (currentTab === 'parts' && permissions.accessLevel >= 3);
    if (!allowed) setCurrentTab(homeTab);
  }, [profile, permissions, currentTab, homeTab]);
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
    crewLeave,
    onShiftCrewIds,
    authorisations,
    holdings,
    passouts,
    machineOperators,
    seatChanges,
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
    updateOperatorCompetencies,
    setCrewMemberActive,
    setCrewMemberAway,
    setCrewAllocation,
    addOvertimeCover,
    addContractor,
    endShiftExtra,
    clearExpiredShiftExtras,
    updateMachineLocation,
    updateMachineCircuit,
    setWorkOrderCrew,
    setShiftPanel,
  } = useWorkboardData({ activeFitter });

  const activeRosterCrews = getActiveCrewsForDate(
    activeShift?.shift_date ? shiftDateIso(activeShift.shift_date) : localDateIso(),
    rosterSettings.roster_anchor_date,
    rosterSettings.crew_rotation_order,
  );
  const homeCrew = profile?.crew_name ?? null;
  const activeCrew = permissions.accessLevel === 3
    ? coveringCrew ?? homeCrew
    : permissions.accessLevel >= 4
      ? activeShift?.shift_type === 'NIGHT' ? activeRosterCrews.nightCrew : activeRosterCrews.dayCrew
      : homeCrew ?? activeShift?.crew ?? null;

  const saveHomeCrew = async (crewName: string) => {
    if (!(CREW_PANELS as readonly string[]).includes(crewName)) return;
    const { error } = await supabase.rpc('set_home_crew', { p_crew: crewName });
    if (error) {
      showToast({ message: error.message || 'Home Crew could not be saved.', tone: 'error' });
      return;
    }
    await reload();
    showToast({ message: `Home Crew set to ${crewName}` });
  };

  useEffect(() => {
    if (!activeShift || (permissions.accessLevel !== 3 && permissions.accessLevel !== 4)) return;
    const orderKey = rosterSettings.crew_rotation_order.join(',');
    const syncKey = `${activeShift.id}:${activeShift.shift_date}:${activeShift.shift_type}:${rosterSettings.roster_anchor_date}:${orderKey}`;
    if (syncedRosterShift.current === syncKey) return;
    syncedRosterShift.current = syncKey;
    const activeCrews = getActiveCrewsForDate(
      activeShift.shift_date,
      rosterSettings.roster_anchor_date,
      rosterSettings.crew_rotation_order,
    );
    const rosteredCrew = activeShift.shift_type === 'NIGHT' ? activeCrews.nightCrew : activeCrews.dayCrew;
    if (activeShift.crew !== rosteredCrew) void setShiftPanel(rosteredCrew);
  }, [
    activeShift,
    rosterSettings.roster_anchor_date,
    rosterSettings.crew_rotation_order,
    setShiftPanel,
    permissions.accessLevel,
  ]);

  const targetPartsWo = targetPartsWoId ? workOrders.find((w) => w.id === targetPartsWoId) ?? null : null;
  const targetCrewWo = targetCrewWoId ? workOrders.find((w) => w.id === targetCrewWoId) ?? null : null;

  const crewData = useMemo<CrewData>(() => {
    const openJobsByCrew = getOpenJobsByCrew(workOrders, allAssets);
    const openJobCounts = new Map([...openJobsByCrew].map(([id, jobs]) => [id, jobs.length]));
    return {
      crew,
      leave: crewLeave,
      onShiftIds: onShiftCrewIds,
      openJobsByCrew,
      openJobCounts,
      authorisations,
      holdings,
      supervision,
      canCheckAuthorisations: permissions.accessLevel === 3 || permissions.accessLevel === 4,
    };
  }, [crew, crewLeave, onShiftCrewIds, workOrders, allAssets, authorisations, holdings, supervision, permissions.accessLevel]);

  const crewAttention = useMemo(
    () => crewTabAttention(crew, permissions.department, permissions.accessLevel, activeShift?.crew),
    [crew, permissions.department, permissions.accessLevel, activeShift?.crew],
  );

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
        permissions={permissions}
        onOpenAssign={() => {
          setAssignAssetId(null);
          setShowAssignModal(true);
        }}
        onRefresh={fetchAllData}
        crewAttention={crewAttention}
        fleetChoices={fleetChoices}
        myCrewMemberId={profile?.crew_member_id ?? null}
        crew={crew}
        onLinkCrew={permissions.department === 'workshop' && permissions.accessLevel === 2 ? linkMyCrew : undefined}
        onSetShiftCrew={setShiftPanel}
        homeCrew={homeCrew}
        activeCrew={activeCrew}
        coveringCrew={coveringCrew}
        onSetCoveringCrew={setCoveringCrew}
        onSaveHomeCrew={saveHomeCrew}
        profileId={profile?.id ?? null}
        lensDepartment={showLens ? viewedDepartment : null}
      />

      <section className="mt-6">
        {currentTab === 'board' && permissions.canViewWhiteboard && (
          <div className="space-y-3">
          {showLens && <DepartmentLens surface="board" department={viewedDepartment} onChange={setViewedDepartment} actorName={activeFitter} canEditRates={permissions.accessLevel >= 4} />}
          {showLens && viewDepartment === 'training' ? (
            <section className="rounded-xl border border-indigo-300 bg-white p-4">
              <CompetencyBoard crew={crew} assets={allAssets} onSave={updateOperatorCompetencies} readOnly hideDirectives actorName={activeFitter} />
            </section>
          ) : (
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
            onLinkCrew={permissions.department === 'workshop' && permissions.accessLevel === 2 ? linkMyCrew : undefined}
            queuedWorkOrderIds={queuedWorkOrderIds}
            openPartsModal={(wo: MachineWorkOrder) => setTargetPartsWoId(wo.id)}
            openCrewPicker={(wo: MachineWorkOrder) => setTargetCrewWoId(wo.id)}
            releaseMachineToProduction={releaseMachineToProduction}
            onRefresh={refreshAfterSave}
            permissions={viewPermissions}
            historyAssets={allAssets}
            activeShiftId={activeShift?.id ?? null}
            onUpdateLocation={viewPermissions.canUpdateMachineLocation ? updateMachineLocation : undefined}
            onUpdateCircuit={viewPermissions.canUpdateMachineLocation ? updateMachineCircuit : undefined}
          />
          )}
          </div>
        )}

        {currentTab === 'management' && permissions.canViewManagementDashboard && (
          <ManagementTab
            assets={allAssets}
            crew={crew}
            workOrders={workOrders}
            activeShift={activeShift}
            downAssetIds={shiftJobs.filter((asset) => !(asset.status === 'OPERATIONAL' && !asset.in_shift)).map((asset) => asset.id)}
            actorName={activeFitter}
            accessLevel={permissions.accessLevel}
          />
        )}

        {currentTab === 'dossier' && (
          <FleetDossierTab
            assets={allAssets}
            defects={defects}
            notes={notes}
            openHistory={setActiveHistoryAsset}
            canManageFleet={permissions.canManageFleet}
            onChanged={fetchAllData}
            onAssignJob={permissions.canAssignMachine ? (asset) => {
              setAssignAssetId(asset.id);
              setShowAssignModal(true);
            } : undefined}
          />
        )}

        {currentTab === 'parts' && permissions.accessLevel >= 3 && (
          <PartsBoard assets={allAssets} actorName={activeFitter} readOnly={permissions.accessLevel >= 5} />
        )}

        {currentTab === 'handover' && permissions.canViewHandover && ((showLens && viewDepartment === 'workshop') || (!showLens && permissions.department !== 'production')) && (
          <div className="space-y-3">
            {showLens && <DepartmentLens surface="handover" department={viewedDepartment} onChange={setViewedDepartment} actorName={activeFitter} canEditRates={permissions.accessLevel >= 4} />}
          <HandoverReportTab
            readOnly={showLens}
            accessLevel={permissions.accessLevel}
            signedByName={activeFitter}
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
            homeCrew={homeCrew}
            coveringCrew={coveringCrew}
          />
          </div>
        )}

        {currentTab === 'training' && permissions.department === 'training' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Training sections">
              {([
                ['tickets', 'Tickets and SOPs'],
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
                <TicketRegister
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

        {currentTab === 'handover' && permissions.canViewHandover && showLens && viewDepartment === 'training' && (
          <div className="space-y-3">
            <DepartmentLens surface="handover" department={viewedDepartment} onChange={setViewedDepartment} actorName={activeFitter} canEditRates={permissions.accessLevel >= 4} />
            <section className="rounded-xl border border-indigo-300 bg-white p-4">
              <CompetencyBoard crew={crew} assets={allAssets} onSave={updateOperatorCompetencies} readOnly hideDirectives actorName={activeFitter} />
            </section>
          </div>
        )}

        {currentTab === 'handover' && permissions.canViewHandover && ((showLens && viewDepartment === 'production') || (!showLens && permissions.department === 'production')) && (
          <div className="space-y-3">
            {showLens && <DepartmentLens surface="handover" department={viewedDepartment} onChange={setViewedDepartment} actorName={activeFitter} canEditRates={permissions.accessLevel >= 4} />}
          <ProductionShiftHandover
            readOnly={showLens}
            accessLevel={permissions.accessLevel}
            activeShift={activeShift}
            shiftJobs={shiftJobs}
            assets={allAssets}
            workOrders={workOrders}
            crew={crew}
            handoverLog={handoverLog}
            onRefresh={fetchAllData}
            supervisorName={activeFitter}
          />
          </div>
        )}

        {currentTab === 'status' && permissions.department === 'production' && (
          <ProductionStatus
            activeShift={activeShift}
            machines={allAssets}
            workOrders={workOrders}
            crew={crew}
            authorisations={authorisations}
            holdings={holdings}
            passouts={passouts}
            allocations={machineOperators}
            seatChanges={seatChanges}
            supervision={supervision}
            onChanged={fetchAllData}
          />
        )}

        {currentTab === 'crew' && permissions.canViewCrew && (
          <div className="space-y-3">
          {showLens && <DepartmentLens surface="crew" department={viewedDepartment} onChange={setViewedDepartment} actorName={activeFitter} canEditRates={permissions.accessLevel >= 4} />}
          <CrewTab
            activeShift={activeShift}
            homeCrew={homeCrew}
            activeCrew={activeCrew}
            coveringCrew={coveringCrew}
            onSetCoveringCrew={setCoveringCrew}
            canManageCrew={showLens ? false : permissions.canManageCrew}
            crossDepartment={showLens ? false : permissions.isSiteExecutive}
            canManageCompetencies={showLens ? false : permissions.canManageCompetencies}
            accessLevel={permissions.accessLevel}
            signerName={activeFitter}
            department={viewDepartment}
            rosterTitle={showLens ? (viewDepartment === 'workshop' ? 'Trades Roster' : viewDepartment === 'production' ? 'Operator Allocations' : undefined) : undefined}
            matrixOnly={showLens && viewDepartment === 'training'}
            saveCrewMember={saveCrewMember}
            setCrewMemberActive={setCrewMemberActive}
            setCrewMemberAway={setCrewMemberAway}
            setCrewAllocation={setCrewAllocation}
            addOvertimeCover={addOvertimeCover}
            addContractor={addContractor}
            endShiftExtra={endShiftExtra}
            clearExpiredShiftExtras={clearExpiredShiftExtras}
            assets={shiftJobs}
            fleetAssets={allAssets}
            downAssetIds={shiftJobs.filter((asset) => !(asset.status === 'OPERATIONAL' && !asset.in_shift)).map((asset) => asset.id)}
            updateMachineLocation={viewPermissions.canUpdateMachineLocation ? updateMachineLocation : undefined}
            updateMachineCircuit={viewPermissions.canUpdateMachineLocation ? updateMachineCircuit : undefined}
            workOrders={workOrders}
            updateOperatorCompetencies={updateOperatorCompetencies}
            onRefresh={fetchAllData}
          />
          </div>
        )}
        {currentTab === 'myLeave' && permissions.accessLevel === 2 && permissions.department === 'workshop' && (
          <CrewTab
            activeShift={activeShift}
            personalOnly
            personalCrewMemberId={profile?.crew_member_id ?? null}
            personalDisplayName={profile?.display_name ?? activeFitter}
            canManageCrew={false}
            accessLevel={2}
            signerName={activeFitter}
            department="workshop"
            saveCrewMember={saveCrewMember}
            setCrewMemberActive={setCrewMemberActive}
            setCrewMemberAway={setCrewMemberAway}
            setCrewAllocation={setCrewAllocation}
            addOvertimeCover={addOvertimeCover}
            addContractor={addContractor}
            endShiftExtra={endShiftExtra}
            clearExpiredShiftExtras={clearExpiredShiftExtras}
            assets={shiftJobs}
            fleetAssets={allAssets}
            downAssetIds={shiftJobs.filter((asset) => !(asset.status === 'OPERATIONAL' && !asset.in_shift)).map((asset) => asset.id)}
            workOrders={workOrders}
            updateOperatorCompetencies={updateOperatorCompetencies}
            onRefresh={fetchAllData}
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
        workOrders={workOrders}
        userRole={userRole}
        activeFitter={activeFitter}
        onSuccessRefresh={refreshAfterSave}
      />
    </main>
    </CrewDataContext.Provider>
  );
}
