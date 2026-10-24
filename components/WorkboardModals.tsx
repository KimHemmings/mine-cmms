// components/WorkboardModals.tsx - Exactly 97 lines
'use client';

import React from 'react';
import { Asset, DefectItem, HistoryNote, CreatePartPayload, MachineWorkOrder } from '@/types';
import PartsTrackingModal from '@/components/PartsTrackingModal';
import AssignJobModal from '@/components/AssignJobModal';
import AddWorkOrderModal from '@/components/AddWorkOrderModal';
import HistoryModal from '@/components/HistoryModal';
import DefectsModal from '@/components/DefectsModal';
import QuickEditAssetModal from '@/components/QuickEditAssetModal';

interface WorkboardModalsProps {
  showAssignModal: boolean;
  onCloseAssignModal: () => void;

  targetPartsWo?: MachineWorkOrder | null;
  onClosePartsModal?: () => void;
  onSubmitPart?: (payload: CreatePartPayload) => Promise<void>;

  targetAddWoAsset: Asset | null;
  onCloseAddWoModal: () => void;

  activeHistoryAsset: Asset | null;
  onCloseHistoryModal: () => void;

  activeDefectAsset: Asset | null;
  onCloseDefectsModal: () => void;

  quickEditAsset: Asset | null;
  onCloseQuickEditModal: () => void;

  activeShiftId: string | null;
  unassignedMachines: Asset[];
  defects: DefectItem[];
  notes: HistoryNote[];
  userRole: 'management' | 'fitter';
  activeFitter: string;
  onSuccessRefresh: () => void;
}

export default function WorkboardModals({
  showAssignModal,
  onCloseAssignModal,
  targetAddWoAsset,
  onCloseAddWoModal,
  activeHistoryAsset,
  onCloseHistoryModal,
  activeDefectAsset,
  onCloseDefectsModal,
  quickEditAsset,
  onCloseQuickEditModal,
  activeShiftId,
  unassignedMachines,
  defects,
  notes,
  userRole,
  activeFitter,
  targetPartsWo,
  onClosePartsModal,
  onSubmitPart,
  onSuccessRefresh,
}: WorkboardModalsProps) {
  return (
    <>
      <AssignJobModal
        isOpen={showAssignModal}
        activeShiftId={activeShiftId}
        onClose={onCloseAssignModal}
        onSuccess={onSuccessRefresh}
        unassignedMachines={unassignedMachines}
      />

      <AddWorkOrderModal
        asset={targetAddWoAsset}
        activeShiftId={activeShiftId}
        onClose={onCloseAddWoModal}
        onSuccess={onSuccessRefresh}
      />

      <HistoryModal
        isOpen={Boolean(activeHistoryAsset)}
        asset={activeHistoryAsset}
        notes={notes}
        onClose={onCloseHistoryModal}
        onRefresh={onSuccessRefresh}
        userRole={userRole}
        activeFitter={activeFitter}
      />

      <DefectsModal
        asset={activeDefectAsset}
        defects={defects}
        notes={notes}
        onClose={onCloseDefectsModal}
        onRefresh={onSuccessRefresh}
      />

      <QuickEditAssetModal
        asset={quickEditAsset}
        activeFitter={activeFitter}
        onClose={onCloseQuickEditModal}
        onSuccess={onSuccessRefresh}
      />

      {targetPartsWo && onClosePartsModal && onSubmitPart && (
        <PartsTrackingModal
          isOpen={Boolean(targetPartsWo)}
          workOrder={targetPartsWo}
          onClose={onClosePartsModal}
          onSubmit={onSubmitPart}
        />
      )}
    </>
  );
}