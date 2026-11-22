'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { UserRole } from '@/types';
import { ShiftMessage, fitterLabel, fitterOnMessage, useShiftChat } from '@/hooks/useShiftChat';
import DictationMicButton, { useDictationTarget } from '@/components/ui/DictationMicButton';

function samePerson(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function bubbleClass(mine: boolean, supervisor: boolean) {
  if (mine) return 'ml-auto bg-blue-700 text-white';
  if (supervisor) return 'mr-auto bg-amber-50 text-amber-950 border border-amber-200';
  return 'mr-auto bg-slate-100 text-slate-900';
}

function clock(iso: string) {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return '';
  return time.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function friendlySendError(message: string) {
  if (message.toLowerCase().includes('choose a fitter')) return 'Choose which fitter this is for.';
  return 'That message did not send.';
}

function seenStorageKey(profileId: string) {
  return `shift-chat-seen:${profileId}`;
}

function readSeen(profileId: string) {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = sessionStorage.getItem(seenStorageKey(profileId));
    const ids = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function writeSeen(profileId: string, ids: Set<string>) {
  try {
    sessionStorage.setItem(seenStorageKey(profileId), JSON.stringify([...ids]));
  } catch {
    // The banner still works for this page load if storage is blocked.
  }
}

export default function ShiftChatDrawer({
  senderName,
  userRole,
  profileId,
}: {
  senderName: string;
  userRole: UserRole;
  profileId: string;
}) {
  const isSupervisor = userRole === 'management';
  const { messages, fitters, loading, error, send } = useShiftChat(profileId, isSupervisor);
  const [open, setOpen] = useState(false);
  const draft = useDictationTarget();
  const [selectedId, setSelectedId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    return messages.filter((item) => {
      if (!item.sender_id && !item.recipient_id) return false;
      if (!isSupervisor) return item.sender_id === profileId || item.recipient_id === profileId;
      if (!selectedId) return false;
      return fitterOnMessage(item, profileId) === selectedId;
    });
  }, [messages, isSupervisor, profileId, selectedId]);

  const unread = useMemo(() => {
    if (!ready) return [];
    return messages.filter((item) => item.sender_id && item.sender_id !== profileId && !seen.has(item.id));
  }, [messages, profileId, seen, ready]);

  const unreadByFitter = useMemo(() => {
    const counts = new Map<string, number>();
    if (!isSupervisor) return counts;
    for (const item of unread) {
      const fitterId = fitterOnMessage(item, profileId);
      if (!fitterId) continue;
      counts.set(fitterId, (counts.get(fitterId) ?? 0) + 1);
    }
    return counts;
  }, [unread, isSupervisor, profileId]);

  useEffect(() => {
    if (loading || ready) return;
    const initial = readSeen(profileId);
    for (const item of messages) initial.add(item.id);
    writeSeen(profileId, initial);
    setSeen(initial);
    setReady(true);
  }, [loading, ready, messages, profileId]);

  useEffect(() => {
    if (!open || !ready) return;
    setSeen((current) => {
      const next = new Set(current);
      let changed = false;
      for (const item of messages) {
        if (next.has(item.id)) continue;
        if (isSupervisor && fitterOnMessage(item, profileId) !== selectedId) continue;
        next.add(item.id);
        changed = true;
      }
      if (!changed) return current;
      writeSeen(profileId, next);
      return next;
    });
  }, [open, ready, messages, selectedId, isSupervisor, profileId]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [visible, open]);

  function openChat(fitterId?: string) {
    if (isSupervisor) {
      const latest = unread[unread.length - 1];
      const next = fitterId || selectedId || (latest ? fitterOnMessage(latest, profileId) : '') || '';
      if (next) setSelectedId(next);
    }
    setOpen(true);
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.value.trim();
    if (!text || sending) return;
    if (isSupervisor && !selectedId) {
      setSendError('Choose which fitter this is for.');
      return;
    }
    setSending(true);
    setSendError(null);
    const result = await send(text, isSupervisor ? selectedId : null);
    setSending(false);
    if (!result.ok) {
      setSendError(friendlySendError(result.error || ''));
      return;
    }
    draft.setValue('');
  }

  const alertNames = [...new Set(unread.map((item) => item.sender_name.replace(/\s+\(#.*\)$/, '')))];
  const alertText = !isSupervisor
    ? 'New message from the supervisor'
    : alertNames.length <= 1
      ? `New message from ${alertNames[0] || 'a fitter'}`
      : alertNames.length === 2
        ? `New messages from ${alertNames[0]} and ${alertNames[1]}`
        : `New messages from ${alertNames.length} fitters`;

  const selected = fitters.find((person) => person.id === selectedId);

  return (
    <>
      {unread.length > 0 && !open && (
        <button
          type="button"
          onClick={() => openChat()}
          className="fixed left-1/2 top-3 z-50 flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full border-2 border-amber-700 bg-amber-400 px-5 text-sm font-black text-amber-950 shadow-lg"
        >
          <MessageCircle className="h-4 w-4" />
          {alertText}. Tap to read.
        </button>
      )}

      {open && (
        <section
          className="fixed right-4 top-16 z-50 flex h-[min(70vh,34rem)] w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl"
          aria-label={isSupervisor ? 'Message a fitter' : 'Message the supervisor'}
        >
          <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                {isSupervisor ? 'Message a fitter' : 'Message the supervisor'}
              </h2>
              <p className="text-xs text-slate-500">
                {isSupervisor
                  ? 'Choose one fitter. The others do not see it.'
                  : 'Only the supervisor sees this. It does not go on a work order.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-10 min-w-10 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Close messages"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </header>

          {isSupervisor && (
            <div className="border-b border-slate-200 px-3 py-2 space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500">
                Send to
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold normal-case tracking-normal text-slate-900"
                >
                  <option value="">Choose a fitter</option>
                  {fitters.map((person) => {
                    const waiting = unreadByFitter.get(person.id) ?? 0;
                    return (
                      <option key={person.id} value={person.id}>
                        {fitterLabel(person)}{waiting > 0 ? ` · ${waiting} new` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
              {unreadByFitter.size > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {fitters.filter((person) => unreadByFitter.has(person.id)).map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => setSelectedId(person.id)}
                      className={`min-h-9 rounded-full px-3 text-xs font-black ${
                        person.id === selectedId
                          ? 'bg-amber-400 text-amber-950'
                          : 'bg-amber-100 text-amber-950'
                      }`}
                    >
                      {person.display_name} · {unreadByFitter.get(person.id)} new
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {loading && <p className="text-sm text-slate-500">Loading messages...</p>}
            {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
            {!loading && !error && isSupervisor && !selectedId && (
              <p className="text-sm text-slate-500">Choose which fitter you are writing to.</p>
            )}
            {!loading && !error && isSupervisor && fitters.length === 0 && (
              <p className="text-sm text-slate-500">No fitter has a sign-in yet.</p>
            )}
            {!loading && !error && (!isSupervisor || selectedId) && visible.length === 0 && (
              <p className="text-sm text-slate-500">
                {isSupervisor && selected
                  ? `No messages with ${selected.display_name} in the last day.`
                  : 'No messages from the supervisor in the last day.'}
              </p>
            )}
            {visible.map((item) => (
              <MessageBubble
                key={item.id}
                item={item}
                mine={item.sender_id === profileId || samePerson(item.sender_name, senderName)}
              />
            ))}
          </div>

          <form onSubmit={(event) => void handleSend(event)} className="border-t border-slate-200 p-3 space-y-2">
            {sendError && <p className="text-xs font-bold text-rose-700">{sendError}</p>}
            <input
              value={draft.value}
              onChange={draft.onChange}
              placeholder={isSupervisor ? 'Message this fitter...' : 'Message the supervisor...'}
              maxLength={500}
              disabled={isSupervisor && !selectedId}
              className="w-full min-h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none disabled:opacity-50"
            />
            <div className="flex items-center gap-2">
              <DictationMicButton {...draft.mic} disabled={isSupervisor && !selectedId} />
              <button
                type="submit"
                disabled={sending || !draft.value.trim() || (isSupervisor && !selectedId)}
                className="min-h-11 flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openChat())}
        aria-expanded={open}
        className={`relative inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-4 text-sm font-black shadow-sm ${
          unread.length > 0
            ? 'border-amber-700 bg-amber-400 text-amber-950'
            : 'border-slate-900 bg-slate-900 text-white'
        }`}
      >
        <MessageCircle className="h-4 w-4" />
        {unread.length > 0 ? 'New message' : 'Messages'}
        {unread.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-black text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>
    </>
  );
}

function MessageBubble({ item, mine }: { item: ShiftMessage; mine: boolean }) {
  const supervisor = !mine && item.role === 'Workshop Supervisor';
  return (
    <article className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${bubbleClass(mine, supervisor)}`}>
      {!mine && (
        <p className={`text-[11px] font-black ${supervisor ? 'text-amber-800' : 'text-slate-500'}`}>
          {item.sender_name}{item.role ? ` · ${item.role}` : ''}
        </p>
      )}
      <p className="whitespace-pre-wrap">{item.message}</p>
      <p className={`mt-1 text-[10px] font-bold ${mine ? 'text-blue-100' : 'text-slate-400'}`}>{clock(item.created_at)}</p>
    </article>
  );
}
