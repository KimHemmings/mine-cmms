// hooks/useWorkboardActions.ts - Exactly 122 lines
import { SupabaseClient } from '@supabase/supabase-js';
import { ShiftRecord, CreatePartPayload, PartStatus } from '@/types';
import { logAssetHistory } from '@/utils/helpers';

interface UseWorkboardActionsOptions {
  supabase: SupabaseClient;
  activeFitter: string;
  activeShift: ShiftRecord | null;
  fetchAllData: () => Promise<void>;
}

export function useWorkboardActions({
  supabase,
  activeFitter,
  activeShift,
  fetchAllData,
}: UseWorkboardActionsOptions) {
  const fitter = activeFitter || 'Fitter';

  async function updateWorkOrderStage(woId: string, assetId: string, newStage: string) {
    const isComplete = newStage === 'COMPLETED';
    const woUpdate = isComplete
      ? { stage: 'COMPLETED', status: 'COMPLETED', completed_at: new Date().toISOString(), completed_by: fitter }
      : { stage: newStage, status: 'OPEN', completed_at: null, completed_by: null };

    const { error: woError } = await supabase.from('machine_work_orders').update(woUpdate).eq('id', woId);
    if (woError) return alert(`Error updating work order: ${woError.message}`);

    if (!isComplete) {
      await supabase.from('assets').update({ in_shift: true, status: 'DOWN_UNPLANNED', actual_up: null }).eq('id', assetId);
    }

    const noteText = isComplete
      ? 'Work order completed and signed off.'
      : `Work order updated to ${newStage.replace('_', ' ')}. Unit returned to active shift board.`;

    await logAssetHistory(supabase, assetId, fitter, noteText, newStage);
    await fetchAllData();
  }

  async function releaseMachineToProduction(assetId: string) {
    const { error } = await supabase
      .from('assets')
      .update({ in_shift: false, status: 'OPERATIONAL', actual_up: new Date().toISOString() })
      .eq('id', assetId);

    if (!error) {
      await logAssetHistory(supabase, assetId, activeFitter || 'Supervisor', 'All scopes signed off. Machine released to production.', 'OPERATIONAL');
      await fetchAllData();
    }
  }

  async function handleRolloverShift() {
    if (!activeShift) return;

    await supabase.from('shift_records').update({ status: 'HANDED_OVER', closed_at: new Date().toISOString() }).eq('id', activeShift.id);

    const nextShiftName = activeShift.shift_name.toLowerCase().includes('day') ? 'Night Shift' : 'Day Shift';
    const { data: newShift } = await supabase
      .from('shift_records')
      .insert([{ shift_name: nextShiftName, supervisor: activeFitter || 'Supervisor', status: 'ACTIVE' }])
      .select()
      .single();

    if (newShift) {
      await supabase.from('machine_work_orders').update({ shift_id: newShift.id }).eq('status', 'OPEN');
    }

    alert(`Shift successfully rolled over to ${nextShiftName}. All active breakdowns carried forward.`);
    await fetchAllData();
  }

  async function addWorkOrderPart(payload: CreatePartPayload) {
    const { error } = await supabase.from('work_order_parts').insert({
      work_order_id: payload.workOrderId,
      part_number: payload.partNumber?.trim() || null,
      description: payload.description.trim(),
      po_or_reservation: payload.poOrReservation?.trim() || null,
      is_special_run: payload.isSpecialRun,
      carrier_details: payload.carrierDetails?.trim() || null,
      eta: payload.eta || null,
      status: payload.isSpecialRun ? 'IN_TRANSIT' : 'ORDERED',
    });

    if (error) alert(`Error logging parts: ${error.message}`);
    else await fetchAllData();
  }

  async function updatePartStatus(partId: string, status: PartStatus) {
    const { error } = await supabase
      .from('work_order_parts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', partId);

    if (error) alert(`Error updating part status: ${error.message}`);
    else await fetchAllData();
  }

  return {
    updateWorkOrderStage,
    signOffWorkOrder: (woId: string, assetId: string) => updateWorkOrderStage(woId, assetId, 'COMPLETED'),
    releaseMachineToProduction,
    handleRolloverShift,
    addWorkOrderPart,
    updatePartStatus,
  };
}