export type Department = 'workshop' | 'production' | 'training';
export type AccessLevel = 1 | 2 | 3 | 4;
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
  isManagementLevel4: boolean;
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
  if (value === 1 || value === 3 || value === 4) return value;
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
  const management = accessLevel === 4;
  const workshopCrew = department === 'workshop' && (accessLevel === 2 || accessLevel === 3);
  const workshopSupervisor = department === 'workshop' && accessLevel === 3;
  const production = department === 'production';
  const productionSupervisor = production && accessLevel === 3;
  const canManageCrew = !management && accessLevel === 3 && (department === 'workshop' || department === 'training' || production);

  if (management) {
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
      isManagementLevel4: true,
      canViewManagementDashboard: true,
      canViewCrew: true,
      badge: 'MANAGEMENT • LEVEL 4',
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
    canViewHandover: production ? productionSupervisor : accessLevel === 3,
    canManageCrew,
    canManageCompetencies: department === 'training' && accessLevel >= 2 && accessLevel < 4,
    canManageSiteDictionary: workshopSupervisor,
    canManageFleet: workshopSupervisor,
    canUpdateMachineLocation: productionSupervisor || workshopSupervisor,
    isManagementLevel4: false,
    canViewManagementDashboard: false,
    canViewCrew: canManageCrew || (department === 'training' && accessLevel >= 2),
    badge: `${departmentLabel(department)} • Level ${accessLevel}`,
  };
}
