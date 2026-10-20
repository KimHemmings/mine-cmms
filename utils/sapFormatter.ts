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

  // Case 1: Called with a SINGLE Work Order (individual paste per WO)
  if (workOrderOrOrders && !Array.isArray(workOrderOrOrders)) {
    const wo = workOrderOrOrders;
    return `================================================================================
SAP PM ORDER CONFIRMATION
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

  // Case 2: Called with an ARRAY of Work Orders (full machine summary)
  const orders = Array.isArray(workOrderOrOrders) ? workOrderOrOrders.filter((w) => w.asset_id === asset.id) : [];
  const woList = orders.map(w => `${w.wo_number || 'No WO'} (${w.order_type}) - ${w.component_systems?.join(', ')}`).join('\n            ');
  const defectsBlock = machineDefects.length > 0
    ? machineDefects.map((d) => `• [${d.severity} - ${d.status === 'FIXED_THIS_SHIFT' ? 'FIXED' : 'OPEN'}] ${d.description}`).join('\n')
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
${orders.map(w => `[\${w.status}] ${w.task_description} (Fitter:${w.fitter_assigned})`).join('\n')}

PROGRESS LOG & REPAIR NOTES:
${notesBlock}

DEFECTS FOUND / RECTIFIED:
${defectsBlock}
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