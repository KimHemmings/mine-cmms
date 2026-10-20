import React from 'react';
import { Search, X, BookOpen } from 'lucide-react';

interface FleetDossierHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'ALL' | 'OPERATIONAL' | 'DOWN';
  onStatusFilterChange: (status: 'ALL' | 'OPERATIONAL' | 'DOWN') => void;
  selectedOwner: string;
  onOwnerChange: (owner: string) => void;
  owners: string[];
  counts: { all: number; down: number; running: number };
}

export const FleetDossierHeader: React.FC<FleetDossierHeaderProps> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedOwner,
  onOwnerChange,
  owners,
  counts,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" /> Complete Fleet Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Tap any card to inspect historical logs, or tap Assign to post an operational downtime event.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => onStatusFilterChange('ALL')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange('DOWN')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              statusFilter === 'DOWN'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-rose-700 hover:bg-rose-100/50'
            }`}
          >
            Down ({counts.down})
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange('OPERATIONAL')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              statusFilter === 'OPERATIONAL'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 hover:bg-emerald-100/50'
            }`}
          >
            Running ({counts.running})
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search fleet ID, S/N, model, or location..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-11 bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-9 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="w-full sm:w-48">
          <select
            value={selectedOwner}
            onChange={(e) => onOwnerChange(e.target.value)}
            aria-label="Filter machines by owner"
            className="w-full h-11 px-3 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Owners</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};