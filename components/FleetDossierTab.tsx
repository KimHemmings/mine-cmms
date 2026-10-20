import { useState } from 'react';
import { BookOpen, Search, MapPin } from 'lucide-react';
import { Asset } from '@/types';

interface FleetDossierTabProps {
  assets: Asset[];
  openHistory: (asset: Asset) => void;
}

export default function FleetDossierTab({ assets, openHistory }: FleetDossierTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPERATIONAL' | 'DOWN'>('ALL');

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.fleet_id.toLowerCase().includes(search.toLowerCase()) ||
      asset.make_model.toLowerCase().includes(search.toLowerCase()) ||
      asset.asset_type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'DOWN'
        ? asset.status !== 'OPERATIONAL'
        : asset.status === 'OPERATIONAL';

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" /> Complete Fleet Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any machine card to inspect historical timeline logs and SAP component records.
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
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-lg text-xs font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded transition ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              All ({assets.length})
            </button>
            <button
              onClick={() => setStatusFilter('DOWN')}
              className={`px-3 py-1 rounded transition ${
                statusFilter === 'DOWN' ? 'bg-rose-100 text-rose-800' : 'text-slate-600'
              }`}
            >
              Down ({assets.filter((a) => a.status !== 'OPERATIONAL').length})
            </button>
            <button
              onClick={() => setStatusFilter('OPERATIONAL')}
              className={`px-3 py-1 rounded transition ${
                statusFilter === 'OPERATIONAL' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600'
              }`}
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
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition hover:border-amber-400 hover:shadow-sm ${
                isDown ? 'bg-rose-50/40 border-rose-200' : 'bg-slate-50/60 border-slate-200'
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xl font-black text-slate-900 tracking-wide">{asset.fleet_id}</span>
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isDown ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <div className="text-xs font-bold text-slate-700 mt-1">{asset.make_model}</div>
                <div className="text-[10px] text-slate-500">{asset.asset_type}</div>
              </div>

              <div className="mt-4 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> {asset.location || 'Workshop Yard'}
                </span>
                <span className="font-bold text-slate-700 uppercase">{asset.priority || 'Routine'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}