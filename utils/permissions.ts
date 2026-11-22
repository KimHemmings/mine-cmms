export type Department = 'workshop' | 'production' | 'training';
export type AccessLevel = 1 | 2 | 3 | 4 | 5;
export type AppRole = 'management' | 'fitter' | 'training' | 'production';

export interface AccessUser {
  department?: string | null;
  access_level?: number | null;
  role?: string | null;
}

export interface Permissions {
  department: Department;
  accessLevel: AccessLevel;
  isReadOnly: boolean;
  isReadOnlyWorkshop: boolean;
  canViewWhiteboard: boolean;
  canViewFleetDirectory: boolean;
  canUseShiftChat: boolean;
  canAssignMachine: boolean;
  canEditWorkshopJobs: boolean;
  canAddNotes: boolean;
  canReleaseMachine: boolean;
  canViewHandover: boolean;
  canManageCrew: boolean;
  canManageCompetencies: boolean;
  canManageSiteDictionary: boolean;
  canManageFleet: boolean;
  canUpdateMachineLocation: boolean;
  isSiteExecutive: boolean;
  canViewManagementDashboard: boolean;
  canViewCrew: boolean;
  badge: string;
}

export function normalizeDepartment(value?: string | null): Department {
  const department = (value ?? '').trim().toLowerCase();
  if (department === 'production') return 'production';
  if (department === 'training') return 'training';
  return 'workshop';
}

export function normalizeAccessLevel(value?: number | null): AccessLevel {
  if (value === 1 || value === 3 || value === 4 || value === 5) return value;
  return 2;
}

export function departmentLabel(value?: string | null) {
  const department = normalizeDepartment(value);
  if (department === 'production') return 'Production';
  if (department === 'training') return 'Training';
  return 'Workshop';
}

export function isProductionDepartment(value?: string | null) {
  return normalizeDepartment(value) === 'production';
}

export function isWorkshopRoster(member: { department?: string | null; trade?: string | null }) {
  return normalizeDepartment(member.department) === 'workshop' && member.trade !== 'Operator';
}

/** The role stored for existing row-level rules. The screens use department and access level. */
export function roleForAccess(department: Department, accessLevel: AccessLevel): AppRole {
  if (accessLevel === 5) return 'management';
  if (department === 'production') return 'production';
  if (department === 'training') return 'training';
  if (accessLevel === 3 || accessLevel === 4) return 'management';
  return 'fitter';
}

function fromRole(role?: string | null): AccessUser {
  if (role === 'management') return { department: 'workshop', access_level: 3 };
  if (role === 'production') return { department: 'production', access_level: 3 };
  if (role === 'training') return { department: 'training', access_level: 2 };
  return { department: 'workshop', access_level: 2 };
}

export function getPermissions(user?: AccessUser | null): Permissions {
  const source = user?.department || user?.access_level ? user : fromRole(user?.role);
  const department = normalizeDepartment(source?.department);
  const accessLevel = normalizeAccessLevel(source?.access_level);
  const siteExecutive = accessLevel === 5;
  const departmentLead = accessLevel === 3 || accessLevel === 4;
  const workshopCrew = department === 'workshop' && (accessLevel === 2 || departmentLead);
  const workshopSupervisor = department === 'workshop' && departmentLead;
  const production = department === 'production';
  const productionSupervisor = production && departmentLead;
  const canManageCrew = departmentLead && (department === 'workshop' || department === 'training' || production);

  if (siteExecutive) {
    return {
      department,
      accessLevel,
      isReadOnly: true,
      isReadOnlyWorkshop: false,
      canViewWhiteboard: true,
      canViewFleetDirectory: true,
      canUseShiftChat: true,
      canAssignMachine: false,
      canEditWorkshopJobs: false,
      canAddNotes: false,
      canReleaseMachine: false,
      canViewHandover: true,
      canManageCrew: false,
      canManageCompetencies: false,
      canManageSiteDictionary: false,
      canManageFleet: false,
      canUpdateMachineLocation: false,
      isSiteExecutive: true,
      canViewManagementDashboard: true,
      canViewCrew: true,
      badge: 'SSE / GM • LEVEL 5',
    };
  }

  return {
    department,
    accessLevel,
    isReadOnly: production || accessLevel === 1,
    isReadOnlyWorkshop: production,
    canViewWhiteboard: true,
    canViewFleetDirectory: !production,
    canUseShiftChat: production ? productionSupervisor : accessLevel >= 2,
    canAssignMachine: workshopCrew,
    canEditWorkshopJobs: workshopCrew,
    canAddNotes: !production && accessLevel >= 2,
    canReleaseMachine: workshopSupervisor,
    canViewHandover: production ? productionSupervisor : departmentLead,
    canManageCrew,
    canManageCompetencies: department === 'training' && accessLevel >= 2,
    canManageSiteDictionary: workshopSupervisor,
    canManageFleet: workshopSupervisor,
    canUpdateMachineLocation: productionSupervisor || workshopSupervisor,
    isSiteExecutive: false,
    canViewManagementDashboard: accessLevel >= 4,
    canViewCrew: canManageCrew || (department === 'training' && accessLevel >= 2),
    badge: accessLevel === 4
      ? `${departmentLabel(department)} • Superintendent`
      : `${departmentLabel(department)} • Level ${accessLevel}`,
  };
}

/** Level 4 and Level 5 look across departments. The boards stay read-only. */
export function operationalLens(base: Permissions, viewed: Department): Permissions {
  return {
    ...base,
    department: viewed,
    isReadOnly: true,
    isReadOnlyWorkshop: viewed === 'production',
    canAssignMachine: false,
    canEditWorkshopJobs: false,
    canAddNotes: false,
    canReleaseMachine: false,
    canManageCrew: false,
    canManageCompetencies: false,
    canManageSiteDictionary: false,
    canManageFleet: false,
    canUpdateMachineLocation: false,
  };
}
