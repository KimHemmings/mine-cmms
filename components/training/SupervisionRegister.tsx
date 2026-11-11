'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Authorisation, CrewAuthorisation, CrewMember, CrewSupervision, SupervisionLevel } from '@/types';
import { TRAINER_ASSESSOR, holdsTicket } from '@/utils/crewStanding';
import { useFeedback } from '@/components/ui/FeedbackProvider';

const LEVEL_WORD = { close: 'Close supervision', minimal: 'Minimal supervision' };

export default function SupervisionRegister({
  crew,
  supervision,
  authorisations,
  holdings,
  onChanged,
}: {
  crew: CrewMember[];
  supervision: CrewSupervision[];
  authorisations: Authorisation[];
  holdings: CrewAuthorisation[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useFeedback();
  const people = crew.filter((member) => member.active);
  const assessors = people.filter((member) => holdsTicket(member.id, TRAINER_ASSESSOR, authorisations, holdings));
  const [personId, setPersonId] = useState('');
  const [level, setLevel] = useState<SupervisionLevel>('close');
  const [skill, setSkill] = useState('');
  const [assessorId, setAssessorId] = useState('');

  async function save(memberId: string, next: { level: SupervisionLevel; skill: string; assessor_id: string | null } | null) {
    const query = next
      ? supabase.from('crew_supervision').upsert(
          { crew_member_id: memberId, level: next.level, skill: next.skill.trim(), assessor_id: next.assessor_id },
          { onConflict: 'crew_member_id' },
        )
      : supabase.from('crew_supervision').delete().eq('crew_member_id', memberId);
    const { error } = await query;
    if (error) {
      showToast({ message: error.message || 'Could not save that supervision.', tone: 'error' });
      return;
    }
    setPersonId('');
    setSkill('');
    setAssessorId('');
    onChanged();
  }

  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
      <div>
        <h2 className="text-xl font-black text-slate-900">People in training</h2>
        <p className="text-sm text-slate-600 mt-1">
          Close supervision means the trainer assessor stays with them. Minimal supervision means the assessor is on site. A person with no row here is competent. Trainer assessor and ERT are tickets in the matrix above.
        </p>
      </div>
      {supervision.length === 0 ? (
        <p className="text-sm text-slate-500">No one is under supervision.</p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
          {supervision.map((row) => {
            const person = crew.find((member) => member.id === row.crew_member_id);
            const assessor = crew.find((member) => member.id === row.assessor_id);
            return (
              <li key={row.crew_member_id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  <strong>{person?.display_name ?? 'Unknown'}</strong>
                  {' · '}{LEVEL_WORD[row.level]}{' · '}{row.skill}
                  {' · Assessor '}{assessor?.display_name ?? 'not named'}
                </span>
                <button type="button" onClick={() => void save(row.crew_member_id, null)} className="min-h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold">
                  Competent now
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          Person
          <select value={personId} onChange={(event) => setPersonId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3">
            <option value="">Choose a person</option>
            {people.map((member) => <option key={member.id} value={member.id}>{member.display_name} · {member.panel ?? member.department}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Supervision
          <select value={level} onChange={(event) => setLevel(event.target.value as SupervisionLevel)} className="mt-1 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3">
            <option value="close">Close supervision</option>
            <option value="minimal">Minimal supervision</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Training in
          <input value={skill} onChange={(event) => setSkill(event.target.value)} placeholder="Haul truck, fitting trade" className="mt-1 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3" />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Trainer assessor
          <select value={assessorId} onChange={(event) => setAssessorId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3">
            <option value="">{assessors.length === 0 ? 'No current trainer assessor' : 'Choose an assessor'}</option>
            {assessors.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
          </select>
        </label>
      </div>
      <button
        type="button"
        disabled={!personId || !skill.trim() || !assessorId}
        onClick={() => void save(personId, { level, skill, assessor_id: assessorId })}
        className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
      >
        Save supervision
      </button>
    </section>
  );
}
