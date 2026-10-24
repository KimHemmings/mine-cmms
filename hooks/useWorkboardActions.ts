import { SupabaseClient } from '@supabase/supabase-js';
import { ShiftRecord } from '@/types';

interface UseWorkboardActionsOptions {
  supabase: SupabaseClient;
  activeFitter: string;
  activeShift: ShiftRecord | null;
  fetchAllData: () => Promise<void>;
  fetchWorkOrders: () => Promise<void>;
  fetchNotes: () => Promise<void>;
}

export function useWorkboardActions({
  supabase,
  activeFitter,
  activeShift,
  fetchAllData,
}: UseWorkboardActionsOptions) {
  async function updateWorkOrderStage(woId: string, assetId: string, newStage: string) {
    const isComplete = newStage === 'COMPLETED';

    const woUpdate = isComplete
      ? {
          stage: 'COMPLETED',
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_by: activeFitter || 'Fitter',
        }
      : {
          stage: newStage,
          status: 'OPEN',
          completed_at: null,
          completed_by: null,
        };

    const { error: woError } = await supabase
      .from('machine_work_orders')
      .update(woUpdate)
      .eq('id', woId);

    if (woError) {
      alert('Error updating work order: ' + woError.message);
      return;
    }

    if (!isComplete) {
      await supabase
        .from('assets')
        .update({
          in_shift: true,
          status: 'DOWN_UNPLANNED',
          actual_up: null,
        })
        .eq('id', assetId);
    }

    await supabase.from('asset_history_notes').insert([
      {
        asset_id: assetId,
        fitter_name: activeFitter || 'Fitter',
        note: isComplete
          ? 'Work order completed and signed off.'
          : `Work order updated to ${newStage.replace('_', ' ')}. Unit returned to active shift board.`,
        stage: newStage,
      },
    ]);

    await fetchAllData();
  }

  async function signOffWorkOrder(woId: string, assetId: string) {
    await updateWorkOrderStage(woId, assetId, 'COMPLETED');
  }

  async function releaseMachineToProduction(assetId: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('assets')
      .update({
        in_shift: false,
        status: 'OPERATIONAL',
        actual_up: now,
      })
      .eq('id', assetId);

    if (!error) {
      await supabase.from('asset_history_notes').insert([
        {
          asset_id: assetId,
          fitter_name: activeFitter || 'Supervisor',
          note: 'All scopes and defects signed off. Machine released to production.',
          stage: 'OPERATIONAL',
        },
      ]);
      await fetchAllData();
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

    const nextShiftName = activeShift.shift_name.toLowerCase().includes('day')
      ? 'Night Shift'
      : 'Day Shift';

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
    await fetchAllData();
  }

  return {
    updateWorkOrderStage,
    signOffWorkOrder,
    releaseMachineToProduction,
    handleRolloverShift,
  };
}