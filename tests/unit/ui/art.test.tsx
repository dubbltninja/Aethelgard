// The first art pieces (U64; PLAN §6.4, DESIGN §17.1–17.2, §17.5, §17.7): <Scene> is deterministic from its seed,
// named for assistive tech, covers every schema template, keeps particles ≤ 24 and still under reduced motion, and
// hatches infected ground; region palettes follow DESIGN's table; <Icon> is decorative unless titled; uiRng is its
// own stream.
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Rng } from '@engine/index';
import { LocationArtSchema, type LocationArt } from '@schema/location';
import { ICON_KINDS, Icon, dirIcon } from '@ui/art/Icon';
import { RegionPalette, regionStyle } from '@ui/art/RegionPalette';
import { SCENE_H, SCENE_W, Scene, TEMPLATES, patchArt, type SceneState } from '@ui/art/Scene';
import { REGION_PALETTES, scenePalette, shade } from '@ui/art/palettes';
import { uiRng } from '@ui/art/uiRng';
import { buildContentPack, contentTables } from '@content/index';

const art = (over: Partial<LocationArt> = {}): LocationArt => LocationArtSchema.parse({ template: 'ruins', particles: 'motes', ...over });
const loc = (a: LocationArt = art()) => ({ id: 'loc_test' as const, name: 'Test Place', regionId: 'region_silverwood_ruins' as const, art: a });
const calm: SceneState = { horde: false, heartstone: 'intact', watch: 2, loop: 1 };
const draw = (props: Partial<Parameters<typeof Scene>[0]> = {}): string =>
  renderToStaticMarkup(<Scene location={loc()} state={calm} reducedMotion={false} seed="s1" {...props} />);

describe('Scene', () => {
  test('a named image at a fixed viewBox, deterministic from its seed', () => {
    const html = draw();
    expect(html).toContain(`viewBox="0 0 ${SCENE_W} ${SCENE_H}"`);
    expect(html).toContain('role="img" aria-label="Test Place"');
    expect(draw()).toBe(html);
    expect(draw({ seed: 's2' })).not.toBe(html);
  });

  test('every schema template renders (and an unknown one falls back)', () => {
    const templates = LocationArtSchema.shape.template.options;
    expect(Object.keys(TEMPLATES).sort()).toEqual([...templates].sort());
    for (const template of templates) {
      const html = draw({ location: loc(art({ template, timeOfDay: 'night' })) });
      expect(html).toContain(`data-template="${template}"`);
      expect(html).not.toContain('NaN');
    }
    expect(draw({ location: loc({ ...art(), template: 'nonsense' as LocationArt['template'] }) })).toContain('<svg');
  });

  test('particles: at most 24, animated only with motion on; every kind; none for none', () => {
    for (const particles of LocationArtSchema.shape.particles.removeDefault().options) {
      const html = draw({ location: loc(art({ particles })) });
      const count = (html.match(/<circle [^>]*r="[\d.]+" opacity="0.7"/g) ?? []).length;
      expect(count).toBeLessThanOrEqual(24);
      if (particles === 'none') expect(html).not.toContain('scene__particles');
    }
    expect(draw()).toContain('class="scene__particle"');
    const still = draw({ reducedMotion: true });
    expect(still).not.toContain('scene__particle"');
    expect(still).not.toContain('scene__glow');
    expect(still).toContain('data-motion="off"');
  });

  test('the hour washes outdoor scenes, not timeless ones; dawn and dusk add the accent band', () => {
    expect(draw()).toContain('scene__wash');
    expect(draw({ location: loc(art({ timeOfDay: 'timeless' })) })).not.toContain('scene__wash');
    expect(draw({ location: loc(art({ timeOfDay: 'dusk' })) })).toContain('-band)');
    expect(draw({ location: loc(art({ timeOfDay: 'day' })) })).not.toContain('url(#scene-loc_test-band)');
  });

  test('the Breach: infected ground is hatched strongly, the Horde tinges everything', () => {
    expect(draw()).not.toContain('data-breach');
    expect(draw({ state: { ...calm, horde: true } })).toContain('opacity="0.22" data-breach=""');
    expect(draw({ state: { ...calm, horde: true, infected: true } })).toContain('opacity="0.55" data-breach=""');
  });

  test('art variants patch only known keys; the scene takes the resolved art', () => {
    const base = art();
    const patched = patchArt(base, { particles: 'shards', focal: 'library_portal', bogus: 1 });
    expect(patched.particles).toBe('shards');
    expect(patched.focal).toBe('library_portal');
    expect('bogus' in patched).toBe(false);
    expect(draw({ art: art({ template: 'swamp' }) })).toContain('data-template="swamp"');
  });

  test('every real location renders without NaN', () => {
    const real = buildContentPack(contentTables, { validate: false });
    for (const l of Object.values(real.locations)) {
      if (l === undefined) continue;
      const html = renderToStaticMarkup(<Scene location={l} region={real.regions[l.regionId]} state={calm} reducedMotion seed={l.id} />);
      expect(html).not.toContain('NaN');
    }
  });
});

describe('palettes', () => {
  test('DESIGN §17.1: twelve rows, keyed by region id', () => {
    expect(Object.keys(REGION_PALETTES)).toHaveLength(12);
    expect(scenePalette('region_voidscar')).toEqual({ skyTop: '#0B0A14', skyBottom: '#2A1B3D', far: '#1C1230', mid: '#3B2A57', near: '#070610', accent: '#7B3FE4' });
  });

  test('an unlisted region derives from its content palette, else the Ruins', () => {
    const derived = scenePalette('region_new', { palette: { bg: '#102030', bgAlt: '#405060', fg: '#708090', accent: '#ffcc00', glow: '#ffcc00' } });
    expect(derived).toMatchObject({ skyTop: '#102030', skyBottom: '#405060', mid: '#708090', accent: '#ffcc00' });
    expect(scenePalette('region_new')).toEqual(REGION_PALETTES.region_silverwood_ruins!);
  });

  test('shade mixes toward black or white and leaves non-hex alone', () => {
    expect(shade('#808080', -1)).toBe('#000000');
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', 0)).toBe('#808080');
    expect(shade('red', 0.5)).toBe('red');
  });

  test('RegionPalette sets the region custom properties on a wrapper', () => {
    const html = renderToStaticMarkup(
      <RegionPalette regionId="region_glowfen" className="x">
        <p>in</p>
      </RegionPalette>,
    );
    expect(html).toContain('class="region-palette x"');
    expect(html).toContain('data-region="region_glowfen"');
    expect(html).toContain('--region-accent:#D9FF66');
    expect(html).toContain('<p>in</p>');
    expect(regionStyle('region_veil', { palette: { bg: '#000001', bgAlt: '#000002', fg: '#000003', accent: '#000004', glow: '#000005' } })).toMatchObject({ '--region-bg': '#000001', '--region-glow': '#000005', '--region-far': '#24143A' });
    expect(renderToStaticMarkup(<RegionPalette regionId="region_veil" />)).toContain('class="region-palette"');
  });
});

describe('Icon', () => {
  test('every kind draws; decorative by default, a named image with a title', () => {
    for (const kind of ICON_KINDS) {
      const html = renderToStaticMarkup(<Icon kind={kind} />);
      expect(html).toContain(`data-icon="${kind}"`);
      expect(html).toContain('aria-hidden="true"');
    }
    const named = renderToStaticMarkup(<Icon kind="hp" title="Health" size={16} className="big" />);
    expect(named).toContain('role="img" aria-label="Health"');
    expect(named).not.toContain('aria-hidden');
    expect(named).toContain('class="icon big"');
  });

  test('exit directions map to their glyph, anything else to the path', () => {
    expect(dirIcon('north')).toBe('north');
    expect(dirIcon('portal')).toBe('portal');
    expect(dirIcon('sideways')).toBe('path');
  });
});

describe('uiRng', () => {
  test('deterministic per seed, separate from the engine stream, in range', () => {
    const a = uiRng('x');
    const b = uiRng('x');
    const seq = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(seq);
    expect(Rng.fromSeed('x').next()).not.toBe(seq[0]); // the art never shares the engine's dice
    const r = uiRng('y');
    for (let i = 0; i < 200; i++) {
      const n = r.int(2, 5);
      expect(n >= 2 && n <= 5 && Number.isInteger(n)).toBe(true);
      const f = r.range(-1, 1);
      expect(f >= -1 && f < 1).toBe(true);
    }
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
  });
});
