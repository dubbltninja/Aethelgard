// U71 (docs/ART.md §1, §7; D-124): the scene manifest built from the art folder's names, the fallback chooser (own painting,
// Heartstone variant, region-mate by map distance, the parametric SVG), the failure registry, exit preloading, and the painted
// view (picture sources, the @sm media query, overlay order, reduced motion), plus the Title's credit line.
import { afterEach, describe, expect, test } from 'bun:test';
import zlib from 'node:zlib';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocationArtSchema, type LocationArt } from '@schema/location';
import {
  MAX_MATES,
  TITLE_KEY,
  backdropChain,
  backdropFailures,
  chooseBackdrop,
  chooseTitleArt,
  markBackdropFailed,
  preloadUrls,
  resetBackdropFailures,
  subscribeBackdropFailures,
  variantFor,
  type Backdrop,
  type PlacedLocation,
} from '@ui/art/backdropChooser';
import { Scene, type SceneState } from '@ui/art/Scene';
import { LEGIBILITY_EDGE, SMALL_MEDIA, SceneBackdrop, TitleBackdrop } from '@ui/art/SceneBackdrop';
import { EMPTY_MANIFEST, buildSceneManifest, hasPaintings, paintingCount, sceneManifest } from '@ui/art/sceneManifest';
import { ART_CREDIT, CreditsView } from '@ui/screens/TitleScreen';
import { buildContentPack, contentTables } from '@content/index';
import { expand } from '../tree';

afterEach(() => resetBackdropFailures());

const DEPTHS_FILES = [
  'loc_heartstone_depths.webp',
  'loc_heartstone_depths@sm.webp',
  'loc_heartstone_depths~destroyed.webp',
  'loc_heartstone_depths~destroyed@sm.webp',
  'loc_heartstone_depths~stabilized.webp',
  'loc_heartstone_depths~stabilized@sm.webp',
];

describe('buildSceneManifest', () => {
  test('pairs sizes, groups ~state variants, finds the title, ignores strays, sorts keys', () => {
    const m = buildSceneManifest(
      ['loc_b.webp', 'loc_b@sm.webp', 'loc_a.webp', 'notes.txt', 'Loc_Bad.webp', 'loc_c@sm.webp', ...DEPTHS_FILES],
      ['title.webp', 'title@sm.webp', 'readme.md'],
    );
    expect(Object.keys(m.scenes)).toEqual(['loc_a', 'loc_b', 'loc_c', 'loc_heartstone_depths']);
    expect(m.scenes.loc_b).toEqual({ lg: 'art/scenes/loc_b.webp', sm: 'art/scenes/loc_b@sm.webp', variants: {} });
    // a missing size borrows the other
    expect(m.scenes.loc_a).toEqual({ lg: 'art/scenes/loc_a.webp', sm: 'art/scenes/loc_a.webp', variants: {} });
    expect(m.scenes.loc_c?.lg).toBe('art/scenes/loc_c@sm.webp');
    expect(Object.keys(m.scenes.loc_heartstone_depths?.variants ?? {})).toEqual(['destroyed', 'stabilized']);
    expect(m.scenes.loc_heartstone_depths?.variants.destroyed).toEqual({
      lg: 'art/scenes/loc_heartstone_depths~destroyed.webp',
      sm: 'art/scenes/loc_heartstone_depths~destroyed@sm.webp',
    });
    expect(m.title).toEqual({ lg: 'art/title.webp', sm: 'art/title@sm.webp' });
    expect(paintingCount(m)).toBe(1 + 4 + 2);
    expect(hasPaintings(m)).toBe(true);
  });

  test('a variant without its base image is dropped; no files, no paintings; same names in any order, same manifest', () => {
    const m = buildSceneManifest(['loc_x~destroyed.webp']);
    expect(m.scenes).toEqual({});
    expect(buildSceneManifest([], [])).toEqual(EMPTY_MANIFEST);
    expect(hasPaintings(EMPTY_MANIFEST)).toBe(false);
    expect(JSON.stringify(buildSceneManifest([...DEPTHS_FILES].reverse()))).toBe(JSON.stringify(buildSceneManifest(DEPTHS_FILES)));
  });

  test('inlined, because the full set (73 places + 3 variants + title, both sizes) stays under 2 kB gzip', () => {
    const real = buildContentPack(contentTables, { validate: false });
    const ids = Object.keys(real.locations);
    expect(ids.length).toBeGreaterThanOrEqual(73);
    const files = ids.flatMap((id) => [`${id}.webp`, `${id}@sm.webp`]);
    for (const s of ['stabilized', 'exploited', 'destroyed']) files.push(`loc_heartstone_depths~${s}.webp`, `loc_heartstone_depths~${s}@sm.webp`);
    const full = buildSceneManifest(files, ['title.webp', 'title@sm.webp']);
    expect(paintingCount(full)).toBe(ids.length + 4);
    expect(zlib.gzipSync(JSON.stringify(full), { level: 9 }).length).toBeLessThan(2000);
  });

  test('under bun test no manifest is defined, so the game shows the parametric scenes', () => {
    expect(sceneManifest()).toEqual(EMPTY_MANIFEST);
  });
});

// a small map: region R has a (0,0) painted, b (0,4) painted, c (0,1) unpainted, d (3,0) painted, e (0,9) painted; region S none
const at = (id: string, regionId: string, x: number, y: number): PlacedLocation => ({ id, regionId, map: { x, y } });
const LOCS: Record<string, PlacedLocation> = {
  a: at('a', 'R', 0, 0),
  b: at('b', 'R', 0, 4),
  c: at('c', 'R', 0, 1),
  d: at('d', 'R', 3, 0),
  e: at('e', 'R', 0, 9),
  f: at('f', 'R', 0, 3),
  s: at('s', 'S', 0, 2),
  loc_heartstone_depths: at('loc_heartstone_depths', 'H', 0, 0),
};
const MANIFEST = buildSceneManifest(['a.webp', 'b.webp', 'd.webp', 'e.webp', 'f.webp', 'f@sm.webp', ...DEPTHS_FILES]);
const chain = (id: string, hs: Parameters<typeof backdropChain>[1] = 'intact'): Backdrop[] => backdropChain(LOCS[id] as PlacedLocation, hs, LOCS, MANIFEST);
const keys = (bs: readonly Backdrop[]): string[] => bs.map((b) => `${b.source}:${b.key}`);

describe('the fallback chooser', () => {
  test('own painting first, then region-mates nearest by map distance (ties by id), at most MAX_MATES', () => {
    expect(keys(chain('a'))).toEqual(['own:a', 'region:d', 'region:f', 'region:b']);
    expect(MAX_MATES).toBe(3);
    // c (0,1) is unpainted: a is 1 away, f 2, b 3, d √10
    expect(keys(chain('c'))).toEqual(['region:a', 'region:f', 'region:b']);
    expect(chain('c')[0]).toMatchObject({ locationId: 'a', lg: 'art/scenes/a.webp' });
  });

  test('a region with no painting → empty chain → the SVG (null)', () => {
    expect(chain('s')).toEqual([]);
    expect(chooseBackdrop(chain('s'), new Set())).toBeNull();
  });

  test('the Heartstone Depths take the variant for the state, then their base; intact and unknown states the base', () => {
    expect(keys(chain('loc_heartstone_depths', 'destroyed'))).toEqual(['variant:loc_heartstone_depths~destroyed', 'own:loc_heartstone_depths']);
    expect(keys(chain('loc_heartstone_depths', 'stabilized'))[0]).toBe('variant:loc_heartstone_depths~stabilized');
    expect(keys(chain('loc_heartstone_depths', 'exploited'))).toEqual(['own:loc_heartstone_depths']); // no file for it
    expect(keys(chain('loc_heartstone_depths', 'intact'))).toEqual(['own:loc_heartstone_depths']);
    expect(variantFor('intact')).toBeNull();
    expect(variantFor(undefined)).toBeNull();
    expect(variantFor('destroyed')).toBe('destroyed');
  });

  test('a failed load steps down the chain, ending at the SVG', () => {
    const c = chain('a');
    expect(chooseBackdrop(c, new Set())?.key).toBe('a');
    expect(chooseBackdrop(c, new Set(['a']))?.key).toBe('d');
    expect(chooseBackdrop(c, new Set(['a', 'd', 'f', 'b']))).toBeNull();
    const hs = chain('loc_heartstone_depths', 'destroyed');
    expect(chooseBackdrop(hs, new Set(['loc_heartstone_depths~destroyed']))?.source).toBe('own');
  });

  test('the registry records each failure once and tells its listeners', () => {
    let calls = 0;
    const off = subscribeBackdropFailures(() => (calls += 1));
    markBackdropFailed('a');
    markBackdropFailed('a');
    expect([...backdropFailures()]).toEqual(['a']);
    expect(calls).toBe(1);
    off();
    markBackdropFailed('b');
    expect(calls).toBe(1);
  });

  test('the Title art: the manifest title unless it failed', () => {
    const m = buildSceneManifest([], ['title.webp']);
    expect(chooseTitleArt(m, new Set())).toEqual({ lg: 'art/title.webp', sm: 'art/title.webp' });
    expect(chooseTitleArt(m, new Set([TITLE_KEY]))).toBeNull();
    expect(chooseTitleArt(EMPTY_MANIFEST, new Set())).toBeNull();
  });

  test('preload: the exits’ first choices only, one size, no repeats, not the current painting', () => {
    // from c: exits a (own a), f (own f, small file), s (none), c itself borrows a → a is skipped as the current painting
    expect(preloadUrls(['a', 'f', 's', 'nowhere'], 'c', 'intact', LOCS, new Set(), false, MANIFEST)).toEqual(['art/scenes/f.webp']);
    expect(preloadUrls(['b', 'f'], 'a', 'intact', LOCS, new Set(), true, MANIFEST)).toEqual(['art/scenes/b.webp', 'art/scenes/f@sm.webp']);
    // b failed: its first choice is now its nearest mate f
    expect(preloadUrls(['b'], 'a', 'intact', LOCS, new Set(['b']), false, MANIFEST)).toEqual(['art/scenes/f.webp']);
  });

  test('the real map: every unpainted Ruins place borrows its nearest painted mate', () => {
    const real = buildContentPack(contentTables, { validate: false });
    const locs = real.locations as Record<string, PlacedLocation>;
    const m = buildSceneManifest(['loc_whispering_ruins.webp', 'loc_heartstone_depths.webp']);
    const pick = (id: string): string | undefined => chooseBackdrop(backdropChain(locs[id] as PlacedLocation, 'intact', locs, m), new Set())?.key;
    expect(pick('loc_crumbling_archway')).toBe('loc_whispering_ruins');
    // the Archives (0,8) sit 2 from both: the tie goes by id
    expect(pick('loc_sunken_archives')).toBe('loc_heartstone_depths');
    expect(pick('loc_mistwood_path')).toBeUndefined();
  });
});

const art = (over: Partial<LocationArt> = {}): LocationArt => LocationArtSchema.parse({ template: 'ruins', particles: 'motes', ...over });
const loc = (a: LocationArt = art()) => ({ id: 'loc_test' as const, name: 'Test Place', regionId: 'region_silverwood_ruins' as const, art: a });
const calm: SceneState = { horde: false, heartstone: 'intact', watch: 2, loop: 1 };
const own: Backdrop = { key: 'loc_test', locationId: 'loc_test', source: 'own', lg: 'art/scenes/loc_test.webp', sm: 'art/scenes/loc_test@sm.webp' };
const paint = (props: Partial<Parameters<typeof Scene>[0]> = {}): string =>
  renderToStaticMarkup(<Scene location={loc()} state={calm} reducedMotion={false} seed="s1" backdrop={own} {...props} />);
const layers = (html: string): string[] => [...html.matchAll(/data-layer="([a-z]+)"/g)].map((m) => m[1] as string);

describe('the painted view', () => {
  test('a named image holding a decorative <picture>: @sm below 760 px, the large file otherwise, lazy and async', () => {
    const html = paint();
    expect(html).toContain('role="img" aria-label="Test Place"');
    expect(html).toContain('data-backdrop="own"');
    expect(html).toContain('<picture class="scene__backdrop" aria-hidden="true">');
    expect(html).toContain(`<source media="${SMALL_MEDIA}" srcSet="art/scenes/loc_test@sm.webp"/>`);
    expect(SMALL_MEDIA).toBe('(max-width: 759.98px)');
    expect(html).toMatch(/<img class="scene__painting" src="art\/scenes\/loc_test.webp" alt="" width="1440" height="600" loading="lazy" decoding="async"/);
    // the parametric layers are not drawn
    expect(html).not.toContain('-sky)');
    expect(html).not.toContain('scene__mid');
  });

  test('without a backdrop (or with null) the scene is U64’s SVG', () => {
    expect(paint({ backdrop: null })).toMatch(/^<svg class="scene"/);
    expect(renderToStaticMarkup(<Scene location={loc()} state={calm} reducedMotion={false} seed="s1" />)).toContain('scene__mid');
  });

  test('overlay order: region tint → hour → legibility → particles → Breach', () => {
    const borrowed: Backdrop = { ...own, source: 'region', key: 'loc_other', locationId: 'loc_other' };
    expect(layers(paint({ backdrop: borrowed, state: { ...calm, breachOverlay: 0.2 } }))).toEqual(['tint', 'wash', 'legibility', 'particles', 'breach']);
    expect(layers(paint())).toEqual(['wash', 'legibility', 'particles']);
    expect(layers(paint({ location: loc(art({ timeOfDay: 'timeless', particles: 'none' })) }))).toEqual(['legibility']);
    expect(paint()).toContain(`stop-opacity="${LEGIBILITY_EDGE}"`);
    expect(paint({ state: { ...calm, horde: true, infected: true } })).toContain('opacity="0.55" data-breach=""');
  });

  test('particles: at most 24 and none at all under reduced motion', () => {
    for (const particles of LocationArtSchema.shape.particles.removeDefault().options) {
      const html = paint({ location: loc(art({ particles })) });
      expect((html.match(/<circle /g) ?? []).length).toBeLessThanOrEqual(24);
    }
    const still = paint({ reducedMotion: true });
    expect(still).not.toContain('<circle');
    expect(still).toContain('data-motion="off"');
  });

  test('deterministic from the seed', () => {
    expect(paint()).toBe(paint());
  });

  test('a failed load marks the image failed (the container then re-chooses)', () => {
    const img = expand(<SceneBackdrop location={loc()} state={calm} reducedMotion seed="s" backdrop={own} />).find((n) => n.type === 'img');
    (img?.props.onError as () => void)();
    expect(backdropFailures().has('loc_test')).toBe(true);
  });

  test('the Title backdrop: same picture treatment, its own error hook', () => {
    let failed = false;
    const nodes = expand(<TitleBackdrop files={{ lg: 'art/title.webp', sm: 'art/title@sm.webp' }} onError={() => (failed = true)} />);
    expect(nodes.find((n) => n.type === 'source')?.props.srcSet).toBe('art/title@sm.webp');
    const img = nodes.find((n) => n.type === 'img');
    expect(img?.props.alt).toBe('');
    (img?.props.onError as () => void)();
    expect(failed).toBe(true);
  });

  test('Credits name Grok Imagine only when a painting ships (ART §8)', () => {
    const text = (credit: boolean): string => renderToStaticMarkup(<CreditsView onBack={() => {}} artCredit={credit} />);
    expect(text(true)).toContain(ART_CREDIT);
    expect(ART_CREDIT).toBe('Scene backdrops made with Grok Imagine; art direction by Tim Dibert.');
    expect(text(false)).not.toContain('Grok');
  });
});
