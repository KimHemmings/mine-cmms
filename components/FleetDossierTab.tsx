import { useState } from 'react';
import { BookOpen, Search, MapPin, Filter } from 'lucide-react';
import { Asset } from '@/types';

interface FleetDossierTabProps {
  assets: Asset[];
  openHistory: (asset: Asset) => void;
}

export default function FleetDossierTab({ assets, openHistory }: FleetDossierTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPERATIONAL' | 'DOWN'>('ALL');

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = asset.fleet_id.toLowerCase().includes(search.toLowerCase()) || 
                          asset.make_model.toLowerCase().includes(search.toLowerCase()) ||
                          asset.asset_type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' 
      ? true 
      : statusFilter === 'DOWN' 
      ? asset.status !== 'OPERATIONAL' 
      : asset.status === 'OPERATIONAL';

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" /> Complete Fleet Dossier
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any machine card to inspect timeline history notes, components, and open maintenance records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search fleet ID, model, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-lg text-xs font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded transition ${statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              All ({assets.length})
            </button>
            <button
              onClick={() => setStatusFilter('DOWN')}
              className={`px-2.5 py-1 rounded transition ${statusFilter === 'DOWN' ? 'bg-rose-950 text-rose-300' : 'text-slate-400'}`}
            >
              Down ({assets.filter(a => a.status !== 'OPERATIONAL').length})
            </button>
            <button
              onClick={() => setStatusFilter('OPERATIONAL')}
              className={`px-2.5 py-1 rounded transition ${statusFilter === 'OPERATIONAL' ? 'bg-emerald-950 text-emerald-300' : 'text-slate-400'}`}
            >
              Running
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 mt-5">
        {filteredAssets.map((asset) => {
          const isDown = asset.status !== 'OPERATIONAL';
          return (
            <button
              key={asset.id}
              onClick={() => openHistory(asset)}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition hover:border-amber-500/80 ${
                isDown ? 'bg-rose-950/20 border-rose-800/60 shadow-sm' : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xl font-black text-white tracking-wide">{asset.fleet_id}</span>
                  <div className={`w-2.5 h-2.5 rounded-full ${isDown ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                </div>
                <div className="text-xs font-semibold text-slate-300 mt-1">{asset.make_model}</div>
                <div className="text-[10px] text-slate-400">{asset.asset_type}</div>
              </div>

              <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" /> {asset.location || 'Yard'}
                </span>
                <span className="font-bold text-slate-300 uppercase">{asset.component_system || 'General'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}