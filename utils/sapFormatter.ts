import { Asset, HistoryNote, DefectItem, MachineWorkOrder } from '@/types';
import { formatDateTime, getElapsedDown } from '@/utils/helpers';

export function generateSapClipboardText(
  asset: Asset,
  workOrderOrOrders?: MachineWorkOrder | MachineWorkOrder[],
  notes: HistoryNote[] = [],
  defects: DefectItem[] = []
): string {
  const machineNotes = notes.filter((n) => n.asset_id === asset.id);
  const machineDefects = defects.filter((d) => d.asset_id === asset.id);

  const notesBlock = machineNotes.length > 0
    ? machineNotes.map((n) => `• ${formatDateTime(n.created_at)} [${n.fitter_name}]: ${n.note}`).join('\n')
    : `• No progressive notes logged. Work executed as per scope.`;

  // Single Work Order
  if (workOrderOrOrders && !Array.isArray(workOrderOrOrders)) {
    const wo = workOrderOrOrders;
    return `================================================================================
SAP PM ORDER CONFIRMATION (${wo.is_main_event ? 'MAIN DOWN TIME EVENT' : 'ADDITIONAL WORK ORDER'})
================================================================================
ORDER NO    : ${wo.wo_number || 'N/A'} (${wo.order_type})
NOTIF NO    : ${wo.notification_num || 'N/A'}
FLEET ID    : ${asset.fleet_id} (${asset.make_model})
OWNER       : ${asset.machine_owner || 'Central'}
LOCATION    : ${asset.location || 'Workshop'}
SYSTEMS     : ${wo.component_systems?.join(', ') || 'General'}
DOWN TIME   : ${formatDateTime(asset.down_since)}
UP TIME     : ${asset.actual_up ? formatDateTime(asset.actual_up) : 'PENDING'}
LOST HRS    : ${getElapsedDown(asset.down_since)}
FITTER(S)   : ${wo.fitter_assigned || asset.fitter_assigned || 'Unassigned'}

WORK SCOPE:
${wo.task_description}

PROGRESS LOG & REPAIR NOTES:
${notesBlock}

STATUS: ${wo.status === 'COMPLETED' ? 'COMPLETED / READY FOR TECO' : 'IN PROGRESS (' + wo.stage + ')'}
================================================================================`;
  }

  // Full Machine Summary
  const orders = Array.isArray(workOrderOrOrders) ? workOrderOrOrders.filter((w) => w.asset_id === asset.id) : [];
  const woList = orders.map(w => `${w.wo_number || 'No WO'} (${w.order_type}) - ${w.component_systems?.join(', ')}`).join('\n            ');
  const defectsBlock = machineDefects.length > 0
    ? machineDefects.map((d) => `• [${d.severity} - ${d.status === 'FIXED_THIS_SHIFT' ? 'FIXED' : 'OPEN'}] ${d.wo_number ? '(' + d.wo_number + ') ' : ''}${d.description}`).join('\n')
    : `• No incidental defects recorded.`;

  return `================================================================================
SAP PM ORDER CONFIRMATION / TECO LOG
================================================================================
FLEET ID  : ${asset.fleet_id} (${asset.make_model})
OWNER     : ${asset.machine_owner || 'Central'}
ORDERS    : ${woList || 'N/A'}
LOCATION  : ${asset.location || 'Workshop'}
PRIORITY  : ${asset.priority || 'Routine'}
DOWN TIME : ${formatDateTime(asset.down_since)}
UP TIME   : ${asset.actual_up ? formatDateTime(asset.actual_up) : 'PENDING'}
LOST HRS  : ${getElapsedDown(asset.down_since)}

WORK ORDERS EXECUTED:
${orders.map(w => `[${w.is_main_event ? 'MAIN EVENT' : 'ADDITIONAL'}] [${w.status}] ${w.task_description} (Fitter:${w.fitter_assigned})`).join('\n')}

PROGRESS LOG & REPAIR NOTES:
${notesBlock}

DEFECTS FOUND / RECTIFIED:
${defectsBlock}
================================================================================`;
}

// Dedicated SAP Confirmation text for Defect Work Orders
export function generateDefectSapClipboardText(
  asset: Asset,
  defect: DefectItem,
  notes: HistoryNote[] = []
): string {
  const machineNotes = notes.filter((n) => n.asset_id === asset.id);
  const notesBlock = machineNotes.length > 0
    ? machineNotes.map((n) => `• ${formatDateTime(n.created_at)} [${n.fitter_name}]: ${n.note}`).join('\n')
    : `• Defect rectified as per inspection scope.`;

  return `================================================================================
SAP PM DEFECT ORDER CONFIRMATION (PM03)
================================================================================
ORDER NO    : ${defect.wo_number || 'N/A'} (PM03 Defect Rectification)
NOTIF NO    : ${defect.notification_num || 'N/A'}
SEVERITY    : ${defect.severity}
FLEET ID    : ${asset.fleet_id} (${asset.make_model})
OWNER       : ${asset.machine_owner || 'Central'}
LOCATION    : ${asset.location || 'Workshop'}
SYSTEMS     : ${defect.component_systems?.join(', ') || 'General'}
REPORTED BY : ${defect.reported_by}
FITTER(S)   : ${defect.fitter_assigned || 'Shift Fitter'}

DEFECT DESCRIPTION:
${defect.description}

PROGRESS & RECTIFICATION NOTES:
${notesBlock}

STATUS: ${defect.status === 'FIXED_THIS_SHIFT' ? 'RECTIFIED & CLOSED THIS SHIFT' : 'OPEN / IN PROGRESS (' + (defect.stage || 'DIAGNOSING') + ')'}
================================================================================`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch {
    return false;
  }
}