'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface GlossaryTerm {
  id: string;
  term: string;
}

export default function SiteDictionaryPanel() {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    let cancelled = false;
    void supabase
      .from('site_glossary')
      .select('id, term')
      .order('term')
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError('The site dictionary did not load.');
          return;
        }
        setTerms((data ?? []) as GlossaryTerm[]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function addTerm() {
    const term = draft.trim();
    if (term.length < 2) return;
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('site_glossary')
      .insert({ term, source: 'manual' })
      .select('id, term')
      .single();
    if (insertError) {
      setError('That word was not saved.');
      return;
    }
    setTerms((current) => [...current, data as GlossaryTerm].sort((a, b) => a.term.localeCompare(b.term)));
    setDraft('');
  }

  return (
    <div className="border-t border-slate-200 pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="min-h-11 inline-flex items-center gap-2 px-3 rounded-lg border-2 border-slate-300 bg-white text-sm font-bold text-slate-800"
      >
        <BookOpen className="w-4 h-4" /> {open ? 'Hide site dictionary' : 'Site dictionary'}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-600">Words the workshop wants kept the way they are said on site.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addTerm();
              }}
              placeholder="Add a word, such as POS 2"
              className="min-h-11 flex-1 rounded-lg border-2 border-slate-300 bg-white px-3 text-base text-slate-900"
            />
            <button
              type="button"
              onClick={() => void addTerm()}
              className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold"
            >
              Add word
            </button>
          </div>
          {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
          {terms.length === 0 ? (
            <p className="text-sm text-slate-500">No extra words saved yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {terms.map((item) => (
                <li key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-800">
                  {item.term}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
