'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface ShiftMessage {
  id: string;
  sender_id: string | null;
  sender_name: string;
  role: string | null;
  recipient_id: string | null;
  message: string;
  created_at: string;
}

export interface ShiftFitter {
  id: string;
  display_name: string;
  employee_id: string | null;
  crew_member_id: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MESSAGE_COLUMNS = 'id, sender_id, sender_name, role, recipient_id, message, created_at';

function sinceYesterday() {
  return new Date(Date.now() - DAY_MS).toISOString();
}

function isRecent(createdAt: string) {
  const time = new Date(createdAt).getTime();
  return Number.isFinite(time) && time >= Date.now() - DAY_MS;
}

export function fitterLabel(person: { display_name: string; employee_id: string | null }) {
  return person.employee_id ? `${person.display_name} (#${person.employee_id})` : person.display_name;
}

/** The fitter this message belongs to. A fitter's own note to the supervisor has no recipient. */
export function fitterOnMessage(message: ShiftMessage, myId: string) {
  if (message.recipient_id && message.recipient_id !== myId) return message.recipient_id;
  if (message.sender_id && message.sender_id !== myId) return message.sender_id;
  return message.recipient_id ?? message.sender_id;
}

export function useShiftChat(profileId: string, isSupervisor: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ShiftMessage[]>([]);
  const [fitters, setFitters] = useState<ShiftFitter[]>([]);
  const [productionDesk, setProductionDesk] = useState<ShiftFitter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const append = useCallback((row: ShiftMessage) => {
    if (!row?.id || !isRecent(row.created_at)) return;
    setMessages((current) => {
      if (current.some((item) => item.id === row.id)) return current;
      return [...current, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('shift_chat')
      .select(MESSAGE_COLUMNS)
      .gte('created_at', sinceYesterday())
      .order('created_at', { ascending: true })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError('Chat is not ready yet.');
          setLoading(false);
          return;
        }
        setMessages((data ?? []) as ShiftMessage[]);
        setError(null);
        setLoading(false);
      });

    const channel = supabase
      .channel(`shift_messages:${profileId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shift_chat' },
        (payload) => {
          const row = payload.new as ShiftMessage;
          if (row?.id && row.message) append(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, append, profileId]);

  useEffect(() => {
    if (!isSupervisor) return;
    let cancelled = false;
    void supabase
      .from('profiles')
      .select('id, display_name, employee_id, crew_member_id')
      .eq('department', 'workshop')
      .eq('access_level', 2)
      .eq('active', true)
      .order('display_name')
      .then(({ data, error: loadError }) => {
        if (cancelled || loadError) return;
        setFitters((data ?? []) as ShiftFitter[]);
      });
    void supabase
      .from('profiles')
      .select('id, display_name, employee_id, crew_member_id')
      .eq('department', 'production')
      .eq('access_level', 3)
      .eq('active', true)
      .order('display_name')
      .then(({ data, error: loadError }) => {
        if (cancelled || loadError) return;
        setProductionDesk((data ?? []) as ShiftFitter[]);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, isSupervisor]);

  const send = useCallback(async (message: string, recipientId: string | null) => {
    const text = message.trim();
    if (!text) return { ok: false as const, error: null };
    const { data, error: insertError } = await supabase
      .from('shift_chat')
      .insert({ message: text, recipient_id: recipientId })
      .select(MESSAGE_COLUMNS)
      .single();
    if (insertError) return { ok: false as const, error: insertError.message };
    if (data) append(data as ShiftMessage);
    return { ok: true as const, error: null };
  }, [supabase, append]);

  return { messages, fitters, productionDesk, loading, error, send };
}
