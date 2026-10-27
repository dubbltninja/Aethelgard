// A tiny regex extractor for legacy/aethelgard_data.py (PLAN §8.2 `legacy.test.ts`, Appendix A): the `description` of every
// entry of the three dict literals ITEM_DEFS, ENEMY_DEFS and LOCATION_DEFS, keyed by the legacy name. Read-only; no Python is
// run. Strings may be implicitly concatenated (`("a " "b")`) and use `\"` escapes, as the source does.
import fs from 'node:fs';
import path from 'node:path';

export const LEGACY_DATA_PATH = path.resolve(import.meta.dirname, '../legacy/aethelgard_data.py');

export type LegacyDict = 'ITEM_DEFS' | 'ENEMY_DEFS' | 'LOCATION_DEFS';

/** The text between a dict literal's braces (balanced), without the outer pair. */
function dictBody(source: string, dict: LegacyDict): string {
  const start = source.indexOf(`${dict} = {`);
  if (start < 0) throw new Error(`legacy-extract: no dict ${dict}`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      // skip a string, so a brace inside a description does not count
      for (i++; i < source.length && source[i] !== '"'; i++) if (source[i] === '\\') i++;
    } else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(source.indexOf('{', start) + 1, i);
  }
  throw new Error(`legacy-extract: unbalanced dict ${dict}`);
}

/** One Python string expression at `at`: adjacent `"…"` fragments joined, `\"` unescaped. */
function stringAt(text: string, at: number): string {
  const fragments: string[] = [];
  let i = at;
  for (;;) {
    while (i < text.length && /[\s(]/.test(text[i] ?? '')) i++;
    if (text[i] !== '"') break;
    let j = i + 1;
    let frag = '';
    for (; j < text.length && text[j] !== '"'; j++) {
      if (text[j] === '\\' && text[j + 1] === '"') {
        frag += '"';
        j++;
      } else frag += text[j];
    }
    fragments.push(frag);
    i = j + 1;
  }
  return fragments.join('');
}

/** `{ "Legacy Name": description, … }` for one dict of the legacy data file. */
export function legacyDescriptions(dict: LegacyDict, source: string = fs.readFileSync(LEGACY_DATA_PATH, 'utf8')): Record<string, string> {
  const body = dictBody(source, dict);
  const out: Record<string, string> = {};
  // top-level entries sit at four spaces of indentation: `    "Name": {`
  const entries = [...body.matchAll(/^ {4}"([^"]+)": \{/gm)];
  entries.forEach((m, k) => {
    const from = m.index ?? 0;
    const to = entries[k + 1]?.index ?? body.length;
    const block = body.slice(from, to);
    const d = /"description":\s*/.exec(block);
    if (d) out[m[1] ?? ''] = stringAt(block, d.index + d[0].length);
  });
  return out;
}
