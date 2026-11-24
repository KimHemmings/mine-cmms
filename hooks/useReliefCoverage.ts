'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { CREW_PANELS } from '@/types';

const EVENT_NAME = 'mine-cmms-relief-coverage-changed';

function storageKey(profileId: string) {
  return `mine_cmms_relief_coverage_${profileId}`;
}

function readCoveringCrew(profileId: string) {
  const value = window.sessionStorage.getItem(storageKey(profileId));
  return (CREW_PANELS as readonly string[]).includes(value ?? '') ? value ?? null : null;
}

export function useReliefCoverage(profileId: string | null) {
  const subscribe = useCallback((onChange: () => void) => {
    if (!profileId) return () => undefined;
    const handleChange = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== storageKey(profileId)) return;
      onChange();
    };
    window.addEventListener('storage', handleChange);
    window.addEventListener(EVENT_NAME, handleChange);
    return () => {
      window.removeEventListener('storage', handleChange);
      window.removeEventListener(EVENT_NAME, handleChange);
    };
  }, [profileId]);
  const getSnapshot = useCallback(() => profileId ? readCoveringCrew(profileId) ?? '' : '', [profileId]);
  const coveringCrew = useSyncExternalStore(subscribe, getSnapshot, () => '');

  const setCoveringCrew = useCallback((crewName: string | null) => {
    if (!profileId) return;
    const key = storageKey(profileId);
    if (crewName && (CREW_PANELS as readonly string[]).includes(crewName)) {
      window.sessionStorage.setItem(key, crewName);
    } else {
      window.sessionStorage.removeItem(key);
    }
    window.dispatchEvent(new Event(EVENT_NAME));
  }, [profileId]);

  return { coveringCrew: coveringCrew || null, setCoveringCrew };
}
