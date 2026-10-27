// The Combat screen's model (U65; PLAN §8.3 `abilityBar` / `enemyCard` rules): pure functions of the state, the pack, the
// profile and the legal list, checked on scenario fights from the fixture pack (the first fight: two Corrupted Shades;
// the Unveiled Tyrant's communion in Movement II) and on states edited from them.
import { describe, expect, test } from 'bun:test';
import { legalActions, type GameEvent, type GameState, type Profile } from '@engine/index';
import { loadScenario } from '@sim/scenarios';
import {
  abilityTiles,
  aftermathModel,
  allyChoices,
  bannerModel,
  combatItems,
  combatLogLines,
  communionButtons,
  communionModel,
  companionCard,
  cycleTarget,
  effectiveTarget,
  enemyCards,
  explainHits,
  fightTitle,
  fleeModel,
  guardModel,
  humanize,
  intentChip,
  nextChip,
  phaseSegments,
  playerPanel,
  rangeText,
  statusChips,
  tileName,
  turnOrder,
} from '@ui/screens/combatModel';
import { fixturePack } from '@tests/fixtures/miniContent';

const content = fixturePack();

interface Fight {
  s: GameState;
  p: Profile;
}

const firstFight = (opts: { companionId?: string } = {}): Fight => {
  const { state, profile } = loadScenario('first_fight', content, opts);
  return { s: state, p: profile };
};
const communion = (): Fight => {
  const { state, profile } = loadScenario('communion_movement_2', content);
  return { s: state, p: profile };
};
const legalOf = (f: Fight) => legalActions(f.s, content, f.p);
const combatOf = (f: Fight) => f.s.combat!;

describe('statuses and intents', () => {
  test('a status chip says its name, stacks, turns (and a Shield its pool) in text and words', () => {
    const chips = statusChips(content, [
      { statusId: 'status_bleed', stacks: 2, duration: 3, sourceUid: null, appliedOnOwnTurn: false },
      { statusId: 'status_shield', stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, tick: 16 },
      { statusId: 'status_unknown', stacks: 1, duration: 0, sourceUid: null, appliedOnOwnTurn: false },
    ]);
    expect(chips.map((c) => c.text)).toEqual(['Bleed ×2 · 3', 'Shield 16 · 2', 'status_unknown']);
    expect(chips[0]?.label).toBe('Bleed, 2 stacks, 3 turns left');
    expect(chips[1]?.label).toBe('Shield, 16 points, 2 turns left');
    expect(chips.map((c) => c.kind)).toEqual(['debuff', 'buff', 'debuff']);
    expect(chips.map((c) => c.icon)).toEqual(['status_bleed', 'status_shield', 'danger']);
    expect(rangeText([9, 9])).toBe('9');
  });

  test('the intent chip: name, type, range, target, the Guard preview; hidden is a "?" with the type only', () => {
    const f = firstFight();
    const combat = combatOf(f);
    const shade = combat.enemies[0]!;
    const intent = combat.intents[shade.uid]!;
    const chip = intentChip({ s: f.s, profile: f.p, content }, combat, shade, intent);
    expect(chip.name).toBe('Rake');
    expect(chip.damageType).toBe('physical');
    expect(chip.glyph).toBe('dmg_physical');
    expect(chip.range).toBe(rangeText(intent.projected));
    expect(chip.target).toBe('you');
    expect(chip.guarded).not.toBeNull();
    expect(chip.label).toMatch(/^Intent: Rake, physical, \d+ to \d+ damage, targeting you\.$/);
    const hidden = intentChip({ s: f.s, profile: f.p, content }, combat, shade, { ...intent, hidden: true });
    expect(hidden).toMatchObject({ hidden: true, name: '?', range: '?', glyph: 'dmg_physical', line: '' });
    expect(hidden.label).toBe('Intent: hidden, physical. It shows itself before it lands.');
    const all = intentChip({ s: f.s, profile: f.p, content }, combat, shade, { ...intent, targetUid: null, tags: ['ALL', 'may Weaken'] });
    expect(all).toMatchObject({ target: 'ALL', targetKind: 'all', tags: ['may Weaken'] });
    expect(all.label).toContain('targeting everyone, may Weaken');
    const self = intentChip({ s: f.s, profile: f.p, content }, combat, shade, { ...intent, targetUid: null, tags: [] });
    expect(self.targetKind).toBe('self');
  });

  test('the next-next chip shows only while foreseen (Foresight, Hunter’s Eye)', () => {
    const f = firstFight();
    const combat = combatOf(f);
    const shade = combat.enemies[0]!;
    expect(nextChip({ s: f.s, profile: f.p, content }, combat, shade)).toBeNull();
    combat.cooldowns.foresight = 2;
    const next = nextChip({ s: f.s, profile: f.p, content }, combat, shade);
    expect(next?.next).toBe(true);
    expect(next?.label).toMatch(/^Then: /);
  });
});

describe('enemy cards and targets', () => {
  test('one card per enemy: the target is selected, the attackable are targetable, resistances wait for a kill', () => {
    const f = firstFight();
    const legal = legalOf(f);
    const combat = combatOf(f);
    const target = effectiveTarget(combat, null);
    expect(target).toBe(combat.enemies[0]!.uid);
    const cards = enemyCards(f.s, content, f.p, legal, target);
    expect(cards.map((c) => c.name)).toEqual(['Corrupted Shade A', 'Corrupted Shade B']);
    expect(cards.map((c) => c.selected)).toEqual([true, false]);
    expect(cards.every((c) => c.targetable && c.alive && c.rank === null && c.phase === null)).toBe(true);
    expect(cards[0]?.resistances).toBeNull();
    expect(cards[0]?.intent?.name).toBe('Rake');
    const known = enemyCards(f.s, content, { ...f.p, bestiary: { cr_corrupted_shade: { seen: 1, killed: 1, spared: 0, revealed: 'resist', intentsSeen: [] } } }, legal, target);
    expect(known[0]?.resistances?.length).toBeGreaterThan(0);
    expect(known[0]?.resistances?.every((r) => r.text.length > 0 && r.level !== 'neutral')).toBe(true);
    expect(fightTitle(combat)).toBe('Corrupted Shade A and Corrupted Shade B');
    expect(fightTitle(null)).toBe('Combat');
  });

  test('the target falls back to the leftmost standing enemy; ← / → cycle and wrap', () => {
    const f = firstFight();
    const combat = combatOf(f);
    const [a, b] = combat.enemies.map((e) => e.uid) as [string, string];
    expect(effectiveTarget(combat, b)).toBe(b);
    expect(cycleTarget(combat, a, 1)).toBe(b);
    expect(cycleTarget(combat, b, 1)).toBe(a);
    expect(cycleTarget(combat, a, -1)).toBe(b);
    expect(cycleTarget(combat, 'nobody', 1)).toBe(a);
    combat.enemies[1]!.alive = false;
    expect(effectiveTarget(combat, b)).toBe(a);
    expect(cycleTarget(combat, a, 1)).toBe(a);
    expect(effectiveTarget(null, a)).toBeNull();
    expect(cycleTarget(null, a, 1)).toBeNull();
    const cards = enemyCards(f.s, content, f.p, legalOf(f), a);
    expect(cards[1]).toMatchObject({ alive: false, targetable: false, intent: null });
  });

  test('a boss: rank, phase, and the bar segmented at its later phases', () => {
    const f = communion();
    const boss = combatOf(f).enemies[0]!;
    expect(phaseSegments(content, boss)).toEqual([0.75, 0.5]);
    const card = enemyCards(f.s, content, f.p, legalOf(f), boss.uid)[0]!;
    expect(card.rank).toBe('Boss');
    expect(card.phase).toEqual({ index: 0, count: 3, name: 'Lament' });
    expect(card.segments).toEqual([0.75, 0.5]);
  });

  test('the turn order strip marks the actor and who has acted', () => {
    const f = firstFight();
    const combat = combatOf(f);
    const order = turnOrder(combat);
    expect(order.find((t) => t.current)?.name).toBe('You');
    expect(order.length).toBe(combat.turnOrder.length);
    combat.turnIndex = 1;
    expect(turnOrder(combat)[0]?.done).toBe(true);
    expect(turnOrder(null)).toEqual([]);
  });
});

describe('the player panel, Guard, Flee, items', () => {
  test('meters, the Guard preview for every hit coming, flee odds', () => {
    const f = firstFight();
    const legal = legalOf(f);
    const panel = playerPanel(f.s, content)!;
    expect(panel).toMatchObject({ resourceName: 'Focus', guarding: false });
    expect(panel.hp).toBe(panel.hpMax);
    const guard = guardModel(f.s, content, f.p, legal);
    expect(guard.enabled).toBe(true);
    expect(guard.previews).toHaveLength(2);
    expect(guard.previews[0]).toMatch(/^Rake \d+(–\d+)? → \d+(–\d+)?$/);
    const flee = fleeModel(f.s, content, legal);
    expect(flee).toMatchObject({ shown: true, enabled: true, leave: false, reason: null });
    expect(flee.label).toBe(`Flee · ${flee.chance}%`);
    // not the player's turn: nothing is legal, each says why
    const none = guardModel(f.s, content, f.p, []);
    expect(none).toMatchObject({ enabled: false, reason: 'Not your turn' });
    expect(fleeModel(f.s, content, []).reason).toBe('Not your turn');
    combatOf(f).canFlee = false;
    expect(fleeModel(f.s, content, legalOf(f))).toMatchObject({ shown: false, enabled: false, reason: 'There is no fleeing from this fight' });
    expect(playerPanel({ ...f.s, combat: null }, content)).toBeNull();
    expect(guardModel({ ...f.s, combat: null }, content, f.p, [])).toEqual({ enabled: false, reason: null, previews: [] });
  });

  test('items: one use per legal way, an enemy-aimed one only at the target', () => {
    const f = firstFight();
    const items = combatItems(f.s, content, legalOf(f), effectiveTarget(combatOf(f), null));
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.uses[0]?.label).toBe('Use');
    expect(items[0]?.uses[0]?.action.type).toBe('item');
    expect(combatItems(f.s, content, [], null)).toEqual([]);
    expect(combatItems({ ...f.s, combat: null }, content, [], null)).toEqual([]);
  });
});

describe('the ability bar (PLAN §8.3 abilityBar.test)', () => {
  test('Attack is 1; the abilities follow by branch then tier as 2–9; tiles mirror the legal list', () => {
    const f = firstFight();
    f.s.player.abilitiesUnlocked = ['rgr_rend', 'rgr_piercing_arrow', 'rgr_marked_shot'];
    const target = effectiveTarget(combatOf(f), null);
    const tiles = abilityTiles(f.s, content, legalOf(f), target);
    expect(tiles.map((t) => [t.key, t.name, t.branchName])).toEqual([
      ['1', 'Attack', 'Weapon'],
      ['2', 'Marked Shot', 'Hunt'],
      ['3', 'Piercing Arrow', 'Hunt'],
      ['4', 'Rend', 'Steel'],
    ]);
    for (const t of tiles) expect(t.enabled).toBe(legalOf(f).some((a) => (t.kind === 'attack' ? a.type === 'attack' : a.type === 'ability' && a.abilityId === t.id)));
    expect(tiles[1]?.cost).toMatch(/^\d+ Focus$/);
    expect(tiles[1]?.tier).toBe(1);
    expect(tileName(tiles[0]!, 'Corrupted Shade A')).toBe('1: Attack, at Corrupted Shade A');
  });

  test('disabled tiles say why: "Needs N Focus", "Cooldown 2", "Not your turn"', () => {
    const f = firstFight();
    f.s.player.abilitiesUnlocked = ['rgr_marked_shot', 'rgr_rend'];
    const combat = combatOf(f);
    combat.party[0]!.mp = 0;
    combat.cooldowns.rgr_rend = 2;
    const target = effectiveTarget(combat, null);
    const tiles = abilityTiles(f.s, content, legalOf(f), target);
    const marked = tiles.find((t) => t.id === 'rgr_marked_shot')!;
    expect(marked.enabled).toBe(false);
    expect(marked.reason).toBe(`Needs ${marked.cost?.split(' ')[0]} Focus`);
    const rend = tiles.find((t) => t.id === 'rgr_rend')!;
    expect(rend).toMatchObject({ enabled: false, cooldown: 2 });
    expect(rend.reason === 'Cooldown 2' || rend.reason?.startsWith('Needs')).toBe(true);
    expect(tileName(marked, 'X')).toBe(`2: Marked Shot, ${marked.cost}, ${marked.reason}`);
    const idle = abilityTiles(f.s, content, [], target);
    expect(idle.map((t) => t.reason)).toEqual(['Not your turn', 'Not your turn', 'Not your turn']);
    expect(abilityTiles(f.s, content, legalOf(f), null)[0]).toMatchObject({ enabled: false, reason: 'No target' });
    expect(abilityTiles({ ...f.s, combat: null }, content, [], null)).toHaveLength(1);
  });
});

describe('the companion card', () => {
  test('HP, stance as legal choices, the signature as Command, the free orders', () => {
    const f = firstFight({ companionId: 'ilyra' });
    const legal = legalOf(f);
    const target = effectiveTarget(combatOf(f), null);
    const card = companionCard(f.s, content, legal, target)!;
    expect(card.name).toBe('Ilyra');
    expect(card.ko).toBe(false);
    expect(card.stances.filter((s) => s.current)).toHaveLength(1);
    expect(card.stances.filter((s) => !s.current).every((s) => s.enabled)).toBe(true);
    expect(card.signature?.name).toBe('Archive Light');
    expect(card.signature?.enabled).toBe(legal.some((a) => a.type === 'companionCommand' && a.command === 'signature'));
    expect(card.focus.label).toMatch(/^Focus on Corrupted Shade/);
    expect(card.hold.enabled).toBe(true);
    // a cooldown says so; a knocked-out companion has nothing to press
    combatOf(f).party.find((p) => p.kind === 'companion')!.cooldowns.comp_ilyra_archive_light = 3;
    const cooling = companionCard(f.s, content, legalOf(f), target)!;
    expect(cooling.signature).toMatchObject({ enabled: false, reason: 'Cooldown 3', cooldown: 3 });
    combatOf(f).party.find((p) => p.kind === 'companion')!.alive = false;
    expect(companionCard(f.s, content, legalOf(f), target)?.ko).toBe(true);
    expect(companionCard(firstFight().s, content, [], null)).toBeNull();
  });

  test('an ally ability lists who it can go to', () => {
    const f = firstFight({ companionId: 'ilyra' });
    const legal = legalOf(f);
    const fake = [...legal, { type: 'ability' as const, abilityId: 'x', targetUid: combatOf(f).party[0]!.uid }, { type: 'ability' as const, abilityId: 'x', targetUid: combatOf(f).party[1]!.uid }];
    expect(allyChoices(f.s, fake, 'x').map((c) => c.label)).toEqual(['Yourself', 'Ilyra']);
    expect(allyChoices({ ...f.s, combat: null }, fake, 'x')).toEqual([]);
  });
});

describe('communion (DESIGN §4.11)', () => {
  test('Movement II: Resolve, the question, answers greyed with what they need, Listen, offers, Resist', () => {
    const f = communion();
    const m = communionModel(f.s, content, f.p, legalOf(f))!;
    expect(m).toMatchObject({ active: true, movement: 2, resolve: 5, resolveMax: 8, questionIndex: 1, resolution: null });
    expect(m.question).toBe("'What is read is owed. What have you read?'");
    expect(m.answers.length).toBeGreaterThan(0);
    for (const a of m.answers) {
      if (!a.enabled) expect(a.reason).toMatch(/^(Needs |Already said)/);
    }
    expect(m.listen.enabled).toBe(true);
    const buttons = communionButtons(m);
    expect(buttons.map((b) => b.key)).toEqual(buttons.map((_, i) => (i < 9 ? String(i + 1) : null)));
    expect(buttons.find((b) => b.group === 'listen')?.label).toBe('Listen');
    expect(buttons[buttons.length - 1]?.group).toBe('resist');
    expect(buttons.filter((b) => b.group === 'offer').every((b) => b.reason !== null || b.enabled)).toBe(true);
    // after a Listen this Movement it says so
    f.s.combat!.communion!.listened = true;
    expect(communionModel(f.s, content, f.p, legalOf(f))?.listen.reason).toBe('You have listened in this Movement');
  });

  test('before it opens: Commune and Listen as legal, else why; nothing in Loop 1; the Resolution offers outcomes', () => {
    const f = communion();
    const combat = combatOf(f);
    combat.communion = null;
    const closed = communionModel(f.s, content, f.p, legalOf(f))!;
    expect(closed.active).toBe(false);
    const legal = legalOf(f);
    expect(closed.canToggle).toBe(legal.some((a) => a.type === 'commune' && a.act === 'toggle'));
    if (!closed.canToggle && !closed.canOpenByListening) expect(closed.openReason).not.toBeNull();
    expect(communionButtons(closed).every((b) => b.key === null && b.group === 'open')).toBe(true);
    const opened = communionButtons({ ...closed, canToggle: true, canOpenByListening: true });
    expect(opened.map((b) => b.label)).toEqual(['Commune (free)', 'Listen']);
    expect(communionModel({ ...f.s, meta: { ...f.s.meta, loop: 1 } }, content, f.p, legal)).toBeNull();
    expect(communionButtons(null)).toEqual([]);

    const r = communion();
    const c = r.s.combat!.communion!;
    c.movement = 3;
    c.questionIndex = 99;
    r.s.world.tyrant = 'spared';
    const resolving = communionModel(r.s, content, r.p, legalOf(r))!;
    expect(resolving.resolution?.length).toBeGreaterThan(0);
    expect(resolving.answers).toEqual([]);
    expect(resolving.listen).toEqual({ enabled: false, reason: 'Only your answer remains' });
    expect(communionButtons(resolving).every((b) => b.group === 'resolution')).toBe(true);
    expect(humanize('pass_into_before')).toBe('Pass into before');
    expect(communionModel(firstFight().s, content, firstFight().p, [])).toBeNull();
  });
});

describe('log, explanations, banners, aftermath', () => {
  test('explainHits says each hit in plain words, and the log line finds it', () => {
    const f = firstFight();
    const combat = combatOf(f);
    const player = combat.party[0]!;
    const shade = combat.enemies[0]!;
    shade.statuses.push({ statusId: 'status_mark', stacks: 1, duration: 2, sourceUid: player.uid, appliedOnOwnTurn: false });
    shade.guarding = true;
    const events: GameEvent[] = [
      { t: 'turnStarted', uid: player.uid, round: 1 },
      { t: 'attackResolved', sourceUid: player.uid, targetUid: shade.uid, hit: true, crit: true },
      { t: 'interplay', rule: 'mark', targetUid: shade.uid },
      { t: 'damageDealt', sourceUid: player.uid, targetUid: shade.uid, amount: 12, damageType: 'ley', mitigated: 2, absorbed: 3, kind: 'basic', refId: null },
      { t: 'damageDealt', sourceUid: shade.uid, targetUid: player.uid, amount: 5, damageType: 'physical', mitigated: 0, absorbed: 0, kind: 'intent', refId: 'shade_rake' },
      { t: 'damageDealt', sourceUid: player.uid, targetUid: shade.uid, amount: 2, damageType: 'physical', mitigated: 0, absorbed: 0, kind: 'status', refId: 'status_bleed' },
    ];
    const ex = explainHits(events, f.s, f.s, content);
    const mine = ex.get(`1|${player.name} hits ${shade.name} for 12`)!;
    expect(mine[0]).toBe('Basic attack: Ley damage.');
    expect(mine).toContain('A critical hit.');
    expect(mine.some((l) => l.startsWith('Mark + any attack'))).toBe(true);
    expect(mine).toContain(`${shade.name} is Marked: ×1.15.`);
    expect(mine).toContain('Ward and Guard took 2.');
    expect(mine).toContain('The Shield took 3.');
    expect(mine[mine.length - 1]).toBe(`12 damage to ${shade.name}.`);
    const theirs = ex.get(`1|${shade.name} hits ${player.name} for 5`)!;
    expect(theirs[0]).toBe('Rake: Physical damage.');
    expect(theirs[theirs.length - 1]).toBe('5 damage to you.');
    expect(ex.size).toBe(2); // ticks are not explained
    combat.log.push({ round: 1, text: `${player.name} hits ${shade.name} for 12 (critical).`, kind: 'damage' });
    const lines = combatLogLines(combat, 8, ex);
    expect(lines[lines.length - 1]?.explain).toBe(mine);
    expect(lines[0]?.explain).toBeNull();
    expect(combatLogLines(combat, 1)).toHaveLength(1);
    expect(combatLogLines(null, 8)).toEqual([]);
  });

  test('a phase change of this round or the last is a banner, read from the state', () => {
    const f = communion();
    const combat = combatOf(f);
    expect(bannerModel(combat, content)?.title ?? null).toBeNull();
    const boss = combat.enemies[0]!;
    boss.phase = 1;
    boss.pattern.phaseEnteredRound = combat.round;
    combat.log.push({ round: combat.round, text: 'The mass opens.', kind: 'phase' });
    const banner = bannerModel(combat, content)!;
    expect(banner.title).toBe('The Chronos Tyrant · Phase 2 of 3: The Nine Surface');
    expect(banner.lines[banner.lines.length - 1]).toBe('The mass opens.');
    combat.round += 3;
    expect(bannerModel(combat, content)).toBeNull();
    expect(bannerModel(null, content)).toBeNull();
  });

  test('the aftermath: what a victory paid, a flight, an arrest', () => {
    const won = aftermathModel(
      [
        { t: 'combatEnded', result: 'victory', rounds: 3, xp: 40, gold: 7, loot: [{ uid: 'i9', itemId: 'item_ley_touched_tonic', qty: 2, rarity: 'uncommon', affixes: [] }] },
        { t: 'levelUp', level: 2, statPoints: 1, apHalf: 2 },
      ],
      content,
    )!;
    expect(won.title).toBe('Victory');
    expect(won.lines[0]).toBe('Won in 3 rounds.');
    expect(won.lines).toContain('+40 XP');
    expect(won.lines).toContain('+7 gold');
    expect(won.lines.some((l) => l.endsWith('× 2 (uncommon)'))).toBe(true);
    expect(won.lines).toContain('Level 2! 1 stat point to spend.');
    expect(aftermathModel([{ t: 'combatEnded', result: 'fled', rounds: 1, xp: 0, gold: 0, loot: [] }], content)).toEqual({ result: 'fled', title: 'You got away', lines: ['After 1 round. No spoils.'] });
    expect(aftermathModel([{ t: 'combatEnded', result: 'defeat', rounds: 2, xp: 0, gold: 0, loot: [] }], content)?.title).toBe('Overcome');
    expect(aftermathModel([], content)).toBeNull();
  });
});
