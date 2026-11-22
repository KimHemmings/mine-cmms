import { UserRole } from '@/types';

/** Workshop supervisor is the management sign-in. Fitters, training, and production stay on their own screens. */
export function isWorkshopSupervisorRole(role: UserRole | null | undefined) {
  return role === 'management';
}
