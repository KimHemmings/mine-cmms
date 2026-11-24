'use client';

import { useSyncExternalStore } from 'react';
import {
  DEFAULT_CREW_ROTATION_ORDER,
  DEFAULT_ROSTER_ANCHOR,
  getRosterCycleSettings,
  ROSTER_CYCLE_SETTINGS_EVENT,
  RosterCycleSettings,
} from '@/utils/rosterCycle';

const SERVER_SETTINGS = JSON.stringify({
  roster_anchor_date: DEFAULT_ROSTER_ANCHOR,
  crew_rotation_order: DEFAULT_CREW_ROTATION_ORDER,
});

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(ROSTER_CYCLE_SETTINGS_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(ROSTER_CYCLE_SETTINGS_EVENT, onChange);
  };
}

function getSnapshot() {
  return JSON.stringify(getRosterCycleSettings());
}

export function useRosterCycleSettings() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SETTINGS);
  return JSON.parse(snapshot) as RosterCycleSettings;
}
