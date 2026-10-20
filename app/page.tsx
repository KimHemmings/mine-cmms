'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { AlertTriangle, CheckCircle2, Clock, Wrench, RefreshCw } from 'lucide-react';

interface Asset {
  id: string;
  fleet_id: string;
  asset_type: string;
  make_model: string;
  current_hours: number;
  status: 'OPERATIONAL' | 'DOWN_UNPLANNED' | 'DOWN_PLANNED';
  location: string;
}

export default function WorkshopDashboard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    setLoading(true);
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('fleet_id', { ascending: true });

    if (error) {
      console.error('Error fetching assets:', error.message);
    } else {
      setAssets(data || []);
    }
    setLoading(false);
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const nextStatus =
      currentStatus === 'OPERATIONAL' ? 'DOWN_UNPLANNED' : 'OPERATIONAL';

    const { error } = await supabase
      .from('assets')
      .update({ status: nextStatus })
      .eq('id', id);

    if (error) {
      alert('Failed to update status: ' + error.message);
    } else {
      fetchAssets();
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-500" />
            Mine Site Maintenance Board
          </h1>
          <p className="text-sm text-slate-400">
            Real-time fleet status, downtime tracking & defect monitoring
          </p>
        </div>
        <button
          onClick={fetchAssets}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Board
        </button>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">
          Active Fleet ({assets.length})
        </h2>

        {loading ? (
          <p className="text-slate-400 text-sm">Loading equipment...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => {
              const isDown = asset.status !== 'OPERATIONAL';
              return (
                <div
                  key={asset.id}
                  className={`rounded-xl border p-5 flex flex-col justify-between transition ${
                    isDown
                      ? 'bg-rose-950/20 border-rose-800/60'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black tracking-wide text-white">
                        {asset.fleet_id}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isDown
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isDown ? (
                          <>
                            <AlertTriangle className="w-3 h-3" /> DOWN
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> OPERATIONAL
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-300 mt-1">
                      {asset.make_model}
                    </p>
                    <p className="text-xs text-slate-400">{asset.asset_type}</p>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
                      <p>
                        <span className="text-slate-500">Location:</span>{' '}
                        {asset.location || 'Unassigned'}
                      </p>
                      <p className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{asset.current_hours.toLocaleString()} hrs</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleStatus(asset.id, asset.status)}
                    className={`mt-5 w-full py-2.5 px-4 rounded-lg font-semibold text-xs tracking-wider uppercase transition ${
                      isDown
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {isDown ? 'Mark Ready (Up)' : 'Log Breakdown (Down)'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}