'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import {
  BASE_SITE_GLOSSARY,
  GlossaryEntry,
  correctSiteSpeech,
  mergeGlossary,
  termsToRemember,
} from '@/utils/siteTerminology';

interface DictationMicButtonProps {
  onTranscript: (spokenText: string) => void;
  disabled?: boolean;
  className?: string;
}

type SpeechResult = { isFinal: boolean; 0?: { transcript?: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechErrorEvent = { error?: string };

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return host.SpeechRecognition || host.webkitSpeechRecognition || null;
}

function supabaseRemember(terms: string[]) {
  const supabase = createClient();
  void supabase
    .from('site_glossary')
    .upsert(
      terms.map((term) => ({ term, source: 'auto' })),
      { onConflict: 'term', ignoreDuplicates: true }
    )
    .then(({ error }) => {
      if (error) console.error('[dictate] glossary learn:', error.message);
    });
}

/** Add a spoken phrase to an existing field, with a space and a capital letter. */
export function appendDictation(current: string, spoken: string) {
  const piece = spoken.trim();
  if (!piece) return current;
  const capital = piece.charAt(0).toUpperCase() + piece.slice(1);
  if (!current.trim()) return capital;
  return `${current.replace(/\s+$/, '')} ${capital}`;
}

export default function DictationMicButton({ onTranscript, disabled = false, className = '' }: DictationMicButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const listeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const glossaryRef = useRef<GlossaryEntry[]>(BASE_SITE_GLOSSARY);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    setSupported(Boolean(recognitionCtor()));
    let cancelled = false;
    const supabase = createClient();
    void supabase
      .from('site_glossary')
      .select('term, spoken_alias')
      .limit(300)
      .then(({ data }) => {
        if (!cancelled && data) glossaryRef.current = mergeGlossary(data);
      });
    return () => {
      cancelled = true;
      listeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  function stop() {
    listeningRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const recognition = recognitionRef.current ?? new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-AU';
    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal && result[0]?.transcript) parts.push(result[0].transcript);
      }
      const spoken = correctSiteSpeech(parts.join(' ').trim(), glossaryRef.current);
      if (spoken) {
        onTranscriptRef.current(spoken);
        const learned = termsToRemember(spoken, glossaryRef.current);
        if (learned.length > 0) {
          void supabaseRemember(learned);
        }
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        listeningRef.current = false;
      }
      setListening(false);
    };
    recognition.onend = () => {
      if (!listeningRef.current) {
        setListening(false);
        return;
      }
      try {
        recognition.start();
      } catch {
        listeningRef.current = false;
        setListening(false);
      }
    };
    listeningRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch {
      stop();
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-lg border-2 text-sm font-bold disabled:opacity-50 ${
        listening
          ? 'bg-rose-600 border-rose-700 text-white animate-pulse'
          : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
      } ${className}`}
    >
      {listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      {listening ? 'Listening... Tap to Stop' : 'Dictate'}
    </button>
  );
}
