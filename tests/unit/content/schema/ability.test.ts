// U16: AbilitySchema (PLAN §5.7). Three DESIGN §5 rows per class (15), the Amulet's itm_echo_bolt (DESIGN §5.7 as
// amended by D-067.19) and two companions' DESIGN §12.4 rows parse; derived defaults and per-record rules hold.
import { describe, expect, test } from 'bun:test';
import { AbilitySchema, COMPANION_KIND_COOLDOWN, SCRIPTED_ABILITIES, TIER_LEVELS, abilityOwnerKind, isScriptedAbility, type AbilityInput } from '@schema/ability';

const issues = (value: unknown): string[] => {
  const r = AbilitySchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const expectIssue = (value: unknown, path: string, fragment: string) => {
  const found = issues(value);
  expect(found.some((i) => i.startsWith(`${path}: `) && i.includes(fragment)), `wanted "${path}: …${fragment}…", got ${JSON.stringify(found)}`).toBe(true);
};

/** DESIGN §5.2–5.6, three rows per class. */
const CLASS_ROWS = [
  // Ranger (§5.2)
  {
    id: 'rgr_marked_shot', ownerId: 'ranger', branch: 'hunt', tier: 1, name: 'Marked Shot', description: 'Every hunt begins with a choice of prey.',
    mp: 8, target: 'enemy', damageType: 'physical', power: { coef: 1.1, stat: 'atk' }, statuses: [{ status: 'status_mark', chance: 1, duration: 3 }],
  },
  {
    id: 'rgr_piercing_arrow', ownerId: 'ranger', branch: 'hunt', tier: 2, name: 'Piercing Arrow', description: 'Hide, plate, bark. It does not care.',
    mp: 12, target: 'enemy', damageType: 'physical', power: { coef: 1.5, stat: 'atk', ignoresArmor: true },
    bonuses: [{ when: { targetHas: 'status_mark' }, mult: 1.25 }],
  },
  {
    id: 'rgr_killing_shot', ownerId: 'ranger', branch: 'hunt', tier: 5, name: 'Killing Shot', description: 'One arrow. You have been saving it since the Ruins.',
    mp: 24, target: 'enemy', damageType: 'physical', power: { coef: 2.2, stat: 'atk' }, special: 'mark_execute', onKill: { refundMp: 24 }, cooldown: 4,
  },
  // Wizard (§5.3, D-066 #3)
  {
    id: 'wiz_fireball', ownerId: 'wizard', branch: 'pyre', tier: 1, name: 'Fireball', description: 'The first spell Maelis wrote down. It still works.',
    mp: 10, target: 'enemy', damageType: 'fire', spell: true, power: { base: 3, coef: 1.2, stat: 'sp' }, statuses: [{ status: 'status_burn', chance: 0.6, duration: 3 }],
  },
  {
    id: 'wiz_echo_bolt', ownerId: 'wizard', branch: 'chronomancy', tier: 1, name: 'Echo Bolt', description: 'A moment’s residue, thrown. Cheap, clean, reliable — and no more than that.',
    mp: 10, target: 'enemy', damageType: 'ley', spell: true, power: { base: 2, coef: 1.1, stat: 'sp' },
  },
  {
    id: 'wiz_pyre_of_the_nine', ownerId: 'wizard', branch: 'pyre', tier: 5, name: 'Pyre of the Nine', description: 'The fire that lit the Conflux. You pay what they paid.',
    mp: 30, target: 'all_enemies', damageType: 'fire', spell: true, power: { base: 10, coef: 2.0, stat: 'sp' }, selfCost: { hpPctMax: 0.1 }, cooldown: 4,
    statuses: [{ status: 'status_burn', chance: 1, duration: 3 }, { status: 'status_armor_break', chance: 1, duration: 2 }],
  },
  // Elf (§5.4)
  {
    id: 'elf_twin_strike', ownerId: 'elf', branch: 'bladesong', tier: 1, name: 'Twin Strike', description: 'Two notes, one breath.',
    mp: 8, target: 'enemy', damageType: 'physical', power: { coef: 0.65, stat: 'atk', hits: 2 },
  },
  {
    id: 'elf_ambush', ownerId: 'elf', branch: 'shadowstep', tier: 2, name: 'Ambush', description: 'The fight is decided before it is noticed.',
    mp: 12, target: 'enemy', damageType: 'physical', power: { coef: 1.6, stat: 'atk' },
    bonuses: [{ when: { any: [{ selfHas: 'status_phase' }, { targetHasActed: false }] }, mult: 1.5 }],
  },
  {
    id: 'elf_barkskin', ownerId: 'elf', branch: 'leyweave', tier: 2, name: 'Barkskin', description: 'Wear the forest for a while.',
    mp: 10, target: 'self_or_ally', shield: { base: 12, coef: 1.4, stat: 'sp', turns: 3 }, cooldown: 3,
    statuses: [{ status: 'status_regen', duration: 3, power: { base: 4, coef: 0.4, stat: 'sp' } }],
  },
  // Ironclad Warden (§5.5)
  {
    id: 'wrd_challenge', ownerId: 'ironclad_warden', branch: 'bulwark', tier: 2, name: 'Challenge', description: 'Here. Me. Now.',
    mp: 8, target: 'all_enemies', statuses: [{ status: 'status_taunt', duration: 2, target: 'all_enemies' }], cooldown: 2,
  },
  {
    id: 'wrd_concussive_slam', ownerId: 'ironclad_warden', branch: 'breaker', tier: 2, name: 'Concussive Slam', description: 'A bell rung inside a skull.',
    mp: 12, target: 'enemy', damageType: 'physical', power: { coef: 1.0, stat: 'atk' }, cooldown: 3,
    statuses: [
      { status: 'status_stun', chance: 0.75, duration: 1, when: { targetIsBoss: false } },
      { status: 'status_weaken', duration: 2, when: { targetIsBoss: true } },
    ],
  },
  {
    id: 'wrd_shield_wall', ownerId: 'ironclad_warden', branch: 'bulwark', tier: 3, name: 'Shield Wall', description: 'Two is a wall. One is a wall that remembers two.',
    mp: 12, target: 'party', shield: { base: 18, coef: 1.2, stat: 'atk', turns: 3 }, cooldown: 3,
  },
  // Shadow Weaver (§5.6)
  {
    id: 'wvr_void_lance', ownerId: 'shadow_weaver', branch: 'unmaking', tier: 1, name: 'Void Lance', description: 'Reach into the Breach and pull out something sharp.',
    mp: 10, target: 'enemy', damageType: 'void', power: { base: 3, coef: 1.3, stat: 'sp' }, selfCost: { hpPctMax: 0.08 },
  },
  {
    id: 'wvr_mark_of_the_void', ownerId: 'shadow_weaver', branch: 'hex', tier: 2, name: 'Mark of the Void', description: 'A small, patient hunger.',
    mp: 10, target: 'enemy', damageType: 'void', power: { coef: 0.8, stat: 'sp' }, statuses: [{ status: 'status_curse', chance: 1, duration: 3 }],
  },
  {
    id: 'wvr_blood_pact', ownerId: 'shadow_weaver', branch: 'drain', tier: 2, name: 'Blood Pact', description: 'The price, paid forward.',
    mp: 0, target: 'self', selfCost: { hpPctMax: 0.15 }, special: 'resource_convert', cooldown: 2,
  },
] satisfies AbilityInput[];

/** DESIGN §5.7 as amended by D-067.19: max(0.75·ATK, 4 + 0.8·SP), 10 MP, 1-turn cooldown. */
const ECHO_BOLT = {
  id: 'itm_echo_bolt', ownerId: 'item_amulet_of_echoes', name: 'Echo Bolt (Amulet)', description: 'The Amulet remembers the first spell you ever saw.',
  mp: 10, target: 'enemy', damageType: 'ley', power: { coef: 0.75, stat: 'atk', maxOf: { base: 4, coef: 0.8, stat: 'sp' } }, cooldown: 1,
} satisfies AbilityInput;

/** DESIGN §12.4, Brak and Dask. */
const COMPANION_ROWS = [
  { id: 'comp_brak_axe', ownerId: 'brak', kind: 'attack', name: 'Axe', description: 'Brak swings.', target: 'enemy', damageType: 'physical', power: { coef: 1.1, stat: 'atk' } },
  { id: 'comp_brak_cleave', ownerId: 'brak', kind: 'aoe', name: 'Cleave', description: 'Brak sweeps.', target: 'all_enemies', damageType: 'physical', power: { coef: 0.8, stat: 'atk' } },
  {
    id: 'comp_brak_shieldbreak', ownerId: 'brak', kind: 'debuff', name: 'Shieldbreak', description: 'Brak hits the plate.', target: 'enemy', damageType: 'physical',
    power: { coef: 0.7, stat: 'atk' }, statuses: [{ status: 'status_armor_break', chance: 1, duration: 3 }],
  },
  {
    id: 'comp_brak_hold_the_line', ownerId: 'brak', kind: 'signature', name: 'Hold the Line', description: 'Taunt all, Guard, Shield.', target: 'self',
    statuses: [{ status: 'status_taunt', duration: 2, target: 'all_enemies' }], shield: { base: 15, coef: 1.0, stat: 'atk' }, special: 'guard',
  },
  { id: 'comp_dask_flicker_strike', ownerId: 'dask', kind: 'attack', name: 'Flicker Strike', description: 'Chrono; ignores Phase.', target: 'enemy', damageType: 'chrono', power: { coef: 1.0, stat: 'sp' } },
  {
    id: 'comp_dask_stall', ownerId: 'dask', kind: 'debuff', name: 'Stall', description: 'Chrono; Slow.', target: 'enemy', damageType: 'chrono',
    power: { coef: 0.5, stat: 'sp' }, statuses: [{ status: 'status_slow', chance: 1, duration: 2 }],
  },
  { id: 'comp_dask_glimpse', ownerId: 'dask', kind: 'utility', name: 'Glimpse', description: 'The party sees next-next intents.', target: 'party', special: 'foresight' },
  {
    id: 'comp_dask_between_instants', ownerId: 'dask', kind: 'signature', name: 'Between Instants', description: 'Rewind the player; Haste both.', target: 'party',
    statuses: [{ status: 'status_rewind', duration: 2, target: 'ally' }, { status: 'status_haste', duration: 2, target: 'all_allies' }],
  },
] satisfies AbilityInput[];

describe('DESIGN §5 class ability rows parse (3 per class)', () => {
  test('three rows for each of the five classes', () => {
    const owners = CLASS_ROWS.map((r) => r.ownerId);
    for (const c of ['ranger', 'wizard', 'elf', 'ironclad_warden', 'shadow_weaver']) expect(owners.filter((o) => o === c)).toHaveLength(3);
  });

  test.each(CLASS_ROWS.map((r) => [r.id, r]))('%s', (_id, row) => {
    expect(issues(row)).toEqual([]);
  });

  test('levelReq, costHalf and cooldown default from the tier (DESIGN §5.1)', () => {
    const parsed = CLASS_ROWS.map((r) => AbilitySchema.parse(r));
    const byId = Object.fromEntries(parsed.map((a) => [a.id, a]));
    expect(byId.rgr_marked_shot).toMatchObject({ levelReq: 1, costHalf: 2, cooldown: 0, spell: false, interrupt: false, bonuses: [], outOfCombat: [] });
    expect(byId.rgr_piercing_arrow).toMatchObject({ levelReq: 4, costHalf: 2 });
    expect(byId.wrd_shield_wall).toMatchObject({ levelReq: 8, costHalf: 2, cooldown: 3 });
    expect(byId.rgr_killing_shot).toMatchObject({ levelReq: 16, costHalf: 4, cooldown: 4, onKill: { refundMp: 24 } });
    expect(byId.elf_twin_strike?.power).toEqual({ base: 0, coef: 0.65, stat: 'atk', hits: 2, perHitCrit: true, ignoresArmor: false });
    expect(byId.wvr_blood_pact).toMatchObject({ mp: 0, special: 'resource_convert' });
    expect(TIER_LEVELS).toEqual([1, 4, 8, 12, 16]);
  });

  test('authored levelReq / costHalf that match the tier are accepted', () => {
    expect(issues({ ...CLASS_ROWS[2], levelReq: 16, costHalf: 4 })).toEqual([]);
  });
});

describe('item and companion abilities', () => {
  test('itm_echo_bolt (D-047, D-067.19)', () => {
    const a = AbilitySchema.parse(ECHO_BOLT);
    expect(a.power?.maxOf).toEqual({ base: 4, coef: 0.8, stat: 'sp' });
    expect(a).toMatchObject({ mp: 10, cooldown: 1, levelReq: 1, costHalf: 2 });
  });

  test.each(COMPANION_ROWS.map((r) => [r.id, r]))('%s', (_id, row) => {
    expect(issues(row)).toEqual([]);
  });

  test('companion cooldowns come from kind; no MP (D-066 #12)', () => {
    const cd = Object.fromEntries(COMPANION_ROWS.map((r) => [r.id, AbilitySchema.parse(r).cooldown]));
    expect(cd).toEqual({
      comp_brak_axe: 0,
      comp_brak_cleave: 2,
      comp_brak_shieldbreak: 2,
      comp_brak_hold_the_line: 0,
      comp_dask_flicker_strike: 0,
      comp_dask_stall: 2,
      comp_dask_glimpse: 2,
      comp_dask_between_instants: 0,
    });
    expect(COMPANION_KIND_COOLDOWN).toEqual({ attack: 0, debuff: 2, aoe: 2, utility: 2, buff: 2, heal: 3, shield: 3, cleanse: 3 });
    expect(issues({ ...COMPANION_ROWS[2], cooldown: 2 })).toEqual([]);
  });

  test('abilityOwnerKind reads the prefix', () => {
    expect(['wvr_siphon', 'comp_nyx_hex', 'itm_echo_bolt', 'fireball'].map(abilityOwnerKind)).toEqual(['class', 'companion', 'item', undefined]);
  });
});

describe('invalid abilities fail with clear messages', () => {
  const [marked, , killing] = CLASS_ROWS;
  const [axe] = COMPANION_ROWS;

  test('ids and owners', () => {
    expectIssue({ ...marked, id: 'marked_shot' }, 'id', 'expected an ability id');
    expectIssue({ ...marked, ownerId: 'wizard' }, 'ownerId', "rgr_ abilities belong to class 'ranger'");
    expectIssue({ ...axe, ownerId: 'nyx' }, 'ownerId', "comp_brak_ abilities belong to companion 'brak'");
    expectIssue({ ...axe, id: 'comp_zed_axe', ownerId: 'zed' }, 'id', "unknown companion 'zed'");
    expectIssue({ ...ECHO_BOLT, ownerId: 'amulet' }, 'ownerId', 'owned by the granting item');
    expectIssue({ ...ECHO_BOLT, tier: 1 }, 'id', 'item abilities have no branch, tier or kind');
  });

  test('class rules: branch, tier, no kind, MP > 0, tier gates and costs', () => {
    expectIssue({ ...marked, branch: undefined }, 'branch', 'needs a branch');
    expectIssue({ ...marked, tier: undefined }, 'tier', 'needs a tier');
    expectIssue({ ...marked, kind: 'attack' }, 'kind', 'for companion abilities');
    expectIssue({ ...marked, mp: 0 }, 'mp', 'MP > 0 unless it converts a resource');
    expectIssue({ ...killing, levelReq: 12 }, 'levelReq', 'tier 5 unlocks at level 16');
    expectIssue({ ...killing, costHalf: 2 }, 'costHalf', 'tier 5 costs 4 half-points');
    expectIssue({ ...marked, tier: 6 }, 'tier', '');
  });

  test('companion rules: kind required, no MP, no tier, kind cooldown', () => {
    expectIssue({ ...axe, kind: undefined }, 'kind', 'needs a kind');
    expectIssue({ ...axe, mp: 4 }, 'mp', 'companions have no MP');
    expectIssue({ ...axe, tier: 1 }, 'tier', 'for class abilities');
    expectIssue({ ...axe, cooldown: 2 }, 'cooldown', 'companion attack abilities have cooldown 0');
  });

  test('content rules: power needs a type, abilities must do something, specials by scope, combat-scope effects', () => {
    expectIssue({ ...marked, damageType: undefined }, 'damageType', 'needs a damageType');
    expectIssue({ ...marked, power: undefined, statuses: [] }, '', 'an ability must do something');
    // U26b: an engine-scripted row may declare nothing else (Dancer's Guard: +25 evasion and dodge MP live in the engine)
    const dancersGuard = { id: 'elf_dancers_guard', ownerId: 'elf', branch: 'bladesong', tier: 2, name: "Dancer's Guard", description: 'Never be where the blade expects.', mp: 8, target: 'self', cooldown: 3 };
    expect(AbilitySchema.safeParse(dancersGuard).success).toBe(true);
    expect(isScriptedAbility('elf_dancers_guard') && !isScriptedAbility('rgr_marked_shot')).toBe(true);
    expect(SCRIPTED_ABILITIES.every((id) => abilityOwnerKind(id) === 'class')).toBe(true);
    expectIssue({ ...killing, special: 'hour_presses' }, 'special', "special 'hour_presses' is not usable on an ability");
    expectIssue({ ...killing, special: 'snipe' }, 'special', 'unknown special "snipe" for an ability');
    expectIssue({ ...marked, selfCost: {} }, 'selfCost', 'needs hpPctMax');
    expectIssue({ ...marked, selfCost: { hpPctMax: 1.5 } }, 'selfCost.hpPctMax', '');
    expectIssue({ ...marked, outOfCombat: [{ multiHit: { hits: 2 } }] }, 'outOfCombat.0', 'combat-scope');
    expectIssue({ ...marked, bonuses: [{ when: { marked: true }, mult: 1.2 }] }, 'bonuses.0.when.marked', "unknown combat condition atom 'marked'");
    expectIssue({ ...marked, target: 'single' }, 'target', '');
    expectIssue({ ...marked, power: { coef: 1, stat: 'str' } }, 'power.stat', '');
    expectIssue({ ...marked, range: 3 }, '', 'Unrecognized key');
  });
});
