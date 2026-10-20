'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Wrench, Plus, Shield, BookOpen, FileSpreadsheet, RefreshCw } from 'lucide-react';

import { Asset, DefectItem } from '@/types';
import WorkboardTab from '@/components/WorkboardTab';
import FleetDossierTab from '@/components/FleetDossierTab';
import HandoverReportTab from '@/components/HandoverReportTab';
import AssignJobModal from '@/components/AssignJobModal';
import HistoryModal from '@/components/HistoryModal';
import DefectsModal from '@/components/DefectsModal';

export default function Home() {
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'board' | 'handover' | 'dossier'>('board');
  const [userRole, setUserRole] = useState<'management' | 'fitter'>('management');

  // Modals Visibility State
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeHistoryAsset, setActiveHistoryAsset] = useState<Asset | null>(null);
  const [activeDefectAsset, setActiveDefectAsset] = useState<Asset | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    await Promise.all([fetchFleet(), fetchDefects()]);
    setLoading(false);
  }

  async function fetchFleet() {
    const { data } = await supabase.from('assets').select('*').order('fleet_id', { ascending: true });
    
    if (data) {
      const sorted = data.sort((a, b) => {
        const pOrder = { 'P1': 1, 'P2': 2, 'P3': 3, 'P4': 4 };
        const valA = a.priority ? pOrder[a.priority as keyof typeof pOrder] : 5;
        const valB = b.priority ? pOrder[b.priority as keyof typeof pOrder] : 5;
        if (valA !== valB) return valA - valB;
        if (a.down_since && b.down_since) return new Date(a.down_since).getTime() - new Date(b.down_since).getTime();
        return 0;
      });
      setAllAssets(sorted as Asset[]);
    }
  }

  async function fetchDefects() {
    const { data } = await supabase.from('defect_watchlist').select('*').order('created_at', { ascending: false });
    if (data) setDefects(data as DefectItem[]);
  }

  async function updateStage(id: string, newStage: string) {
    const { error } = await supabase.from('assets').update({ shift_stage: newStage }).eq('id', id);
    if (!error) {
      await supabase.from('asset_history_notes').insert([{
        asset_id: id,
        fitter_name: userRole === 'management' ? 'Dispatcher/Planner' : 'Fitter',
        note: `Stage changed to ${newStage.replace('_', ' ')}`,
        stage: newStage
      }]);
      fetchFleet();
    }
  }

  async function completeShiftJob(id: string) {
    const actualUp = new Date().toISOString();
    const { error } = await supabase.from('assets').update({
      in_shift: false, status: 'OPERATIONAL', actual_up: actualUp, shift_stage: 'COMPLETE', priority: null
    }).eq('id', id);

    if (!error) {
      await supabase.from('asset_history_notes').insert([{
        asset_id: id, fitter_name: 'Workshop Signoff', note: `Job completed. Machine returned to production.`, stage: 'COMPLETE'
      }]);
      fetchFleet();
    }
  }

  const shiftJobs = allAssets.filter((a) => a.in_shift);
  const completedJobs = allAssets.filter((a) => !a.in_shift && a.actual_up);
  const unassignedMachines = allAssets.filter((a) => !a.in_shift);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-2.5">
          <Wrench className="w-7 h-7 text-amber-500" />
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wide text-white">MINE SHIFT WORKBOARD</h1>
            <p className="text-xs text-slate-400 mt-0.5">Active shift execution, defect rectification & SAP work orders</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Fitter vs Management Role Switch */}
          <div className="bg-slate-950 border border-slate-700 rounded-lg flex p-1 text-xs font-bold mr-2">
            <button
              onClick={() => { setUserRole('fitter'); setCurrentTab('board'); }}
              className={`px-3 py-1.5 rounded-md transition ${userRole === 'fitter' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Fitter View
            </button>
            <button
              onClick={() => setUserRole('management')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${userRole === 'management' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Shield className="w-3.5 h-3.5" /> Management
            </button>
          </div>

          {/* Clean Mine-Site Navigation Tabs */}
          <div className="bg-slate-950 border border-slate-800 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setCurrentTab('board')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                currentTab === 'board' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active Shift Work ({shiftJobs.length})
            </button>
            <button
              onClick={() => setCurrentTab('dossier')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                currentTab === 'dossier' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Fleet Directory
            </button>
            {userRole === 'management' && (
              <button
                onClick={() => setCurrentTab('handover')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  currentTab === 'handover' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Shift Handover
              </button>
            )}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition"
          >
            <Plus className="w-4 h-4" /> Assign Job
          </button>
          
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Tabs */}
      <section className="mt-6">
        {currentTab === 'board' && (
          <WorkboardTab
            shiftJobs={shiftJobs}
            defects={defects}
            loading={loading}
            updateStage={updateStage}
            openHistory={setActiveHistoryAsset}
            openDefects={setActiveDefectAsset}
            completeShiftJob={completeShiftJob}
          />
        )}

        {currentTab === 'dossier' && (
          <FleetDossierTab assets={allAssets} openHistory={setActiveHistoryAsset} />
        )}

        {currentTab === 'handover' && userRole === 'management' && (
          <HandoverReportTab
            shiftJobs={shiftJobs}
            completedJobs={completedJobs}
            defects={defects}
          />
        )}
      </section>

      {/* Modals */}
      <AssignJobModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchData}
        unassignedMachines={unassignedMachines}
      />
      
      <HistoryModal
        asset={activeHistoryAsset}
        onClose={() => setActiveHistoryAsset(null)}
        userRole={userRole}
      />

      <DefectsModal
        asset={activeDefectAsset}
        defects={defects}
        onClose={() => setActiveDefectAsset(null)}
        onRefresh={fetchDefects}
      />
    </main>
  );
}