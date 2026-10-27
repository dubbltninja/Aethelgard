// The Abilities panel (U67; DESIGN §5.1, §6.3–6.4): the model (a branch per tab as a ladder of five tiers, each ability's state,
// cost in half-points, facts and the engine's reason when shut; the Character tab's stat rows with what one more point does, the
// derived numbers and the respec) and AbilitiesView / BranchView / CharacterView, driven through tests/unit/ui/tree.ts.
import { describe, expect, mock, test } from 'bun:test';
import { loadScenario } from '@sim/scenarios';
import { AbilitiesView, BranchView, CharacterView } from '@ui/panels/AbilitiesPanel';
import { CHARACTER_TAB, abilitiesModel, abilityLabel, apText } from '@ui/panels/abilitiesModel';
import { notExploring } from '@ui/panels/panelAction';
import { all, byName, call, expand, nameOf } from './tree';
import { legalFor, pack, place } from './panelFixtures';

describe('abilitiesModel', () => {
  test('half-points read as ½, 1, 1½ AP', () => {
    expect([0, 1, 2, 3, 4].map(apText)).toEqual(['0 AP', '½ AP', '1 AP', '1½ AP', '2 AP']);
  });

  test('a tab per branch of the class and a Character tab that counts the points to spend', () => {
    const at = place('loop1_respite');
    const m = abilitiesModel(at.state, pack, at.profile, legalFor(at));
    const cls = pack.classes[at.state.player.classId]!;
    expect(m.tabs.map((t) => t.id)).toEqual([...cls.branches.map((b) => b.id), CHARACTER_TAB]);
    expect(m.tabs.at(-1)).toMatchObject({ label: 'Character', count: at.state.player.statPoints });
    expect(m.className).toBe(cls.name);
    expect(m.level).toBe(at.state.player.level);
    expect(m.apLabel).toBe(apText(at.state.player.apHalf));
    expect(m.readOnly).toBeNull();
  });

  test('each branch is a ladder of five tiers in order, with the engine’s reason on what is shut', () => {
    const at = place('loop1_respite');
    const m = abilitiesModel(at.state, pack, at.profile, legalFor(at));
    for (const b of m.branches) {
      expect(b.rows.map((r) => r.tier)).toEqual([1, 2, 3, 4, 5]);
      expect(b.total).toBe(5);
      for (const r of b.rows) {
        expect(r.costText).toMatch(/^\d?½? ?AP|^½ AP/);
        expect(r.facts.length).toBeGreaterThan(0);
        if (r.state === 'locked') {
          expect(r.lockedReason).not.toBeNull();
          expect(r.unlock!.enabled).toBe(false);
          expect(r.unlock!.reason).toBe(r.lockedReason);
        }
        if (r.state === 'ready') {
          expect(r.lockedReason).toBeNull();
          expect(r.unlock).toMatchObject({ enabled: true, action: { type: 'unlockAbility', abilityId: r.id } });
        }
        if (r.state === 'unlocked') expect(r.unlock).toBeNull();
      }
    }
    const ready = m.branches.flatMap((b) => b.rows).filter((r) => r.state === 'ready');
    expect(ready.length).toBeGreaterThan(0);
    const locked = m.branches.flatMap((b) => b.rows).find((r) => r.state === 'locked' && r.tier === 5)!;
    expect(locked.lockedReason).toMatch(/level|ability|abilities|point/i);
  });

  test('the starting ability is known from the start; unlocking moves a node from ready to unlocked', () => {
    const at = place('loop1_respite');
    const m = abilitiesModel(at.state, pack, at.profile, legalFor(at));
    const known = m.branches.flatMap((b) => b.rows).filter((r) => r.state === 'unlocked');
    for (const r of known) expect(at.state.player.abilitiesUnlocked).toContain(r.id);
    const next = m.branches.flatMap((b) => b.rows).find((r) => r.state === 'ready')!;
    at.state.player.abilitiesUnlocked.push(next.id);
    at.state.player.apHalf -= 2;
    const after = abilitiesModel(at.state, pack, at.profile, legalFor(at));
    expect(after.branches.flatMap((b) => b.rows).find((r) => r.id === next.id)).toMatchObject({ state: 'unlocked', unlock: null });
    expect(after.apHalf).toBe(m.apHalf - 2);
  });

  test('mastered in an earlier loop: half the points, and it says so', () => {
    const at = place('loop1_respite');
    const m = abilitiesModel(at.state, pack, at.profile, legalFor(at));
    const next = m.branches.flatMap((b) => b.rows).find((r) => r.state === 'ready')!;
    at.profile.classMastery[at.state.player.classId] = { loopsPlayed: 1, mastered: [next.id], endings: [], bestLevel: 3, bestDays: null };
    const after = abilitiesModel(at.state, pack, at.profile, legalFor(at));
    const row = after.branches.flatMap((b) => b.rows).find((r) => r.id === next.id)!;
    expect(row.mastered).toBe(true);
    expect(row.costText).toBe('½ AP (mastered)');
    expect(next.costText).toBe('1 AP');
  });

  test('stat rows: one more point, what it changes, and the points left', () => {
    const at = place('loop1_respite');
    const c = abilitiesModel(at.state, pack, at.profile, legalFor(at)).character;
    expect(c.stats.map((s) => s.stat)).toEqual(['strength', 'magic', 'agility']);
    for (const s of c.stats) {
      expect(s.allocate).toMatchObject({ id: `allocate-${s.stat}`, enabled: true, action: { type: 'allocateStat', stat: s.stat } });
      expect(s.effect.length).toBeGreaterThan(0);
      expect(s.value).toBe(at.state.player.stats[s.stat]);
    }
    expect(c.derived.map((d) => d.label)).toContain('Attack');
    at.state.player.statPoints = 0;
    const none = abilitiesModel(at.state, pack, at.profile, legalFor(at)).character.stats[0]!.allocate;
    expect(none.enabled).toBe(false);
    expect(none.reason).toMatch(/point/i);
  });

  test('respec: only at a camp fire, with the cost and the points it gives back; behind a question', () => {
    const inn = place('loop1_respite');
    const off = abilitiesModel(inn.state, pack, inn.profile, legalFor(inn)).character.respec;
    expect(off.action.enabled).toBe(false);
    expect(off.summary).toContain('camp fire');
    const camp = place('loop1_emberforge');
    const on = abilitiesModel(camp.state, pack, camp.profile, legalFor(camp)).character.respec;
    expect(on.action).toMatchObject({ id: 'respec', enabled: true, danger: true });
    expect(on.action.confirm).toMatch(/^Let go of \d+ abilit/);
    expect(on.action.confirm).toContain(`${on.cost} gold`);
    expect(on.summary).toMatch(/^Gives back .* AP from \d+ abilit/);
  });

  test('in a fight nothing can be spent and the panel says so', () => {
    const at = place('loop1_respite');
    at.state.mode = 'combat';
    const m = abilitiesModel(at.state, pack, at.profile, legalFor(at));
    expect(m.readOnly).toBe(notExploring('combat'));
    const buttons = [...m.branches.flatMap((b) => b.rows.map((r) => r.unlock)), ...m.character.stats.map((s) => s.allocate), m.character.respec.action];
    expect(buttons.filter((b) => b !== null).every((b) => !b!.enabled)).toBe(true);
  });

  test('a node’s name reads: ability, tier, state, cost', () => {
    const at = place('loop1_respite');
    const row = abilitiesModel(at.state, pack, at.profile, legalFor(at)).branches.flatMap((b) => b.rows).find((r) => r.state === 'ready')!;
    expect(abilityLabel(row)).toBe(`${row.name}, tier ${row.tier}, ready to unlock, ${row.costText}`);
    const known = abilitiesModel(at.state, pack, at.profile, legalFor(at)).branches.flatMap((b) => b.rows).find((r) => r.state === 'unlocked');
    if (known !== undefined) expect(abilityLabel(known)).not.toContain('AP');
  });
});

describe('AbilitiesView', () => {
  const at = place('loop1_respite');
  const model = abilitiesModel(at.state, pack, at.profile, legalFor(at));
  const onRun = mock();
  const onTab = mock();

  test('the bar says level, ability points and stat points; the tabs name each branch and the Character tab', () => {
    const tree = expand(<AbilitiesView model={model} tab={model.tabs[0]!.id} onTab={onTab} onRun={onRun} />);
    expect(tree.some((n) => n.type === 'span' && n.text === `${model.className} · Level ${model.level}`)).toBe(true);
    expect(tree.some((n) => n.type === 'span' && n.text === `${model.apLabel} to spend`)).toBe(true);
    const tabs = all(tree, 'button').filter((n) => n.props.role === 'tab');
    expect(tabs).toHaveLength(model.tabs.length);
    expect(tabs[0]!.props['aria-selected']).toBe(true);
    call(tabs.at(-1)!, 'onClick');
    expect(onTab).toHaveBeenCalledWith(CHARACTER_TAB);
  });

  test('a ready node: an Unlock button that names the ability and its cost and runs the action', () => {
    const branch = model.branches.find((b) => b.rows.some((r) => r.state === 'ready'))!;
    const ready = branch.rows.find((r) => r.state === 'ready')!;
    const tree = expand(<BranchView branch={branch} onRun={onRun} />);
    const unlock = byName(tree, 'button', `Unlock ${ready.name} for ${ready.costText}`);
    expect(unlock.props.disabled).toBe(false);
    expect(unlock.props['data-action-id']).toBe(`unlock-${ready.id}`);
    call(unlock, 'onClick');
    expect(onRun).toHaveBeenCalledWith(ready.unlock);
    expect(tree.find((n) => n.type === 'ol')?.props['aria-label']).toBe(`${branch.name} abilities, by tier`);
  });

  test('a locked node: the button is off, described by the reason written beside it', () => {
    const branch = model.branches.find((b) => b.rows.some((r) => r.state === 'locked'))!;
    const locked = branch.rows.find((r) => r.state === 'locked')!;
    const tree = expand(<BranchView branch={branch} onRun={onRun} />);
    const unlock = byName(tree, 'button', `Unlock ${locked.name} for ${locked.costText}`);
    expect(unlock.props.disabled).toBe(true);
    expect(unlock.props['aria-describedby']).toBe(`why-${locked.id}`);
    expect(tree.find((n) => n.props.id === `why-${locked.id}`)?.text).toBe(locked.lockedReason!);
    const item = tree.find((n) => n.type === 'li' && n.props['data-ability-id'] === locked.id)!;
    expect(item.props['data-state']).toBe('locked');
  });

  test('the Character tab: +1 for each stat with what it does; the numbers; the respec question', () => {
    const tree = expand(<CharacterView character={model.character} statPoints={model.statPoints} onRun={onRun} />);
    expect(tree.find((n) => n.props.id === 'char-stats')?.text).toContain(`${model.statPoints} to spend`);
    const add = byName(tree, 'button', 'Add a point to Strength');
    expect(nameOf(add)).toBe('Add a point to Strength');
    call(add, 'onClick');
    expect(onRun).toHaveBeenCalledWith(model.character.stats[0]!.allocate);
    expect(tree.filter((n) => n.type === 'span' && n.props.className === 'stat-row__effect')).toHaveLength(3);
    expect(all(tree, 'dt').map((n) => n.text)).toContain('Attack');
    expect(tree.find((n) => n.props['data-testid'] === 'respec-summary')?.text).toContain('camp fire');
    expect(byName(tree, 'button', /^Rethink your path/).props.disabled).toBe(true);
  });

  test('a stat button with no points left says why', () => {
    const none = structuredClone(model.character);
    none.stats[1] = { ...none.stats[1]!, allocate: { ...none.stats[1]!.allocate, enabled: false, reason: 'You have no stat points to spend' } };
    const tree = expand(<CharacterView character={none} statPoints={0} onRun={onRun} />);
    expect(tree.find((n) => n.props.id === 'allocate-magic-why')?.text).toBe('You have no stat points to spend');
  });

  test('in a fight the view says nothing can be changed', () => {
    const fight = place('loop1_respite');
    fight.state.mode = 'combat';
    const m = abilitiesModel(fight.state, pack, fight.profile, legalFor(fight));
    const tree = expand(<AbilitiesView model={m} tab={m.tabs[0]!.id} onTab={onTab} onRun={onRun} />);
    expect(tree.find((n) => n.type === 'p' && n.props.role === 'status')?.text).toBe(notExploring('combat')!);
  });
});

test('the real scenario leaves points to spend (the e2e relies on it)', () => {
  const { state } = loadScenario('loop1_respite', pack);
  expect(state.player.statPoints).toBeGreaterThan(0);
  expect(state.player.apHalf).toBeGreaterThanOrEqual(2);
});
