'use client';

import { X } from 'lucide-react';
import { Authorisation, AuthorisationState, CrewAuthorisation, CrewMember, authorisationState } from '@/types';

const STATE_LABEL: Record<AuthorisationState, { label: string; className: string }> = {
  expired: { label: 'Expired', className: 'bg-rose-100 text-rose-800' },
  due: { label: 'Due soon', className: 'bg-amber-100 text-amber-900' },
  current: { label: 'Current', className: 'bg-emerald-100 text-emerald-800' },
  not_held: { label: 'Not held', className: 'bg-slate-100 text-slate-600' },
};

function ItemList({
  title,
  items,
  byAuth,
  empty,
}: {
  title: string;
  items: Authorisation[];
  byAuth: Map<string, string>;
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
          {items.map((item) => {
            const expires = byAuth.get(item.id) ?? null;
            const style = STATE_LABEL[authorisationState(expires)];
            return (
              <li key={item.id} className="p-3 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-900">{item.name}</span>
                <span className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-black uppercase ${style.className}`}>{style.label}</span>
                  {expires && <span className="block text-xs text-slate-500 mt-0.5">{expires.slice(0, 10)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AuthLight({ light }: { light: 'expired' | 'due' | null }) {
  if (!light) return null;
  const expired = light === 'expired';
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-black uppercase ${expired ? 'text-rose-700' : 'text-amber-700'}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${expired ? 'bg-rose-600' : 'bg-amber-400'}`} />
      {expired ? 'Expired' : 'Due soon'}
    </span>
  );
}

export function PersonAuthorisationsDialog({
  person,
  authorisations,
  holdings,
  onClose,
}: {
  person: CrewMember;
  authorisations: Authorisation[];
  holdings: CrewAuthorisation[];
  onClose: () => void;
}) {
  const byAuth = new Map(
    holdings.filter((row) => row.crew_member_id === person.id).map((row) => [row.authorisation_id, row.expires_on])
  );
  const tickets = authorisations.filter((item) => item.kind !== 'SOP');
  const dueSops = authorisations.filter((item) => {
    if (item.kind !== 'SOP') return false;
    const state = authorisationState(byAuth.get(item.id) ?? null);
    return state === 'due' || state === 'expired';
  });

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="person-auth-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="person-auth-title" className="text-xl font-black text-slate-900">{person.display_name}</h2>
            <p className="text-sm text-slate-600">{person.trade}{person.panel ? ` · ${person.panel}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ItemList title="Authorisations" items={tickets} byAuth={byAuth} empty="No authorisations are set up." />
        <ItemList title="SOPs due or expired" items={dueSops} byAuth={byAuth} empty="No SOPs are due or expired." />
        <p className="text-xs text-slate-500">Current SOPs stay with training. This list is read only.</p>
      </div>
    </div>
  );
}
