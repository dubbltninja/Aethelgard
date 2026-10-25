// U72 (docs/ART.md §7, D-124, DESIGN §17.2, §17.7): the overlay registry — every painted place and the Heartstone's three
// state paintings has an entry, every point lies inside the 1200 × 500 frame, particle counts stay within 24, the registry
// reads the paintings in the art folder, reduced motion stills the layers, and the portal marker and the infection follow state.
import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocationArtSchema, type LocationArt } from '@schema/location';
import type { Backdrop } from '@ui/art/backdropChooser';
import { OVERLAYS, PARTICLE_TONE, resolveOverlay, type OverlayQuery } from '@ui/art/overlays';
import { Scene, type SceneState } from '@ui/art/Scene';
import { PARTICLE_MOTION, SCENE_H, SCENE_W, makeParticles, type ParticleKind } from '@ui/art/sceneLayers';
import { uiRng } from '@ui/art/uiRng';
import { buildContentPack, contentTables } from '@content/index';

const pack = buildContentPack(contentTables, { validate: false });
const LOCATIONS = Object.values(pack.locations);
const artIds = readdirSync('public/art/scenes')
  .filter((n) => n.endsWith('.webp') && !n.includes('@sm'))
  .map((n) => n.replace(/\.webp$/, ''))
  .sort();

describe('the registry', () => {
  test('every location, and every painting in public/art, has an entry; nothing else does', () => {
    expect(LOCATIONS).toHaveLength(73);
    for (const l of LOCATIONS) expect(OVERLAYS[l.id], l.id).toBeDefined();
    for (const id of artIds) expect(OVERLAYS[id], id).toBeDefined();
    expect(Object.keys(OVERLAYS).sort()).toEqual(artIds);
    for (const state of ['stabilized', 'exploited', 'destroyed']) expect(OVERLAYS[`loc_heartstone_depths~${state}`]).toBeDefined();
  });

  test('every point and area lies inside the frame; strengths and sizes are sane', () => {
    const inside = (x: number, y: number): boolean => x >= 0 && x <= SCENE_W && y >= 0 && y <= SCENE_H;
    for (const [id, o] of Object.entries(OVERLAYS)) {
      expect(o.tint, id).toBeGreaterThanOrEqual(0);
      expect(o.tint, id).toBeLessThanOrEqual(1.5);
      if (o.glow !== undefined) {
        expect(inside(o.glow.x, o.glow.y), `${id} glow`).toBe(true);
        expect(o.glow.r, id).toBeGreaterThan(20);
        expect(o.glow.r, id).toBeLessThanOrEqual(160);
        expect(o.glow.strength, id).toBeGreaterThan(0);
        expect(o.glow.strength, id).toBeLessThanOrEqual(0.7);
      }
      if (o.particles !== undefined) {
        const [x0, y0, x1, y1] = o.particles.area;
        expect(inside(x0, y0) && inside(x1, y1), `${id} area`).toBe(true);
        expect(x1 > x0 && y1 > y0, `${id} area order`).toBe(true);
        expect(o.particles.rate, id).toBeGreaterThan(0);
        expect(o.particles.rate, id).toBeLessThanOrEqual(1);
        if (o.particles.kind !== undefined) expect(o.particles.kind, id).not.toBe('none');
      }
      if (o.portal !== undefined) expect(inside(o.portal.x, o.portal.y), `${id} portal`).toBe(true);
    }
  });

  test('the registry stays small and the Library alone has a portal', () => {
    expect(JSON.stringify(OVERLAYS).length).toBeLessThan(26_000);
    expect(Object.entries(OVERLAYS).filter(([, o]) => o.portal !== undefined).map(([id]) => id)).toEqual(['loc_shattered_library']);
  });

  test('the destroyed Heartstone has no glow and no particles; the others have both', () => {
    expect(OVERLAYS['loc_heartstone_depths~destroyed']).toEqual({ tint: 0 });
    for (const key of ['loc_heartstone_depths', 'loc_heartstone_depths~stabilized', 'loc_heartstone_depths~exploited']) {
      expect(OVERLAYS[key]?.glow, key).toBeDefined();
      expect(OVERLAYS[key]?.particles, key).toBeDefined();
    }
  });

  test('interiors and the Threshold take no hour; open-air paintings do', () => {
    for (const id of ['loc_darkened_corridor', 'loc_sunken_archives', 'loc_far_light', 'loc_still_shore', 'loc_veil_mouth', 'loc_cistern_of_names']) expect(OVERLAYS[id]?.tint, id).toBe(0);
    for (const id of ['loc_whispering_ruins', 'loc_ash_wind_flats', 'loc_bone_orchard', 'loc_cistern_gardens']) expect(OVERLAYS[id]?.tint, id).toBe(1);
  });
});

describe('particles', () => {
  const kinds = Object.keys(PARTICLE_MOTION) as Exclude<ParticleKind, 'none'>[];

  test('every kind, at every rate, stays within 24 and inside its area', () => {
    for (const kind of kinds) {
      for (const rate of [0.1, 0.5, 1, 3]) {
        const set = makeParticles(kind, uiRng(`k:${kind}`), { rate, area: [100, 150, 400, 300] });
        expect(set?.dots.length, `${kind} ${rate}`).toBeLessThanOrEqual(24);
        expect(set?.dots.length, `${kind} ${rate}`).toBeGreaterThanOrEqual(1);
        for (const d of set?.dots ?? []) {
          expect(d.x).toBeGreaterThanOrEqual(100);
          expect(d.x).toBeLessThanOrEqual(400);
          expect(d.y).toBeGreaterThanOrEqual(150);
          expect(d.y).toBeLessThanOrEqual(300);
        }
      }
    }
    expect(makeParticles('none', uiRng('x'))).toBeNull();
  });

  test('the new kinds are named for DESIGN §17.2 and have their own colours', () => {
    for (const kind of ['dust', 'mist', 'void_flecks'] as const) {
      expect(PARTICLE_MOTION[kind]).toBeDefined();
      expect(PARTICLE_TONE[kind]).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(PARTICLE_MOTION.mist.puff).toBe(true);
  });

  test('where the painting suggests: embers over the Emberforge hearth, ash on the Steppe, spores in the Shallows', () => {
    const q = (id: string): OverlayQuery => {
      const art = (pack.locations[id] as { art: LocationArt }).art;
      return { locationId: id, key: id, own: true, baseArt: art, art, portalOpen: false };
    };
    const forge = resolveOverlay(q('loc_emberforge'));
    expect(forge.particles?.kind).toBe('embers');
    expect(forge.particles?.area[0]).toBeGreaterThan(700);
    expect(resolveOverlay(q('loc_ash_wind_flats')).particles?.kind).toBe('ash');
    expect(resolveOverlay(q('loc_sporelight_shallows')).particles?.kind).toBe('spores');
    expect(resolveOverlay(q('loc_veil_mouth')).particles?.kind).toBe('void_flecks');
  });

  test('an art variant that changes the particles beats the registry (the Depths gone dark, the bell’s static)', () => {
    const base = LocationArtSchema.parse({ template: 'ruins', particles: 'motes' });
    const dark = { ...base, particles: 'none' as const };
    const r = resolveOverlay({ locationId: 'loc_spire_crown', key: 'loc_spire_crown', own: true, baseArt: base, art: dark, portalOpen: false });
    expect(r.particles).toBeNull();
    const static_ = { ...base, particles: 'static' as const };
    expect(resolveOverlay({ locationId: 'loc_plaza_of_bells', key: 'loc_plaza_of_bells', own: true, baseArt: base, art: static_, portalOpen: false }).particles?.kind).toBe('static');
  });

  test('an unregistered or borrowed painting: the art’s own particles, no glow, the art’s hour', () => {
    const art = LocationArtSchema.parse({ template: 'ruins', particles: 'ash', timeOfDay: 'dusk' });
    const r = resolveOverlay({ locationId: 'loc_x', key: 'loc_x', own: true, baseArt: art, art, portalOpen: false });
    expect(r).toMatchObject({ tint: 1, glow: null, portal: null, particles: { kind: 'ash' } });
    const borrowed = resolveOverlay({ locationId: 'loc_x', key: 'loc_emberforge', own: false, baseArt: art, art, portalOpen: false });
    expect(borrowed.glow).toBeNull();
    expect(resolveOverlay({ locationId: 'loc_x', key: 'loc_x', own: true, baseArt: art, art: { ...art, timeOfDay: 'timeless' }, portalOpen: false }).tint).toBe(0);
  });
});

// ---- the painted view --------------------------------------------------------------------------------------------------------

const calm: SceneState = { horde: false, heartstone: 'intact', watch: 2, loop: 1 };
const place = (id: string) => pack.locations[id] as NonNullable<(typeof pack.locations)[string]>;
const backdrop = (key: string, source: Backdrop['source'] = 'own'): Backdrop => ({ key, locationId: key.split('~')[0] as string, source, lg: `art/scenes/${key}.webp`, sm: `art/scenes/${key}@sm.webp` });
const render = (id: string, state: SceneState = calm, over: { reducedMotion?: boolean; art?: LocationArt; key?: string; source?: Backdrop['source'] } = {}): string => {
  const l = place(id);
  return renderToStaticMarkup(
    <Scene location={l} state={state} art={over.art ?? l.art} reducedMotion={over.reducedMotion ?? false} seed={id} backdrop={backdrop(over.key ?? id, over.source)} />,
  );
};
const layers = (html: string): string[] => [...html.matchAll(/data-layer="([a-z-]+)"/g)].map((m) => m[1] as string);

describe('the painted view with overlays', () => {
  test('every painted place renders ≤ 24 particles and one glow at most', () => {
    for (const l of LOCATIONS) {
      const html = render(l.id);
      expect(html.match(/class="scene__particle"/g)?.length ?? 0, l.id).toBeLessThanOrEqual(24);
      expect(html.match(/data-layer="glow"/g)?.length ?? 0, l.id).toBeLessThanOrEqual(1);
      expect(html.match(/data-layer="portal"/g)?.length ?? 0, l.id).toBe(0);
    }
  });

  test('layer order: hour → legibility → glow → particles → Breach', () => {
    expect(layers(render('loc_emberforge', { ...calm, breachOverlay: 0.3 }))).toEqual(['wash', 'legibility', 'glow', 'particles', 'breach-dark', 'breach']);
    // a timeless interior takes no hour at all; the destroyed Heartstone is bare
    expect(layers(render('loc_darkened_corridor'))).toEqual(['legibility', 'glow', 'particles']);
    expect(layers(render('loc_heartstone_depths', { ...calm, heartstone: 'destroyed' }, { key: 'loc_heartstone_depths~destroyed', source: 'variant' }))).toEqual(['legibility']);
  });

  test('the hour’s wash is scaled by the painting’s tint', () => {
    const wash = (id: string): number => Number(/class="scene__wash" data-layer="wash"/.test(render(id)) ? /opacity="([0-9.]+)" class="scene__wash"/.exec(render(id))?.[1] : 0);
    expect(wash('loc_whispering_ruins')).toBeCloseTo(0.05, 3);
    expect(wash('loc_scholars_corridor')).toBeCloseTo(0.02, 3);
    expect(wash('loc_veil_mouth')).toBe(0);
  });

  test('reduced motion stills everything: no particles, no animation class on the glow, the glow itself stays', () => {
    for (const l of LOCATIONS) {
      const html = render(l.id, calm, { reducedMotion: true });
      expect(html, l.id).not.toContain('scene__particle');
      expect(html, l.id).toContain('data-motion="off"');
    }
    const still = render('loc_emberforge', calm, { reducedMotion: true });
    expect(still).toContain('data-layer="glow"');
    expect(render('loc_emberforge')).toContain('scene__particle');
    expect(render('loc_emberforge')).toContain('data-motion="on"');
  });

  test('the Heartstone’s paintings carry their own overlays', () => {
    const at = (state: 'intact' | 'stabilized' | 'exploited' | 'destroyed', patch: Partial<LocationArt> = {}): string => {
      const l = place('loc_heartstone_depths');
      const key = state === 'intact' ? 'loc_heartstone_depths' : `loc_heartstone_depths~${state}`;
      return render('loc_heartstone_depths', { ...calm, heartstone: state }, { key, source: state === 'intact' ? 'own' : 'variant', art: { ...l.art, ...patch } });
    };
    expect(at('intact')).toContain('stop-color="#8fc4ff"');
    expect(at('stabilized')).toContain('stop-color="#7fb4ff"');
    expect(at('exploited', { particles: 'static' })).toContain('stop-color="#b37bff"');
    expect(at('destroyed', { particles: 'none' })).not.toContain('data-layer="glow"');
  });

  test('a mist kind draws soft puffs, not dots', () => {
    const html = render('loc_plaza_of_bells');
    expect(html).toContain('scene__particles--puff');
    expect(html).toContain('fill="url(#scene-loc_plaza_of_bells-puff)"');
    expect(html).toContain('<radialGradient id="scene-loc_plaza_of_bells-puff">');
  });

  describe('the portal marker', () => {
    const open: SceneState = { ...calm, horde: true, portalOpen: true };
    test('absent until the portal opens, then a marker (and no second glow) at the Library', () => {
      const closed = render('loc_shattered_library');
      expect(closed).not.toContain('data-layer="portal"');
      expect(closed).toContain('data-layer="glow"');
      expect(closed).toContain('aria-label="Shattered Library"');
      const html = render('loc_shattered_library', open);
      expect(html).toContain('data-layer="portal"');
      expect(html).toContain('cx="600" cy="285"');
      expect(html).not.toContain('data-layer="glow"');
      expect(html).toContain('Ilyra’s portal burns open here.');
    });

    test('content’s own opening (the library_portal focal) shows it too; no other place ever does', () => {
      const l = place('loc_shattered_library');
      const html = render('loc_shattered_library', calm, { art: { ...l.art, focal: 'library_portal', particles: 'shards' } });
      expect(html).toContain('data-layer="portal"');
      expect(html).toContain('scene__particles--drift');
      for (const other of LOCATIONS.filter((x) => x.id !== 'loc_shattered_library')) expect(render(other.id, open), other.id).not.toContain('data-layer="portal"');
    });

    test('it is marked on a borrowed painting too (information, not decoration), but the glow is not', () => {
      const html = render('loc_shattered_library', open, { key: 'loc_grand_library', source: 'region' });
      expect(html).toContain('data-layer="portal"');
      expect(html).toContain('data-layer="tint"');
      expect(html).not.toContain('data-layer="glow"');
    });

    test('it stays when motion is reduced (drawn, not animated)', () => {
      const html = render('loc_shattered_library', open, { reducedMotion: true });
      expect(html).toContain('data-layer="portal"');
      expect(html).not.toContain('scene__particle"');
    });
  });

  describe('infection', () => {
    test('an infected place darkens and hatches the painting; a clean one does not', () => {
      for (const l of LOCATIONS) {
        expect(layers(render(l.id)), l.id).not.toContain('breach');
        const html = render(l.id, { ...calm, horde: true, infected: true });
        expect(html, l.id).toContain('opacity="0.55" data-breach=""');
        expect(html, l.id).toContain('data-layer="breach-dark"');
      }
    });

    test('U70’s value, when given, sets the strength (and the darkening follows it)', () => {
      const html = render('loc_emberforge', { ...calm, breachOverlay: 0.2 });
      expect(html).toContain('opacity="0.2" data-breach=""');
      expect(html).toContain('opacity="0.06" data-layer="breach-dark"');
    });
  });
});
