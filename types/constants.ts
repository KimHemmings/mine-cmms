// types/constants.ts
export const COMPONENT_SYSTEMS = [
  'Engine',
  'Transmission / Driveline',
  'Hydraulics',
  'HV Electrical',
  'Auto Electrical',
  'Air Conditioning / Cab',
  'Undercarriage / Track',
  'Suspension / Chassis',
  'GET / Bucket / Blade',
  'Braking & Steering',
  'Scheduled PM Service',
  'Structural / Fabrication',
] as const;

export const ORDER_TYPES = [
  { value: 'PLANNED', label: 'Planned Maintenance' },
  { value: 'UNPLANNED', label: 'Unplanned Breakdown' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'ACCIDENT_DAMAGE', label: 'Accident Damage' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'P1', label: 'P1 - HIGH' },
  { value: 'P2', label: 'P2 - MEDIUM' },
  { value: 'P3', label: 'P3 - LOW' },
] as const;

export const STAGES = [
  'IN_PROGRESS',
  'WAITING_PARTS',
  'WAITING_OEM',
  'WAITING_BAY',
  'WAITING_LABOUR',
  'WAITING_PRODUCTION',
  'WEATHER_DELAY',
  'COMPLETED',
] as const;

export const OPERATIONAL_STAGE_OPTIONS = [
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_PARTS', label: 'Waiting on Parts' },
  { value: 'WAITING_OEM', label: 'Waiting on OEM' },
  { value: 'WAITING_BAY', label: 'Waiting on Bay / Crane' },
  { value: 'COMPLETED', label: 'Completed (sign off)' },
] as const;

export const STAGE_OPTIONS = [
  ...OPERATIONAL_STAGE_OPTIONS,
  { value: 'WAITING_LABOUR', label: 'Waiting on Labour' },
  { value: 'WAITING_PRODUCTION', label: 'Waiting on Production' },
  { value: 'WEATHER_DELAY', label: 'Weather Delay' },
] as const;