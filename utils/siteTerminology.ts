export interface GlossaryEntry {
  term: string;
  spokenAliases: string[];
}

/** Built-in open-cut workshop language. Live site_glossary rows are added on top. */
export const BASE_SITE_GLOSSARY: GlossaryEntry[] = [
  { term: 'DT', spokenAliases: ['dee tee', 'd t'] },
  { term: 'DZ', spokenAliases: ['dee zee', 'd z'] },
  { term: 'EX', spokenAliases: ['e x'] },
  { term: 'GD', spokenAliases: ['gee dee', 'g d'] },
  { term: 'WT', spokenAliases: ['double u tee', 'w t'] },
  { term: 'DR', spokenAliases: ['dee are', 'd r'] },
  { term: 'LV', spokenAliases: ['ell vee', 'l v'] },
  { term: 'GET', spokenAliases: ['gee ee tee', 'g e t', 'ground engaging tools'] },
  { term: 'POS', spokenAliases: ['posse'] },
  { term: 'OCE', spokenAliases: ['oh see ee', 'o c e', 'open cut examiner'] },
  { term: 'SHMS', spokenAliases: ['ess aitch em ess', 's h m s'] },
  { term: 'SOP', spokenAliases: ['ess oh pee', 's o p'] },
  { term: 'JSA', spokenAliases: ['jay ess ay', 'j s a'] },
  { term: 'Take 5', spokenAliases: ['take five', 'take-5'] },
  { term: 'LOTO', spokenAliases: ['ell oh tee oh', 'l o t o', 'lock out tag out', 'lockout tagout'] },
  { term: 'PM', spokenAliases: ['pee em', 'preventative maintenance', 'preventive maintenance'] },
  { term: 'NDT', spokenAliases: ['en dee tee', 'n d t'] },
  { term: 'SOS', spokenAliases: ['ess oh ess', 's o s', 'scheduled oil sampling'] },
  { term: 'ETU', spokenAliases: ['ee tee you', 'e t u', 'expected time up'] },
  { term: 'Hotshot', spokenAliases: ['hot shot', 'hot-shot'] },
  { term: 'ROPS', spokenAliases: ['are oh pee ess', 'r o p s'] },
  { term: 'FOPS', spokenAliases: ['eff oh pee ess', 'f o p s'] },
  { term: 'AFFF', spokenAliases: ['ay eff eff eff', 'a f f f'] },
  { term: 'Fire Suppression', spokenAliases: ['fire suppression'] },
  { term: 'LH', spokenAliases: ['ell aitch', 'l h', 'lhs'] },
  { term: 'RH', spokenAliases: ['ar aitch', 'r h', 'rhs'] },
  { term: 'Strut', spokenAliases: ['strut'] },
  { term: 'Final Drive', spokenAliases: ['final drive', 'finaldrive'] },
  { term: 'Trunnion', spokenAliases: ['trunnion', 'trunion'] },
  { term: 'Equalizer Bar', spokenAliases: ['equalizer bar', 'equaliser bar'] },
  { term: 'A-Frame', spokenAliases: ['a frame', 'a-frame'] },
  { term: 'Belly Plate', spokenAliases: ['belly plate'] },
  { term: 'Hydraulic Hose', spokenAliases: ['hydraulic hose'] },
  { term: 'Chafe', spokenAliases: ['chafe'] },
  { term: 'Turbo Blanket', spokenAliases: ['turbo blanket'] },
  { term: 'Grid Box', spokenAliases: ['grid box'] },
  { term: 'Track Tensioner', spokenAliases: ['track tensioner'] },
  { term: 'Kingpin', spokenAliases: ['kingpin', 'king pin'] },
  { term: 'Hoist Cylinder', spokenAliases: ['hoist cylinder'] },
];

const FLEET_PREFIXES = ['DT', 'DZ', 'EX', 'GD', 'WT', 'DR', 'LV'];
const POSITION_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
};

const ACRONYM_STOP = new Set([
  'THE', 'AND', 'FOR', 'WAS', 'ARE', 'NOT', 'BUT', 'THIS', 'WITH', 'FROM',
  'HAVE', 'HAS', 'HAD', 'YOU', 'YOUR', 'OUR', 'DONE', 'NEW', 'OLD', 'OIL',
  'AIR', 'CAB', 'TOP', 'END', 'OUT', 'OFF', 'ALL', 'ANY', 'WO', 'SAP',
]);

export function mergeGlossary(
  live: { term?: string | null; spoken_alias?: string | null }[] = []
): GlossaryEntry[] {
  const byTerm = new Map<string, GlossaryEntry>();
  for (const entry of BASE_SITE_GLOSSARY) {
    byTerm.set(entry.term.toLowerCase(), { term: entry.term, spokenAliases: [...entry.spokenAliases] });
  }
  for (const row of live) {
    const term = row.term?.trim();
    if (!term) continue;
    const key = term.toLowerCase();
    const alias = row.spoken_alias?.trim();
    const existing = byTerm.get(key);
    if (existing) {
      if (alias && !existing.spokenAliases.some((item) => item.toLowerCase() === alias.toLowerCase())) {
        existing.spokenAliases.push(alias);
      }
      continue;
    }
    byTerm.set(key, { term, spokenAliases: alias ? [alias] : [] });
  }
  return [...byTerm.values()];
}

export function glossaryInstruction(entries: GlossaryEntry[]) {
  const lines = entries.map((entry) => {
    const aliases = entry.spokenAliases
      .map((alias) => alias.trim())
      .filter((alias) => alias && alias.toLowerCase() !== entry.term.toLowerCase())
      .slice(0, 4);
    return aliases.length ? `${entry.term} (if heard as: ${aliases.join(', ')})` : entry.term;
  });
  return [
    'SITE TERMS. Write every term below exactly as shown. Never rewrite local mining language into generic corporate, automotive, or workshop wording.',
    'Fleet numbers stay hyphenated, for example DT-041.',
    lines.join('\n'),
  ].join('\n');
}

function escapeAlias(alias: string) {
  return alias.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

function replacePhrase(text: string, alias: string, term: string) {
  const pattern = escapeAlias(alias);
  if (!pattern) return text;
  return text.replace(new RegExp(`(?<![A-Za-z0-9])${pattern}(?![A-Za-z0-9])`, 'gi'), term);
}

/** Fix speech-to-text misses and keep fleet numbers hyphenated. */
export function correctSiteSpeech(text: string, entries: GlossaryEntry[] = BASE_SITE_GLOSSARY) {
  let next = text;
  next = next.replace(/\bposition\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/gi, (_, raw: string) => {
    const number = POSITION_WORDS[raw.toLowerCase()] ?? raw;
    return `POS ${number}`;
  });
  next = next.replace(/\bposse\s+(\d+)\b/gi, 'POS $1');

  const replacements = entries
    .flatMap((entry) => entry.spokenAliases.map((alias) => ({ alias: alias.trim(), term: entry.term })))
    .filter((item) => item.alias && item.alias.toLowerCase() !== item.term.toLowerCase())
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const item of replacements) {
    const shortSpokenWord = !item.alias.includes(' ') && item.alias.length < 4;
    if (shortSpokenWord) continue;
    next = replacePhrase(next, item.alias, item.term);
  }

  for (const entry of entries) {
    if (entry.term === entry.term.toUpperCase()) continue;
    next = replacePhrase(next, entry.term, entry.term);
  }

  const prefix = FLEET_PREFIXES.join('|');
  next = next.replace(new RegExp(`\\b(${prefix})[\\s-]*(\\d{1,4})\\b`, 'gi'), (_, code: string, digits: string) => {
    return `${code.toUpperCase()}-${digits}`;
  });
  return next;
}

/** New fleet numbers and capital-letter site words worth storing. */
export function termsToRemember(text: string, known: GlossaryEntry[]) {
  const seen = new Set(known.map((entry) => entry.term.toLowerCase()));
  const found: string[] = [];

  const remember = (term: string) => {
    const key = term.toLowerCase();
    if (seen.has(key) || found.length >= 8) return;
    seen.add(key);
    found.push(term);
  };

  const corrected = correctSiteSpeech(text, known);
  for (const hit of corrected.matchAll(/\b(?:DT|DZ|EX|GD|WT|DR|LV)-\d{1,4}\b/gi)) {
    remember(hit[0].toUpperCase());
  }
  for (const hit of text.match(/\b[A-Z]{3,6}\b/g) ?? []) {
    if (ACRONYM_STOP.has(hit) || FLEET_PREFIXES.includes(hit)) continue;
    remember(hit);
  }
  return found;
}
