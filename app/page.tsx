'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Wrench, Plus, Shield, BookOpen, FileSpreadsheet, RefreshCw, UserCheck } from 'lucide-react';

import { Asset, MachineWorkOrder, DefectItem, HistoryNote, ShiftRecord } from '@/types';
import WorkboardTab from '@/components/WorkboardTab';
import FleetDossierTab from '@/components/FleetDossierTab';
import HandoverReportTab from '@/components/HandoverReportTab';
import AssignJobModal from '@/components/AssignJobModal';
import AddWorkOrderModal from '@/components/AddWorkOrderModal';
import HistoryModal from '@/components/HistoryModal';
import DefectsModal from '@/components/DefectsModal';
import QuickEditAssetModal from '@/components/QuickEditAssetModal';

export default function Home() {
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [workOrders, setWorkOrders] = useState<MachineWorkOrder[]>([]);
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [notes, setNotes] = useState<HistoryNote[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [loading, setLoading] = useState(true);

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

  const supabase = createClient();

  useEffect(() => {
    const savedFitter = localStorage.getItem('mine_cmms_active_fitter');
    if (savedFitter) setActiveFitter(savedFitter);
    fetchAllData();
  }, []);

  function handleUpdateActiveFitter(name: string) {
    setActiveFitter(name);
    localStorage.setItem('mine_cmms_active_fitter', name);
  }

  async function fetchAllData() {
    setLoading(true);
    await Promise.all([
      fetchShift(),
      fetchFleet(),
      fetchWorkOrders(),
      fetchDefects(),
      fetchNotes(),
    ]);
    setLoading(false);
  }

  async function fetchShift() {
    const { data } = await supabase
      .from('shift_records')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setActiveShift(data as ShiftRecord);
  }

  async function fetchFleet() {
    const { data } = await supabase.from('assets').select('*').order('fleet_id', { ascending: true });
    if (data) {
      const sorted = data.sort((a, b) => {
        const pOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
        const valA = a.priority ? pOrder[a.priority as keyof typeof pOrder] : 5;
        const valB = b.priority ? pOrder[b.priority as keyof typeof pOrder] : 5;
        if (valA !== valB) return valA - valB;
        if (a.down_since && b.down_since) return new Date(a.down_since).getTime() - new Date(b.down_since).getTime();
        return 0;
      });
      setAllAssets(sorted as Asset[]);
    }
  }

  async function fetchWorkOrders() {
    const { data } = await supabase.from('machine_work_orders').select('*').order('created_at', { ascending: true });
    if (data) setWorkOrders(data as MachineWorkOrder[]);
  }

  async function fetchDefects() {
    const { data } = await supabase.from('defect_watchlist').select('*').order('created_at', { ascending: false });
    if (data) setDefects(data as DefectItem[]);
  }

  async function fetchNotes() {
    const { data } = await supabase.from('asset_history_notes').select('*').order('created_at', { ascending: false });
    if (data) setNotes(data as HistoryNote[]);
  }

  async function updateWorkOrderStage(woId: string, assetId: string, newStage: string) {
    const { error } = await supabase
      .from('machine_work_orders')
      .update({ stage: newStage })
      .eq('id', woId);

    if (!error) {
      await supabase.from('asset_history_notes').insert([
        {
          asset_id: assetId,
          fitter_name: activeFitter || 'Fitter',
          note: `Work order stage updated to ${newStage.replace('_', ' ')}`,
          stage: newStage,
        },
      ]);
      fetchWorkOrders();
      fetchNotes();
    }
  }

  async function signOffWorkOrder(woId: string, assetId: string) {
    const { error } = await supabase
      .from('machine_work_orders')
      .update({
        status: 'COMPLETED',
        stage: 'COMPLETED',
        completed_at: new Date().toISOString(),
        completed_by: activeFitter || 'Signoff Fitter',
      })
      .eq('id', woId);

    if (!error) {
      await supabase.from('asset_history_notes').insert([
        {
          asset_id: assetId,
          fitter_name: activeFitter || 'Signoff Fitter',
          note: `Work order completed and signed off.`,
          stage: 'COMPLETED',
        },
      ]);
      fetchWorkOrders();
      fetchNotes();
    }
  }

  async function releaseMachineToProduction(assetId: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('assets')
      .update({
        in_shift: false,
        status: 'OPERATIONAL',
        actual_up: now,
        priority: null,
      })
      .eq('id', assetId);

    if (!error) {
      await supabase.from('asset_history_notes').insert([
        {
          asset_id: assetId,
          fitter_name: activeFitter || 'Supervisor',
          note: `All scopes and defects signed off. Machine released to production.`,
          stage: 'OPERATIONAL',
        },
      ]);
      fetchAllData();
    }
  }

  async function handleRolloverShift() {
    if (!activeShift) return;

    await supabase
      .from('shift_records')
      .update({
        status: 'HANDED_OVER',
        closed_at: new Date().toISOString(),
      })
      .eq('id', activeShift.id);

    const nextShiftName = activeShift.shift_name.toLowerCase().includes('day') ? 'Night Shift' : 'Day Shift';
    const { data: newShift } = await supabase
      .from('shift_records')
      .insert([
        {
          shift_name: nextShiftName,
          supervisor: activeFitter || 'Supervisor',
          status: 'ACTIVE',
        },
      ])
      .select()
      .single();

    if (newShift) {
      await supabase
        .from('machine_work_orders')
        .update({ shift_id: newShift.id })
        .eq('status', 'OPEN');
    }

    alert(`Shift successfully rolled over to ${nextShiftName}. All active breakdowns carried forward.`);
    fetchAllData();
  }

  const shiftJobs = allAssets.filter((a) => a.in_shift);
  const completedJobs = allAssets.filter((a) => !a.in_shift && a.actual_up);
  const unassignedMachines = allAssets.filter((a) => !a.in_shift);

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

      {/* MODALS */}
      <AssignJobModal
        isOpen={showAssignModal}
        activeShiftId={activeShift?.id || null}
        onClose={() => setShowAssignModal(false)}
        onSuccess={fetchAllData}
        unassignedMachines={unassignedMachines}
      />

      <AddWorkOrderModal
        asset={targetAddWoAsset}
        activeShiftId={activeShift?.id || null}
        onClose={() => setTargetAddWoAsset(null)}
        onSuccess={fetchAllData}
      />

      <HistoryModal
        asset={activeHistoryAsset}
        onClose={() => setActiveHistoryAsset(null)}
        userRole={userRole}
        activeFitter={activeFitter}
      />

      <DefectsModal
        asset={activeDefectAsset}
        defects={defects}
        notes={notes}
        onClose={() => setActiveDefectAsset(null)}
        onRefresh={fetchAllData}
      />

      <QuickEditAssetModal
        asset={quickEditAsset}
        activeFitter={activeFitter}
        onClose={() => setQuickEditAsset(null)}
        onSuccess={fetchAllData}
      />
    </main>
  );
}