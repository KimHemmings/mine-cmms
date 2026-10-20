'use client';

import React from 'react';
import { Asset, DefectItem, HistoryNote } from '@/types';
import AssignJobModal from '@/components/AssignJobModal';
import AddWorkOrderModal from '@/components/AddWorkOrderModal';
import HistoryModal from '@/components/HistoryModal';
import DefectsModal from '@/components/DefectsModal';
import QuickEditAssetModal from '@/components/QuickEditAssetModal';

interface WorkboardModalsProps {
  showAssignModal: boolean;
  onCloseAssignModal: () => void;

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
        asset={activeHistoryAsset}
        onClose={onCloseHistoryModal}
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
    </>
  );
}