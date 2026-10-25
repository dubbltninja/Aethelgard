// The overlay registry (U72; docs/ART.md §7, D-124, DESIGN §17.2, §17.7): what the code draws over each painted backdrop —
// particles placed where the painting suggests them, one soft focal glow at a point of the painting, how much of the hour's
// wash the painting takes, and the Library's portal marker. UI data, not content: the location `art` records are C1-frozen, so
// this table is keyed by location id (and `<id>~<state>` for the Heartstone Depths' three state paintings, ART §1).
//
// Coordinates are the scene frame's: the same 1200 × 500 viewBox the painting fills (the 1440 × 600 file is that frame × 1.2),
// so a glow at (900, 325) sits on the same spot of the painting at every window width. Every entry was written looking at its
// painting; the note after each says what the point is. Pure data and one pure resolver (`resolveOverlay`), tested in
// tests/unit/ui/art/overlays.test.ts.
import type { LocationArt } from '@schema/location';
import { SCENE_H, SCENE_W, type Area, type ParticleKind } from './sceneLayers';

export interface OverlayParticles {
  /** Omitted: the location's own `art.particles`. */
  kind?: ParticleKind;
  /** The share of the kind's usual count, 0..1. */
  rate: number;
  area: Area;
  /** A colour; omitted: the kind's own (PARTICLE_TONE), or the region's accent for the motes-like kinds. */
  tone?: string;
}

export interface OverlayGlow {
  x: number;
  y: number;
  /** The gradient's radius; what shows is about its inner two thirds. */
  r: number;
  /** A colour; omitted: the region's accent. */
  tone?: string;
  /** 0..1, the glow's brightest point (kept low: the art is the star). */
  strength: number;
}

export interface Overlay {
  /** How much of the hour's wash the painting takes: 0 none (interiors, the Threshold), 1 the standard amount, up to 1.5. */
  tint: number;
  particles?: OverlayParticles;
  glow?: OverlayGlow;
  /** The Library's portal marker (DESIGN §16.6): where Ilyra's portal opens in the painting. */
  portal?: { x: number; y: number; r: number };
}

/** The colours of the kinds that are not the region's accent (the motes-like kinds take the accent). */
export const PARTICLE_TONE: Readonly<Partial<Record<ParticleKind, string>>> = {
  embers: '#ff9a4a',
  ash: '#d8d0c8',
  dust: '#e8dcc0',
  mist: '#cfd8e0',
  rain: '#bcd4e8',
  snow: '#ffffff',
  static: '#cfe0ff',
  shards: '#dff0ff',
  void_flecks: '#b48cff',
};

const P = (kind: ParticleKind | undefined, rate: number, x0: number, y0: number, x1: number, y1: number, tone?: string): OverlayParticles => ({
  ...(kind === undefined ? {} : { kind }),
  rate,
  area: [x0, y0, x1, y1],
  ...(tone === undefined ? {} : { tone }),
});
const G = (x: number, y: number, r: number, strength: number, tone?: string): OverlayGlow => ({ x, y, r, strength, ...(tone === undefined ? {} : { tone }) });
const O = (tint: number, particles?: OverlayParticles, glow?: OverlayGlow): Overlay => ({
  tint,
  ...(particles === undefined ? {} : { particles }),
  ...(glow === undefined ? {} : { glow }),
});

const WARM = '#ffb060';
const FIRE = '#ff9a4a';
const RED = '#ff5a3a';
const SUN = '#ffb27a';
const GOLD = '#ffd98a';
const PALE = '#e8f0ff';
const CYAN = '#7fe8ff';
const BLUE = '#8fc4ff';
const VIOLET = '#b37bff';

export const OVERLAYS: Readonly<Record<string, Overlay>> = {
  // ---- Silverwood Ruins ----
  loc_whispering_ruins: O(1, P('motes', 0.6, 100, 80, 1100, 380), G(830, 210, 90, 0.45, '#9fd8ff')), // the ley light in the arch
  loc_crumbling_archway: O(0.9, P('pollen', 0.6, 100, 100, 1100, 420), G(600, 260, 110, 0.4, '#9fd8ff')), // the gap under the keystone
  loc_darkened_corridor: O(0, P('motes', 0.5, 350, 150, 850, 400), G(600, 290, 100, 0.35, '#a8c0ff')), // the vanishing point
  loc_shattered_library: { ...O(0, P('motes', 0.6, 300, 100, 900, 400), G(470, 130, 110, 0.35, '#d8c8ff')), portal: { x: 600, y: 285, r: 95 } }, // the shaft through the broken roof; the portal on the open floor
  loc_silverwood_plaza: O(0.8, P('motes', 0.6, 300, 180, 900, 340), G(740, 300, 100, 0.4, '#9fd8ff')), // the right fountain's blue jets
  loc_sunken_archives: O(0, P('motes', 0.5, 350, 150, 900, 400), G(600, 400, 120, 0.4, '#7fc4ff')), // the lit water at the stair's foot
  loc_heartstone_depths: O(0, P('motes', 0.7, 400, 120, 800, 340), G(600, 250, 130, 0.55, BLUE)), // the crystal
  'loc_heartstone_depths~stabilized': O(0, P('motes', 0.5, 400, 120, 800, 340), G(600, 230, 130, 0.5, '#7fb4ff')),
  'loc_heartstone_depths~exploited': O(0, P('static', 0.6, 400, 100, 800, 340), G(600, 285, 130, 0.55, VIOLET)), // the crack at its base
  'loc_heartstone_depths~destroyed': O(0), // an empty dais: nothing glows, nothing drifts

  // ---- Mistwood & Ironclad Reach ----
  loc_mistwood_path: O(0.8, P('spores', 0.5, 150, 120, 1050, 390, '#cfe0c0')), // pale spores in the fog; the ember veins are the glow
  loc_wayfarers_respite: O(0.8, P('embers', 0.3, 720, 300, 830, 360), G(771, 355, 90, 0.45, FIRE)), // the tent's fire
  loc_ironclad_camp: O(0.8, P('embers', 0.5, 560, 220, 680, 300), G(612, 300, 100, 0.5, FIRE)), // the central fire
  loc_barren_peaks: O(0.8, P('ash', 0.5, 0, 60, 1200, 420), G(1030, 250, 80, 0.45, '#ff7a2a')), // the ember-lit caves
  loc_blighted_outpost: O(0.8, P('ash', 0.5, 150, 100, 1100, 380), G(690, 275, 80, 0.5, '#ff7a2a')), // fire in the broken gate
  loc_emberforge: O(0.2, P('embers', 0.8, 780, 230, 1040, 340), G(900, 325, 120, 0.55, '#ff7a2a')), // the hearth

  // ---- The Voidscar ----
  loc_chasm_of_whispers: O(0.5, P('void_flecks', 0.6, 480, 250, 720, 480), G(600, 430, 120, 0.5, VIOLET)), // the light rising from the rift
  loc_voidscar_hollow: O(0.5, P('void_flecks', 0.5, 200, 150, 1000, 420), G(620, 370, 110, 0.5, VIOLET)), // the crystal bloom

  // ---- Aether-Kissed Highlands ----
  loc_shimmering_pass: O(0.5, P('shards', 0.5, 100, 100, 1100, 400), G(640, 248, 100, 0.5, PALE)), // the far light at the pass's end
  loc_aetherium_spires: O(0.6, P('motes', 0.6, 380, 60, 820, 340), G(600, 330, 130, 0.5, PALE)), // the base of the tallest spire
  loc_sky_whisper_plateau: O(0.6, P('dust', 0.4, 100, 100, 1100, 350), G(905, 200, 70, 0.5, PALE)), // the beacon on the far rim

  // ---- Glowlands & Nexus ----
  loc_veridian_glowlands: O(0.7, P('spores', 0.6, 100, 180, 1100, 420), G(125, 295, 90, 0.4, '#7cff9e')), // the mushroom cluster
  loc_chronos_nexus: O(0, P('static', 0.5, 150, 40, 700, 300), G(1010, 260, 90, 0.3, '#7cff9e')), // the sealed door
  loc_temporal_breach_apex: O(0, P('shards', 0.5, 350, 60, 950, 400), G(650, 185, 140, 0.6, '#7cff9e')), // the wound in the sky

  // ---- Silverwood Before ----
  loc_silver_gate: O(0.6, P('motes', 0.5, 100, 100, 1100, 400), G(870, 225, 110, 0.4, SUN)), // the sunset behind the city
  loc_outer_walks: O(0.5, P('pollen', 0.4, 100, 300, 1100, 430), G(771, 300, 90, 0.45, SUN)), // the lit path under the gate
  loc_scholars_corridor: O(0.4, P('motes', 0.5, 100, 100, 700, 400), G(175, 205, 70, 0.5, WARM)), // the nearest lantern
  loc_grand_library: O(0.4, P('motes', 0.6, 450, 100, 900, 400), G(700, 230, 110, 0.4, SUN)), // the sunset in the glass vault
  loc_plaza_of_bells: O(0.5, P('mist', 0.5, 400, 200, 800, 330), G(600, 300, 100, 0.35, '#cfe0ff')), // the fountain's spray
  loc_ninefold_hall: O(0.2, P('motes', 0.4, 300, 100, 900, 350), G(600, 370, 110, 0.3, '#e8e0ff')), // the sigil on the floor
  loc_apprentices_garret: O(0.3, P('motes', 0.5, 520, 150, 760, 380, '#ffe0b0'), G(822, 232, 80, 0.5, WARM)), // the wall lamp
  loc_cistern_gardens: O(1, P('pollen', 0.5, 300, 220, 900, 420), G(880, 150, 120, 0.4, SUN)), // the sunset over the roofs
  loc_archives_of_danthe: O(0, P('motes', 0.4, 200, 100, 500, 380), G(320, 170, 70, 0.5, WARM)), // the hanging lantern
  loc_conflux_chamber: O(0, P('motes', 0.6, 450, 120, 750, 330, '#ffe9a8'), G(600, 230, 130, 0.55, GOLD)), // the golden crystal

  // ---- The Drowned Reach ----
  loc_drowned_stair: O(0, P('mist', 0.5, 150, 140, 1050, 250), G(610, 310, 90, 0.4, WARM)), // the lanterns on the stair
  loc_tidewell_hall: O(0, P('motes', 0.5, 250, 250, 800, 400), G(550, 330, 110, 0.4, '#7fffe0')), // the submerged light
  loc_cistern_of_names: O(0, P('mist', 0.4, 350, 280, 850, 400), G(600, 360, 110, 0.5, CYAN)), // the lit pool
  loc_lamplighters_rest: O(0, P('motes', 0.4, 150, 100, 450, 300, '#ffe0b0'), G(335, 205, 70, 0.5, WARM)), // the lantern by the jars
  loc_sunken_scriptorium: O(0, P('motes', 0.5, 300, 100, 900, 300), G(600, 290, 110, 0.45, CYAN)), // the pool round the lectern
  loc_black_sluice: O(0, P('rain', 0.4, 400, 100, 800, 420), G(600, 370, 110, 0.45, '#6fb4ff')), // the churned channel
  loc_bellmouth: O(0, P('static', 0.4, 300, 80, 900, 380), G(600, 330, 110, 0.45, CYAN)), // the water under the bell
  loc_bell_wardens_deep: O(0, P('mist', 0.5, 300, 300, 900, 400), G(610, 330, 120, 0.5, CYAN)), // the light round the bell's foot

  // ---- The Ashen Steppe ----
  loc_scorched_gate: O(0.8, P('ash', 0.6, 0, 60, 1200, 420), G(825, 320, 80, 0.5, '#ff7a2a')), // the brazier
  loc_ash_wind_flats: O(1, P('ash', 0.7, 0, 60, 1200, 420), G(1050, 310, 70, 0.35, RED)), // the burning patches
  loc_hearthring: O(0.8, P('embers', 0.7, 540, 200, 680, 320), G(600, 310, 110, 0.55, FIRE)), // the central fire
  loc_bone_orchard: O(1, P('ash', 0.5, 0, 60, 1200, 420)), // nothing glows among the stone herd
  loc_grey_salt_pan: O(1, P('dust', 0.4, 100, 250, 1100, 420), G(910, 240, 90, 0.3, RED)), // the red on the horizon
  loc_stormgate_cairns: O(0.8, P('dust', 0.5, 0, 80, 1200, 400), G(810, 130, 90, 0.4, PALE)), // the lightning
  loc_watchfire_ridge: O(0.8, P('embers', 0.5, 440, 60, 520, 140), G(480, 115, 70, 0.55, FIRE)), // the beacon on the peak
  loc_reedmarch_descent: O(1, P('ash', 0.6, 0, 100, 1200, 420), G(770, 300, 80, 0.3, RED)), // the embers in the grass
  loc_herd_grave: O(0.8, P('embers', 0.5, 250, 300, 950, 420), G(600, 330, 130, 0.35, RED)), // the glow in the crater floor

  // ---- The Veil ----
  loc_veil_mouth: O(0, P('void_flecks', 0.5, 300, 200, 900, 420), G(610, 285, 110, 0.5, '#c86bff')), // the far gate
  loc_stair_of_unmaking: O(0, P('void_flecks', 0.5, 350, 200, 950, 420), G(668, 182, 90, 0.5, '#c86bff')), // the gate at the stair's end
  loc_sanctum_of_threads: O(0, P('motes', 0.6, 400, 80, 800, 380), G(610, 230, 120, 0.5, '#c86bff')), // the column of light in the threads
  loc_scar_shelf: O(0, P('void_flecks', 0.5, 300, 150, 1100, 420), G(910, 155, 110, 0.55, '#c86bff')), // the vortex
  loc_voidglass_gallery: O(0, undefined, G(600, 380, 130, 0.3, VIOLET)), // the glass floor
  loc_null_orchard: O(0, P('void_flecks', 0.5, 300, 250, 900, 420), G(610, 290, 90, 0.5, '#c86bff')), // the far shrine
  loc_eye_of_the_scar: O(0, P('void_flecks', 0.5, 250, 280, 950, 440), G(600, 265, 80, 0.55, '#c86bff')), // the doorway the shadow points to
  loc_where_she_fell: O(0, P('void_flecks', 0.5, 200, 250, 1000, 420), G(614, 320, 110, 0.5, '#c86bff')), // the centre of the crater

  // ---- The Glowfen ----
  loc_lantern_causeway: O(0.7, P('motes', 0.5, 300, 150, 1000, 400), G(385, 250, 70, 0.5, '#d9ff66')), // the near lantern
  loc_lanternreed: O(0.7, P('motes', 0.5, 200, 150, 1000, 400), G(617, 231, 80, 0.5, '#d9ff66')), // the big hut's window
  loc_sporelight_shallows: O(0.7, P('spores', 0.6, 100, 150, 1100, 400), G(415, 215, 70, 0.5, '#d9ff66')), // the lantern post
  loc_elder_mangrove: O(0.7, P('fireflies', 0.6, 150, 150, 1100, 420), G(590, 250, 90, 0.45, '#d9ff66')), // the hollow in the tree
  loc_breathing_pool: O(0.7, P('spores', 0.5, 380, 220, 820, 400), G(600, 320, 120, 0.5, '#d9ff66')), // the pool's glowing mound
  loc_firefly_barrows: O(0.7, P('fireflies', 0.6, 100, 200, 1100, 380), G(710, 330, 80, 0.5, '#d9ff66')), // the big barrow's door
  loc_pale_gullet: O(0.7, P('fireflies', 0.5, 100, 150, 1100, 380), G(610, 310, 100, 0.4, '#e8ffcc')), // the pale stream
  loc_matrons_hall: O(0, P('spores', 0.5, 330, 250, 900, 420), G(620, 370, 120, 0.5, '#d9ff66')), // the lit pool round the nest

  // ---- The Skyreach ----
  loc_windward_stair: O(0.5, P('dust', 0.4, 150, 100, 1100, 350), G(600, 230, 130, 0.4, '#ffe9a8')), // the sun on the cloud sea
  loc_spire_crown: O(0.3, P('motes', 0.5, 400, 40, 800, 300), G(610, 230, 110, 0.55, '#ffe9a8')), // the crown crystal
  loc_roost_of_sentinels: O(0.6, P('dust', 0.4, 100, 80, 1100, 300), G(100, 250, 100, 0.4, '#ffe9a8')), // the sunlit edge of the cloud
  loc_auldes_eyrie: O(0.5, P('motes', 0.5, 780, 80, 1050, 400), G(560, 270, 100, 0.5, GOLD)), // the golden instrument
  loc_stormcrowns_perch: O(0.8, P('static', 0.5, 350, 50, 900, 300), G(610, 310, 130, 0.45, '#ffe9a8')), // the light under the storm

  // ---- The Threshold (no tint: it is outside the hours) ----
  loc_still_shore: O(0, undefined, G(646, 251, 40, 0.5, '#b8c7ff')), // the far light on the water
  loc_gallery_of_loops: O(0, undefined, G(1020, 290, 70, 0.5, '#cfe0ff')), // the far light right of centre
  loc_loom: O(0, P('motes', 0.4, 200, 150, 600, 380), G(650, 255, 50, 0.5, '#cfe0ff')), // the distant lighthouse
  loc_far_light: O(0, P('motes', 0.4, 400, 200, 800, 400), G(600, 270, 100, 0.55, '#ffe9b0')), // the door of light
};

// ---- resolving ----------------------------------------------------------------------------------------------------------

export interface ResolvedOverlay {
  tint: number;
  /** null: no particles (the painting's, or the variant's, kind is `none`). */
  particles: { kind: Exclude<ParticleKind, 'none'>; rate: number; area: Area; tone: string | null } | null;
  glow: OverlayGlow | null;
  portal: { x: number; y: number; r: number } | null;
}

export interface OverlayQuery {
  /** The painting's key (`<id>` or `<id>~<state>`), and whether it is the place's own (a region-mate's borrowed painting gets no glow). */
  key: string;
  own: boolean;
  /** The location's base `art` and the one its variants resolve to. */
  baseArt: Pick<LocationArt, 'particles' | 'timeOfDay'>;
  art: Pick<LocationArt, 'particles' | 'timeOfDay' | 'focal'>;
  /** Ilyra's portal is open (a Horde runs, or content opened it). */
  portalOpen: boolean;
}

const DEFAULT_AREA: Area = [0, 40, SCENE_W, SCENE_H - 60];
export const DEFAULT_RATE = 0.7;

/** The overlay for one painting: the registry's entry, or a plain default (art's particles, the art's hour) where there is none. */
export function resolveOverlay(q: OverlayQuery): ResolvedOverlay {
  const entry = q.own ? (OVERLAYS[q.key] ?? OVERLAYS[q.key.split('~')[0] as string]) : undefined;
  const tint = entry?.tint ?? (q.art.timeOfDay === 'timeless' ? 0 : 1);
  // A variant that changes the art's particles (the Depths gone dark, the bell's static) beats the registry's kind.
  const variantKind = q.art.particles !== q.baseArt.particles;
  const kind = variantKind ? q.art.particles : (entry?.particles?.kind ?? q.art.particles);
  const wanted = entry === undefined ? { rate: DEFAULT_RATE, area: DEFAULT_AREA } : entry.particles;
  const particles = kind === 'none' || wanted === undefined ? null : { kind, rate: wanted.rate, area: wanted.area, tone: entry?.particles?.tone ?? null };
  const portal = q.portalOpen || q.art.focal === 'library_portal' ? (entry?.portal ?? null) : null;
  // one focal glow at most: the portal's marker takes the place of the Library's own
  return { tint, particles, glow: portal === null ? (entry?.glow ?? null) : null, portal };
}
