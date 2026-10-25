// The sprite registry (U73a; docs/ART-2.md §2, §5, §7; D-128): UI-side data keyed by creature id — which file draws each
// creature, its size class, which way the stored figure faces, and, for the anomaly variants, which base sprite they reuse and the
// code effect that marks them. The content is C1-frozen, so none of this lives on the creature records; a unit test holds the
// registry to the pack (every creature has an entry, every base is a drawn creature).
//
// Size classes (ART-2 §2): the stored height of the trimmed sprite — small 256, medium 384, large 512, huge 768 px. The stage
// scales every figure by the same factor, so a huge boss dominates and a small mote stays small.
//
// Facing (ART-2 §1): creatures are stored facing left (they stand on the right of the stage, facing the player); class and
// companion sprites face right. A figure that must face the other way is mirrored in CSS (`flip`): the Redundant Wayfinder is
// the player's own class sprite standing on the enemy side.
//
// Variants (ART-2 §7, the brief's list): doubled (Echoed, Doubled, Stutter; Frayed and the Paired Aberration; the Rootbound Pack
// and the One-Herd as three), flicker / phase (Phase Stalker, Late Mireling), a tint (Flat-Chord, Unfiled, Early, Still,
// Seeding), split (Split Wisp), tethered (a line between the Tethered Stalkers), painted-over (Unlit Lantern), and the Wayfinder
// (the class sprite, greyed and flickering).

export type SizeClass = 'small' | 'medium' | 'large' | 'huge';
export type Facing = 'left' | 'right';

/** ART-2 §2: the stored height of each size class, in px. */
export const SIZE_PX: Readonly<Record<SizeClass, number>> = { small: 256, medium: 384, large: 512, huge: 768 };

export type TintId = 'flat' | 'unfiled' | 'early' | 'still' | 'seeding';

export type SpriteEffect =
  | { kind: 'doubled'; copies: 2 | 3 }
  | { kind: 'phase' }
  | { kind: 'tint'; tint: TintId }
  | { kind: 'split' }
  | { kind: 'tethered' }
  | { kind: 'painted' }
  | { kind: 'wayfinder' };

export type EffectKind = SpriteEffect['kind'];

export interface CreatureSpriteDef {
  size: SizeClass;
  /** The creature whose sprite this one reuses (anomaly variants); absent → its own file. */
  base?: string;
  /** Drawn with the player's class sprite (the Redundant Wayfinder). */
  classSprite?: true;
  effect?: SpriteEffect;
}

const own = (size: SizeClass): CreatureSpriteDef => ({ size });
const variant = (base: string, size: SizeClass, effect: SpriteEffect): CreatureSpriteDef => ({ size, base, effect });

/** Every creature in the pack (tests/unit/ui/art/sprites.test.tsx holds this to `content.creatures`). */
export const CREATURE_SPRITES: Readonly<Record<string, CreatureSpriteDef>> = {
  // ---- small (256 px) ----
  cr_rootling: own('small'),
  cr_arcane_wisp: own('small'),
  cr_moment_moth: own('small'),
  cr_paradox_wisp: own('small'),
  cr_glass_mote: own('small'),
  cr_spore_drift: own('small'),
  cr_hourglass_crawler: own('small'),
  cr_hour_leech: own('small'),
  cr_hollow_lantern: own('small'),
  cr_barrow_light: own('small'),
  // ---- medium (384 px) ----
  cr_corrupted_shade: own('medium'),
  cr_mistwood_prowler: own('medium'),
  cr_drowned_archivist: own('medium'),
  cr_warding_pillar: own('medium'),
  cr_void_touched_stalker: own('medium'),
  cr_shimmering_phantom: own('medium'),
  cr_aetherial_weaver: own('medium'),
  cr_glowfen_mireling: own('medium'),
  cr_horde_husk: own('medium'),
  cr_unmade: own('medium'),
  cr_stutter_hound: { size: 'medium', effect: { kind: 'doubled', copies: 2 } },
  cr_veil_sentry: own('medium'),
  cr_steppe_harrier: own('medium'),
  cr_lantern_toad: own('medium'),
  cr_ley_hound: own('medium'),
  cr_city_watch_halberdier: own('medium'),
  cr_circle_adept: own('medium'),
  cr_tide_clerk: own('medium'),
  cr_pale_diver: own('medium'),
  cr_brine_lamprey: own('medium'),
  cr_salt_jackal: own('medium'),
  cr_null_mouth: own('medium'),
  cr_gale_kite: own('medium'),
  // ---- large (512 px) ----
  cr_wildling_brute: own('large'),
  cr_stone_hide_golem: own('large'),
  cr_sky_whisper_sentinel: own('large'),
  cr_temporal_aberration: own('large'),
  cr_tyrants_reach: own('large'),
  cr_orrery_knight: own('large'),
  cr_ninefold_knight: own('large'),
  cr_ledger_choir: own('large'),
  cr_bell_ringer: own('large'),
  cr_cinderback: own('large'),
  cr_reed_stalker: own('large'),
  cr_starved_shadow: own('large'),
  cr_spire_loom: own('large'),
  cr_cloud_ray: own('large'),
  // ---- huge (768 px) ----
  cr_bell_warden: own('huge'),
  cr_unraveling_tide: own('huge'),
  cr_chronos_tyrant_contained: own('huge'),
  cr_chronos_tyrant_unveiled: own('huge'),
  cr_unbroken_warden: own('huge'),
  cr_ashmaw: own('huge'),
  cr_vells_umbra: own('huge'),
  cr_lantern_matron: own('huge'),
  cr_stormcrown: own('huge'),
  // ---- anomaly variants: a base sprite + a code effect (ART-2 §7) ----
  cr_anomaly_echoed_shade: variant('cr_corrupted_shade', 'medium', { kind: 'doubled', copies: 2 }),
  cr_anomaly_doubled_phantom: variant('cr_shimmering_phantom', 'medium', { kind: 'doubled', copies: 2 }),
  cr_anomaly_frayed_brute: variant('cr_wildling_brute', 'large', { kind: 'doubled', copies: 2 }),
  cr_anomaly_aberration_pair: variant('cr_temporal_aberration', 'large', { kind: 'doubled', copies: 2 }),
  cr_anomaly_rootbound_pack: variant('cr_rootling', 'small', { kind: 'doubled', copies: 3 }),
  cr_anomaly_one_herd: variant('cr_salt_jackal', 'medium', { kind: 'doubled', copies: 3 }),
  cr_anomaly_phase_stalker: variant('cr_void_touched_stalker', 'medium', { kind: 'phase' }),
  cr_anomaly_late_mireling: variant('cr_glowfen_mireling', 'medium', { kind: 'phase' }),
  cr_anomaly_flat_chord_weaver: variant('cr_aetherial_weaver', 'medium', { kind: 'tint', tint: 'flat' }),
  cr_anomaly_unfiled_archivist: variant('cr_drowned_archivist', 'medium', { kind: 'tint', tint: 'unfiled' }),
  cr_anomaly_early_hound: variant('cr_ley_hound', 'medium', { kind: 'tint', tint: 'early' }),
  cr_anomaly_still_kite: variant('cr_gale_kite', 'medium', { kind: 'tint', tint: 'still' }),
  cr_anomaly_seeding_toad: variant('cr_lantern_toad', 'medium', { kind: 'tint', tint: 'seeding' }),
  cr_anomaly_split_wisp: variant('cr_arcane_wisp', 'small', { kind: 'split' }),
  cr_anomaly_tethered_stalkers: variant('cr_void_touched_stalker', 'medium', { kind: 'tethered' }),
  cr_anomaly_unlit_lantern: variant('cr_hollow_lantern', 'small', { kind: 'painted' }),
  cr_redundant_wayfinder: { size: 'medium', classSprite: true, effect: { kind: 'wayfinder' } },
};

/** A figure ready to draw: the file id, its size class, its code effect, and whether to mirror it. */
export interface ResolvedSprite {
  /** `cr_*`, `class_*` or `companion_*` (the manifest key). */
  file: string;
  size: SizeClass;
  effect: SpriteEffect | null;
  /** Mirror the stored figure (it faces away from where it must look). */
  flip: boolean;
}

/** Which way a stored file faces (ART-2 §1): heroes right, creatures left. */
export const storedFacing = (file: string): Facing => (file.startsWith('class_') || file.startsWith('companion_') ? 'right' : 'left');

/** Mirror when the stored facing is not the one wanted. */
export const needsFlip = (file: string, wanted: Facing): boolean => storedFacing(file) !== wanted;

/** A creature on the enemy side (facing left); null for an id the registry does not know (it draws its sigil). */
export function creatureSprite(creatureId: string, classId: string, wanted: Facing = 'left'): ResolvedSprite | null {
  const def = CREATURE_SPRITES[creatureId];
  if (def === undefined) return null;
  const file = def.classSprite === true ? `class_${classId}` : (def.base ?? creatureId);
  return { file, size: def.size, effect: def.effect ?? null, flip: needsFlip(file, wanted) };
}

/** The player's class sprite (facing right, on the left of the stage). */
export const heroSprite = (classId: string, wanted: Facing = 'right'): ResolvedSprite => ({
  file: `class_${classId}`,
  size: 'medium',
  effect: null,
  flip: needsFlip(`class_${classId}`, wanted),
});

/** A companion's sprite (facing right, beside the player). */
export const companionSprite = (companionId: string, wanted: Facing = 'right'): ResolvedSprite => ({
  file: `companion_${companionId}`,
  size: 'medium',
  effect: null,
  flip: needsFlip(`companion_${companionId}`, wanted),
});

/** The creatures drawn from their own file (ART-2 §5's 56 creature sprites); every variant's base is one of them. */
export const creatureFiles = (): string[] =>
  Object.entries(CREATURE_SPRITES)
    .filter(([, d]) => d.base === undefined && d.classSprite !== true)
    .map(([id]) => id)
    .sort();
