// Toasts (U70; DESIGN §16.7): the queue's merge and timing (every function takes `now`, so no clock), which events become
// toasts and what they say, the view's two sources and reduced motion, and the live region's combat phrasing.
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalActions, step, type Action, type GameEvent } from '@engine/index';
import { loadScenario } from '@sim/scenarios';
import { announceStep } from '@ui/a11y/announce';
import { Toasts, noticeLifetime } from '@ui/components/Toasts';
import { toastsFor, warningLine } from '@ui/components/toastModel';
import {
  EMPTY_QUEUE,
  MAX_TOASTS,
  PHONE_LIFETIME_SCALE,
  dismiss,
  enqueue,
  expire,
  lifetime,
  nextExpiry,
  toastText,
  type ToastQueue,
  type ToastSpec,
} from '@ui/components/toastQueue';
import { pack } from './panelFixtures';
import { all, byName, call, expand } from './tree';

const spec = (over: Partial<ToastSpec> = {}): ToastSpec => ({ key: 'k', label: 'Something', tone: 'info', ...over });
const texts = (q: ToastQueue): string[] => q.items.map(toastText);

describe('the toast queue', () => {
  test('a toast stays for its tone’s time: five seconds, a warning ten, an error twelve', () => {
    expect([lifetime('info'), lifetime('success'), lifetime('gain'), lifetime('warn'), lifetime('error')]).toEqual([5000, 5000, 5000, 10_000, 12_000]);
    const q = enqueue(EMPTY_QUEUE, spec(), 1000);
    expect(q.items[0]).toMatchObject({ id: 1, count: 1, expiresAt: 6000 });
    expect(nextExpiry(q)).toBe(6000);
    expect(nextExpiry(EMPTY_QUEUE)).toBeNull();
  });

  test('expire drops what has run out and keeps the same queue when nothing has', () => {
    let q = enqueue(EMPTY_QUEUE, spec({ key: 'a', label: 'A' }), 0);
    q = enqueue(q, spec({ key: 'b', label: 'B', tone: 'error' }), 1000);
    expect(expire(q, 4999)).toBe(q);
    expect(texts(expire(q, 5000))).toEqual(['B']);
    expect(expire(q, 13_000).items).toEqual([]);
  });

  test('a repeat merges into the live toast: a plain line counts ×n and its time starts over', () => {
    let q = enqueue(EMPTY_QUEUE, spec({ key: 'item:ore', label: 'Picked up Ember Ore' }), 0);
    q = enqueue(q, spec({ key: 'item:ore', label: 'Picked up Ember Ore' }), 3000);
    q = enqueue(q, spec({ key: 'item:ore', label: 'Picked up Ember Ore' }), 6000);
    expect(q.items).toHaveLength(1);
    expect(texts(q)).toEqual(['Picked up Ember Ore ×3']);
    expect(q.items[0]?.expiresAt).toBe(11_000);
  });

  test('counted amounts add up: Resonance +10 and +25 is one toast, +35 ◇', () => {
    let q = enqueue(EMPTY_QUEUE, spec({ key: 'resonance', label: 'Resonance', tone: 'gain', amount: 10, unit: ' ◇' }), 0);
    expect(texts(q)).toEqual(['Resonance +10 ◇']);
    q = enqueue(q, spec({ key: 'resonance', label: 'Resonance', tone: 'gain', amount: 25, unit: ' ◇' }), 100);
    expect(texts(q)).toEqual(['Resonance +35 ◇']);
    expect(q.items[0]?.count).toBe(2);
  });

  test('a negative amount reads with a minus sign; items count with ×, shown above one', () => {
    expect(toastText({ label: 'Remnants reputation', amount: -5, count: 1 })).toBe('Remnants reputation −5');
    expect(toastText({ label: 'Picked up Ore', amount: 1, count: 1, format: 'times' })).toBe('Picked up Ore');
    expect(toastText({ label: 'Picked up Ore', amount: 3, count: 2, format: 'times' })).toBe('Picked up Ore ×3');
  });

  test('a toast that has run out does not take a repeat: the repeat is a new toast', () => {
    const q0 = enqueue(EMPTY_QUEUE, spec(), 0);
    const q = enqueue(q0, spec(), 5000);
    expect(q.items).toHaveLength(2);
    expect(q.items.map((t) => t.id)).toEqual([1, 2]);
  });

  test('different keys stay apart, and only the newest few stay: the oldest drops first', () => {
    let q = EMPTY_QUEUE;
    for (let i = 0; i < MAX_TOASTS + 2; i += 1) q = enqueue(q, spec({ key: `k${i}`, label: `T${i}` }), i);
    expect(q.items).toHaveLength(MAX_TOASTS);
    expect(texts(q)).toEqual(['T2', 'T3', 'T4', 'T5']);
  });

  test('dismiss removes one toast and leaves the queue alone for an unknown id', () => {
    let q = enqueue(EMPTY_QUEUE, spec({ key: 'a', label: 'A' }), 0);
    q = enqueue(q, spec({ key: 'b', label: 'B' }), 0);
    expect(texts(dismiss(q, 1))).toEqual(['B']);
    expect(dismiss(q, 99)).toBe(q);
  });
});

describe('which events become toasts', () => {
  const ev = (e: GameEvent): GameEvent => e;

  test('reputation: the change, and the tier when it moved', () => {
    const out = toastsFor([ev({ t: 'reputationChanged', faction: 'remnants', delta: 10, value: 22, tierBefore: 'neutral', tierAfter: 'trusted' })], pack, 1);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ key: 'rep:remnants', amount: 10 });
    expect(out[0]?.label).toBe(`${pack.factions.remnants?.name} reputation`);
    expect(out[1]?.label).toBe(`${pack.factions.remnants?.name}: now Trusted`);
    const same = toastsFor([ev({ t: 'reputationChanged', faction: 'remnants', delta: -3, value: 5, tierBefore: 'neutral', tierAfter: 'neutral' })], pack, 1);
    expect(same).toHaveLength(1);
    expect(toastText({ ...(same[0] as ToastSpec), count: 1 })).toContain('−3');
  });

  test('Resonance, an Echo, a level, a quest, an item, an achievement', () => {
    const echoId = Object.keys(pack.echoes)[0] as string;
    const questId = Object.keys(pack.quests)[0] as string;
    const itemId = Object.keys(pack.items)[0] as string;
    const achievementId = Object.keys(pack.achievements)[0] as string;
    const events: GameEvent[] = [
      { t: 'resonanceGained', amount: 2, reason: 'first visit', total: 2 },
      { t: 'echoGained', echoId, firstEver: true },
      { t: 'levelUp', level: 3, statPoints: 1, apHalf: 2 },
      { t: 'questStarted', questId },
      { t: 'questAdvanced', questId, stage: 's', journal: 'j' },
      { t: 'questCompleted', questId },
      { t: 'itemTaken', item: { uid: 'i1', itemId, qty: 2, rarity: 'common', affixes: [] } },
      { t: 'itemGiven', item: { uid: 'i2', itemId, qty: 1, rarity: 'common', affixes: [] }, source: 'quest' },
      { t: 'achievementUnlocked', achievementId },
    ];
    const out = toastsFor(events, pack, 1);
    const said = out.map((s) => toastText({ ...s, count: 1 }));
    expect(said[0]).toBe('Resonance +2 ◇');
    expect(said[1]).toBe(`Echo gained: ${pack.echoes[echoId]?.name}`);
    expect(said[2]).toBe('Level 3: 1 stat point to spend');
    expect(said[3]).toBe(`New quest: ${pack.quests[questId]?.name}`);
    expect(said[4]).toBe(`Quest updated: ${pack.quests[questId]?.name}`);
    expect(said[5]).toBe(`Quest complete: ${pack.quests[questId]?.name}`);
    expect(said[6]).toBe(`Picked up ${pack.items[itemId]?.name} ×2`);
    expect(said[7]).toBe(`Received ${pack.items[itemId]?.name}`);
    expect(said[8]).toBe(`Achievement: ${pack.achievements[achievementId]?.name}`);
  });

  test('an unknown id is still readable, never undefined', () => {
    const out = toastsFor([ev({ t: 'echoGained', echoId: 'echo_lost_thing', firstEver: false })], pack, 1);
    expect(out[0]?.label).toBe('Echo gained: Lost thing');
  });

  test('the Breach Clock’s warnings are toasts from Loop 2 only (Loop 1’s are spoken by people)', () => {
    const w: GameEvent[] = [{ t: 'clockWarning', daysLeft: 5 }];
    expect(toastsFor(w, pack, 1)).toEqual([]);
    expect(toastsFor(w, pack, 2)).toEqual([{ key: 'clock:5', label: 'Five dawns.', tone: 'warn' }]);
    expect([10, 5, 2, 1].map(warningLine)).toEqual(['Ten dawns remain.', 'Five dawns.', 'Two dawns.', 'One dawn.']);
  });

  test('events that earn nothing earn nothing', () => {
    const quiet: GameEvent[] = [{ t: 'goldChanged', delta: 5, total: 9 }, { t: 'xpGained', amount: 3 }, { t: 'resonanceGained', amount: 0, reason: 'x', total: 0 }];
    expect(toastsFor(quiet, pack, 1)).toEqual([]);
  });
});

describe('Toasts view', () => {
  const notice = { id: 7, text: 'Saved to the autosave slot.', tone: 'success' as const };

  test('a notice and an event toast each get a Dismiss that names the toast', () => {
    const onDismiss = mock(() => undefined);
    const onDismissItem = mock(() => undefined);
    const item = { ...spec({ key: 'resonance', label: 'Resonance', tone: 'gain', amount: 25, unit: ' ◇' }), id: 3, count: 1, expiresAt: 9 };
    const tree = expand(Toasts({ notices: [notice], onDismiss, items: [item], onDismissItem }));
    call(byName(tree, 'button', 'Dismiss: Saved to the autosave slot.'), 'onClick');
    call(byName(tree, 'button', 'Dismiss: Resonance +25 ◇'), 'onClick');
    expect(onDismiss).toHaveBeenCalledWith(7);
    expect(onDismissItem).toHaveBeenCalledWith(3);
    expect(all(tree, 'div').filter((d) => String(d.props.className).startsWith('toast ')).map((d) => d.props['data-tone'])).toEqual(['success', 'gain']);
  });

  test('a polite live region that reads additions and changed text (a merged toast is read again)', () => {
    const html = renderToStaticMarkup(<Toasts notices={[]} onDismiss={() => undefined} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-relevant="additions text"');
  });

  test('reduced motion marks the region so the entry animation is off', () => {
    expect(renderToStaticMarkup(<Toasts notices={[]} onDismiss={() => undefined} reducedMotion />)).toContain('data-motion="reduced"');
    expect(renderToStaticMarkup(<Toasts notices={[]} onDismiss={() => undefined} />)).not.toContain('data-motion');
  });

  test('a store notice lives 5 s, an error 12 s; a phone shortens both', () => {
    expect(noticeLifetime(notice)).toBe(5000);
    expect(noticeLifetime({ ...notice, tone: 'error' })).toBe(12_000);
    expect(noticeLifetime(notice, PHONE_LIFETIME_SCALE)).toBe(3500);
  });

  test('U84a: one compact stack — the newest shows, the older fold into a count that unfolds them', () => {
    const onToggle = mock(() => undefined);
    const notices = [notice, { ...notice, id: 8, text: 'Sound muted.' }, { ...notice, id: 9, text: 'Sound on.' }];
    const html = renderToStaticMarkup(<Toasts notices={notices} onDismiss={() => undefined} onToggleExpanded={onToggle} />);
    expect(html.match(/toast--folded/g)).toHaveLength(2);
    const tree = expand(Toasts({ notices, onDismiss: () => undefined, onToggleExpanded: onToggle }));
    call(byName(tree, 'button', '2 more notices'), 'onClick');
    expect(onToggle).toHaveBeenCalled();
    expect(renderToStaticMarkup(<Toasts notices={notices} onDismiss={() => undefined} expanded />)).not.toContain('toast--folded');
    expect(renderToStaticMarkup(<Toasts notices={[notice]} onDismiss={() => undefined} />)).not.toContain('toast-count');
    // an error never folds away: it must be read
    const withError = [{ ...notice, id: 5, text: 'Storage is full.', tone: 'error' as const }, notice];
    expect(renderToStaticMarkup(<Toasts notices={withError} onDismiss={() => undefined} />)).not.toContain('toast--folded');
    // placed by the Shell over the scene's corner
    expect(renderToStaticMarkup(<Toasts notices={[notice]} onDismiss={() => undefined} placement={{ top: '10px' }} />)).toContain('data-anchored="true"');
  });

  test('U84a: a phone shortens an event toast too', () => {
    const s = spec({ key: 'k', label: 'L', tone: 'info' });
    expect(enqueue(EMPTY_QUEUE, s, 0, PHONE_LIFETIME_SCALE).items[0]?.expiresAt).toBe(3500);
    expect(enqueue(EMPTY_QUEUE, s, 0).items[0]?.expiresAt).toBe(5000);
  });
});

describe('the live region in a fight', () => {
  const at = loadScenario('first_fight', pack);

  test('the first turn: the fight and the enemy’s intent', () => {
    const say = announceStep([{ t: 'intentRevealed', uid: Object.keys(at.state.combat!.intents)[0] as string, intent: Object.values(at.state.combat!.intents)[0]! }], at.state, pack);
    // U81a (D-121, DESIGN §16.8): Loop 1's first Shade opens with Wail, then Rake
    expect(say).toMatch(/^The Corrupted Shade readies Wail, \d+( to \d+)? damage, at you\./);
    const hidden = announceStep([{ t: 'intentRevealed', uid: Object.keys(at.state.combat!.intents)[0] as string, intent: { ...Object.values(at.state.combat!.intents)[0]!, hidden: true } }], at.state, pack);
    expect(hidden).toBe('The Corrupted Shade readies something unseen.');
  });

  test('a real round: what you did, what it did, what it readies, then "Your turn."', () => {
    const attack = legalActions(at.state, pack, at.profile).find((a) => a.type === 'attack') as Action;
    const r = step(at.state, attack, pack, at.profile);
    const said = announceStep(r.events, r.state, pack) ?? '';
    expect(said).toMatch(/^(You hit the Corrupted Shade for \d+|You miss the Corrupted Shade)/);
    expect(said).toContain('The Corrupted Shade uses Wail on you, for');
    expect(said).toMatch(/The Corrupted Shade readies Rake, \d+( to \d+)? damage, at you\./);
    expect(said.endsWith('Your turn.')).toBe(true);
    const quiet = announceStep(r.events, r.state, pack, { intentNumbers: false }) ?? '';
    expect(quiet).toContain('The Corrupted Shade readies Rake, at you.');
  });

  test('Guard is spoken; a critical hit says so; a defeat and the victory name their results', () => {
    const attack = legalActions(at.state, pack, at.profile).find((a) => a.type === 'attack') as Action;
    const r = step(at.state, attack, pack, at.profile);
    const guard = legalActions(r.state, pack, r.profile).find((a) => a.type === 'guard') as Action;
    const g = step(r.state, guard, pack, r.profile);
    expect(announceStep(g.events, g.state, pack)).toContain('You guard.');
    const synthetic = announceStep(
      [
        { t: 'attackResolved', sourceUid: 'x', targetUid: 'y', hit: true, crit: true },
        { t: 'combatantDefeated', uid: 'y', refId: 'cr_corrupted_shade' },
        { t: 'combatEnded', result: 'victory', rounds: 3, xp: 41, gold: 9, loot: [] },
      ],
      { ...g.state, combat: null },
      pack,
    );
    expect(synthetic).toBe('The Corrupted Shade falls. Victory. 41 experience, 9 gold.');
  });

  test('a long step is capped, keeping the last sentence', () => {
    const events: GameEvent[] = Array.from({ length: 10 }, (_, i): GameEvent => ({ t: 'healed', targetUid: 'z', amount: i + 1, source: 's' }));
    const said = announceStep(events, { ...at.state, combat: null }, pack) ?? '';
    expect(said.split('. ').length).toBe(6);
    expect(said.endsWith('recovers 10.')).toBe(true);
  });
});
