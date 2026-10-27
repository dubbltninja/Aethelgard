// U74: the event map (PLAN §6.5) — every engine event kind has a row (a new kind fails here until it is mapped), every
// row names real sounds, each of the 30 is heard on some event, and a step's cues follow the combat stage's beats with
// repeats merged and a cap.
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import type { GameEvent } from '@engine/types/events';
import { BEAT, EVENT_SOUNDS, MAX_CUES, createCueMapper, type Cue } from '@audio/map/map';
import { RECIPES, SFX_IDS } from '@audio/sfx/sfx';
import { BEAT_MS } from '@ui/art/stageMotion';

const item = { uid: 'i1', itemId: 'item_x', qty: 1, rarity: 'common', affixes: [] } as never;
const intent = {} as never;

/** One sample of each event the map has a sound for (and several branches of the rules). */
const SAMPLES: GameEvent[] = [
  { t: 'actionRejected', action: { type: 'wait' } as never, reason: 'no' },
  { t: 'locationEntered', locationId: 'loc_a', firstVisit: true, regionId: 'region_a' },
  { t: 'clockWarning', daysLeft: 10 },
  { t: 'clockWarning', daysLeft: 1 },
  { t: 'clockExpired' },
  { t: 'rested', locationId: 'loc_a', hpRestored: 1, mpRestored: 1 },
  { t: 'exitUnlocked', from: 'loc_a', to: 'loc_b' },
  { t: 'hordeStarted', cause: 'expiry', delay: 3 },
  { t: 'itemTaken', item },
  { t: 'itemGiven', item, source: 'npc' },
  { t: 'itemEquipped', slot: 'weapon' as never, item },
  { t: 'itemUnequipped', slot: 'weapon' as never },
  { t: 'goldChanged', delta: 5, total: 5 },
  { t: 'goldChanged', delta: -5, total: 0 },
  { t: 'purchased', itemId: 'x', price: 1 },
  { t: 'sold', itemId: 'x', price: 1 },
  { t: 'crafted', recipeId: 'recipe_x', item },
  { t: 'upgraded', item },
  { t: 'levelUp', level: 2, statPoints: 1, apHalf: 0 },
  { t: 'statAllocated', stat: 'strength' as never, value: 1 },
  { t: 'abilityUnlocked', abilityId: 'a' },
  { t: 'corruptionChanged', value: 5, delta: 5 },
  { t: 'corruptionChanged', value: 0, delta: -5 },
  { t: 'companionRecruited', companionId: 'brak' },
  { t: 'companionDismissed', companionId: 'brak' },
  { t: 'companionSwapped', activeId: null },
  { t: 'companionKo', companionId: 'brak' },
  { t: 'companionDied', companionId: 'brak' },
  { t: 'combatStarted', encounterId: 'e', enemies: [], ambush: false },
  { t: 'turnStarted', uid: 'c1', round: 2 },
  { t: 'intentRevealed', uid: 'c2', intent },
  { t: 'attackResolved', sourceUid: 'c2', targetUid: 'c1', hit: false, crit: false },
  ...(['physical', 'fire', 'storm', 'ley', 'void', 'chrono'] as const).map(
    (damageType): GameEvent => ({ t: 'damageDealt', sourceUid: 'c2', targetUid: 'c1', amount: 3, damageType, mitigated: 0, absorbed: 0, kind: 'basic', refId: null }),
  ),
  { t: 'attackResolved', sourceUid: 'c1', targetUid: 'c2', hit: true, crit: true },
  { t: 'damageDealt', sourceUid: 'c1', targetUid: 'c2', amount: 9, damageType: 'fire', mitigated: 0, absorbed: 0, kind: 'basic', refId: null },
  { t: 'damageDealt', sourceUid: 'c2', targetUid: 'c1', amount: 0, damageType: 'void', mitigated: 0, absorbed: 4, kind: 'intent', refId: null },
  { t: 'healed', targetUid: 'c1', amount: 4, source: 'x' },
  { t: 'statusApplied', targetUid: 'c1', statusId: 'status_shield', stacks: 1, duration: 2 },
  { t: 'statusApplied', targetUid: 'c2', statusId: 'status_burn', stacks: 1, duration: 2 },
  { t: 'statusExpired', targetUid: 'c1', statusId: 'status_shield' },
  { t: 'interplay', rule: 'void_on_shield', targetUid: 'c1' },
  { t: 'guarded', uid: 'c1' },
  { t: 'fleeAttempt', success: true, chance: 50 },
  { t: 'fleeAttempt', success: false, chance: 50 },
  { t: 'combatantDefeated', uid: 'c2', refId: 'cr_x' },
  { t: 'bossPhase', uid: 'c2', phase: 2, text: '' },
  { t: 'addsSummoned', uids: [] },
  { t: 'resolveChanged', delta: 1, value: 2, movement: 1, reason: 'listen' },
  { t: 'resolveChanged', delta: 2, value: 4, movement: 1, reason: 'answer:q:a' },
  { t: 'resolveChanged', delta: -1, value: 3, movement: 1, reason: 'corruption' },
  { t: 'movementEnded', movement: 1, resolve: 3 },
  { t: 'communionRejected', reason: 'lies' },
  { t: 'combatEnded', result: 'victory', rounds: 2, xp: 1, gold: 1, loot: [] },
  { t: 'combatEnded', result: 'fled', rounds: 2, xp: 0, gold: 0, loot: [] },
  { t: 'playerDied', loop: 1 },
  { t: 'dialogueNode', nodeId: 'n', speaker: 's', text: 't' },
  { t: 'questStarted', questId: 'q_a' },
  { t: 'questAdvanced', questId: 'q_a', stage: 's', journal: 'j' },
  { t: 'questObjective', questId: 'q_a', objectiveId: 'o', done: true },
  { t: 'questObjective', questId: 'q_a', objectiveId: 'o', done: false },
  { t: 'questCompleted', questId: 'q_a' },
  { t: 'questFailed', questId: 'q_a' },
  { t: 'heartstoneResolved', outcome: 'cleansed' as never },
  { t: 'tyrantResolved', outcome: 'defeated' as never },
  { t: 'echoGained', echoId: 'echo_a', firstEver: true },
  { t: 'codexUnlocked', codexId: 'codex_a' },
  { t: 'achievementUnlocked', achievementId: 'ach_a' },
  { t: 'resonanceGained', amount: 3, reason: 'x', total: 3 },
  { t: 'attunementBought', attunementId: 'att_a' },
  { t: 'attunementEquipped', attunementId: 'att_a', on: true },
  { t: 'attunementEquipped', attunementId: 'att_a', on: false },
  { t: 'modifierToggled', modifierId: 'mod_a', on: true },
  { t: 'portalEntered' },
  { t: 'loopEnded', loop: 1, outcome: 'fall' as never, record: {} as never },
  { t: 'endingReached', endingId: 'ending_a' },
  { t: 'loopStarted', loop: 2, classId: 'ranger' },
];

const ids = (cues: Cue[]): string[] => cues.map((c) => c.id);
const one = (e: GameEvent): Cue[] => createCueMapper()([e]);

describe('EVENT_SOUNDS', () => {
  test('every GameEvent kind in events.ts has a row, and no row names a kind that does not exist', () => {
    const source = fs.readFileSync('src/engine/types/events.ts', 'utf8');
    const union = source.slice(source.indexOf('export type GameEvent ='), source.indexOf('export type GameEventType'));
    const kinds = [...union.matchAll(/\bt: '([A-Za-z]+)'/g)].map((m) => m[1] as string);
    expect(kinds.length).toBeGreaterThan(90);
    expect(Object.keys(EVENT_SOUNDS).sort()).toEqual([...new Set(kinds)].sort());
  });

  test('every sound the samples reach is a real recipe, and together they reach all 30 and the percussion', () => {
    const heard = new Set<string>();
    for (const e of SAMPLES) for (const cue of one(e)) heard.add(cue.id);
    // a crit needs its attack roll in the same step (the pair in SAMPLES)
    const roll = SAMPLES.findIndex((e) => e.t === 'attackResolved' && e.crit);
    for (const cue of createCueMapper()(SAMPLES.slice(roll, roll + 2))) heard.add(cue.id);
    for (const id of heard) expect(Object.keys(RECIPES)).toContain(id);
    expect(Object.keys(RECIPES).filter((id) => !heard.has(id))).toEqual([]);
    expect(SFX_IDS.every((id) => heard.has(id))).toBe(true);
  });

  test('silent rows are explicit nulls, and silent events yield nothing', () => {
    const silent = Object.entries(EVENT_SOUNDS).filter(([, rule]) => rule === null).map(([k]) => k);
    expect(silent).toContain('log');
    expect(silent).toContain('autosaveCheckpoint');
    expect(one({ t: 'log', text: 'x', kind: 'system' })).toEqual([]);
    expect(one({ t: 'goldChanged', delta: -1, total: 0 })).toEqual([]);
  });

  test('blows by damage type; a crit layers its type; an absorbed blow clangs; a damage-over-time tick is quieter', () => {
    const blow = (over: Partial<Extract<GameEvent, { t: 'damageDealt' }>>): GameEvent =>
      ({ t: 'damageDealt', sourceUid: 'a', targetUid: 'b', amount: 5, damageType: 'storm', mitigated: 0, absorbed: 0, kind: 'basic', refId: null, ...over }) as GameEvent;
    expect(ids(one(blow({})))).toEqual(['sfx_hit_storm']);
    const crit = createCueMapper()([{ t: 'attackResolved', sourceUid: 'a', targetUid: 'b', hit: true, crit: true }, blow({ damageType: 'ley' })]);
    expect(crit).toMatchObject([{ id: 'sfx_crit', variant: 'ley' }]);
    expect(ids(one(blow({ amount: 0, absorbed: 3 })))).toEqual(['sfx_guard']);
    expect(one(blow({ amount: 0 }))).toEqual([]);
    expect(one(blow({ kind: 'status' }))[0]?.vel).toBe(0.45);
    expect(ids(one({ t: 'attackResolved', sourceUid: 'a', targetUid: 'b', hit: false, crit: false }))).toEqual(['sfx_miss']);
  });

  test('statuses: Shield up and down, tails for Burn, Bleed and Shock', () => {
    const applied = (statusId: string): Cue[] => one({ t: 'statusApplied', targetUid: 'x', statusId, stacks: 1, duration: 1 });
    expect(applied('status_shield')[0]?.id).toBe('sfx_shield_up');
    expect(applied('status_bleed')[0]).toMatchObject({ id: 'sfx_status_apply', variant: 'bleed' });
    expect(applied('status_slow')[0]?.variant).toBeUndefined();
    expect(one({ t: 'statusExpired', targetUid: 'x', statusId: 'status_burn' })).toEqual([]);
  });

  test('the communion: Listen rings the Echo bell; Resolve gained blips per point; the clock warns late with detune', () => {
    expect(ids(one({ t: 'resolveChanged', delta: 1, value: 2, movement: 2, reason: 'listen:tired' }))).toEqual(['sfx_echo_gain']);
    expect(one({ t: 'resolveChanged', delta: 2, value: 2, movement: 2, reason: 'offer:x' })[0]).toMatchObject({ id: 'sfx_resonance', n: 2 });
    expect(one({ t: 'resolveChanged', delta: 0, value: 2, movement: 2, reason: 'x' })).toEqual([]);
    expect(one({ t: 'clockWarning', daysLeft: 2 })[0]?.variant).toBe('late');
    expect(one({ t: 'clockWarning', daysLeft: 5 })[0]?.variant).toBeUndefined();
  });
});

describe('createCueMapper', () => {
  const hit = (s: string, t: string): GameEvent => ({ t: 'damageDealt', sourceUid: s, targetUid: t, amount: 2, damageType: 'physical', mitigated: 0, absorbed: 0, kind: 'basic', refId: null });

  test('the beat is the combat stage’s', () => {
    expect(BEAT * 1000).toBe(BEAT_MS);
  });

  test('a multi-hit in one beat plays its sound once', () => {
    const cues = createCueMapper()(Array.from({ length: 10 }, () => hit('a', 'b')));
    expect(cues).toHaveLength(1);
    expect(cues[0]?.at).toBeCloseTo(BEAT / 3);
  });

  test('each busy turn starts a new beat; quiet turns do not; the kick marks a new round', () => {
    const map = createCueMapper();
    map([{ t: 'combatStarted', encounterId: 'e', enemies: [], ambush: false }, { t: 'turnStarted', uid: 'p', round: 1 }]);
    const cues = map([
      hit('p', 'e'),
      { t: 'turnStarted', uid: 'e', round: 1 },
      hit('e', 'p'),
      { t: 'turnStarted', uid: 'e2', round: 1 },
      { t: 'turnStarted', uid: 'p', round: 2 },
      { t: 'guarded', uid: 'p' },
    ]);
    const hits = cues.filter((c) => c.id === 'sfx_hit_physical').map((c) => c.at);
    expect(hits[0]).toBeCloseTo(BEAT / 3);
    expect(hits[1]).toBeCloseTo(BEAT + BEAT / 3);
    const kick = cues.find((c) => c.id === 'sfx_perc_kick');
    expect(kick?.at).toBeCloseTo(2 * BEAT);
    expect(cues.find((c) => c.id === 'sfx_guard')?.at).toBeCloseTo(2 * BEAT);
    // the first round of a fight has the combat drum, not a kick
    const start = createCueMapper()([{ t: 'combatStarted', encounterId: 'e', enemies: [], ambush: false }, { t: 'turnStarted', uid: 'p', round: 1 }]);
    expect(ids(start)).toEqual(['sfx_combat_start', 'sfx_perc_hat']);
  });

  test('different sounds in one beat are staggered; late beats are clamped', () => {
    const cues = createCueMapper()([{ t: 'questAdvanced', questId: 'q', stage: 's', journal: 'j' }, { t: 'goldChanged', delta: 3, total: 3 }, { t: 'echoGained', echoId: 'e', firstEver: true }]);
    expect(cues.map((c) => c.at)).toEqual([0, 0.07, 0.14]);
    const long: GameEvent[] = [];
    for (let i = 0; i < 9; i++) long.push({ t: 'turnStarted', uid: `u${i}`, round: 1 }, { t: 'combatantDefeated', uid: `u${i}`, refId: 'x' });
    const late = createCueMapper()(long);
    expect(Math.max(...late.map((c) => c.at))).toBeLessThanOrEqual(5 * BEAT + 0.3);
  });

  test('a step yields at most MAX_CUES', () => {
    const many: GameEvent[] = [];
    for (let i = 0; i < 30; i++) many.push({ t: 'turnStarted', uid: 'x', round: i + 1 }, hit('a', 'b'));
    expect(createCueMapper()(many).length).toBe(MAX_CUES);
  });

  test('cues pan toward the side that is struck', () => {
    const side = (uid: string): number => (uid === 'p' ? -0.35 : 0.35);
    expect(createCueMapper()([hit('p', 'e')], side)[0]?.pan).toBe(0.35);
    expect(createCueMapper()([hit('e', 'p')], side)[0]?.pan).toBe(-0.35);
    expect(createCueMapper()([hit('e', 'p')])[0]?.pan).toBe(0);
  });

  test('a repeat in one beat keeps the louder velocity', () => {
    const cues = createCueMapper()([{ t: 'questCompleted', questId: 'q' }, { t: 'combatEnded', result: 'victory', rounds: 1, xp: 0, gold: 0, loot: [] }]);
    expect(cues).toHaveLength(1);
    expect(cues[0]?.vel).toBe(1);
  });
});
