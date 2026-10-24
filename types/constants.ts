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
  { value: 'P1', label: 'P1 - Critical' },
  { value: 'P2', label: 'P2 - High' },
  { value: 'P3', label: 'P3 - Medium' },
  { value: 'P4', label: 'P4 - Low' },
  { value: null, label: 'No Priority' },
] as const;

export const STAGES = [
  'IN_PROGRESS',
  'WAITING_LABOUR',
  'WAITING_PARTS',
  'WAITING_PRODUCTION',
  'WEATHER_DELAY',
  'COMPLETED',
] as const;

export const STAGE_OPTIONS = [
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_LABOUR', label: 'Waiting on Labour' },
  { value: 'WAITING_PARTS', label: 'Wait on Parts' },
  { value: 'WAITING_PRODUCTION', label: 'Wait on Production' },
  { value: 'WEATHER_DELAY', label: 'Weather Delay' },
  { value: 'COMPLETED', label: 'Complete' },
] as const;