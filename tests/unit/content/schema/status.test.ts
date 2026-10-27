// U15: StatusSchema (PLAN §5.8) — all 19 DESIGN §4.5 statuses parse, and the single-record refinements bite.
import { describe, expect, test } from 'bun:test';
import { CANONICAL_STATUSES, StatusSchema, type StatusInput } from '@schema/status';

const messages = (value: unknown): string[] => {
  const r = StatusSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

const base = { kind: 'debuff', color: '#cc3333', icon: 'chip' } as const;
const desc = (what: string) => `${what} (DESIGN §4.5).`;

/** DESIGN §4.5, one row each; durations, stacking, ticks and modifiers as the table states them. */
const statuses: StatusInput[] = [
  { id: 'status_bleed', name: 'Bleed', description: desc('Physical DoT, ignores armor'), ...base, color: '#c0392b', icon: 'drip',
    stackable: true, maxStacks: 3, defaultDuration: 3, tick: { timing: 'turn_start', damage: { base: 1, coef: 0.2, stat: 'atk', perStack: true, type: 'physical' } } },
  { id: 'status_burn', name: 'Burn', description: desc('Fire DoT; cannot be applied to Soaked'), ...base, color: '#e67e22', icon: 'flame',
    defaultDuration: 3, tick: { damage: { base: 1, coef: 0.2, stat: 'sp', type: 'fire' } }, special: 'burn' },
  { id: 'status_shock', name: 'Shock', description: desc('-15 accuracy; takes +25% Storm'), ...base, color: '#f1c40f', icon: 'jag',
    defaultDuration: 2, modifiers: { accuracyFlat: -15 }, special: 'shock' },
  { id: 'status_soaked', name: 'Soaked', description: desc('+50% Storm taken, -50% Fire taken'), ...base, color: '#3498db', icon: 'droplet',
    defaultDuration: 3, special: 'soaked' },
  { id: 'status_slow', name: 'Slow', description: desc('-5 initiative, -10 evasion, cannot flee'), ...base, color: '#7f8c8d', icon: 'hourglass_grey',
    defaultDuration: 2, modifiers: { initiativeFlat: -5, evasionFlat: -10, blockActions: ['flee'] }, special: 'slow' },
  { id: 'status_haste', name: 'Haste', description: desc('+5 initiative, +10 evasion; removes Slow'), kind: 'buff', color: '#f9e79f', icon: 'hourglass_bright',
    defaultDuration: 2, modifiers: { initiativeFlat: 5, evasionFlat: 10 }, special: 'haste' },
  { id: 'status_stun', name: 'Stun', description: desc('Loses the next action; intent cancelled'), ...base, color: '#f4d03f', icon: 'starburst',
    defaultDuration: 1, modifiers: { skipTurn: true }, special: 'stun' },
  { id: 'status_weaken', name: 'Weaken', description: desc('Deals -25% damage'), ...base, color: '#95a5a6', icon: 'arrow_droop',
    defaultDuration: 2, modifiers: { outgoingPct: -0.25 } },
  { id: 'status_armor_break', name: 'Armor Break', description: desc('Armor and ward count as 0; +15% Physical taken'), ...base, color: '#bdc3c7', icon: 'plate_cracked',
    defaultDuration: 3, modifiers: { armorWardZero: true }, special: 'armor_break' },
  { id: 'status_mark', name: 'Mark', description: desc('+15% damage taken; attacks cannot miss'), ...base, color: '#e74c3c', icon: 'crosshair',
    defaultDuration: 3, modifiers: { incomingPct: 0.15 }, special: 'mark' },
  { id: 'status_curse', name: 'Curse', description: desc('Void DoT; healing received x0.5'), ...base, color: '#8e44ad', icon: 'sigil',
    defaultDuration: 3, tick: { damage: { base: 2, coef: 0.2, stat: 'sp', type: 'void' } }, modifiers: { healingPct: -0.5 } },
  { id: 'status_shield', name: 'Shield', description: desc('Absorbs damage before HP; Void destroys it'), kind: 'buff', color: '#1abc9c', icon: 'hex',
    defaultDuration: 3, modifiers: { absorbFlat: 0 }, special: 'shield' },
  { id: 'status_regen', name: 'Regen', description: desc('Heals the stored amount each turn; removes a Bleed stack'), kind: 'buff', color: '#2ecc71', icon: 'leaf',
    defaultDuration: 3, tick: { heal: { flat: 0, pctMaxHp: 0 } }, special: 'regen' },
  { id: 'status_taunt', name: 'Taunt', description: desc('Single-target intents target the taunter'), ...base, color: '#c0392b', icon: 'horn',
    defaultDuration: 2, modifiers: { forcedTargetUidFromSource: true }, special: 'taunt' },
  { id: 'status_phase', name: 'Phase', description: desc('The next single-target attack misses'), kind: 'buff', color: '#ecf0f1', icon: 'outline',
    defaultDuration: 1, expiresOn: ['hit_taken', 'turn'], special: 'phase' },
  { id: 'status_rewind', name: 'Rewind', description: desc('HP restored to the snapshot on expiry'), kind: 'buff', color: '#5dade2', icon: 'spiral',
    defaultDuration: 2, special: 'rewind' },
  { id: 'status_poison', name: 'Poison', description: desc('Untyped DoT; ignores armor and resistances'), ...base, color: '#27ae60', icon: 'skull',
    defaultDuration: 4, tick: { damage: { base: 1, coef: 0.15, stat: 'atk' } }, special: 'poison' },
  { id: 'status_blind', name: 'Blind', description: desc('-30 accuracy'), ...base, color: '#34495e', icon: 'eye_closed',
    defaultDuration: 2, modifiers: { accuracyFlat: -30 } },
  { id: 'status_rested', name: 'Rested', description: desc('+2 initiative, +5 accuracy for the first fight of the day'), kind: 'buff', color: '#f5cba7', icon: 'moon',
    defaultDuration: 1, modifiers: { initiativeFlat: 2, accuracyFlat: 5 } },
];

describe('StatusSchema (PLAN §5.8)', () => {
  test('all 19 DESIGN §4.5 statuses parse', () => {
    expect(statuses).toHaveLength(19);
    for (const s of statuses) expect(messages(s)).toEqual([]);
    expect(statuses.map((s) => s.id).sort()).toEqual([...CANONICAL_STATUSES].sort());
  });

  test('defaults fill in: duration 2, one stack, tick on turn_start, expires on turn', () => {
    const r = StatusSchema.parse({ id: 'status_weaken', name: 'Weaken', description: 'x', kind: 'debuff', color: '#fff', icon: 'i' });
    expect(r.stackable).toBe(false);
    expect(r.maxStacks).toBe(1);
    expect(r.defaultDuration).toBe(2);
    expect(r.expiresOn).toEqual(['turn']);
    expect(r.modifiers.outgoingPct).toBe(0);
    expect(r.modifiers.blockActions).toEqual([]);
    expect(r.tags).toEqual([]);
    const bleed = StatusSchema.parse(statuses[0]);
    expect(bleed.tick?.timing).toBe('turn_start');
    expect(bleed.tick?.damage?.perStack).toBe(true);
  });

  test('the canonical list is the 18 combat statuses plus rested', () => {
    expect(CANONICAL_STATUSES).toHaveLength(19);
    expect(new Set(CANONICAL_STATUSES).size).toBe(19);
    expect(CANONICAL_STATUSES).toContain('status_rested');
  });

  const valid = statuses[0] as StatusInput;
  test('bad id prefix fails', () => {
    expect(messages({ ...valid, id: 'bleed' })[0]).toContain('expected an id with prefix status_');
    expect(messages({ ...valid, id: 'effect_bleed' })).not.toEqual([]);
  });

  test('unknown kind, missing required field, unknown key and unknown modifier fail', () => {
    expect(messages({ ...valid, kind: 'curse' })).not.toEqual([]);
    const { color: _c, ...noColor } = valid as Record<string, unknown>;
    expect(messages(noColor).join()).toContain('color');
    expect(messages({ ...valid, colour: 'red' })).not.toEqual([]);
    expect(messages({ ...valid, modifiers: { speedPct: 0.5 } })).not.toEqual([]);
    expect(messages({ ...valid, expiresOn: ['never'] })).not.toEqual([]);
  });

  test('stackable needs maxStacks > 1 (PLAN §5.19 rule 14) and maxStacks > 1 needs stackable', () => {
    expect(messages({ ...valid, stackable: true, maxStacks: 1 })).toEqual(['maxStacks: a stackable status needs maxStacks > 1']);
    expect(messages({ ...valid, stackable: false, maxStacks: 3 })).toEqual(['stackable: maxStacks > 1 needs stackable: true']);
  });

  test('a tick must deal or heal something', () => {
    expect(messages({ ...valid, tick: { timing: 'turn_end' } })).toEqual(['tick: a tick needs damage and/or heal']);
    expect(messages({ ...valid, tick: { damage: { base: 0, coef: 0, stat: 'atk' } } })).toEqual(['tick.damage: a damage tick must deal something (base or coef > 0)']);
    expect(messages({ ...valid, tick: { damage: { base: 1, coef: 0.2, stat: 'mag' } } })).not.toEqual([]);
  });

  test('duplicate expiry triggers and a zero duration fail', () => {
    expect(messages({ ...valid, expiresOn: ['turn', 'turn'] })).toEqual(['expiresOn: expiresOn lists each trigger once']);
    expect(messages({ ...valid, defaultDuration: 0 })).not.toEqual([]);
  });
});
