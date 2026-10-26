// U62a Part A (D-131): codex entries unlock by their `unlockWhen`. The pass at the end of `step` re-evaluates only the entries
// whose atoms the step changed (the index), unlocks through the `unlockCodex` effect's path (profile + `codexUnlocked`
// event), never twice, and leaves effect-only entries alone. Every one of the real pack's entries is shown to unlock when its
// condition is made true on a built state.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import type { Condition } from '@schema/condition';
import {
  HANDLERS,
  applyAll,
  codexUnlockIndex,
  codexUnlockPass,
  conditionAtoms,
  createStep,
  dirtyCodexEntries,
  evaluate,
  makeCtx,
  POST_STEP_HOOKS,
  step,
  type ContentPack,
  type GameState,
  type Profile,
} from '@engine/index';
import { clone, deepFreeze } from '@engine/util/clone';
import { freshProfile, makeState } from '@tests/fixtures/helpers';

const pack: ContentPack = buildContentPack();
const base = (): GameState => makeState({}, { content: pack });

/** Makes `cond` true on `s` / `p` (the first branch of an `any`). Throws on an atom the codex does not use. */
function satisfy(cond: Condition, s: GameState, p: Profile): void {
  const [[key, value]] = Object.entries(cond) as [[string, unknown]];
  const v = value as Record<string, unknown> & { id: string };
  switch (key) {
    case 'all':
      for (const c of value as Condition[]) satisfy(c, s, p);
      return;
    case 'any':
      satisfy((value as Condition[])[0]!, s, p);
      return;
    case 'echo':
      p.echoes.push(value as string);
      return;
    case 'location':
      s.world.currentLocationId = value as string;
      return;
    case 'region':
      s.world.currentLocationId = pack.index.locationsByRegion[value as string]![0]!;
      return;
    case 'flag':
      s.flags[value as string] = true;
      return;
    case 'corruption':
      s.player.corruption = (v.min as number | undefined) ?? (v.max as number);
      return;
    case 'killed':
      s.counters.kills[v.id] = (v.count as number | undefined) ?? 1;
      return;
    case 'item':
      s.player.inventory.push({ uid: `i${s.meta.nextUid++}`, itemId: v.id, qty: (v.count as number | undefined) ?? 1, rarity: 'common', affixes: [] });
      return;
    case 'quest': {
      const quest = pack.quests[v.id]!;
      s.quests[v.id] = { status: (v.status as 'completed' | undefined) ?? 'completed', stage: (v.stage as string | undefined) ?? quest.stages[0]!.id, startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] };
      return;
    }
    case 'companion': {
      s.companions.recruited[v.id] = { id: v.id, recruited: true, loyalty: 50, hp: 10, hpMax: 10, ko: v.state === 'ko', dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} };
      if (v.state === undefined || v.state === 'active') s.companions.activeId = v.id;
      return;
    }
    default:
      throw new Error(`satisfy: the codex does not use '${key}'`);
  }
}

/** Runs the pass over before → after; returns the profile and events it produced. */
function pass(before: GameState, beforeProfile: Profile, after: GameState, afterProfile: Profile = beforeProfile) {
  const ctx = makeCtx(after, afterProfile, pack);
  codexUnlockPass(ctx, deepFreeze(before), deepFreeze(beforeProfile));
  return { profile: ctx.profile, events: ctx.events };
}

const entries = Object.values(pack.codex).filter((e) => e !== undefined);

describe('the index', () => {
  const index = codexUnlockIndex(pack);

  test('built once per pack; every entry with a condition, in pack order, and none on `always`', () => {
    expect(codexUnlockIndex(pack)).toBe(index);
    expect(index.entries.map((e) => e.id)).toEqual(entries.filter((e) => e.unlockWhen !== undefined && !e.unlockedAtStart).map((e) => e.id));
    expect(index.always).toEqual([]);
    expect(entries).toHaveLength(90);
  });

  test('an entry is listed under every (atom, id) its condition reads', () => {
    for (const entry of index.entries) {
      for (const { atom, id } of conditionAtoms(entry.unlockWhen)) {
        const list = atom === 'echo' ? index.echo : atom === 'corruption' ? index.corruption : (index[atom as 'flag'] as ReadonlyMap<string, readonly string[]>).get(id!);
        expect(list).toContain(entry.id);
      }
    }
  });

  test('a step that changes nothing the codex reads marks nothing; a move marks only that place’s entries', () => {
    const s = base();
    const p = freshProfile();
    expect(dirtyCodexEntries(index, s, p, clone(s), p, pack)).toEqual([]);
    const moved = clone(s);
    moved.player.gold += 5;
    moved.clock.ticks += 1;
    expect(dirtyCodexEntries(index, s, p, moved, p, pack)).toEqual([]);
    const located = index.entries.find((e) => conditionAtoms(e.unlockWhen).some((a) => a.atom === 'location'))!;
    const to = conditionAtoms(located.unlockWhen).find((a) => a.atom === 'location')!.id!;
    moved.world.currentLocationId = to;
    const dirty = dirtyCodexEntries(index, s, p, moved, p, pack);
    expect(dirty).toContain(located.id);
    expect(dirty.length).toBeLessThan(index.entries.length);
    expect(dirtyCodexEntries(index, s, p, clone(s), p, pack, true)).toHaveLength(index.entries.length);
  });

  test('an atom outside the index puts its entry on `always`', () => {
    const odd = { ...pack, codex: { codex_x: { ...entries[0]!, id: 'codex_x', unlockedAtStart: false, unlockWhen: { day: { min: 3 } } } } } as ContentPack;
    const idx = codexUnlockIndex(odd);
    expect(idx.always).toEqual(['codex_x']);
    const s = makeState({}, { content: pack });
    const later = clone(s);
    later.clock.ticks = 8;
    const ctx = makeCtx(later, freshProfile(), odd);
    codexUnlockPass(ctx, s, freshProfile());
    expect(ctx.profile.codexUnlocked).toEqual(['codex_x']);
  });
});

describe('every entry', () => {
  for (const entry of entries) {
    test(entry.id, () => {
      const before = base();
      const profile = freshProfile();
      if (entry.unlockedAtStart) {
        // unlocked already: the pass never adds it (the codex shows it from the start)
        const out = pass(before, profile, clone(before), profile);
        expect(out.profile.codexUnlocked).not.toContain(entry.id);
        return;
      }
      if (entry.unlockWhen === undefined) {
        // effect-only: not even a full sweep unlocks it
        const ctx = makeCtx(clone(before), profile, pack);
        codexUnlockPass(ctx, before, profile, { type: 'newGame', classId: 'ranger', seed: 'x' } as never);
        expect(ctx.profile.codexUnlocked).not.toContain(entry.id);
        return;
      }
      const after = clone(before);
      const afterProfile = clone(profile);
      satisfy(entry.unlockWhen, after, afterProfile);
      expect(evaluate(entry.unlockWhen, after, afterProfile, pack)).toBe(true);
      const out = pass(before, profile, after, afterProfile);
      expect(out.profile.codexUnlocked).toContain(entry.id);
      expect(out.events).toContainEqual({ t: 'codexUnlocked', codexId: entry.id });
    });
  }
});

describe('through step', () => {
  const located = codexUnlockIndex(pack).entries.find((e) => {
    const atoms = conditionAtoms(e.unlockWhen);
    return atoms.length === 1 && atoms[0]!.atom === 'location';
  })!;
  const target = conditionAtoms(located.unlockWhen)[0]!.id!;
  const from = pack.locations[target]!.exits.find((x) => x.when === undefined && pack.locations[x.to] !== undefined)?.to;

  test('a move into the place unlocks its entry once, with the event, and the pass is the last hook', () => {
    expect(POST_STEP_HOOKS.at(-1)).toBe(codexUnlockPass);
    expect(from).toBeDefined();
    const s = makeState({ locationId: from! }, { content: pack });
    const out = step(s, { type: 'move', to: target } as never, pack, freshProfile());
    expect(out.state.world.currentLocationId).toBe(target);
    expect(out.profile.codexUnlocked).toContain(located.id);
    expect(out.events.filter((e) => e.t === 'codexUnlocked' && e.codexId === located.id)).toHaveLength(1);
    // no double unlock: standing there again (a wait) adds nothing
    const again = step(out.state, { type: 'wait' } as never, pack, out.profile);
    expect(again.events.some((e) => e.t === 'codexUnlocked')).toBe(false);
    expect(again.profile.codexUnlocked.filter((id) => id === located.id)).toHaveLength(1);
  });

  test('the `unlockCodex` effect still unlocks, once, and the pass does not repeat it', () => {
    const effectOnly = entries.find((e) => e.unlockWhen === undefined && !e.unlockedAtStart)!;
    const stepFn = createStep({ ...HANDLERS, interact: (ctx) => applyAll([{ unlockCodex: effectOnly.id }, { unlockCodex: effectOnly.id }], ctx) }, POST_STEP_HOOKS);
    const out = stepFn(base(), { type: 'interact', eventId: 'ev_test' } as never, pack, freshProfile());
    expect(out.profile.codexUnlocked).toEqual([effectOnly.id]);
    expect(out.events.filter((e) => e.t === 'codexUnlocked')).toEqual([{ t: 'codexUnlocked', codexId: effectOnly.id }]);
  });

  test('an entry already unlocked is never unlocked again', () => {
    const entry = codexUnlockIndex(pack).entries[0]!;
    const before = base();
    const after = clone(before);
    const profile = freshProfile({ codexUnlocked: [entry.id] });
    const afterProfile = clone(profile);
    satisfy(entry.unlockWhen!, after, afterProfile);
    const out = pass(before, profile, after, afterProfile);
    expect(out.events.filter((e) => e.t === 'codexUnlocked' && e.codexId === entry.id)).toEqual([]);
    expect(out.profile.codexUnlocked.filter((id) => id === entry.id)).toHaveLength(1);
  });

  test('without the before state (a hook driven by hand) the pass does nothing', () => {
    const ctx = makeCtx(base(), freshProfile(), pack);
    codexUnlockPass(ctx);
    expect(ctx.events).toEqual([]);
  });
});
