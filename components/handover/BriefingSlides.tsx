'use client';

import { Plus, Trash2 } from 'lucide-react';
import { HandoverSlide } from '@/types';

interface BriefingSlidesProps {
  slides: HandoverSlide[];
  onChange: (slides: HandoverSlide[]) => void;
}

export default function BriefingSlides({ slides, onChange }: BriefingSlidesProps) {
  const update = (id: string, field: 'title' | 'notes', value: string) =>
    onChange(slides.map((slide) => (slide.id === id ? { ...slide, [field]: value } : slide)));

  return (
    <section className="mt-6 rounded-xl border border-slate-300 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-slate-900">Extra briefing slides</h3>
          <p className="text-sm text-slate-500">These are added to the crew PowerPoint only. The PDF stays the operational record.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...slides, { id: crypto.randomUUID(), title: '', notes: '' }])}
          className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add slide
        </button>
      </div>

      {slides.length === 0 ? (
        <p className="text-sm text-slate-500">No extra slides. Add one for a crane plan, a contractor, or anything the oncoming crew needs that is not already on the board.</p>
      ) : (
        slides.map((slide, index) => (
          <div key={slide.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={slide.title}
                onChange={(event) => update(slide.id, 'title', event.target.value)}
                placeholder={`Slide ${index + 1} title`}
                className="flex-1 min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold"
              />
              <button
                type="button"
                onClick={() => onChange(slides.filter((item) => item.id !== slide.id))}
                className="min-h-11 px-3 rounded-lg border border-slate-300 text-slate-500 hover:text-rose-700"
                aria-label="Remove slide"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={slide.notes}
              onChange={(event) => update(slide.id, 'notes', event.target.value)}
              rows={3}
              placeholder="What the oncoming crew needs to know"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        ))
      )}
    </section>
  );
}
