'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Asset,
  Authorisation,
  CrewAuthorisation,
  CrewMember,
  CrewSupervision,
  OperatorPassout,
  PRODUCTION_PLANT,
  SupervisionLevel,
  authorisationState,
  personLight,
} from '@/types';
import { TRAINER_ASSESSOR, holdsTicket, todayKey } from '@/utils/crewStanding';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { AuthLight } from '@/components/training/PersonAuthorisations';

const STATE_WORD = { current: 'Current', due: 'Due soon', expired: 'Expired', not_held: 'Not held' };
const dateClass = 'min-h-10 px-2 rounded-lg border border-slate-300 bg-white';

export default function TrainingDesk({
  crew,
  authorisations,
  holdings,
  passouts,
  machines,
  supervision,
  onChanged,
}: {
  crew: CrewMember[];
  authorisations: Authorisation[];
  holdings: CrewAuthorisation[];
  passouts: OperatorPassout[];
  machines: Asset[];
  supervision: CrewSupervision[];
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<SupervisionLevel>('close');
  const [skill, setSkill] = useState('');
  const [assessorId, setAssessorId] = useState('');
  const [startsOn, setStartsOn] = useState(todayKey);
  const [addAssetId, setAddAssetId] = useState('');

  const people = useMemo(() => {
    const term = query.trim().toLowerCase();
    return crew
      .filter((member) => member.active)
      .filter((member) => department === 'all' || (member.department || 'Workshop') === department)
      .filter((member) => !term || [member.display_name, member.employee_id, member.trade, member.panel]
        .some((value) => value?.toLowerCase().includes(term)))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [crew, query, department]);

  const selected = crew.find((member) => member.id === selectedId) ?? null;
  const tickets = authorisations.filter((item) => item.kind !== 'SOP');
  const sops = authorisations.filter((item) => item.kind === 'SOP');
  const plant = machines.filter((asset) => (PRODUCTION_PLANT as readonly string[]).includes(asset.asset_type));
  const assessors = crew.filter((member) => member.active && holdsTicket(member.id, TRAINER_ASSESSOR, authorisations, holdings));

  function lightFor(memberId: string) {
    return personLight(holdings.filter((row) => row.crew_member_id === memberId).map((row) => row.expires_on));
  }

  function choose(member: CrewMember) {
    const row = supervision.find((item) => item.crew_member_id === member.id);
    setSelectedId(member.id);
    setLevel(row?.level ?? 'close');
    setSkill(row?.skill ?? '');
    setAssessorId(row?.assessor_id ?? '');
    setStartsOn(row?.starts_on?.slice(0, 10) || todayKey());
    setAddAssetId('');
  }

  async function saveTicket(authId: string, expiresOn: string) {
    if (!selected) return;
    const queryBuilder = expiresOn
      ? supabase.from('crew_authorisations').upsert(
          { crew_member_id: selected.id, authorisation_id: authId, expires_on: expiresOn },
          { onConflict: 'crew_member_id,authorisation_id' },
        )
      : supabase.from('crew_authorisations').delete().eq('crew_member_id', selected.id).eq('authorisation_id', authId);
    const { error } = await queryBuilder;
    if (error) {
      showToast({ message: 'Could not save that date.', tone: 'error' });
      return;
    }
    onChanged();
  }

  async function savePassout(assetId: string, expiresOn: string) {
    if (!selected) return;
    const queryBuilder = expiresOn
      ? supabase.from('operator_passouts').upsert(
          { crew_member_id: selected.id, asset_id: assetId, expires_on: expiresOn },
          { onConflict: 'crew_member_id,asset_id' },
        )
      : supabase.from('operator_passouts').delete().eq('crew_member_id', selected.id).eq('asset_id', assetId);
    const { error } = await queryBuilder;
    if (error) {
      showToast({ message: 'Could not save that pass-out.', tone: 'error' });
      return;
    }
    onChanged();
  }

  async function saveSupervision(next: { level: SupervisionLevel; skill: string; assessor_id: string; starts_on: string } | null) {
    if (!selected) return;
    const queryBuilder = next
      ? supabase.from('crew_supervision').upsert(
          { crew_member_id: selected.id, level: next.level, skill: next.skill.trim(), assessor_id: next.assessor_id, starts_on: next.starts_on },
          { onConflict: 'crew_member_id' },
        )
      : supabase.from('crew_supervision').delete().eq('crew_member_id', selected.id);
    const { error } = await queryBuilder;
    if (error) {
      showToast({ message: error.message || 'Could not save supervision.', tone: 'error' });
      return;
    }
    if (!next) {
      setSkill('');
      setAssessorId('');
    }
    onChanged();
  }

  const heldPassouts = selected ? passouts.filter((row) => row.crew_member_id === selected.id) : [];
  const supervisionRow = selected ? supervision.find((row) => row.crew_member_id === selected.id) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <section className="bg-white border border-slate-300 rounded-2xl p-3 space-y-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">People</h2>
          <p className="text-sm text-slate-600">Pick one person. Their tickets, pass-outs, and supervision are on the right.</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or employee ID"
          className="w-full min-h-10 px-3 rounded-lg border border-slate-300 text-sm"
        />
        <select value={department} onChange={(event) => setDepartment(event.target.value)} className="w-full min-h-10 px-2 rounded-lg border border-slate-300 text-sm font-bold">
          <option value="all">Workshop and production</option>
          <option value="Workshop">Workshop</option>
          <option value="Production">Production</option>
        </select>
        <ul className="max-h-[70vh] overflow-auto divide-y divide-slate-200 border border-slate-200 rounded-xl">
          {people.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => choose(member)}
                aria-current={member.id === selectedId ? 'true' : undefined}
                className={`w-full text-left px-3 py-2 ${member.id === selectedId ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-bold">
                  {member.display_name}
                  <AuthLight light={lightFor(member.id)} />
                </span>
                <span className={`block text-xs ${member.id === selectedId ? 'text-slate-300' : 'text-slate-500'}`}>
                  {member.department || 'Workshop'} · {member.trade}{member.panel ? ` · ${member.panel}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {!selected ? (
        <p className="text-sm text-slate-600 bg-white border border-slate-300 rounded-2xl p-4">Choose a person to set dates.</p>
      ) : (
        <div className="space-y-4">
          <section className="bg-white border border-slate-300 rounded-2xl p-4">
            <h2 className="text-xl font-black text-slate-900">{selected.display_name}</h2>
            <p className="text-sm text-slate-600">{selected.department || 'Workshop'} · {selected.trade}{selected.panel ? ` · ${selected.panel}` : ''}</p>
          </section>
          <DateList
            title="Tickets"
            items={tickets}
            expiresFor={(id) => holdings.find((row) => row.crew_member_id === selected.id && row.authorisation_id === id)?.expires_on ?? ''}
            onSave={saveTicket}
          />
          <DateList
            title="SOPs"
            items={sops}
            expiresFor={(id) => holdings.find((row) => row.crew_member_id === selected.id && row.authorisation_id === id)?.expires_on ?? ''}
            onSave={saveTicket}
          />
          {selected.department === 'Production' && (
            <section className="bg-white border border-slate-300 rounded-2xl p-4 space-y-3">
              <h3 className="text-lg font-black text-slate-900">Machine pass-outs</h3>
              {heldPassouts.length === 0 ? (
                <p className="text-sm text-slate-500">No machine dates yet.</p>
              ) : (
                <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                  {heldPassouts.map((row) => {
                    const asset = machines.find((item) => item.id === row.asset_id);
                    const state = authorisationState(row.expires_on);
                    return (
                      <li key={row.id} className="px-3 py-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold">{asset?.fleet_id ?? 'Machine'} <span className="font-medium text-slate-500">{STATE_WORD[state]}</span></span>
                        <input type="date" value={row.expires_on.slice(0, 10)} onChange={(event) => void savePassout(row.asset_id, event.target.value)} className={dateClass} aria-label={`${selected.display_name} ${asset?.fleet_id ?? 'machine'}`} />
                      </li>
                    );
                  })}
                </ul>
              )}
              <label className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-700">
                Add a machine
                <select value={addAssetId} onChange={(event) => setAddAssetId(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 px-2">
                  <option value="">Choose a machine</option>
                  {plant.filter((asset) => !heldPassouts.some((row) => row.asset_id === asset.id)).map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.fleet_id} · {asset.make_model}</option>
                  ))}
                </select>
                <input type="date" disabled={!addAssetId} onChange={(event) => { if (addAssetId && event.target.value) void savePassout(addAssetId, event.target.value); }} className={dateClass} aria-label="Pass-out date for the new machine" />
              </label>
            </section>
          )}
          <section className="bg-white border border-slate-300 rounded-2xl p-4 space-y-3">
            <h3 className="text-lg font-black text-slate-900">Supervision</h3>
            <p className="text-sm text-slate-600">
              {supervisionRow ? 'They are still in training. Clear this when they are competent.' : 'No supervision row. They are treated as competent.'}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Level
                <select value={level} onChange={(event) => setLevel(event.target.value as SupervisionLevel)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2">
                  <option value="close">Close supervision</option>
                  <option value="minimal">Minimal supervision</option>
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Training in
                <input value={skill} onChange={(event) => setSkill(event.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2" />
              </label>
              <label className="text-sm font-bold text-slate-700">Starts
                <input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2" />
                <span className="mt-1 block text-xs font-medium text-slate-500">Today means they are in training now. A later day shows Starts until that day.</span>
              </label>
              <label className="text-sm font-bold text-slate-700">Trainer assessor
                <select value={assessorId} onChange={(event) => setAssessorId(event.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2">
                  <option value="">{assessors.length === 0 ? 'No current trainer assessor' : 'Choose an assessor'}</option>
                  {assessors.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!skill.trim() || !assessorId || !startsOn} onClick={() => void saveSupervision({ level, skill, assessor_id: assessorId, starts_on: startsOn })} className="min-h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">
                Save supervision
              </button>
              {supervisionRow && (
                <button type="button" onClick={() => void saveSupervision(null)} className="min-h-10 px-4 rounded-lg border border-slate-300 text-sm font-bold">
                  Competent now
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DateList({
  title,
  items,
  expiresFor,
  onSave,
}: {
  title: string;
  items: Authorisation[];
  expiresFor: (id: string) => string;
  onSave: (id: string, expiresOn: string) => void;
}) {
  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-4 space-y-2">
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
        {items.map((item) => {
          const expires = expiresFor(item.id);
          const state = authorisationState(expires || null);
          return (
            <li key={item.id} className="px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-sm font-bold">{item.name} <span className="font-medium text-slate-500">{STATE_WORD[state]}</span></span>
              <input type="date" value={expires ? expires.slice(0, 10) : ''} onChange={(event) => onSave(item.id, event.target.value)} className={dateClass} aria-label={item.name} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
