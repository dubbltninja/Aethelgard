// The `?gallery=<panel id>` boot (U78; PLAN §8.3): e2e builds mount one panel in the real Shell on a fixture scenario;
// the gallery's table names only panels that have a component and scenarios that exist; and a production bundle of the
// real entry keeps none of it (the build gate, as scenarioBoot.test.ts does for the scenario builders).
import { describe, expect, test } from 'bun:test';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { SCENARIO_IDS } from '@sim/scenarios';
import { legalPanels } from '@ui/panels/panels';
import { PANEL_COMPONENTS } from '@ui/panels/PanelHost';
import { GALLERY, galleryEntry } from '@ui/GalleryPage';
import { bootSearch, galleryParam } from '../../../src/main';
import { ROOT, esbuildOptions } from '../../../tools/build';

describe('the gallery table', () => {
  test('every entry is a panel with a component, on a scenario that exists and whose mode lets the panel open', () => {
    expect(Object.keys(GALLERY).length).toBe(Object.keys(PANEL_COMPONENTS).length);
    for (const [id, e] of Object.entries(GALLERY)) {
      expect(e.panel).toBe(id as typeof e.panel);
      expect(PANEL_COMPONENTS[e.panel]).toBeDefined();
      expect((SCENARIO_IDS as readonly string[]).includes(e.scenario)).toBe(true);
      expect(legalPanels('explore')).toContain(e.panel);
    }
  });

  test('an unknown id is an error naming the known ones', () => {
    expect(galleryEntry('inventory').scenario).toBe('loop1_respite');
    expect(() => galleryEntry('nowhere')).toThrow("unknown gallery component 'nowhere' (known: inventory, ");
    expect(() => galleryEntry('companion')).toThrow('unknown gallery component');
  });
});

describe('galleryParam and bootSearch (test builds are e2e builds)', () => {
  test('?gallery= names the component; none, or an empty id, is no gallery', () => {
    expect(galleryParam('?gallery=camp')).toBe('camp');
    expect(galleryParam('?gallery=')).toBeNull();
    expect(galleryParam('?scenario=first_fight')).toBeNull();
    expect(galleryParam('')).toBeNull();
  });

  test('the gallery boots from its fixture scenario unless the URL names another', () => {
    expect(bootSearch('?gallery=crafting')).toBe('?scenario=loop1_emberforge');
    expect(bootSearch('?gallery=crafting&scenario=first_fight')).toBe('?gallery=crafting&scenario=first_fight');
    expect(bootSearch('?scenario=first_fight')).toBe('?scenario=first_fight');
    expect(() => bootSearch('?gallery=nowhere')).toThrow('unknown gallery component');
  });
});

describe('the build gate: production drops the gallery, e2e keeps it', () => {
  async function bundle(mode: 'production' | 'e2e'): Promise<string> {
    const { outdir: _outdir, sourcemap: _map, entryNames: _names, assetNames: _assets, metafile: _meta, entryPoints: _entry, ...base } = esbuildOptions({
      root: ROOT,
      entry: 'src/main.tsx',
      assetsDir: path.join(ROOT, 'unused'),
      mode,
      version: 'test',
    });
    const out = await esbuild.build({ ...base, entryPoints: ['src/main.tsx'], write: false, outdir: path.join(ROOT, 'unused'), logLevel: 'silent' });
    return out.outputFiles.filter((f) => f.path.endsWith('.js')).map((f) => f.text).join('\n');
  }

  const MARKERS = ['unknown gallery component', 'gallery-heading'];

  test('src/main.tsx in production has no gallery page', async () => {
    const js = await bundle('production');
    for (const m of MARKERS) expect(js).not.toContain(m);
  }, 120_000);

  test('src/main.tsx in e2e has it', async () => {
    const js = await bundle('e2e');
    for (const m of MARKERS) expect(js).toContain(m);
  }, 120_000);
});
