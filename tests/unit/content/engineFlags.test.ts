import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_WRITTEN_FLAGS } from '@schema/flags';

// D-090: every flag the engine defines as a `FLAG_*` constant is on ENGINE_WRITTEN_FLAGS, so rule 2 does not warn that
// "nothing sets" a flag the engine sets itself.
function engineFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? engineFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('ENGINE_WRITTEN_FLAGS', () => {
  test('equals the FLAG_* constants in src/engine', () => {
    const found = new Set<string>();
    for (const file of engineFiles('src/engine')) {
      for (const m of readFileSync(file, 'utf8').matchAll(/export const FLAG_[A-Z0-9_]+ = '(flag_[a-z0-9_]+)'/g)) found.add(m[1] as string);
    }
    expect([...ENGINE_WRITTEN_FLAGS].sort()).toEqual([...found].sort());
  });
});
