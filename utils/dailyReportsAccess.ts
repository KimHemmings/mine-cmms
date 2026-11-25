/** Clearance for the Daily Maintenance Reports meeting tab. */
export function canViewDailyMaintenanceReports(user?: { access_level?: number | null; accessLevel?: number | null } | null) {
  const level = Number(user?.accessLevel ?? user?.access_level ?? 0);
  return Number.isFinite(level) && level >= 3;
}
