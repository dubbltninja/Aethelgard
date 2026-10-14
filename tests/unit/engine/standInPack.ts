// A minimal in-test ContentPack stand-in for the engine skeleton tests (U13/U14). Not the fixture pack: U18 owns
// tests/fixtures/miniContent.ts and replaces this once it exists. Class numbers are DESIGN §3.3's.
import type { Action, ActionType, ContentPack } from '@engine/index';

export function standInPack(): ContentPack {
  // Partial records, cast: the real pack comes from buildContentPack (U18's fixture); these tests read only the fields below.
  return {
    version: '0.0.0-standin',
    config: {
      startLocationId: 'loc_whispering_ruins',
      startItems: [{ itemId: 'item_amulet_of_echoes', fromLoop: 2 }],
      clock: { baseLimitTicks: 116, floorDawns: 3 },
      repTiers: { hostile: -100, wary: -39, neutral: -9, trusted: 20, sworn: 60 },
      corruptionMax: 6,
    },
    classes: {
      ranger: {
        name: 'Ranger',
        baseStats: { hp: 100, mp: 36, strength: 10, magic: 6, agility: 8 },
        growth: { hp: 8, mp: 3 },
        starterItems: [
          { itemId: 'item_hunting_bow', equip: true },
          { itemId: 'item_leather_armor', equip: true },
          { itemId: 'item_ley_touched_tonic', count: 2 },
        ],
        startingAbilities: [],
        startingGold: 30,
      },
      wizard: {
        name: 'Wizard',
        baseStats: { hp: 84, mp: 50, strength: 6, magic: 11, agility: 7 },
        growth: { hp: 6, mp: 5 },
        starterItems: [{ itemId: 'item_apprentice_staff', equip: true }],
        startingAbilities: ['wiz_echo_bolt'],
      },
    },
    items: {
      item_hunting_bow: { name: 'Hunting Bow', type: 'weapon', slot: 'weapon' },
      item_apprentice_staff: { name: 'Apprentice Staff', type: 'weapon', slot: 'weapon' },
      item_leather_armor: { name: 'Leather Armor', type: 'armor', slot: 'armor' },
      item_ley_touched_tonic: { name: 'Ley-Touched Tonic', type: 'consumable' },
      item_silver_ring: { name: 'Silver Ring', type: 'trinket', slot: 'trinket', fixedRarity: 'uncommon', fixedAffixes: ['affix_of_embers'] },
      item_amulet_of_echoes: { name: 'Amulet of Echoes', type: 'quest', rarityRule: 'fixed', fixedRarity: 'legendary' },
      item_chronos_lens: { name: 'Chronos Lens', type: 'key' },
      item_heartstone_fragment_dead: { name: 'Dead Heartstone Fragment', type: 'material' },
      mat_ember_ore: { name: 'Ember Ore', type: 'material' },
    },
    locations: {
      loc_whispering_ruins: { name: 'Whispering Ruins', regionId: 'region_silverwood_ruins' },
      loc_shattered_library: {
        name: 'Shattered Library',
        regionId: 'region_silverwood_ruins',
        encounters: [
          { id: 'enc_library_wraiths', once: true, fleeable: true },
          { id: 'enc_library_boss', once: true, fleeable: false },
          { id: 'enc_library_wanderers', once: false, fleeable: true },
        ],
      },
      loc_heartstone_depths: { name: 'Heartstone Depths', regionId: 'region_glowlands' },
    },
    quests: {
      q_clear_path: {
        name: 'Clear the Path',
        stages: [
          { id: 'find_brute', journal: 'Find the brute on the road.' },
          { id: 'done', journal: 'The road is clear.' },
        ],
      },
      q_echoing_heartbeat: { name: 'Echoing Heartbeat', firstStage: 'listen', stages: [{ id: 'listen' }, { id: 'done_destroy' }] },
      q_side_errand: { name: 'Side Errand', countsForApex: false, stages: [{ id: 'go' }] },
    },
    companions: {
      brak: { name: 'Brak', stats: { hp: 190 }, startingLoyalty: 10 },
      mireya: { name: 'Mireya', stats: { hp: 120 } },
    },
    creatures: { cr_wildling_brute: { name: 'Wildling Brute' } },
    echoes: { echo_ilyra_watchword: { name: "Ilyra's Watchword" }, echo_apex_resonance: { name: 'Apex Resonance' } },
    codex: { codex_breach: { name: 'The Breach' } },
    endings: { ending_mending: { name: 'The Mending' } },
    modifiers: {
      mod_frayed_clock: { name: 'Frayed Clock', rules: [{ kind: 'clock_base_watches', watches: 80, halveOthers: true }] },
      mod_glass: { name: 'Glass', rules: [{ kind: 'damage_mult' }] },
    },
    factions: { remnants: { name: 'The Remnants' }, weavers: { name: 'The Weavers' }, ironclad: { name: 'The Ironclad' } },
  } as unknown as ContentPack;
}

/** One well-formed sample of every Action type (typed: a missing or extra type fails tsc). */
export function sampleActions(): { [K in ActionType]: Extract<Action, { type: K }> } {
  return {
    newGame: { type: 'newGame', name: 'Wayfinder', classId: 'ranger' }, // the listed form (U30); a custom name/seed is a payload, like `load`
    chooseClass: { type: 'chooseClass', classId: 'wizard' },
    save: { type: 'save', slot: 1 },
    load: { type: 'load', save: {} },
    returnToTitle: { type: 'returnToTitle' },
    move: { type: 'move', to: 'loc_shattered_library' },
    examine: { type: 'examine', target: { kind: 'location' } },
    take: { type: 'take', uid: 'i1' },
    takeAll: { type: 'takeAll' },
    rest: { type: 'rest', kind: 'short' },
    retreat: { type: 'retreat' },
    gather: { type: 'gather' },
    talk: { type: 'talk', npcId: 'npc_borin' },
    enterPortal: { type: 'enterPortal' },
    interact: { type: 'interact', eventId: 'ev_altar' },
    wait: { type: 'wait' },
    letGo: { type: 'letGo' },
    keepVigil: { type: 'keepVigil' },
    use: { type: 'use', uid: 'i1' },
    equip: { type: 'equip', uid: 'i1' },
    unequip: { type: 'unequip', slot: 'weapon' },
    drop: { type: 'drop', uid: 'i1' },
    allocateStat: { type: 'allocateStat', stat: 'strength' },
    unlockAbility: { type: 'unlockAbility', abilityId: 'rgr_marked_shot' },
    readBook: { type: 'readBook', uid: 'i1' },
    respec: { type: 'respec' },
    buy: { type: 'buy', merchantId: 'npc_kaelen_stonehand', uid: 'i1' },
    sell: { type: 'sell', merchantId: 'npc_kaelen_stonehand', uid: 'i1' },
    craft: { type: 'craft', recipeId: 'recipe_breach_anchor' },
    upgrade: { type: 'upgrade', uid: 'i1' },
    salvage: { type: 'salvage', uid: 'i1' },
    choose: { type: 'choose', choiceId: 'c1' },
    continue: { type: 'continue' },
    acceptQuest: { type: 'acceptQuest', questId: 'q_clear_path' },
    attack: { type: 'attack', targetUid: 'c2' },
    ability: { type: 'ability', abilityId: 'rgr_marked_shot', targetUid: 'c2' },
    guard: { type: 'guard' },
    item: { type: 'item', uid: 'i1' },
    flee: { type: 'flee' },
    companionCommand: { type: 'companionCommand', command: 'hold' },
    setStance: { type: 'setStance', stance: 'aggressive' },
    commune: { type: 'commune', act: 'listen' },
    swapCompanion: { type: 'swapCompanion', companionId: null },
    acknowledgeEnding: { type: 'acknowledgeEnding' },
    thresholdGo: { type: 'thresholdGo', to: 'loom' },
    thresholdSpend: { type: 'thresholdSpend', attunementId: 'att_steady_hours' },
    thresholdRefund: { type: 'thresholdRefund', attunementId: 'att_steady_hours' },
    equipAttunement: { type: 'equipAttunement', attunementId: 'att_steady_hours', on: true },
    toggleModifier: { type: 'toggleModifier', modifierId: 'mod_frayed_clock' },
    newLoop: { type: 'newLoop' },
    newGamePlus: { type: 'newGamePlus' },
  };
}
