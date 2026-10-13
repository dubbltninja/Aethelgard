// Hand-made GameState / Profile values for the engine type tests (U11) and the util tests (U12).
// Not a fixture pack (U18 owns tests/fixtures/): these exist only to prove the shapes type-check and serialize.
import type { Combatant, GameState, ItemInstance, Profile } from '@engine/types';

const item = (uid: string, itemId: string, extra: Partial<ItemInstance> = {}): ItemInstance => ({
  uid,
  itemId,
  qty: 1,
  rarity: 'common',
  affixes: [],
  ...extra,
});

/** The smallest valid state: Loop 1, Day 1 Dawn, exploring, nothing optional populated. */
export function minimalState(): GameState {
  return {
    meta: {
      seed: 'aethelgard',
      loop: 1,
      version: 1,
      stepCount: 0,
      nextUid: 1,
      runId: 'aethelgard:1',
      modifiers: [],
      playerName: 'Wayfinder',
    },
    clock: { ticks: 0, limitTicks: 116, modifiers: [], frozen: false, expired: false },
    before: null,
    player: {
      name: 'Wayfinder',
      classId: 'ranger',
      level: 1,
      xp: 0,
      stats: { strength: 5, magic: 3, agility: 6 },
      hp: 40,
      hpMax: 40,
      mp: 10,
      mpMax: 10,
      gold: 0,
      corruption: 0,
      inventory: [],
      equipment: { weapon: null, armor: null, trinket1: null, trinket2: null },
      abilitiesUnlocked: [],
      apHalf: 0,
      statPoints: 0,
      statuses: [],
      uses: {},
      stance: 'guarded',
      passiveBonuses: {},
    },
    companions: { recruited: {}, activeId: null },
    world: {
      currentLocationId: 'loc_whispering_ruins',
      previousLocationId: null,
      locationStates: {},
      discovered: ['loc_whispering_ruins'],
      pendingEncounters: {},
      npcOverrides: {},
      hordeActive: false,
      hordeDelay: 0,
      infected: [],
      hordePending: {},
      hordeCause: null,
      heartstone: 'intact',
      tyrant: 'waiting',
      gather: {},
    },
    quests: {},
    flags: {},
    reputation: { remnants: 0, weavers: 0, ironclad: 0 },
    echoesThisLoop: [],
    combat: null,
    dialogue: null,
    merchants: {},
    rng: [1, 2, 3, 4],
    counters: {
      kills: {},
      seen: {},
      damageDealt: 0,
      damageTaken: 0,
      damageBySource: {},
      abilitiesUsed: {},
      itemsCrafted: 0,
      itemsUpgraded: 0,
      goldEarned: 0,
      goldSpent: 0,
      fights: 0,
      fightsWon: 0,
      fled: 0,
      rests: 0,
      travels: 0,
      questsCompleted: 0,
      questsFailed: 0,
      echoesGainedThisLoop: 0,
      deathsThisLoop: 0,
      custom: {},
    },
    pendingEnding: null,
    mode: 'explore',
    recentLog: [],
    threshold: null,
  };
}

const combatant = (uid: string, kind: Combatant['kind'], refId: string, extra: Partial<Combatant> = {}): Combatant => ({
  uid,
  kind,
  refId,
  name: refId,
  level: 11,
  hp: 100,
  hpMax: 100,
  mp: 0,
  mpMax: 0,
  atk: 12,
  sp: 4,
  armor: 3,
  ward: 1,
  agi: 6,
  accuracy: 0.9,
  evasion: 0.05,
  crit: 0.05,
  critMult: 1.5,
  statuses: [],
  guarding: false,
  initiative: 8,
  resistances: {},
  phase: 0,
  pattern: { pointer: 0, turnsTaken: 0, firedOnce: [], phaseEnteredRound: 1 },
  cooldowns: {},
  alive: true,
  fledOrGone: false,
  isAdd: false,
  ...extra,
});

/** Every nullable/optional branch populated: a communion fight in Loop 3 with dialogue, Before, Threshold, ending. */
export function fullState(): GameState {
  const s = minimalState();
  const sword = item('i7', 'item_warriors_sword', { rarity: 'rare', affixes: ['affix_of_embers'] });
  s.meta = { ...s.meta, loop: 3, stepCount: 412, nextUid: 40, runId: 'aethelgard:3', modifiers: ['mod_frayed_clock'] };
  s.clock = { ticks: 42, limitTicks: 140, modifiers: [{ source: 'heartstone_stabilize', watches: 24 }], frozen: true, expired: false };
  s.before = { day: 2, resets: 1 };
  s.player = {
    ...s.player,
    level: 11,
    xp: 1820,
    gold: 212,
    corruption: 1,
    inventory: [item('i3', 'item_ley_touched_tonic', { qty: 3 }), item('i9', 'item_sealed_letter', { boundQuest: 'q_clear_path' })],
    equipment: { weapon: sword, armor: null, trinket1: item('i8', 'item_amulet_of_echoes', { rarity: 'legendary' }), trinket2: null },
    abilitiesUnlocked: ['rgr_marked_shot', 'rgr_rend'],
    apHalf: 3,
    statPoints: 2,
    statuses: [
      { statusId: 'status_poison', stacks: 1, duration: 2, sourceUid: null, tick: 3, appliedOnOwnTurn: false },
      { statusId: 'status_rested', stacks: 1, duration: 4, sourceUid: null, appliedOnOwnTurn: false },
    ],
    uses: { att_second_wind: { loop: 3 }, respec: { day: 9 }, inn_rest: { day: 11, count: 1 } },
    stance: 'aggressive',
    passiveBonuses: { magic: 1, hpMax: 5 },
  };
  s.companions = {
    recruited: {
      brak: {
        id: 'brak',
        recruited: true,
        loyalty: 31,
        hp: 190,
        hpMax: 190,
        ko: false,
        dead: false,
        stance: 'guarded',
        cooldowns: { comp_brak_shield_wall: 2 },
        waitingAt: null,
        arcFlags: { flag_brak_oath: true, flag_brak_trust: 2, flag_brak_note: 'camp' },
      },
    },
    activeId: 'brak',
  };
  s.world = {
    ...s.world,
    currentLocationId: 'loc_temporal_apex',
    previousLocationId: 'loc_shattered_library',
    locationStates: {
      loc_shattered_library: {
        visited: true,
        visitCount: 2,
        items: [item('i12', 'mat_ember_ore', { qty: 2 })],
        itemsSpawned: true,
        encountersCleared: ['enc_library_wraiths'],
        encounterClearedDay: { enc_library_wraiths: 9 },
        eventsFired: ['ev_fell_names'],
        flags: { flag_library_lit: true },
        unlockedExits: ['loc_temporal_apex'],
        lockedExits: [],
        scattered: ['enc_stacks'],
        encounterHp: { enc_archivist: { cr_drowned_archivist: 40 } },
      },
    },
    discovered: ['loc_whispering_ruins', 'loc_shattered_library', 'loc_temporal_apex'],
    pendingEncounters: {
      loc_mistwood_path: [{ id: 'enc_spawned_1', groups: [{ creatureId: 'cr_wildling_brute', count: 2 }], once: true, onFlee: 'hold', label: 'Ambush' }],
    },
    npcOverrides: { npc_ilyra: { location: 'loc_shattered_library' }, npc_brak: { location: null } },
    hordeActive: true,
    hordeDelay: 3,
    infected: ['loc_temporal_apex'],
    hordePending: { loc_mistwood_path: 2 },
    hordeCause: 'expiry',
    heartstone: 'stabilized',
    tyrant: 'communing',
    gather: { loc_mistwood_path: { day: 11, taken: 1 } },
    weather: 'ash',
  };
  s.quests = {
    q_clear_path: { status: 'completed', stage: 'done', startedDay: 1, endedDay: 3, counters: {}, objectivesDone: ['kill_brutes'] },
    q_blighted_outpost: { status: 'active', stage: 'cleared', startedDay: 4, endedDay: null, counters: { golems: 2 }, objectivesDone: [] },
  };
  s.flags = { flag_heartstone_stabilized: true, flag_vane_count: 3, flag_last_word: 'thirty' };
  s.reputation = { remnants: 25, weavers: -5, ironclad: 30 };
  s.echoesThisLoop = ['echo_tyrant_speaks'];
  const tyrant = combatant('c30', 'enemy', 'cr_contained_tyrant', {
    hp: 300,
    hpMax: 460,
    phase: 1,
    resistances: { chrono: 'immune', void: 'resist', ley: 'weak' },
    statuses: [{ statusId: 'status_rewind', stacks: 1, duration: 3, sourceUid: 'c30', appliedOnOwnTurn: true, snapshotHp: 320 }],
    pattern: { pointer: 2, turnsTaken: 5, firedOnce: ['tyr_remember'], phaseEnteredRound: 4 },
    cooldowns: { tyr_hour_presses: 1 },
  });
  s.combat = {
    encounterId: 'enc_contained_tyrant',
    locationId: 'loc_temporal_apex',
    enemies: [tyrant, combatant('c31', 'enemy', 'cr_temporal_aberration', { isAdd: true, alive: false, fledOrGone: true })],
    party: [combatant('c28', 'player', 'ranger', { mp: 20, mpMax: 30, guarding: true }), combatant('c29', 'companion', 'brak')],
    turnOrder: ['c28', 'c29', 'c30', 'c31'],
    turnIndex: 1,
    round: 6,
    phase: 'playerTurn',
    intents: {
      c30: { moveId: 'tyr_hour_presses', targetUid: null, projected: [8, 12], hidden: false, text: 'The hour presses.', tags: ['all'] },
    },
    log: [{ round: 6, text: 'Resolve rises.', kind: 'phase' }],
    cooldowns: { rgr_rend: 1 },
    canFlee: false,
    onFlee: 'hold',
    fleeAttempts: 0,
    communion: {
      movement: 2,
      resolve: 4,
      questionIndex: 1,
      answered: ['tyr_q_name'],
      usedAnswers: ['echo_tyrant_speaks'],
      lies: 1,
      listened: true,
      supportUsed: false,
      clockBonusGranted: true,
    },
    resourceGainedThisTurn: 5,
    onVictory: [{ flag: 'flag_tyrant_dead' }],
    onDefeat: [],
    onFleeEffects: [{ passWatches: 2 }],
    pendingSelection: { abilityId: 'rgr_marked_shot' },
  };
  s.dialogue = {
    sceneId: 'scene_tyrant_communion',
    nodeId: 'n2',
    npcId: null,
    visitedNodes: ['n1'],
    choicesTaken: ['c_listen'],
    returnMode: 'combat',
  };
  s.merchants = { npc_kaelen_stonehand: { stock: [item('i20', 'item_ley_touched_tonic', { qty: 5 })], lastRestockDay: 11, purchasesThisLoop: 2 } };
  s.rng = [0xdeadbeef, 0, 0xffffffff, 7];
  s.counters = { ...s.counters, kills: { cr_wildling_brute: 2 }, damageBySource: { basic: 120, 'companion:brak': 40 }, custom: { bells: 3 } };
  s.pendingEnding = { outcome: 'closer_fall', reason: 'released', slideIndex: 0 };
  s.mode = 'combat';
  s.recentLog = [{ step: 411, text: 'The Apex hums.', kind: 'narration' }];
  s.threshold = { visited: ['still_shore', 'loom'], spentThisVisit: 15, pendingClassId: 'wizard' };
  return s;
}

export function minimalProfile(): Profile {
  return {
    version: 1,
    profileId: 'p1',
    echoes: [],
    codexUnlocked: [],
    bestiary: {},
    achievements: {},
    resonance: 0,
    resonanceEarnedTotal: 0,
    attunements: { owned: [], equipped: [] },
    classMastery: {},
    runHistory: [],
    settings: {
      textScale: 1,
      highContrast: false,
      reducedMotion: 'system',
      volumes: { master: 0.8, ambient: 0.6, sfx: 0.8, music: 0.5 },
      muted: false,
      autosave: true,
      showIntentNumbers: true,
      confirmFlee: true,
      logLength: 100,
    },
    modifiers: {},
    mapKnowledge: [],
    discoveries: [],
    endingsReached: [],
    loopCounter: 1,
    newGamePlus: 0,
    lastClassId: null,
  };
}

/** A profile after two loops: every record type populated. */
export function fullProfile(): Profile {
  return {
    ...minimalProfile(),
    echoes: ['echo_amulet_memory', 'echo_ilyra_watchword'],
    codexUnlocked: ['codex_breach'],
    bestiary: { cr_wildling_brute: { seen: 3, killed: 2, spared: 0, revealed: 'all', intentsSeen: ['brute_smash'] } },
    achievements: { ach_loop_two: { loop: 2, day: 1, runId: 'aethelgard:2' } },
    resonance: 95,
    resonanceEarnedTotal: 145,
    attunements: { owned: ['att_full_purse', 'att_old_road'], equipped: ['att_full_purse'] },
    classMastery: { ranger: { loopsPlayed: 2, mastered: ['rgr_rend'], endings: [], bestLevel: 13, bestDays: null } },
    runHistory: [
      {
        runId: 'aethelgard:1',
        seed: 'aethelgard',
        loop: 1,
        classId: 'ranger',
        outcome: 'closer_escape',
        daysUsed: 24,
        level: 13,
        echoesGained: ['echo_amulet_memory'],
        questsCompleted: ['q_clear_path'],
        tyrant: 'defeated',
        heartstone: 'stabilized',
        modifiers: [],
        summary: 'Escaped through the Library portal.',
      },
      {
        runId: 'aethelgard:2',
        seed: 'aethelgard',
        loop: 2,
        classId: 'ranger',
        outcome: 'closer_fall',
        reason: 'released',
        daysUsed: 12,
        level: 9,
        echoesGained: [],
        questsCompleted: [],
        tyrant: 'untouched',
        heartstone: 'intact',
        modifiers: ['mod_frayed_clock'],
        summary: 'Let go at the camp fire.',
      },
    ],
    modifiers: { mod_frayed_clock: true },
    mapKnowledge: ['loc_whispering_ruins'],
    discoveries: ['loc:loc_whispering_ruins', 'kill:cr_wildling_brute'],
    endingsReached: [],
    loopCounter: 3,
    newGamePlus: 0,
    lastClassId: 'ranger',
  };
}
