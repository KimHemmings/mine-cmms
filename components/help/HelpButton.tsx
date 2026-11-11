'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LifeBuoy, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useFeedback } from '@/components/ui/FeedbackProvider';

type HelpKind = 'SUPERVISOR' | 'SYSTEM';

interface HelpMessage {
  id: string;
  kind: HelpKind;
  message: string;
  fleet_id: string | null;
  status: 'OPEN' | 'DONE';
  created_by_name: string | null;
  created_at: string;
  handled_by_name: string | null;
}

const KINDS: { id: HelpKind; label: string; hint: string; placeholder: string }[] = [
  {
    id: 'SUPERVISOR',
    label: 'Message the supervisor',
    hint: 'Parts, a decision, or help on a job. Supervisors see it here. It does not send a text.',
    placeholder: 'e.g. Waiting on a hotshot for WT-020. Can you call stores?',
  },
  {
    id: 'SYSTEM',
    label: 'Report a system problem',
    hint: 'The screen is wrong, a button did nothing, or a save failed. A supervisor will see it.',
    placeholder: 'e.g. I pressed Release Machine and the card stayed on the board.',
  },
];

function MessageList({
  title,
  items,
  empty,
  showDone,
  handlingId,
  onDone,
}: {
  title: string;
  items: HelpMessage[];
  empty: string;
  showDone: boolean;
  handlingId: string | null;
  onDone: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h3>
      {items.length === 0 && empty && <p className="text-sm text-slate-500">{empty}</p>}
      {items.map((item) => (
        <article key={item.id} className="rounded-xl border border-slate-200 p-3 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className={item.kind === 'SYSTEM' ? 'text-rose-700' : 'text-amber-700'}>
              {item.kind === 'SYSTEM' ? 'System problem' : 'To supervisor'}
            </span>
            <span className="text-slate-400">{formatWhen(item.created_at)}</span>
            {item.status === 'DONE' ? (
              <span className="text-emerald-700">Done{item.handled_by_name ? ` · ${item.handled_by_name}` : ''}</span>
            ) : (
              <span className="text-slate-500">Open</span>
            )}
          </div>
          <p className="text-sm text-slate-800">
            <strong>{item.created_by_name || 'Someone'}</strong>
            {item.fleet_id ? ` · ${item.fleet_id}` : ''}
          </p>
          <p className="text-base text-slate-900 whitespace-pre-wrap">{item.message}</p>
          {showDone && item.status === 'OPEN' && (
            <button
              type="button"
              onClick={() => onDone(item.id)}
              disabled={handlingId === item.id}
              className="min-h-10 mt-1 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {handlingId === item.id ? 'Saving...' : 'Mark done'}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HelpButton({
  userRole,
  shiftId,
  fleetChoices = [],
}: {
  userRole: 'management' | 'fitter' | 'training' | 'production';
  shiftId: string | null;
  fleetChoices?: string[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<HelpKind>('SUPERVISOR');
  const [fleetId, setFleetId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [handlingId, setHandlingId] = useState<string | null>(null);

  const selected = KINDS.find((item) => item.id === kind) ?? KINDS[0];
  const isManagement = userRole === 'management';
  const isTraining = userRole === 'training';
  const isProduction = userRole === 'production';
  const supervisorLabel = isTraining ? 'Tell the supervisor' : isProduction ? 'Tell the workshop' : 'Message the supervisor';
  const intro = isManagement
    ? 'Messages waiting on you.'
    : isTraining
      ? 'Tell the supervisor about a ticket or a person.'
      : isProduction
        ? 'Tell the workshop, and pick the machine from this shift.'
        : 'Message the supervisor, or report a problem with this screen.';
  const messagePlaceholder = isTraining
    ? 'e.g. Crane ticket now applies to D Crew.'
    : isProduction
      ? 'e.g. No one passed out on this unit for the prestart.'
      : selected.placeholder;
  const waiting = messages.filter((item) => item.status === 'OPEN');
  const handled = messages.filter((item) => item.status === 'DONE');
  const openCount = waiting.length;

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('help_messages')
      .select('id, kind, message, fleet_id, status, created_by_name, created_at, handled_by_name')
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) return;
    setMessages((data ?? []) as HelpMessage[]);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel('help-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'help_messages' }, () => {
        void loadMessages();
      })
      .subscribe();
    const firstLoad = setTimeout(() => {
      void loadMessages();
    }, 0);
    return () => {
      clearTimeout(firstLoad);
      supabase.removeChannel(channel);
    };
  }, [loadMessages, supabase]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleSend() {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    const sentKind = isManagement ? 'SYSTEM' : kind;
    const { error } = await supabase.from('help_messages').insert({
      kind: sentKind,
      message: text,
      fleet_id: fleetId.trim() || null,
      shift_id: shiftId,
    });
    setSending(false);
    if (error) {
      showToast({ message: 'Message was not sent. Try again.', tone: 'error' });
      return;
    }
    setMessage('');
    setFleetId('');
    showToast({
      message: sentKind === 'SUPERVISOR' ? 'Sent to the supervisor' : 'Problem reported',
      tone: 'success',
    });
    void loadMessages();
  }

  async function markDone(id: string) {
    setHandlingId(id);
    const { error } = await supabase.from('help_messages').update({ status: 'DONE' }).eq('id', id);
    setHandlingId(null);
    if (error) {
      showToast({ message: 'Could not mark that message done.', tone: 'error' });
      return;
    }
    void loadMessages();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative min-h-11 flex items-center gap-1.5 px-4 bg-white hover:bg-amber-50 border border-slate-300 hover:border-amber-300 text-slate-700 text-sm font-bold rounded-xl transition"
      >
        <LifeBuoy className="w-4 h-4" />
        Help
        {isManagement && openCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center">
            {openCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-title"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 id="help-title" className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <LifeBuoy className="w-5 h-5 text-amber-600" /> Help
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">{intro}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isManagement && (
              <div className="space-y-3">
                <MessageList
                  title="Waiting on you"
                  items={waiting}
                  empty="No messages waiting."
                  showDone
                  handlingId={handlingId}
                  onDone={markDone}
                />
                {handled.length > 0 && (
                  <MessageList title="Handled" items={handled.slice(0, 8)} empty="" showDone={false} handlingId={null} onDone={markDone} />
                )}
              </div>
            )}

            {!isManagement && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {KINDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setKind(item.id)}
                    aria-pressed={kind === item.id}
                    className={`min-h-12 px-3 py-2 rounded-xl border-2 text-left text-sm font-bold transition ${
                      kind === item.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {item.id === 'SUPERVISOR' ? supervisorLabel : item.label}
                  </button>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-600">
              {isManagement
                ? 'Report a problem with this screen. It stays with the messages above.'
                : isTraining && kind === 'SUPERVISOR'
                  ? 'A supervisor sees this on Help. It does not send a text.'
                  : isProduction && kind === 'SUPERVISOR'
                    ? 'The workshop supervisor sees this on Help.'
                    : selected.hint}
            </p>

            {!isTraining && (
              isProduction ? (
                <label className="block space-y-1">
                  <span className="text-sm font-bold text-slate-700">Machine</span>
                  <select
                    value={fleetId}
                    onChange={(event) => setFleetId(event.target.value)}
                    className="w-full min-h-12 px-3 rounded-xl border border-slate-300 text-base font-bold bg-white"
                  >
                    <option value="">No particular machine</option>
                    {fleetChoices.map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block space-y-1">
                  <span className="text-sm font-bold text-slate-700">Machine (optional)</span>
                  <input
                    value={fleetId}
                    onChange={(event) => setFleetId(event.target.value)}
                    maxLength={40}
                    placeholder="e.g. WT-020"
                    className="w-full min-h-12 px-3 rounded-xl border border-slate-300 text-base"
                  />
                </label>
              )
            )}

            <label className="block space-y-1">
              <span className="text-sm font-bold text-slate-700">Message</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={messagePlaceholder}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="min-h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-base font-bold text-white disabled:opacity-50"
              >
                {sending ? 'Sending...' : isManagement || kind === 'SYSTEM' ? 'Report problem' : supervisorLabel}
              </button>
            </div>

            {!isManagement && (
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <MessageList
                  title="Your messages"
                  items={messages}
                  empty="Nothing sent yet."
                  showDone={false}
                  handlingId={handlingId}
                  onDone={markDone}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
