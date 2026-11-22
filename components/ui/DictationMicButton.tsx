'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  onPartial?: (spokenText: string) => void;
  onSessionStart?: () => void;
  registerStop?: (stop: ((options?: { commit?: boolean }) => void) | null) => void;
  disabled?: boolean;
  className?: string;
}

type SpeechAlternative = { transcript?: string };
type SpeechResult = { isFinal: boolean } & ArrayLike<SpeechAlternative>;
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
  abort: () => void;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return host.SpeechRecognition || host.webkitSpeechRecognition || null;
}

function supabaseRemember(terms: string[], rememberLocally: (terms: string[]) => void) {
  rememberLocally(terms);
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

/** Show the phrase being spoken without saving it until the speaker pauses. */
export function withSpokenPreview(committed: string, partial: string) {
  return appendDictation(committed, partial);
}

export function useDictationTarget(initial = '') {
  const [committed, setCommitted] = useState(initial);
  const [partial, setPartial] = useState('');
  const committedRef = useRef(initial);
  const partialRef = useRef('');
  const heldRef = useRef(false);
  const stopListening = useRef<((options?: { commit?: boolean }) => void) | null>(null);
  const value = withSpokenPreview(committed, partial);
  const valueRef = useRef(value);
  valueRef.current = value;
  committedRef.current = committed;
  partialRef.current = partial;

  function pauseMicrophone() {
    heldRef.current = true;
    stopListening.current?.({ commit: false });
  }

  return {
    value,
    /** Stop the microphone without clearing the sentence in the box. */
    hold: () => {
      const text = valueRef.current;
      pauseMicrophone();
      return text;
    },
    setValue: (next: string) => {
      pauseMicrophone();
      partialRef.current = '';
      committedRef.current = next;
      setPartial('');
      setCommitted(next);
    },
    onChange: (event: { target: { value: string } }) => {
      partialRef.current = '';
      committedRef.current = event.target.value;
      setPartial('');
      setCommitted(event.target.value);
    },
    mic: {
      onSessionStart: useCallback(() => {
        heldRef.current = false;
      }, []),
      registerStop: useCallback((stop: ((options?: { commit?: boolean }) => void) | null) => {
        stopListening.current = stop;
      }, []),
      onPartial: (text: string) => {
        if (heldRef.current) return;
        partialRef.current = text;
        setPartial(text);
      },
      onTranscript: (spoken: string) => {
        if (heldRef.current) return;
        partialRef.current = '';
        setPartial('');
        setCommitted((current) => {
          const next = appendDictation(current, spoken);
          committedRef.current = next;
          return next;
        });
      },
    },
  };
}

function problemText(code?: string) {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Mic blocked. Click the lock, choose Allow';
  if (code === 'audio-capture') return 'No microphone found';
  if (code === 'network') return 'Dictation needs the internet';
  return 'Dictation did not start';
}

export default function DictationMicButton({
  onTranscript,
  onPartial,
  onSessionStart,
  registerStop,
  disabled = false,
  className = '',
}: DictationMicButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [heard, setHeard] = useState('');
  const recognitionRef = useRef<Recognition | null>(null);
  const listeningRef = useRef(false);
  const pendingRef = useRef('');
  const lastEmitRef = useRef({ text: '', at: 0 });
  const langRef = useRef('en-AU');
  const attemptRef = useRef(0);
  const onTranscriptRef = useRef(onTranscript);
  const onPartialRef = useRef(onPartial);
  const onSessionStartRef = useRef(onSessionStart);
  const stopImplRef = useRef<(options?: { commit?: boolean }) => void>(() => {});
  const glossaryRef = useRef<GlossaryEntry[]>(BASE_SITE_GLOSSARY);
  onTranscriptRef.current = onTranscript;
  onPartialRef.current = onPartial;
  onSessionStartRef.current = onSessionStart;

  function deliver(raw: string) {
    const trimmed = raw.trim();
    pendingRef.current = '';
    setHeard('');
    onPartialRef.current?.('');
    if (!trimmed) return;
    let spoken = trimmed;
    try {
      spoken = correctSiteSpeech(trimmed, glossaryRef.current);
    } catch {
      spoken = trimmed;
    }
    if (!spoken) return;
    const now = Date.now();
    if (lastEmitRef.current.text === spoken && now - lastEmitRef.current.at < 800) return;
    lastEmitRef.current = { text: spoken, at: now };
    onTranscriptRef.current(spoken);
    const learned = termsToRemember(spoken, glossaryRef.current);
    if (learned.length > 0) {
      supabaseRemember(learned, (terms) => {
        glossaryRef.current = mergeGlossary([
          ...glossaryRef.current.flatMap((entry) =>
            entry.spokenAliases.map((alias) => ({ term: entry.term, spoken_alias: alias }))
          ),
          ...terms.map((term) => ({ term })),
        ]);
      });
    }
  }

  function showPartial(text: string) {
    let spoken = text;
    try {
      spoken = correctSiteSpeech(text, glossaryRef.current);
    } catch {
      spoken = text;
    }
    pendingRef.current = spoken;
    setHeard(spoken);
    onPartialRef.current?.(spoken);
  }

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
      pendingRef.current = '';
      try {
        recognitionRef.current?.abort();
      } catch {
        // The recogniser may already be stopped.
      }
    };
  }, []);

  function stop(options?: { commit?: boolean }) {
    attemptRef.current += 1;
    listeningRef.current = false;
    const leftover = pendingRef.current.trim();
    pendingRef.current = '';
    setHeard('');
    try {
      recognitionRef.current?.abort();
    } catch {
      // Already stopped.
    }
    setListening(false);
    if (options?.commit !== false && leftover) deliver(leftover);
  }
  stopImplRef.current = stop;

  useEffect(() => {
    registerStop?.((options) => stopImplRef.current(options));
    return () => registerStop?.(null);
  }, [registerStop]);

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setProblem('Dictation needs Chrome or Edge');
      return;
    }
    setProblem(null);
    setHeard('');
    onSessionStartRef.current?.();
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    listeningRef.current = true;
    setListening(true);

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = langRef.current;
    recognition.onresult = (event) => {
      let finalText = '';
      let interim = '';
      const startIndex = Number.isFinite(event.resultIndex) ? event.resultIndex : 0;
      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript ?? '';
        if (result?.isFinal) finalText += text;
        else interim += text;
      }
      if (finalText.trim()) deliver(finalText);
      else if (interim.trim()) showPartial(interim);
    };
    recognition.onerror = (event) => {
      const code = event.error;
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'language-not-supported' && langRef.current !== 'en-US') {
        langRef.current = 'en-US';
        return;
      }
      listeningRef.current = false;
      pendingRef.current = '';
      setHeard('');
      onPartialRef.current?.('');
      setListening(false);
      setProblem(problemText(code));
    };
    recognition.onend = () => {
      const leftover = pendingRef.current.trim();
      if (leftover) deliver(leftover);
      if (!listeningRef.current || attempt !== attemptRef.current) {
        setListening(false);
        return;
      }
      window.setTimeout(() => {
        if (!listeningRef.current || attempt !== attemptRef.current) return;
        try {
          recognition.lang = langRef.current;
          recognition.start();
        } catch {
          listeningRef.current = false;
          setListening(false);
          setProblem('Tap Dictate again');
        }
      }, 250);
    };

    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setProblem('Dictation did not start');
    }
  }

  if (!supported) return null;

  const heardLabel = heard.trim();
  const shortHeard = heardLabel.length > 42 ? `${heardLabel.slice(0, 42)}…` : heardLabel;

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-lg border-2 text-sm font-bold disabled:opacity-50 ${
        listening
          ? 'bg-rose-600 border-rose-700 text-white'
          : problem
          ? 'bg-amber-50 border-amber-400 text-amber-950'
          : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
      } ${className}`}
    >
      {listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      {listening ? (shortHeard ? shortHeard : 'Listening... Tap to Stop') : problem ?? 'Dictate'}
    </button>
  );
}
