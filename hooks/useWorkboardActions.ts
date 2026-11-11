// hooks/useWorkboardActions.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { ShiftRecord, CreatePartPayload, PartStatus, Asset, STAGE_OPTIONS, CrewMember, CrewMemberInput } from '@/types';
import { logAssetHistory } from '@/utils/helpers';
import { isNetworkError, queueStage } from '@/utils/stageQueue';
import { useFeedback } from '@/components/ui/FeedbackProvider';

interface UseWorkboardActionsOptions {
  supabase: SupabaseClient;
  activeFitter: string;
  activeShift: ShiftRecord | null;
  fetchAllData: () => Promise<void>;
}

const UNDO_WINDOW_MS = 10000;

function stageLabel(stage: string) {
  return STAGE_OPTIONS.find((o) => o.value === stage)?.label ?? stage.replace(/_/g, ' ');
}

export function useWorkboardActions({
  supabase,
  activeFitter,
  activeShift,
  fetchAllData,
}: UseWorkboardActionsOptions) {
  const { showToast, confirm } = useFeedback();
  const fitter = activeFitter || 'Fitter';

  // Reopening a job on a released machine puts it back on the board. Machines still on the
  // board keep their status, so planned services and in-service inspections aren't relabelled
  // as breakdowns.
  async function returnReleasedMachineToBoard(assetId: string) {
    const { data: asset } = await supabase
      .from('assets')
      .select('status, in_shift')
      .eq('id', assetId)
      .single<Pick<Asset, 'status' | 'in_shift'>>();
    if (!asset || asset.in_shift || asset.status !== 'OPERATIONAL') return;

    const { data: mainWo } = await supabase
      .from('machine_work_orders')
      .select('order_type')
      .eq('asset_id', assetId)
      .eq('is_main_event', true)
      .limit(1)
      .maybeSingle<{ order_type: string }>();
    const isPlanned = ['PLANNED', 'PM02'].includes((mainWo?.order_type || '').toUpperCase());

    await supabase
      .from('assets')
      .update({ in_shift: true, status: isPlanned ? 'DOWN_PLANNED' : 'DOWN_UNPLANNED', actual_up: null })
      .eq('id', assetId);
  }

  async function undoSignOff(woId: string, assetId: string, previousStage: string) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showToast({ message: 'Undo needs a signal. The sign-off is still saved on this tablet.', tone: 'info' });
      return;
    }
    const stage = previousStage && previousStage !== 'COMPLETED' ? previousStage : 'IN_PROGRESS';
    const { error } = await supabase
      .from('machine_work_orders')
      .update({ stage, status: 'OPEN', completed_at: null, completed_by: null })
      .eq('id', woId);
    if (error) return alert(`Could not undo sign-off: ${error.message}`);

    await returnReleasedMachineToBoard(assetId);
    await logAssetHistory(supabase, assetId, fitter, 'Sign-off undone. Job reopened.', stage);
    await fetchAllData();
    showToast({ message: 'Sign-off undone. Job reopened.', tone: 'info' });
  }

  async function updateWorkOrderStage(woId: string, assetId: string, newStage: string, jobLabel?: string) {
    const isComplete = newStage === 'COMPLETED';

    if (isComplete) {
      const ok = await confirm({
        title: 'Sign off this job?',
        message: `${jobLabel ? `"${jobLabel}"` : 'This job'} will be marked complete and signed off under your name.`,
        confirmLabel: 'Yes, sign off',
      });
      if (!ok) return;
    }

    const holdLocally = () => {
      queueStage({ woId, assetId, newStage, fitter });
      showToast({ message: 'Saved on this tablet. It will send when the signal is back.' });
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      holdLocally();
      return;
    }

    const { data: before, error: readError } = await supabase
      .from('machine_work_orders')
      .select('stage')
      .eq('id', woId)
      .single<{ stage: string }>();
    if (readError && isNetworkError(readError)) {
      holdLocally();
      return;
    }

    const woUpdate = isComplete
      ? { stage: 'COMPLETED', status: 'COMPLETED', completed_at: new Date().toISOString(), completed_by: fitter }
      : { stage: newStage, status: 'OPEN', completed_at: null, completed_by: null };

    const { error: woError } = await supabase.from('machine_work_orders').update(woUpdate).eq('id', woId);
    if (woError && isNetworkError(woError)) {
      holdLocally();
      return;
    }
    if (woError) return alert(`Error updating work order: ${woError.message}`);

    if (!isComplete) await returnReleasedMachineToBoard(assetId);

    const noteText = isComplete
      ? 'Work order completed and signed off.'
      : `Work order updated to ${stageLabel(newStage)}.`;

    await logAssetHistory(supabase, assetId, fitter, noteText, newStage);
    await fetchAllData();

    if (isComplete) {
      showToast({
        message: 'Job signed off',
        actionLabel: 'Undo',
        onAction: () => undoSignOff(woId, assetId, before?.stage ?? 'IN_PROGRESS'),
        durationMs: UNDO_WINDOW_MS,
      });
    } else {
      showToast({ message: `Saved: ${stageLabel(newStage)}` });
    }
  }

  async function undoRelease(assetId: string, fleetId: string, previousStatus: Asset['status']) {
    const { error } = await supabase
      .from('assets')
      .update({ in_shift: true, status: previousStatus, actual_up: null })
      .eq('id', assetId);
    if (error) return alert(`Could not undo release: ${error.message}`);

    await logAssetHistory(supabase, assetId, fitter, 'Release undone. Machine returned to the workboard.', 'IN_PROGRESS');
    await fetchAllData();
    showToast({ message: `${fleetId} is back on the workboard`, tone: 'info' });
  }

  async function releaseMachineToProduction(assetId: string, fleetId = 'This machine') {
    const ok = await confirm({
      title: `Release ${fleetId} to production?`,
      message: 'It will move to "Released this shift" and be marked as running.',
      confirmLabel: 'Yes, release',
    });
    if (!ok) return;

    const { data: before } = await supabase
      .from('assets')
      .select('status')
      .eq('id', assetId)
      .single<Pick<Asset, 'status'>>();

    const { error } = await supabase
      .from('assets')
      .update({ in_shift: false, status: 'OPERATIONAL', actual_up: new Date().toISOString() })
      .eq('id', assetId);
    if (error) return alert(`Error releasing machine: ${error.message}`);

    await logAssetHistory(supabase, assetId, activeFitter || 'Supervisor', 'All scopes signed off. Machine released to production.', 'OPERATIONAL');
    await fetchAllData();
    showToast({
      message: `${fleetId} released to production`,
      actionLabel: 'Undo',
      onAction: () => undoRelease(assetId, fleetId, before?.status ?? 'DOWN_UNPLANNED'),
      durationMs: UNDO_WINDOW_MS,
    });
  }

  async function handleRolloverShift(nextCrew?: string) {
    if (!activeShift) return false;

    const { data: newShift, error } = await supabase
      .rpc('rollover_shift', { p_current_shift_id: activeShift.id, p_next_crew: nextCrew ?? null })
      .single<ShiftRecord>();

    await fetchAllData();
    if (error) {
      alert(`Shift rollover failed: ${error.message}`);
      return false;
    }
    showToast({
      message: `${newShift.shift_name} started with ${newShift.crew ?? 'no crew'}. Open jobs carried over.`,
      durationMs: 6000,
    });
    return true;
  }

  async function setShiftPanel(panel: string) {
    if (!activeShift) return;
    const { error } = await supabase.rpc('set_shift_panel', { p_shift_id: activeShift.id, p_crew: panel });
    if (error) return alert(`Error changing the crew on shift: ${error.message}`);
    await fetchAllData();
    showToast({ message: `${panel} is now on this shift` });
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

    if (error) {
      alert(`Error logging parts: ${error.message}`);
    } else {
      await fetchAllData();
      showToast({ message: 'Part request saved' });
    }
  }

  async function updatePartStatus(partId: string, status: PartStatus) {
    const { error } = await supabase
      .from('work_order_parts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', partId);

    if (error) {
      alert(`Error updating part status: ${error.message}`);
    } else {
      await fetchAllData();
      showToast({ message: status === 'RECEIVED' ? 'Part marked as received' : 'Part updated' });
    }
  }

  async function saveCrewMember(input: CrewMemberInput, id?: string) {
    const row = {
      display_name: input.display_name.trim(),
      employee_id: input.employee_id?.trim() || null,
      department: input.department || 'Workshop',
      trade: input.trade,
      panel: input.panel || null,
    };
    const { error } = id
      ? await supabase.from('crew_members').update(row).eq('id', id)
      : await supabase.from('crew_members').insert(row);

    if (error) {
      const duplicateId = error.code === '23505';
      alert(duplicateId ? `Employee ID ${row.employee_id} is already on the crew list.` : `Error saving crew member: ${error.message}`);
      return false;
    }
    await fetchAllData();
    showToast({ message: id ? `${row.display_name} updated` : `${row.display_name} added to the crew` });
    return true;
  }

  async function setCrewMemberActive(member: CrewMember, active: boolean) {
    const { error } = await supabase.from('crew_members').update({ active }).eq('id', member.id);
    if (error) return alert(`Error updating crew member: ${error.message}`);

    if (!active && activeShift) {
      await supabase.from('shift_crew').delete().eq('shift_id', activeShift.id).eq('crew_member_id', member.id);
    }
    await fetchAllData();
    showToast({ message: active ? `${member.display_name} is back on the crew list` : `${member.display_name} removed from the crew list` });
  }

  async function setCrewOnShift(crewIds: string[], onShift: boolean) {
    if (!activeShift || crewIds.length === 0) return;

    const { error } = onShift
      ? await supabase
          .from('shift_crew')
          .upsert(crewIds.map((id) => ({ shift_id: activeShift.id, crew_member_id: id })), { ignoreDuplicates: true })
      : await supabase.from('shift_crew').delete().eq('shift_id', activeShift.id).in('crew_member_id', crewIds);

    if (error) return alert(`Error updating who's on shift: ${error.message}`);
    await fetchAllData();
  }

  async function setWorkOrderCrew(woId: string, crewIds: string[]) {
    const { error } = await supabase.rpc('set_work_order_crew', { p_work_order_id: woId, p_crew_ids: crewIds });
    if (error) {
      alert(`Error assigning crew: ${error.message}`);
      return false;
    }
    await fetchAllData();
    showToast({ message: crewIds.length ? 'Crew assigned' : 'Crew cleared' });
    return true;
  }

  return {
    saveCrewMember,
    setCrewMemberActive,
    setCrewOnShift,
    setWorkOrderCrew,
    setShiftPanel,
    updateWorkOrderStage,
    signOffWorkOrder: (woId: string, assetId: string) => updateWorkOrderStage(woId, assetId, 'COMPLETED'),
    releaseMachineToProduction,
    handleRolloverShift,
    addWorkOrderPart,
    updatePartStatus,
  };
}
