// Onboarding (U70; DESIGN §16.8): the callout model's sequencing, once-only rule, "Tutorials: off" switch and Loop 2+
// suppression; the snapshot read off real states (the first fight, the Brute's rule); the tutorial store's persistence;
// CalloutView's buttons; the Settings form's switch.
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalActions, memoryStorage, step, type Action } from '@engine/index';
import { loadScenario } from '@sim/scenarios';
import { CalloutRegion, CalloutView } from '@ui/components/Callout';
import {
  CALLOUTS,
  NOTHING,
  allowedInLoop,
  pickCallout,
  stillApplies,
  type CombatSnapshot,
  type OnboardingSnapshot,
} from '@ui/onboarding/model';
import { changesPlansBelowHalf, onboardingSnapshot } from '@ui/onboarding/snapshot';
import { SettingsForm } from '@ui/panels/SettingsPanel';
import { TUTORIALS_OFF_KEY, TUTORIALS_SEEN_KEY } from '@ui/store/persistence';
import { freshProfile } from '@ui/store/profile';
import { createTutorialStore } from '@ui/store/tutorials';
import { pack } from './panelFixtures';
import { all, byName, call, expand } from './tree';

const fight = (over: Partial<CombatSnapshot> = {}): CombatSnapshot => ({ round: 1, intentShown: true, guardEnabled: true, status: null, conditional: null, ...over });
const snap = (over: Partial<OnboardingSnapshot>): OnboardingSnapshot => ({ ...NOTHING, ...over });
const none: ReadonlySet<string> = new Set();
const seen = (...ids: string[]): ReadonlySet<string> => new Set(ids);

describe('pickCallout: the first fight', () => {
  test('the intent callout comes first, on the fight’s first turn, with the intent text', () => {
    const c = pickCallout(snap({ mode: 'combat', combat: fight() }), none, false);
    expect(c?.id).toBe('intent');
    expect(c?.text).toBe('An intent shows what the enemy will do next: type, target, number.');
    expect(c?.target).toBe('intent');
  });

  test('no intent on screen, no intent callout', () => {
    expect(pickCallout(snap({ mode: 'combat', combat: fight({ intentShown: false }) }), none, false)).toBeNull();
  });

  test('after the first action the Guard callout follows, pointing at Guard; once read, nothing', () => {
    const second = snap({ mode: 'combat', combat: fight({ round: 2 }) });
    const c = pickCallout(second, seen('intent'), false);
    expect(c).toMatchObject({ id: 'guard', target: 'guard', text: 'Guard halves the number and builds your resource.' });
    expect(pickCallout(second, seen('intent', 'guard'), false)).toBeNull();
  });

  test('a Guard that cannot be pressed is not advertised', () => {
    expect(pickCallout(snap({ mode: 'combat', combat: fight({ round: 2, guardEnabled: false }) }), seen('intent'), false)).toBeNull();
  });

  test('the first status names itself; the first plan-changing creature names itself; the status goes first', () => {
    const both = snap({ mode: 'combat', combat: fight({ round: 3, status: { id: 'status_weaken', name: 'Weaken', description: 'Deals less damage.' }, conditional: 'Wildling Brute' }) });
    const done = seen('intent', 'guard');
    const status = pickCallout(both, done, false);
    expect(status).toMatchObject({ id: 'status', title: 'Weaken', text: 'Weaken: Deals less damage.' });
    const brute = pickCallout(both, seen('intent', 'guard', 'status'), false);
    expect(brute).toMatchObject({ id: 'branching', text: 'Wildling Brute: Some creatures change plans below half health.' });
  });

  test('every callout is once only: seen is never offered again', () => {
    const s = snap({ mode: 'combat', combat: fight() });
    expect(pickCallout(s, seen('intent'), false)).toBeNull();
  });
});

describe('pickCallout: the first camp, the clock chip', () => {
  const camp = snap({ mode: 'explore', atCamp: true, firstFightDone: true, day: 1 });

  test('the camp callout waits for the first fight and a camp', () => {
    expect(pickCallout(camp, none, false)?.id).toBe('camp');
    expect(pickCallout({ ...camp, firstFightDone: false }, none, false)).toBeNull();
    expect(pickCallout({ ...camp, atCamp: false }, none, false)).toBeNull();
  });

  test('the camp callout closes on a rest, not on a step away', () => {
    expect(CALLOUTS.camp.dismissOn).toBe('rest');
    expect(CALLOUTS.intent.dismissOn).toBe('action');
    expect(stillApplies(CALLOUTS.camp, { ...camp, atCamp: false }, none)).toBe(false);
    expect(stillApplies(CALLOUTS.camp, camp, none)).toBe(true);
  });

  test('the clock chip is pointed out once, on a later day, after the camp one', () => {
    const later = snap({ mode: 'explore', atCamp: false, firstFightDone: true, day: 2 });
    expect(pickCallout(later, seen('camp'), false)).toMatchObject({ id: 'clock', target: 'clock', text: 'Days pass. Nothing more — for now.' });
    expect(pickCallout(later, none, false)).toBeNull(); // never before the camp one
    expect(pickCallout(later, seen('camp', 'clock'), false)).toBeNull();
  });
});

describe('pickCallout: Tutorials off, Loop 2+', () => {
  test('"Tutorials: off" shows nothing, whatever is due', () => {
    expect(pickCallout(snap({ mode: 'combat', combat: fight() }), none, true)).toBeNull();
    expect(pickCallout(snap({ mode: 'explore', loop: 2 }), none, true)).toBeNull();
    expect(pickCallout(snap({ mode: 'dialogue', echoChoice: true, loop: 2 }), none, true)).toBeNull();
  });

  test('Loop 2 Day 1 shows the Breach Clock callout alone: the first-fight, camp and clock hints are gone', () => {
    const c = pickCallout(snap({ mode: 'explore', loop: 2, day: 1, atCamp: true, firstFightDone: true }), none, false);
    expect(c).toMatchObject({ id: 'breach_clock', target: 'clock' });
    expect(c?.text).toContain('Breach Clock');
    expect(c?.text).toContain('Loop Timeline');
    expect(pickCallout(snap({ mode: 'explore', loop: 2, day: 5, atCamp: true, firstFightDone: true }), seen('breach_clock'), false)).toBeNull();
    expect(pickCallout(snap({ mode: 'combat', loop: 2, combat: fight({ status: { id: 's', name: 'S', description: 'd' }, conditional: 'Brute' }) }), none, false)).toBeNull();
    expect(pickCallout(snap({ mode: 'combat', loop: 3, combat: fight({ round: 2 }) }), none, false)).toBeNull();
  });

  test('Loop 1 never shows the Breach Clock callout', () => {
    expect(pickCallout(snap({ mode: 'explore', loop: 1, day: 1 }), none, false)).toBeNull();
    expect(allowedInLoop('breach_clock', 1)).toBe(false);
  });

  test('the Echo glyph hint belongs to the first Echo-tagged answer (an answer like that exists only from Loop 2)', () => {
    expect(pickCallout(snap({ mode: 'dialogue', loop: 2, echoChoice: true }), none, false)?.id).toBe('echo_glyph');
    expect(pickCallout(snap({ mode: 'dialogue', loop: 2, echoChoice: false }), none, false)).toBeNull();
    expect(pickCallout(snap({ mode: 'dialogue', loop: 2, echoChoice: true }), seen('echo_glyph'), false)).toBeNull();
    for (const id of Object.keys(CALLOUTS) as (keyof typeof CALLOUTS)[]) {
      if (id !== 'breach_clock' && id !== 'echo_glyph') expect(allowedInLoop(id, 2)).toBe(false);
    }
  });

  test('the title and the Threshold teach nothing', () => {
    expect(pickCallout(NOTHING, none, false)).toBeNull();
    expect(pickCallout(snap({ mode: 'threshold', loop: 2 }), none, false)).toBeNull();
  });
});

describe('onboardingSnapshot from real states', () => {
  const first = loadScenario('first_fight', pack);

  test('the first fight, first turn: an intent shows, Guard is on, nothing else', () => {
    const s = onboardingSnapshot(first.state, pack, first.profile, []);
    expect(s).toMatchObject({ mode: 'combat', loop: 1, day: 1, atCamp: false, firstFightDone: false, echoChoice: false });
    expect(s.combat).toMatchObject({ round: 1, intentShown: true, status: null, conditional: null });
    // guardEnabled reads the legal list
    expect(onboardingSnapshot(first.state, pack, first.profile, [{ type: 'guard' }]).combat?.guardEnabled).toBe(true);
    expect(s.combat?.guardEnabled).toBe(false);
    expect(pickCallout(onboardingSnapshot(first.state, pack, first.profile, [{ type: 'guard' }]), none, false)?.id).toBe('intent');
  });

  test('after the player acts the round turns and the Guard callout is due', () => {
    const attack = legalActions(first.state, pack, first.profile).find((a) => a.type === 'attack');
    expect(attack).toBeDefined();
    const r = step(first.state, attack as Action, pack, first.profile);
    const s = onboardingSnapshot(r.state, pack, r.profile, legalActions(r.state, pack, r.profile));
    expect(s.combat?.round).toBe(2);
    expect(s.combat?.guardEnabled).toBe(true);
    expect(pickCallout(s, seen('intent'), false)?.id).toBe('guard');
  });

  test('a camp after a won fight: atCamp and firstFightDone', () => {
    const at = loadScenario('loop1_emberforge', pack);
    const s = onboardingSnapshot(at.state, pack, at.profile, [{ type: 'rest', kind: 'full' }]);
    expect(s.atCamp).toBe(true);
    expect(s.firstFightDone).toBe(true);
    expect(pickCallout(s, none, false)?.id).toBe('camp');
    expect(onboardingSnapshot(at.state, pack, at.profile, []).atCamp).toBe(false);
  });

  test('a Loop 2 Day 1 explore view calls for the Breach Clock hint alone', () => {
    const at = loadScenario('loop2_day1', pack);
    const s = onboardingSnapshot(at.state, pack, at.profile, [{ type: 'rest', kind: 'full' }]);
    expect(s).toMatchObject({ mode: 'explore', day: 1 });
    expect(s.loop).toBeGreaterThanOrEqual(2);
    expect(pickCallout(s, none, false)?.id).toBe('breach_clock');
    expect(pickCallout(s, seen('breach_clock'), false)).toBeNull();
  });

  test('"changes plans below half health": the Wildling Brute, not the Shade (its 70% Fade is not the lesson)', () => {
    expect(changesPlansBelowHalf(pack.creatures.cr_wildling_brute)).toBe(true);
    expect(changesPlansBelowHalf(pack.creatures.cr_corrupted_shade)).toBe(false);
    expect(changesPlansBelowHalf(undefined)).toBe(false);
  });
});

describe('the tutorial store', () => {
  test('what a profile has seen persists per profile id, and the switch persists once per browser', () => {
    const storage = memoryStorage();
    const a = createTutorialStore(storage);
    expect(a.off()).toBe(false);
    expect(a.seen('p1').size).toBe(0);
    a.markSeen('p1', 'intent');
    a.markSeen('p1', 'intent');
    a.setOff(true);
    expect(storage.getItem(`${TUTORIALS_SEEN_KEY}.p1`)).toBe('["intent"]');
    expect(storage.getItem(TUTORIALS_OFF_KEY)).toBe('1');
    const b = createTutorialStore(storage);
    expect([...b.seen('p1')]).toEqual(['intent']);
    expect(b.seen('p2').size).toBe(0);
    expect(b.off()).toBe(true);
    b.setOff(false);
    expect(storage.getItem(TUTORIALS_OFF_KEY)).toBeNull();
  });

  test('subscribers hear only real changes; the seen set is stable until one', () => {
    const store = createTutorialStore(null);
    const heard = mock(() => undefined);
    store.subscribe(heard);
    const before = store.seen('p');
    store.markSeen('p', 'guard');
    store.markSeen('p', 'guard');
    store.setOff(false); // already on
    expect(heard).toHaveBeenCalledTimes(1);
    expect(store.seen('p')).not.toBe(before);
    expect(store.seen('p')).toBe(store.seen('p'));
    store.reset('p');
    expect(store.seen('p').size).toBe(0);
    expect(heard).toHaveBeenCalledTimes(2);
    store.reset('p');
    expect(heard).toHaveBeenCalledTimes(2);
  });

  test('blocked storage still works for the session', () => {
    const broken = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: (): void => {
        throw new Error('full');
      },
      removeItem: (): void => {
        throw new Error('blocked');
      },
    };
    const store = createTutorialStore(broken);
    expect(store.off()).toBe(false);
    store.markSeen('p', 'intent');
    store.setOff(true);
    expect(store.seen('p').has('intent')).toBe(true);
    expect(store.off()).toBe(true);
  });
});

describe('CalloutView', () => {
  test('a note with the title and text, and two buttons, each ≥ the shared button class', () => {
    const onDismiss = mock(() => undefined);
    const onTurnOff = mock(() => undefined);
    const tree = expand(CalloutView({ callout: CALLOUTS.guard, onDismiss, onTurnOff }));
    const note = all(tree, 'section')[0];
    expect(note?.props.role).toBe('note');
    expect(note?.props['aria-label']).toBe('Hint: Guard');
    expect(note?.text).toContain('Guard halves the number and builds your resource.');
    call(byName(tree, 'button', 'Got it'), 'onClick');
    call(byName(tree, 'button', 'Turn tutorials off'), 'onClick');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onTurnOff).toHaveBeenCalledTimes(1);
  });

  test('the region is an always-present polite live region (empty is fine)', () => {
    const html = renderToStaticMarkup(<CalloutRegion />);
    expect(html).toContain('aria-live="polite"');
    const withHint = renderToStaticMarkup(
      <CalloutRegion>
        <CalloutView callout={CALLOUTS.clock} onDismiss={() => undefined} onTurnOff={() => undefined} />
      </CalloutRegion>,
    );
    expect(withHint).toContain('Days pass. Nothing more — for now.');
    expect(withHint).toContain('data-callout-id="clock"');
  });
});

describe('the Settings form’s tutorials switch', () => {
  const settings = freshProfile('s').settings;

  test('shown only when given; the checkbox reflects it and toggles; "Show the hints again" resets', () => {
    expect(all(expand(SettingsForm({ settings, onChange: () => undefined })), 'input').some((i) => i.props.name === 'tutorials')).toBe(false);
    const onToggle = mock(() => undefined);
    const onReset = mock(() => undefined);
    const tree = expand(SettingsForm({ settings, onChange: () => undefined, tutorials: { on: true, onToggle, onReset } }));
    const box = all(tree, 'input').find((i) => i.props.name === 'tutorials');
    expect(box?.props.checked).toBe(true);
    call(box as NonNullable<typeof box>, 'onChange');
    call(byName(tree, 'button', 'Show the hints again'), 'onClick');
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    const off = expand(SettingsForm({ settings, onChange: () => undefined, tutorials: { on: false, onToggle, onReset } }));
    expect(all(off, 'input').find((i) => i.props.name === 'tutorials')?.props.checked).toBe(false);
  });
});
