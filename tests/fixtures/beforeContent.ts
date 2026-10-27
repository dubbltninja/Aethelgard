// Silverwood Before and Echo fixtures (U32; PLAN §8, §9.1 "later units may append fixtures for their own systems"): the
// Horde pack (companions, the engine-granted Echoes, no wandering rolls) plus
//   - `region_silverwood_before`, compressed from WORLD §3.11 to five nodes with WORLD's ids, 0-watch edges:
//       loc_silver_gate ─S─ loc_outer_walks ─E─ loc_apprentices_garret (camp: the Before's only rest)
//                                          └─S─ loc_archives_of_danthe ─S (Last Bell: `flag_before_day_3`)─ loc_conflux_chamber
//     the Breach-door (Nexus east ⟂ Silver Gate, Loop 2+; back west with `flag_entered_before_via_nexus`) and the
//     Tyrant's tear (Apex portal ⟂ Conflux with `flag_tyrant_spared`; back with `flag_entered_before_via_apex`);
//     a Second Bell encounter at the Walks (a Mireling stands in for WORLD's Ley Hounds), a Last Bell one in the
//     Conflux (the Aberration stands in for the Unbroken Warden), content items, a gathering node;
//   - `loc_heartstone_depths` below the Nexus behind a hidden Echo route (`echo_heartstone_path`, WORLD §11.3);
//   - the three `anchorable` items' two that matter (the Sky-Whisper Talisman, Hallow's Cradle-Pin);
//   - `q_stop_the_ritual` (resolved or not) and `q_lantern_in_the_reeds` with its STORY §11 shortcut (stage 2 with
//     `echo_glowlands_leak`); `q_echo_crystal` gains its `echo_crystal_location` shortcut;
//   - the Echoes DESIGN §10.5 / STORY §12 rules read or grant (fixture codex lines), the Heartstone triad made exclusive
//     (STORY §12), one Echo with an `onGrant` codex entry, and the Mute Ley modifier.
// Like the Horde pack it skips `validateContent` (engine-granted Echoes have no content source).
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import type { EchoInput } from '@schema/echo';
import type { ItemInput } from '@schema/item';
import type { LocationInput } from '@schema/location';
import type { ModifierInput } from '@schema/modifier';
import type { QuestInput } from '@schema/quest';
import type { RegionInput } from '@schema/region';
import { clone, deepFreeze } from '@engine/util/clone';
import { hordeTables } from './hordeContent';
import { FIXTURE_VERSION } from './miniContent';

export const GATE = 'loc_silver_gate';
export const WALKS = 'loc_outer_walks';
export const GARRET = 'loc_apprentices_garret';
export const ARCHIVES = 'loc_archives_of_danthe';
export const CONFLUX = 'loc_conflux_chamber';
export const DEPTHS = 'loc_heartstone_depths';
export const WALKS_HOUNDS = 'enc_walks_hounds';
export const CONFLUX_WARDEN = 'enc_conflux_warden';
export const TALISMAN = 'item_sky_whisper_talisman';
export const CRADLE_PIN = 'item_caelums_anchor_token';

const region = {
  id: 'region_silverwood_before',
  name: 'Silverwood Before',
  description: 'The city three days before the Sundering, repeating.',
  order: 11,
  levelBand: { min: 13, max: 17 },
  palette: { bg: '#2B2140', bgAlt: '#4A3B6B', fg: '#C9B8F0', accent: '#F2D16B', glow: '#F2D16B' },
  ambient: 'before_bells',
} satisfies RegionInput;

const art = (template: 'city' | 'archive' | 'cavern' | 'breach') => ({ template, timeOfDay: 'day' as const });
const before = (l: Omit<LocationInput, 'regionId' | 'art'> & { art?: LocationInput['art'] }): LocationInput => ({
  regionId: 'region_silverwood_before',
  art: art('city'),
  ...l,
});

const beforeLocations: LocationInput[] = [
  before({
    id: GATE,
    name: 'The Silver Gate',
    description: 'The arch, whole. Silver leaf on the keystone, nine faces newly cut.',
    exits: [
      { dir: 'west', to: 'loc_chronos_nexus', travelWatches: 0, when: { flag: 'flag_entered_before_via_nexus' }, label: 'the Breach-door' },
      { dir: 'south', to: WALKS, travelWatches: 0 },
    ],
    events: [{ id: 'ev_gate_whole', text: 'The arch is whole. It does not remember anything yet.', once: false }],
    map: { x: 64, y: 4 },
  }),
  before({
    id: WALKS,
    name: 'The Outer Walks',
    description: 'Gardens outside the gate where the Ruins will be.',
    exits: [
      { dir: 'north', to: GATE, travelWatches: 0 },
      { dir: 'east', to: GARRET, travelWatches: 0 },
      { dir: 'south', to: ARCHIVES, travelWatches: 0 },
    ],
    items: [{ itemId: 'item_mana_bloom' }],
    gather: { itemId: 'item_glow_moss', perDay: 1 },
    encounters: [{ id: WALKS_HOUNDS, groups: [{ creatureId: 'cr_glowfen_mireling' }], when: { beforeDay: 2 } }],
    map: { x: 64, y: 6 },
  }),
  before({
    id: GARRET,
    name: "The Apprentices' Garret",
    description: 'A long attic where the Circle\'s apprentices sleep.',
    exits: [{ dir: 'west', to: WALKS, travelWatches: 0 }],
    rest: { kind: 'camp', text: 'You sleep on a spare cot. A boy reads the Litany by candlelight.' },
    events: [{ id: 'ev_garret_litany', text: "Caelum reads aloud: 'What is read is owed.'", effects: [{ grantEcho: 'echo_litany_verse_2' }] }],
    map: { x: 72, y: 6 },
  }),
  before({
    id: ARCHIVES,
    name: 'The Archives of Danthe',
    description: 'The vaults, dry. A woman with Ilyra\'s hands writes the Litany in fair copy.',
    exits: [
      { dir: 'north', to: WALKS, travelWatches: 0 },
      { dir: 'south', to: CONFLUX, travelWatches: 0, when: { flag: 'flag_before_day_3' }, lockedText: 'The stair is warded until Last Bell.' },
    ],
    art: art('archive'),
    map: { x: 64, y: 8 },
  }),
  before({
    id: CONFLUX,
    name: 'The Conflux Chamber',
    description: "Nine plinths around a well of light; the whole Heartstone in Hallow's iron cradle.",
    exits: [
      { dir: 'north', to: ARCHIVES, travelWatches: 0 },
      { dir: 'portal', to: 'loc_temporal_breach_apex', travelWatches: 0, when: { flag: 'flag_entered_before_via_apex' }, label: 'through the tear' },
    ],
    items: [{ itemId: 'item_chronal_dust' }],
    encounters: [{ id: CONFLUX_WARDEN, groups: [{ creatureId: 'cr_temporal_aberration' }], when: { beforeDay: 3 }, elite: true }],
    art: art('cavern'),
    map: { x: 64, y: 10 },
  }),
];

const depths: LocationInput = {
  id: DEPTHS,
  regionId: 'region_glowlands_nexus', // fixture placement (WORLD §3.5 puts the Depths under the Nexus)
  name: 'Heartstone Depths',
  description: 'Nine plinths around a broken rim. The ninth is empty, or it is not.',
  exits: [{ dir: 'up', to: 'loc_chronos_nexus' }],
  art: art('cavern'),
  map: { x: 40, y: 12 },
};

const items: ItemInput[] = [
  {
    id: TALISMAN, name: 'Sky-Whisper Talisman', legacyName: 'Sky-Whisper Talisman', type: 'trinket', slot: 'trinket', tier: 2,
    description: 'A weathered charm that steadies breath in high winds.', stats: { agility: 1 }, value: 32, art: { icon: 'talisman' },
    tags: ['key'], anchorable: true,
  },
  {
    id: CRADLE_PIN, name: "Hallow's Cradle-Pin", type: 'quest', tier: 0, anchorable: true,
    description: "A forge-pin from the cradle's rim, Hallow's mark on the head.", value: 0, art: { icon: 'pin', major: true },
  },
];

const quests: QuestInput[] = [
  {
    id: 'q_stop_the_ritual',
    name: 'Stop the Ritual',
    description: 'Four attempts across the echo, each a small tragedy.',
    category: 'loop',
    botHint: 'explorer',
    stages: [
      { id: 'attempt', journal: 'Find a way to stop the Nine.' },
      { id: 'inevitable', journal: 'It was always going to fail.', outcome: 'complete' },
    ],
  },
  {
    id: 'q_lantern_in_the_reeds',
    name: 'Lantern in the Reeds',
    description: 'The sick of Lanternreed.',
    category: 'companion',
    botHint: 'explorer',
    stages: [
      { id: 'the_shining', journal: 'Three of Lanternreed are sick with the shining.', next: 'gather' },
      { id: 'gather', journal: 'Gather Glow Moss and Bitterroot.', next: 'tend' },
      { id: 'tend', journal: 'Tend the sick.', outcome: 'complete' },
    ],
    shortcuts: [{ echo: 'echo_glowlands_leak', skipTo: 'gather', text: 'She already knows you know what the light is.' }],
  },
];

const echo = (id: EchoInput['id'], name: string, category: EchoInput['category'], extra: Partial<EchoInput> = {}): EchoInput => ({
  id, name, codexLine: `Fixture: ${name}.`, category, obtainedBy: ['fixture'], ...extra,
});

export const beforeEchoes: EchoInput[] = [
  echo('echo_before_route', 'Three Days Before', 'route', { onGrant: [{ unlockCodex: 'codex_tyrant_holding' }] }),
  echo('echo_flickering_man', 'The Flickering Man', 'character'),
  echo('echo_breach_recoil', 'The Recoil', 'lore'),
  echo('echo_ninth_verse_unfinished', 'The Unfinished Verse', 'lore'),
  echo('echo_nyx_bond', 'A Bond Remembered (Nyx)', 'character'),
  echo('echo_ilyra_bond', 'A Bond Remembered (Ilyra)', 'character'),
  echo('echo_dask_bond', 'A Bond Remembered (Dask)', 'character'),
  echo('echo_mireya_bond', 'A Bond Remembered (Mireya)', 'character'),
  echo('echo_caelum_bond', 'A Bond Remembered (Caelum)', 'character'),
  echo('echo_brak_lives', 'The Line at the Nexus', 'character'),
  echo('echo_ilyra_watchword', 'The Ink Still Holds', 'dialogue'),
  echo('echo_weaver_sign', "The Weavers' Hand-Sign", 'route'),
  echo('echo_ironclad_oath', 'Oath-Brother', 'character'),
  echo('echo_crystal_location', 'The Third Alcove', 'shortcut'),
  echo('echo_glowlands_leak', 'The Glow Is the Breach', 'shortcut'),
  echo('echo_heartstone_path', 'The Way Down', 'route'),
  echo('echo_heartstone_hunger', 'Hunger', 'ending', { exclusiveWith: ['echo_heartstone_resonance', 'echo_heartstone_silence'] }),
  echo('echo_heartstone_silence', 'Silence', 'ending', { exclusiveWith: ['echo_heartstone_resonance', 'echo_heartstone_hunger'] }),
];

const muteLey: ModifierInput = {
  id: 'mod_mute_ley',
  name: 'Mute Ley',
  description: 'Echo shortcuts disabled.',
  rules: [{ kind: 'disable_echo_shortcuts' }],
  icon: 'mute_ley',
};

export function beforeTables(): ContentTables {
  const base = hordeTables();
  const locations = base.locations.map((loc) => {
    const l = clone(loc) as LocationInput;
    if (l.id === 'loc_chronos_nexus') {
      l.exits = [
        ...(l.exits ?? []),
        { dir: 'east', to: GATE, travelWatches: 0, when: { loop: { min: 2 } }, label: 'the Breach-door' },
        { dir: 'down', to: DEPTHS, hidden: true, when: { echo: 'echo_heartstone_path' } },
      ];
    }
    if (l.id === 'loc_temporal_breach_apex') {
      l.exits = [...(l.exits ?? []), { dir: 'portal', to: CONFLUX, travelWatches: 0, when: { flag: 'flag_tyrant_spared' }, label: 'through the tear' }];
    }
    return l;
  });
  const echoes = base.echoes.map((e) =>
    e.id === 'echo_heartstone_resonance' ? { ...clone(e), exclusiveWith: ['echo_heartstone_hunger', 'echo_heartstone_silence'] as EchoInput['exclusiveWith'] } : e,
  );
  return {
    ...base,
    regions: [...base.regions, region],
    locations: [...locations, ...beforeLocations, depths],
    items: [...base.items, ...items],
    quests: [
      ...base.quests.map((q) =>
        q.id === 'q_echo_crystal' ? { ...clone(q), shortcuts: [{ echo: 'echo_crystal_location' as const, skipTo: 'crystal_found', text: 'Behind the fallen shelf, third alcove.' }] } : q,
      ),
      ...quests,
    ],
    echoes: [...echoes, ...beforeEchoes],
    modifiers: [...base.modifiers, muteLey],
  };
}

let cached: ContentPack | null = null;

/** The Before pack (cached, frozen; parsed by every schema, cross-reference validation skipped — see the header). */
export function beforePack(): ContentPack {
  cached ??= deepFreeze(buildContentPack(beforeTables(), { version: FIXTURE_VERSION, validate: false }));
  return cached;
}
