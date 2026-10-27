import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_GRANTED_ECHOES } from '@schema/echo';

// D-082: every Echo id the engine grants by itself must be on ENGINE_GRANTED_ECHOES, so the validator (rule 16)
// does not reject it once the real Echo catalog exists.
function engineFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? engineFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('ENGINE_GRANTED_ECHOES', () => {
  const literals = new Set<string>();
  for (const file of engineFiles('src/engine')) {
    for (const m of readFileSync(file, 'utf8').matchAll(/'(echo_[a-z0-9_]+)'/g)) literals.add(m[1] as string);
  }

  test('lists every Echo literal granted in src/engine', () => {
    for (const id of literals) expect(ENGINE_GRANTED_ECHOES).toContain(id);
  });

  test('covers the templated ending Echoes a–f', () => {
    for (const l of 'abcdef') expect(ENGINE_GRANTED_ECHOES).toContain(`echo_ending_${l}`);
  });
});
